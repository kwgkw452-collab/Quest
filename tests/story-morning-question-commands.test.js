"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
let attempts = 0;
const context = {
  console, window: {}, GameConfig: {}, StoryEvents: null,
  GameCore: {}, EffectManager: { async playTravelTransition(src) { context.travelDestination = src; } }, CharacterManager: {}, MonsterManager: {}, DialogManager: {},
  AudioManager: {}, VideoManager: {}, SaveManager: {}, PicoBreakManager: {}, MonsterBattleManager: {}, CampManager: {},
  QuestionManager: { async start(id) { attempts += 1; return { questionId: id, status: attempts < 2 ? "failure" : "success" }; } },
  MorningManager: { async start(id) { return { morningId: id, status: "completed" }; } }
};
context.window = context;
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
load("engine/commands/story-commands.js");
load("engine/core/story-engine.js");
load("engine/core/story-compiler.js");

(async () => {
  const question = context.StoryCommands.question("word.hello", "greeting");
  const morning = context.StoryCommands.morning("MORNING_001", "morningResult");
  const travel = context.StoryCommands.travelTransition("futureCity");
  const state = {};
  await context.StoryEngine.runStep(question, state, 0, { id: "TEST" });
  await context.StoryEngine.runStep(morning, state, 1, { id: "TEST" });
  await context.StoryEngine.runStep(travel, state, 2, { id: "TEST" });
  assert.strictEqual(attempts, 2, "Story Question must retry without changing QuestionManager contract");
  assert.strictEqual(state.greeting.status, "success");
  assert.strictEqual(state.morningResult.status, "completed");
  assert.strictEqual(context.travelDestination, "futureCity");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.StoryCompiler.commandFromText("QUESTION word.hello"))), { type: "question", questionId: "word.hello" });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.StoryCompiler.commandFromText("MORNING MORNING_001"))), { type: "morning", morningId: "MORNING_001" });
  console.log("Story Morning/Question commands test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
