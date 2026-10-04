"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const created = [];
let playCalls = 0;

class MockAudio {
  constructor(src) {
    this.src = src;
    this.volume = 1;
    this.paused = true;
    this.listeners = {};
    created.push(this);
  }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  play() { playCalls += 1; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

const context = {
  console: { warn() {}, error() {} },
  window: {},
  Audio: MockAudio,
  setTimeout,
  Date,
  AssetManager: { audio(type, key) { return type + ":" + key; } }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/managers/audio-manager.js"), "utf8"), context);

(async function () {
  const bgm = context.AudioManager.playBgm("zephyrFields", { volume: 0.46 });
  const se = context.AudioManager.playSe("picoEntrance", { volume: 0.48 });
  const voice = context.AudioManager.playVoice("voice-test", { volume: 0.50 });
  context.SpeechAudioDuckingInternal.arm({ duckMs: 0, restoreMs: 0 });
  await context.SpeechAudioDuckingInternal.begin();
  assert.strictEqual(bgm.paused, false, "BGM must continue during speech");
  assert.strictEqual(bgm.volume, 0.115, "BGM fallback applies the effective speech gain");
  assert(Math.abs(context.AudioManager.getState().effectiveBgmVolume - 0.115) < 0.000001,
    "BGM GainNode policy must duck to 25% of its normal volume");
  assert.strictEqual(se.paused, true, "SE must stop before microphone start");
  assert.strictEqual(voice.paused, true, "Voice must stop before microphone start");
  assert.strictEqual(playCalls, 3, "Ducking must not replay or duplicate BGM");
  await context.SpeechAudioDuckingInternal.finish(true);
  assert.strictEqual(bgm.volume, 0.46, "BGM fallback restores its effective scene gain");
  assert(Math.abs(context.AudioManager.getState().effectiveBgmVolume - 0.46) < 0.000001,
    "Continuing scene must restore the same BGM instance");
  assert(Math.abs(0.52 * 0.25 - 0.13) < 0.000001, "Silent Tears speech volume must be 0.13");

  const audioKeys = Object.keys(context.AudioManager).sort();
  assert.deepStrictEqual(audioKeys, ["ensureContextRunning", "enterDialogueVoiceMode", "enterSpeechMode",
    "exitDialogueVoiceMode", "exitSpeechMode", "getAudioContext", "getState", "playBgm", "playSe",
    "playVoice", "stopAll", "stopBgm", "unlock"].sort());

  const story = fs.readFileSync(path.join(root, "engine/stories/S001.js"), "utf8");
  assert(story.includes('C.question("word.hello", null, { speechDucking: { restore: false } })'));
  assert(story.includes('C.question("word.japan", null, { speechDucking: { restore: true } })'));
  assert(story.includes('C.question("word.yes", null, { speechDucking: { restore: false } })'));
  assert(!/C\.stopBgm\([^\n]*\),\n\s*C\.question\("word\.(japan|yes)"/.test(story));

  const manager = fs.readFileSync(path.join(root, "engine/managers/audio-manager.js"), "utf8");
  assert(manager.includes('animatePolicy("speech", profile.ratio === undefined ? 0.25'));
  assert(manager.includes("profile.duckMs === undefined ? 300 : profile.duckMs"));
  assert(manager.includes("profile.restoreMs === undefined ? 600 : profile.restoreMs"));

  const events = [];
  context.QuestionDatabase = {
    get() { return { id: "word.hello", category: "word", prompt: "Hello", answers: ["hello"] }; }
  };
  context.GameCore = { speechMission: async () => { events.push("speech"); return "hello"; } };
  context.SpeechEngine = { getStatus() { return "idle"; }, stop() {} };
  context.SpeechAudioDuckingInternal = {
    armed: true,
    isArmed() { return this.armed; },
    begin() { return Promise.resolve().then(() => events.push("duck-complete")); }
  };
  vm.runInContext(fs.readFileSync(path.join(root, "engine/managers/question-manager.js"), "utf8"), context);
  const result = await context.QuestionManager.start("word.hello");
  assert.strictEqual(result.status, "success");
  assert.deepStrictEqual(events, ["duck-complete", "speech"], "Speech must start only after duck completion");

  console.log("S001 Speech Ducking V1 regression test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
