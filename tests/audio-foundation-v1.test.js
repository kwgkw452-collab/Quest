"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const context = { window: {} };
context.window = context;
vm.createContext(context);
vm.runInContext(read("data/audio.js"), context);
vm.runInContext(read("data/audio-mix-profile.js"), context);
vm.runInContext(read("engine/services/asset-resolver.js"), context);

const db = context.AudioDatabase;
const assets = db.assets;
const profile = context.AudioMixProfile;
const legacyKeys = ["bgm", "se", "voice"].flatMap(group => Object.keys(db[group]));

assert.strictEqual(context.AssetManager.audio("bgm", "zephyrFields"), db.bgm.zephyrFields); // 1 old schema
const old = db.bgm.zephyrFields;
db.bgm.zephyrFields = assets.zephyrFields;
assert.strictEqual(context.AssetManager.audio("bgm", "zephyrFields"), old); // 2 object schema
db.bgm.zephyrFields = old;
assert.deepStrictEqual(legacyKeys.slice().sort(), Object.keys(assets).sort()); // 3 keys
Object.values(assets).forEach(asset => assert(fs.existsSync(path.join(root, asset.file)))); // 4 files
const categories = ["BGM", "AMBIENT", "SE", "MOTIF", "VOICE"];
Object.values(assets).forEach(asset => assert(categories.includes(asset.category))); // 5 category
assert.strictEqual(assets.morningGardenAtmosphere.category, "AMBIENT"); // 6 ambient
assert.strictEqual(assets.zephyrGo.category, "MOTIF"); // 7 motif
assert(profile && profile.groups && profile.assets && profile.ducking && profile.fades); // 8 profile

const created = [];
class MockAudio {
  constructor(src) { this.src = src; this.volume = 1; this.paused = true; this.listeners = {}; created.push(this); }
  getAttribute(name) { return name === "src" ? this.src : null; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
context.Audio = MockAudio;
context.console = { warn() {} };
context.setTimeout = setTimeout;
context.Date = Date;
vm.runInContext(read("engine/managers/audio-manager.js"), context);
assert.strictEqual(context.AudioManager.playBgm("zephyrFields", { volume: 0.37 }).volume, 1); // 9 HTMLAudio stays unity
assert(read("engine/services/opening.js").includes('volume: 0.23')); // 10 opening
assert(read("engine/stories/S001.js").includes('volume: 0.46')); // 11 S001 Zephyr
assert(read("engine/stories/S001.js").includes('C.bgm("morningGardenAtmosphere", { loop: true, volume: 1.00')); // 12
assert(read("engine/stories/S001.js").includes('volume: 0.52')); // 13 Silent Tears
assert.deepStrictEqual(JSON.parse(JSON.stringify(profile.ducking.speechRecognition)), { ratio: 0.25, duckMs: 300, restoreMs: 600 }); // 14
assert.strictEqual(0.46 * profile.ducking.speechRecognition.ratio, 0.115); // 15
assert.strictEqual(0.52 * profile.ducking.speechRecognition.ratio, 0.13); // 16
const motif1 = context.AudioManager.playSe("zephyrGo");
const motif2 = context.AudioManager.playSe("zephyrGo");
assert.strictEqual(motif1, motif2); // 17
assert.notStrictEqual(context.AudioManager.playSe("battleHit"), context.AudioManager.playSe("battleHit")); // 18
assert.notStrictEqual(context.AudioManager.playVoice("audio/voice/test.mp3"), context.AudioManager.playVoice("audio/voice/test.mp3")); // 19
context.AudioManager.stopAll();
assert(created.every(audio => audio.paused)); // 20
assert.strictEqual(profile.fades.normalInMs, 700); // 21 explicit options remain manager-first
assert(read("index.html").indexOf("data/audio-mix-profile.js") < read("index.html").indexOf("engine/managers/audio-manager.js") &&
  read("dev.html").indexOf("data/audio-mix-profile.js") < read("dev.html").indexOf("engine/managers/audio-manager.js")); // 22
assert(!read("index.html").includes("dev/dev-jump-manager.js") && read("dev.html").includes("dev/dev-jump-manager.js")); // 23

console.log("Audio Foundation V1.0 tests (23 checks): PASS");
