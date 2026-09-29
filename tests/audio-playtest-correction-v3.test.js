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
  "engine/stories/S001.js",
  "engine/stories/S002.js",
  "engine/stories/S004.js",
  "engine/stories/story-saki-departure.js"
].forEach(file => vm.runInContext(read(file), context, { filename: file }));

const s001 = context.StoryRegistry.get("S001").steps;
const s002 = context.StoryRegistry.get("S002").steps;
const s004 = context.StoryRegistry.get("S004").steps;
const st004 = context.StoryRegistry.get("st004").steps;
const bgmVolumes = (steps, key) => Array.from(steps.filter(step => step.type === "bgm" && step.src === key), step => step.options.volume);

assert(read("engine/services/opening.js").includes('volume: 0.23'));
assert.deepStrictEqual(bgmVolumes(s001, "morningGardenAtmosphere"), [1.00]);
assert(read("engine/managers/morning-manager.js").includes('volume: 0.85, fadeInMs: 700'));
assert(!Object.prototype.hasOwnProperty.call(context.AudioDatabase.bgm, "s001CityAtmosphere"));
assert(!Object.prototype.hasOwnProperty.call(context.AudioDatabase.bgm, "s001SuburbAtmosphere"));
assert.strictEqual(context.AudioDatabase.se.picoWakeUp, "audio/se/se_pico_wakeup_v1.mp3");

const travel = s001.findIndex(step => step.type === "backgroundSequence");
assert.strictEqual(s001[travel - 1].src, "zephyrFields");
assert.strictEqual(s001[travel + 1].type, "stopBgm");
const pico = s001.findIndex(step => step.type === "se" && step.src === "picoEntrance");
assert.strictEqual(s001[pico].options.volume, 0.48);
assert.strictEqual(s001[pico + 1].ms, 3000);
const kong = s001.findIndex(step => step.type === "se" && step.src === "kongEntrance");
assert.strictEqual(s001[kong].options.volume, 0.33);
assert(s001.slice(0, kong).some(step => step.type === "stopBgm" && step.options.fadeOutMs === 500));
assert.strictEqual(s001.slice(kong + 1).some(step => step.type === "bgm" && step.src === "morningGardenAtmosphere"), false);
const friendship = s001.findIndex(step => step.type === "se" && step.src === "zephyrFriendship");
assert.strictEqual(s001[friendship].options.volume, 0.31);
assert.strictEqual(s001[friendship + 1].ms, 3000);

assert.deepStrictEqual(bgmVolumes(s002, "futureCityPixel"), [0.30, 0.15]);
const city = s002.find(step => step.type === "bgm" && step.src === "futureCityPixel");
assert.strictEqual(city.options.fadeToVolume, 0.15);
assert.strictEqual(city.options.fadeToMs, 3000);
assert.strictEqual(s002.filter(step => step.type === "se" && step.src === "zephyrGo").length, 0);
const citySuccess = s002.findIndex(step => step.type === "se" && step.src === "zephyrSuccess");
assert.strictEqual(s002[citySuccess].options.volume, 0.27);
assert.strictEqual(s002[citySuccess + 1].ms, 3000);

assert.deepStrictEqual(bgmVolumes(s004, "bernieUncertain"), Array(5).fill(0.60));
assert.deepStrictEqual(bgmVolumes(s004, "bernieConfident"), Array(2).fill(0.30));
const success = s004.findIndex(step => step.type === "se" && step.src === "zephyrSuccess");
assert.strictEqual(s004[success].options.volume, 0.27);
assert.strictEqual(s004[success + 1].ms, 3000);
assert.strictEqual(s004[success + 2].options.stopAllBefore, true);
assert.strictEqual(s004[success + 2].options.preDelayMs, 300);
const battle = s004.findIndex(step => step.type === "monsterBattle");
assert.strictEqual(s004[battle - 1].type, "stopBgm");

const monsters = read("data/monsters.js");
assert(/monsterId: "m003"[\s\S]*?postRecoveryBgmVolume: 0\.20/.test(monsters));
assert(!/monsterId: "m003"[\s\S]*?victorySe:/.test(monsters));
assert(read("engine/managers/monster-battle-manager.js").includes("EffectManager.wait(3000)"));

const departure = st004.findIndex(step => step.type === "se" && step.src === "zephyrDeparture");
assert.strictEqual(st004[departure].options.volume, 0.27);
assert.strictEqual(st004[departure + 1].ms, 3000);
const allGo = [s001, s002, s004, st004].flat().filter(step => step.type === "se" && step.src === "zephyrGo");
assert.strictEqual(allGo.length, 1);
assert.strictEqual(allGo[0].options.volume, 0.25);
assert.strictEqual(allGo[0].options.stopAllBefore, true);
const go = st004.indexOf(allGo[0]);
assert.strictEqual(st004[go + 1].ms, 3000);

assert(read("engine/core/story-engine.js").includes("step.options.stopAllBefore"));
assert(read("engine/core/scene-manager.js").includes("if (story.nextStoryId) stopSceneAudio()"));
assert(read("engine/managers/camp-manager.js").includes("await EffectManager.wait(1000)"));
assert.deepStrictEqual(bgmVolumes(st004, "bazaarCrowd"), [0.55]);
assert.deepStrictEqual(bgmVolumes(st004, "bazaarMiddleEast"), Array(4).fill(0.08));

console.log("Audio Playtest Correction V3 regression test: PASS");
