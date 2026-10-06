"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

const protectedHashes = {
  "engine/services/speech-recognition-adapter.js": "1261497515055b11c6caa0d26eb8773d848d656bc17ba7a5c9f7b53798b365ad",
  "engine/services/speech-engine.js": "a2a9242796cb2cba759ee99d270a1ee0e3e11a761314546a376135b645bc1e13",
  "engine/services/speech-start-controller.js": "f6d1224d0ae71f8ee12067f0ede79650dae84a88d2c68b7ce474ce48c24b8161",
  "engine/managers/monster-battle-manager.js": "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3",
  "engine/managers/morning-manager.js": "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856"
};
for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.strictEqual(hash(file), expected, `${file} must remain unchanged`);
}

const speechPlans = [];
const choicePlans = [];
const speechButtons = [];
let speechStarts = 0;
let speechPrepares = 0;
let speechCancels = 0;
let legacyCalls = 0;

const context = { console, window: {}, setTimeout, clearTimeout };
context.window = context;
context.document = {
  getElementById(id) {
    if (id !== "controls") return null;
    return {
      appendChild(button) {
        speechButtons.push(button);
        Promise.resolve().then(() => button.click());
      }
    };
  }
};
context.AudioManager = { stopAll() {} };
context.GameCore = {
  async speechMission() {
    legacyCalls += 1;
    return "hello";
  }
};
context.SpeechStartController = {
  async prepare() { speechPrepares += 1; },
  async startListening(options) {
    speechStarts += 1;
    const plan = speechPlans.shift();
    if (!plan) throw new Error("missing-speech-plan");
    if (plan.alternatives && options.onAlternatives) options.onAlternatives(plan.alternatives);
    if (plan.interim && options.onInterim) options.onInterim(plan.interim);
    if (plan.run) return plan.run(options);
    if (plan.error) throw new Error(plan.error);
    return plan.final;
  },
  cancel() { speechCancels += 1; }
};
context.SpeechEngine = {
  getStatus: () => "idle",
  stop() {},
  async listen() { throw new Error("direct-speech-engine-used"); }
};
context.DialogManager = {
  button(label, onClick) { return { label, click: onClick }; },
  show() {}, showRecognized() {}, hideRecognized() {},
  async choice() {
    if (!choicePlans.length) throw new Error("missing-choice-plan");
    return choicePlans.shift();
  },
  async textInput() { throw new Error("unexpected-text-fallback"); },
  async next() { return "next"; }
};

vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }
[
  "engine/services/speech-normalizer.js",
  "data/word-dictionaries.js",
  "data/questions.js",
  "data/communicative-judge-rules.js",
  "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js",
  "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js",
  "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js"
].forEach(load);

const realEvaluate = context.CommunicativeQuestionAdapter.evaluate;
const realJudge = context.CommunicativeJudge.judge;
let evaluateCalls = 0;
let judgeCalls = 0;
let forcedVerdict = null;
context.CommunicativeQuestionAdapter.evaluate = async function () {
  evaluateCalls += 1;
  return realEvaluate.apply(this, arguments);
};
context.CommunicativeJudge.judge = async function (input) {
  judgeCalls += 1;
  if (forcedVerdict) {
    return { verdict: forcedVerdict, source: "test", reason: "forced-" + forcedVerdict.toLowerCase() };
  }
  return realJudge(input);
};

