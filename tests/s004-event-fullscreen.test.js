"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const itemLayer = { children: [], set innerHTML(value) { if (value === "") this.children = []; }, appendChild(item) { this.children.push(item); } };
const background = { style: { backgroundImage: 'url("images/004/s004_background.png")' } };
const elements = { "item-layer": itemLayer, background };
const context = {
  console, window: {}, document: {
    getElementById(id) { return elements[id] || {}; },
    createElement() { return { className: "", src: "", alt: "" }; }
  },
  AssetResolver: { item(key) { return key === "s004MealEvent" ? "images/004/s004_meal_event.png" : key; } },
  DialogManager: { init() {} }, CharacterManager: { init() {}, clear() {}, show() {}, get() {}, addFloatingText() {} },
  MonsterManager: { init() {}, show() {}, changeState() {}, clear() {} }, EffectManager: { init() {}, wait() {} },
  VideoManager: { init() {}, play() {}, clear() {} }, PicoBreakManager: { init() {}, showSelected() {}, evaluate() {}, force() {}, during() {} },
  AudioManager: { playBgm() {}, stopBgm() {}, playSe() {}, playVoice() {} }, SpeechEngine: { mission() {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/core/core.js"), "utf8"), context, { filename: "engine/core/core.js" });
context.GameCore.cache();

const image = context.GameCore.showItem("s004MealEvent", "event-fullscreen");
assert.strictEqual(background.style.backgroundImage, "none", "the cooking background must be cleared for the meal event");
assert.strictEqual(itemLayer.children.length, 1, "only the meal event image may remain in the item layer");
assert.strictEqual(image.src, "images/004/s004_meal_event.png");
assert.strictEqual(image.className, "event-fullscreen");

const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
assert(/\.event-fullscreen\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/s.test(css));
console.log("S004 event fullscreen test: PASS");
