"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function classList() {
  const values = new Set();
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value)
  };
}

const scene = { classList: classList() };
const timers = [];
const context = { window: { setTimeout: callback => { timers.push(callback); callback(); } }, AssetResolver: null, AssetManager: null };
context.window.window = context.window;
context.window.AssetResolver = null;
context.window.AssetManager = null;
vm.createContext(context.window);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../engine/managers/effect-manager.js"), "utf8"),
  context.window
);

context.window.EffectManager.init({
  scene,
  background: { style: {}, classList: classList() },
  blueFilter: { hidden: true }
});

assert.strictEqual(context.window.EffectManager.setBattleDamage(1), 1);
assert(scene.classList.contains("battle-damage-1"));
context.window.EffectManager.setBattleDamage(2);
assert(!scene.classList.contains("battle-damage-1"));
assert(scene.classList.contains("battle-damage-2"));
context.window.EffectManager.setBattleDamage(3);
assert(scene.classList.contains("battle-damage-3"));
context.window.EffectManager.setBattleDamage(0);
assert(!scene.classList.contains("battle-damage-1"));
assert(!scene.classList.contains("battle-damage-2"));
assert(!scene.classList.contains("battle-damage-3"));

(async () => {
  let defeatedShown = false;
  await context.window.EffectManager.playBattleDefeatTransition(() => { defeatedShown = true; });
  assert.strictEqual(defeatedShown, true);
  assert(!scene.classList.contains("battle-explosion"));
  assert(!scene.classList.contains("battle-blackout"));
  assert(!scene.classList.contains("battle-fruit-reveal"));
})().catch(error => { console.error(error); process.exitCode = 1; });

const css = fs.readFileSync(path.resolve(__dirname, "../css/style.css"), "utf8");
assert(css.includes(".scene.battle-damage-1 .background"));
assert(css.includes(".scene.battle-damage-2 .background"));
assert(css.includes(".scene.battle-damage-3 .background"));
assert(css.includes("@keyframes battleExplosion"));
assert(css.includes("@keyframes battleFruitReveal"));
assert(css.includes("bottom: 14%"), "Camp companions must be placed lower than the previous 19% position");

(async () => {
  await context.window.EffectManager.playPseudoCampTransition();
  assert(!scene.classList.contains("pseudo-camp-dark"));
  assert(!scene.classList.contains("pseudo-camp-transition"));
  assert(css.includes("transition: opacity 3s ease-in-out"));
})().catch(error => { console.error(error); process.exitCode = 1; });

console.log("m001 damage effect test: PASS");
