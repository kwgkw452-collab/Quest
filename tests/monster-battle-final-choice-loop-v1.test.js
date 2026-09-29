"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

async function run(monsterId) {
  const calls = { starts: 0, supports: [], choices: [], damage: [] };
  const actions = ["retry", "retry", "retry", "adventure_return"];
  const context = {
    console, window: {},
    AudioDatabase: { se: {} },
    QuestionManager: {
      async start() {
        calls.starts += 1;
        return { status: "failure", answer: "wrong" };
      },
      cancel() {}
    },
    EffectManager: {
      async play() {}, async wait() {}, setBattleDamage(value) { calls.damage.push(value); },
      setBackground() {}
    },
    DialogManager: {
      show(_speaker, message) { calls.supports.push(message); },
      showRecognized() {}, async next() {}, hide() {},
      async choice() { throw new Error("FiniteRescue must own the final choice"); }
    },
    FiniteRescue: {
      isImmediateTechnicalFailure() { return false; },
      async choose(allowRetry) {
        calls.choices.push(allowRetry);
        return actions.shift();
      },
      consume() { return null; }
    },
    AudioManager: { playSe() {} },
    SaveManager: { recordMonsterEncounter() {}, recordMonsterDefeat() {} },
    MonsterBattlePresenter: { showMonster() {} },
    PicoBreakManager: { async showSelected() { return false; } }
  };
  context.window = context;
  vm.createContext(context);
  [
    "data/word-dictionaries.js", "data/questions.js", "data/monsters.js", "data/m004.js",
    "engine/services/monster-battle-data.js", "engine/managers/monster-battle-manager.js"
  ].forEach(file => vm.runInContext(read(file), context, { filename: file }));
  const result = await context.MonsterBattleManager.start(monsterId);
  return { result: Object.assign({}, result), calls };
}

(async () => {
  for (const monsterId of ["m001", "m002", "m003", "m004"]) {
    const runResult = await run(monsterId);
    assert.strictEqual(runResult.calls.starts, 7, monsterId + " must restart Speech after every selected retry");
    assert.strictEqual(runResult.calls.supports.length >= 3, true, monsterId + " must preserve Support 1-3");
    assert.deepStrictEqual(runResult.calls.choices, [true, true, true, true],
      monsterId + " must keep both final choices available without a retry limit");
    assert.strictEqual(runResult.result.cleared, false);
    assert.strictEqual(runResult.result.aborted, true);
    assert.strictEqual(runResult.result.controlResult, "adventure_return");
  }
  const source = read("engine/managers/monster-battle-manager.js");
  assert(!source.includes("var allowRetry = !context.rescueRetryUsed"));
  assert(source.includes("FiniteRescue.choose(true)"));
  assert(source.includes('if (action !== "adventure_return") continue'));
  console.log("Monster Battle Final Choice Loop V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
