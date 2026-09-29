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
vm.runInContext(read("data/audio.js"), context);

const expectedAudio = {
  morningGardenAtmosphere: "audio/ambient/ambient_morning_garden_v2.mp3",
  futureCityPixel: "audio/bgm/bgm_future_city_pixel_v1.mp3",
  monsterDefeatExplosion: "audio/se/se_monster_defeat_explosion_v1.mp3"
};
assert.strictEqual(context.AudioDatabase.bgm.morningGardenAtmosphere, expectedAudio.morningGardenAtmosphere);
assert.strictEqual(context.AudioDatabase.bgm.futureCityPixel, expectedAudio.futureCityPixel);
assert.strictEqual(context.AudioDatabase.se.monsterDefeatExplosion, expectedAudio.monsterDefeatExplosion);
Object.values(expectedAudio).forEach(file => {
  const fullPath = path.join(root, file);
  assert(fs.existsSync(fullPath), `Audio asset must exist: ${file}`);
  assert(fs.statSync(fullPath).size > 0, `Audio asset must not be empty: ${file}`);
});

const s001 = read("engine/stories/S001.js");
assert.strictEqual((s001.match(/C\.bgm\("morningGardenAtmosphere", \{ loop: true, volume: 1\.00, fadeInMs: 700 \}\)/g) || []).length, 1);
assert(s001.indexOf('C.background("morningRoom")') < s001.indexOf('C.bgm("morningGardenAtmosphere"'));
assert(s001.indexOf('C.bgm("zephyrFields"') < s001.indexOf('C.backgroundSequence(["city", "suburb", "country", "forest"])'));
const kongStop = s001.indexOf("C.stopBgm({ fadeOutMs: 500 })", s001.indexOf('C.question("word.hello")'));
const kongSe = s001.indexOf('C.se("kongEntrance"');
const kongGraphic = s001.indexOf('{ id: "kong"');
const kongRestart = s001.indexOf('C.bgm("morningGardenAtmosphere"', kongGraphic);
assert(kongStop < kongSe && kongSe < kongGraphic);
assert.strictEqual(kongRestart, -1, "Forest birds must remain stopped throughout Kong's emotional scene");
assert.strictEqual((s001.match(/C\.se\("kongEntrance"/g) || []).length, 1);
assert.strictEqual(s001.indexOf('C.bgm("morningGardenAtmosphere"', kongGraphic), -1,
  "Forest birds must not restart during Kong's emotional scene");
assert(s001.lastIndexOf("C.stopBgm") < s001.indexOf('C.camp("CAMP_001")'));

const morning = read("engine/managers/morning-manager.js");
const brightComplete = morning.indexOf("await EffectManager.play(morning.startEffect.key, morning.startEffect.ms)");
const morningStart = morning.indexOf('AudioManager.playBgm("morningGardenAtmosphere", { loop: true, volume: 0.85, fadeInMs: 700 })');
const morningStop = morning.indexOf("AudioManager.stopAll()", morningStart);
const morningHear = morning.indexOf("var heard = await", morningStop);
assert(brightComplete < morningStart && morningStart < morningStop && morningStop < morningHear);
assert(morning.includes('typeof AudioManager.stopBgm === "function"'));

const s002 = read("engine/stories/S002.js");
assert.strictEqual((s002.match(/C\.bgm\("futureCityPixel"/g) || []).length, 2);
assert(s002.indexOf('C.travelTransition("s002FutureCityOverview")') < s002.indexOf('C.bgm("futureCityPixel"'));
const itsOk = s002.indexOf('C.question("phrase.its_ok"');
assert(itsOk !== -1 && s002.indexOf('C.bgm("futureCityPixel"', itsOk) > itsOk,
  "phrase.its_ok must explicitly restart Future City music for the continuing scene");
["phrase.yes_can_hear_you", "phrase.come_with_me"].forEach(id => {
  const question = s002.indexOf(`C.question("${id}"`);
  const nextQuestion = s002.indexOf("C.question(", question + 1);
  const sectionEnd = nextQuestion === -1 ? s002.indexOf('C.camp("CAMP_S002"', question) : nextQuestion;
  const restart = s002.indexOf('C.bgm("futureCityPixel"', question);
  assert(question !== -1 && (restart === -1 || restart > sectionEnd), `${id} must not briefly restart Future City music`);
});
assert(s002.lastIndexOf("C.stopBgm") < s002.indexOf('C.camp("CAMP_S002"'));
assert(!/zephyrGo/.test(s002));

const monsters = read("data/monsters.js");
assert(/monsterId: "m001"[\s\S]*?playPurifySe: false,[\s\S]*?defeatSe: "monsterDefeatExplosion",[\s\S]*?defeatSeVolume: 0\.45/.test(monsters));
assert(!/monsterId: "m002"[\s\S]*?defeatSe:/.test(monsters.split('monsterId: "m003"')[0].split('monsterId: "m002"')[1] || ""));
const battle = read("engine/managers/monster-battle-manager.js");
const explosionGraphic = battle.indexOf('showGraphic(monster, "purify", null)');
const explosionSe = battle.indexOf("playDefeatAudio(monster)", explosionGraphic);
const purifySe = battle.indexOf("playPurifyAudio(monster)", explosionGraphic);
assert(explosionGraphic < explosionSe && explosionSe < purifySe);

const phase2 = read("tests/audio-director-playtest-phase2.test.js");
assert(phase2.includes("top: 25%") && phase2.includes("top: 24%"));
assert(fs.existsSync(path.join(root, "licenses/AUDIO_ADDITIONS_V1_MANIFEST.md")));

console.log("Audio Additions V1 regression test: PASS");
