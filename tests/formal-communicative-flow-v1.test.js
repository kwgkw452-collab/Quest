"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const speechPlans = [];
const choicePlans = [];
const textPlans = [];
const shownChoices = [];
const messages = [];
const speechButtons = [];
let speechStarts = 0;
let speechCancels = 0;
let judgeCalls = 0;

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
context.GameCore = { async speechMission() { return "legacy"; } };
context.SpeechStartController = {
  async prepare() {},
  startListening(options) {
    const plan = speechPlans.shift();
    if (!plan) throw new Error("missing-speech-plan");
    speechStarts += 1;
    return plan(options);
  },
  cancel() { speechCancels += 1; }
};
context.SpeechEngine = { getStatus: () => "idle", stop() {}, async listen() { throw new Error("unexpected-direct-listen"); } };
context.DialogManager = {
  button(label, onClick) { return { label, click: onClick }; },
  show(speaker, message) { messages.push([speaker, message]); },
  showRecognized() {}, hideRecognized() {},
  choice(options) {
    shownChoices.push(options.map(option => option.value));
    const plan = choicePlans.shift();
    if (typeof plan === "function") return plan(options);
    return Promise.resolve(plan);
  },
  textInput() { return Promise.resolve(textPlans.shift()); },
  next() { return Promise.resolve("next"); }
};
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
[
  "engine/services/speech-normalizer.js", "data/word-dictionaries.js", "data/questions.js",
  "data/communicative-judge-rules.js", "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js", "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js", "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js"
].forEach(load);

const realJudge = context.CommunicativeJudge.judge;
context.CommunicativeJudge.judge = async input => { judgeCalls += 1; return realJudge(input); };
function speech(value, alternatives) {
  speechPlans.push(async options => {
    if (alternatives && options.onAlternatives) options.onAlternatives(alternatives);
    return value;
  });
}
function speechError(message) { speechPlans.push(async () => { throw new Error(message); }); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

(async () => {
  speech("Are you OK?");
  let value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.resolution, "accepted");
  assert.strictEqual(value.attemptCount, 1);

  speech("I don't care.");
  speech("Are you okay?");
  choicePlans.push("retry");
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.attemptCount, 2);
  assert.deepStrictEqual(Array.from(shownChoices.at(-1)), ["retry", "text", "continue"]);

  const startsBeforeText = speechStarts;
  speech("I'm OK.");
  choicePlans.push("text");
  textPlans.push("Is everything okay?");
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.attemptCount, 2);
  assert.strictEqual(speechStarts, startsBeforeText + 1, "Text fallback must not add a Speech start");

  speechError("no-speech");
  choicePlans.push("continue");
  const judgeBeforeFailure = judgeCalls;
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "continued");
  assert.strictEqual(value.resolution, "continue");
  assert.notStrictEqual(value.status, "success");
  assert.strictEqual(judgeCalls, judgeBeforeFailure, "Speech failure must not call Judge");
  assert(messages.some(call => call[1] === "大丈夫。冒険を続けよう。"));

  speechError("not-allowed");
  choicePlans.push("continue");
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "continued");
  assert.deepStrictEqual(Array.from(shownChoices.at(-1)), ["text", "continue"], "Permission failure must not force microphone retry");

  speechError("speech-not-supported");
  choicePlans.push("continue");
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "continued");
  assert.deepStrictEqual(Array.from(shownChoices.at(-1)), ["text", "continue"]);

  speech("I'm OK.");
  speech("How are you doing?");
  choicePlans.push("retry", "continue");
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "continued");
  assert.deepStrictEqual(Array.from(shownChoices.at(-1)), ["text", "continue"], "Only one Speech retry is allowed");

  speech("I'm OK.");
  choicePlans.push("text", "continue");
  textPlans.push("How are you doing?");
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "continued");
  assert.deepStrictEqual(Array.from(shownChoices.at(-1)), ["continue"], "Text fallback is limited to one and cannot return to Speech retry");

  const alternativeSource = ["noise", "Are you all right?", "three", "four", "five", "six"];
  const alternativeCopy = alternativeSource.slice();
  speech("noise", alternativeSource);
  value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.alternatives.length, 5);
  assert.deepStrictEqual(alternativeSource, alternativeCopy);
  assert.strictEqual(value.judge.matchedVariant, "Are you all right?");

  const pendingSpeech = deferred();
  speechPlans.push(async () => { speechStarts += 0; return pendingSpeech.promise; });
  const cancelledRun = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();
  context.CommunicativeQuestionFlowController.cancel();
  pendingSpeech.resolve("Are you OK?");
  value = await cancelledRun;
  assert.strictEqual(value.status, "cancelled");
  assert.strictEqual(value.resolution, "cancelled");

  const pendingJudge = deferred();
  context.CommunicativeJudge.judge = async () => pendingJudge.promise;
  speech("Are you OK?");
  const judgeRun = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();
  context.CommunicativeQuestionFlowController.cancel();
  pendingJudge.resolve({ verdict: "ACCEPT", source: "local", reason: "approved-variant" });
  value = await judgeRun;
  assert.strictEqual(value.status, "cancelled", "Stale Judge completion must stay cancelled");
  context.CommunicativeJudge.judge = async input => { judgeCalls += 1; return realJudge(input); };

  const pendingChoice = deferred();
  speech("I'm OK.");
  choicePlans.push(() => pendingChoice.promise);
  const uiRun = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();
  context.CommunicativeQuestionFlowController.cancel();
  pendingChoice.resolve("continue");
  value = await uiRun;
  assert.strictEqual(value.status, "cancelled", "Stale UI choice must not continue the Story");
  assert(speechCancels > 0);

  for (const error of ["speech-timeout", "recognition-error"]) {
    speechError(error);
    choicePlans.push("continue");
    const callsBefore = judgeCalls;
    value = await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
    assert.strictEqual(value.status, "continued");
    assert.strictEqual(judgeCalls, callsBefore);
  }

  console.log("Formal Communicative Flow V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
