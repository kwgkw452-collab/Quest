"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const adapterSource = read("engine/services/speech-recognition-adapter.js");
const audioSource = read("engine/managers/audio-manager.js");
const indexSource = read("index.html");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

function createRuntime(search) {
  const recognitions = [];
  const documentListeners = {};
  const windowListeners = {};
  class Recognition {
    constructor() { recognitions.push(this); }
    start() { if (this.onstart) this.onstart(); }
    stop() { this.stopCalls = (this.stopCalls || 0) + 1; }
    result(text, isFinal) {
      const item = [{ transcript: text, confidence: 0.9 }];
      item.isFinal = isFinal;
      this.onresult({ resultIndex: 0, results: [item] });
    }
    error(code) { this.onerror({ error: code }); }
    end() { this.onend(); }
  }
  const context = {
    console: { log() {}, warn() {}, error() {} },
    URLSearchParams,
    Date,
    Math,
    Promise,
    setTimeout,
    clearTimeout,
    location: { search },
    navigator: { audioSession: { type: "playback", state: "active" } },
    SpeechRecognition: Recognition,
    document: {
      visibilityState: "visible",
      hidden: false,
      addEventListener(name, handler) { documentListeners[name] = handler; }
    },
    addEventListener(name, handler) { windowListeners[name] = handler; },
    AudioManager: {
      getAudioContext() { return { state: "running" }; },
      getState() { return { speechMode: { state: "active" }, audioContextState: "running" }; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(adapterSource, context);
  return { context, recognitions, documentListeners, windowListeners };
}

(async () => {
  check(adapterSource.includes('MIC_RELEASE_TRACE_VERSION = "iphone-speech-native-mic-release-boundary-trace-v1"'), "version marker exists");
  check(adapterSource.includes("MIC_RELEASE_TRACE_LIMIT = 64"), "dedicated storage is bounded at 64");
  check(audioSource.includes('"Mic Release Trace: " + micReleaseVersion'), "panel marker is visible");
  check(audioSource.includes('"MIC RELEASE ORDER (latest "'), "MIC RELEASE ORDER is visible");
  check(indexSource.includes("speech-recognition-adapter.js?v=iphone-speech-native-mic-release-boundary-trace-v1"), "adapter cache query updated");
  check(indexSource.includes("audio-manager.js?v=iphone-speech-native-mic-release-boundary-trace-v1"), "panel cache query updated");

  const state = createRuntime("?audioTrace=1");
  const run = state.context.SpeechRecognitionAdapter.listen({});
  const recognition = state.recognitions[0];
  recognition.result("Hello", true);
  recognition.end();
  check(await run === "Hello", "normal recognition result is unchanged");
  let events = state.context.MicReleaseTrace.events();
  const names = events.map(event => event.type);
  for (const name of [
    "instance-created", "start-call", "onstart", "onend", "finish-enter",
    "activeRecognition-before-clear", "activeRecognition-cleared", "adapter-resolve"
  ]) check(names.includes(name), `event exists: ${name}`);
  check(names.indexOf("onend") < names.indexOf("finish-enter"), "onend precedes finish");
  check(names.indexOf("finish-enter") < names.indexOf("activeRecognition-before-clear"), "finish precedes clear boundary");
  check(names.indexOf("activeRecognition-before-clear") < names.indexOf("activeRecognition-cleared"), "clear order is preserved");
  check(names.indexOf("activeRecognition-cleared") < names.indexOf("adapter-resolve"), "active reference clears before settlement");
  const ids = events.filter(event => event.instanceId).map(event => event.instanceId);
  check(ids.every(id => id === ids[0]), "one instance ID follows the full boundary");
  const cleared = events.find(event => event.type === "activeRecognition-cleared");
  check(cleared.activeRecognitionNull === true && cleared.activeRecognitionId === null, "activeRecognition null is recorded");
  check(events.every(event => event.audioContextState === "running"), "AudioContext state is recorded");
  check(events.every(event => event.speechModeState === "active"), "Speech Mode state is recorded");
  check(events.every(event => event.audioSessionType === "playback" && event.audioSessionState === "active"), "audioSession is read");

  state.context.document.visibilityState = "hidden";
  state.context.document.hidden = true;
  state.documentListeners.visibilitychange({ type: "visibilitychange" });
  state.windowListeners.pagehide({ type: "pagehide" });
  state.context.document.visibilityState = "visible";
  state.context.document.hidden = false;
  state.windowListeners.pageshow({ type: "pageshow" });
  events = state.context.MicReleaseTrace.events();
  for (const name of ["visibilitychange", "pagehide", "pageshow"]) {
    const event = events.find(item => item.type === name);
    check(event && event.activeRecognitionNull === true, `${name} records released Recognition state`);
  }

  const stoppedRun = state.context.SpeechRecognitionAdapter.listen({});
  const stoppedRecognition = state.recognitions[1];
  state.context.SpeechRecognitionAdapter.stop();
  check(stoppedRecognition.stopCalls === 1, "existing stop behavior is unchanged");
  stoppedRecognition.end();
  await stoppedRun.catch(() => null);
  events = state.context.MicReleaseTrace.events();
  check(events.some(event => event.type === "stop-call" && event.stopReason === "adapter-stop"), "stop reason is recorded");
  check(events.some(event => event.type === "adapter-reject"), "adapter reject is recorded");

  const errorRun = state.context.SpeechRecognitionAdapter.listen({});
  const erroredRecognition = state.recognitions[2];
  erroredRecognition.error("network");
  erroredRecognition.end();
  await errorRun.catch(() => null);
  events = state.context.MicReleaseTrace.events();
  check(events.some(event => event.type === "onerror" && event.error === "network"), "onerror is recorded");

  for (let index = 0; index < 12; index += 1) {
    const promise = state.context.SpeechRecognitionAdapter.listen({});
    const item = state.recognitions[state.recognitions.length - 1];
    item.result(`word-${index}`, true);
    item.end();
    await promise;
  }
  events = state.context.MicReleaseTrace.events();
  check(events.length === 64, "storage enforces the 64 event limit");
  check(events.every(event => !event.type.startsWith("gesture-")), "gesture noise is excluded");

  const off = createRuntime("");
  const offRun = off.context.SpeechRecognitionAdapter.listen({});
  off.recognitions[0].result("Hello", true);
  off.recognitions[0].end();
  await offRun;
  check(off.context.MicReleaseTrace.events().length === 0, "Trace OFF stores no events");
  check(Object.keys(off.documentListeners).length === 0 && Object.keys(off.windowListeners).length === 0, "Trace OFF installs no page listeners");

  check(!adapterSource.includes(".abort()"), "abort is not added");
  check(!adapterSource.includes("getUserMedia"), "getUserMedia is not added");
  check(!adapterSource.includes("MediaStream"), "MediaStream is not added");
  check(!/audioSession\s*\.\s*(type|state)\s*=/.test(adapterSource + audioSource), "navigator.audioSession is read only");
  check(hash(read("engine/services/speech-engine.js")) === "572453a24e542091eaf54e90fffa9c5d4f7e2c045b3706c2494d57748e526e39", "SpeechEngine is unchanged");
  check(hash(read("engine/services/speech-start-controller.js")) === "f6d1224d0ae71f8ee12067f0ede79650dae84a88d2c68b7ce474ce48c24b8161", "SpeechStartController is unchanged");
  check(hash(read("engine/managers/monster-battle-manager.js")) === "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3", "Monster Battle is unchanged");

  console.log(`iPhone Speech Native Mic Release Boundary Trace V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
