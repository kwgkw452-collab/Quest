"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const storySource = read("engine/stories/m004.js");
const dataSource = read("data/m004.js");
const managerSource = read("engine/managers/monster-battle-manager.js");
const effectsSource = read("data/effects.js");
const cssSource = read("css/style.css");

assert(storySource.indexOf('C.bgm("nocturnalBloom"') < storySource.indexOf('C.monster("m004"'));
assert(storySource.indexOf('C.monster("m004"') < storySource.indexOf('C.effect("scene-fade-in", 900)'));
assert(storySource.includes('C.monsterBattle("m004", "facePartsBattle", { preserveBgm: true })'));
assert(!effectsSource.includes("sceneFadeIn"), "existing EffectManager class fallback is reused");
assert(cssSource.includes("@keyframes sceneFadeIn"));

assert(dataSource.includes("completionSeLeadMs: 6614"));
assert(dataSource.includes("completionSeHoldMs: 3600"));
assert(dataSource.includes("stopBgmFadeOutMs: 650"));
assert(dataSource.includes("postRecoverySeVolume: 0.24"));
assert(dataSource.includes("speechDucking: { ratio: 0.25, duckMs: 300, restoreMs: 600 }"));
const extensionSource = read("engine/services/m004-battle-extension.js");
assert(extensionSource.includes("SpeechAudioDuckingInternal.arm(ducking)"));
assert(extensionSource.includes("SpeechAudioDuckingInternal.finish"));

const goIndex = extensionSource.indexOf('originalPlaySe("zephyrGo", { volume: 0.24 })');
const stopIndex = extensionSource.indexOf("return originalStopBgm(options)", goIndex);
assert(goIndex !== -1 && goIndex < stopIndex,
  "Zephyr Go must start before the Nocturnal fade promise finishes");

const sourceContext = { window: null };
sourceContext.window = sourceContext;
vm.createContext(sourceContext);
for (const file of ["data/word-dictionaries.js", "data/questions.js", "data/monsters.js", "data/m004.js"])
  vm.runInContext(read(file), sourceContext, { filename: file });
const monster = sourceContext.MonsterDatabase.get("m004");
assert.deepEqual(Array.from(sourceContext.WordDictionaryDatabase.get("face-parts.v1").entries, x => x.canonical),
  ["eyes", "nose", "mouth", "ears"]);
assert.equal(monster.battle.requiredUniqueAnswers, 4);
assert.deepEqual(Array.from(monster.battle.layerAnswers && Object.keys(monster.battle.layerAnswers)),
  ["eyes", "nose", "mouth", "ears"]);

console.log("m004 Presentation Polish V1: PASS");
