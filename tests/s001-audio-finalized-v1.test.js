"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const context = { window: {} };
context.window = context;
vm.createContext(context);
[
  "data/audio.js",
  "engine/commands/story-commands.js",
  "engine/core/story-registry.js",
  "engine/stories/S001.js"
].forEach(file => vm.runInContext(read(file), context, { filename: file }));

assert.strictEqual(context.AudioDatabase.se.picoWakeUp, "audio/se/se_pico_wakeup_v1.mp3");
assert.strictEqual(context.AudioDatabase.bgm.kongEmotionalSilentTears,
  "audio/bgm/bgm_kong_emotional_silent_tears_v1.mp3");
assert(fs.existsSync(path.join(root, context.AudioDatabase.se.picoWakeUp)));
assert(fs.existsSync(path.join(root, context.AudioDatabase.bgm.kongEmotionalSilentTears)));
assert(fs.existsSync(path.join(root, "licenses/S001_AUDIO_FINALIZE_PACK_V1_MANIFEST.md")));

const steps = context.StoryRegistry.get("S001").steps;
const wake = steps.findIndex(step => step.type === "se" && step.src === "picoWakeUp");
assert(wake !== -1);
assert.strictEqual(steps.filter(step => step.type === "se" && step.src === "picoWakeUp").length, 1);
assert.strictEqual(steps[wake - 1].type, "characterImage");
assert.strictEqual(steps[wake - 1].id, "pico");
assert.strictEqual(steps[wake - 1].pose, "normal");
assert.strictEqual(steps[wake].options.volume, 0.50);
assert.strictEqual(steps[wake + 1].type, "effect");
assert.notStrictEqual(steps[wake + 1].type, "wait");

const emotionalStarts = steps.reduce((indices, step, index) => {
  if (step.type === "bgm" && step.src === "kongEmotionalSilentTears") indices.push(index);
  return indices;
}, []);
assert.strictEqual(emotionalStarts.length, 1);
const emotional = emotionalStarts[0];
assert.strictEqual(steps[emotional - 1].type, "wait");
assert.strictEqual(steps[emotional - 1].ms, 400);
emotionalStarts.forEach(index => {
  assert.strictEqual(steps[index].options.volume, 0.52);
  assert.strictEqual(steps[index].options.fadeInMs, 900);
  assert.strictEqual(steps[index].options.loop, true);
});

const nameQuestion = steps.findIndex(step => step.type === "confirmSpeechName");
const emotionalStop = steps.findIndex((step, index) => index > emotional && step.type === "stopBgm");
assert(nameQuestion < emotionalStop);

const friendship = steps.findIndex(step => step.type === "se" && step.src === "zephyrFriendship");
assert(emotionalStop < friendship);
assert.strictEqual(steps[friendship - 2].type, "stopBgm");
assert.strictEqual(steps[friendship - 1].type, "wait");
assert.strictEqual(steps[friendship - 1].ms, 250);
assert.strictEqual(steps[friendship + 1].type, "wait");
assert.strictEqual(steps[friendship + 1].ms, 3000);

const mainTheme = steps.filter(step => step.type === "bgm" && step.src === "zephyrFields");
assert.strictEqual(mainTheme.length, 3);
assert(mainTheme.every(step => step.options.volume === 0.46));
const travel = steps.findIndex(step => step.type === "backgroundSequence");
assert.strictEqual(steps[travel - 1].src, "zephyrFields");
assert.strictEqual(steps[travel + 1].type, "stopBgm");

const picoDialogue = steps.findIndex(step => step.type === "dialogue" &&
  step.text === "マスター！声を聞かせてくれてありがとう！あなたの声で目覚めることができた！");
const resumedMain = steps.findIndex((step, index) => index > picoDialogue && step.type === "bgm" && step.src === "zephyrFields");
const kongEntrance = steps.findIndex(step => step.type === "se" && step.src === "kongEntrance");
assert(picoDialogue < resumedMain && resumedMain < kongEntrance);
assert(steps.slice(resumedMain + 1, kongEntrance).some(step => step.type === "stopBgm" && step.options.fadeOutMs === 500));

const otherStorySources = ["S002.js", "S003.js", "S004.js", "m001.js", "story-saki-departure.js"]
  .map(file => read(path.join("engine/stories", file))).join("\n");
assert(!otherStorySources.includes("picoWakeUp"));
assert(!otherStorySources.includes("kongEmotionalSilentTears"));

const audioManager = read("engine/managers/audio-manager.js");
assert(/window\.AudioManager\s*=\s*\{[\s\S]*?playBgm: playBgm,[\s\S]*?stopAll: stopAll,[\s\S]*?unlock: unlock/.test(audioManager));

console.log("S001 Audio Finalized V1 regression test: PASS");
