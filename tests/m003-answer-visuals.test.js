"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "..");
const states = [];
const backgrounds = [];
const waits = [];
const answers = ["summer", "summer", "fall", "spring", "autumn", "winter"];
const context = {
  console,
  window: {},
  QuestionManager: {
    start: async () => ({ status: "success", answer: answers.shift() }),
    cancel: () => ({ status: "cancelled" })
  },
  EffectManager: {
    play: async () => {},
    wait: async ms => waits.push(ms),
    setBattleDamage: () => {},
    setBackground: key => backgrounds.push(key)
  },
  DialogManager: { show: () => {}, showRecognized: () => {}, next: async () => {} },
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
  "engine/services/monster-battle-data.js",
  "engine/managers/monster-battle-manager.js"
].forEach(load);

(async () => {
  const monster = context.MonsterDatabase.get("m003");
  assert.deepStrictEqual(Object.assign({}, monster.battle.answerVisuals), {
    spring: "spring", summer: "summer", autumn: "autumn", winter: "winter"
  });
  assert.strictEqual(monster.presentation.background, "forestClearing");
  assert.strictEqual(monster.presentation.className, "monster-giant-tree");

  const result = await context.MonsterBattleManager.start("m003");
  assert.strictEqual(result.cleared, true);
  assert.deepStrictEqual(Array.from(result.acceptedAnswers), ["summer", "autumn", "spring", "winter"]);
  assert.deepStrictEqual(backgrounds, ["forestClearing"]);
  assert.deepStrictEqual(states, ["normal", "summer", "autumn", "spring", "winter", "restored"]);
  assert.strictEqual(states.filter(state => state === "summer").length, 1, "duplicate must not change the image");
  assert.strictEqual(states.filter(state => state === "autumn").length, 1, "fall/autumn duplicate must not change the image");
  assert(waits.includes(2000), "the fourth answer visual must be held for 2000ms before restored state");

  Object.values(monster.image).forEach(asset => {
    assert(fs.existsSync(path.join(root, asset)), "missing m003 asset: " + asset);
  });
  const normalHeight = Number(childProcess.execFileSync("convert", [
    path.join(root, monster.image.normal), "-alpha", "extract", "-threshold", "50%", "-trim", "-format", "%h", "info:"
  ], { encoding: "utf8" }));
  ["spring", "summer", "autumn", "winter"].forEach(state => {
    const asset = path.join(root, monster.image[state]);
    const metadata = childProcess.execFileSync("identify", [
      "-format", "%[channels] %[opaque] %[pixel:p{0,0}]", asset
    ], { encoding: "utf8" });
    assert(metadata.startsWith("srgba false srgba(0,0,0,0)"), state + " must have a transparent background");
    const visibleHeight = Number(childProcess.execFileSync("convert", [
      asset, "-alpha", "extract", "-threshold", "50%", "-trim", "-format", "%h", "info:"
    ], { encoding: "utf8" }));
    assert(visibleHeight >= normalHeight * 0.85 && visibleHeight <= normalHeight * 1.05,
      state + " visible height must stay close to the normal tree");
  });
  assert(fs.existsSync(path.join(root, "images/backgrounds/bg_forest_clearing.png")));

  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  assert(css.includes(".story-character.monster-giant-tree"));
  assert(css.includes("height: 78vh"));

  console.log("m003 answer-linked visuals test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
