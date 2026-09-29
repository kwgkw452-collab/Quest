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

assert.deepStrictEqual(bgmVolumes(s001, "morningGardenAtmosphere"), [1.00]);
assert(read("engine/managers/morning-manager.js").includes('volume: 0.85, fadeInMs: 700'));
const travel = s001.findIndex(step => step.type === "backgroundSequence");
assert(s001.slice(0, travel).some(step => step.type === "stopBgm"));
assert.deepStrictEqual(Array.from(s001[travel].items), ["city", "suburb", "country", "forest"]);
assert.strictEqual(s001[travel - 1].src, "zephyrFields");
assert.strictEqual(s001[travel + 1].type, "stopBgm");

const pico = s001.findIndex(step => step.type === "se" && step.src === "picoEntrance");
const kong = s001.findIndex(step => step.type === "se" && step.src === "kongEntrance");
const friendship = s001.findIndex(step => step.type === "se" && step.src === "zephyrFriendship");
assert.strictEqual(s001[pico].options.volume, 0.48);
assert.strictEqual(s001[pico + 1].ms, 3000);
assert.strictEqual(s001[kong].options.volume, 0.33);
assert.strictEqual(s001[friendship].options.volume, 0.31);
assert.strictEqual(s001[friendship + 1].ms, 3000);

assert.deepStrictEqual(bgmVolumes(s002, "futureCityPixel"), [0.30, 0.15]);
const futureIntro = s002.findIndex(step => step.type === "bgm" && step.src === "futureCityPixel");
assert.strictEqual(s002[futureIntro].options.fadeToMs, 3000);
assert.strictEqual(s002[futureIntro + 1].ms, 3000);
const yes = s002.findIndex(step => step.type === "question" && step.questionId === "phrase.yes_can_hear_you");
const invite = s002.findIndex(step => step.type === "question" && step.questionId === "phrase.come_with_me");
assert.notStrictEqual(s002[yes + 1].type, "bgm");
assert.notStrictEqual(s002[invite + 1].type, "bgm");
const sakiSuccess = s002.findIndex(step => step.type === "se" && step.src === "zephyrSuccess");
assert.strictEqual(s002[sakiSuccess - 1].type, "hideDialogue");
assert.strictEqual(s002[sakiSuccess + 1].ms, 3000);

assert.deepStrictEqual(bgmVolumes(s004, "bernieUncertain"), Array(5).fill(0.60));
assert.deepStrictEqual(bgmVolumes(s004, "bernieConfident"), Array(2).fill(0.30));
const bernieSuccess = s004.findIndex(step => step.type === "se" && step.src === "zephyrSuccess");
assert.strictEqual(s004[bernieSuccess - 1].type, "hideDialogue");
assert.strictEqual(s004[bernieSuccess + 1].ms, 3000);

const goSteps = [s001, s002, s004, st004].flat().filter(step => step.type === "se" && step.src === "zephyrGo");
assert.strictEqual(goSteps.length, 1);
assert.strictEqual(goSteps[0].options.volume, 0.25);
const go = st004.indexOf(goSteps[0]);
assert.strictEqual(st004[go - 1].type, "hideDialogue");
assert.strictEqual(st004[go + 1].ms, 3000);
const departure = st004.findIndex(step => step.type === "se" && step.src === "zephyrDeparture");
assert.strictEqual(st004[departure - 1].type, "hideDialogue");
assert.strictEqual(st004[departure + 1].ms, 3000);

const monsters = read("data/monsters.js");
assert(/monsterId: "m003"[\s\S]*?postRecoveryBgm: "zephyrFields"[\s\S]*?postRecoveryBgmVolume: 0\.20/.test(monsters));
assert(!/monsterId: "m003"[\s\S]*?victorySe:/.test(monsters));
const battle = read("engine/managers/monster-battle-manager.js");
const recovery = battle.indexOf("monster.battle.postRecoveryBgm");
assert(battle.indexOf("EffectManager.wait(750)", recovery) > recovery);
assert(battle.indexOf("EffectManager.wait(3000)", recovery) > recovery);

const storyEngine = read("engine/core/story-engine.js");
assert(/register\("monsterBattle"[\s\S]*?AudioManager\.stopAll\(\)/.test(storyEngine));
assert(/register\("camp"[\s\S]*?AudioManager\.stopAll\(\)/.test(storyEngine));
const sceneManager = read("engine/core/scene-manager.js");
assert(sceneManager.includes("if (story.nextStoryId) stopSceneAudio()"));
assert(sceneManager.includes("finally {\n      stopSceneAudio();"));

assert.deepStrictEqual(bgmVolumes(st004, "bazaarCrowd"), [0.55]);
assert.deepStrictEqual(bgmVolumes(st004, "bazaarMiddleEast"), Array(4).fill(0.08));
assert(read("engine/managers/camp-manager.js").includes("await EffectManager.wait(1000)"));
assert(read("engine/managers/question-manager.js").indexOf("AudioManager.stopAll()") < read("engine/managers/question-manager.js").indexOf("GameCore.speechMission({"));

console.log("Audio Playtest Correction V2 regression test: PASS");
