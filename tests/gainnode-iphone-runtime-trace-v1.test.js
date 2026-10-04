"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manager = read("engine/managers/audio-manager.js");

assert(manager.includes('TRACE_VERSION = "gainnode-iphone-runtime-trace-panel-fix-v1"'));
for (const field of [
  "voiceAssetId", "characterId", "voicePath", "audioContext", "htmlAudio",
  "mediaElementSourceCreated", "sourceConnected", "destinationConnected",
  "characterGain", "processingGain", "voiceBusGain", "masterGain",
  "theoreticalPreLimiterGain", "signalPeak", "signalRms"
]) assert(manager.includes(field), `missing trace field: ${field}`);

for (const event of [
  "enterDialogueVoiceMode", "media-element-source-created", "graph-connected",
  "play-call", "playing", "timeupdate", "ended", "error", "exitDialogueVoiceMode"
]) assert(manager.includes(`\"${event}\"`), `missing lifecycle event: ${event}`);

assert(manager.includes('query.get("audioTrace") === "1"'));
assert(manager.includes('query.get("gainNodeTrace") === "1"'));
assert(manager.includes('id = "gainnode-runtime-trace-panel"'));
assert(manager.includes("top:max(4px,env(safe-area-inset-top))"));
assert(manager.includes("pointer-events:none"));
assert(manager.includes("z-index:2147483647"));
assert(!manager.includes("pointer-events:auto"));

// Trace build must preserve the known runtime values and known regressions unchanged.
assert(manager.includes('profile.ratio === undefined ? 0.18 : Number(profile.ratio)'));
assert(manager.includes('replacement.volume = 1'));
assert(manager.includes('bgm.getAttribute("src") === path)'));
assert(!manager.includes('bgm.getAttribute("src") === path && !bgm.paused'));

for (const page of ["index.html", "dev.html"]) {
  const html = read(page);
  assert(html.includes("engine/managers/audio-manager.js?v=gainnode-iphone-runtime-trace-panel-fix-v1"), `${page}: trace runtime cache version`);
}

console.log("GainNode iPhone Runtime Trace V1: PASS");
