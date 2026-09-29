const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = {
  console,
  window: {},
  audioStops: 0,
  callOrder: [],
  AudioManager: {
    stopAll: () => {
      context.audioStops += 1;
      context.callOrder.push("stopAll");
    }
  },
  GameCore: {
    speechMission: async config => {
      context.callOrder.push("speechMission");
      context.lastMission = config;
      return "hello";
    }
  },
  SpeechEngine: {
    getStatus: () => "idle",
    stop: () => {}
  }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/word-dictionaries.js");
load("data/questions.js");
load("engine/managers/question-manager.js");

assert.deepStrictEqual(
  Object.keys(context.QuestionManager).sort(),
  ["start", "cancel", "getResult", "reset"].sort()
);

(async () => {
  const question = context.QuestionDatabase.get("word.hello");
  assert.deepStrictEqual(
    Object.keys(question).sort(),
    ["answers", "category", "failure", "hint", "id", "prompt", "speechPolicy", "success"].sort()
  );

  const result = await context.QuestionManager.start("word.hello");
  assert.strictEqual(result.status, "success");
  assert.strictEqual(result.answer, "hello");
  assert.strictEqual(context.lastMission.message, question.prompt);
  assert.deepStrictEqual(context.lastMission.accepted, question.answers);
  assert.strictEqual(context.lastMission.retryOnMismatch, false);
  assert.strictEqual(context.lastMission.failure, question.failure);
  assert.strictEqual(context.QuestionManager.getResult().hint, "ハロー");
  assert.strictEqual(context.audioStops, 1);
  assert.deepStrictEqual(context.callOrder.slice(0, 2), ["stopAll", "speechMission"]);

  const externalResult = context.QuestionManager.getResult();
  externalResult.status = "tampered";
  assert.strictEqual(context.QuestionManager.getResult().status, "success");

  context.QuestionManager.reset();
  assert.strictEqual(context.QuestionManager.getResult(), null);
  await assert.rejects(() => context.QuestionManager.start("missing"), /Question not found/);

  context.GameCore.speechMission = async () => ({ matched: false, answer: "goodbye" });
  const failure = await context.QuestionManager.start("word.hello");
  assert.strictEqual(failure.status, "failure");
  assert.strictEqual(failure.answer, "goodbye");
  assert.strictEqual(failure.error, null);

  let finishFirst;
  context.GameCore.speechMission = () => new Promise(resolve => { finishFirst = resolve; });
  const firstRun = context.QuestionManager.start("word.hello");
  assert.strictEqual(context.QuestionManager.cancel().status, "cancelled");
  finishFirst("hello");
  assert.strictEqual((await firstRun).status, "cancelled");

  context.AudioManager.stopAll = () => { throw new Error("stop failed"); };
  context.GameCore.speechMission = async () => "hello";
  assert.strictEqual((await context.QuestionManager.start("word.hello")).status, "success",
    "Audio stop failure must not block Question progression");

  console.log("Question Manager tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
