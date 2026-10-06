"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

class FakeNode {
  constructor() {
    this.gain = { value: 0, cancelScheduledValues() {} };
    this.frequency = { value: 0 };
    this.Q = { value: 0 };
    this.threshold = { value: 0 };
    this.knee = { value: 0 };
    this.ratio = { value: 0 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
  }
  connect(node) { return node; }
  disconnect() {}
}

class FakeAnalyser extends FakeNode {
  constructor() { super(); this.fftSize = 4; }
  getFloatTimeDomainData(output) { output.fill(0.1); }
}

class FakeContext {
  constructor() { this.state = "running"; this.currentTime = 0; this.destination = new FakeNode(); }
  addEventListener() {}
  createGain() { return new FakeNode(); }
  createMediaElementSource() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
  createAnalyser() { return new FakeAnalyser(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  close() { this.state = "closed"; return Promise.resolve(); }
}

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.ended = false;
    this.currentTime = 0;
    this.duration = 30;
    this.readyState = 4;
    this.networkState = 1;
    this.volume = 1;
    this.muted = false;
    this.loop = false;
    this.listeners = {};
    this.playCalls = 0;
  }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

function runtime() {
  const document = {
    readyState: "complete",
    body: { appendChild() {} },
    visibilityState: "visible",
    hidden: false,
    hasFocus: () => true,
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({ style: {}, appendChild() {}, textContent: "", id: "" }),
    getElementById: () => null
  };
  const context = {
    console: { log() {}, warn() {} },
    Promise, Float32Array, Date, Math, URLSearchParams,
    Audio: FakeAudio, AudioContext: FakeContext, document,
    location: { search: "" }, innerWidth: 390, innerHeight: 844, orientation: 0,
    screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
    addEventListener() {}, setTimeout, clearTimeout, setInterval: () => 1,
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: { assets: { motif: { category: "MOTIF", file: "audio/motif.mp3" } } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  context.AudioMixProfile.ducking.speechRecognition.duckMs = 0;
  context.AudioMixProfile.ducking.speechRecognition.restoreMs = 0;
  vm.runInContext(read("engine/managers/audio-manager.js"), context);
  return context;
}

let checks = 0;
function check(condition, message) { assert(condition, message); checks += 1; }

(async () => {
  const c = runtime();
  const m = c.AudioManager;
  const bgm = m.playBgm("zephyrFields", { volume: 0.46 });

  c.SpeechAudioDuckingInternal.arm({ preserveBgm: true });
  await c.SpeechAudioDuckingInternal.begin();
  check(m.getState().busGains.bgm === 0.25, "legacy 0.25 profile remains unchanged outside canonical isolation");

  const states = [];
  const entering = m.enterSpeechMode();
  states.push(m.getState().speechMode.state);
  await entering;
  states.push(m.getState().speechMode.state);
  const active = m.getState();
  check(states[0] === "idle" || states[0] === "entering", "entry is serialized from idle through entering");
  check(states[1] === "active", "canonical entry completes in active");
  check(Object.values(active.busGains).every(value => value === 0 || value === active.busGains.master), "all category buses are isolated");
  check(active.busGains.bgm === 0, "armed legacy duck cannot replace canonical BGM zero");
  check(active.busGains.motif === 0 && active.busGains.voice === 0 && active.busGains.se === 0 && active.busGains.effectVoice === 0,
    "motif, voice, SE, and effect voice buses are zero");

  c.SpeechAudioDuckingInternal.arm({ preserveBgm: true });
  await c.SpeechAudioDuckingInternal.begin();
  check(m.getState().speechMode.state === "active" && m.getState().busGains.bgm === 0,
    "legacy begin during canonical active cannot replace isolation");
  await c.SpeechAudioDuckingInternal.finish(true);
  check(m.getState().speechMode.state === "active" && m.getState().busGains.bgm === 0,
    "legacy finish during canonical active cannot exit isolation");

  await m.exitSpeechMode();
  const restored = m.getState();
  check(restored.speechMode.state === "idle", "canonical exit returns to idle");
  check(restored.busGains.bgm === 1 && !bgm.paused && bgm.playCalls === 2, "current Story BGM restores once");

  let legacyBeginCalls = 0;
  c.SpeechAudioDuckingInternal = { isArmed: () => true, begin: () => { legacyBeginCalls += 1; } };
  c.DialogueVoiceController = { stop() {} };
  c.SpeechEngine = { listen: () => Promise.resolve("hello"), stop() {} };
  vm.runInContext(read("engine/services/speech-start-controller.js"), c);
  await c.SpeechStartController.prepare();
  check(legacyBeginCalls === 0, "controller does not start legacy duck when canonical API is complete");
  check(await c.SpeechStartController.startListening({}) === "hello", "controller delegates recognition ownership to SpeechEngine");

  const speechEngineSource = read("engine/services/speech-engine.js");
  check(speechEngineSource.indexOf("await enterSpeechAudio(audioAttempt)") < speechEngineSource.indexOf("SpeechRecognitionAdapter.listen({"),
    "SpeechEngine awaits canonical entry before Adapter.listen");
  check(speechEngineSource.includes("attempt.released = true"), "released guard remains present");

  console.log(`Speech Mode Canonical Isolation Fix V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
