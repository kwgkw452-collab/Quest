const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const states = [];
const effects = [];
const waits = [];
const messages = [];
const nextLabels = [];
const answers = ["one", "1", "two", "8"];
const context = {
  console,
  window: {},
  QuestionManager: {
    start: async () => ({ status: "success", answer: answers.shift() }),
    cancel: () => ({ status: "cancelled" })
  },
  EffectManager: {
    play: async key => effects.push(key),
    wait: async ms => waits.push(ms),
    setBattleDamage: () => {}
  },
  DialogManager: {
    show: (speaker, text) => messages.push([speaker, text]),
    showRecognized: () => {},
    next: async label => nextLabels.push(label)
  },
  AudioManager: { playSe: () => {} },
  SaveManager: { recordMonsterEncounter: () => {}, recordMonsterDefeat: () => {} },
  CampManager: { cancel: () => {} },
  MonsterBattlePresenter: { showMonster: (monster, state) => states.push(state) }
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
  const result = await context.MonsterBattleManager.start("m002");
  assert.strictEqual(result.cleared, true);
  assert.deepStrictEqual(Array.from(result.acceptedAnswers), ["one", "two", "eight"]);
  assert.deepStrictEqual(states, [
    "normal",
    "reaction", "normal",
    "reaction", "normal",
    "reaction", "purify", "smile"
  ]);
  assert.deepStrictEqual(effects, ["shake", "number-monster-hit", "number-monster-hit", "number-monster-hit"]);
  assert.deepStrictEqual(waits.filter(ms => ms !== 1600), [3000, 650, 650, 650, 1000]);
  assert.strictEqual(messages.filter(item => item[1].includes("同じ数字")).length, 1);
  assert.strictEqual(messages.filter(item => item[1].includes("数字が大好き")).length, 1);
  assert.deepStrictEqual(messages.at(-1), [
    "",
    "数字をたくさん聞いて満足したナンバー・モンスターは、うれしそうに消えていった。"
  ]);
  assert.strictEqual(nextLabels.at(-1), "次へ");

  const imageNames = ["normal", "attack", "reaction", "purify", "smile"];
  const monster = context.MonsterDatabase.get("m002");
  imageNames.forEach(state => {
    const file = path.join(root, monster.image[state].split("?")[0]);
    const bytes = fs.readFileSync(file);
    assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    assert(bytes.readUInt32BE(16) <= 535);
    assert(bytes.readUInt32BE(20) <= 490);
    assert.strictEqual(bytes[25], 6, `${state} must be an RGBA PNG`);
  });

  console.log("m002 Graphic Flow test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
