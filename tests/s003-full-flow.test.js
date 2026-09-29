"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
const context = {
  console,
  window: {},
  StoryEvents: { async emit() {} },
  MorningManager: {
    async start(id) {
      calls.push(["morning", id]);
      return { status: "completed", morningId: id };
    }
  },
  MonsterBattleManager: {
    async start(id) {
      calls.push(["monsterBattle", id]);
      return { status: "completed", monsterId: id };
    }
  },
  CampManager: {
    async start(id) {
      calls.push(["camp", id]);
      return { status: "completed", campId: id };
    }
  }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

[
  "engine/commands/story-commands.js",
  "engine/core/story-registry.js",
  "engine/core/story-events.js",
  "engine/core/story-engine.js",
  "engine/core/scene-manager.js",
  "engine/stories/S003.js"
].forEach(load);

(async () => {
  const result = await context.StoryEngine.playById("S003", {});
  assert.deepStrictEqual(calls, [
    ["morning", "MORNING_001"],
    ["monsterBattle", "m002"],
    ["camp", "CAMP_M002"]
  ]);
  assert.strictEqual(result.s003Morning.status, "completed");
  assert.strictEqual(result.numberBattle.status, "completed");
  assert.strictEqual(result.s003Camp.status, "completed");
  assert.strictEqual(context.SceneManager.getCurrentStoryId(), null);
  assert.strictEqual(context.SceneManager.isRunning(), false);
  console.log("S003 full-flow test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
