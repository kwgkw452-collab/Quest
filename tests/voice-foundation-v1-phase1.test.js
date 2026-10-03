"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

(async () => {
  const commandContext = { window: {} };
  commandContext.window = commandContext;
  vm.createContext(commandContext);
  vm.runInContext(read("engine/commands/story-commands.js"), commandContext);
  const plain = commandContext.StoryCommands.dialogue("コング", "Example");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(plain)), { type: "dialogue", speaker: "コング", text: "Example" }); // 1 no-key unchanged
  const voiced = commandContext.StoryCommands.dialogue("コング", "Example", { voiceKey: "voice_c02_s001_003" });
  assert.strictEqual(voiced.voiceKey, "voice_c02_s001_003"); // 2 optional key

  const profileContext = { window: {} };
  profileContext.window = profileContext;
  vm.createContext(profileContext);
  vm.runInContext(read("data/audio-mix-profile.js"), profileContext);
  vm.runInContext(read("data/voice-profiles.js"), profileContext);
  const parsed = profileContext.VoiceProfileDatabase.parseVoiceKey("voice_c02_s001_003");
  assert.strictEqual(parsed.characterCode, "c02"); // 3 Character ID from key, not speaker
  assert.strictEqual(parsed.storyOrEventId, "s001"); // 4
  assert.strictEqual(parsed.sequence, "003"); // 5
  assert.strictEqual(profileContext.VoiceProfileDatabase.get("c01").gain, 1.0); // 6
  assert.strictEqual(profileContext.VoiceProfileDatabase.get("c02").gain, 1.0); // 7
  assert.strictEqual(profileContext.VoiceProfileDatabase.get("c03").gain, 1.0); // 8
  assert.strictEqual(profileContext.VoiceProfileDatabase.get("c04").gain, 1.0); // 9
  assert.strictEqual(profileContext.AudioMixProfile.groups.VOICE, 1.0); // 10
  assert.strictEqual(profileContext.VoiceProfileDatabase.resolveGain("voice_c02_s001_003"), 1.0); // 11 group x Character

  const pending = [];
  const playbackCalls = [];
  const dialogueContext = {
    window: {}, console: { warn() {} }, Promise,
    AudioDatabase: { voice: {}, assets: {} },
    VoiceProfileDatabase: profileContext.VoiceProfileDatabase,
    DialogueVoiceAudioInternal: {
      play(key, options) {
        playbackCalls.push([key, options]);
        let resolve;
        const completion = new Promise(done => { resolve = done; });
        pending.push(resolve);
        return { audio: { key }, completion };
      },
      stop() { playbackCalls.push(["stop"]); }
    }
  };
  dialogueContext.window = dialogueContext;
  vm.createContext(dialogueContext);
  vm.runInContext(read("engine/services/dialogue-voice-controller.js"), dialogueContext);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await dialogueContext.DialogueVoiceController.play("voice_c01_s001_001"))).status, "missing"); // 12 missing safe
  dialogueContext.AudioDatabase.voice.voice_c01_s001_001 = "audio/voice/c01_pico/voice_c01_s001_001_v1.mp3";
  dialogueContext.AudioDatabase.voice.voice_c02_s001_002 = "audio/voice/c02_kong/voice_c02_s001_002_v1.mp3";
  const first = dialogueContext.DialogueVoiceController.play("voice_c01_s001_001");
  const second = dialogueContext.DialogueVoiceController.play("voice_c02_s001_002");
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(playbackCalls.filter(call => call[0].startsWith && call[0].startsWith("voice_")).length, 1); // 13 second waits
  assert.strictEqual(dialogueContext.DialogueVoiceController.isActive(), true); // 14
  pending.shift()({ status: "ended", error: null });
  assert.strictEqual((await first).status, "ended"); // 15 ended detected
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(playbackCalls.filter(call => call[0].startsWith && call[0].startsWith("voice_")).length, 2); // 16 natural serial start
  pending.shift()({ status: "ended", error: null });
  assert.strictEqual((await second).status, "ended"); // 17 waitable completion
  await dialogueContext.DialogueVoiceController.waitForIdle(); // 18 future await point
  assert.strictEqual(dialogueContext.DialogueVoiceController.isActive(), false); // 19
  assert.strictEqual((await dialogueContext.DialogueVoiceController.play("bad-key")).status, "invalid-key"); // 20 invalid safe

  const failingContext = {
    window: {}, console: { warn() {} }, Promise,
    AudioDatabase: { voice: { voice_c01_s001_001: "audio/voice/test.mp3" }, assets: {} },
    VoiceProfileDatabase: profileContext.VoiceProfileDatabase,
    DialogueVoiceAudioInternal: { play() { throw new Error("load-failed"); }, stop() {} }
  };
  failingContext.window = failingContext;
  vm.createContext(failingContext);
  vm.runInContext(read("engine/services/dialogue-voice-controller.js"), failingContext);
  assert.strictEqual((await failingContext.DialogueVoiceController.play("voice_c01_s001_001")).status, "failed"); // 21 playback failure safe

  class MockAudio {
    constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; this.listeners = {}; MockAudio.items.push(this); }
    getAttribute(name) { return name === "src" ? this.src : null; }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    play() { this.paused = false; return MockAudio.reject ? Promise.reject(new Error("blocked")) : Promise.resolve(); }
    pause() { this.paused = true; }
    emit(name) { (this.listeners[name] || []).slice().forEach(handler => handler()); }
  }
  MockAudio.items = [];
  MockAudio.reject = false;
  const audioContext = {
    window: {}, console: { warn() {} }, Promise, Date, setTimeout,
    Audio: MockAudio,
    AudioDatabase: { assets: {} },
    AssetManager: { audio(type, key) { return key.includes("/") ? key : "audio/voice/" + key + ".mp3"; } }
  };
  audioContext.window = audioContext;
  vm.createContext(audioContext);
  vm.runInContext(read("engine/managers/audio-manager.js"), audioContext);
  const effect1 = audioContext.AudioManager.playVoice("audio/voice/effect.mp3");
  const effect2 = audioContext.AudioManager.playVoice("audio/voice/effect.mp3");
  assert.notStrictEqual(effect1, effect2); // 22 Effect Voice overlap
  const tracked = audioContext.DialogueVoiceAudioInternal.play("voice_c01_s001_001", { volume: 1 });
  assert.strictEqual(audioContext.DialogueVoiceAudioInternal.isPlaying(), true); // 23 dialogue usage identified
  tracked.audio.emit("ended");
  assert.strictEqual((await tracked.completion).status, "ended"); // 24 Audio ended
  assert.strictEqual(audioContext.DialogueVoiceAudioInternal.isPlaying(), false); // 25
  const trackedStop = audioContext.DialogueVoiceAudioInternal.play("voice_c01_s001_001", { volume: 1 });
  let stopAllNotices = 0;
  audioContext.DialogueVoiceController = { onAudioStopAll() { stopAllNotices += 1; } };
  audioContext.AudioManager.stopAll();
  assert.strictEqual((await trackedStop.completion).status, "stopped"); // 26 stopAll tracked dialogue
  assert.strictEqual(effect1.paused && effect2.paused, true); // 27 stopAll all Voice
  assert.strictEqual(stopAllNotices, 1); // stopAll also invalidates queued Dialogue Voice
  MockAudio.reject = true;
  const rejected = audioContext.DialogueVoiceAudioInternal.play("voice_c01_s001_001", { volume: 1 });
  assert.strictEqual((await rejected.completion).status, "failed"); // 28 play reject safe

  const speechEvents = [];
  const speechContext = {
    window: {}, Promise, console: { warn() {} },
    DialogueVoiceController: { stop() { speechEvents.push("dialogue-stop"); } },
    SpeechAudioDuckingInternal: {
      isArmed() { return true; },
      begin() { speechEvents.push("duck"); return Promise.resolve(); }
    },
    SpeechEngine: { listen() { return Promise.resolve(""); }, stop() {} }
  };
  speechContext.window = speechContext;
  vm.createContext(speechContext);
  vm.runInContext(read("engine/services/speech-start-controller.js"), speechContext);
  await speechContext.SpeechStartController.prepare();
  assert.deepStrictEqual(speechEvents, ["dialogue-stop", "duck"]); // 29 Voice stops before Duck

  const storyEngine = read("engine/core/story-engine.js");
  assert(storyEngine.includes("DialogueVoiceController.play(step.voiceKey")); // 30 Dialogue request wired
  assert(!storyEngine.includes("await DialogueVoiceController.play(step.voiceKey")); // 31 current Story not waiting/auto-progressing
  assert(storyEngine.includes("DialogManager.next(step.button || GameConfig.dialogueNextLabel)")); // 32 Next remains
  assert(read("engine/services/speech-engine.js").includes("ui.addStartButton(startListening, config)")); // 33 Talk remains
  assert(read("engine/services/dialogue-voice-controller.js").includes("queue.then")); // 34 dialogue-only serial control
  assert(read("engine/managers/audio-manager.js").includes("function playVoice(keyOrPath, options)")); // 35 category-wide overlap preserved

  const audioDbContext = { window: {} };
  audioDbContext.window = audioDbContext;
  vm.createContext(audioDbContext);
  vm.runInContext(read("data/audio.js"), audioDbContext);
  assert.strictEqual(Object.keys(audioDbContext.AudioDatabase.voice).length, 116); // existing 111 + m004 five Voice Assets
  assert.strictEqual(Object.values(audioDbContext.AudioDatabase.assets).filter(item => item.category === "VOICE").length, 116); // 37
  const voiceMp3 = fs.readdirSync(path.join(root, "audio"), { recursive: true }).filter(name => /voice.*\.mp3$/i.test(String(name)));
  assert.strictEqual(voiceMp3.length, 111); // existing 106 + m004 five Voice MP3
  const storyFiles = fs.readdirSync(path.join(root, "engine/stories")).filter(name => name.endsWith(".js"));
  assert.deepStrictEqual(storyFiles.filter(name => read("engine/stories/" + name).includes("voiceKey")).sort(), ["S001.js", "S002.js", "S004.js", "m001.js", "m004.js", "story-saki-departure.js"]); // 39 approved connections

  const storyHashes = {
    "engine/stories/S001.js": "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1",
    "engine/stories/S002.js": "bd05226b3e51d12a27e1504579f69cd97200231a68edecd8a8d6e6b2e7aaf525",
    "engine/stories/S003.js": "e532ff803cf57398d0cd457ba118a9ec004d484af27a77e6fce81dc5da5c991c",
    "engine/stories/S004.js": "ca801b7658fe1bddf98cf8c21ee1794adf602b68afa5a7f94599758fb3437070"
  };
  Object.entries(storyHashes).forEach(([file, expected]) => assert.strictEqual(hash(file), expected)); // 40 Story bytes
  assert.strictEqual(hash("data/audio.js"), "e6c8de637d7946c9fe0107dea262a632e8fa2d703941db5169777a98bbdf4b56"); // 41 Audio assets bytes
  const s001 = read("engine/stories/S001.js");
  assert(s001.includes('volume: 0.46')); // 42 BGM
  assert(s001.includes('volume: 0.52')); // 43
  assert(read("engine/services/opening.js").includes('volume: 0.23')); // 44
  assert.strictEqual(profileContext.AudioMixProfile.ducking.speechRecognition.ratio, 0.25); // 45
  assert.strictEqual(profileContext.AudioMixProfile.ducking.speechRecognition.duckMs, 300); // 46
  assert.strictEqual(profileContext.AudioMixProfile.ducking.speechRecognition.restoreMs, 600); // 47
  assert(read("engine/managers/morning-manager.js").includes("うまく聞き取れなかったピコ。")); // 48 Morning V1.1
  assert(/window\.AudioManager\s*=\s*\{[\s\S]*?playBgm: playBgm,[\s\S]*?stopAll: stopAll,[\s\S]*?unlock: unlock/.test(read("engine/managers/audio-manager.js"))); // 49 public API
  assert(/window\.SpeechStartController\s*=\s*\{\s*prepare: prepare,\s*startListening: startListening,\s*cancel: cancel,/.test(read("engine/services/speech-start-controller.js"))); // 50
  assert(read("dev/dev-jump-manager.js").includes("AudioManager.stopAll()")); // 51 Dev cleanup
  assert(read("docs/VOICE_PRODUCTION_MANIFEST_SCHEMA.md").includes("ttsService")); // 52 separate manifest

  console.log("Voice Foundation V1.0 Phase 1 tests (52 checks): PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
