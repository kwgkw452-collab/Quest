"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

const assets = {
  m004RecoveryMagic: {
    file: "audio/se/se_m004_recovery_magic_v1.mp3",
    hash: "1c37dbd4dd14b43c844f3d786fce40df0bb1f49ed4519b7c5b4fdc0371b2ac0e"
  },
  m004CompletionFanfare: {
    file: "audio/jingle/jingle_m004_completion_fanfare_v1.mp3",
    hash: "949000c984bfb154ffd774722fdd6788be970eb220104a6184c8d19d6d8db0c3"
  }
};
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio.js"), context);
for (const [key, expected] of Object.entries(assets)) {
  assert.equal(context.AudioDatabase.se[key], expected.file);
  assert.equal(context.AudioDatabase.assets[key].file, expected.file);
  assert(fs.statSync(path.join(root, expected.file)).size > 0);
  assert.equal(hash(expected.file), expected.hash);
}

const story = read("engine/stories/m004.js");
assert(story.includes('C.bgm("nocturnalBloom", { loop: true, volume: 0.20'));
assert(story.includes('C.monsterBattle("m004", "facePartsBattle", { preserveBgm: true })'));
assert(!story.includes("C.stopBgm("));
const engine = read("engine/core/story-engine.js");
assert(engine.includes("if (!step.preserveBgm"));

const data = read("data/m004.js");
assert(data.includes('hitSe: "m004RecoveryMagic"'));
assert(data.includes('completionSe: "m004CompletionFanfare"'));
assert(data.includes("playPurifySe: false"));
assert(data.includes("stopBgmAfterCompletion: true"));
assert(data.includes("completionSeLeadMs: 6614"));
assert(data.includes('postRecoverySe: "zephyrGo"'));
assert(!data.includes('postRecoveryBgm: "zephyrFields"'));

const manager = read("engine/managers/monster-battle-manager.js");
const smile = manager.indexOf("playSuccessGraphic(monster, true, canonical)");
const fanfare = manager.indexOf("if (battleAudio.completionSe)");
const stop = manager.indexOf("if (battleAudio.stopBgmAfterCompletion");
const zephyr = manager.indexOf("if (battleAudio.postRecoverySe)");
const outro = manager.indexOf("await showCompletionDialogue(monster)");
assert(smile < fanfare && fanfare < stop && stop < zephyr && zephyr < outro);

const manifest = read("licenses/M004_FINAL_SOUND_INTEGRATION_V1_MANIFEST.md");
for (const value of ["Universfield", "u_ss015dykrt", "Pixabay Content License",
  "magic-spell-02-250240", "brass-fanfare-with-timpani-and-winchimes-reverberated-146260"])
  assert(manifest.includes(value));
console.log("m004 Final Sound Integration V1: PASS");
