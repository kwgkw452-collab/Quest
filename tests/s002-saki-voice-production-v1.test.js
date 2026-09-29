"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const json = relative => JSON.parse(read(relative));
const index = json("production/voice/voice-production-index.json");
const entries = index.entryFiles.flatMap(file => json(file).entries);
const saki = entries.filter(entry => entry.characterName === "Saki" && entry.dialogueType === "fixed");

assert.strictEqual(entries.length, 116, "Production DB must contain the existing 111 plus m004 five entries");
assert.strictEqual(saki.length, 28, "Saki fixed Dialogue inventory must contain 28 entries");
assert.strictEqual(new Set(saki.map(entry => entry.voiceKey)).size, 28);

const audioContext = { window: {} };
audioContext.window = audioContext;
vm.createContext(audioContext);
vm.runInContext(read("data/audio.js"), audioContext);

const sourceFiles = new Map([
  ["S002", "engine/stories/S002.js"],
  ["S004", "engine/stories/S004.js"],
  ["st004", "engine/stories/story-saki-departure.js"]
]);

for (const entry of saki) {
  assert.strictEqual(audioContext.AudioDatabase.voice[entry.voiceKey], entry.runtimeFile);
  const asset = JSON.parse(JSON.stringify(audioContext.AudioDatabase.assets[entry.voiceKey]));
  assert.deepStrictEqual(asset, {
    file: entry.runtimeFile,
    category: "VOICE",
    loop: false,
    version: "1",
    licenseRef: "production/voice/licenses/elevenlabs-license-record.json"
  });
  const runtimeFile = path.join(root, entry.runtimeFile);
  assert(fs.existsSync(runtimeFile), `missing runtimeFile: ${entry.runtimeFile}`);
  assert(fs.statSync(runtimeFile).size > 0, `empty runtimeFile: ${entry.runtimeFile}`);
  const source = read(sourceFiles.get(entry.sourceId));
  assert(source.includes(JSON.stringify(entry.dialogueText)), `Story text mismatch: ${entry.voiceKey}`);
  assert.strictEqual((source.match(new RegExp(entry.voiceKey, "g")) || []).length, 1, `Story connection mismatch: ${entry.voiceKey}`);
}

const sakiKeys = new Set(saki.map(entry => entry.voiceKey));
const connectedKeys = [];
for (const file of fs.readdirSync(path.join(root, "engine/stories")).filter(file => file.endsWith(".js"))) {
  for (const match of read("engine/stories/" + file).matchAll(/voiceKey:\s*"([^"]+)"/g)) connectedKeys.push(match[1]);
}
const newNonSakiKeys = connectedKeys.filter(key => key.startsWith("voice_c03_") && !sakiKeys.has(key));
assert.deepStrictEqual(newNonSakiKeys, [], "No non-inventory Saki connection is permitted");
assert.strictEqual(connectedKeys.filter(key => sakiKeys.has(key)).length, 28);
const otherApprovedKeys = connectedKeys.filter(key => !sakiKeys.has(key));
assert.strictEqual(otherApprovedKeys.length, 76);
assert(otherApprovedKeys.every(key => !key.startsWith("voice_c03_")));

console.log("S002 Saki Voice Production V1 tests: PASS");
