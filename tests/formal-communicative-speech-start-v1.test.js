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
  "engine/services/speech-engine.js": "3318e03a55a2506fccfeca2481d0b286e69074c63f5539d73b1b5b27e6371264",
  "engine/services/speech-start-controller.js": "73ea61ec3cc4a2532b220f298d2e48d8e66d03fac9901cbf4662bc89c65a883b",
  "engine/core/story-engine.js": "ecca2bac442d5002fec99d8f9e826756bee6afd2efd24a093c187d041f5afbeb",
  "engine/stories/S004.js": "b004f23146691f28a420e8918dd61577ad0f45a9daee4af63e2c82c42b0cc905",
  "data/questions.js": "7f94f150fff8ef7af49e4bd7f86614900eafb0fb1d3d772861142feb68d75904",
  "data/communicative-judge-rules.js": "acae74a247318a54ef09ac75c04c444c14dedc798c67abf3b793fc0529dd9279",
  "engine/services/local-communicative-judge.js": "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58",
  "engine/services/communicative-judge.js": "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04",
  "engine/services/communicative-question-adapter.js": "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f",
  "engine/managers/monster-battle-manager.js": "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3",
  "engine/managers/morning-manager.js": "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856"
};
for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.strictEqual(hash(file), expected, `${file} must remain unchanged`);
}

const speechPlans = [];
const speechButtons = [];
const choicePlans = [];
const shownChoices = [];
const messages = [];
const recognized = [];
const events = [];
let insideSpeechClick = false;
let speechPrepares = 0;
let speechStarts = 0;
let speechCancels = 0;
let legacyCalls = 0;
let evaluateCalls = 0;
let judgeCalls = 0;

