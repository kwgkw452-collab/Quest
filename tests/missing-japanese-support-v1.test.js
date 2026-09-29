"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);

for (const file of [
  "engine/commands/story-commands.js", "engine/core/story-registry.js",
  "engine/stories/S001.js", "engine/stories/S002.js", "engine/stories/S004.js", "engine/stories/m001.js",
  "engine/stories/story-saki-departure.js", "data/monsters.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

function flatten(steps, output = []) {
  for (const step of steps || []) {
    output.push(step);
    flatten(step.steps, output);
    flatten(step.thenSteps, output);
    flatten(step.elseSteps, output);
  }
  return output;
}

const rows = [];
for (const id of ["S001", "S002", "S004", "st004", "m001"]) {
  for (const step of flatten(context.StoryRegistry.get(id).steps)) {
    if (step.type === "dialogue" && step.voiceKey) rows.push({ sourceId: id, ...step });
  }
}
for (const step of context.MonsterDatabase.get("m003").battle.completionDialogue) {
  if (step.voiceKey) rows.push({ sourceId: "m003", ...step });
}

assert.strictEqual(rows.length, 111, "all fixed Voice Dialogues must remain registered");
assert.strictEqual(new Set(rows.map(row => row.voiceKey)).size, 111, "voiceKey values must remain unique");
assert.strictEqual(rows.filter(row => typeof row.supportText === "string" && row.supportText.trim()).length, 111,
  "all fixed Voice Dialogues must have Japanese supportText");
assert.strictEqual(rows.filter(row => !row.supportText || !row.supportText.trim()).length, 0,
  "supportText must have no empty entries");

const season = rows.filter(row => row.sourceId === "m003");
assert.strictEqual(season.length, 9);
assert.strictEqual(season.filter(row => row.supportText && row.supportText.trim()).length, 9,
  "Season Tree Voice Dialogue support must be 9/9");

const byKey = Object.fromEntries(rows.map(row => [row.voiceKey, row]));
const fixed = {
  voice_c02_s001_005: "我が友よ！行こうぜ！",
  voice_c07_st004_001: "10ゴールドです。",
  voice_c02_st004_006: "10ゴールド！？",
  voice_c09_st004_001: "夜の砂漠では、青い光が見えるよ。",
  voice_c01_st004_003: "なにピコ？",
  voice_c03_st004_013: "さよならじゃないよ。",
  voice_c03_st004_014: "またね、マスター！",
  voice_c03_st004_016: "さようなら！",
  voice_c03_st004_018: "さようなら、マスター！"
};
for (const [voiceKey, supportText] of Object.entries(fixed)) {
  assert.strictEqual(byKey[voiceKey].supportText, supportText, voiceKey);
}

console.log("Missing Japanese Support V1: 111/111 PASS");
