"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const audios = [];
class FakeAudio {
  constructor(src) { this.src = src || ""; this.volume = 1; this.paused = true; this.listeners = {}; audios.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  getAttribute(name) { return name === "src" ? this.src : null; }
  emit(name) { if (this.listeners[name]) this.listeners[name](); }
}
class FakeNode {
  constructor() { this.gain = { value: 0 }; this.frequency = { value: 0 }; this.Q = { value: 0 }; this.threshold = { value: 0 }; this.knee = { value: 0 }; this.ratio = { value: 0 }; this.attack = { value: 0 }; this.release = { value: 0 }; }
  connect() { return this; }
  disconnect() {}
}
class FakeContext {
  constructor() { this.state = "running"; this.destination = new FakeNode(); }
  resume() { this.state = "running"; return Promise.resolve(); }
  createMediaElementSource() { return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createWaveShaper() { return new FakeNode(); }
}

const context = {
  console, Promise, Float32Array, Date, Math, Audio: FakeAudio, AudioContext: FakeContext,
  setTimeout, clearTimeout,
  document: { addEventListener() {}, removeEventListener() {} },
  AssetManager: { audio(type, key) { return type + ":" + key; } },
  AudioDatabase: {
    assets: {
      zephyrSuccess: { file: "zephyr.mp3", category: "MOTIF" },
      battleHit: { file: "hit.mp3", category: "SE" }
    }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio-mix-profile.js"), context);
context.AudioMixProfile.ducking.dialogueVoice.duckMs = 20;
context.AudioMixProfile.ducking.dialogueVoice.restoreMs = 20;
context.AudioMixProfile.ducking.speechRecognition.duckMs = 20;
context.AudioMixProfile.ducking.speechRecognition.restoreMs = 20;
vm.runInContext(read("engine/managers/audio-manager.js"), context);

(async () => {
  const bgm = context.AudioManager.playBgm("futureCityPixel", { volume: 0.30, fadeInMs: 120 });
  const pico = context.DialogueVoiceAudioInternal.play("voice_c01_s001_001", { volume: 1 });
  await wait(180);
  assert(Math.abs(bgm.volume - 0.054) < 0.002, "Dialogue Duck remains active after BGM fade-in completes");
  assert.equal(context.AudioManager.getState().duckState.dialogueOwners, 1);
  pico.audio.emit("ended");
  await pico.completion;
  await wait(70);
  assert(Math.abs(bgm.volume - 0.30) < 0.002, "Voice completion restores canonical base volume");

  const kong = context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", { volume: 1 });
  const saki = context.DialogueVoiceAudioInternal.play("voice_c03_s002_001", { volume: 1 });
  await wait(70);
  assert(Math.abs(bgm.volume - 0.054) < 0.002);
  kong.audio.emit("ended");
  await kong.completion;
  await wait(30);
  assert(Math.abs(bgm.volume - 0.054) < 0.002, "overlapping Voice keeps Duck until final owner exits");
  saki.audio.emit("ended");
  await saki.completion;
  await wait(70);
  assert(Math.abs(bgm.volume - 0.30) < 0.002);

  for (const key of ["voice_c01_s001_001", "voice_c02_s001_001", "voice_c03_s002_001", "voice_c04_s004_001", "voice_c06_st004_001"]) {
    const tracked = context.DialogueVoiceAudioInternal.play(key, { volume: 1 });
    await wait(70);
    assert(Math.abs(bgm.volume - 0.054) < 0.002, key + " uses canonical Dialogue policy");
    context.DialogueVoiceAudioInternal.stop();
    await tracked.completion;
    await wait(70);
    assert(Math.abs(bgm.volume - 0.30) < 0.002, key + " stop restores base volume");
  }

  const bernie = context.DialogueVoiceAudioInternal.play("voice_c04_s004_001", { volume: 1 });
  await wait(70);
  const motif = context.AudioManager.playSe("zephyrSuccess", { volume: 0.27 });
  const ordinarySe = context.AudioManager.playSe("battleHit", { volume: 0.80 });
  assert(Math.abs(motif.volume - 0.0324) < 0.002, "Motif uses its central Dialogue ratio");
  assert.equal(ordinarySe.volume, 0.80, "ordinary SE remains non-duckable by policy");
  bernie.audio.emit("ended");
  await bernie.completion;
  await wait(70);
  assert(Math.abs(motif.volume - 0.27) < 0.002, "Motif restores after Dialogue Voice");

  await context.AudioManager.enterSpeechMode({ preserveBgm: true });
  assert(Math.abs(bgm.volume - 0.075) < 0.002, "Speech mode uses central multiplier");
  assert.equal(context.AudioManager.getState().speechMode.active, true);
  await context.AudioManager.exitSpeechMode({ restore: true });
  assert(Math.abs(bgm.volume - 0.30) < 0.002, "Speech exit restores base volume");

  assert.equal(context.AudioMixProfile.characterProcessing.c02.webAudioGain, 1.10);
  assert(!read("engine/managers/audio-manager.js").includes("kongGain.gain.value = 1.65"));

  const controls = [];
  let resolveVoice;
  const supportContext = {
    console, Promise,
    window: null,
    GameConfig: { dialogueNextLabel: "Next" },
    DialogManager: {
      show() {}, setContent() {}, clearControls() {},
      addControl(label, fn, options) { controls.push({ label, fn, disabled: !!(options && options.disabled) }); }
    },
    DialogueVoiceController: {
      stop() {},
      play() { return new Promise(resolve => { resolveVoice = resolve; }); }
    }
  };
  supportContext.window = supportContext;
  vm.createContext(supportContext);
  vm.runInContext(read("engine/controllers/pico-support-controller.js"), supportContext);
  supportContext.PicoSupportController.present({ speaker: "Pico", text: "Hello", voiceKey: "voice_c01_s001_001" });
  assert.equal(controls.filter(item => item.label === "Next").at(-1).disabled, true, "Next disabled while Voice plays");
  resolveVoice({ status: "ended" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controls.filter(item => item.label === "Next").at(-1).disabled, false, "Next enabled after Voice completion");

  supportContext.DialogueVoiceController.play = function () { return Promise.reject(new Error("play rejected")); };
  supportContext.PicoSupportController.present({ speaker: "Pico", text: "Hello", voiceKey: "voice_c01_s001_001" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(controls.filter(item => item.label === "Next").at(-1).disabled, false, "Voice failure safely re-enables Next");

  console.log("Audio Engine Unification V1 Phase 1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