function speech(plan) { speechPlans.push(plan); }
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  // 1. A real final transcript always wins over interim and reaches Adapter/Judge.
  speech({ interim: "wrong interim", alternatives: ["wrong interim"], final: "Are you OK?" });
  let value = await context.QuestionManager.start("phrase.are_you_ok");
  assert.strictEqual(value.answer, "Are you OK?");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(evaluateCalls, 1);
  assert.strictEqual(judgeCalls, 1);

  // 2-3. Only no-speech and speech-timeout rescue an acquired interim candidate.
  for (const error of ["no-speech", "speech-timeout"]) {
    speech({ interim: "are you okay", alternatives: ["are you okay", "background noise"], error });
    value = await context.QuestionManager.start("phrase.are_you_ok");
    assert.strictEqual(value.answer, "are you okay");
    assert.strictEqual(value.status, "success");
    assert.strictEqual(value.judge.verdict, "ACCEPT");
    assert.strictEqual(value.error, null);
  }
  assert.strictEqual(evaluateCalls, 3);
  assert.strictEqual(judgeCalls, 3);

  // 4-5. Fallback recognition never decides correctness; Judge owns REJECT/UNKNOWN.
  for (const verdict of ["REJECT", "UNKNOWN"]) {
    forcedVerdict = verdict;
    speech({ interim: "unrelated words", alternatives: ["unrelated words"], error: "no-speech" });
    value = await context.QuestionManager.start("phrase.are_you_ok");
    assert.strictEqual(value.answer, "unrelated words");
    assert.strictEqual(value.status, verdict.toLowerCase());
    assert.strictEqual(value.judge.verdict, verdict);
    assert.notStrictEqual(value.status, "success");
  }
  forcedVerdict = null;

  // 6-7. Without a real candidate, eligible errors remain speech-failure.
  for (const error of ["no-speech", "speech-timeout"]) {
    const beforeEvaluate = evaluateCalls;
    const beforeJudge = judgeCalls;
    speech({ error });
    value = await context.QuestionManager.start("phrase.are_you_ok");
    assert.strictEqual(value.status, "speech-failure");
    assert.strictEqual(value.error, error);
    assert.strictEqual(evaluateCalls, beforeEvaluate);
    assert.strictEqual(judgeCalls, beforeJudge);
  }

  // 8-10. Other errors never use an interim/alternative fallback.
  for (const error of ["recognition-error", "not-allowed", "speech-not-supported"]) {
    const beforeEvaluate = evaluateCalls;
    speech({ interim: "are you okay", alternatives: ["are you okay"], error });
    value = await context.QuestionManager.start("phrase.are_you_ok");
    assert.strictEqual(value.status, "speech-failure");
    assert.strictEqual(value.error, error);
    assert.strictEqual(evaluateCalls, beforeEvaluate);
  }

  // 11. Final remains primary even when a valid interim was acquired.
  speech({ interim: "Are you OK?", alternatives: ["Are you OK?", "Is everything okay?"], final: "Are you all right?" });
  value = await context.QuestionManager.start("phrase.are_you_ok");
  assert.strictEqual(value.answer, "Are you all right?");
  assert.strictEqual(value.status, "success");

  // 12. Alternatives stay unique and capped at five.
  forcedVerdict = "UNKNOWN";
  speech({
    interim: "fallback primary",
    alternatives: ["fallback primary", "one", "two", "three", "four", "five", "one", "six"],
    error: "speech-timeout"
  });
  value = await context.QuestionManager.start("phrase.are_you_ok");
  assert.strictEqual(value.answer, "fallback primary");
  assert(value.alternatives.length <= 5);
  assert.strictEqual(new Set(Array.from(value.alternatives, item => context.SpeechNormalizer.normalize(item))).size, value.alternatives.length);
  assert(!Array.from(value.alternatives, item => context.SpeechNormalizer.normalize(item)).includes("fallback primary"));
  forcedVerdict = null;

  // 13. Formal retry remains limited to one Speech retry.
  const startsBeforeRetry = speechStarts;
  speech({ interim: "candidate", error: "recognition-error" });
  speech({ interim: "candidate", error: "recognition-error" });
  choicePlans.push("retry", "continue");
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(speechStarts - startsBeforeRetry, 2);
  assert.strictEqual(value.attemptCount, 2);
  assert.strictEqual(value.maxRetries, 1);
  assert.strictEqual(value.status, "continued");

  // 14. Cancelling a pending run still wins over any stale completion.
  const pending = deferred();
  speech({ interim: "are you okay", run: () => pending.promise });
  const cancelledRun = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();
  context.CommunicativeQuestionFlowController.cancel();
  pending.resolve("Are you OK?");
  value = await cancelledRun;
  assert.strictEqual(value.status, "cancelled");
  assert.strictEqual(value.resolution, "cancelled");
  assert(speechCancels > 0);

  // 15. Legacy remains on GameCore.speechMission and keeps its legacy result shape.
  const startsBeforeLegacy = speechStarts;
  const preparesBeforeLegacy = speechPrepares;
  value = await context.QuestionManager.start("word.hello");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.answer, "hello");
  assert.strictEqual(value.judgeMode, undefined);
  assert.strictEqual(value.alternatives, undefined);
  assert.strictEqual(speechStarts, startsBeforeLegacy);
  assert.strictEqual(speechPrepares, preparesBeforeLegacy + 1);
  assert.strictEqual(legacyCalls, 1);

  // 16. Monster and Morning remain isolated from Formal fallback logic.
  assert(!read("engine/managers/monster-battle-manager.js").includes("mergeCommunicativeCandidates"));
  assert(!read("engine/managers/morning-manager.js").includes("mergeCommunicativeCandidates"));

  console.log("Formal Communicative Speech Fallback V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
