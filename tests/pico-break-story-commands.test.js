"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
let enabled = true;
const context = {
  console,
  Promise,
  Object,
  Array,
  Number,
  String,
  isFinite,
  GameConfig: {},
  StoryEvents: null,
  GameCore: {},
  EffectManager: {},
  CharacterManager: {},
  MonsterManager: {},
  DialogManager: {},
  AudioManager: {},
  VideoManager: {},
  SaveManager: {},
  PicoBreakManager: {
    evaluate(options) { calls.push(["evaluate", options]); return Promise.resolve(false); },
    force(id, options) { calls.push(["force", id, options]); return Promise.resolve(true); },
    forced(id, options) { calls.push(["forced", id, options]); return Promise.resolve(true); },
    beginApiWait(options) { calls.push(["beginApiWait", options]); return 77; },
    during(task, options) { calls.push(["during", options]); return Promise.resolve().then(task); },
    setEnabled(value) { enabled = value; calls.push(["setEnabled", value]); },
    maybeInterval() { return Promise.resolve(false); },
    maybeRandom() { return Promise.resolve(false); },
    showSelected() { return Promise.resolve(false); }
  }
};
context.window = context;
vm.createContext(context);

[
  "engine/commands/story-commands.js",
  "engine/core/story-engine.js",
  "engine/core/story-compiler.js"
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }));

const sourceSteps = [
  "PICO_BREAK",
  "PICO_BREAK_FORCE PB-FORESHADOW-001",
  "PICO_BREAK_WAIT",
  "PICO_BREAK_OFF",
  "PICO_BREAK_ON"
];
const story = context.StoryCompiler.compile({ id: "S020", steps: sourceSteps });
assert.deepStrictEqual(Array.from(story.steps, (step) => step.type), [
  "picoBreak", "picoBreakForce", "picoBreakWait", "picoBreakOff", "picoBreakOn"
]);
assert.strictEqual(context.StoryEngine.validate(story).length, 0);

(async function run() {
  const state = {};
  for (let i = 0; i < story.steps.length; i += 1) {
    await context.StoryEngine.runStep(story.steps[i], state, i, story);
  }
  assert(calls.some((call) => call[0] === "evaluate" && call[1].storyId === "S020"));
  assert(calls.some((call) => call[0] === "force" && call[1] === "PB-FORESHADOW-001"));
  assert(calls.some((call) => call[0] === "beginApiWait"));
  assert.strictEqual(state.picoBreakWaitToken, 77);
  assert.strictEqual(enabled, true, "OFF then ON must resume Pico Break");

  const taskStep = context.StoryCommands.picoBreakWait(() => "API_OK", { thresholdMs: 1200, saveAs: "apiResult" });
  await context.StoryEngine.runStep(taskStep, state, 6, story);
  assert.strictEqual(state.apiResult, "API_OK");
  console.log("Pico Break Story commands test: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
