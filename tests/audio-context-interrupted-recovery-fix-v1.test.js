"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const documentListeners = {};
const windowListeners = {};
const elements = [];
const audios = [];
let contextCount = 0;

function add(store, name, listener) { (store[name] ||= []).push(listener); }
function remove(store, name, listener) {
  if (store[name]) store[name] = store[name].filter(candidate => candidate !== listener);
}
function dispatch(store, name) {
  (store[name] || []).slice().forEach(listener => listener({ type: name }));
}
const flush = () => new Promise(resolve => setImmediate(resolve));

const document = {
  body: { appendChild() {} }, readyState: "complete", visibilityState: "visible", hidden: false,
  hasFocus: () => true,
  createElement(tag) {
    const node = { tag, id: "", style: {}, textContent: "", appendChild() {}, open: false };
    elements.push(node); return node;
  },
  getElementById(id) { return elements.find(node => node.id === id) || null; },
  addEventListener(name, listener) { add(documentListeners, name, listener); },
  removeEventListener(name, listener) { remove(documentListeners, name, listener); }
};

class FakeAudio {
  constructor(src) {
    this.src = src; this.paused = true; this.ended = false; this.volume = 1; this.listeners = {}; this.playCount = 0;
    audios.push(this);
  }
  play() { this.playCount += 1; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, listener) { add(this.listeners, name, listener); }
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

class FakeContext {
  constructor() {
    contextCount += 1; this.state = "suspended"; this.currentTime = 0; this.destination = new FakeNode();
    this.listeners = {}; this.rejectNext = false;
  }
  addEventListener(name, listener) { add(this.listeners, name, listener); }
  emit(name) { dispatch(this.listeners, name); }
  resume() {
    if (this.rejectNext) { this.rejectNext = false; return Promise.reject(new Error("resume-rejected")); }
    this.state = "running"; this.emit("statechange"); return Promise.resolve();
  }
  createGain() { return new FakeNode(); }
  createMediaElementSource() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
  createAnalyser() { const node = new FakeNode(); node.fftSize = 4; node.getFloatTimeDomainData = data => data.fill(0); return node; }
}

const context = {
  console: { log() {}, warn() {} }, Promise, Float32Array, Date, Math, URLSearchParams,
  Audio: FakeAudio, AudioContext: FakeContext, document,
  location: { search: "?audioTrace=1" }, innerWidth: 390, innerHeight: 844, orientation: 0,
  screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
  addEventListener(name, listener) { add(windowListeners, name, listener); },
  setTimeout(fn) { fn(); }, setInterval() { return 1; },
  AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
  AudioDatabase: { assets: { zephyrSuccess: { file: "zephyr.mp3", category: "MOTIF" } } }
};
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio-mix-profile.js"), context);
vm.runInContext(read("engine/managers/audio-manager.js"), context);

(async () => {
  dispatch(documentListeners, "click");
  await flush();
  assert.equal(context.GainNodeVoiceRuntimeTrace.recoveryVersion, "audio-context-interrupted-recovery-fix-v1");
  const canonical = context.AudioManager.getAudioContext();
  assert.equal(canonical.state, "running", "initial suspended context resumes on trusted gesture");
  assert.equal(contextCount, 1, "one canonical AudioContext");

  const bgm = context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  const motif = context.AudioManager.playSe("zephyrSuccess", { volume: 0.27 });
  const voice = context.AudioManager.playVoice("effectVoice", { volume: 0.40 });
  assert.equal(bgm.playCount, 1);
  assert.equal(motif.playCount, 1);
  assert.equal(voice.playCount, 1);

  canonical.state = "interrupted";
  bgm.paused = true;
  canonical.emit("statechange");
  assert.equal(context.GainNodeVoiceRuntimeTrace.lifecycle().recoveryRequired, true);
  dispatch(documentListeners, "click");
  await flush();
  let lifecycle = context.GainNodeVoiceRuntimeTrace.lifecycle();
  assert.equal(canonical.state, "running", "interrupted context resumes on next trusted gesture");
  assert.equal(lifecycle.lastGestureResumeCalled, true, "interrupted is never reported as resume not-needed");
  assert.equal(lifecycle.lastGestureResumeResult, "success");
  assert.equal(lifecycle.recoveryRequired, false);
  assert.equal(bgm.playCount, 2, "paused active BGM replays on the same instance");
  assert.equal(audios.filter(audio => audio.src === "bgm/zephyrFields.mp3").length, 1, "no duplicate BGM instance");
  assert.equal(motif.playCount, 1, "Motif is not replayed");
  assert.equal(voice.playCount, 1, "Voice is not replayed");
  assert.equal(contextCount, 1, "recovery reuses canonical AudioContext");

  canonical.state = "interrupted";
  bgm.paused = true;
  canonical.emit("statechange");
  canonical.rejectNext = true;
  dispatch(documentListeners, "click");
  await flush();
  lifecycle = context.GainNodeVoiceRuntimeTrace.lifecycle();
  assert.equal(canonical.state, "interrupted");
  assert.equal(lifecycle.lastResumeResult, "reject");
  assert.equal(lifecycle.recoveryRequired, true);
  assert.equal(bgm.playCount, 2, "failed recovery does not replay BGM");

  dispatch(documentListeners, "click");
  await flush();
  lifecycle = context.GainNodeVoiceRuntimeTrace.lifecycle();
  assert.equal(canonical.state, "running", "next gesture retries recovery");
  assert.equal(lifecycle.lastResumeResult, "success");
  assert.equal(bgm.playCount, 3);
  assert.equal(contextCount, 1);

  const callsBeforeRunningGesture = lifecycle.resumeCalls;
  dispatch(documentListeners, "click");
  await flush();
  assert.equal(context.GainNodeVoiceRuntimeTrace.lifecycle().resumeCalls, callsBeforeRunningGesture,
    "running context does not receive an unnecessary resume call");

  const source = read("engine/managers/audio-manager.js");
  assert(source.includes('state === "suspended" || state === "interrupted"'));
  assert(!/orientationchange[\s\S]{0,180}\.resume\s*\(/.test(source), "orientation never resumes AudioContext");
  assert(source.includes('profile.ratio === undefined ? 0.18 : Number(profile.ratio)'));
  assert(source.includes('dialogueRatio'));
  console.log("AudioContext Interrupted Recovery Fix V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
