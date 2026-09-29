"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
const context = {
  console, window: {}, GameConfig: { dialogueNextLabel: "つぎへ", defaultLanguage: "en-US" },
  GameCore: {
    clearVisuals() {}, showItem() {},
    async speechMission(config) {
      if (config.retryOnMismatch === false) return { matched: true, answer: config.accepted[0] };
      return "Hiro";
    },
    async choice() { return "yes"; }
  },
  EffectManager: {
    setBackground() {}, async backgroundSequence() {}, async playTravelTransition() {}, async wait() {}, async play() {}, setFilter() {}
  },
  CharacterManager: { show() {}, changeImage() {}, addFloatingText() {}, clear() {} },
  MonsterManager: { show() {}, changeState() {}, clear() {} },
  DialogManager: {
    show() {}, async next() {}, hide() {}, async choice() { return "yes"; }, async textInput() { return "Hiro"; }
  },
  AudioManager: { playBgm() {}, stopBgm() {}, playSe() {}, playVoice() {} },
  VideoManager: { async play() {}, clear() {} },
  SaveManager: {
    companionIds: [],
    savedName: "", save() {}, setFlag() {}, addItem() {}, removeItem() {},
    recordMonsterEncounter() {}, recordMonsterDefeat() {},
    setPlayerName(name) { this.savedName = name; },
    addCompanion(id) { if (!this.companionIds.includes(id)) this.companionIds.push(id); },
    removeCompanion(id) { this.companionIds = this.companionIds.filter(value => value !== id); },
    getCompanionIds() { return this.companionIds.slice(); },
    getData() { return {}; }
  },
  PicoBreakManager: {
    async evaluate() { return false; }, async force() { return false; },
    async maybeInterval() { return false; }, async maybeRandom() { return false; },
    async during(task) { return typeof task === "function" ? task() : task; },
    beginApiWait() { return null; }, setEnabled() {}
  },
  MorningManager: { async start(id) { calls.push("morning:start"); return { morningId: id, status: "completed" }; } },
  MonsterBattleManager: { async start(id) { calls.push("monster:start"); return { monsterId: id, status: "completed", cleared: true }; } },
  CommunicativeQuestionFlowController: {
    async start(id) { return context.QuestionManager.start(id); }
  },
  StoryEvents: { async emit(name) { calls.push(name); } }
};
context.window = context;
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
[
  "engine/services/speech-normalizer.js", "engine/commands/story-commands.js", "engine/core/story-compiler.js", "engine/core/story-registry.js",
  "engine/core/story-engine.js", "engine/core/event-system.js", "data/word-dictionaries.js", "data/questions.js", "engine/managers/question-manager.js",
  "data/poses.js", "data/characters.js", "data/camps.js", "engine/managers/camp-manager.js", "engine/core/scene-manager.js",
  "engine/stories/S001.js", "engine/stories/m001.js", "engine/stories/S002.js", "engine/stories/S003.js", "engine/stories/S004.js",
  "engine/stories/story-saki-departure.js"
].forEach(load);
context.StoryRegistry.register({ id: "m004", title: "m004 route sentinel", steps: [] });

let campStarts = 0;
const startCamp = context.CampManager.start;
context.CampManager.start = async id => { campStarts += 1; return startCamp(id); };

(async () => {
  const result = await context.SceneManager.start("S001", { playerName: "OpeningName" });
  assert.strictEqual(campStarts, 4);
  assert.strictEqual(result.storyId, "m004");
  assert.strictEqual(result.playerName, "Hiro");
  assert.strictEqual(context.SaveManager.savedName, "Hiro");
  assert.strictEqual(result.lastQuestion.status, "success");
  assert.strictEqual(result.lastCamp.status, "completed");
  assert.strictEqual(result.lastMorning.status, "completed");
  assert.strictEqual(result.fruitBattle.cleared, true);
  assert.strictEqual(result.numberBattle.cleared, true);
  assert.strictEqual(result.seasonTreeBattle.cleared, true);
  assert.strictEqual(result.s003Camp.status, "completed");
  assert.strictEqual(calls.filter(name => name === "monster:start").length, 3);
  assert.strictEqual(calls.filter(name => name === "morning:start").length, 3);
  assert.strictEqual(context.SceneManager.getCurrentStoryId(), "m004");
  assert.strictEqual(calls.filter(name => name === "story:complete").length, 7);
  assert.deepStrictEqual(context.SaveManager.getCompanionIds(), [1, 2, 4]);
  console.log("S001 full-flow test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
