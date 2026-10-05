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
    constructor() { super(); this.fftSize = 4; this.samples = [0, 0, 0, 0]; analysers.push(this); }
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
    addEventListener() {}, setTimeout() { return 1; }, setInterval() { return 1; },
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
  vm.runInContext(read("engine/managers/audio-manager.js"), context);
  return { context, contexts, analysers, audioElements, documentListeners, dispatch };
}

async function triggerFatalSourceLost(runtime, analyser, audio, startAt = 10000) {
  analyser.samples = [0, 0, 0, 0];
  audio.currentTime = 2;
  assert.equal(runtime.context.CentralAudioRecoveryTrace.check(startAt), false);
  audio.currentTime = 2.3;
  assert.equal(runtime.context.CentralAudioRecoveryTrace.check(startAt + 800), false);
  audio.currentTime = 2.7;
  assert.equal(runtime.context.CentralAudioRecoveryTrace.check(startAt + 1600), true);
  await flush();
}

(async () => {
  {
    const runtime = createRuntime();
    const bgm = runtime.context.AudioManager.playBgm("zephyrFields", { volume: 0.2 });
    const sourceAnalyser = runtime.analysers[0];
    sourceAnalyser.samples = [0.2, -0.2, 0.2, -0.2];
    bgm.currentTime = 1;
    runtime.context.CentralAudioRecoveryTrace.check(1000);
    bgm.currentTime = 2;
    runtime.context.CentralAudioRecoveryTrace.check(3000);
    assert.equal(runtime.context.CentralAudioRecoveryTrace.state().attempt, 0, "healthy signal never rebuilds");

    sourceAnalyser.samples = [0, 0, 0, 0];
    bgm.currentTime = 3;
    runtime.context.CentralAudioRecoveryTrace.check(4000);
    bgm.currentTime = 3.2;
    runtime.context.CentralAudioRecoveryTrace.check(4400);
    sourceAnalyser.samples = [0.2, -0.2, 0.2, -0.2];
    bgm.currentTime = 3.4;
    runtime.context.CentralAudioRecoveryTrace.check(4600);
    assert.equal(runtime.context.CentralAudioRecoveryTrace.state().attempt, 0, "transient loss never rebuilds");

    const motif = runtime.context.AudioManager.playSe("zephyrSuccess");
    const se = runtime.context.AudioManager.playSe("battleHit");
    const oldBgm = bgm;
    await triggerFatalSourceLost(runtime, sourceAnalyser, bgm, 10000);
    assert.equal(runtime.contexts.length, 2, "one replacement context is created");
    assert.equal(runtime.contexts[0].closeCalls, 1, "old context is closed once");
    assert.equal(runtime.contexts[0].state, "closed");
    assert.equal(runtime.contexts[1].state, "running", "only the replacement context remains active");
    assert.equal(oldBgm.paused, true, "old BGM is paused");
    const restored = runtime.context.AudioManager.getState();
    assert.equal(restored.currentBgmAsset, "zephyrFields");
    assert.equal(restored.baseBgmVolume, 0.2);
    assert.equal(restored.busGains.master, 1);
    assert.equal(restored.busGains.voice, 1);
    assert.equal(restored.duckState.dialogueMultiplier, 1);
    assert.equal(restored.duckState.speechMultiplier, 1);
    assert.equal(runtime.context.CentralAudioRecoveryTrace.state().state, "recovered");
    const freshBgm = runtime.audioElements.filter(item => item.src === oldBgm.src).at(-1);
    assert.notEqual(freshBgm, oldBgm, "BGM uses a fresh media element");
    assert(Math.abs(freshBgm.currentTime - 2.7) <= 0.01, "BGM position is restored");
    assert.equal(freshBgm.playCalls, 1, "fresh BGM starts once");
    assert.equal(motif.paused, true, "motif is stopped and not replayed");
    assert.equal(se.paused, true, "SE is stopped and not replayed");
    assert.equal(motif.playCalls, 1);
    assert.equal(se.playCalls, 1);
    const recoveredAnalyser = runtime.analysers.at(-1);
    recoveredAnalyser.samples = [0, 0, 0, 0];
    freshBgm.currentTime = 3.1;
    runtime.context.CentralAudioRecoveryTrace.check(12000);
    freshBgm.currentTime = 3.8;
    runtime.context.CentralAudioRecoveryTrace.check(12800);
    assert.equal(runtime.context.CentralAudioRecoveryTrace.state().attempt, 1,
      "cooldown prevents an immediate rebuild loop");
  }

  {
    const runtime = createRuntime();
    runtime.context.AudioManager.playBgm("futureCityPixel", { volume: 0.12 });
    const voice = runtime.context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", {
      characterGain: 0.82, characterId: 2
    });
    const voiceAnalyser = runtime.analysers[1];
    await triggerFatalSourceLost(runtime, voiceAnalyser, voice.audio, 20000);
    const completion = await voice.completion;
    assert.equal(completion.status, "stopped", "Voice completes without Next deadlock");
    assert.equal(voice.audio.paused, true);
    assert.equal(runtime.audioElements.filter(item => item.src.includes("voice_c02_s001_001")).length, 1,
      "Voice is never automatically replayed");
    assert.equal(runtime.context.CentralAudioRecoveryTrace.state().attempt, 1);
  }

  {
    const runtime = createRuntime([{ state: "running" }, { state: "suspended", rejectResume: true }]);
    const bgm = runtime.context.AudioManager.playBgm("zephyrFields", { volume: 0.2 });
    await triggerFatalSourceLost(runtime, runtime.analysers[0], bgm, 30000);
    assert.equal(runtime.context.CentralAudioRecoveryTrace.state().state, "resume-pending");
    runtime.contexts[1].rejectResume = false;
    runtime.dispatch(runtime.documentListeners, "click");
    await flush();
    assert.equal(runtime.context.CentralAudioRecoveryTrace.state().state, "recovered",
      "trusted gesture resumes the new context and restores BGM");
    assert.equal(runtime.contexts.length, 2, "gesture recovery does not create another context");
  }

  const source = read("engine/managers/audio-manager.js");
  assert(source.includes("SOURCE_LOST_FATAL_MS = 1500"));
  assert(source.includes("RECOVERY_COOLDOWN_BASE_MS = 5000"));
  assert(source.includes('"RECOVERY: state="'));
  assert(!/navigator\.userAgent|\/Safari\//.test(source), "no browser-specific recovery architecture");
  assert(source.includes('profile.ratio === undefined ? 0.18 : Number(profile.ratio)'));
  assert(source.includes("dialogueRatio"));
  console.log("Central Audio Recovery V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
