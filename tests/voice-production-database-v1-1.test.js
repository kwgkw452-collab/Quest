"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const json = relative => JSON.parse(read(relative));
const sha256 = text => crypto.createHash("sha256").update(text, "utf8").digest("hex");

const indexPath = "production/voice/voice-production-index.json";
assert(fs.existsSync(path.join(root, indexPath)), "Production index must exist");
const index = json(indexPath);
const entries = index.entryFiles.flatMap(file => json(file).entries);

const expectedKeys = [
  "voice_c01_s002_001",
  "voice_c01_s002_002",
  "voice_c01_s002_003",
  "voice_c02_s001_001",
  "voice_c02_s001_002",
  "voice_c02_s001_003",
  "voice_c03_s002_001",
  "voice_c03_s002_003",
  "voice_c03_st004_013",
  "voice_c04_s004_003",
  "voice_c04_s004_009",
  "voice_c04_s004_010"
];
assert.strictEqual(index.entryCount, 116);
assert.strictEqual(entries.length, 116);
assert.strictEqual(new Set(entries.map(entry => entry.voiceKey)).size, 116);
assert(expectedKeys.every(key => entries.some(entry => entry.voiceKey === key)), "All 12 V1.1 entries must be preserved");
assert.deepStrictEqual(index.usedVoiceKeys.slice().sort(), entries.map(entry => entry.voiceKey).sort());
assert(!entries.some(entry => entry.voiceKey === "voice_c02_s001_004"), "Dynamic playerName dialogue must stay excluded");
assert.strictEqual(index.existingEntryCount, 12);
assert.strictEqual(index.addedEntryCount, 104);
assert.strictEqual(index.dynamicExcludedCount, 1);
assert.deepStrictEqual(index.storyCounts, { "001": 7, "002": 17, "003": 32, "004": 55, "005": 5 });
assert.deepStrictEqual(index.sourceCounts, { "S001": 4, "m001": 3, "S002": 17, "S004": 23, "m003-completion": 9, "st004": 55, "m004": 5 });

const profiles = json(index.characterProfileFile);
const expectedVoices = {
  c01: "XJ2fW4ybq7HouelYYGcL",
  c02: "6kvJeRKXugeztFfd9EVP",
  c03: "iukn3a1vSSNFmdi5NZS4",
  c04: "6IwYbsNENZgAB1dtBZDp",
  c05: "6sFKzaJr574YWVu4UuJF",
  c06: "WKtSiwnucIJgM5cTHARA",
  c07: "AFkIMdmeB0MMrr1tgGds",
  c08: "TX3LPaxmHKxFdv7VOQHJ",
  c09: "cgSgspJ2msm6clMCkdW9",
  c10: "TX3LPaxmHKxFdv7VOQHJ",
  c11: "Xb7hH8MSUJpSbSDYk0k2",
  c12: "Xb7hH8MSUJpSbSDYk0k2",
  c13: "hU9xpIwLBrQ7ueYNjP7b",
  c14: "yK2Ny0mq8WplixhD1td3"
};
const expectedSpeeds = {
  c01: 0.80, c02: 1.00, c03: 1.00, c04: 1.00,
  c05: 1.00, c06: 1.00, c07: 1.00,
  c08: 0.95, c09: 0.95, c10: 0.95, c11: 0.95, c12: 0.95, c13: 1.00, c14: 0.90
};
for (const [code, voiceId] of Object.entries(expectedVoices)) {
  assert.strictEqual(profiles.profiles[code].voiceId, voiceId);
  assert.strictEqual(profiles.profiles[code].modelLabel, "Eleven v3");
  assert.strictEqual(profiles.profiles[code].modelId, "eleven_v3");
  assert.strictEqual(profiles.profiles[code].provider, "elevenlabs");
  assert.strictEqual(profiles.profiles[code].languageCode, "en");
  assert.strictEqual(profiles.profiles[code].outputFormat, "mp3_44100_128");
  assert.strictEqual(profiles.profiles[code].voiceSettings.speed, expectedSpeeds[code]);
  assert.strictEqual(profiles.profiles[code].voiceSettings.gain, 1.00);
}

