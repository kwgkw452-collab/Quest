"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const documentListeners = {};
const windowListeners = {};
const orientationListeners = {};
const elements = [];

function addListener(store, name, listener) { (store[name] ||= []).push(listener); }
function removeListener(store, name, listener) {
  if (store[name]) store[name] = store[name].filter(candidate => candidate !== listener);
}
function dispatch(store, name, extra = {}) {
  (store[name] || []).slice().forEach(listener => listener(Object.assign({ type: name }, extra)));
}

const document = {
  body: { appendChild() {} },
  readyState: "complete",
  visibilityState: "visible",
  hidden: false,
  hasFocus: () => true,
  createElement(tag) {
    const node = { tag, id: "", style: {}, textContent: "", appendChild() {}, open: false };
    elements.push(node);
    return node;
  },
  getElementById(id) { return elements.find(node => node.id === id) || null; },
  addEventListener(name, listener) { addListener(documentListeners, name, listener); },
  removeEventListener(name, listener) { removeListener(documentListeners, name, listener); }
};

class FakeAudio {
  constructor(src) { this.src = src; this.paused = true; this.ended = false; this.volume = 1; this.listeners = {}; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, listener) { addListener(this.listeners, name, listener); }
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
    this.state = "suspended";
    this.currentTime = 1.25;
    this.destination = new FakeNode();
    this.listeners = {};
    this.rejectNext = false;
  }
  addEventListener(name, listener) { addListener(this.listeners, name, listener); }
  emit(name) { dispatch(this.listeners, name); }
  resume() {
    if (this.rejectNext) { this.rejectNext = false; return Promise.reject(new Error("resume-rejected")); }
    this.state = "running";
    this.emit("statechange");
    return Promise.resolve();
  }
  createGain() { return new FakeNode(); }
  createMediaElementSource() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
  createAnalyser() {
    const node = new FakeNode(); node.fftSize = 4; node.getFloatTimeDomainData = values => values.fill(0); return node;
  }
}

const context = {
  console: { log() {}, warn() {} }, Promise, Float32Array, Date, Math, URLSearchParams,
  Audio: FakeAudio, AudioContext: FakeContext, document,
  location: { search: "?audioTrace=1" },
  innerWidth: 390, innerHeight: 844, orientation: 0,
  screen: { orientation: {
    type: "portrait-primary",
    addEventListener(name, listener) { addListener(orientationListeners, name, listener); }
  } },
  addEventListener(name, listener) { addListener(windowListeners, name, listener); },
  setTimeout(fn) { fn(); },
  setInterval() { return 1; },
  AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
  AudioDatabase: { assets: { zephyrSuccess: { file: "zephyr.mp3", category: "MOTIF" } } }
};
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio-mix-profile.js"), context);
vm.runInContext(read("engine/managers/audio-manager.js"), context);

(async () => {
  dispatch(documentListeners, "click");
  await new Promise(resolve => setImmediate(resolve));
  let lifecycle = context.GainNodeVoiceRuntimeTrace.lifecycle();
  assert.equal(lifecycle.resumeCalls, 1);
  assert.equal(lifecycle.resumeSuccess, 1);
  assert.equal(lifecycle.resumeReject, 0);
  assert.equal(lifecycle.lastGestureType, "click");
  assert.equal(lifecycle.lastGestureResumeCalled, true);

  const audioContext = context.AudioManager.getAudioContext();
  audioContext.state = "suspended";
  audioContext.emit("statechange");
  assert.equal(context.GainNodeVoiceRuntimeTrace.lifecycle().suspendSeen, true);
  await context.AudioManager.ensureContextRunning();

  audioContext.state = "suspended";
  audioContext.emit("statechange");
  audioContext.rejectNext = true;
  assert.equal(await context.AudioManager.ensureContextRunning(), false);
  lifecycle = context.GainNodeVoiceRuntimeTrace.lifecycle();
  assert.equal(lifecycle.resumeCalls, 3);
  assert.equal(lifecycle.resumeSuccess, 2);
  assert.equal(lifecycle.resumeReject, 1);
  assert(lifecycle.stateChangeCount >= 3);

  document.visibilityState = "hidden"; document.hidden = true;
  dispatch(documentListeners, "visibilitychange");
  dispatch(windowListeners, "pagehide");
  dispatch(windowListeners, "blur");
  document.visibilityState = "visible"; document.hidden = false;
  dispatch(windowListeners, "pageshow");
  dispatch(windowListeners, "focus");
  context.screen.orientation.type = "landscape-primary";
  context.innerWidth = 844; context.innerHeight = 390;
  dispatch(windowListeners, "orientationchange");
  dispatch(orientationListeners, "change");
  dispatch(windowListeners, "resize");

  audioContext.state = "running";
  audioContext.emit("statechange");
  context.AudioManager.playBgm("futureCityPixel", { volume: 0.30 });
  context.AudioManager.playSe("zephyrSuccess", { volume: 0.27 });
  const live = context.GainNodeVoiceRuntimeTrace.live();
  assert.equal(live.bgm.asset, "futureCityPixel");
  assert.equal(live.motifs.length, 1);

  lifecycle = context.GainNodeVoiceRuntimeTrace.lifecycle();
  const types = lifecycle.events.map(event => event.type);
  for (const type of [
    "context-statechange", "visibilitychange", "pageshow", "pagehide", "focus", "blur",
    "orientationchange", "screen.orientation.change", "resize", "resume-success", "resume-reject"
  ]) assert(types.includes(type), `missing lifecycle event: ${type}`);
  assert(lifecycle.events.length <= 20);

  const panel = document.getElementById("gainnode-runtime-trace-output");
  for (const label of ["CTX:", "PAGE:", "ORIENT:", "GESTURE:", "RESUME:", "BGM:", "MOTIF:", "VOICE:", "EVENT LOG"])
    assert(panel.textContent.includes(label), `missing panel label: ${label}`);

  const manager = read("engine/managers/audio-manager.js");
  assert(!manager.includes('addEventListener("orientationchange", function () {\n        unlock()'));
  assert(manager.includes('profile.ratio === undefined ? 0.18 : Number(profile.ratio)'));
  assert(manager.includes('motifTarget'));
  console.log("iPhone Audio Lifecycle Trace V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
