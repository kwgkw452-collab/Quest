"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const managerSource = read("engine/managers/audio-manager.js");
const adapterSource = read("engine/services/speech-recognition-adapter.js");
const engineSource = read("engine/services/speech-engine.js");
const indexSource = read("index.html");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

function createRuntime(search) {
  const audioElements = [];
  const contexts = [];
  const delayed = [];
  const listeners = (store, name, callback) => (store[name] ||= []).push(callback);
  class FakeNode {
    constructor() {
      this.gain = { value: 0, cancelScheduledValues() {} };
      this.frequency = { value: 0 }; this.Q = { value: 0 };
      this.threshold = { value: 0 }; this.knee = { value: 0 }; this.ratio = { value: 0 };
      this.attack = { value: 0 }; this.release = { value: 0 };
    }
    connect(node) { return node; }
    disconnect() {}
  }
  class FakeAudio {
    constructor(src) {
      this.src = src; this.paused = true; this.ended = false; this.currentTime = 0;
      this.duration = 30; this.readyState = 4; this.networkState = 1; this.volume = 1;
      this.muted = false; this.listeners = {}; this.playCalls = 0;
      audioElements.push(this);
    }
    getAttribute(name) { return name === "src" ? this.src : null; }
    addEventListener(name, callback) { listeners(this.listeners, name, callback); }
    play() {
      this.playCalls += 1; this.paused = false;
      (this.listeners.playing || []).forEach(callback => callback({ type: "playing" }));
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  class FakeContext {
    constructor() { this.state = "running"; this.currentTime = 0; this.destination = new FakeNode(); contexts.push(this); }
    addEventListener() {}
    createGain() { return new FakeNode(); }
    createMediaElementSource() { return new FakeNode(); }
    createDynamicsCompressor() { return new FakeNode(); }
    createBiquadFilter() { return new FakeNode(); }
    createWaveShaper() { return new FakeNode(); }
    createAnalyser() {
      const node = new FakeNode(); node.fftSize = 4;
      node.getFloatTimeDomainData = output => output.fill(0);
      return node;
    }
    resume() { this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  const document = {
    body: { appendChild() {} }, visibilityState: "visible", hidden: false,
    hasFocus: () => true, addEventListener() {}, removeEventListener() {},
    createElement() { return { style: {}, appendChild() {}, textContent: "", id: "" }; },
    getElementById() { return null; }
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, Promise, Float32Array, Date, Math, URLSearchParams,
    Audio: FakeAudio, AudioContext: FakeContext, document, navigator: { audioSession: { type: "playback", state: "active" } },
    location: { search }, innerWidth: 390, innerHeight: 844,
    screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
    addEventListener() {}, clearTimeout, setInterval() { return 1; },
    setTimeout(callback, delay) {
      if (delay === 1500) { delayed.push(callback); return 1500; }
      return setTimeout(callback, 0);
    },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: { assets: {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  vm.runInContext(managerSource, context);
  return { context, audioElements, contexts, delayed };
}

(async () => {
  check(managerSource.includes('AUDIO_RESTORE_TIMING_TRACE_VERSION = "iphone-speech-audio-restore-timing-ab-v1"'), "version marker exists");
  check(managerSource.includes("AUDIO_RESTORE_TIMING_TRACE_LIMIT = 64"), "dedicated storage retains at least 64 events");
  check(managerSource.includes('query.get("speechRestoreDiagnostic") === "delay1500"'), "B condition is exact-query gated");
  check(managerSource.includes('"AUDIO RESTORE TIMING A/B (latest "'), "dedicated panel heading exists");
  for (const event of [
    "recognition-onend", "adapter-settled", "speech-finally", "audio-release-request",
    "restore-delay-start", "restore-delay-end", "exitSpeechMode-start", "ctx-before-restore",
    "bgm-restore-start", "bgm-play-call", "bgm-playing", "bgm-play-resolved"
  ]) check(managerSource.includes(`"${event}"`), `trace event exists: ${event}`);
  check(adapterSource.includes('restoreTimingTrace("recognition-onend"'), "recognition onend is observed without delaying it");
  check(adapterSource.includes('restoreTimingTrace("adapter-settled"'), "adapter settlement is observed");
  check(engineSource.includes('restoreTimingTrace("speech-finally"'), "SpeechEngine finally is observed");
  check(engineSource.includes('restoreTimingTrace("audio-release-request"'), "audio release request is observed");
  check(!adapterSource.includes("speechRestoreDiagnostic"), "Recognition lifecycle has no diagnostic delay branch");
  check(!engineSource.includes("delay1500") && !engineSource.includes("1500"), "SpeechEngine finally has no diagnostic delay");
  check(!adapterSource.includes(".abort()") && !adapterSource.includes("getUserMedia") && !adapterSource.includes("MediaStream"), "Recognition behavior remains unchanged");

  const a = createRuntime("?audioTrace=1");
  const aBgm = a.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  await a.context.AudioManager.enterSpeechMode();
  const aExit = a.context.AudioManager.exitSpeechMode();
  await aExit;
  check(a.delayed.length === 0, "A schedules no 1500ms delay");
  check(a.context.AudioManager.getState().speechMode.state === "idle" && !aBgm.paused, "A keeps the production restore result");
  const aTrace = a.context.AudioRestoreTimingDiagnostic;
  check(aTrace.mode() === "A" && aTrace.delayMs() === 0, "A reports control mode and zero delay");
  const aNames = aTrace.events().map(event => event.type);
  check(aNames.indexOf("restore-delay-start") < aNames.indexOf("restore-delay-end") &&
    aNames.indexOf("restore-delay-end") < aNames.indexOf("exitSpeechMode-start"), "A retains immediate restore order");

  const b = createRuntime("?speechRestoreDiagnostic=delay1500");
  const bBgm = b.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  await b.context.AudioManager.enterSpeechMode();
  const bExit = b.context.AudioManager.exitSpeechMode();
  await Promise.resolve(); await Promise.resolve();
  check(b.delayed.length === 1, "B schedules exactly one 1500ms delay");
  check(b.context.AudioManager.getState().speechMode.state === "active" && bBgm.paused &&
    b.context.AudioManager.getState().busGains.bgm === 0, "B holds canonical isolation during the delay");
  check(b.context.AudioRestoreTimingDiagnostic.mode() === "B" &&
    b.context.AudioRestoreTimingDiagnostic.delayMs() === 1500, "B reports diagnostic mode and 1500ms");
  b.delayed.shift()();
  await bExit;
  check(b.context.AudioManager.getState().speechMode.state === "idle" && !bBgm.paused, "B restores only after the diagnostic wait");
  const bEvents = b.context.AudioRestoreTimingDiagnostic.events();
  const bNames = bEvents.map(event => event.type);
  const delayStartIndex = bNames.indexOf("restore-delay-start");
  const restoreNames = bNames.slice(delayStartIndex);
  check(restoreNames.indexOf("restore-delay-start") < restoreNames.indexOf("restore-delay-end") &&
    restoreNames.indexOf("restore-delay-end") < restoreNames.indexOf("exitSpeechMode-start") &&
    restoreNames.indexOf("exitSpeechMode-start") < restoreNames.indexOf("ctx-before-restore") &&
    restoreNames.indexOf("ctx-before-restore") < restoreNames.indexOf("bgm-restore-start") &&
    restoreNames.indexOf("bgm-restore-start") < restoreNames.indexOf("bgm-play-call"), "B delay sits before all canonical restore work");
  check(bEvents.every(event => event.diagnosticMode === "B" && event.audioSession === "playback/active"), "B trace records mode and read-only audioSession");
  check(bEvents.some(event => event.bgmTrackGain !== undefined && event.bgmBusGain !== undefined &&
    event.masterGain !== undefined && event.graph !== undefined && event.fallback !== undefined), "BGM gain/path state is recorded");

  const off = createRuntime("");
  check(off.context.AudioRestoreTimingDiagnostic.mode() === "A" &&
    off.context.AudioRestoreTimingDiagnostic.enabled() === false &&
    off.context.AudioRestoreTimingDiagnostic.events().length === 0, "Trace OFF performs no recording");
  check(indexSource.includes("speech-recognition-adapter.js?v=iphone-speech-audio-restore-timing-ab-v1") &&
    indexSource.includes("speech-engine.js?v=iphone-speech-audio-restore-timing-ab-v1") &&
    indexSource.includes("audio-manager.js?v=iphone-speech-audio-restore-timing-ab-v1"), "production cache keys select the A/B build");
  check(!/audioSession\s*\.\s*(type|state)\s*=/.test(managerSource + adapterSource + engineSource), "navigator.audioSession remains read-only");

  console.log(`iPhone Speech Audio Restore Timing A/B Diagnostic V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