const controls = {
  children: [],
  appendChild(button) {
    this.children.push(button);
    speechButtons.push(button);
    events.push("button");
  }
};
const context = { console, window: {}, setTimeout, clearTimeout };
context.window = context;
context.document = { getElementById(id) { return id === "controls" ? controls : null; } };
context.AudioManager = { stopAll() {} };
context.GameCore = { async speechMission() { legacyCalls += 1; return "hello"; } };
context.SpeechStartController = {
  async prepare() {
    speechPrepares += 1;
    events.push("prepare");
  },
  async startListening(options, ui) {
    assert.strictEqual(insideSpeechClick, true, "Formal startListening must run inside the Speech button click handler");
    speechStarts += 1;
    events.push("start");
    if (ui && typeof ui.showRecognized === "function") ui.showRecognized("…");
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
context.SpeechEngine = { getStatus: () => "idle", stop() {}, async listen() { throw new Error("direct-speech-engine-used"); } };
context.DialogManager = {
  button(label, onClick) {
    return {
      label,
      click() {
        insideSpeechClick = true;
        try { return onClick(); }
        finally { insideSpeechClick = false; }
      }
    };
  },
  show(speaker, message) {
    messages.push([speaker, message]);
    controls.children = [];
  },
  showRecognized(text, prefix) { recognized.push(String(prefix || "") + String(text || "")); },
  hideRecognized() {},
  choice(options) {
    shownChoices.push(options.map(option => option.value));
    if (!choicePlans.length) throw new Error("missing-choice-plan");
    return Promise.resolve(choicePlans.shift());
  },
  async textInput() { throw new Error("unexpected-text-input"); },
  async next() { return "next"; }
};

vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }
[
  "engine/services/speech-normalizer.js", "data/word-dictionaries.js", "data/questions.js",
  "data/communicative-judge-rules.js", "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js", "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js", "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js"
].forEach(load);

const realEvaluate = context.CommunicativeQuestionAdapter.evaluate;
const realJudge = context.CommunicativeJudge.judge;
context.CommunicativeQuestionAdapter.evaluate = async function () {
  evaluateCalls += 1;
  return realEvaluate.apply(this, arguments);
};
context.CommunicativeJudge.judge = async function () {
  judgeCalls += 1;
  return realJudge.apply(this, arguments);
};

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
async function pendingFormal(plan) {
  const buttonCount = speechButtons.length;
  speechPlans.push(plan);
  const run = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();
  assert.strictEqual(speechButtons.length, buttonCount + 1, "prepare completion must expose one Speech button");
  return { run, button: speechButtons.at(-1) };
}

(async () => {
  // Initial Formal attempt waits after prepare; the real button click starts Speech exactly once.
  const preparesBefore = speechPrepares;
  const startsBefore = speechStarts;
  const first = await pendingFormal({ interim: "are you okay", alternatives: ["are you okay"], final: "Are you OK?" });
  assert.strictEqual(speechPrepares, preparesBefore + 1);
  assert.strictEqual(speechStarts, startsBefore, "Formal Speech must not auto-start");
  assert.strictEqual(first.button.label, "話す");
  assert(events.lastIndexOf("prepare") < events.lastIndexOf("button"));
  assert(messages.some(call => call[1] === "準備できたよ。話してみよう。"));
  first.button.click();
  first.button.click();
  let value = await first.run;
  assert.strictEqual(speechStarts, startsBefore + 1, "double click must not create a second session");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.judge.verdict, "ACCEPT");
  assert.strictEqual(evaluateCalls, 1);
  assert.strictEqual(judgeCalls, 1);
  assert(messages.some(call => call[1] === "聞き取り中…"));
  assert(recognized.includes("聞き取り中：are you okay"));

  // Existing Formal fallback remains active after the user-started session.
  for (const error of ["no-speech", "speech-timeout"]) {
    const attempt = await pendingFormal({ interim: "are you okay", alternatives: ["are you okay"], error });
    attempt.button.click();
    value = await attempt.run;
    assert.strictEqual(value.status, "success");
    assert.strictEqual(value.answer, "are you okay");
    assert.strictEqual(value.judge.verdict, "ACCEPT");
  }

  // Chrome may report no-speech before dispatching its last interim result.
  // Formal keeps a short candidate window open so the late utterance still reaches Judge.
  const lateCandidate = await pendingFormal({
    run(options) {
      return new Promise((resolve, reject) => {
        reject(new Error("no-speech"));
        setTimeout(() => options.onInterim("are you okay"), 0);
      });
    }
  });
  lateCandidate.button.click();
  value = await lateCandidate.run;
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.answer, "are you okay");
  assert.strictEqual(value.judge.verdict, "ACCEPT");

  // Once the candidate window closes, stale browser events must not overwrite recovery UI.
  choicePlans.push("continue");
  const staleText = "late stale interim";
  const staleCandidate = await pendingFormal({
    run(options) {
      return new Promise((resolve, reject) => {
        reject(new Error("no-speech"));
        setTimeout(() => options.onInterim(staleText), 300);
      });
    }
  });
  staleCandidate.button.click();
  value = await staleCandidate.run;
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.strictEqual(value.status, "continued");
  assert(!recognized.includes("聞き取り中：" + staleText));

  // not-allowed is preserved and does not offer a microphone retry.
  choicePlans.push("continue");
  const denied = await pendingFormal({ interim: "are you okay", error: "not-allowed" });
  denied.button.click();
  value = await denied.run;
  assert.strictEqual(value.status, "continued");
  assert.deepStrictEqual(Array.from(shownChoices.at(-1)), ["text", "continue"]);

  // Retry also waits for a fresh user click and remains capped at one.
  choicePlans.push("retry");
  const retryButtonCount = speechButtons.length;
  speechPlans.push({ error: "recognition-error" }, { final: "Are you okay?" });
  const retryRun = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();
  const retryFirstButton = speechButtons.at(-1);
  retryFirstButton.click();
  await flush();
  assert.strictEqual(speechButtons.length, retryButtonCount + 2, "Retry must create one fresh Speech button");
  const retryStartsBeforeSecondClick = speechStarts;
  const retrySecondButton = speechButtons.at(-1);
  assert.notStrictEqual(retrySecondButton, retryFirstButton);
  assert.strictEqual(speechStarts, retryStartsBeforeSecondClick, "Retry must not auto-start");
  retrySecondButton.click();
  value = await retryRun;
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.attemptCount, 2);
  assert.strictEqual(value.maxRetries, 1);

  // Cancellation before click prevents Speech; clicking the stale button is inert.
  const beforeCancelStarts = speechStarts;
  const cancelledBeforeClick = await pendingFormal({ final: "Are you OK?" });
  context.CommunicativeQuestionFlowController.cancel();
  cancelledBeforeClick.button.click();
  value = await cancelledBeforeClick.run;
  assert.strictEqual(value.status, "cancelled");
  assert.strictEqual(speechStarts, beforeCancelStarts);

  // Cancellation after click wins over stale Speech completion.
  const pending = deferred();
  const stale = await pendingFormal({ run: () => pending.promise });
  stale.button.click();
  context.CommunicativeQuestionFlowController.cancel();
  pending.resolve("Are you OK?");
  value = await stale.run;
  assert.strictEqual(value.status, "cancelled");
  assert.strictEqual(value.resolution, "cancelled");
  assert(speechCancels > 0);

  // Legacy remains outside the Formal click gate.
  const legacyStartsBefore = speechStarts;
  value = await context.QuestionManager.start("word.hello");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.answer, "hello");
  assert.strictEqual(value.judgeMode, undefined);
  assert.strictEqual(speechStarts, legacyStartsBefore);
  assert.strictEqual(legacyCalls, 1);

  // Production and DEV share one cache key for the Formal runtime assets.
  const formalAssets = [
    "engine/managers/question-manager.js",
    "engine/presenters/communicative-question-presenter.js",
    "engine/controllers/communicative-question-flow-controller.js"
  ];
  const indexHtml = read("index.html");
  const devHtml = read("dev.html");
  for (const file of formalAssets) {
    const version = file === "engine/managers/question-manager.js" ?
      "s005-rule-real-browser-trace-v1" : file === "engine/presenters/communicative-question-presenter.js" ?
      "mobile-ui-story-polish-v1-1" : "s005-phase-a2-v1";
    assert(indexHtml.includes(`${file}?v=${version}`));
    assert(devHtml.includes(`${file}?v=${version}`));
  }
  assert.strictEqual((indexHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 5);
  assert(!indexHtml.includes("formal-speech-trace"));

  assert(!read("engine/managers/monster-battle-manager.js").includes("CommunicativeQuestionPresenter.speech"));
  assert(!read("engine/managers/morning-manager.js").includes("CommunicativeQuestionPresenter.speech"));
  console.log("Formal Communicative Speech Start V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
