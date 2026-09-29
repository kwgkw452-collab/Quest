"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const states = [];
const effects = [];
const waits = [];
const answers = ["apple", "banana", "orange"];
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
    show: () => {},
    showRecognized: () => {},
    next: async () => {}
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

[
  "data/word-dictionaries.js",
  "data/questions.js",
  "data/monsters.js",
  "engine/services/asset-resolver.js",
  "engine/services/monster-battle-data.js",
  "engine/managers/monster-battle-manager.js"
].forEach(load);

(async () => {
  const result = await context.MonsterBattleManager.start("m001");
  assert.strictEqual(result.cleared, true);
  assert.deepStrictEqual(Array.from(result.acceptedAnswers), ["apple", "banana", "orange"]);
  assert.deepStrictEqual(states, [
    "normal",
    "damage", "damage",
    "damage", "damage",
    "damage", "explosion", "fruits"
  ]);
  assert.strictEqual(states.at(-1), "fruits", "fruits must remain the final battle graphic");
  assert.deepStrictEqual(effects, ["shake", "flash", "flash", "flash"]);
  assert.deepStrictEqual(waits.filter(ms => ms !== 1600), [3000, 650, 650, 650, 1000]);

  const monster = context.MonsterDatabase.get("m001");
  ["normal", "damage", "explosion", "fruits"].forEach(state => {
    const asset = context.AssetResolver.monster("m001", state);
    assert.strictEqual(asset, monster.image[state]);
    const file = path.join(root, asset.split("?")[0]);
    assert(fs.existsSync(file), `missing m001 asset: ${asset}`);
    const bytes = fs.readFileSync(file);
    assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    const expectedSize = 627;
    assert.strictEqual(bytes.readUInt32BE(16), expectedSize);
    assert.strictEqual(bytes.readUInt32BE(20), expectedSize);
    assert.strictEqual(bytes[25], 6, `${state} must be an RGBA PNG`);
  });

  const managerSource = fs.readFileSync(path.join(root, "engine/managers/monster-battle-manager.js"), "utf8");
  assert(!/m001|fruit[_ -]?monster|フルーツモンスター/i.test(managerSource));
  const storySource = fs.readFileSync(path.join(root, "engine/stories/m001.js"), "utf8");
  assert(storySource.indexOf('C.monsterBattle("m001"') < storySource.indexOf('C.camp("CAMP_M001"'));
  assert(storySource.includes('C.dialogue("ピコ", "Great! So much delicious fruit!"'));

  console.log("m001 four-graphic flow test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
