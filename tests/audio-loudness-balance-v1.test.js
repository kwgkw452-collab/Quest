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

const bgmVolumes = (steps, key) => Array.from(steps
  .filter(step => step.type === "bgm" && step.src === key), step => step.options.volume);
const seVolumes = (steps, key) => Array.from(steps
  .filter(step => step.type === "se" && step.src === key), step => step.options.volume);

assert.deepStrictEqual(bgmVolumes(s001, "morningGardenAtmosphere"), [1.00]);
assert.deepStrictEqual(seVolumes(s001, "picoEntrance"), [0.48]);
assert.deepStrictEqual(seVolumes(s001, "kongEntrance"), [0.33]);
assert.deepStrictEqual(seVolumes(s001, "zephyrFriendship"), [0.31]);

assert.deepStrictEqual(bgmVolumes(s002, "futureCityPixel"), [0.30, 0.15]);
const futureIntro = s002.find(step => step.type === "bgm" && step.src === "futureCityPixel");
assert.strictEqual(futureIntro.options.fadeToVolume, 0.15);
assert.strictEqual(futureIntro.options.fadeToMs, 3000);
assert.deepStrictEqual(seVolumes(s002, "zephyrSuccess"), [0.27]);

assert.deepStrictEqual(bgmVolumes(s004, "bernieUncertain"), Array(5).fill(0.60));
assert.deepStrictEqual(bgmVolumes(s004, "bernieConfident"), Array(2).fill(0.30));
assert.deepStrictEqual(seVolumes(s004, "zephyrSuccess"), [0.27]);

assert.deepStrictEqual(bgmVolumes(st004, "bazaarCrowd"), [0.55]);
assert.deepStrictEqual(bgmVolumes(st004, "bazaarMiddleEast"), Array(4).fill(0.08));
assert(read("engine/stories/story-saki-departure.js").includes('C.se("mysteryShopSting", { volume: 0.45 })'));
assert.deepStrictEqual(seVolumes(st004, "zephyrDeparture"), [0.27]);
assert.deepStrictEqual(seVolumes(st004, "zephyrGo"), [0.25]);
const crowdIndex = st004.findIndex(step => step.type === "bgm" && step.src === "bazaarCrowd");
assert.strictEqual(st004[crowdIndex + 1].ms, 3500);
assert.strictEqual(st004[crowdIndex + 2].options.crossfadeMs, 1200);

const morning = read("engine/managers/morning-manager.js");
assert(morning.includes('volume: 0.85, fadeInMs: 700'));
const camp = read("engine/managers/camp-manager.js");
assert(camp.includes('volume: 0.52, fadeInMs: 700'));
assert(camp.includes("await EffectManager.wait(1000)"));

const battle = read("engine/managers/monster-battle-manager.js");
assert(battle.includes('monster.audio.warning === "monsterWarningTensePiano" ? 0.60 : 0.50'));
assert(battle.includes('playRegisteredAudio("battleHit", { volume: 0.80 })'));
assert(battle.includes('playRegisteredAudio("battlePurify", { volume: 0.70 })'));
const monsters = read("data/monsters.js");
assert(monsters.includes("defeatSeVolume: 0.45"));
assert(!monsters.includes("victoryVolume:"));
assert(monsters.includes("postRecoveryBgmVolume: 0.20"));
assert.strictEqual((monsters.match(/introHoldMs: 3000/g) || []).length, 2);
assert.strictEqual((monsters.match(/warning: "monsterWarningReveal"/g) || []).length, 1);

const opening = read("engine/services/opening.js");
assert(opening.includes('AudioManager.playBgm("zephyrFields", { loop: true, volume: 0.23 })'));
const question = read("engine/managers/question-manager.js");
assert(question.indexOf("AudioManager.stopAll()") < question.indexOf("GameCore.speechMission({"));
const css = read("css/style.css");
assert(css.includes("top: 25%"));
assert(css.includes("top: 24%"));

console.log("Audio Loudness Balance V1 regression test: PASS");
