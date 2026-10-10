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

function runtime() {
  const documentListeners = {};
  const created = { gain: 0, source: 0, analyser: 0 };
  function add(store, name, callback) { (store[name] ||= []).push(callback); }
  class Node {
    constructor() { this.gain = { value: 1, cancelScheduledValues() {} }; this.disconnected = false; }
    connect(target) { this.target = target; return target; }
    disconnect() { this.disconnected = true; }
  }
  class Audio {
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
  class AudioContext {
    constructor() {
      this.state = "running"; this.currentTime = 4.5; this.destination = new Node(); this.listeners = {};
    }
    addEventListener(name, callback) { add(this.listeners, name, callback); }
    createGain() { created.gain += 1; return new Node(); }
    createMediaElementSource() { created.source += 1; return new Node(); }
    createAnalyser() {
      created.analyser += 1;
      const node = new Node(); node.fftSize = 4; node.getFloatTimeDomainData = output => output.fill(0);
      return node;
    }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  const document = {
    body: { appendChild() {} }, visibilityState: "visible", hidden: false, hasFocus: () => true,
    addEventListener(name, callback) { add(documentListeners, name, callback); }, removeEventListener() {},
    createElement() { return { style: {}, appendChild() {}, textContent: "", id: "" }; },
    getElementById() { return null; }
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, Promise, WeakMap, Float32Array, Date, Math, URLSearchParams,
    Audio, AudioContext, document, navigator: {}, location: { search: "?audioTrace=1" },
    innerWidth: 390, innerHeight: 844, screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
    addEventListener() {}, setTimeout(callback) { callback(); return 1; }, clearTimeout,
    setInterval() { return 1; },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: { assets: {
      zephyrFields: { category: "BGM" }, picoEntrance: { category: "SE" }, battleHit: { category: "SE" }
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
  check(source.includes('LOUD_AUDIO_GRAPH_IDENTITY_TRACE_VERSION = "iphone-safari-loud-audio-graph-identity-trace-v2"'),
    "V2 version marker exists");
  check(index.includes("loudGraphTrace=iphone-safari-loud-audio-graph-identity-trace-v2"),
    "production cache URL selects V2 trace build");
  for (const checkpoint of [
    "bgm-play-request-before", "bgm-play-resolved-after", "pico-se-request-before",
    "pico-se-resolved-after", "pico-se-rejected-after", "audio-context-statechange",
    "trusted-pointerdown", "speech-mode-enter-before", "speech-start-before-recognition",
    "speech-end-after", "bgm-restore-before", "bgm-restore-after"
  ]) check(source.includes(`"${checkpoint}"`), `checkpoint exists: ${checkpoint}`);

  const run = runtime();
  const trace = run.context.LoudAudioGraphIdentityTrace;
  check(trace.version === "iphone-safari-loud-audio-graph-identity-trace-v2", "public V2 trace API exists");
  const beforeSnapshot = { ...run.created };
  trace.snapshot(); trace.lines();
  check(JSON.stringify(run.created) === JSON.stringify(beforeSnapshot), "snapshot and panel lines create no Audio nodes");

  run.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  run.context.AudioManager.playSe("picoEntrance", { volume: 0.48 });
  run.context.AudioManager.playSe("battleHit", { volume: 0.4 });
  await new Promise(resolve => setImmediate(resolve));

  const identity = run.context.ReloadAudioIdentityTrace.snapshot();
  check(identity.bgmSourceCount === 1 && identity.activeSourceCount === 3,
    "existing sources=1/3 definition is preserved");
  check(identity.bgmNodeCount === 3 && identity.activeNodeCount === 7,
    "existing nodes=3/7 definition is preserved");

  const detail = trace.snapshot();
  check(detail.graphs.length === 3 && detail.sourceRegisteredCount === 3 && detail.nodeRegisteredCount === 7,
    "three graphs, three sources, and seven nodes are individually registered");
  check(detail.graphs.map(graph => graph.sourceIndex).join(",") === "1,2,3",
    "SOURCE[1..3] indices are individually assigned");
  check(detail.graphs.every(graph => graph.graphIdentity && graph.contextIdentity && graph.elementIdentity &&
    graph.sourceIdentity && graph.gainIdentity), "all graph identities are present");
  check(detail.graphs.every(graph => graph.contextState === "running" && graph.canonicalContextMatch === true),
    "all graph contexts and canonical matches are recorded");
  check(detail.graphs.every(graph => graph.createdAt && graph.createdBy === "buildSimpleGraph" &&
    graph.creationReason && graph.generationSequence), "creation metadata is recorded");
  check(detail.graphs.every(graph => graph.playing === true && graph.active === true &&
    graph.destinationConnected === true && graph.disconnected === false),
    "live playing/active/connected state is recorded");
  check(detail.graphs[0].canonicalElementMatch === true && detail.graphs[0].canonicalSourceMatch === true &&
    detail.graphs[0].canonicalGainMatch === true, "canonical BGM element/source/gain are identified");
  check(detail.graphs.slice(1).every(graph => !graph.canonicalElementMatch && !graph.canonicalSourceMatch &&
    !graph.canonicalGainMatch), "non-canonical one-shot graphs are distinguished");
  check(detail.graphs.every(graph => graph.elementSource && graph.elementCurrentTime === 0 &&
    graph.elementPaused === false && graph.elementEnded === false && graph.elementMuted === false &&
    graph.elementVolume === 1), "HTMLMediaElement state is recorded");
  check(detail.graphs.every(graph => graph.gainValue !== null && graph.nodes.every(node => node.identity)),
    "gain values and every node identity are recorded");
  check(trace.lines().some(line => line.includes("SOURCE[3]")) &&
    trace.lines().some(line => line.includes("NODE[7]")), "panel enumerates SOURCE[3] and NODE[7]");

  await run.context.AudioManager.enterSpeechMode();
  const afterSpeech = trace.snapshot();
  check(afterSpeech.graphs.filter(graph => graph.asset !== "zephyrFields").every(graph =>
    graph.retired && graph.disconnected && !graph.destinationConnected),
    "Speech cleanup is observed as retired/disconnected without changing cleanup behavior");
  const restoredCounts = run.context.ReloadAudioIdentityTrace.snapshot();
  check(restoredCounts.bgmSourceCount === 1 && restoredCounts.activeSourceCount === 1 &&
    restoredCounts.bgmNodeCount === 3 && restoredCounts.activeNodeCount === 3,
    "Speech entry returns existing count display to sources=1/1 and nodes=3/3");

  check(source.includes('return query.get("speechRestoreDiagnostic") === "delay1500" ? "B" : "A"') &&
    source.includes('return speechRestoreDiagnosticMode() === "B" ? 1500 : 0'),
    "B-condition 1500ms behavior remains exact");
  check(!source.includes("__eigoLoudGraphReplay") && !source.includes("__eigoLoudGraphPrime"),
    "V2 trace adds no replay or priming behavior");

  console.log(`iPhone Safari Loud Audio Graph Identity Trace V2: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
