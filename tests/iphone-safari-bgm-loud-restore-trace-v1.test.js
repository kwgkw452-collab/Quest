"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const managerSource = read("engine/managers/audio-manager.js");
const indexSource = read("index.html");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

function createRuntime(search) {
  const contexts = [];
  const timers = [];
  const add = (store, name, callback) => (store[name] ||= []).push(callback);
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
      this.muted = false; this.playbackRate = 1; this.listeners = {}; this.playCalls = 0;
    }
    getAttribute(name) { return name === "src" ? this.src : null; }
    addEventListener(name, callback) { add(this.listeners, name, callback); }
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
      const node = new FakeNode(); node.fftSize = 4; node.getFloatTimeDomainData = output => output.fill(0); return node;
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
    screen: { orientation: { type: "portrait-primary", addEventListener() {} } }, addEventListener() {},
    clearTimeout, setInterval() { return 1; },
    setTimeout(callback, delay) {
      if ([100, 500, 1000, 1500].includes(delay)) { timers.push({ callback, delay }); return delay; }
      return setTimeout(callback, 0);
    },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } }, AudioDatabase: { assets: {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  vm.runInContext(managerSource, context);
  return { context, contexts, timers };
}

(async () => {
  check(managerSource.includes('BGM_LOUD_RESTORE_TRACE_VERSION = "iphone-safari-bgm-loud-restore-trace-v1"'), "version marker exists");
  check(managerSource.includes("BGM_LOUD_RESTORE_TRACE_LIMIT = 96"), "dedicated storage is bounded");
  check(indexSource.includes("audio-manager.js?v=iphone-safari-bgm-loud-restore-trace-v1"), "production cache key selects this trace build");
  for (const event of [
    "loudness-snapshot-pre-speech", "loudness-snapshot-rec-end", "loudness-snapshot-restore-start",
    "loudness-snapshot-pre-ab-delay", "loudness-snapshot-post-ab-delay", "loudness-snapshot-pre-resume",
    "loudness-snapshot-post-resume", "loudness-snapshot-pre-play", "loudness-snapshot-post-play",
    "loudness-snapshot-100ms", "loudness-snapshot-500ms", "loudness-snapshot-1000ms"
  ]) check(managerSource.includes(`"${event}"`), `snapshot exists: ${event}`);

  const r = createRuntime("?speechRestoreDiagnostic=delay1500");
  const manager = r.context.AudioManager;
  const bgm = manager.playBgm("zephyrFields", { volume: 0.46 });
  r.context.AudioRestoreTimingDiagnostic.record("recognition-onend");
  await manager.enterSpeechMode();
  r.context.AudioRestoreTimingDiagnostic.record("audio-release-request");
  r.contexts[0].state = "suspended";
  const exit = manager.exitSpeechMode();
  await Promise.resolve(); await Promise.resolve();
  check(r.timers.filter(timer => timer.delay === 1500).length === 1, "existing B condition still schedules one 1500ms wait");
  check(manager.getState().speechMode.state === "active" && bgm.paused && manager.getState().busGains.bgm === 0,
    "B condition remains isolated during its existing wait");
  r.timers.find(timer => timer.delay === 1500).callback();
  await exit;
  check(manager.getState().speechMode.state === "idle" && !bgm.paused, "existing B restore still completes");
  const timerDelays = r.timers.filter(timer => timer.delay !== 1500).map(timer => timer.delay).sort((a, b) => a - b);
  check(JSON.stringify(timerDelays) === JSON.stringify([100, 500, 1000]), "only non-blocking 100/500/1000ms snapshot timers are added");
  check(!r.context.BgmLoudRestoreTrace.events().some(event => /100ms|500ms|1000ms/.test(event.event)),
    "Production restore resolves before diagnostic timers execute");
  r.timers.filter(timer => timer.delay !== 1500).forEach(timer => timer.callback());

  const events = r.context.BgmLoudRestoreTrace.events();
  const names = events.map(event => event.event);
  for (const name of [
    "loudness-snapshot-pre-speech", "loudness-snapshot-rec-end", "loudness-snapshot-restore-start",
    "loudness-snapshot-pre-ab-delay", "loudness-snapshot-post-ab-delay", "loudness-snapshot-pre-resume",
    "loudness-snapshot-post-resume", "loudness-snapshot-pre-play", "loudness-snapshot-post-play",
    "loudness-snapshot-100ms", "loudness-snapshot-500ms", "loudness-snapshot-1000ms"
  ]) check(names.includes(name), `runtime captured: ${name}`);
  check(names.indexOf("loudness-snapshot-pre-ab-delay") < names.indexOf("loudness-snapshot-post-ab-delay") &&
    names.indexOf("loudness-snapshot-post-ab-delay") < names.indexOf("loudness-snapshot-pre-resume") &&
    names.indexOf("loudness-snapshot-pre-resume") < names.indexOf("loudness-snapshot-post-resume") &&
    names.indexOf("loudness-snapshot-post-resume") < names.indexOf("loudness-snapshot-pre-play") &&
    names.indexOf("loudness-snapshot-pre-play") < names.indexOf("loudness-snapshot-post-play"),
    "restore/resume/play snapshots keep distinct order");
  const commonFields = ["event", "timestamp", "abCondition", "configuredRestoreDelayMs", "contextState",
    "mediaVolume", "mediaMuted", "mediaPaused", "mediaCurrentTime", "mediaPlaybackRate", "trackGain",
    "bgmBusGain", "masterGain", "effectiveGain", "bgmId", "bgmPlaying", "sourceCount"];
  check(events.every(event => commonFields.every(field => Object.prototype.hasOwnProperty.call(event, field))),
    "every snapshot uses the common field schema");
  const postPlay = events.find(event => event.event === "loudness-snapshot-post-play");
  check(postPlay.abCondition === "B" && postPlay.configuredRestoreDelayMs === 1500, "snapshot reads existing B configuration");
  check(postPlay.bgmId === "zephyrFields" && postPlay.sourceCount === 1 && postPlay.path === "web-audio",
    "snapshot reads the managed BGM and real graph path");
  check(postPlay.mediaVolume === 1 && postPlay.mediaMuted === false && postPlay.mediaPlaybackRate === 1,
    "snapshot reads HTMLMediaElement values without changing them");
  check(postPlay.trackGain === 0.46 && postPlay.bgmBusGain === 1 && postPlay.masterGain === 1 && postPlay.effectiveGain === 0.46,
    "snapshot reads exact production GainNodes and effective gain");

  const beforeSnapshotCount = events.length;
  Object.defineProperty(bgm, "volume", { get() { throw new Error("diagnostic-read-failure"); } });
  check(r.context.BgmLoudRestoreTrace.snapshot("diagnostic-error-test") === null &&
    r.context.BgmLoudRestoreTrace.events().length === beforeSnapshotCount, "diagnostic read errors do not escape or mutate production state");

  const a = createRuntime("?audioTrace=1");
  a.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  await a.context.AudioManager.enterSpeechMode();
  const aExit = a.context.AudioManager.exitSpeechMode();
  await aExit;
  check(a.timers.every(timer => timer.delay !== 1500), "A condition still has no 1500ms wait");
  check(a.context.AudioRestoreTimingDiagnostic.mode() === "A" && a.context.AudioRestoreTimingDiagnostic.delayMs() === 0,
    "A/B selector remains unchanged");

  check(!managerSource.includes("2500"), "no new restore wait is added");
  check(!/audioSession\s*\.\s*(type|state)\s*=/.test(managerSource), "audioSession remains read-only");
  console.log(`iPhone Safari BGM Loud Restore Trace V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
