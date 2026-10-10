"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const managerSource = read("engine/managers/audio-manager.js");
const adapterSource = read("engine/services/speech-recognition-adapter.js");
const indexSource = read("index.html");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

function createRuntime(traceEnabled = true) {
  const created = { gain: 0, source: 0, analyser: 0 };
  const documentListeners = {};
  function add(store, name, callback) { (store[name] ||= []).push(callback); }
  class Node {
    constructor() { this.gain = { value: 1, cancelScheduledValues() {} }; }
    connect(target) { return target; }
    disconnect() {}
  }
  class Audio {
    constructor(src) {
      this.src = src; this.currentSrc = src; this.paused = true; this.ended = false; this.currentTime = 3.25;
      this.readyState = 4; this.networkState = 1; this.volume = 1; this.muted = false; this.listeners = {};
    }
    getAttribute(name) { return name === "src" ? this.src : null; }
    addEventListener(name, callback) { add(this.listeners, name, callback); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  class AudioContext {
    constructor() {
      this.state = "running"; this.currentTime = 8.5; this.sampleRate = 48000; this.baseLatency = 0.0125;
      this.destination = new Node(); this.listeners = {};
    }
    addEventListener(name, callback) { add(this.listeners, name, callback); }
    createGain() { created.gain += 1; return new Node(); }
    createMediaElementSource() { created.source += 1; return new Node(); }
    createAnalyser() {
      created.analyser += 1;
      const node = new Node(); node.fftSize = 4; node.getFloatTimeDomainData = output => output.fill(0); return node;
    }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  class Recognition {
    constructor() { Recognition.instance = this; }
    start() { if (this.onstart) this.onstart(); }
    stop() { if (this.onend) this.onend(); }
    result(transcript, isFinal) {
      const alternative = { transcript, confidence: 0.91 };
      const result = [alternative]; result.isFinal = isFinal;
      this.onresult({ resultIndex: 0, results: [result] });
    }
    end() { this.onend(); }
  }
  const audioSessionListeners = {};
  const audioSession = {
    type: "play-and-record", state: "active",
    addEventListener(name, callback) { add(audioSessionListeners, name, callback); }
  };
  const document = {
    body: { appendChild() {} }, visibilityState: "visible", hidden: false, hasFocus: () => true,
    addEventListener(name, callback) { add(documentListeners, name, callback); }, removeEventListener() {},
    createElement() { return { style: {}, appendChild() {}, textContent: "", id: "" }; },
    getElementById() { return null; }
  };
  const context = {
    console: { log() {}, warn() {}, error() {} }, Promise, WeakMap, Float32Array, Date, Math, URLSearchParams,
    Audio, AudioContext, SpeechRecognition: Recognition, document, navigator: { audioSession },
    location: { search: traceEnabled ? "?audioTrace=1" : "" }, innerWidth: 390, innerHeight: 844,
    screen: { orientation: { type: "portrait-primary", addEventListener() {} } }, addEventListener() {},
    setTimeout(callback) { callback(); return 1; }, clearTimeout() {}, setInterval() { return 1; },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: { assets: { zephyrFields: { category: "BGM" } } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  vm.runInContext(managerSource, context);
  vm.runInContext(adapterSource, context);
  return { context, created, Recognition, audioSession, audioSessionListeners };
}

(async () => {
  check(managerSource.includes('SPEECH_RESULT_AUDIO_ROUTE_TRACE_VERSION = "iphone-safari-speech-result-audio-route-trace-v1"'),
    "Trace version marker exists");
  check(indexSource.includes("speechResultAudioTrace=iphone-safari-speech-result-audio-route-trace-v1"),
    "production cache URLs select the Speech Result trace build");
  for (const checkpoint of [
    "speech-start-before-recognition", "speech-recognition-before-start-call", "speech-recognition-onstart",
    "speech-recognition-first-result-before-processing", "speech-recognition-first-result-after-processing",
    "speech-recognition-onend", "speech-exit-mode-before", "speech-exit-mode-after",
    "speech-bgm-restore-before", "speech-bgm-restore-after"
  ]) check(managerSource.includes(`"${checkpoint}"`) || adapterSource.includes(`"${checkpoint}"`),
    `checkpoint exists: ${checkpoint}`);

  const run = createRuntime(true);
  run.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  await Promise.resolve(); await Promise.resolve();
  await run.context.AudioManager.enterSpeechMode();
  const listen = run.context.SpeechRecognitionAdapter.listen({ interimResults: true });
  const recognition = run.Recognition.instance;
  recognition.result("hello", true);
  recognition.end();
  check(await listen === "hello", "Recognition result behavior remains unchanged");
  await run.context.AudioManager.exitSpeechMode();

  const trace = run.context.SpeechResultAudioRouteTrace;
  check(trace.version === "iphone-safari-speech-result-audio-route-trace-v1" && trace.limit === 128,
    "public Trace API exposes version and 128-event storage");
  const events = trace.events();
  const names = events.map(event => event.checkpoint);
  const ordered = [
    "speech-start-before-recognition", "speech-recognition-before-start-call", "speech-recognition-onstart",
    "speech-recognition-first-result-before-processing", "speech-recognition-first-result-after-processing",
    "speech-recognition-onend", "speech-exit-mode-before", "speech-exit-mode-after",
    "speech-bgm-restore-before", "speech-bgm-restore-after"
  ];
  for (const checkpoint of ordered) check(names.includes(checkpoint), `runtime checkpoint recorded: ${checkpoint}`);
  for (let i = 1; i < ordered.length; i += 1) {
    check(names.indexOf(ordered[i - 1]) < names.indexOf(ordered[i]),
      `${ordered[i - 1]} precedes ${ordered[i]}`);
  }

  const before = events.find(event => event.checkpoint === "speech-recognition-first-result-before-processing");
  const after = events.find(event => event.checkpoint === "speech-recognition-first-result-after-processing");
  check(before.recognitionInstanceIdentity === "rec1" && before.recognitionEvent === "result" &&
    before.resultIndex === 0 && before.resultsLength === 1 && before.isFinal === true && before.transcript === "hello",
    "first-result Recognition metadata is recorded before processing");
  check(after.recognitionInstanceIdentity === "rec1" && after.transcript === "hello",
    "the same first-result metadata is recorded after processing");
  check(before.contextIdentity && before.contextState === "running" && before.contextCurrentTime === 8.5 &&
    before.contextSampleRate === 48000 && before.contextBaseLatency === 0.0125,
    "AudioContext identity/state/time/sampleRate/baseLatency are recorded");
  check(before.audioSessionSupported === true && before.audioSessionType === "play-and-record" &&
    before.audioSessionState === "active", "navigator.audioSession snapshot is recorded read-only");
  check(before.bgmElementIdentity && before.bgmSrc === "zephyrFields.mp3" &&
    before.bgmCurrentSrc === "bgm/zephyrFields.mp3" && before.bgmCurrentTime === 3.25 &&
    before.bgmPaused === true && before.bgmEnded === false && before.bgmMuted === false &&
    before.bgmVolume === 1 && before.bgmReadyState === 4 && before.bgmNetworkState === 1,
    "BGM HTMLMediaElement state is recorded at first result");
  check(before.sourceIdentity && before.gainIdentity && before.gainValue === 0.46 &&
    before.graphContextIdentity === before.contextIdentity && before.canonicalContextMatch === true &&
    before.bgmSourceCount === 1 && before.managedSourceCount === 1 &&
    before.bgmNodeCount === 3 && before.managedNodeCount === 3,
    "Web Audio graph identity/gain/count/canonical state is recorded");

  run.audioSession.state = "inactive";
  (run.audioSessionListeners.statechange || []).forEach(callback => callback({ type: "statechange" }));
  const sessionChange = trace.events().find(event => event.checkpoint === "audio-session-statechange");
  check(sessionChange && sessionChange.previousAudioSessionState === "active" &&
    sessionChange.currentAudioSessionState === "inactive", "audioSession statechange is observed read-only");

  const createdBefore = { ...run.created };
  trace.snapshot(); trace.events();
  check(JSON.stringify(run.created) === JSON.stringify(createdBefore), "Trace snapshots create no Audio nodes");

  const off = createRuntime(false);
  off.context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  await off.context.AudioManager.enterSpeechMode();
  const offListen = off.context.SpeechRecognitionAdapter.listen({});
  off.Recognition.instance.result("hello", true); off.Recognition.instance.end(); await offListen;
  await off.context.AudioManager.exitSpeechMode();
  check(off.context.SpeechResultAudioRouteTrace.events().length === 0, "Trace OFF stores no events");

  check(managerSource.includes('return query.get("speechRestoreDiagnostic") === "delay1500" ? "B" : "A"') &&
    managerSource.includes('return speechRestoreDiagnosticMode() === "B" ? 1500 : 0'),
    "existing B-condition 1500ms remains unchanged");
  check(!managerSource.includes("__eigoSpeechResultReplay") && !adapterSource.includes("__eigoSpeechResultReplay"),
    "Trace adds no play/resume/retry route");

  console.log(`iPhone Safari Speech Result Audio Route Trace V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
