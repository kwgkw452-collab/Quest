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
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
function check(value, message) { assert(value, message); checks += 1; }

function runtime(options = {}) {
  const events = [];
  const recognitions = [];

  class Recognition {
    constructor() { recognitions.push(this); }
    start() {
      events.push("browser-start");
      if (options.startFailure) throw new Error("start-failed");
      if (this.onstart) this.onstart();
    }
    stop() {
      events.push("browser-stop");
      if (options.synchronousStopEnd && this.onend) this.onend();
    }
    result(text, isFinal) {
      const item = [{ transcript: text, confidence: 0.9 }];
      item.isFinal = isFinal;
      this.onresult({ resultIndex: 0, results: [item] });
    }
    error(code) { this.onerror({ error: code }); }
    end() { this.onend(); }
  }

  const context = {
    window: null,
    console: { log() {}, warn() {}, error() {} },
    Promise,
    setTimeout,
    clearTimeout,
    SpeechRecognition: Recognition,
    GameConfig: { defaultLanguage: "en-US" },
    SpeechNormalizer: {
      normalize(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); },
      includesAny(value, accepted) {
        const normalized = this.normalize(value);
        return accepted.some(item => normalized === this.normalize(item));
      }
    },
    AudioManager: {
      async enterSpeechMode() { events.push("speech-mode-active"); return true; },
      async exitSpeechMode() {
        events.push("exit-speech-mode-start");
        events.push("bgm-restore-start");
        events.push("bgm-play-call");
        return true;
      },
      getState() { return { speechMode: { state: "active" } }; }
    },
    GainNodeVoiceRuntimeTrace: {
      record(type) { events.push(type); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("engine/services/speech-recognition-adapter.js"), context);
  vm.runInContext(read("engine/services/speech-engine.js"), context);
  vm.runInContext(read("engine/services/speech-start-controller.js"), context);
  return { context, events, recognitions };
}

function before(events, first, second, message) {
  const a = events.indexOf(first);
  const b = events.indexOf(second);
  check(a !== -1 && b !== -1 && a < b, message + ` (${a} < ${b})`);
}

function noRestore(runtimeState, message) {
  check(!runtimeState.events.includes("exit-speech-mode-start") &&
    !runtimeState.events.includes("bgm-restore-start") &&
    !runtimeState.events.includes("bgm-play-call"), message);
}

async function verifyRestoreOrder(state, promise, expected) {
  const outcome = await promise.then(value => ({ value }), error => ({ error: error.message }));
  if (expected.value !== undefined) check(outcome.value === expected.value, expected.label);
  else check(outcome.error === expected.error, expected.label);
  await flush();
  const adapterKind = expected.adapterKind || (expected.value !== undefined ? "resolve" : "reject");
  before(state.events, "recognition-onend", "adapter-" + adapterKind,
    "adapter completion follows recognition.onend");
  before(state.events, "recognition-onend", "speech-listen-finally", "listen finally follows recognition.onend");
  before(state.events, "recognition-onend", "exit-speech-mode-start", "Audio exit follows recognition.onend");
  before(state.events, "recognition-onend", "bgm-restore-start", "BGM restore follows recognition.onend");
  before(state.events, "recognition-onend", "bgm-play-call", "BGM play follows recognition.onend");
}

(async () => {
  // Normal final result.
  {
    const state = runtime();
    const run = state.context.SpeechEngine.listen({});
    await flush();
    state.recognitions[0].result("Hello", true);
    noRestore(state, "final result alone does not restore Audio");
    state.recognitions[0].end();
    await verifyRestoreOrder(state, run, { value: "Hello", label: "normal result unchanged" });
  }

  // Hello early commit calls the common stop path after two stable interim results.
  {
    const state = runtime();
    let start;
    const mission = state.context.SpeechEngine.mission({
      accepted: ["hello"],
      __legacyEarlyCommit: "stable-primary-normalized-exact-hello"
    }, {
      addStartButton(callback) { start = callback; },
      showRetry() {}
    });
    start();
    await flush();
    const recognition = state.recognitions[0];
    recognition.result("Hello", false);
    recognition.result("Hello", false);
    check(state.events.includes("hello-early-commit"), "Hello early commit reached");
    check(state.events.includes("recognition-stop-call"), "Hello early commit requests stop");
    noRestore(state, "Hello early commit cannot restore before onend");
    recognition.end();
    await verifyRestoreOrder(state, mission, {
      value: "hello",
      adapterKind: "reject",
      label: "Hello early commit result unchanged"
    });
  }

  // Explicit SpeechEngine.stop.
  {
    const state = runtime();
    const run = state.context.SpeechEngine.listen({});
    await flush();
    state.context.SpeechEngine.stop();
    noRestore(state, "explicit stop cannot restore before onend");
    state.recognitions[0].end();
    await verifyRestoreOrder(state, run, { error: "no-speech", label: "stop verdict unchanged" });
  }

  // Recognition error is retained, but delivered only after browser teardown.
  {
    const state = runtime();
    const run = state.context.SpeechEngine.listen({});
    await flush();
    state.recognitions[0].error("network");
    noRestore(state, "error cannot restore before onend");
    state.recognitions[0].end();
    await verifyRestoreOrder(state, run, { error: "network", label: "error code unchanged" });
  }

  // Timeout requests stop, then waits for the browser's onend.
  {
    const state = runtime();
    const run = state.context.SpeechEngine.listen({ timeoutMs: 10 });
    await flush();
    await wait(20);
    check(state.events.includes("browser-stop"), "timeout requests browser stop");
    noRestore(state, "timeout cannot restore before onend");
    state.recognitions[0].end();
    await verifyRestoreOrder(state, run, { error: "speech-timeout", label: "timeout code retained until onend" });
  }

  // Controller cancel uses the same serialized stop path.
  {
    const state = runtime();
    const run = state.context.SpeechStartController.startListening({});
    await flush();
    state.context.SpeechStartController.cancel();
    noRestore(state, "cancel cannot restore before onend");
    state.recognitions[0].end();
    await verifyRestoreOrder(state, run, { error: "no-speech", label: "cancel result unchanged" });
  }

  // Synchronous start failure has no browser session and must not wait for a nonexistent onend.
  {
    const state = runtime({ startFailure: true });
    const result = await state.context.SpeechEngine.listen({}).then(() => null, error => error.message);
    check(result === "start-failed", "start failure remains immediate");
    check(!state.events.includes("recognition-onend"), "start failure does not invent onend");
    check(state.events.includes("exit-speech-mode-start"), "start failure releases Audio isolation");
  }

  const adapter = read("engine/services/speech-recognition-adapter.js");
  const engine = read("engine/services/speech-engine.js");
  const audio = read("engine/managers/audio-manager.js");
  const index = read("index.html");
  check(!/setTimeout\s*\(\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)?[^,]*,\s*500\s*\)/s.test(adapter + engine),
    "no arbitrary 500ms teardown wait added");
  check(!/audioSession\s*\.\s*(?:type|state)\s*=/.test(adapter + engine + audio),
    "navigator.audioSession remains read-only");
  check(index.includes("iphone-speech-audio-restore-timing-ab-v1"),
    "production cache marker identifies A/B diagnostic built on serialization fix");

  console.log(`iPhone Speech Recognition Teardown Serialization Fix V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
