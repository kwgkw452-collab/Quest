const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("engine/core/story-registry.js");
load("engine/commands/story-commands.js");
load("engine/stories/S004.js");

const story = context.StoryRegistry.get("S004");
assert(story, "S004 must be registered");

const battleSteps = story.steps.filter(step => step.type === "monsterBattle");
assert.strictEqual(battleSteps.length, 1, "S004 must connect to exactly one Monster Battle");
assert.strictEqual(battleSteps[0].monsterId, "m003");
assert.strictEqual(battleSteps[0].saveAs, "seasonTreeBattle");

const battleIndex = story.steps.indexOf(battleSteps[0]);
const companionIndex = story.steps.findIndex(step => step.type === "addCompanion" && step.characterId === 4);
const saveIndex = story.steps.findIndex(step => step.type === "save");
assert(companionIndex !== -1 && saveIndex !== -1);
assert(companionIndex < saveIndex && saveIndex < battleIndex,
  "m003 must start only after Bernie joins and the current progress is saved");
assert.notStrictEqual(story.steps[battleIndex - 1].src, "zephyrGo",
  "GO must not announce a Monster reveal or Battle start");
assert.strictEqual(story.steps[battleIndex + 1], undefined,
  "S004 must not replay VICTORY after the Season Tree completion dialogue");

const monsters = fs.readFileSync(path.join(root, "data/monsters.js"), "utf8");
assert(/monsterId: "m003"[\s\S]*?postRecoveryBgm: "zephyrFields"[\s\S]*?postRecoveryBgmVolume: 0\.20/.test(monsters),
  "m003 must own the corrected post-recovery Main Theme");
assert(!/monsterId: "m003"[\s\S]*?victorySe:/.test(monsters),
  "m003 must not play VICTORY before the song-to-song Main Theme transition");

const source = fs.readFileSync(path.join(root, "engine/stories/S004.js"), "utf8");
assert(!source.includes("candidate-007"), "Runtime must not reference the Monster Library key");
assert.strictEqual(story.nextStoryId, "st004",
  "m003 completion must connect to the locked st004 Saki departure Story");

console.log("S004 -> m003 connection test: PASS");
