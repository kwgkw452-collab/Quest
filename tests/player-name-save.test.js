"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
let savedName = "";
const context = {
  console, window: {}, GameConfig: {}, StoryEvents: null,
  GameCore: { async speechMission() { return "Hiro"; } },
  DialogManager: {
    show() {}, async choice() { return "yes"; }, async textInput() { return "Hiro"; }
  },
  SaveManager: { setPlayerName(name) { savedName = name; } },
  EffectManager: {}, CharacterManager: {}, MonsterManager: {}, AudioManager: {}, VideoManager: {},
  PicoBreakManager: {}, MonsterBattleManager: {}, QuestionManager: {}, CampManager: {}, MorningManager: {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/core/story-engine.js"), "utf8"), context);

(async () => {
  const state = {};
  await context.StoryEngine.runStep({ type: "confirmSpeechName", message: "name", saveAs: "playerName" }, state, 0, { id: "TEST" });
  assert.strictEqual(state.playerName, "Hiro");
  assert.strictEqual(savedName, "Hiro");
  console.log("Player name SaveManager test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
