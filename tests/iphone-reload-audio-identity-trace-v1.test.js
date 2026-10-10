"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const source = read("engine/managers/audio-manager.js");
const index = read("index.html");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

function createRuntime() {
  const documentListeners = {};
  const counts = { gain: 0, source: 0, analyser: 0 };
  function add(store, name, callback) { (store[name] ||= []).push(callback); }
  class FakeNode {
    constructor() { this.gain = { value: 1, cancelScheduledValues() {} }; }
    connect(target) { return target; }
    disconnect() {}
  }
  class FakeAudio {
    constructor(src) {
      this.src = src; this.paused = true; this.ended = false; this.currentTime = 0;
      this.readyState = 4; this.networkState = 1; this.volume = 1; this.muted = false;
      this.listeners = {};
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
  class FakeContext {
    constructor() { this.state = "suspended"; this.currentTime = 1.25; this.destination = new FakeNode(); }
    addEventListener() {}
    createGain() { counts.gain += 1; return new FakeNode(); }
    createMediaElementSource() { counts.source += 1; return new FakeNode(); }
    createAnalyser() {
      counts.analyser += 1;
      const node = new FakeNode(); node.fftSize = 4; node.getFloatTimeDomainData = output => output.fill(0);
      return node;
    }
    resume() { this.state = "running"; this.currentTime = 1.5; return Promise.resolve(); }
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
    console: { log() {}, warn() {}, error() {} }, Promise, WeakMap, Float32Array, Date, Math, URLSearchParams,
    Audio: FakeAudio, AudioContext: FakeContext, document, navigator: {},
    performance: { getEntriesByType(type) { return type === "navigation" ? [{ type: "reload" }] : []; } },
    location: { search: "?audioTrace=1" }, innerWidth: 390, innerHeight: 844,
    screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
    addEventListener() {}, setTimeout(callback) { callback(); return 1; }, clearTimeout,
    setInterval() { return 1; },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: { assets: { morningGardenAtmosphere: { category: "BGM" }, picoEntrance: { category: "SE" } } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  vm.runInContext(source, context);
  return { context, documentListeners, counts };
}

(async () => {
  check(source.includes('RELOAD_AUDIO_IDENTITY_TRACE_VERSION = "iphone-reload-audio-identity-trace-v1"'), "version marker exists");
  check(source.includes("RELOAD_AUDIO_IDENTITY_TRACE_LIMIT = 96"), "dedicated checkpoint storage exists");
  check(index.includes("identityTrace=iphone-reload-audio-identity-trace-v1"), "production cache URL selects identity trace build");
  for (const checkpoint of [
    "startup", "morning-bgm-before", "morning-bgm-after-request", "pico-before", "pico-after-request",
    "trusted-pointerdown-before", "trusted-pointerdown-after", "speech-start-before-recognition",
    "speech-end-bgm-restore-after"
  ]) check(source.includes(`"${checkpoint}"`), `checkpoint exists: ${checkpoint}`);

  const run = createRuntime();
  const trace = run.context.ReloadAudioIdentityTrace;
  check(trace.version === "iphone-reload-audio-identity-trace-v1" && trace.limit === 96, "public trace API exposes version and limit");
  const beforeSnapshotCounts = { ...run.counts };
  trace.snapshot(); trace.snapshot();
  check(JSON.stringify(run.counts) === JSON.stringify(beforeSnapshotCounts), "identity snapshots create no Audio nodes");

  run.context.AudioManager.playBgm("morningGardenAtmosphere", { volume: 1 });
  await new Promise(resolve => setImmediate(resolve));
  run.context.AudioManager.playSe("picoEntrance", { volume: 0.48 });
  await new Promise(resolve => setImmediate(resolve));
  const pointerListeners = run.documentListeners.pointerdown || [];
  pointerListeners.forEach(listener => listener({ type: "pointerdown", isTrusted: true, timeStamp: 77.25 }));
  await new Promise(resolve => setImmediate(resolve));
  await run.context.AudioManager.enterSpeechMode();
  await run.context.AudioManager.exitSpeechMode();
  await new Promise(resolve => setImmediate(resolve));

  const events = trace.events();
  const names = events.map(event => event.checkpoint);
  for (const checkpoint of [
    "startup", "morning-bgm-before", "morning-bgm-after-request", "morning-bgm-after-play-resolved",
    "pico-before", "pico-after-request", "pico-after-play-resolved", "trusted-pointerdown-before",
    "trusted-pointerdown-after", "speech-start-before-recognition", "speech-end-bgm-restore-after"
  ]) check(names.includes(checkpoint), `runtime checkpoint recorded: ${checkpoint}`);

  const morning = events.find(event => event.checkpoint === "morning-bgm-after-play-resolved");
  check(morning.navigationType === "reload" && /^load-/.test(morning.pageLoadId), "reload/page identity is recorded");
  check(morning.contextIdentity && morning.contextState === "running" && morning.contextCurrentTime === 1.5,
    "AudioContext identity/state/currentTime are recorded");
  check(morning.elementIdentity && morning.elementPaused === false && morning.elementVolume === 1 && morning.elementMuted === false,
    "BGM HTMLMediaElement identity/state are recorded");
  check(morning.sourceIdentity && morning.gainIdentity && morning.gainValue === 1,
    "MediaElementSource and GainNode identities/value are recorded");
  check(morning.canonicalContextMatch === true && morning.bgmSourceCount === 1 && morning.bgmNodeCount >= 2,
    "canonical context match and BGM source/node counts are recorded");
  check(morning.activeSourceCount >= 1 && morning.activeNodeCount >= 2, "active source/node totals are recorded");

  const pico = events.find(event => event.checkpoint === "pico-after-play-resolved");
  check(pico.focusElementIdentity && pico.focusSourceIdentity && pico.focusGainIdentity &&
    pico.focusCanonicalContextMatch === true, "Pico SE existing graph identities are recorded");
  const stableOne = trace.snapshot();
  const stableTwo = trace.snapshot();
  check(stableOne.contextIdentity === stableTwo.contextIdentity && stableOne.elementIdentity === stableTwo.elementIdentity &&
    stableOne.sourceIdentity === stableTwo.sourceIdentity && stableOne.gainIdentity === stableTwo.gainIdentity,
    "identities remain stable within one page load");
  check(source.includes('return query.get("speechRestoreDiagnostic") === "delay1500" ? "B" : "A"') &&
    source.includes('return speechRestoreDiagnosticMode() === "B" ? 1500 : 0'), "A/B 1500ms behavior remains exact");
  check(!source.includes("__eigoReloadIdentityReplay") && !source.includes("__eigoReloadIdentityPrime"),
    "identity trace adds no replay or priming route");

  console.log(`iPhone Reload Audio Identity Trace V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
