"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio.js"), context);

const stories = ["S001.js", "S002.js", "S004.js", "story-saki-departure.js"]
  .map(file => read("engine/stories/" + file)).join("\n");
const monsters = read("data/monsters.js") + read("data/m004.js");
const voiceKeys = Array.from((stories + monsters).matchAll(/voiceKey:\s*"([^"]+)"/g), match => match[1]);
assert(voiceKeys.length > 0);
for (const key of voiceKeys) {
  const relative = context.AudioDatabase.voice[key];
  assert(relative, "registered voice asset: " + key);
  const absolute = path.join(root, relative);
  assert(fs.existsSync(absolute), "voice file exists: " + relative);
  assert(fs.statSync(absolute).size > 0, "voice file is non-empty: " + relative);
}

const manager = read("engine/managers/audio-manager.js");
assert(manager.includes('var kong = !radio && characterCode === "c02"'));
assert(manager.includes('var bernie = !radio && characterCode === "c04"'));
assert(manager.includes('context.createMediaElementSource(audio)'));
assert(manager.includes('routeEnd.connect(buses.voice)'));
assert(manager.includes('source.connect(routeStart)'));
assert(manager.includes('characterGain.connect(kongGain)'));
assert(manager.includes('kongGain.connect(limiter)'));
assert(manager.includes('characterGain.connect(lowMid)'));
assert(manager.includes('saturation.connect(radioOutput)'));
assert(manager.includes('routeEnd = radioOutput'));
assert(!manager.includes("createBufferSource"), "Voice processing is MediaElementSource, not BufferSource");
assert(manager.includes("var voiceModeOwner = enterDialogueVoiceMode()"));
assert(manager.includes("exitDialogueVoiceMode(voiceModeOwner)"));

const mix = read("data/audio-mix-profile.js");
assert(mix.includes("dialogueVoice: { ratio: 0.18"));
assert(monsters.includes('postRecoveryBgm: "zephyrFields"'));
assert(monsters.includes("postRecoveryBgmVolume: 0.20"));

for (const page of ["index.html", "dev.html"]) {
  const html = read(page);
  assert(html.includes("data/audio-mix-profile.js?v=audio-gainnode-unification-v1"));
  assert(html.includes("engine/managers/audio-manager.js?v=gainnode-iphone-runtime-trace-panel-fix-v1"));
  assert(html.includes('engine/services/dialogue-voice-controller.js?v=audio-gainnode-unification-v1"'));
}
assert(read("index.html").includes('engine/controllers/pico-support-controller.js?v=audio-mix-duck-calibration-v1"'));

const s001 = read("engine/stories/S001.js");
const shortZephyr = [
  'C.bgm("zephyrFields", { loop: true, volume: 0.46, fadeInMs: 600 })',
  "C.wait(1200)",
  "C.stopBgm({ fadeOutMs: 500 })",
  "C.wait(250)",
  'C.se("kongEntrance", { volume: 0.33 })'
];
let zephyrCursor = -1;
for (const event of shortZephyr) {
  zephyrCursor = s001.indexOf(event, zephyrCursor + 1);
  assert(zephyrCursor >= 0, "S001 short Zephyr event order: " + event);
}

const future = read("engine/stories/S002.js");
assert(future.indexOf('C.bgm("futureCityPixel"') < future.indexOf('voice_c01_s002_001'));
assert(future.includes('C.question("phrase.its_ok", "calmSaki")'));
assert(future.indexOf('C.question("phrase.its_ok", "calmSaki")') <
  future.indexOf('C.bgm("futureCityPixel", { loop: true, volume: 0.15, fadeInMs: 600 })'));

const departure = read("engine/stories/story-saki-departure.js");
assert.strictEqual((departure.match(/voiceEffect:\s*"radio"/g) || []).length, 6);
assert(departure.indexOf('voice_c03_st004_012') < departure.indexOf('voice_c03_st004_013'));
assert(!departure.slice(departure.indexOf('voice_c03_st004_013'), departure.indexOf('voice_c03_st004_014'))
  .includes('voiceEffect: "radio"'));

console.log("Audio Voice Runtime Path Audit V1 tests: PASS");
