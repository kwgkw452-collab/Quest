"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manager = read("engine/managers/audio-manager.js");

assert(manager.includes('TRACE_VERSION = "iphone-audio-lifecycle-trace-v1"'));
for (const field of [
  "voiceAssetId", "characterId", "voicePath", "audioPath", "audioContext", "htmlAudio",
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
for (const lineLabel of ["Runtime: ", "CTX: ", "PAGE: ", "BGM: ", "MOTIF: ", "VOICE: ", "COUNT: all=", "EVENT LOG"])
  assert(manager.includes(`\"${lineLabel}`), `missing live audio line: ${lineLabel}`);
for (const combinedLabel of ["ORIENT: ", "GESTURE: ", "RESUME: "])
  assert(manager.includes(combinedLabel), `missing combined live audio label: ${combinedLabel}`);
for (const metricLabel of [
  "instanceId", "src", "paused", "fallback", "baseGain", "trackGain", "busGain", "masterGain",
  "effectiveGain", "sameSourceMax", "bgmPlaying", "motifs"
]) assert(manager.includes(metricLabel), `missing live metric: ${metricLabel}`);
assert(manager.includes("setInterval(renderVoiceRuntimeTracePanel, 250)"));
for (const latchedField of [
  "playingSeen", "contextState", "graphConnected", "sourceCreated", "fallback",
  "characterGain", "processingGain", "voiceBusGain", "masterGain",
  "maxPeak", "maxRms", "lastPlayingCurrentTime"
]) assert(manager.includes(latchedField), `missing latched field: ${latchedField}`);
assert(manager.includes("return Math.max(current, value)"));
assert(manager.includes('event === "playing"'));
assert(manager.includes("latched: function () { return voiceRuntimeTraceState.latched; }"));

// Trace remains enabled while the two confirmed audio regressions are fixed.
assert(manager.includes('profile.ratio === undefined ? 0.18 : Number(profile.ratio)'));
assert(!manager.includes('replacement.volume = 1'));
assert(manager.includes('bgm.paused === true || bgm.ended === true'));
assert(manager.includes('pendingBgm && pendingBgm.audio === bgm'));
assert(manager.includes('FALLBACK_GAIN_UNAVAILABLE'));
assert(manager.includes('action: "safe-suppress"'));

for (const page of ["index.html", "dev.html"]) {
  const html = read(page);
  assert(html.includes("engine/managers/audio-manager.js?v=gainnode-confirmed-regression-fix-v1"), `${page}: runtime cache version`);
}

console.log("GainNode iPhone Runtime Trace V1: PASS");
