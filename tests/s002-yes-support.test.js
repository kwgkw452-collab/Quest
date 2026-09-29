"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const messages = [];
let attempts = 0;
const context = {
  console,
  window: {},
  GameCore: { clearVisuals() {} },
  QuestionManager: {
    async start(id) {
      assert.strictEqual(id, "phrase.yes_can_hear_you");
      attempts += 1;
      return { questionId: id, status: attempts < 4 ? "failure" : "success", answer: attempts < 4 ? "" : "yes" };
    }
  },
  DialogManager: {
    show(speaker, text) { messages.push([speaker, text]); },
    async next() {}, async choice() { return "next"; }
  },
  StoryEvents: { async emit() {} },
  SaveManager: { setProgress() {}, completeStory() {} },
  PicoBreakManager: {}, EffectManager: {}, CharacterManager: {}, MonsterManager: {},
  AudioManager: {}, VideoManager: {}, MonsterBattleManager: {}, CampManager: {}, MorningManager: {}
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/word-dictionaries.js");
load("data/questions.js");
load("engine/core/story-engine.js");

(async () => {
  const story = { id: "SUPPORT_TEST", steps: [{
    type: "question",
    questionId: "phrase.yes_can_hear_you",
    saveAs: "answer",
    supportMessages: [
      "『はい』は英語で何と言うかな？短い一言で大丈夫ピコ！",
      "最初の音は『イ』だよ。ゆっくり英語で答えてみよう！",
      "『Yes.』と言ってください。"
    ]
  }] };
  const state = await context.StoryEngine.play(story, {});
  assert.strictEqual(state.answer.status, "success");
  assert.strictEqual(attempts, 4);
  assert.deepStrictEqual(messages.map(item => item[1]), [
    "『はい』は英語で何と言うかな？短い一言で大丈夫ピコ！",
    "最初の音は『イ』だよ。ゆっくり英語で答えてみよう！",
    "『Yes.』と言ってください。"
  ]);
  assert(messages.every(item => item[0] === "ピコ"));
  console.log("S002 Yes three-stage support test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