const speeds = json(index.speedProfileFile);
assert.strictEqual(Object.keys(speeds.profiles).length, 12);
for (const profile of Object.values(speeds.profiles)) {
  assert.strictEqual(profile.status, "approved");
  assert.notStrictEqual(profile.speed, null);
  assert.strictEqual(profile.gain, 1.00);
}

for (const entry of entries) {
  assert.strictEqual(entry.provider, "elevenlabs");
  assert.strictEqual(entry.voiceId, expectedVoices[entry.characterCode]);
  assert.strictEqual(entry.modelLabel, "Eleven v3");
  assert.strictEqual(entry.modelId, "eleven_v3");
  assert.strictEqual(entry.generationSettings.modelId, "eleven_v3");
  assert.strictEqual(entry.generationSettings.languageCode, "en");
  assert.strictEqual(entry.generationSettings.outputFormat, "mp3_44100_128");
  assert.strictEqual(entry.generationSettings.voiceSettings.speed, expectedSpeeds[entry.characterCode]);
  assert.strictEqual(entry.generationSettings.voiceSettings.gain, 1.00);
  assert.deepStrictEqual(entry.audioTags, []);
  assert.strictEqual(entry.generationText, null);
  assert.strictEqual(entry.version, 1);
  assert.strictEqual(entry.status, ["m001", "m004"].includes(entry.sourceId) ? "generated" : "planned");
  assert.strictEqual(entry.dialogueHash.algorithm, "sha256");
  assert.strictEqual(entry.dialogueHash.value, sha256(entry.dialogueText));
  assert(/^(001|002|003|004|005)$/.test(entry.storyNumber));
  assert(["S001", "S002", "S004", "m001", "m003-completion", "st004", "m004"].includes(entry.sourceId));
  assert.strictEqual(entry.dialogueType, "fixed");
  assert.strictEqual(entry.voiceEligible, true);
  assert(read(entry.sourceLocation.file).includes(JSON.stringify(entry.dialogueText)));
  assert(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(entry.dialogueText), "Pico Japanese Support must not be included");
}

const audioContext = { window: {} };
audioContext.window = audioContext;
vm.createContext(audioContext);
vm.runInContext(read("data/audio.js"), audioContext);
assert.strictEqual(Object.keys(audioContext.AudioDatabase.voice).length, 116);
assert.strictEqual(Object.values(audioContext.AudioDatabase.assets).filter(asset => asset.category === "VOICE").length, 116);

const voiceMp3 = fs.readdirSync(path.join(root, "audio"), { recursive: true })
  .filter(name => /voice.*\.mp3$/i.test(String(name)));
assert.strictEqual(voiceMp3.length, 111);

const storyFiles = fs.readdirSync(path.join(root, "engine/stories")).filter(name => name.endsWith(".js"));
assert.deepStrictEqual(storyFiles.filter(file => read("engine/stories/" + file).includes("voiceKey")).sort(), ["S001.js", "S002.js", "S004.js", "m001.js", "m004.js", "story-saki-departure.js"]);

const unchangedHashes = {
  "engine/stories/S001.js": "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1",
  "engine/stories/S002.js": "bd05226b3e51d12a27e1504579f69cd97200231a68edecd8a8d6e6b2e7aaf525",
  "engine/stories/S003.js": "e532ff803cf57398d0cd457ba118a9ec004d484af27a77e6fce81dc5da5c991c",
  "engine/stories/S004.js": "ca801b7658fe1bddf98cf8c21ee1794adf602b68afa5a7f94599758fb3437070",
  "data/audio.js": "e6c8de637d7946c9fe0107dea262a632e8fa2d703941db5169777a98bbdf4b56"
};
for (const [file, expectedHash] of Object.entries(unchangedHashes)) {
  assert.strictEqual(sha256(read(file)), expectedHash);
}

assert(read("engine/commands/story-commands.js").includes("voiceKey: options.voiceKey"));
assert(read("engine/core/story-engine.js").includes("DialogueVoiceController.play(step.voiceKey"));
assert(read("engine/services/dialogue-voice-controller.js").includes("window.DialogueVoiceController"));

console.log("Voice Production Database V2 Full 116 tests: PASS");
