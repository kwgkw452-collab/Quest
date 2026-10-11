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

function runtime(traceOn) {
  const created = { gain: 0, source: 0, connect: 0, disconnect: 0 };
  function add(store, name, callback) { (store[name] ||= []).push(callback); }
  class Node {
    constructor(context) {
      this.context = context; this.gain = { value: 1, cancelScheduledValues() {} };
    }
    connect(target) { created.connect += 1; this.target = target; return target; }
    disconnect() { created.disconnect += 1; }
  }
  class Audio {
    constructor(src) {
      this.src = src; this.currentSrc = src; this.paused = true; this.ended = false; this.currentTime = 0;
      this.readyState = 4; this.networkState = 1; this.volume = 1; this.muted = false; this.listeners = {};
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
    constructor() {
      this.state = "running"; this.currentTime = 5; this.sampleRate = 48000; this.baseLatency = 0.01;
      this.destination = new Node(this); this.listeners = {};
    }
    addEventListener(name, callback) { add(this.listeners, name, callback); }
    createGain() { created.gain += 1; return new Node(this); }
    createMediaElementSource() { created.source += 1; return new Node(this); }
    createAnalyser() {
      const node = new Node(this); node.fftSize = 4; node.getFloatTimeDomainData = output => output.fill(0); return node;
    }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  const document = {
    body: { appendChild() {} }, visibilityState: "visible", hidden: false, hasFocus: () => true,
    addEventListener() {}, removeEventListener() {},
    createElement() { return { style: {}, appendChild() {}, textContent: "", id: "" }; },
    getElementById() { return null; }
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, Promise, WeakMap, Float32Array, Date, Math, URLSearchParams,
    Audio, AudioContext, document, navigator: {}, location: { search: traceOn ? "?audioTrace=1" : "" },
    innerWidth: 390, innerHeight: 844, screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
    addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: { assets: {
      zephyrFields: { category: "BGM" }, battleHit: { category: "SE" }
    } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  vm.runInContext(source, context);
  return { context, created };
}

(async () => {
  check(source.includes('AUDIO_FINAL_ISOLATION_DIAGNOSTIC_VERSION = "iphone-safari-audio-final-isolation-diagnostic-v1"'),
    "diagnostic version marker exists");
  check(index.includes("finalDiagnostic=iphone-safari-audio-final-isolation-diagnostic-v1"),
    "production cache marker selects final diagnostic");
  check(source.includes('query.get("audioTrace") === "1"'), "existing audioTrace=1 enables the panel");

  for (const helper of [
    "finalDiagnosticCreateMediaElementSource", "finalDiagnosticCreateGain", "finalDiagnosticConnect",
    "finalDiagnosticDisconnect", "recordFinalDiagnosticMonsterSe", "finalDiagnosticResumeCall",
    "finalDiagnosticResumeSettlement", "audioFinalDiagnosticSummary", "audioFinalDiagnosticLines"
  ]) check(source.includes(`function ${helper}`), `instrumentation exists: ${helper}`);

  check((source.match(/\.createMediaElementSource\(/g) || []).length === 1,
    "all MediaElementSource creation routes through one diagnostic wrapper");
  check((source.match(/\.createGain\(/g) || []).length === 1,
    "all Gain creation routes through one diagnostic wrapper");
  check((source.match(/\.connect\(/g) || []).length === 1,
    "all connect calls route through one diagnostic wrapper");
  check((source.match(/\.disconnect\(/g) || []).length === 1,
    "all disconnect calls route through one diagnostic wrapper");

  const run = runtime(true);
  const diagnostic = run.context.AudioFinalIsolationDiagnostic;
  check(diagnostic.version === "iphone-safari-audio-final-isolation-diagnostic-v1", "public diagnostic API exists");
  check(diagnostic.eventLimit === 256, "event storage is bounded at 256");

  run.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  run.context.AudioManager.playSe("battleHit", { volume: 0.8 });
  await new Promise(resolve => setImmediate(resolve));

  const summary = diagnostic.summary();
  check(summary.mediaElementSourceCreates === run.created.source && summary.mediaElementSourceCreates === 2,
    "actual MediaElementSource calls are counted directly");
  check(summary.gainCreates === run.created.gain && summary.gainCreates === 8,
    "actual Gain calls are counted directly");
  check(summary.connectCalls === run.created.connect && summary.connectCalls === 14,
    "actual connect calls are counted directly");
  check(summary.disconnectCalls === run.created.disconnect && summary.disconnectCalls === 0,
    "actual disconnect calls are counted directly");
  check(summary.appDuplicateCreation === "NOT OBSERVED", "no same-role/element duplicate is overclaimed");
  check(summary.contextState === "running" && summary.canonicalContextMatch === true,
    "canonical context identity and state are summarized");
  check(summary.bgmSourceCount === 1 && summary.activeSourceCount === 2,
    "BGM and active source counts are preserved");
  check(summary.bgmNodeCount === 3 && summary.activeNodeCount === 5,
    "BGM and active node counts are preserved");
  check(summary.monsterSe && summary.monsterSe.seName === "battleHit" &&
    summary.monsterSe.playResult === "resolved", "Monster SE play resolution is summarized");
  check(summary.monsterSe.audible === "unknown", "audibility is not falsely inferred");
  check(summary.monsterSe.canonicalContextMatch === true && summary.monsterSe.sourceIdentity &&
    summary.monsterSe.gainIdentity, "Monster SE route identities are recorded");

  const events = diagnostic.events();
  for (const type of ["createGain", "createMediaElementSource", "connect", "monster-se-call",
    "monster-se-pending", "monster-se-resolved"]) {
    check(events.some(event => event.type === type), `event captured: ${type}`);
  }
  const sourceEvent = events.find(event => event.type === "createMediaElementSource");
  check(sourceEvent.contextIdentity && sourceEvent.elementIdentity && sourceEvent.sourceIdentity &&
    sourceEvent.mediaSrc && sourceEvent.role && sourceEvent.reason && sourceEvent.caller,
    "source factory identity, role, reason, and caller are recorded");
  const gainEvent = events.find(event => event.type === "createGain");
  check(gainEvent.gainIdentity && gainEvent.initialGainValue === 1 && gainEvent.role,
    "gain identity, initial value, and role are recorded");
  const connectEvent = events.find(event => event.type === "connect");
  check(connectEvent.sourceNodeIdentity && connectEvent.destinationNodeIdentity &&
    connectEvent.duplicatePair === false, "connect identities and duplicate-pair result are recorded");

  const createdBeforeRead = JSON.stringify(run.created);
  diagnostic.summary(); diagnostic.events();
  check(JSON.stringify(run.created) === createdBeforeRead, "summary reads create no Audio nodes or connections");

  const off = runtime(false);
  off.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  await new Promise(resolve => setImmediate(resolve));
  check(off.context.AudioFinalIsolationDiagnostic.events().length === 0,
    "Trace OFF stores no diagnostic events");
  check(off.created.source === 1 && off.created.gain === 7 && off.created.connect === 9,
    "Trace OFF preserves existing graph construction counts");

  check(source.includes('return speechRestoreDiagnosticMode() === "B" ? 1500 : 0'),
    "existing B-condition 1500ms remains unchanged");
  check(!source.includes("WEBKIT BUG CONFIRMED"), "diagnostic never claims a confirmed WebKit bug");
  check(!/audioSession\s*\.\s*(type|state)\s*=/.test(source), "navigator.audioSession remains read only");

  console.log(`iPhone Safari Audio Final Isolation Diagnostic V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
