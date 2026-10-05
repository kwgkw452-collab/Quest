"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const documentListeners = {};
const elements = [];
const analysers = [];

function add(store, name, listener) { (store[name] ||= []).push(listener); }
function dispatch(store, name) { (store[name] || []).slice().forEach(listener => listener({ type: name })); }

const document = {
  body: { appendChild() {} }, readyState: "complete", visibilityState: "visible", hidden: false,
  hasFocus: () => true,
  createElement(tag) {
    const node = { tag, id: "", style: {}, textContent: "", appendChild() {}, open: false };
    elements.push(node); return node;
  },
  getElementById(id) { return elements.find(node => node.id === id) || null; },
  addEventListener(name, listener) { add(documentListeners, name, listener); },
  removeEventListener(name, listener) {
    if (documentListeners[name]) documentListeners[name] = documentListeners[name].filter(item => item !== listener);
  }
};

class FakeAudio {
  constructor(src) {
    this.src = src; this.paused = true; this.ended = false; this.currentTime = 0; this.duration = 12;
    this.readyState = 4; this.networkState = 1; this.volume = 1; this.listeners = {};
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, listener) { add(this.listeners, name, listener); }
  emit(name) {
    if (name === "ended") { this.ended = true; this.paused = true; }
    dispatch(this.listeners, name);
  }
}

class FakeNode {
  constructor() {
    this.gain = { value: 0 }; this.frequency = { value: 0 }; this.Q = { value: 0 };
    this.threshold = { value: 0 }; this.knee = { value: 0 }; this.ratio = { value: 0 };
    this.attack = { value: 0 }; this.release = { value: 0 };
  }
  connect() { return this; }
  disconnect() {}
}

class FakeAnalyser extends FakeNode {
  constructor() { super(); this.fftSize = 4; this.samples = [0, 0, 0, 0]; analysers.push(this); }
  getFloatTimeDomainData(output) {
    for (let index = 0; index < output.length; index += 1) output[index] = this.samples[index % this.samples.length];
  }
}

class FakeContext {
  constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = new FakeNode(); this.listeners = {}; }
  addEventListener(name, listener) { add(this.listeners, name, listener); }
  resume() { this.state = "running"; dispatch(this.listeners, "statechange"); return Promise.resolve(); }
  createGain() { return new FakeNode(); }
  createMediaElementSource() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
  createAnalyser() { return new FakeAnalyser(); }
}

const context = {
  console: { log() {}, warn() {} }, Promise, Float32Array, Date, Math, URLSearchParams,
  Audio: FakeAudio, AudioContext: FakeContext, document,
  location: { search: "?audioTrace=1" }, innerWidth: 390, innerHeight: 844, orientation: 0,
  screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
  addEventListener() {}, setTimeout() { return 1; }, setInterval() { return 1; },
  AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
  AudioDatabase: { assets: {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio-mix-profile.js"), context);
vm.runInContext(read("data/voice-profiles.js"), context);
vm.runInContext(read("engine/managers/audio-manager.js"), context);

(async () => {
  dispatch(documentListeners, "click");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.GainNodeVoiceRuntimeTrace.signalTraceVersion, "running-but-silent-signal-trace-v1");

  const bgm = context.AudioManager.playBgm("zephyrFields", { volume: 0.20 });
  assert.equal(analysers.length, 4, "Master, BGM Bus, Voice Bus and BGM track taps");
  analysers[0].samples = [0.2, -0.2, 0.2, -0.2]; // Master
  analysers[1].samples = [0.2, -0.2, 0.2, -0.2]; // BGM Bus
  analysers[3].samples = [0.2, -0.2, 0.2, -0.2]; // BGM source/track
  bgm.currentTime = 1;
  context.GainNodeVoiceRuntimeTrace.signal();
  bgm.currentTime = 2;
  let signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.status, "MASTER ACTIVE");
  assert.equal(signal.bgm.media.moving, true);
  assert.equal(signal.bgm.media.currentTime, 2);
  assert.equal(signal.bgm.media.duration, 12);
  assert.equal(signal.bgm.source.peak, 0.2);
  assert.equal(signal.bgm.bus.rms, 0.2);
  assert.equal(signal.master.peak, 0.2);

  analysers[3].samples = [0, 0, 0, 0];
  signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.status, "SOURCE LOST");
  analysers[3].samples = [0.2, -0.2, 0.2, -0.2];
  analysers[1].samples = [0, 0, 0, 0];
  signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.status, "BUS LOST");
  analysers[1].samples = [0.2, -0.2, 0.2, -0.2];
  analysers[0].samples = [0, 0, 0, 0];
  signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.status, "MASTER LOST");

  analysers[0].samples = [1, -1, 1, -1];
  signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.highOutput, true);
  assert.equal(signal.status, "HIGH OUTPUT SIGNAL");

  analysers[0].samples = [0.2, -0.2, 0.2, -0.2];
  const tracked = context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", {
    characterGain: 0.82, characterId: 2
  });
  assert.equal(analysers.length, 5, "Dialogue Voice source analyser remains available");
  analysers[2].samples = [0.12, -0.12, 0.12, -0.12]; // Voice Bus
  analysers[4].samples = [0.12, -0.12, 0.12, -0.12]; // Voice source
  tracked.audio.currentTime = 1.5;
  signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.voice.playing, true);
  assert.equal(signal.voice.meta.character, "c02");
  assert.equal(signal.voice.meta.characterGain, 0.82);
  assert.equal(signal.voice.meta.processingGain, 1.1);
  assert.equal(signal.voice.source.peak, 0.12);
  assert.equal(signal.voice.bus.rms, 0.12);

  analysers[4].samples = [0, 0, 0, 0];
  signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.voiceSignalLost, true);
  assert.equal(signal.status, "SOURCE LOST");
  analysers[4].samples = [0.12, -0.12, 0.12, -0.12];

  tracked.audio.emit("ended");
  signal = context.GainNodeVoiceRuntimeTrace.signal();
  assert.equal(signal.residualVoice, true);
  assert.equal(signal.status, "KONG RESIDUAL SIGNAL");

  context.GainNodeVoiceRuntimeTrace.render();
  const panel = document.getElementById("gainnode-runtime-trace-output");
  for (const label of ["MASTER: peak=", "SIGNAL STATUS:", "BGM:", "BGM SIG:", "VOICE:", "VOICE SIG:", "RESIDUAL:", "EVENT LOG"])
    assert(panel.textContent.includes(label), `missing panel signal label: ${label}`);

  const source = read("engine/managers/audio-manager.js");
  assert(source.includes("master.connect(context.destination)"));
  assert(source.includes('profile.ratio === undefined ? 0.18 : Number(profile.ratio)'));
  assert(source.includes("dialogueRatio"));
  console.log("Running-But-Silent Signal Trace V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
