"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const source = read("engine/managers/audio-manager.js");
const index = read("index.html");
const dev = read("dev.html");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

function runtime() {
  const documentListeners = {};
  const audios = [];
  function add(store, name, callback) { (store[name] ||= []).push(callback); }
  class Node {
    constructor() { this.gain = { value: 1, cancelScheduledValues() {} }; }
    connect(target) { return target; }
    disconnect() {}
  }
  class Audio {
    constructor(src) {
      this.src = src; this.paused = true; this.ended = false; this.currentTime = 0;
      this.readyState = 4; this.networkState = 1; this.volume = 1; this.muted = false;
      this.listeners = {}; audios.push(this);
    }
    getAttribute(name) { return name === "src" ? this.src : null; }
    addEventListener(name, callback) { add(this.listeners, name, callback); }
    play() {
      this.paused = false;
      (this.listeners.playing || []).forEach(callback => callback({ type: "playing" }));
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  class AudioContext {
    constructor() { this.state = "suspended"; this.currentTime = 2.5; this.destination = new Node(); }
    addEventListener() {}
    createGain() { return new Node(); }
    createMediaElementSource() { return new Node(); }
    createAnalyser() { const node = new Node(); node.fftSize = 4; node.getFloatTimeDomainData = out => out.fill(0); return node; }
    resume() { this.state = "running"; this.currentTime = 2.75; return Promise.resolve(); }
  }
  const document = {
    body: { appendChild() {} }, visibilityState: "visible", hidden: false,
    hasFocus: () => true,
    addEventListener(name, callback) { add(documentListeners, name, callback); },
    removeEventListener() {},
    createElement() { return { style: {}, appendChild() {}, textContent: "", id: "" }; },
    getElementById() { return null; }
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, Promise, Float32Array, Date, Math, URLSearchParams,
    Audio, AudioContext, document, navigator: {}, location: { search: "?audioTrace=1" },
    innerWidth: 390, innerHeight: 844, screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
    addEventListener() {}, setTimeout(callback) { callback(); return 1; }, clearTimeout,
    setInterval() { return 1; },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: { assets: { picoEntrance: { category: "SE" }, zephyrFields: { category: "BGM" } } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  vm.runInContext(source, context);
  return { context, documentListeners, audios };
}

(async () => {
  check(source.includes('INITIAL_AUDIO_UNLOCK_TRACE_VERSION = "iphone-safari-initial-audio-unlock-trace-v1"'), "version marker exists");
  check(source.includes("INITIAL_AUDIO_UNLOCK_TRACE_LIMIT = 64"), "dedicated trace retains 64 events");
  check(index.includes("audio-manager.js?v=iphone-speech-audio-restore-timing-ab-v1&trace=iphone-safari-initial-audio-unlock-trace-v1"),
    "production URL retains A/B key and selects trace build");
  check(dev.includes("audio-manager.js?v=gainnode-confirmed-regression-fix-v1"), "dev cache key remains unchanged");
  check(source.includes('keyOrPath === "picoEntrance"') && source.includes('recordInitialAudioUnlockTrace("pico-appear")'), "Pico appearance/SE route is observed");
  check(source.includes('keyOrPath === "zephyrFields"') && source.includes('recordInitialAudioUnlockTrace("zephyr-request")'), "Zephyr route is observed");
  check(source.includes('event.type === "pointerdown" && event.isTrusted === true'), "only first trusted pointerdown is selected");
  check(source.includes('recordInitialAudioUnlockTrace("resume-settlement-pending"') &&
    source.includes('recordInitialAudioUnlockTrace("resume-resolved"') &&
    source.includes('recordInitialAudioUnlockTrace("resume-rejected"'), "existing resume settlement is observed");

  const run = runtime();
  run.context.AudioManager.playSe("picoEntrance", { volume: 0.48 });
  run.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  await Promise.resolve(); await Promise.resolve();
  run.context.AudioManager.getAudioContext().state = "suspended";
  run.context.AudioManager.getAudioContext().currentTime = 2.5;
  const pointer = run.documentListeners.pointerdown;
  check(Array.isArray(pointer) && pointer.length >= 1, "existing trusted gesture listener remains installed");
  pointer.forEach(listener => listener({ type: "pointerdown", isTrusted: true, timeStamp: 123.5 }));
  await new Promise(resolve => setImmediate(resolve));
  const trace = run.context.InitialAudioUnlockTrace;
  check(trace.version === "iphone-safari-initial-audio-unlock-trace-v1" && trace.limit === 64, "public trace marker is available");
  const events = trace.events();
  const names = events.map(event => event.type);
  for (const name of ["pico-appear", "pico-se-play-call", "pico-se-play-resolved", "zephyr-play-call",
    "zephyr-play-resolved", "first-trusted-pointerdown", "before-resume", "resume-called",
    "resume-settlement-pending", "resume-resolved", "after-resume-settlement"]) {
    check(names.includes(name), `trace event exists: ${name}`);
  }
  const before = events.find(event => event.type === "before-resume");
  const after = events.find(event => event.type === "after-resume-settlement");
  check(before.isTrusted === true && before.eventTimestamp === 123.5, "trusted pointer metadata is recorded");
  check(before.picoSe.readyState === 4 && before.zephyr.readyState === 4 &&
    before.picoSe.currentTime === 0 && before.zephyr.currentTime === 0, "pre-resume SE/BGM media state is recorded");
  check(after.contextState === "running" && after.contextCurrentTime === 2.75 &&
    after.picoSe.playing === true && after.zephyr.playing === true, "post-settlement context and media state are recorded");
  check(!source.includes("silent priming") && !source.includes("__eigoInitialAudioUnlockReplay"), "trace adds no priming or replay path");
  check(source.includes('return query.get("speechRestoreDiagnostic") === "delay1500" ? "B" : "A"') &&
    source.includes('return speechRestoreDiagnosticMode() === "B" ? 1500 : 0'), "A/B 1500ms diagnostic remains exact");

  console.log(`iPhone Safari Initial Audio Unlock Trace V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
