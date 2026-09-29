"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const storyFiles = [
  "engine/stories/m001.js",
  "engine/stories/S003.js"
];

storyFiles.forEach(file => {
  assert(!/C\.bgm\(|C\.stopBgm\(/.test(read(file)), `${file} must not use always-on Story BGM`);
});

const s001 = read("engine/stories/S001.js");
assert(!/C\.bgm\((?!"morningGardenAtmosphere"|"zephyrFields"|"kongEmotionalSilentTears")/.test(s001),
  "S001 may only use its approved scene-limited Audio");

const s004 = read("engine/stories/S004.js");
assert(!/I did it! The food is ready![\s\S]{0,260}C\.se\("zephyrSuccess"/.test(s004),
  "Cooking must not turn SUCCESS into recurring background punctuation");
const companionIndex = s004.indexOf("C.addCompanion(4)");
const goIndex = s004.indexOf('C.se("zephyrGo"');
const battleIndex = s004.indexOf('C.monsterBattle("m003"');
const victoryIndex = s004.indexOf('C.se("zephyrVictory"');
assert.strictEqual(goIndex, -1, "S004 must not play GO before the Season Monster");
assert(companionIndex < battleIndex);
assert.strictEqual(victoryIndex, -1, "m003 owns VICTORY before its recovery dialogue");

const s002 = read("engine/stories/S002.js");
assert(!/C\.bgm\((?!"futureCityPixel")/.test(s002),
  "S002 may only use its scene-limited Future City music");
assert(!/zephyrGo/.test(s002), "Camp entry must not use GO");
const departure = read("engine/stories/story-saki-departure.js");
assert.strictEqual((departure.match(/C\.se\("zephyrGo"/g) || []).length, 1,
  "GO must remain only at the actual post-farewell departure");

const campSources = ["engine/managers/camp-manager.js", "data/camps.js"]
  .filter(file => fs.existsSync(path.join(root, file)))
  .map(read).join("\n");
assert(!/zephyrGo/.test(campSources), "Camp must not use GO as BGM or ambience");

const questionManager = read("engine/managers/question-manager.js");
assert(questionManager.indexOf("silenceGameAudio();") < questionManager.indexOf("GameCore.speechMission({"),
  "Game audio must stop before speech recognition begins");

console.log("Unified Audio Director regression test: PASS");
