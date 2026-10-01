"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const audios = [];
const gestures = {};
let contextCount = 0;
let resumeCount = 0;
class FakeAudio {
  constructor(src) { this.src = src || ""; this.volume = 1; this.paused = true; this.listeners = {}; audios.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  getAttribute(name) { return name === "src" ? this.src : null; }
  emit(name) { if (this.listeners[name]) this.listeners[name](); }
}
class FakeNode {
  constructor() { this.gain = { value: 0 }; this.frequency = { value: 0 }; this.Q = { value: 0 }; this.threshold = { value: 0 }; this.knee = { value: 0 }; this.ratio = { value: 0 }; this.attack = { value: 0 }; this.release = { value: 0 }; }
  connect() { return this; }
  disconnect() {}
}
class FakeContext {
  constructor() { contextCount += 1; this.state = "suspended"; this.destination = new FakeNode(); }
  resume() { resumeCount += 1; this.state = "running"; return Promise.resolve(); }
  createMediaElementSource() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
}
const c = {
  console, Promise, Float32Array, Date, Math, Audio: FakeAudio, AudioContext: FakeContext,
  setTimeout(fn) { fn(); },
  document: {
    addEventListener(name, fn) { gestures[name] = fn; },
    removeEventListener(name) { delete gestures[name]; }
  },
  AssetManager: { audio(type, key) { return type + ":" + key; } },
  AudioDatabase: { assets: {} }
};
c.window = c;
vm.createContext(c);
vm.runInContext(read("data/audio-mix-profile.js"), c);
c.AudioMixProfile.ducking.dialogueVoice.duckMs = 0;
c.AudioMixProfile.ducking.dialogueVoice.restoreMs = 0;
vm.runInContext(read("engine/managers/audio-manager.js"), c);

(async () => {
  assert.equal(typeof gestures.click, "function");
  gestures.click();
  await c.AudioManager.unlock();
  await c.AudioManager.unlock();
  assert.equal(contextCount, 1, "one canonical AudioContext");
  assert.equal(resumeCount, 1, "unlock/resume is not duplicated");
  assert.strictEqual(c.AudioManager.getAudioContext(), c.AudioManager.getAudioContext());

  const crowd = c.AudioManager.playBgm("bazaarCrowd", { volume: 0.55 });
  assert.equal(crowd.volume, 0.18150000000000002, "Bazaar crowd effective volume");

  for (const key of ["voice_c01_s001_001", "voice_c02_s001_001", "voice_c03_s002_001", "voice_c04_s004_001"]) {
    const tracked = c.DialogueVoiceAudioInternal.play(key, { volume: 1 });
    await Promise.resolve();
    assert.equal(crowd.volume, 0.063525, key + " ducks BGM");
    tracked.audio.emit("ended");
    await tracked.completion;
    assert.equal(crowd.volume, 0.18150000000000002, key + " restores BGM");
    assert.strictEqual(c.AudioManager.getAudioContext(), c.AudioManager.getAudioContext());
  }
  assert.equal(contextCount, 1, "Kong and Bernie reuse one context");

  const interrupted = c.DialogueVoiceAudioInternal.play("voice_c01_s001_001", { volume: 1 });
  assert.equal(crowd.volume, 0.063525);
  c.DialogueVoiceAudioInternal.stop();
  await interrupted.completion;
  assert.equal(crowd.volume, 0.18150000000000002, "stop restores BGM");

  const unrelated = c.AudioManager.playBgm("futureCityPixel", { volume: 0.30 });
  assert.equal(unrelated.volume, 0.30, "unconfigured BGM gain is unchanged");
  console.log("Mobile Audio Foundation Fix V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
