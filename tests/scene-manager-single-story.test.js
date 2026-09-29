"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const played = [];
const context = {
  console,
  window: {},
  StoryRegistry: {
    get(id) {
      if (id === "S001") return { id: "S001", nextStoryId: "m001" };
      if (id === "m001") return { id: "m001" };
      return null;
    }
  },
  StoryEngine: {
    async play(story, state) {
      played.push(story.id);
      state.completed = true;
      return state;
    }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/core/scene-manager.js"), "utf8"), context);

(async () => {
  const result = await context.SceneManager.start("S001", {});
  assert.deepStrictEqual(played, ["S001", "m001"]);
  assert.strictEqual(result.completed, true);
  assert.strictEqual(context.SceneManager.getCurrentStoryId(), "m001");
  assert.strictEqual(context.SceneManager.isRunning(), false);
  console.log("Scene Manager single-story test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
