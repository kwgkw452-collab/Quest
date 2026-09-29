"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = {
  console,
  setTimeout,
  clearTimeout,
  Promise,
  Object,
  Array,
  Number,
  String,
  isFinite
};
context.window = context;
[
  "GameCore", "EffectManager", "CharacterManager", "MonsterManager", "DialogManager",
  "AudioManager", "VideoManager", "SaveManager", "PicoBreakManager", "QuestionManager", "MorningManager", "StoryEvents"
].forEach((name) => { context[name] = {}; });

vm.createContext(context);
[
  "engine/commands/story-commands.js",
  "engine/core/story-engine.js",
  "engine/core/story-compiler.js",
  "engine/core/story-registry.js",
  "engine/stories/S001.js"
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
});

const story = context.StoryRegistry.get("S001");
assert(story, "S001 must remain registered");
assert.strictEqual(story.id, "S001");
assert.strictEqual(context.StoryEngine.validate(story).length, 0, "S001 must pass engine validation");
assert.strictEqual(story.nextStoryId, "m001", "S001 must continue to the first Monster Story");
assert.strictEqual(story.steps.filter((step) => step.type === "question").length, 3,
  "S001 must use three formal Question commands");
assert(!story.steps.some((step) => step.type === "speech"), "S001 must not duplicate Question speech data");
assert(!story.steps.some((step) => Object.prototype.hasOwnProperty.call(step, "accepted")),
  "S001 must not contain accepted answer arrays");
assert(story.steps.some((step) => step.type === "confirmSpeechName"), "S001 name speech must remain present");
assert.strictEqual(story.steps.filter((step) => step.type === "morning").length, 1,
  "S001 must temporarily run one formal Morning after Camp");
assert(!story.steps.some((step) => step.type === "monsterBattle"), "S001 must not invent a Monster Battle");
assert.strictEqual(story.steps.filter((step) => step.type === "camp").length, 1, "S001 must run one formal Camp");
assert.strictEqual(story.steps.at(-2).type, "camp", "formal Camp must run immediately before Morning");
assert.strictEqual(story.steps.at(-1).type, "morning", "temporary Morning must be the final S001 step");
console.log("S001 smoke test: PASS");
