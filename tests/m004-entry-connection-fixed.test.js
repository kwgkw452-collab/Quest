"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const original = "/Users/mac/Downloads/Eigo-DE-Quest_005-m004-Face-Parts-Monster-Battle-V1";
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const checkpointContext = { console };
checkpointContext.window = checkpointContext;
vm.createContext(checkpointContext);
vm.runInContext(read("dev/dev-checkpoints.js"), checkpointContext, { filename: "dev/dev-checkpoints.js" });
const checkpoints = JSON.parse(JSON.stringify(checkpointContext.DevCheckpointDatabase.list()));
const m004Checkpoint = checkpoints.find(item => item.id === "M004");
assert(m004Checkpoint, "Dev Jump must expose an m004 checkpoint");
assert.equal(m004Checkpoint.label, "m004");
assert.deepEqual(m004Checkpoint.entry, { kind: "story", id: "m004" });

const calls = [];
const context = {
  console,
  AudioManager: { stopAll() { calls.push(["audio.stopAll"]); } }
};
context.window = context;
vm.createContext(context);
for (const file of [
  "engine/core/story-compiler.js",
  "engine/core/story-registry.js",
  "engine/commands/story-commands.js",
  "engine/stories/story-saki-departure.js",
  "engine/stories/m004.js",
  "engine/stories/S005.js"
]) vm.runInContext(read(file), context, { filename: file });

const st004 = context.StoryRegistry.get("st004");
assert.equal(st004.nextStoryId, "m004", "st004 formal metadata must point to m004");
assert(read("engine/stories/story-saki-departure.js").includes('nextStoryId: "m004"'));

context.StoryEngine = {
  async play(story, state) {
    calls.push(["story.play", story.id]);
    state.storyId = story.id;
    return state;
  }
};
vm.runInContext(read("engine/core/scene-manager.js"), context, { filename: "engine/core/scene-manager.js" });

(async () => {
  const state = await context.SceneManager.start("st004", {});
  assert.deepEqual(calls.filter(call => call[0] === "story.play"), [
    ["story.play", "st004"], ["story.play", "m004"], ["story.play", "S005"]
  ]);
  assert.equal(state.storyId, "S005");
  assert.equal(context.SceneManager.getCurrentStoryId(), "S005");

  const originalPath = path.join(original, "engine/stories/story-saki-departure.js");
  if (fs.existsSync(originalPath)) {
    const originalStory = fs.readFileSync(originalPath, "utf8");
    const fixedStoryWithoutRoute = read("engine/stories/story-saki-departure.js")
      .replace('    nextStoryId: "m004",\n', "");
    assert.equal(fixedStoryWithoutRoute, originalStory, "st004 body must be unchanged");
  }

  assert(read("engine/managers/monster-manager.js").includes("definition.presentation.splitLayers"),
    "m004 face-balance split layers must remain data-driven");
  console.log("m004 Dev Jump and st004 progression connection: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
