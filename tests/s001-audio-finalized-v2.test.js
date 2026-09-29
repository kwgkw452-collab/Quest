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
["engine/commands/story-commands.js", "engine/core/story-registry.js", "engine/stories/S001.js"]
  .forEach(file => vm.runInContext(read(file), context, { filename: file }));

const steps = context.StoryRegistry.get("S001").steps;
const indices = (type, src) => steps.reduce((found, step, index) => {
  if (step.type === type && step.src === src) found.push(index);
  return found;
}, []);

assert(read("engine/services/opening.js").includes(
  'AudioManager.playBgm("zephyrFields", { loop: true, volume: 0.23 })'));
assert.deepStrictEqual(indices("bgm", "morningGardenAtmosphere").map(i => steps[i].options.volume), [1.00]);
assert(read("engine/managers/morning-manager.js").includes("volume: 0.85"),
  "The shared Morning Manager value must remain unchanged");

const travel = indices("bgm", "zephyrFields");
assert.strictEqual(travel.length, 3);
assert(travel.every(i => steps[i].options.volume === 0.46));
const backgroundSequence = steps.findIndex(step => step.type === "backgroundSequence");
assert.strictEqual(travel[0], backgroundSequence - 1);
assert.strictEqual(steps[backgroundSequence + 1].type, "stopBgm");

const picoEntrance = indices("se", "picoEntrance");
assert.strictEqual(picoEntrance.length, 1);
assert.strictEqual(steps[picoEntrance[0]].options.volume, 0.48);
assert.strictEqual(steps[picoEntrance[0] + 1].type, "wait");
assert.strictEqual(steps[picoEntrance[0] + 1].ms, 3000);
const picoWake = indices("se", "picoWakeUp");
assert.strictEqual(picoWake.length, 1);
assert.strictEqual(steps[picoWake[0]].options.volume, 0.50);
assert.strictEqual(steps[picoWake[0] - 1].type, "characterImage");
assert.strictEqual(steps[picoWake[0] + 1].type, "effect");

const kongEntrance = indices("se", "kongEntrance");
assert.strictEqual(kongEntrance.length, 1);
assert.strictEqual(steps[kongEntrance[0]].options.volume, 0.33);
assert.strictEqual(steps[kongEntrance[0] - 1].type, "wait");
assert.strictEqual(steps[kongEntrance[0] - 1].ms, 250);
assert.strictEqual(steps[kongEntrance[0] + 1].type, "characters");
assert.strictEqual(steps[kongEntrance[0] + 2].type, "effect");
assert.strictEqual(steps[kongEntrance[0] + 3].type, "wait");
assert.strictEqual(steps[kongEntrance[0] + 3].ms, 400);

const tears = indices("bgm", "kongEmotionalSilentTears");
assert.strictEqual(tears.length, 1);
tears.forEach(i => {
  assert.strictEqual(steps[i].options.volume, 0.52);
  assert.strictEqual(steps[i].options.fadeInMs, 900);
  assert.strictEqual(steps[i].options.loop, true);
});
assert.strictEqual(tears[0], kongEntrance[0] + 4);
const japan = steps.findIndex(step => step.type === "question" && step.questionId === "word.japan");
assert.strictEqual(steps[japan].speechDucking.restore, true);
assert.strictEqual(steps[japan + 1].type, "characterImage");
assert.strictEqual(steps[japan + 1].pose, "crying");
assert.strictEqual(tears.length, 1);

const nameSpeech = steps.findIndex(step => step.type === "confirmSpeechName");
assert.strictEqual(steps[nameSpeech].speechDucking.restore, false);

const yes = steps.findIndex(step => step.type === "question" && step.questionId === "word.yes");
const friendship = indices("se", "zephyrFriendship");
assert.strictEqual(friendship.length, 1);
assert.strictEqual(steps[friendship[0]].options.volume, 0.31);
assert.strictEqual(steps[friendship[0] - 2].type, "stopBgm");
assert.strictEqual(steps[friendship[0] - 1].type, "wait");
assert.strictEqual(steps[friendship[0] - 1].ms, 250);
assert.strictEqual(steps[friendship[0] + 1].type, "wait");
assert.strictEqual(steps[friendship[0] + 1].ms, 3000);
assert(!steps.slice(yes + 1, friendship[0]).some(step =>
  step.type === "bgm" && step.src === "kongEmotionalSilentTears"));

["zephyrGo", "zephyrSuccess", "zephyrVictory"].forEach(src =>
  assert.strictEqual(indices("se", src).length, 0));
const questionManager = read("engine/managers/question-manager.js");
assert(questionManager.indexOf("AudioManager.stopAll()") < questionManager.indexOf("GameCore.speechMission({"));

console.log("S001 Audio Finalized V2 regression test: PASS");
