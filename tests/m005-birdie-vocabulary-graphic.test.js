const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");

const answers = ["birdy", "bird", "chiken", "duck"];
const shown = [], hints = [], saved = [];
const c = {
  console, window: {},
  AudioDatabase: { se: { battleHit: "hit.mp3", monsterWarning: "warning.mp3" } },
  QuestionManager: { start: async () => ({ status: "success", answer: answers.shift() }) },
  EffectManager: {
    play: async () => {}, wait: async () => {}, setBattleDamage: () => {}, setBackground: () => {}
  },
  DialogManager: {
    show: (speaker, message) => hints.push(String(message)),
    showRecognized: () => {}, next: async () => {}, choice: async () => "adventure_return"
  },
  FiniteRescue: { consume: () => null, choose: async () => "adventure_return" },
  AudioManager: { playSe: () => {} },
  SaveManager: {
    recordMonsterEncounter: id => saved.push("encounter:" + id),
    recordMonsterDefeat: id => saved.push("defeat:" + id)
  },
  MonsterBattlePresenter: { showMonster: (monster, state) => shown.push(state) }
};
c.window = c;
vm.createContext(c);
function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), c, { filename: file });
}
load("data/word-dictionaries.js");
load("data/questions.js");
load("data/monsters.js");
load("data/m005.js");
load("engine/services/monster-battle-data.js");
load("engine/managers/monster-battle-manager.js");

(async () => {
  const db = c.WordDictionaryDatabase;
  for (const [speech, expected] of [
    ["birdy", "bird"], ["bird", "bird"], ["chiken", "chicken"],
    ["swallow", "swallow"], ["sparrow", "sparrow"], ["hawk", "hawk"],
    ["crow", "crow"], ["duck", "duck"]
  ]) assert.strictEqual(db.match("bird-names.v1", speech), expected, speech);
  assert.strictEqual(db.get("bird-names.v1").entries.length, 15);

  const result = await c.MonsterBattleManager.start("m005");
  assert.strictEqual(result.cleared, true);
  assert.strictEqual(result.requiredHits, 3);
  assert.strictEqual(result.hitCount, 3);
  assert.deepStrictEqual(Array.from(result.acceptedAnswers), ["bird", "chicken", "duck"]);
  assert.deepStrictEqual(shown, ["normal", "reaction", "stage2", "defeated"]);
  assert(hints.some(message => message.includes("もう聞いた")), "birdy + bird must count as one bird");
  assert.deepStrictEqual(saved, ["encounter:m005", "defeat:m005"]);
  console.log("Birdie vocabulary and four visual states: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
