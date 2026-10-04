"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function runtime(options = {}) {
  const audios = [];
  const nodes = [];
  let sourceConnectFailures = options.sourceConnectFailures || 0;
  const stats = {
    contexts: 0,
    resumes: 0,
    sources: 0,
    signalSamples: options.signalSamples || [0, 0, 0, 0]
  };

  class FakeAudio {
    constructor(src) {
      this.src = src || "";
      this.paused = true;
      this.currentTime = 0;
      this.playCount = 0;
      this.listeners = {};
      Object.defineProperty(this, "volume", {
        configurable: true,
        get() { return 1; },
        set() { /* iOS simulation: HTMLMediaElement.volume writes have no effect. */ }
      });
      audios.push(this);
    }
    play() { this.playCount += 1; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    getAttribute(name) { return name === "src" ? this.src : null; }
    emit(name) { (this.listeners[name] || []).slice().forEach(fn => fn()); }
  }

  class FakeNode {
    constructor(kind) {
      this.kind = kind;
      this.gain = { value: 0 };
      this.frequency = { value: 0 };
      this.Q = { value: 0 };
      this.threshold = { value: 0 };
      this.knee = { value: 0 };
      this.ratio = { value: 0 };
      this.attack = { value: 0 };
      this.release = { value: 0 };
      this.connections = [];
      nodes.push(this);
    }
    connect(target) {
      if (this.kind === "source" && sourceConnectFailures > 0) {
        sourceConnectFailures -= 1;
        throw new Error("source-connect-failed");
      }
      this.connections.push(target);
      return target;
    }
    disconnect() {}
  }

  class FakeContext {
    constructor() { stats.contexts += 1; this.state = options.state || "running"; this.destination = new FakeNode("destination"); }
    resume() { stats.resumes += 1; this.state = "running"; return Promise.resolve(); }
    createMediaElementSource() { stats.sources += 1; return new FakeNode("source"); }
    createGain() { return new FakeNode("gain"); }
    createDynamicsCompressor() { return new FakeNode("compressor"); }
    createBiquadFilter() { return new FakeNode("filter"); }
    createWaveShaper() { return new FakeNode("waveshaper"); }
    createAnalyser() {
      const analyser = new FakeNode("analyser");
      analyser.fftSize = 4;
      analyser.getFloatTimeDomainData = samples => {
        for (let index = 0; index < samples.length; index += 1) {
          samples[index] = stats.signalSamples[index] || 0;
        }
      };
      return analyser;
    }
  }

  const context = {
    console: { log() {}, warn() {} }, Promise, Float32Array, Date, Math,
    Audio: FakeAudio, AudioContext: FakeContext,
    setTimeout(fn) { fn(); },
    document: { addEventListener() {}, removeEventListener() {} },
    AssetManager: { audio(type, key) { return `${type}:${key}`; } },
    AudioDatabase: { assets: { zephyrFriendship: { file: "zephyr.mp3", category: "MOTIF" } } }
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
  return { context, audios, nodes, stats };
}

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual}`);

(async () => {
  const r = runtime();
  const { context } = r;
  assert.equal(context.AudioRuntimeVersion, "audio-gainnode-unification-v1");
  assert.equal(context.AudioMixProfileVersion, "audio-gainnode-unification-v1");

  const bgm = context.AudioManager.playBgm("futureCityPixel", { volume: 0.30 });
  assert.equal(bgm.volume, 1, "ignored HTML volume remains unity");
  assert.equal(bgm.__eigoAudioPath, undefined);
  assert.equal(bgm.__eigoBgmTrack.path, "web-audio");
  close(bgm.__eigoBgmTrack.gainNode.gain.value, 0.30, "BGM asset GainNode");
  assert.equal(r.stats.contexts, 1, "one canonical AudioContext");

  const motif = context.AudioManager.playSe("zephyrFriendship", { volume: 0.27 });
  close(motif.__eigoGainNode.gain.value, 0.27, "Motif asset GainNode");

  const pico = context.DialogueVoiceAudioInternal.play("voice_c01_s001_001", { characterGain: 1 });
  close(context.AudioManager.getState().busGains.bgm, 0.18, "BGM Dialogue Bus Duck");
  close(context.AudioManager.getState().busGains.motif, 0.12, "Motif Dialogue Bus Duck");
  close(context.AudioManager.getState().effectiveBgmVolume, 0.054, "effective BGM Duck");
  close(pico.audio.__eigoCharacterGainNode.gain.value, 1, "Pico gain");
  pico.audio.emit("ended");
  await pico.completion;
  close(context.AudioManager.getState().busGains.bgm, 1, "BGM restore");
  close(context.AudioManager.getState().busGains.motif, 1, "Motif restore");

  for (const [key, gain] of [
    ["voice_c03_s002_001", 1],
    ["voice_c05_m003_001", 1],
    ["voice_c06_st004_001", 1],
    ["voice_c02_s001_001", 0.82],
    ["voice_c04_s004_001", 0.82]
  ]) {
    const tracked = context.DialogueVoiceAudioInternal.play(key, { characterGain: gain });
    close(tracked.audio.__eigoCharacterGainNode.gain.value, gain, `${key} Character GainNode`);
    assert.equal(tracked.audio.volume, 1);
    tracked.audio.emit("ended");
    await tracked.completion;
  }
  assert(r.nodes.some(node => node.kind === "gain" && node.gain.value === 1.10), "Kong processing gain 1.10");
  assert(r.nodes.some(node => node.kind === "filter" && node.frequency.value === 320), "Bernie EQ");

  const radio = context.DialogueVoiceAudioInternal.play("voice_c03_st004_010", { characterGain: 1, voiceEffect: "radio" });
  assert(r.nodes.some(node => node.kind === "filter" && node.frequency.value === 1700 && node.gain.value === 4), "radio presence +4dB");
  assert(r.nodes.some(node => node.kind === "gain" && node.gain.value === 0.72), "radio output 0.72");
  radio.audio.emit("ended");
  await radio.completion;

  await context.AudioManager.enterSpeechMode({ preserveBgm: true });
  close(context.AudioManager.getState().effectiveBgmVolume, 0.075, "Speech GainNode multiplier");
  await context.AudioManager.exitSpeechMode({ restore: true });
  close(context.AudioManager.getState().effectiveBgmVolume, 0.30, "Speech restore");
  assert.equal(r.stats.contexts, 1, "all paths share one AudioContext");

  const latchedRuntime = runtime({ signalSamples: [0.2, -0.4, 0.1, -0.2] });
  const latchedVoice = latchedRuntime.context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", { characterGain: 0.82 });
  latchedVoice.audio.currentTime = 1.25;
  latchedVoice.audio.emit("playing");
  latchedVoice.audio.emit("timeupdate");
  let latched = latchedRuntime.context.GainNodeVoiceRuntimeTrace.latched();
  assert.equal(latched.playingSeen, true);
  assert.equal(latched.contextState, "running");
  assert.equal(latched.graphConnected, true);
  assert.equal(latched.sourceCreated, true);
  assert.equal(latched.fallback, false);
  close(latched.characterGain, 0.82, "latched Character Gain");
  close(latched.processingGain, 1.10, "latched Processing Gain");
  close(latched.voiceBusGain, 1, "latched Voice Bus Gain");
  close(latched.masterGain, 1, "latched Master Gain");
  close(latched.maxPeak, 0.4, "latched Max Peak");
  close(latched.maxRms, 0.0313, "latched Max RMS");
  close(latched.lastPlayingCurrentTime, 1.25, "latched Last Playing Time");
  latchedRuntime.stats.signalSamples = [0, 0, 0, 0];
  latchedVoice.audio.paused = true;
  latchedVoice.audio.emit("ended");
  await latchedVoice.completion;
  latched = latchedRuntime.context.GainNodeVoiceRuntimeTrace.latched();
  assert.equal(latched.graphConnected, true, "cleanup does not clear latched Graph");
  assert.equal(latched.sourceCreated, true, "cleanup does not clear latched Source");
  close(latched.maxPeak, 0.4, "cleanup does not clear Max Peak");
  close(latched.maxRms, 0.0313, "cleanup does not clear Max RMS");
  close(latched.lastPlayingCurrentTime, 1.25, "cleanup does not clear Last Playing Time");

  const fallback = runtime({ sourceConnectFailures: 1 });
  const first = fallback.context.AudioManager.playBgm("futureCityPixel", { volume: 0.30 });
  const replacement = fallback.audios.at(-1);
  assert.notStrictEqual(first, replacement, "BGM graph failure uses fresh safe fallback element");
  assert.equal(first.playCount, 0, "unsafe MediaElementSource element never plays");
  assert.equal(replacement.playCount, 0, "uncontrollable fallback is safely suppressed");
  assert.equal(replacement.muted, true, "uncontrollable fallback is muted");
  assert.equal(fallback.context.AudioManager.getState().bgmPath, "fallback");

  const manager = read("engine/managers/audio-manager.js");
  assert(!/if\s*\([^)]*(?:iPhone|iPad|Safari)/i.test(manager), "no device architecture branch");
  assert(!manager.includes("kongGain.gain.value = 1.65"), "old Kong 1.65 removed");
  for (const page of ["index.html", "dev.html"]) {
    const html = read(page);
    for (const asset of ["data/audio-mix-profile.js", "data/voice-profiles.js", "engine/services/dialogue-voice-controller.js"]) {
      assert(html.includes(`${asset}?v=audio-gainnode-unification-v1`), `${page}: ${asset} cache version`);
    }
    assert(html.includes("engine/managers/audio-manager.js?v=gainnode-confirmed-regression-fix-v1"), `${page}: AudioManager cache version`);
  }
  console.log("Audio GainNode Unification V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
