"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const source = fs.readFileSync(path.join(__dirname, "../engine/managers/audio-manager.js"), "utf8");
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

function harness(resumeResult, rejectPlay) {
  const events = [];
  const audioItems = [];
  const contexts = [];
  class Audio {
    constructor(src) {
      this.src = src;
      this.listeners = {};
      this.paused = true;
      this.playCount = 0;
      audioItems.push(this);
    }
    addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
    play() {
      this.playCount += 1;
      if (rejectPlay) return Promise.reject(new Error("play-denied"));
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
    emit(name) { (this.listeners[name] || []).forEach(listener => listener()); }
  }
  class AudioContext {
    constructor() { this.state = "suspended"; this.destination = {}; contexts.push(this); }
    resume() { return resumeResult(this); }
    createBiquadFilter() { return this.node(); }
    createDynamicsCompressor() { return this.node(); }
    createWaveShaper() { return this.node(); }
    createMediaElementSource() { return this.node(); }
    node() { return { frequency: {}, Q: {}, gain: {}, threshold: {}, ratio: {}, attack: {}, release: {}, connect() {}, disconnect() {} }; }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  const context = {
    window: {}, Audio, AudioContext, Promise, Date, setTimeout,
    console: {
      log(message, detail) { events.push([message.replace("[VoiceTrace] ", ""), detail]); },
      warn() {}
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, events, audioItems, contexts };
}

(async () => {
  let release;
  const pending = harness(context => new Promise(resolve => {
    release = () => { context.state = "running"; resolve(); };
  }));
  const normal = pending.context.DialogueVoiceAudioInternal.play("normal-key", { volume: 1 });
  assert.strictEqual(normal.audio.playCount, 1);
  normal.audio.emit("playing");
  assert(pending.events.some(([event]) => event === "normal-voice-play-call"));
  assert(pending.events.some(([event]) => event === "normal-voice-playing"));
  normal.audio.emit("ended");
  assert.strictEqual((await normal.completion).status, "ended");

  const radio = pending.context.DialogueVoiceAudioInternal.play("radio-key", { voiceEffect: "radio", volume: 1 });
  assert.strictEqual(radio.audio.playCount, 0, "pending resume must retain existing play order");
  assert.deepStrictEqual(pending.events.filter(([event]) => event.startsWith("radio-")).map(([event]) => event), [
    "radio-play-request", "radio-audio-created", "radio-context-created", "radio-resume-before"
  ]);
  assert.strictEqual(pending.events.find(([event]) => event === "radio-resume-before")[1].contextState, "suspended");
  release();
  await flush();
  radio.audio.emit("playing");
  radio.audio.emit("ended");
  assert.strictEqual((await radio.completion).status, "ended");
  const expected = [
    "radio-resume-resolved", "radio-source-created", "radio-graph-connected",
    "radio-audio-play-call", "radio-audio-play-resolved", "radio-audio-event-playing",
    "radio-audio-event-ended"
  ];
  for (const event of expected) assert(pending.events.some(([actual]) => actual === event), event);
  assert.strictEqual(pending.events.find(([event]) => event === "radio-graph-connected")[1].route, "filtered");
  assert.strictEqual(pending.contexts[0].state, "closed");

  const rejected = harness(() => Promise.reject(new Error("resume-denied")));
  const fallback = rejected.context.DialogueVoiceAudioInternal.play("fallback-key", { voiceEffect: "radio" });
  await flush();
  assert.strictEqual(fallback.audio.playCount, 1, "fallback playback must remain unchanged");
  assert(rejected.events.some(([event, detail]) => event === "radio-resume-rejected" && detail.error.includes("resume-denied")));
  assert(rejected.events.some(([event, detail]) => event === "radio-fallback-enter" && detail.reason === "resume-rejected"));
  rejected.context.DialogueVoiceAudioInternal.stop();
  assert(rejected.events.some(([event]) => event === "radio-stop"));
  assert.strictEqual((await fallback.completion).status, "stopped");

  const playRejected = harness(context => { context.state = "running"; return Promise.resolve(); }, true);
  const failed = playRejected.context.DialogueVoiceAudioInternal.play("rejected-key", { voiceEffect: "radio" });
  assert.strictEqual((await failed.completion).status, "failed");
  assert(playRejected.events.some(([event, detail]) => event === "radio-audio-play-rejected" && detail.error.includes("play-denied")));

  console.log("Radio Voice Silence Trace V1 test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
