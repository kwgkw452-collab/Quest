"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
const companions = [];
const context = {
  console,
  window: {},
  StoryEvents: { async emit() {} },
  MorningManager: {
    async start(id) { calls.push(["morning", id]); return { status: "completed", morningId: id }; }
  },
  MonsterBattleManager: {
    async start(id) { calls.push(["monsterBattle", id]); return { status: "completed", monsterId: id }; }
  },
  CampManager: {
    async start(id) { calls.push(["camp", id]); return { status: "completed", campId: id, completedSteps: 6 }; }
  },
  AudioManager: {
    playSe(key) { calls.push(["audio", key]); }
  },
  GameConfig: { dialogueNextLabel: "つぎへ" },
  GameCore: {
    clearVisuals() { calls.push(["clear"]); },
    showItem(key) { calls.push(["item", key]); },
    async speechMission(config) { return { matched: true, answer: config.accepted[0] }; }
  },
  EffectManager: {
    setBackground(key) { calls.push(["background", key]); },
    async play() {},
    async wait() {}
  },
  CharacterManager: {
    show(items) { calls.push(["characters", items.map(item => item.character)]); },
    changeImage(id, pose) { calls.push(["characterImage", id, pose]); }
  },
  DialogManager: {
    show(speaker, text) { calls.push(["dialogue", speaker, text]); },
    async next() {},
    async choice() { return "next"; }
  },
  SaveManager: {
    addCompanion(id) { companions.push(id); },
    removeCompanion(id) {
      const index = companions.indexOf(id);
      if (index !== -1) companions.splice(index, 1);
      calls.push(["removeCompanion", id]);
    },
    save() { calls.push(["save"]); },
    getData() { return {}; }
  },
  QuestionManager: {
    async start(id) { calls.push(["question", id]); return { questionId: id, status: "success" }; }
  }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

[
  "engine/services/speech-normalizer.js",
  "engine/commands/story-commands.js",
  "engine/core/story-registry.js",
  "engine/core/story-events.js",
  "engine/core/story-engine.js",
  "engine/core/event-system.js",
  "engine/core/scene-manager.js",
  "engine/stories/S003.js",
  "engine/stories/S004.js",
  "engine/stories/story-saki-departure.js"
].forEach(load);
context.StoryRegistry.register({ id: "m004", title: "m004 route sentinel", steps: [] });

(async () => {
  const state = await context.SceneManager.start("S003", {});
  const morningIndex = calls.findIndex(call => call[0] === "morning" && call[1] === "MORNING_001");
  const battleIndex = calls.findIndex(call => call[0] === "monsterBattle" && call[1] === "m002");
  const campIndex = calls.findIndex(call => call[0] === "camp" && call[1] === "CAMP_M002");
  const s004BackgroundIndex = calls.findIndex(call => call[0] === "background" && call[1] === "s004CookingPlace");
  const bernieIndex = calls.findIndex(call => call[0] === "characters" && call[1].includes("bernie"));

  assert(morningIndex >= 0 && morningIndex < battleIndex);
  assert(battleIndex < campIndex);
  assert(campIndex < s004BackgroundIndex);
  assert(s004BackgroundIndex < bernieIndex);
  assert.strictEqual(state.s003Camp.status, "completed");
  assert.strictEqual(context.SceneManager.getCurrentStoryId(), "m004");
  assert.deepStrictEqual(companions, [4]);
  assert(calls.some(call => call[0] === "removeCompanion" && call[1] === 3));
  assert(calls.some(call => call[0] === "item" && call[1] === "s004FryingPan04"));
  assert(calls.some(call => call[0] === "dialogue" && call[2] === "バーニーが仲間に加わった！"));
  console.log("S003 -> S004 connection test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
