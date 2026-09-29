"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const shown = [];
let hidden = 0;
const context = {
  console,
  window: {},
  Math,
  SaveManager: { getCompanionIds: () => [1, 2, 3] },
  CharacterManager: {
    show(items) { shown.push(items); },
    addFloatingText() {},
    clear() {}
  },
  DialogManager: {
    show() {},
    async next(label) { assert.strictEqual(label, "休む"); },
    hide() { hidden += 1; }
  },
  EffectManager: { setFilter() {}, setBackground() {}, async play() {} },
  AudioManager: { playSe() {} },
  GameConfig: { dialogueNextLabel: "次へ" }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/poses.js");
load("data/characters.js");
load("data/camps.js");
load("engine/managers/camp-manager.js");

(async () => {
  const result = await context.CampManager.start("CAMP_S002");
  assert.strictEqual(result.status, "completed");
  assert.strictEqual(result.completedSteps, 6);
  assert(hidden >= 2, "Camp dialogue must be cleaned up at completion");
  const ids = shown.flat().map(item => item.character);
  assert(ids.includes("pico"));
  assert(ids.includes("kong"));
  assert(!ids.includes("saki"), "Saki remains indoors under the locked Camp rule");
  console.log("S002 Camp completion test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
