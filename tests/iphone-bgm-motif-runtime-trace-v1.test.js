"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.ended = false;
    this.volume = 1;
    this.listeners = {};
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}

class FakeNode {
  constructor() {
    this.gain = { value: 0 };
    this.frequency = { value: 0 };
    this.Q = { value: 0 };
    this.threshold = { value: 0 };
    this.knee = { value: 0 };
    this.ratio = { value: 0 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
  }
  connect() { return this; }
  disconnect() {}
}

class FakeContext {
  constructor() { this.state = "running"; this.destination = new FakeNode(); }
  resume() { return Promise.resolve(); }
  createGain() { return new FakeNode(); }
  createMediaElementSource() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
  createAnalyser() {
    const node = new FakeNode();
    node.fftSize = 4;
    node.getFloatTimeDomainData = values => values.fill(0);
    return node;
  }
}

const context = {
  console: { log() {}, warn() {} }, Promise, Float32Array, Date, Math,
  Audio: FakeAudio, AudioContext: FakeContext,
  setTimeout(fn) { fn(); },
  document: { addEventListener() {}, removeEventListener() {} },
  AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
  AudioDatabase: { assets: { zephyrSuccess: { file: "zephyr.mp3", category: "MOTIF" } } }
};
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio-mix-profile.js"), context);
vm.runInContext(read("engine/managers/audio-manager.js"), context);

context.AudioManager.playBgm("futureCityPixel", { volume: 0.30 });
let live = context.GainNodeVoiceRuntimeTrace.live();
assert.equal(live.bgm.asset, "futureCityPixel");
assert.equal(live.bgm.playing, true);
assert.equal(live.bgm.path, "web-audio");
assert.equal(live.bgm.fallback, false);
assert.equal(live.bgm.baseGain, 0.30);
assert.equal(live.bgm.trackGain, 0.30);
assert.equal(live.bgm.effectiveGain, 0.30);
assert.equal(live.bgmPlaying.length, 1);
assert.equal(live.motifs.length, 0);

context.AudioManager.playSe("zephyrSuccess", { volume: 0.27 });
live = context.GainNodeVoiceRuntimeTrace.live();
assert.equal(live.motifs.length, 1);
assert.equal(live.motifs[0].__eigoTraceAssetId, "zephyrSuccess");
assert.equal(live.playing.length, 2);
assert.equal(live.sameSourceMax, 1);
assert.equal(live.bgmPlaying.length, 1);

const manager = read("engine/managers/audio-manager.js");
assert(manager.includes("pointer-events:none"));
assert(manager.includes("position:fixed"));
assert(manager.includes("top:max(4px,env(safe-area-inset-top))"));

const s002 = read("engine/stories/S002.js");
const firstPico = s002.indexOf('voiceKey: "voice_c01_s002_001"');
const firstKong = s002.indexOf('voiceKey: "voice_c02_s002_001"');
const zephyrSuccess = s002.indexOf('C.se("zephyrSuccess", { volume: 0.27 })');
const laterPico = s002.indexOf('voiceKey: "voice_c01_s002_005"');
assert(firstPico >= 0 && firstKong > firstPico && zephyrSuccess > firstKong,
  "Future City front Pico/Kong occurs before any Zephyr motif request");
assert(laterPico > zephyrSuccess, "later Pico follows the observable zephyrSuccess start");

console.log("iPhone BGM / Motif Runtime Trace V1: PASS");
