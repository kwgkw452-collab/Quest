"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
const math = Object.create(Math);
math.random = () => 0;
let companionIds = [];
const context = {
  console, window: {}, Math: math,
  GameConfig: { dialogueNextLabel: "次へ" },
  SaveManager: { getCompanionIds: () => companionIds.slice() },
  CharacterManager: {
    clear() { calls.push(["clear"]); },
    show(items) { calls.push(["show", items]); },
    addFloatingText(text, className) { calls.push(["floating", text, className]); }
  },
  EffectManager: {
    setBackground(src) { calls.push(["background", src]); },
    setFilter(visible) { calls.push(["filter", visible]); },
    async play() {}
  },
  DialogManager: { show() {}, async next() {}, hide() {} },
  AudioManager: { playSe() {} },
  MonsterBattleData: { getHint() { return "hint"; } },
  MonsterDatabase: { get() { return {}; } }
};
context.window = context;
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
load("data/poses.js");
load("data/characters.js");
load("data/camps.js");
load("engine/managers/camp-manager.js");

const pico = context.CharacterDatabase.get(1);
const kong = context.CharacterDatabase.get(2);
assert.strictEqual(pico.key, "pico");
assert.strictEqual(kong.key, "kong");
assert.deepStrictEqual([pico.id, kong.id], [1, 2]);
assert.strictEqual(new Set(context.CharacterDatabase.all().filter(item => item.id !== null).map(item => item.id)).size, 4);
assert.strictEqual(context.CharacterDatabase.poses.inactive, "08");
assert(pico.traits.includes("does-not-sleep"));

Object.assign(context.CharacterDatabase.characters, {
  test3: { id: 3, key: "test3", name: "3", gender: "male", type: "human", traits: [] },
  test4: { id: 4, key: "test4", name: "4", gender: "male", type: "human", traits: [] },
  test5: { id: 5, key: "test5", name: "5", gender: "female", type: "human", traits: [] },
  test6: { id: 6, key: "test6", name: "6", gender: "male", type: "other", traits: [] },
  notInParty: { id: 7, key: "notInParty", name: "7", gender: "male", type: "human", traits: [] }
});

(async () => {
  companionIds = [1, 2];
  calls.length = 0;
  const normal = await context.CampManager.start("CAMP_001");
  const shown = calls.find(call => call[0] === "show")[1];
  assert.strictEqual(normal.status, "completed");
  assert.strictEqual(shown.length, 2, "fixed random value must choose the minimum of two");
  assert.strictEqual(new Set(shown.map(item => item.id)).size, shown.length, "selection must not duplicate characters");
  const shownPico = shown.find(item => item.character === "pico");
  assert(shownPico, "does-not-sleep companions must remain eligible for Camp selection");
  assert.strictEqual(shownPico.pose, pico.defaultPose,
    "does-not-sleep companions must use their existing awake default pose");
  assert(shown.filter(item => item.character !== "pico").every(item => item.pose === "inactive"),
    "sleeping companions must keep the inactive pose");
  assert(!shown.some(item => item.character === "test5"), "female companion is reserved for tent handling");
  assert(!shown.some(item => item.character === "notInParty"), "non-companions must not be candidates");
  assert(!shown.some(item => item.character === "bernie"), "Bernie must not appear before companion ID 4 is added");
  assert.strictEqual(calls.filter(call => call[0] === "floating").length,
    shown.filter(item => item.character !== "pico").length, "non-sleeping traits must suppress Zzz");

  companionIds = [1, 2, 2, 3, 4, 5, 6];
  math.random = () => 0.999;
  calls.length = 0;
  await context.CampManager.start("CAMP_001");
  const joinedPartyShown = calls.find(call => call[0] === "show")[1];
  assert.strictEqual(joinedPartyShown.length, 3,
    "fixed high random value must choose the maximum of three");

  companionIds = [4];
  calls.length = 0;
  await context.CampManager.start("CAMP_001");
  assert(calls.find(call => call[0] === "show")[1].some(item => item.character === "bernie"),
    "Character ID 4 must become eligible after joining the Party");

  companionIds = [2];
  calls.length = 0;
  await context.CampManager.start("CAMP_001");
  assert.strictEqual(calls.find(call => call[0] === "show")[1].length, 1,
    "selection must not exceed the number of available companions");

  companionIds = [];
  calls.length = 0;
  const empty = await context.CampManager.start("CAMP_001");
  assert.strictEqual(empty.status, "completed");
  assert.strictEqual(calls.find(call => call[0] === "show")[1].length, 0);

  const managerSource = fs.readFileSync(path.join(root, "engine/managers/camp-manager.js"), "utf8");
  assert(!/character\.id\s*===\s*[12]/.test(managerSource));
  assert(!/character\.name\s*===/.test(managerSource));
  assert(!/character\.key\s*===/.test(managerSource));
  assert(!managerSource.includes("CAMP_001"));
  assert(!managerSource.includes("CAMP_M001"));
  assert(!/character\.id\s*===\s*4/.test(managerSource));
  const mainSource = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
  assert(mainSource.includes("SaveManager.getCompanionIds().forEach"),
    "a new S001 run must discard the previous run's Party state");
  assert(mainSource.includes("SaveManager.removeCompanion(characterId)"));
  assert(!/removeCompanion\(4\)/.test(mainSource), "startup reset must not special-case Bernie");
  assert(!fs.readFileSync(path.join(root, "data/characters.js"), "utf8").includes("sleepType"));

  console.log("Camp Character Data test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
