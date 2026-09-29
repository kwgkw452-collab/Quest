"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const json = file => JSON.parse(read(file));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

const expected = {
  voice_c14_m004_001: ["I lost my face.", "f6166ba55ceec1ea60224c2043c390030c33ddc7e0ff9017575083c27813a1a4"],
  voice_c14_m004_002: ["Please help me.", "99020f70976f4538c2c79abc384f2bef368d3a3b9fd73bdc635739ea84f6a8e5"],
  voice_c14_m004_003: ["My face is back!", "14c788a8b8013ab9fa923c0a822255d0508ef4fd978ecebebb71f489cf4dc304"],
  voice_c14_m004_004: ["Thank you!", "f76d97a5122c6e77da7959cc271ceec4b043a654532f775f61e907654bf42c25"],
  voice_c14_m004_005: ["I'm happy now!", "7c1a1e9eff72e0c914bca7e1872aa83acd7fe3f406cfd962100103d27c68cff5"]
};
const profile = json("production/voice/character-voice-profiles.json").profiles.c14;
assert.equal(profile.voiceId, "yK2Ny0mq8WplixhD1td3");
assert.equal(profile.modelId, "eleven_v3");
assert.equal(profile.voiceSettings.speed, 0.9);
assert.equal(profile.voiceSettings.gain, 1);

const entries = json("production/voice/entries/m004.json").entries;
assert.equal(entries.length, 5);
for (const entry of entries) {
  assert.equal(entry.voiceId, profile.voiceId);
  assert.equal(entry.dialogueText, expected[entry.voiceKey][0]);
  assert(fs.statSync(path.join(root, entry.runtimeFile)).size > 0);
  assert.equal(hash(entry.runtimeFile), expected[entry.voiceKey][1]);
}

const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio.js"), context);
assert.equal(context.AudioDatabase.bgm.nocturnalBloom, "audio/bgm/bgm_nocturnal_bloom_loop_v1.mp3");
assert.equal(hash(context.AudioDatabase.bgm.nocturnalBloom), "bbea0d8eb9dd3e26fa60d64f3192266541a9f8a374d211deaebeb02103f32769");
for (const entry of entries) assert.equal(context.AudioDatabase.voice[entry.voiceKey], entry.runtimeFile);

const m004 = read("engine/stories/m004.js");
assert(m004.includes('C.bgm("nocturnalBloom"'));
assert(m004.includes('volume: 0.20'));
assert(m004.includes('preserveBgm: true'));
assert(!m004.includes('C.stopBgm('));
for (const key of Object.keys(expected).slice(0, 2)) assert(m004.includes(key));
const data = read("data/m004.js");
for (const key of Object.keys(expected).slice(2)) assert(data.includes(key));
assert(data.includes('postRecoverySe: "zephyrGo"'));
assert(!data.includes('postRecoveryBgm: "zephyrFields"'));
assert(data.includes("requiredUniqueAnswers: 4"));
console.log("m004 Audio Finalization V1: PASS");
