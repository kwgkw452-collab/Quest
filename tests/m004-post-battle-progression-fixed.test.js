"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const calls = [];
const context = {
  console,
  MonsterBattleManager: { async start() { return { cleared: true, aborted: false }; } },
  CampManager: { async start(id) { calls.push(["camp", id]); return { status: "completed" }; } },
  MorningManager: { async start(id) { calls.push(["morning", id]); return { status: "completed" }; } },
  AudioManager: { stopAll() {}, playBgm() {}, stopBgm() {} },
  GameCore: { clearVisuals() {} },
  CharacterManager: { clear() {}, show() {} },
  MonsterManager: { clear() {}, show() {} },
  DialogManager: { show() {}, async next() {}, async choice() { return "next"; } },
  EffectManager: { setBackground() {}, async wait() {}, async play() {} },
  GameConfig: { dialogueNextLabel: "次へ" },
  DialogueVoiceController: { play() {} },
  StoryEvents: { async emit() {} }
};
context.window = context;
vm.createContext(context);
for (const file of [
  "engine/commands/story-commands.js",
  "engine/core/story-registry.js",
  "engine/core/story-engine.js",
  "engine/stories/story-saki-departure.js",
  "engine/stories/m004.js",
  "engine/stories/S005.js"
]) vm.runInContext(read(file), context, { filename: file });

(async () => {
  const story = context.StoryRegistry.get("m004");
  assert.equal(story.nextStoryId, "S005");
  await context.StoryEngine.play(story, {});
  assert.deepEqual(calls, [["camp", "CAMP_M004"], ["morning", "MORNING_M004"]]);

  const morningContext = { console };
  morningContext.window = morningContext;
  vm.createContext(morningContext);
  vm.runInContext(read("data/mornings.js"), morningContext, { filename: "data/mornings.js" });
  const base = morningContext.MorningDatabase.get("MORNING_001");
  const m004 = morningContext.MorningDatabase.get("MORNING_M004");
  assert(m004);
  assert.equal(m004.id, "MORNING_M004");
  assert.equal(
    JSON.stringify(Object.assign({}, m004, { id: "MORNING_001" })),
    JSON.stringify(base)
  );

  context.MonsterBattleManager.start = async () => ({
    cleared: false, aborted: true, status: "adventure_return", controlResult: "adventure_return"
  });
  calls.length = 0;
  await context.StoryEngine.play(story, {});
  assert.deepEqual(calls, [], "Adventure Return must not enter Camp or Morning");

  assert(read("engine/managers/monster-manager.js").includes("definition.presentation.splitLayers"));

  console.log("m004 post-battle Camp and Morning progression: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
