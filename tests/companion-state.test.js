"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const storage = new Map();
const context = {
  console, window: {}, GameConfig: { initialStoryId: "S001" }, StoryEvents: null,
  localStorage: {
    setItem(key, value) { storage.set(key, value); },
    getItem(key) { return storage.get(key) || null; },
    removeItem(key) { storage.delete(key); }
  },
  Date, JSON, Number, String, Object, Array, isFinite
};
context.window = context;
context.window.addEventListener = () => {};
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
load("data/poses.js");
load("data/characters.js");
load("engine/managers/save-manager.js");

context.SaveManager.reset();
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), []);
context.SaveManager.addCompanion(1);
context.SaveManager.addCompanion(2);
context.SaveManager.addCompanion(2);
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [1, 2]);
context.SaveManager.removeCompanion(1);
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [2]);
assert.strictEqual(context.SaveManager.getData().player.name, "");
assert.strictEqual(context.CharacterDatabase.get(1).name, "ピコ");
assert.strictEqual(context.CharacterDatabase.get(2).name, "コング");
assert.throws(() => context.SaveManager.addCompanion("pico"), /positive integer/);

console.log("Companion state test: PASS");
