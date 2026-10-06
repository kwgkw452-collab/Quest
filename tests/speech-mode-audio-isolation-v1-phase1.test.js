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


const json = value => JSON.parse(JSON.stringify(value));
const playingBgm = r => r.audioElements.filter(a => a.__eigoBgmTrack && !a.paused && !a.__eigoStopped);
let checks = 0;
function check(condition, message) { assert(condition, message); checks += 1; }

(async () => {
  {
    const r = createRuntime(), manager = r.context.AudioManager;
    const bgm = manager.playBgm("zephyrFields", { volume: 0.2 });
    bgm.currentTime = 12.5;
    const motif = manager.playSe("zephyrSuccess"), se = manager.playSe("battleHit");
    const effectVoice = manager.playVoice("effectVoice");
    const dialogue = r.context.DialogueVoiceAudioInternal.play("voice_c02_s001_001");
    const before = json(manager.getState()), profile = JSON.stringify(r.context.AudioMixProfile);
    const buses = bgm.__eigoBgmTrack.gainNode.connections[0];
    // Prove isolation does not write HTMLMediaElement.volume.
    for (const a of r.audioElements) Object.defineProperty(a, "volume", { get: () => 1, set() { throw new Error("volume-write"); } });
    const enter = manager.enterSpeechMode();
    check(typeof enter.then === "function", "entry completion is awaitable");
    await enter;
    const state = manager.getState(), snapshot = state.speechMode.snapshot;
    check(state.speechMode.state === "active", "entry reaches active");
    check(state.effectiveBgmVolume === 0 && state.busGains.bgm === 0, "BGM effective output is zero");
    check(bgm.paused && bgm.currentTime === 12.5, "BGM is paused without losing position");
    check(motif.paused && se.paused && effectVoice.paused && dialogue.audio.paused, "all one-shot and dialogue sources stop");
    check((await dialogue.completion).status === "stopped", "dialogue completion settles");
    check(snapshot.asset === "zephyrFields" && snapshot.src === bgm.src && snapshot.currentTime === 12.5, "snapshot identity and time");
    check(snapshot.baseGain === before.baseBgmVolume && snapshot.envelope === 1 && snapshot.fadeState === "idle" && snapshot.loop && snapshot.storyValid, "snapshot gain/fade/loop/story validity");
    check(snapshot.duckState.dialogue.multiplier === before.duckState.dialogueMultiplier && snapshot.duckState.speech.multiplier === before.duckState.speechMultiplier, "snapshot duck state");
    snapshot.duckState.dialogue.multiplier = 99;
    check(manager.getState().speechMode.snapshot.duckState.dialogue.multiplier !== 99, "snapshot inspection cannot mutate engine state");
    await manager.enterSpeechMode();
    check(manager.getState().speechMode.snapshot.currentTime === 12.5, "repeated enter preserves original snapshot");
    const lateMotif = manager.playSe("zephyrSuccess");
    const lateVoice = r.context.DialogueVoiceAudioInternal.play("voice_c01_s001_001");
    check(lateMotif.paused && lateMotif.playCalls === 0, "late motif remains silent");
    check((await lateVoice.completion).status === "stopped", "late dialogue remains silent and settles");
    const resume = await manager.exitSpeechMode();
    check(resume && manager.getState().speechMode.state === "idle", "exit completes");
    check(manager.getState().effectiveBgmVolume === 0.2 && !bgm.paused && bgm.currentTime === 12.5, "original BGM resumes with position and base gain");
    check(bgm.__eigoBgmTrack.gainNode.connections[0] === buses && r.contexts.length === 1, "normal isolation keeps the same bus graph and context");
    check(playingBgm(r).length === 1 && bgm.playCalls === 2, "one BGM instance resumes once");
    await manager.exitSpeechMode();
    check(bgm.playCalls === 2, "repeated exit does not replay BGM");
    check(motif.playCalls === 1 && se.playCalls === 1 && effectVoice.playCalls === 1 && dialogue.audio.playCalls === 1, "voice/motif/SE never auto replay");
    check(JSON.stringify(r.context.AudioMixProfile) === profile && manager.getState().baseBgmVolume === before.baseBgmVolume, "gain and duck calibration unchanged");
  }
  {
    const r = createRuntime(), m = r.context.AudioManager;
    const old = m.playBgm("old", { volume: 0.1 });
    await m.enterSpeechMode();
    const next = m.playBgm("next", { volume: 0.3, crossfadeMs: 40 });
    check(m.getState().effectiveBgmVolume === 0 && next.paused, "new Story BGM stays isolated");
    await new Promise(resolve => setTimeout(resolve, 60));
    await m.exitSpeechMode();
    check(old.paused && old.__eigoStopped && !next.paused && playingBgm(r).length === 1 && m.getState().currentBgmAsset === "next", "Story supersedes entry asset with no duplicate BGM");
    await m.enterSpeechMode();
    await m.stopBgm();
    await m.exitSpeechMode();
    check(playingBgm(r).length === 0, "Story stop prevents historical BGM resurrection");
  }
  {
    const r = createRuntime(), m = r.context.AudioManager;
    m.playBgm("old", { volume: 0.1 });
    await m.enterSpeechMode();
    await m.stopBgm({ fadeOutMs: 40 });
    await m.exitSpeechMode();
    check(playingBgm(r).length === 0, "fade-out stop is not revived");
    await m.enterSpeechMode(); await m.stopAll(); await m.exitSpeechMode();
    check(playingBgm(r).length === 0, "stopAll does not revive snapshot");
  }
  for (const state of ["suspended", "interrupted"]) {
    const r = createRuntime(), m = r.context.AudioManager;
    const bgm = m.playBgm("zephyrFields", { volume: 0.2 });
    await m.enterSpeechMode();
    r.contexts[0].state = state;
    check(await m.exitSpeechMode(), state + " recovery exits successfully");
    check(r.contexts[0].resumeCalls === 1 && r.contexts.length === 1 && !bgm.paused && playingBgm(r).length === 1, state + " uses existing context resume");
  }
  {
    const r = createRuntime(), m = r.context.AudioManager;
    const bgm = m.playBgm("zephyrFields", { volume: 0.2 });
    await m.enterSpeechMode();
    r.contexts[0].state = "interrupted"; r.contexts[0].rejectResume = true;
    check(await m.exitSpeechMode() === false && m.getState().speechMode.state === "active" && bgm.paused && m.getState().busGains.bgm === 0, "failed resume retains isolation");
    r.contexts[0].rejectResume = false;
    r.dispatch(r.documentListeners, "click"); await flush();
    check(bgm.paused && m.getState().busGains.bgm === 0, "trusted gesture does not bypass active isolation");
    check(await m.exitSpeechMode() && playingBgm(r).length === 1, "retry exit restores after trusted gesture recovery");
  }
  {
    const r = createRuntime(), m = r.context.AudioManager;
    const old = m.playBgm("zephyrFields", { volume: 0.2 }); old.currentTime = 7;
    await m.enterSpeechMode();
    check(r.context.CentralAudioRecoveryTrace.check(10000) === false && r.context.CentralAudioRecoveryTrace.state().attempt === 0, "intentional isolation is not SOURCE LOST");
    check(r.context.CentralAudioRecoveryTrace.request("SOURCE_LOST_BGM") === true, "confirmed loss delegates to Central Audio Recovery");
    await m.exitSpeechMode();
    const fresh = playingBgm(r)[0];
    check(r.contexts.length === 2 && r.contexts[0].closeCalls === 1 && old.paused && fresh !== old && fresh.currentTime === 7, "Central Recovery rebuilds and preserves BGM position");
    check(playingBgm(r).length === 1 && fresh.playCalls === 1 && m.getState().effectiveBgmVolume === 0.2, "recovery restores one BGM after isolation");
  }
  {
    const r = createRuntime([{ state: "running" }, { state: "suspended", rejectResume: true }]), m = r.context.AudioManager;
    const old = m.playBgm("old");
    await m.enterSpeechMode();
    r.context.CentralAudioRecoveryTrace.request("SOURCE_LOST_BGM");
    check(await m.exitSpeechMode() === false && playingBgm(r).length === 0, "Central Recovery waiting for gesture keeps silence");
    m.playBgm("new", { volume: 0.2 });
    r.contexts[1].rejectResume = false;
    r.dispatch(r.documentListeners, "click"); await flush();
    await m.exitSpeechMode();
    check(playingBgm(r).length === 1 && m.getState().currentBgmAsset === "new" && old.paused, "pending recovery cannot supersede newer Story request");
  }
  {
    const r = createRuntime(), m = r.context.AudioManager;
    const bgm = m.playBgm("zephyrFields", { volume: 0.2 });
    await Promise.all([m.enterSpeechMode(), m.enterSpeechMode(), m.exitSpeechMode(), m.exitSpeechMode()]);
    check(m.getState().speechMode.state === "idle" && playingBgm(r).length === 1 && bgm.playCalls === 2, "concurrent transitions serialize without duplicate replay");
    await m.enterSpeechMode({ preserveBgm: true });
    check(m.getState().speechMode.state === "idle" && m.getState().effectiveBgmVolume === 0.05, "existing option-based Speech integration retains legacy ducking");
    await m.exitSpeechMode({ restore: true });
    check(m.getState().effectiveBgmVolume === 0.2, "legacy exit retains existing restoration");
  }
  {
    const r = createRuntime(), m = r.context.AudioManager;
    const old = m.playBgm("zephyrFields", { volume: 0.2 });
    r.analysers[0].samples = [0, 0, 0, 0];
    const now = Date.now();
    old.currentTime = 2; r.context.CentralAudioRecoveryTrace.check(now - 1600);
    old.currentTime = 2.3; r.context.CentralAudioRecoveryTrace.check(now - 800);
    old.currentTime = 2.7;
    await m.enterSpeechMode();
    await m.exitSpeechMode();
    check(r.context.CentralAudioRecoveryTrace.state().attempt === 1 && r.contexts.length === 2, "natural confirmed SOURCE LOST uses existing detector and rebuild");
    check(playingBgm(r).length === 1 && playingBgm(r)[0] !== old, "isolation waits for in-flight detector recovery without double BGM");
  }
  console.log(`Speech Mode Audio Isolation V1 Phase 1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
