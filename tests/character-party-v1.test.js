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

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/poses.js");
load("data/characters.js");
load("engine/managers/save-manager.js");

const database = context.CharacterDatabase;
const pico = database.get(1);
const kong = database.get(2);
const saki = database.get(3);
const bernie = database.get(4);
const assigned = database.all().filter(character => character.id !== null);
const assignedIds = assigned.map(character => character.id);

assert.strictEqual(pico.key, "pico");
assert.strictEqual(pico.name, "ピコ");
assert.strictEqual(pico.gender, "other");
assert.strictEqual(pico.type, "robot");
assert.deepStrictEqual(Array.from(pico.traits), ["does-not-sleep"]);
assert.strictEqual(kong.key, "kong");
assert.strictEqual(kong.name, "コング");
assert.strictEqual(kong.gender, "male");
assert.strictEqual(kong.type, "human");
assert.deepStrictEqual(Array.from(kong.traits), []);
assert.strictEqual(saki.key, "saki");
assert.strictEqual(saki.name, "サキ");
assert.strictEqual(saki.gender, "female");
assert.strictEqual(saki.type, "human");
assert.strictEqual(saki.folder, "images/characters/income");
assert.strictEqual(bernie.key, "bernie");
assert.strictEqual(bernie.folder, "images/characters/bernie");
assert.strictEqual(bernie.filePrefix, "bernie_");
assert.deepStrictEqual(Array.from(assignedIds), [1, 2, 3, 4]);
assert.strictEqual(new Set(assignedIds).size, assignedIds.length, "Character IDs must be unique");
assert.strictEqual(database.poses.inactive, "08");
assert(database.all().every(character => Array.isArray(character.availablePoses)));
assert(!fs.readFileSync(path.join(root, "data/characters.js"), "utf8").includes("sleepType"));

context.SaveManager.reset();
context.SaveManager.addCompanion(1);
context.SaveManager.addCompanion(2);
context.SaveManager.addCompanion(2);
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [1, 2], "add must preserve order and reject duplicates");

context.SaveManager.removeCompanion(2);
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [1]);
assert.strictEqual(database.get(2), kong, "leaving must not remove Character Data");

context.SaveManager.save();
context.SaveManager.load();
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [1], "leaving state must be saved");
assert.strictEqual(database.get(2).id, 2, "long absence must not change Character ID");

context.SaveManager.addCompanion(2);
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [1, 2]);
assert.strictEqual(database.get(2), kong, "rejoining must use the original Character ID");

context.SaveManager.removeCompanion(1);
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [2], "a departed Character must be absent from Camp's source IDs");
context.SaveManager.addCompanion(1);
assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [2, 1], "rejoining must restore Camp eligibility and preserve current Party order");

const save = context.SaveManager.getData();
assert.strictEqual(save.player.name, "", "Handle Name is independent of Character ID");
assert(!Object.prototype.hasOwnProperty.call(save.player, "characterId"), "the Player must not receive a Character ID");
assert.deepStrictEqual(Object.keys(save.party), ["companionIds"], "Party stores only current companion state");

const s001 = fs.readFileSync(path.join(root, "engine/stories/S001.js"), "utf8");
assert(s001.includes("C.addCompanion(1)"));
assert(s001.includes("C.addCompanion(2)"));
const s002 = fs.readFileSync(path.join(root, "engine/stories/S002.js"), "utf8");
assert(s002.includes("C.addCompanion(3)"));
assert(!s002.includes("C.addCompanion(4)"));
assert(!fs.existsSync(path.join(root, "stories/S002.md")));

console.log("Character / Party Version 1.0 test: PASS");
