"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function runtime(options = {}) {
  const audios = [];
  const gestures = {};
  const stats = { contexts: 0, resumes: 0, sources: 0 };
  let resumeFailures = options.resumeFailures || 0;
  let sourceConnectFailures = options.sourceConnectFailures || 0;
  let playPolicy = options.playPolicy || (() => true);

  class FakeAudio {
    constructor(src) {
      this.src = src || "";
      this.volume = 1;
      this.paused = true;
      this.ended = false;
      this.currentTime = 0;
      this.muted = false;
      this.playCount = 0;
      this.listeners = {};
      audios.push(this);
    }
    play() {
      this.playCount += 1;
      const allowed = playPolicy(this);
      this.paused = !allowed;
      return allowed ? Promise.resolve() : Promise.reject(new Error("blocked"));
    }
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
    }
    connect() {
      if (this.kind === "source" && sourceConnectFailures > 0) {
        sourceConnectFailures -= 1;
        throw new Error("source-connect-failed");
      }
      return this;
    }
    disconnect() {}
  }

  class FakeContext {
    constructor() {
      stats.contexts += 1;
      this.state = options.contextState || "running";
      this.destination = new FakeNode("destination");
    }
    resume() {
      stats.resumes += 1;
      if (resumeFailures > 0) {
        resumeFailures -= 1;
        return Promise.reject(new Error("resume-failed"));
      }
      this.state = "running";
      return Promise.resolve();
    }
    createMediaElementSource() { stats.sources += 1; return new FakeNode("source"); }
    createGain() { return new FakeNode("gain"); }
    createDynamicsCompressor() { return new FakeNode("compressor"); }
    createBiquadFilter() { return new FakeNode("filter"); }
    createWaveShaper() { return new FakeNode("waveshaper"); }
  }

  const context = {
    console, Promise, Float32Array, Date, Math,
    Audio: FakeAudio,
    AudioContext: options.noContext ? undefined : FakeContext,
    setTimeout(fn) { fn(); },
    document: {
      addEventListener(name, fn) { (gestures[name] ||= []).push(fn); },
      removeEventListener(name, fn) {
        gestures[name] = (gestures[name] || []).filter(item => item !== fn);
      }
    },
    AssetManager: { audio(type, key) { return `${type}:${key}`; } },
    AudioDatabase: { assets: {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/audio-mix-profile.js"), context);
  context.AudioMixProfile.ducking.dialogueVoice.duckMs = 0;
  context.AudioMixProfile.ducking.dialogueVoice.restoreMs = 0;
  context.AudioMixProfile.ducking.speechRecognition.duckMs = 0;
  context.AudioMixProfile.ducking.speechRecognition.restoreMs = 0;
  vm.runInContext(read("engine/managers/audio-manager.js"), context);

  return {
    context, audios, gestures, stats,
    gesture(name = "click") { return Promise.all((gestures[name] || []).slice().map(fn => fn())); },
    setPlayPolicy(fn) { playPolicy = fn; }
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  {
    const r = runtime({ contextState: "running" });
    const kong = r.context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", { volume: 1 });
    await flush();
    assert.equal(r.stats.sources, 1, "running context uses Kong processing");
    assert.equal(kong.audio.playCount, 1);
    kong.audio.emit("ended");
    await kong.completion;
  }

  {
    const r = runtime({ contextState: "suspended" });
    const kong = r.context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", { volume: 1 });
    await flush();
    assert.equal(r.stats.resumes, 1);
    assert.equal(r.stats.sources, 1, "successful resume restores processing");
    kong.audio.emit("ended");
    await kong.completion;
  }

  {
    const r = runtime({ contextState: "suspended", resumeFailures: 1 });
    await r.gesture();
    assert.equal(r.context.AudioManager.getState().unlockComplete, false);
    assert.ok((r.gestures.click || []).length > 0, "failed unlock keeps gesture listener");
    await r.gesture();
    assert.equal(r.context.AudioManager.getState().unlockComplete, true);
    assert.equal(r.stats.contexts, 1, "unlock retry reuses canonical context");
    assert.equal((r.gestures.click || []).length, 0, "running context removes retry listeners");
    const kong = r.context.DialogueVoiceAudioInternal.play("voice_c02_s001_001", { volume: 1 });
    await flush();
    assert.equal(r.stats.sources, 1, "processing returns after retry");
    kong.audio.emit("ended");
    await kong.completion;
  }

  for (const voice of ["voice_c02_s001_001", "voice_c04_s004_001"]) {
    const r = runtime({ sourceConnectFailures: 1 });
    const before = r.audios.length;
    const tracked = r.context.DialogueVoiceAudioInternal.play(voice, { volume: 1 });
    const processedAudio = r.audios[before];
    await flush();
    assert.notStrictEqual(tracked.audio, processedAudio, voice + " uses a fresh fallback element");
    assert.equal(processedAudio.playCount, 0, "unsafe processed element is never played");
    assert.equal(tracked.audio.playCount, 1, "HTMLAudio fallback plays exactly once");
    assert.equal(r.context.AudioManager.getState().duckState.dialogueOwners, 1);
    tracked.audio.emit("ended");
    await tracked.completion;
    assert.equal(r.context.AudioManager.getState().duckState.dialogueOwners, 0);
  }

  {
    const r = runtime({ sourceConnectFailures: 1 });
    const before = r.audios.length;
    const radio = r.context.DialogueVoiceAudioInternal.play("voice_c03_st004_010", {
      volume: 1,
      voiceEffect: "radio"
    });
    const processedAudio = r.audios[before];
    await flush();
    assert.notStrictEqual(radio.audio, processedAudio, "radio failure uses fresh fallback");
    assert.equal(processedAudio.playCount, 0);
    assert.equal(radio.audio.playCount, 1, "radio fallback has no dry/wet double play");
    radio.audio.emit("ended");
    await radio.completion;
    const normal = r.context.DialogueVoiceAudioInternal.play("voice_c03_st004_013", { volume: 1 });
    assert.equal(normal.audio.playCount, 1, "normal voice remains available after radio");
    normal.audio.emit("ended");
    await normal.completion;
  }

  {
    let bgmAttempts = 0;
    const r = runtime({
      playPolicy(audio) {
        if (audio.src === "bgm:futureCityPixel") return ++bgmAttempts > 1;
        return true;
      }
    });
    const future = r.context.AudioManager.playBgm("futureCityPixel", { volume: 0.15 });
    await flush();
    assert.equal(r.context.AudioManager.getState().pendingBgm, true);
    await r.gesture();
    await flush();
    assert.equal(future.playCount, 2, "trusted gesture retries pending BGM once");
    assert.equal(r.context.AudioManager.getState().pendingBgm, false);
  }

  {
    const r = runtime();
    const future = r.context.AudioManager.playBgm("futureCityPixel", { volume: 0.15 });
    await flush();
    assert.equal(future.__eigoBgmTrack.gainNode.gain.value, 0.15, "normal Future City graph preserves base gain");
    assert.equal(future.playCount, 1);
    assert.strictEqual(r.context.AudioManager.playBgm("futureCityPixel", { volume: 0.15 }), future);
    assert.equal(future.playCount, 1, "same-src playing BGM is not replayed or regenerated");
    future.pause();
    r.context.AudioManager.playBgm("futureCityPixel", { volume: 0.15 });
    await flush();
    assert.equal(future.playCount, 2, "same-src paused BGM is replayed");
    future.pause();
    future.ended = true;
    future.currentTime = 9;
    r.context.AudioManager.playBgm("futureCityPixel", { volume: 0.15 });
    await flush();
    assert.equal(future.playCount, 3, "same-src ended BGM is replayed");
    assert.equal(future.currentTime, 0, "ended same-src BGM restarts from zero");
  }

  {
    const r = runtime({ sourceConnectFailures: 1 });
    const unsafe = r.context.AudioManager.playBgm("zephyrFields", { volume: 0.20 });
    const fallback = r.audios.at(-1);
    await flush();
    assert.notStrictEqual(fallback, unsafe, "BGM source connection failure uses a fresh fallback element");
    assert.equal(unsafe.playCount, 0, "unsafe BGM element is never directly replayed");
    assert.equal(fallback.volume, 0.20, "BGM fallback retains effective base gain");
    assert.equal(fallback.playCount, 1, "safe BGM fallback plays exactly once");
    await r.context.AudioManager.enterSpeechMode({ preserveBgm: true });
    assert.equal(fallback.volume, 0.05, "BGM fallback retains the existing 0.25 speech policy");
    await r.context.AudioManager.exitSpeechMode({ restore: true });
    assert.equal(fallback.volume, 0.20, "BGM fallback restores effective gain after speech");
  }

  {
    const r = runtime({ sourceConnectFailures: 1 });
    r.context.AudioDatabase.assets.zephyrFriendship = { category: "MOTIF" };
    const unsafe = r.audios.length;
    const fallback = r.context.AudioManager.playSe("zephyrFriendship", { volume: 0.27 });
    await flush();
    assert.notStrictEqual(fallback, r.audios[unsafe], "Motif source connection failure uses a fresh fallback element");
    assert.equal(r.audios[unsafe].playCount, 0, "unsafe Motif element is never directly replayed");
    assert.equal(fallback.volume, 0.27, "Motif fallback retains base and group policy gain");
    assert.equal(fallback.playCount, 1, "Motif fallback plays once without duplication");
    const dialogue = r.context.DialogueVoiceAudioInternal.play("voice_c01_s001_001", { volume: 1 });
    assert.ok(Math.abs(fallback.volume - (0.27 * 0.12)) < 1e-9,
      "Motif fallback tracks the existing 0.12 dialogue policy");
    dialogue.audio.emit("ended");
    await dialogue.completion;
    assert.equal(fallback.volume, 0.27, "Motif fallback restores policy gain after dialogue");
  }

  for (const oneShot of [
    { label: "SE", play: manager => manager.playSe("battleHit", { volume: 0.40 }) },
    { label: "Effect Voice", play: manager => manager.playVoice("effectVoiceCue", { volume: 0.40 }) }
  ]) {
    const r = runtime({ sourceConnectFailures: 1 });
    const originalIndex = r.audios.length;
    const fallback = oneShot.play(r.context.AudioManager);
    await flush();
    assert.notStrictEqual(fallback, r.audios[originalIndex], `${oneShot.label} uses a fresh fallback element`);
    assert.equal(r.audios[originalIndex].playCount, 0, `${oneShot.label} unsafe element does not play`);
    assert.equal(fallback.playCount, 1, `${oneShot.label} fallback plays once`);
    assert.equal(fallback.volume, 0.40, `${oneShot.label} fallback retains effective gain`);
  }

  {
    const r = runtime({ playPolicy(audio) { return audio.src !== "bgm:oldScene"; } });
    const old = r.context.AudioManager.playBgm("oldScene");
    await flush();
    assert.equal(r.context.AudioManager.getState().pendingBgm, true);
    r.context.AudioManager.playBgm("newScene");
    await flush();
    await r.gesture();
    await flush();
    assert.equal(old.playCount, 1, "superseded pending BGM is never retried");
  }

  {
    const r = runtime();
    const zephyr = r.context.AudioManager.playBgm("zephyrFields", { volume: 0.20 });
    const tree = r.context.DialogueVoiceAudioInternal.play("voice_c05_s004_001", { volume: 1 });
    assert.ok(Math.abs(r.context.AudioManager.getState().effectiveBgmVolume - 0.036) < 1e-9,
      "Season Tree dialogue applies calibrated 0.18 duck");
    tree.audio.emit("ended");
    await tree.completion;
    assert.equal(r.context.AudioManager.getState().effectiveBgmVolume, 0.20, "Season Tree dialogue restores BGM");
  }

  for (const page of ["index.html", "dev.html"]) {
    const html = read(page);
    assert.match(html, /data\/audio-mix-profile\.js\?v=audio-gainnode-unification-v1/);
    const audioManagerVersion = page === "index.html" ? "iphone-safari-bgm-loud-restore-trace-v1" : "gainnode-confirmed-regression-fix-v1";
    assert(html.includes(`engine/managers/audio-manager.js?v=${audioManagerVersion}`));
    assert.match(html, /engine\/services\/dialogue-voice-controller\.js\?v=audio-gainnode-unification-v1/);
  }

  assert(read("engine/services/m004-battle-extension.js").includes('yes: "ears"'));
  console.log("Audio Voice Reliability Fix V1: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
