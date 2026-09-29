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

const expected = {
  kongEntrance: "audio/se/se_kong_entrance_v1.mp3",
  monsterWarningNormal: "audio/se/se_monster_warning_normal_v1.mp3",
  monsterWarningReveal: "audio/se/se_monster_warning_reveal_v1.mp3",
  monsterWarningCreepy: "audio/se/se_monster_warning_creepy_v1.mp3",
  battleHit: "audio/se/se_battle_hit_v1.mp3",
  battlePurify: "audio/se/se_battle_purify_v1.mp3",
  mysteryShopSting: "audio/se/se_mystery_shop_sting_v1.mp3"
};

Object.entries(expected).forEach(([key, relativePath]) => {
  assert.strictEqual(context.AudioDatabase.se[key], relativePath);
  const full = path.join(root, relativePath);
  assert(fs.existsSync(full), `${relativePath} must exist`);
  assert(fs.statSync(full).size > 0, `${relativePath} must not be empty`);
});

const ambientPath = "audio/ambient/ambient_camp_night_v1.mp3";
assert.strictEqual(context.AudioDatabase.bgm.campNightAtmosphere, ambientPath);
assert(fs.statSync(path.join(root, ambientPath)).size > 0);
assert(fs.existsSync(path.join(root, "licenses/SE_PACK_V1_MANIFEST.md")));

const battle = read("engine/managers/monster-battle-manager.js");
assert.strictEqual((battle.match(/playRegisteredAudio\(monster\.audio\.warning \|\| "monsterWarning"/g) || []).length, 1);
assert.strictEqual((battle.match(/playRegisteredAudio\("battleHit"/g) || []).length, 1);
assert.strictEqual((battle.match(/playRegisteredAudio\("battlePurify"/g) || []).length, 1);
assert.strictEqual((battle.match(/playPurifyAudio\(monster\)/g) || []).length, 5);
assert(battle.indexOf("context.acceptedAnswers.push(canonical)") < battle.indexOf("playBattleHit();"));

const monsters = read("data/monsters.js");
assert.strictEqual((monsters.match(/warning: "monsterWarningTensePiano"/g) || []).length, 2);
assert.strictEqual((monsters.match(/warning: "monsterWarningReveal"/g) || []).length, 1);
assert(/monsterId: "m001"[\s\S]*?playPurifySe: false/.test(monsters));
assert(/monsterId: "m002"[\s\S]*?playPurifySe: true/.test(monsters));
assert(/monsterId: "m003"[\s\S]*?playPurifySe: true/.test(monsters));
assert(!/warning: "monsterWarningCreepy"/.test(monsters));

const s001 = read("engine/stories/S001.js");
assert.strictEqual((s001.match(/C\.se\("kongEntrance"/g) || []).length, 1);
assert(s001.indexOf('C.se("kongEntrance"') < s001.indexOf('{ id: "kong"'));

const saki = read("engine/stories/story-saki-departure.js");
assert.strictEqual((saki.match(/C\.se\("mysteryShopSting"/g) || []).length, 1);
const shop = saki.indexOf('s004_mysterious_bazaar_shop.png');
const sting = saki.indexOf('C.se("mysteryShopSting"');
const choice = saki.indexOf('C.question("word.map_or_key"');
assert(shop < sting && sting < choice);

const camp = read("engine/managers/camp-manager.js");
assert(camp.includes('AudioManager.playBgm("campNightAtmosphere", { loop: true, volume: 0.52, fadeInMs: 700 })'));
assert(camp.includes("stopNightAtmosphere();"));
assert(!/zephyr(?:Go|Success|Victory|Entrance|Departure)/.test(camp));

const question = read("engine/managers/question-manager.js");
assert(question.indexOf("silenceGameAudio();") < question.indexOf("GameCore.speechMission({"));

console.log("SE Pack V1 integrated connection test: PASS");
