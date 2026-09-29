"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {}, AudioManager: { stopAll() {} } };
context.window = context;
let speechStarts = 0;
let judgeCalls = 0;
context.SpeechStartController = {
  async prepare() {},
  async startListening() { speechStarts += 1; return "Are you OK?"; },
  cancel() {}
};
context.SpeechEngine = { async listen() { speechStarts += 1; return "Are you OK?"; }, getStatus: () => "idle", stop() {} };
context.GameCore = { async speechMission() { return "legacy"; } };
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }

[
  "engine/services/speech-normalizer.js", "data/word-dictionaries.js", "data/questions.js",
  "data/communicative-judge-rules.js", "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js", "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js"
].forEach(load);

const realJudge = context.CommunicativeJudge.judge;
context.CommunicativeJudge.judge = async input => { judgeCalls += 1; return realJudge(input); };

(async () => {
  const questions = context.QuestionDatabase.all();
  assert.strictEqual(questions.length, 21);
  const communicative = questions.filter(question => question.communicative);
  assert.deepStrictEqual(Array.from(communicative, question => question.id), ["phrase.are_you_ok"]);
  assert.strictEqual(questions.filter(question => !question.communicative).length, 20);

  const target = context.QuestionDatabase.get("phrase.are_you_ok");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(target.communicative)), {
    conceptId: "social.wellbeing.ask", difficulty: "starter",
    promptType: "question", expectedUtterance: "Are you OK?"
  });
  assert.deepStrictEqual(Array.from(target.answers), ["are you ok", "are you okay"]);
  assert.strictEqual(target.prompt, "“Are you OK?”（大丈夫ですか？）と尋ねてみよう。");

  for (const utterance of [
    "Are you OK?", "Are you okay?", "Are you all right?", "Are you alright?", "Is everything okay?"
  ]) {
    const value = await realJudge({ conceptId: "social.wellbeing.ask", utterance, difficulty: "starter", alternatives: [] });
    assert.strictEqual(value.verdict, "ACCEPT", utterance);
    assert.strictEqual(value.source, "local");
  }

  let value = await realJudge({ conceptId: "social.wellbeing.ask", utterance: "I don't care.", difficulty: "starter" });
  assert.strictEqual(value.verdict, "REJECT");
  assert.strictEqual(value.reason, "explicit-refusal");

  for (const utterance of ["I'm OK.", "How are you doing?", "Are you OK tomorrow?", "okay"]) {
    value = await realJudge({ conceptId: "social.wellbeing.ask", utterance, difficulty: "starter" });
    assert.strictEqual(value.verdict, "UNKNOWN", utterance);
    assert.strictEqual(value.reason, "no-provider");
  }

  value = await realJudge({ conceptId: "shopping.fruit.apple.order", utterance: "Can I have apple", difficulty: "starter" });
  assert.strictEqual(value.verdict, "UNKNOWN");
  assert.strictEqual(value.reason, "no-provider");

  const speechBeforeText = speechStarts;
  const judgeBeforeText = judgeCalls;
  value = await context.QuestionManager.start("phrase.are_you_ok", { inputMode: "text", transcript: "Are you all right?" });
  assert.strictEqual(value.status, "success");
  assert.strictEqual(value.judge.verdict, "ACCEPT");
  assert.strictEqual(value.resolution, "accepted");
  assert.strictEqual(value.answer, "Are you all right?");
  assert.strictEqual(speechStarts, speechBeforeText, "Text mode must not start Speech Recognition");
  assert.strictEqual(judgeCalls, judgeBeforeText + 1, "Text mode must pass through Judge");

  value = await context.QuestionManager.start("phrase.are_you_ok", { inputMode: "text", transcript: "I don't care." });
  assert.strictEqual(value.status, "reject");
  value = await context.QuestionManager.start("phrase.are_you_ok", { inputMode: "text", transcript: "I'm OK." });
  assert.strictEqual(value.status, "unknown");
  assert.notStrictEqual(value.status, "success");

  assert.deepStrictEqual(Object.keys(context.QuestionManager).sort(), ["cancel", "getResult", "reset", "start"]);
  console.log("Formal Communicative Question Data V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
