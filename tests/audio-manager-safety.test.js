"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
let playMode = "resolve";
let playCalls = 0;
const created = [];

class MockAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.listeners = {};
    created.push(this);
  }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  play() {
    playCalls += 1;
    if (playMode === "throw") throw new Error("blocked");
    this.paused = false;
    if (playMode === "reject") return Promise.reject(new Error("blocked"));
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  end() {
    this.paused = true;
    if (this.listeners.ended) this.listeners.ended();
  }
}

const context = {
  console: { warn() {} },
  window: {},
  Audio: MockAudio,
  AudioDatabase: {
    se: {
      zephyrEntrance: "audio/jingle/jingle_zephyr_entrance_v1.mp3",
      zephyrSuccess: "audio/jingle/jingle_zephyr_success_v1.mp3",
      zephyrGo: "audio/jingle/jingle_zephyr_go_v3.mp3",
      zephyrDeparture: "audio/jingle/jingle_zephyr_departure_v1.mp3",
      zephyrVictory: "audio/jingle/jingle_zephyr_victory_v1.mp3",
      zephyrFriendship: "audio/jingle/jingle_zephyr_friendship_v1.mp3"
    }
  },
  AssetManager: {
    audio(type, key) {
      return type === "se" && context.AudioDatabase.se[key]
        ? context.AudioDatabase.se[key]
        : key;
    }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/managers/audio-manager.js"), "utf8"), context);

const firstBgm = context.AudioManager.playBgm("zephyrFields", { volume: 0.35 });
const secondBgm = context.AudioManager.playBgm("zephyrFields", { volume: 0.35 });
assert.strictEqual(firstBgm, secondBgm, "BGM must not start twice");
assert.strictEqual(playCalls, 1, "BGM play() must run once");

const firstSe = context.AudioManager.playSe("zephyrGo", { volume: 0.55 });
const secondSe = context.AudioManager.playSe("zephyrGo", { volume: 0.55 });
assert.strictEqual(firstSe, secondSe, "An active motif must not start twice");
assert.strictEqual(playCalls, 2, "Motif play() must run once");

const firstSuccess = context.AudioManager.playSe("zephyrSuccess", { volume: 0.55 });
const secondSuccess = context.AudioManager.playSe("zephyrSuccess", { volume: 0.55 });
assert.strictEqual(firstSuccess, secondSuccess, "zephyrSuccess must not start twice");
const firstFriendship = context.AudioManager.playSe("zephyrFriendship", { volume: 0.55 });
const secondFriendship = context.AudioManager.playSe("zephyrFriendship", { volume: 0.55 });
assert.strictEqual(firstFriendship, secondFriendship, "zephyrFriendship must not start twice");

const normalSe1 = context.AudioManager.playSe("audio/se/normal.mp3");
const normalSe2 = context.AudioManager.playSe("audio/se/normal.mp3");
assert.notStrictEqual(normalSe1, normalSe2, "Normal SE must preserve overlapping playback");

const voice1 = context.AudioManager.playVoice("audio/voice/repeat.mp3");
const voice2 = context.AudioManager.playVoice("audio/voice/repeat.mp3");
assert.notStrictEqual(voice1, voice2, "Voice must preserve replay while the first Voice is active");

const sharedSe = context.AudioManager.playSe("audio/shared.mp3");
const sharedVoice = context.AudioManager.playVoice("audio/shared.mp3");
assert.notStrictEqual(sharedSe, sharedVoice, "SE and Voice collections must not interfere");

firstSe.end();
const thirdSe = context.AudioManager.playSe("zephyrGo", { volume: 0.55 });
assert.notStrictEqual(firstSe, thirdSe, "A motif must play again after it ends");

playMode = "throw";
assert.doesNotThrow(() => context.AudioManager.playSe("audio/se/throw.mp3"), "Synchronous play failure must not stop Story");
playMode = "reject";
assert.doesNotThrow(() => context.AudioManager.playVoice("audio/voice/reject.mp3"), "Rejected play Promise must not stop Story");

context.AudioManager.stopBgm();
assert.strictEqual(firstBgm.paused, true, "stopBgm must stop the Opening theme");

assert.deepStrictEqual(Object.keys(context.AudioManager).sort(),
  ["playBgm", "playSe", "playVoice", "stopAll", "stopBgm"].sort(), "Public API names must remain unchanged");
assert.strictEqual(context.AudioManager.playBgm.length, 2);
assert.strictEqual(context.AudioManager.stopBgm.length, 0);
assert.strictEqual(context.AudioManager.playSe.length, 2);
assert.strictEqual(context.AudioManager.playVoice.length, 2);
assert.strictEqual(context.AudioManager.stopAll.length, 0);
assert(firstBgm instanceof MockAudio && normalSe1 instanceof MockAudio && voice1 instanceof MockAudio,
  "Playback return values must remain Audio objects");

console.log("Audio Manager safety test: PASS");
