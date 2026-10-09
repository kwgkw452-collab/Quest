"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const flush = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};

function createRuntime(contextPlans = [{ state: "running" }, { state: "running" }]) {
  const documentListeners = {};
  const audioElements = [];
  const contexts = [];
  const analysers = [];
  const add = (store, name, listener) => (store[name] ||= []).push(listener);
  const dispatch = (store, name) => (store[name] || []).slice().forEach(listener => listener({ type: name }));

  const document = {
    readyState: "complete", body: { appendChild() {} }, visibilityState: "visible", hidden: false,
    hasFocus: () => true,
    addEventListener(name, listener) { add(documentListeners, name, listener); },
    removeEventListener(name, listener) {
      if (documentListeners[name]) documentListeners[name] = documentListeners[name].filter(item => item !== listener);
    },
    createElement() { return { style: {}, appendChild() {}, textContent: "", id: "" }; },
    getElementById() { return null; }
  };

  class FakeAudio {
    constructor(src) {
      this.src = src; this.paused = true; this.ended = false; this.currentTime = 0; this.duration = 30;
      this.readyState = 4; this.networkState = 1; this.volume = 1; this.muted = false; this.loop = false;
      this.listeners = {}; this.playCalls = 0; this.pauseCalls = 0;
      audioElements.push(this);
    }
    getAttribute(name) { return name === "src" ? this.src : null; }
    addEventListener(name, listener) { add(this.listeners, name, listener); }
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); }
    pause() { this.pauseCalls += 1; this.paused = true; }
    emit(name) {
      if (name === "ended") { this.ended = true; this.paused = true; }
      dispatch(this.listeners, name);
    }
  }

  class FakeNode {
    constructor() {
      this.gain = { value: 0, cancelScheduledValues() {} };
      this.frequency = { value: 0 }; this.Q = { value: 0 };
      this.threshold = { value: 0 }; this.knee = { value: 0 }; this.ratio = { value: 0 };
      this.attack = { value: 0 }; this.release = { value: 0 }; this.connections = []; this.disconnected = false;
    }
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; this.connections = []; }
  }

  class FakeAnalyser extends FakeNode {
    constructor() { super(); this.fftSize = 4; this.samples = [0.2, -0.2, 0.2, -0.2]; analysers.push(this); }
    getFloatTimeDomainData(output) {
      for (let index = 0; index < output.length; index += 1) output[index] = this.samples[index % this.samples.length];
    }
  }

  class FakeContext {
    constructor() {
      const plan = contextPlans[contexts.length] || { state: "running" };
      this.state = plan.state; this.rejectResume = plan.rejectResume === true; this.currentTime = 0;
      this.destination = new FakeNode(); this.listeners = {}; this.closeCalls = 0; this.resumeCalls = 0;
      contexts.push(this);
    }
    addEventListener(name, listener) { add(this.listeners, name, listener); }
    createGain() { return new FakeNode(); }
    createMediaElementSource() { return new FakeNode(); }
    createDynamicsCompressor() { return new FakeNode(); }
    createBiquadFilter() { return new FakeNode(); }
    createWaveShaper() { return new FakeNode(); }
    createAnalyser() { return new FakeAnalyser(); }
    resume() {
      this.resumeCalls += 1;
      if (this.rejectResume) return Promise.reject(new Error("gesture-required"));
      this.state = "running"; dispatch(this.listeners, "statechange"); return Promise.resolve();
    }
    close() { this.closeCalls += 1; this.state = "closed"; dispatch(this.listeners, "statechange"); return Promise.resolve(); }
  }

  const context = {
    console: { log() {}, warn() {} }, Promise, Float32Array, Date, Math, URLSearchParams,
    Audio: FakeAudio, AudioContext: FakeContext, document,
    location: { search: "" }, innerWidth: 390, innerHeight: 844, orientation: 0,
    screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
    addEventListener() {}, setTimeout, clearTimeout, setInterval() { return 1; },
    AssetManager: { audio(type, key) { return `${type}/${key}.mp3`; } },
    AudioDatabase: {
      assets: {
        zephyrSuccess: { category: "MOTIF", file: "audio/jingle/zephyr.mp3" },
        battleHit: { category: "SE", file: "audio/se/hit.mp3" }
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  vm.runInContext(read("data/voice-profiles.js"), context);
  context.AudioMixProfile.ducking.dialogueVoice.duckMs = 0;
  context.AudioMixProfile.ducking.dialogueVoice.restoreMs = 0;
  context.AudioMixProfile.ducking.speechRecognition.duckMs = 0;
  context.AudioMixProfile.ducking.speechRecognition.restoreMs = 0;
  vm.runInContext(read("engine/managers/audio-manager.js"), context);
  return { context, contexts, analysers, audioElements, documentListeners, dispatch };
}



function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
function check(condition, message) { assert(condition, message); checks += 1; }
function createSpeechRuntime() {
  const r = createRuntime(), c = r.context, events = [], recognitions = [];
  let entryGate = null;
  const realEnter = c.AudioManager.enterSpeechMode, realExit = c.AudioManager.exitSpeechMode;
  c.AudioManager.enterSpeechMode = async function (...args) {
    check(args.length === 0, "Phase 1 no-options entry API used");
    events.push("enter-call");
    if (entryGate) await entryGate.promise;
    const result = await realEnter(); events.push("enter-complete"); return result;
  };
  c.AudioManager.exitSpeechMode = async function (...args) {
    check(args.length === 0, "Phase 1 no-options exit API used");
    events.push("exit-call"); const result = await realExit(); events.push("exit-complete"); return result;
  };
  class Recognition {
    constructor() { recognitions.push(this); this.starts = 0; }
    start() {
      this.starts += 1; events.push("recognition-start");
      check(c.AudioManager.getState().speechMode.state === "active", "active confirmed before real recognition.start");
      check(c.AudioManager.getState().effectiveBgmVolume === 0, "Recognition starts with BGM isolated");
      if (this.onstart) this.onstart();
    }
    stop() { events.push("recognition-stop"); if (this.onend) this.onend(); }
    abort() { this.error("aborted"); this.stop(); }
    error(code) { this.onerror({ error: code }); }
    end(text, alternatives = []) {
      if (text) {
        const result = [{ transcript: text, confidence: 0.9 }, ...alternatives.map(transcript => ({ transcript, confidence: 0.5 }))];
        result.isFinal = true; this.onresult({ resultIndex: 0, results: [result] });
      }
      this.onend();
    }
  }
  c.SpeechRecognition = Recognition; c.GameConfig = { defaultLanguage: "en-US" };
  for (const file of ["engine/services/speech-normalizer.js", "engine/services/speech-recognition-adapter.js", "engine/services/speech-engine.js", "engine/services/speech-start-controller.js"]) vm.runInContext(read(file), c);
  const bgm = c.AudioManager.playBgm("zephyrFields", { volume: 0.2 });
  return Object.assign(r, { events, recognitions, bgm, gate(value) { entryGate = value; } });
}
async function started(r) { await flush(); check(r.recognitions.length > 0, "Recognition session starts"); return r.recognitions.at(-1); }
async function restored(r) { await wait(5); await flush(); check(r.context.AudioManager.getState().speechMode.state === "idle", "Speech Mode exits without stuck state"); }

(async () => {
  {
    const r = createSpeechRuntime(), c = r.context, gate = deferred(); r.gate(gate);
    await c.SpeechStartController.prepare();
    check(!r.events.includes("enter-call") && !r.bgm.paused, "preparing the Speech button keeps BGM available");
    const run = c.SpeechStartController.startListening({}); const duplicate = c.SpeechStartController.startListening({});
    check(run === duplicate, "double click shares one attempt");
    await flush(); check(r.recognitions.length === 0, "entry pending prevents recognition construction/start");
    gate.resolve(); const recognition = await started(r);
    check(r.events.indexOf("enter-complete") < r.events.indexOf("recognition-start"), "entry completion strictly precedes recognition.start");
    recognition.end("Hello!"); check(await run === "Hello!", "raw success transcript remains unchanged");
    await restored(r); check(r.events.filter(e => e === "exit-call").length === 1, "success exits exactly once");
  }
  for (const [verdict, text] of [["ACCEPT", "Can I have an apple?"], ["REJECT", "I don't want an apple."], ["UNKNOWN", "May I get an apple?"]]) {
    const r = createSpeechRuntime(), c = r.context;
    for (const file of ["data/word-dictionaries.js", "data/communicative-judge-rules.js", "engine/services/local-communicative-judge.js", "engine/services/communicative-judge.js"]) vm.runInContext(read(file), c);
    const input = utterance => ({ conceptId: "shopping.fruit.apple.order", utterance });
    const before = await c.CommunicativeJudge.judge(input(text));
    check(before.verdict === verdict, "baseline actual Judge " + verdict);
    const run = c.SpeechStartController.startListening({}); (await started(r)).end(text);
    const transcript = await run;
    const after = await c.CommunicativeJudge.judge(input(transcript));
    check(JSON.stringify(before) === JSON.stringify(after), verdict + " actual Judge result unchanged after lifecycle hook");
    await restored(r); check(r.events.filter(e => e === "exit-call").length === 1, verdict + " exits once");
  }
  for (const code of ["no-speech", "speech-error", "not-allowed", "aborted", "network"]) {
    const r = createSpeechRuntime(); const run = r.context.SpeechStartController.startListening({});
    const outcome = run.then(() => null, error => error.message);
    const recognition = await started(r); recognition.error(code); recognition.onend();
    check(await outcome === code, code + " error code preserved");
    await restored(r); check(r.events.filter(e => e === "exit-call").length === 1, code + " error/end duplicate exits prevented");
  }
  {
    const r = createSpeechRuntime(); const run = r.context.SpeechStartController.startListening({ timeoutMs: 20 });
    const outcome = run.then(() => null, error => error.message); await started(r);
    // Original Adapter stops first; onend with no final text still chooses no-speech.
    check(await outcome === "no-speech", "existing timeout stop/end error precedence preserved"); await restored(r);
    check(r.events.filter(e => e === "exit-call").length === 1, "timeout path exits once");
  }
  {
    const r = createSpeechRuntime(); const run = r.context.SpeechEngine.listen({});
    const outcome = run.then(() => null, error => error.message); (await started(r)).onend();
    check(await outcome === "no-speech", "bare recognition end preserves no-speech outcome"); await restored(r);
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    const run = c.SpeechStartController.startListening({}); const outcome = run.then(() => null, error => error.message);
    await started(r); c.SpeechStartController.cancel();
    check(await outcome === "no-speech", "controller cancel keeps original adapter result"); await restored(r);
    check(r.events.filter(e => e === "exit-call").length === 1, "cancel plus end exits once");
  }
  {
    const r = createSpeechRuntime(), c = r.context, gate = deferred(); r.gate(gate);
    const run = c.SpeechStartController.startListening({}); const outcome = run.then(() => null, error => error.message);
    await flush(); c.SpeechStartController.cancel(); gate.resolve();
    check(await outcome === "aborted" && r.recognitions.length === 0, "cancel during entry prevents delayed recognition.start");
    await restored(r); check(r.events.filter(e => e === "exit-call").length === 1, "cancel during entry releases isolation once");
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    const mission = c.SpeechEngine.mission({ accepted: ["hello"] });
    (await started(r)).end("wrong"); await flush();
    check(r.recognitions.length === 2, "existing automatic mismatch retry starts second attempt");
    check(r.events.filter(e => e === "exit-call").length === 0 && r.bgm.playCalls === 1, "automatic retry does not restore/stop BGM");
    r.recognitions.at(-1).end("hello"); check(await mission === "hello", "retry recognition and Judge result preserved");
    await restored(r); check(r.events.filter(e => e === "exit-call").length === 1 && r.bgm.playCalls === 2, "continuous retry releases once before success returns");
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    const first = c.SpeechStartController.startListening({}); (await started(r)).end("wrong"); await first;
    await restored(r); check(!r.bgm.paused, "Pico Support/button-wait interval permits BGM restoration");
    const prior = r.events.length; const next = c.SpeechStartController.startListening({}); await started(r);
    const events = r.events.slice(prior); check(events.indexOf("enter-complete") < events.indexOf("recognition-start"), "Pico Support next Speech awaits fresh entry");
    r.recognitions.at(-1).end("hello"); await next; await restored(r);
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    c.AudioManager.enterSpeechMode = async () => false;
    const outcome = c.SpeechEngine.listen({}).then(() => null, e => e.message);
    check(await outcome === "audio-isolation-not-active" && r.recognitions.length === 0, "failed entry never opens microphone"); await restored(r);
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    const run = c.SpeechEngine.listen({ accepted: ["pear"] }); (await started(r)).end("pair", ["pear"]);
    check(await run === "pear", "existing accepted-alternative selection preserved"); await restored(r);
    check(c.SpeechEngine.judge("Hello!", ["hello"]), "existing normalizer/includes Judge preserved");
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    const run = c.SpeechEngine.listen({ timeoutMs: 20 }); const outcome = run.then(() => null, e => e.message);
    const recognition = await started(r);
    recognition.stop = () => { r.events.push("stop-without-end"); };
    await wait(30); await flush();
    check(!r.events.includes("exit-call"), "timeout cannot restore Audio before browser onend");
    recognition.onend();
    check(await outcome === "speech-timeout", "timeout verdict is delivered after browser onend");
    await restored(r); check(r.events.filter(e => e === "exit-call").length === 1, "timeout without end exits once");
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    c.SpeechRecognition.prototype.start = function () { throw new Error("start-failed"); };
    const outcome = c.SpeechEngine.listen({}).then(() => null, e => e.message);
    check(await outcome === "start-failed", "synchronous recognition.start error unchanged");
    await restored(r); check(r.events.filter(e => e === "exit-call").length === 1, "synchronous start failure exits once");
  }
  {
    const r = createSpeechRuntime(), c = r.context, gate = deferred(); r.gate(gate);
    const first = c.SpeechEngine.listen({}).catch(e => e.message); await flush(); c.SpeechEngine.stop();
    const second = c.SpeechEngine.listen({}).catch(e => e.message); await flush(); c.SpeechEngine.stop();
    const third = c.SpeechEngine.listen({}); gate.resolve();
    check(await first === "aborted" && await second === "aborted", "repeated cancellation during entry preserves canceled attempts");
    await started(r); check(r.recognitions.length === 1 && c.AudioManager.getState().speechMode.state === "active", "stale releases cannot undo the newest active isolation");
    r.recognitions[0].end("hello"); check(await third === "hello", "new Speech remains usable after repeated cancellation");
    await restored(r);
  }
  {
    const r = createSpeechRuntime(), c = r.context;
    const run = c.SpeechStartController.startListening({}); const recognition = await started(r);
    r.contexts[0].state = "interrupted"; r.contexts[0].rejectResume = true;
    recognition.end("hello"); check(await run === "hello", "failed context recovery does not rewrite transcript");
    check(c.AudioManager.getState().speechMode.state === "active" && r.bgm.paused, "unfinished exit stays safely isolated pending gesture");
    r.contexts[0].rejectResume = false;
    r.dispatch(r.documentListeners, "click"); r.dispatch(r.documentListeners, "pointerdown"); await flush();
    check(c.AudioManager.getState().speechMode.state === "idle" && !r.bgm.paused, "existing trusted gesture Recovery completes unfinished exit without stuck isolation");
    check(r.bgm.playCalls === 2, "recovery does not duplicate BGM playback");
  }
  console.log(`Speech Mode Audio Isolation V1 Phase 2: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
