"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const s001 = read("engine/stories/S001.js");
const s002 = read("engine/stories/S002.js");
const s004 = read("engine/stories/S004.js");
const st004 = read("engine/stories/story-saki-departure.js");
assert.strictEqual((s001.match(/C\.se\("kongEntrance"/g) || []).length, 1);
assert(s001.indexOf('C.question("word.hello")') < s001.indexOf('C.se("kongEntrance"'),
  "Kong Entrance must not be cut off by the preceding speech-recognition stopAll");
assert(s001.indexOf('C.se("kongEntrance"') < s001.indexOf('{ id: "kong"'),
  "Kong Entrance must play immediately before Kong is revealed");
assert(!/zephyrGo/.test(s002));
assert(!/zephyrGo/.test(s004));
assert.strictEqual((st004.match(/C\.se\("zephyrGo"/g) || []).length, 1);
assert.strictEqual((st004.match(/C\.se\("mysteryShopSting"/g) || []).length, 1);

const monsters = read("data/monsters.js");
assert(/monsterId: "m001"[\s\S]*?explosion:[\s\S]*?playPurifySe: false/.test(monsters));
assert(/monsterId: "m002"[\s\S]*?purify:[\s\S]*?playPurifySe: true/.test(monsters));
assert(/monsterId: "m003"[\s\S]*?restored:[\s\S]*?playPurifySe: true/.test(monsters));

const css = read("css/style.css");
assert(css.includes('top: 25%;'));
assert(css.includes('top: 24%;'));
assert(css.includes('s004_map_key_choice_final.png'));

const question = read("engine/managers/question-manager.js");
assert(question.indexOf("silenceGameAudio();") < question.indexOf("GameCore.speechMission({"));

console.log("Audio Director Playtest Phase 2 regression test: PASS");
