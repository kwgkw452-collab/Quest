const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = { images: [], dialogues: [], questions: [] };
const context = {
  console,
  window: {},
  MonsterBattlePresenter: {
    showMonster(monster, state) {
      calls.images.push([monster.monsterId, state, monster.image[state]]);
    }
  },
  QuestionManager: {
    async start(questionId) {
      calls.questions.push(questionId);
      return { status: "cancelled" };
    },
    cancel() {}
  },
  DialogManager: {
    show(speaker, text) { calls.dialogues.push([speaker, text]); },
    showRecognized() {},
    async next() {}
  },
  EffectManager: {
    async play() {},
    async wait() {},
    setBattleDamage() {}
  },
  AudioManager: { playSe() {} },
  SaveManager: { recordMonsterEncounter() {}, recordMonsterDefeat() {} },
  CampManager: { async start() { return { status: "completed" }; }, cancel() {} }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/word-dictionaries.js");
load("data/questions.js");
load("data/monsters.js");
load("engine/services/monster-battle-data.js");
load("engine/managers/monster-battle-manager.js");

(async () => {
  const result = await context.MonsterBattleManager.start("m003");
  assert.deepStrictEqual(calls.images[0], ["m003", "normal", "images/monsters/season_tree_03.png"]);
  assert(calls.dialogues.some(([, text]) => text.includes("あの木を見て！")));
  assert(calls.dialogues.some(([, text]) => text.includes("季節の英語を4つ言って助けてあげよう！")));
  assert.deepStrictEqual(calls.questions, ["word.season"]);
  assert.strictEqual(context.QuestionDatabase.get("word.season").prompt,
    "知っている季節の英語を1つ言ってみよう！");
  assert.strictEqual(result.monsterId, "m003");
  assert.strictEqual(result.aborted, true);
  console.log("m003 start smoke test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
