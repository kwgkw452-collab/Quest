"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const audios = [];
const nodes = [];

class FakeAudio {
  constructor(src) {
    this.src = src || "";
    this.volume = 1;
    this.paused = true;
    this.listeners = {};
    audios.push(this);
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  getAttribute(name) { return name === "src" ? this.src : null; }
  emit(name) { (this.listeners[name] || []).slice().forEach(fn => fn()); }
}

class FakeNode {
  constructor(kind) {
    this.kind = kind;
    this.gain = { value: 0 };
    this.frequency = { value: 0 };
    this.Q = { value: 0 };
    this.threshold = { value: 0 };
    this.knee = { value: 0 };
    this.ratio = { value: 0 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
    nodes.push(this);
  }
  connect() { return this; }
  disconnect() {}
}

class FakeContext {
  constructor() { this.state = "running"; this.destination = new FakeNode("destination"); }
  resume() { this.state = "running"; return Promise.resolve(); }
  createMediaElementSource() { return new FakeNode("source"); }
  createGain() { return new FakeNode("gain"); }
  createDynamicsCompressor() { return new FakeNode("compressor"); }
  createBiquadFilter() { return new FakeNode("filter"); }
  createWaveShaper() { return new FakeNode("waveshaper"); }
}

const context = {
  console, Promise, Float32Array, Date, Math,
  Audio: FakeAudio,
  AudioContext: FakeContext,
  setTimeout(fn) { fn(); },
  document: { addEventListener() {}, removeEventListener() {} },
  AssetManager: { audio(type, key) { return `${type}:${key}`; } },
  AudioDatabase: {
    assets: {
      zephyrFriendship: { file: "audio/jingle/zephyr.mp3", category: "MOTIF" }
    }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio-mix-profile.js"), context);
vm.runInContext(read("data/voice-profiles.js"), context);
context.AudioMixProfile.ducking.dialogueVoice.duckMs = 0;
context.AudioMixProfile.ducking.dialogueVoice.restoreMs = 0;
vm.runInContext(read("engine/managers/audio-manager.js"), context);

const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual}`);

(async () => {
  assert.equal(context.AudioMixProfile.ducking.dialogueVoice.ratio, 0.18);
  assert.equal(context.AudioMixProfile.oneShots.MOTIF.dialogueRatio, 0.12);
  assert.equal(context.VoiceProfileDatabase.resolveGain("voice_c01_s002_001"), 1.0, "Pico correction");
  assert.equal(context.VoiceProfileDatabase.resolveGain("voice_c02_s001_001"), 0.82, "Kong correction");
  assert.equal(context.VoiceProfileDatabase.resolveGain("voice_c03_s002_001"), 1.0, "Saki correction");
  assert.equal(context.VoiceProfileDatabase.resolveGain("voice_c04_s004_001"), 0.82, "Bernie correction");
  assert.equal(context.VoiceProfileDatabase.resolveGain("voice_c05_m003_001"), 1.0, "Season Tree correction");
  assert.equal(context.VoiceProfileDatabase.resolveGain("voice_c06_st004_001"), 1.0, "NPC correction");

  const future = context.AudioManager.playBgm("futureCityPixel", { volume: 0.30 });
  const motif = context.AudioManager.playSe("zephyrFriendship", { volume: 0.27 });
  const tree = context.DialogueVoiceAudioInternal.play("voice_c05_m003_001", { volume: 1.0 });
  assert.equal(future.volume, 1, "BGM HTMLAudio stays unity");
  assert.equal(motif.volume, 1, "Motif HTMLAudio stays unity");
  close(context.AudioManager.getState().effectiveBgmVolume, 0.054, "BGM final GainNode gain");
  close(motif.__eigoGainNode.gain.value * context.AudioManager.getState().busGains.motif, 0.0324, "Motif final GainNode gain");
  assert.equal(context.AudioManager.getState().duckState.dialogueOwners, 1);
  tree.audio.emit("ended");
  await tree.completion;
  close(context.AudioManager.getState().effectiveBgmVolume, 0.30, "BGM restore");
  close(motif.__eigoGainNode.gain.value * context.AudioManager.getState().busGains.motif, 0.27, "Motif restore");

  const beforeKongNodes = nodes.length;
  const kong = context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", { volume: 0.82 });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(kong.audio.volume, 1);
  close(kong.audio.__eigoCharacterGainNode.gain.value, 0.82, "Kong Character GainNode");
  close(context.AudioManager.getState().effectiveBgmVolume, 0.054, "S001 Kong BGM duck");
  assert(nodes.slice(beforeKongNodes).some(node => node.kind === "gain" && node.gain.value === 1.10),
    "Kong processing uses calibrated central gain");
  kong.audio.emit("ended");
  await kong.completion;
  close(context.AudioManager.getState().effectiveBgmVolume, 0.30, "Kong BGM restore");

  const bernie = context.DialogueVoiceAudioInternal.play("voice_c04_s004_001", { volume: 0.82 });
  await Promise.resolve();
  assert.equal(bernie.audio.volume, 1);
  close(bernie.audio.__eigoCharacterGainNode.gain.value, 0.82, "Bernie Character GainNode");
  close(context.AudioManager.getState().effectiveBgmVolume, 0.054, "Bernie BGM duck");
  bernie.audio.emit("ended");
  await bernie.completion;
  close(context.AudioManager.getState().effectiveBgmVolume, 0.30, "Bernie BGM restore");

  const beforeRadioNodes = nodes.length;
  const radio = context.DialogueVoiceAudioInternal.play("voice_c03_st004_010", {
    volume: 1.0,
    voiceEffect: "radio"
  });
  await Promise.resolve();
  await Promise.resolve();
  const radioNodes = nodes.slice(beforeRadioNodes);
  assert(radioNodes.some(node => node.kind === "filter" && node.frequency.value === 1700 && node.gain.value === 4),
    "radio presence is calibrated");
  assert(radioNodes.some(node => node.kind === "gain" && node.gain.value === 0.72),
    "radio output gain is calibrated");
  assert.equal(radio.audio.volume, 1.0);
  radio.audio.emit("ended");
  await radio.completion;

  for (const page of ["index.html", "dev.html"]) {
    const html = read(page);
    assert.match(html, /data\/audio-mix-profile\.js\?v=audio-gainnode-unification-v1/);
    assert.match(html, /data\/voice-profiles\.js\?v=audio-gainnode-unification-v1/);
    const audioManagerVersion = page === "index.html" ? "iphone-speech-audio-restore-timing-ab-v1" : "gainnode-confirmed-regression-fix-v1";
    assert(html.includes(`engine/managers/audio-manager.js?v=${audioManagerVersion}`));
  }

  const manager = read("engine/managers/audio-manager.js");
  assert(manager.includes("useFreshHtmlAudioFallback"), "Voice Reliability fallback remains present");
  assert(read("engine/services/m004-battle-extension.js").includes('yes: "ears"'));
  console.log("Audio Mix & Duck Calibration V1: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
