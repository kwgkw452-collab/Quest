"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "data/audio.js"), "utf8"), context);

const expected = {
  zephyrFields: "audio/bgm/bgm_zephyr_fields_main.mp3",
  zephyrEntrance: "audio/jingle/jingle_zephyr_entrance_v1.mp3",
  zephyrSuccess: "audio/jingle/jingle_zephyr_success_v1.mp3",
  zephyrGo: "audio/jingle/jingle_zephyr_go_v3.mp3",
  zephyrDeparture: "audio/jingle/jingle_zephyr_departure_v1.mp3",
  zephyrVictory: "audio/jingle/jingle_zephyr_victory_v1.mp3"
};

assert.strictEqual(context.AudioDatabase.bgm.zephyrFields, expected.zephyrFields);
Object.keys(expected).slice(1).forEach(key => {
  assert.strictEqual(context.AudioDatabase.se[key], expected[key], key + " must use the approved path");
});
Object.values(expected).forEach(file => {
  assert(fs.existsSync(path.join(root, file)), "Registered audio file must exist: " + file);
});

const audioSource = fs.readFileSync(path.join(root, "data/audio.js"), "utf8");
assert(!/jingle_zephyr_go_v[12]\.mp3/.test(audioSource), "Legacy GO V1/V2 must not be registered");

const openingSource = fs.readFileSync(path.join(root, "engine/services/opening.js"), "utf8");
const videoSection = openingSource.slice(openingSource.indexOf("function showOpeningVideo"), openingSource.indexOf("function showNameRegistration"));
assert(!videoSection.includes("playBgm"), "Opening video must not start the BGM");
assert(openingSource.indexOf("SaveManager.setPlayerName(name)") < openingSource.indexOf("startOpeningBgm();"),
  "The name-confirm user action must start the BGM after saving the name");
assert(openingSource.includes('AudioManager.playBgm("zephyrFields", { loop: true, volume: 0.23 })'));

const mainSource = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
assert(mainSource.indexOf("await Opening.start()") < mainSource.indexOf("AudioManager.stopBgm()"));
assert(mainSource.indexOf("AudioManager.stopBgm()") < mainSource.indexOf("await SceneManager.start"));

vm.runInContext(fs.readFileSync(path.join(root, "engine/commands/story-commands.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/core/story-registry.js"), "utf8"), context);
["S002.js", "S004.js", "story-saki-departure.js"].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(root, "engine/stories", file), "utf8"), context);
});
function assertMotifAfter(storyId, dialogue, motif, volume) {
  const steps = context.StoryRegistry.get(storyId).steps;
  const index = steps.findIndex(step => step.type === "dialogue" && step.text === dialogue);
  assert(index !== -1, "Missing dialogue: " + dialogue);
  assert.strictEqual(steps[index + 1].type, "hideDialogue");
  assert.strictEqual(steps[index + 2].type, "se");
  assert.strictEqual(steps[index + 2].src, motif);
  assert.strictEqual(steps[index + 2].options.volume, volume);
  assert.strictEqual(steps[index + 3].type, "wait");
  assert.strictEqual(steps[index + 3].ms, 3000);
}
assertMotifAfter("S002", "I did it! I can talk!", "zephyrSuccess", 0.27);
assertMotifAfter("st004", "See you!", "zephyrDeparture", 0.27);
const departureSteps = context.StoryRegistry.get("st004").steps;
const goDialogue = departureSteps.findIndex(step => step.type === "dialogue" && step.text === "Let's go, Master!");
assert.strictEqual(departureSteps[goDialogue + 1].type, "hideDialogue");
assert.strictEqual(departureSteps[goDialogue + 2].src, "zephyrGo");
assert.strictEqual(departureSteps[goDialogue + 2].options.volume, 0.25);
assert.strictEqual(departureSteps[goDialogue + 2].options.stopAllBefore, true);
assert.strictEqual(departureSteps[goDialogue + 3].ms, 3000);

const s004Steps = context.StoryRegistry.get("S004").steps;
const battleIndex = s004Steps.findIndex(step => step.type === "monsterBattle" && step.monsterId === "m003");
assert.notStrictEqual(s004Steps[battleIndex - 1].src, "zephyrGo");
assert.strictEqual(s004Steps[battleIndex + 1], undefined);

console.log("Audio Phase 1 registration and Opening wiring test: PASS");
