"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const json = relative => JSON.parse(read(relative));
const index = json("production/voice/voice-production-index.json");
const allEntries = index.entryFiles.flatMap(file => json(file).entries);
const entries = json("production/voice/entries/s001.json").entries;
const expectedKeys = [
  "voice_c02_s001_001",
  "voice_c02_s001_002",
  "voice_c02_s001_003",
  "voice_c02_s001_005"
];

assert.strictEqual(allEntries.length, 116, "Production DB must contain the existing 111 plus m004 five entries");
assert.strictEqual(entries.length, 4, "S001 Kong fixed Dialogue must be four entries");
assert.deepStrictEqual(entries.map(entry => entry.voiceKey), expectedKeys);
assert(!allEntries.some(entry => entry.voiceKey === "voice_c02_s001_004"), "dynamic playerName entry must remain excluded");

const audioContext = { window: {} };
audioContext.window = audioContext;
vm.createContext(audioContext);
vm.runInContext(read("data/audio.js"), audioContext);

for (const entry of entries) {
  assert.strictEqual(audioContext.AudioDatabase.voice[entry.voiceKey], entry.runtimeFile);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(audioContext.AudioDatabase.assets[entry.voiceKey])),
    {
      file: entry.runtimeFile,
      category: "VOICE",
      loop: false,
      version: "1",
      licenseRef: "production/voice/licenses/elevenlabs-license-record.json"
    }
  );
  const file = path.join(root, entry.runtimeFile);
  assert(fs.existsSync(file), `missing runtimeFile: ${entry.runtimeFile}`);
  assert(fs.statSync(file).size > 0, `empty runtimeFile: ${entry.runtimeFile}`);
}

const s001 = read("engine/stories/S001.js");
for (const entry of entries) {
  assert(s001.includes(JSON.stringify(entry.dialogueText)), `Story text mismatch: ${entry.voiceKey}`);
  assert.strictEqual((s001.match(new RegExp(entry.voiceKey, "g")) || []).length, 1, `Story connection mismatch: ${entry.voiceKey}`);
}
const dynamicLine = s001.split("\n").find(line => line.includes("state.playerName"));
assert(dynamicLine, "dynamic playerName Dialogue must exist");
assert(!dynamicLine.includes("voiceKey"), "dynamic playerName Dialogue must not be connected");

const connectedStoryFiles = fs.readdirSync(path.join(root, "engine/stories"))
  .filter(file => file.endsWith(".js") && read("engine/stories/" + file).includes("voiceKey"));
assert.deepStrictEqual(connectedStoryFiles.sort(), ["S001.js", "S002.js", "S004.js", "m001.js", "m004.js", "story-saki-departure.js"], "Only approved Story files may contain Voice connections");

console.log("S001 Kong Voice Production V1 tests: PASS");
