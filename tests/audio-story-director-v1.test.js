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
["data/audio.js", "engine/commands/story-commands.js", "engine/core/story-registry.js",
  "engine/stories/S001.js", "engine/stories/S002.js", "engine/stories/S004.js",
  "engine/stories/story-saki-departure.js"].forEach(file => {
  vm.runInContext(read(file), context, { filename: file });
});

const assets = {
  zephyrFriendship: "audio/jingle/jingle_zephyr_friendship_v1.mp3",
  picoEntrance: "audio/se/se_pico_entrance_v1.mp3",
  monsterWarningTensePiano: "audio/se/se_monster_warning_tense_piano_v1.mp3",
  bazaarCrowd: "audio/ambient/ambient_bazaar_crowd_v1.mp3",
  bazaarMiddleEast: "audio/bgm/bgm_bazaar_middle_east_v1.mp3",
  bernieUncertain: "audio/bgm/bgm_bernie_uncertain_v1.mp3",
  bernieConfident: "audio/bgm/bgm_bernie_confident_v1.mp3"
};
Object.entries(assets).forEach(([key, file]) => {
  const group = key === "bazaarCrowd" || key.startsWith("bernie") || key === "bazaarMiddleEast" ? "bgm" : "se";
  assert.strictEqual(context.AudioDatabase[group][key], file);
  assert(fs.statSync(path.join(root, file)).size > 0, `${file} must be a non-empty asset`);
});

const manager = read("engine/managers/audio-manager.js");
assert(manager.includes('"zephyrFriendship"'), "FRIENDSHIP must use Zephyr duplicate prevention");
assert(manager.includes("function fade("));
assert(manager.includes("options.crossfadeMs"));
assert(manager.includes("options.fadeToVolume"));

const s001 = context.StoryRegistry.get("S001").steps;
assert.strictEqual(s001.filter(step => step.type === "se" && step.src === "picoEntrance").length, 1);
assert.strictEqual(s001.filter(step => step.type === "se" && step.src === "kongEntrance").length, 1);
const friendship = s001.findIndex(step => step.type === "se" && step.src === "zephyrFriendship");
assert.strictEqual(s001[friendship - 2].type, "stopBgm");
assert.strictEqual(s001[friendship - 1].type, "wait");
assert.strictEqual(s001[friendship + 1].type, "wait");
assert.strictEqual(s001[friendship + 1].ms, 3000);
assert(s001.some(step => step.type === "bgm" && step.src === "morningGardenAtmosphere" && step.options.volume === 1.00));
const travel = s001.findIndex(step => step.type === "backgroundSequence");
assert(s001.slice(0, travel).some(step => step.type === "stopBgm"), "Garden must stop before city/suburb travel");
assert.strictEqual(s001[travel - 1].src, "zephyrFields", "Main Theme must cover city/suburb/forest travel");
assert.deepStrictEqual(Array.from(s001[travel].items), ["city", "suburb", "country", "forest"]);

const s002 = context.StoryRegistry.get("S002").steps;
const firstCity = s002.find(step => step.type === "bgm" && step.src === "futureCityPixel");
assert.strictEqual(firstCity.options.volume, 0.30);
assert.strictEqual(firstCity.options.fadeToVolume, 0.15);
assert.strictEqual(firstCity.options.fadeToMs, 3000);
const itsOkIndex = s002.findIndex(step => step.type === "question" && step.questionId === "phrase.its_ok");
assert.strictEqual(s002[itsOkIndex - 1].type, "stopBgm");
assert.strictEqual(s002[itsOkIndex + 1].type, "bgm");
assert.strictEqual(s002[itsOkIndex + 1].options.fadeInMs, 600);
["phrase.yes_can_hear_you", "phrase.come_with_me"].forEach(id => {
  const index = s002.findIndex(step => step.type === "question" && step.questionId === id);
  assert.strictEqual(s002[index - 1].type, "stopBgm");
  assert.notStrictEqual(s002[index + 1].type, "bgm");
});

const monsters = read("data/monsters.js");
assert.strictEqual((monsters.match(/warning: "monsterWarningTensePiano"/g) || []).length, 2);
assert.strictEqual((monsters.match(/introHoldMs: 3000/g) || []).length, 2);
assert.strictEqual((monsters.match(/warning: "monsterWarningReveal"/g) || []).length, 1);
assert(/monsterId: "m001"[\s\S]*?playPurifySe: false[\s\S]*?defeatSe: "monsterDefeatExplosion"/.test(monsters));
assert(/monsterId: "m003"[\s\S]*?postRecoveryBgm: "zephyrFields"[\s\S]*?postRecoveryBgmVolume: 0\.20/.test(monsters));
assert(!/monsterId: "m003"[\s\S]*?victorySe:/.test(monsters));

const s004 = context.StoryRegistry.get("S004").steps;
assert(s004.some(step => step.type === "bgm" && step.src === "bernieUncertain" && step.options.volume === 0.60));
assert(s004.some(step => step.type === "bgm" && step.src === "bernieConfident" && step.options.volume === 0.30));
const success = s004.findIndex(step => step.type === "se" && step.src === "zephyrSuccess");
assert.strictEqual(s004[success - 1].type, "hideDialogue");
assert.strictEqual(s004[success + 1].ms, 3000);
assert.strictEqual(s004.filter(step => step.type === "se" && step.src === "zephyrGo").length, 0);

const st004 = context.StoryRegistry.get("st004").steps;
const crowd = st004.findIndex(step => step.type === "bgm" && step.src === "bazaarCrowd");
assert.strictEqual(st004[crowd].options.volume, 0.55);
assert.strictEqual(st004[crowd + 1].ms, 3500);
assert.strictEqual(st004[crowd + 2].src, "bazaarMiddleEast");
assert.strictEqual(st004[crowd + 2].options.volume, 0.08);
assert.strictEqual(st004[crowd + 2].options.crossfadeMs, 1200);
const go = st004.findIndex(step => step.type === "se" && step.src === "zephyrGo");
assert.strictEqual(st004[go - 1].type, "hideDialogue");
assert.strictEqual(st004[go + 1].ms, 3000);

const camp = read("engine/managers/camp-manager.js");
assert(camp.includes('volume: 0.52, fadeInMs: 700'));
assert(camp.includes("await EffectManager.wait(1000)"));
const question = read("engine/managers/question-manager.js");
assert(question.indexOf("AudioManager.stopAll()") < question.indexOf("GameCore.speechMission({"));
const css = read("css/style.css");
assert(css.includes("top: 25%"));
assert(css.includes("top: 24%"));

console.log("Audio Story Director V1 regression test: PASS");
