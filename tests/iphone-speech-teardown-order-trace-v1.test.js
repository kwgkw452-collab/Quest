"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const audioSource = read("engine/managers/audio-manager.js");
const engineSource = read("engine/services/speech-engine.js");
const adapterSource = read("engine/services/speech-recognition-adapter.js");
const combined = [audioSource, engineSource, adapterSource].join("\n");

const requiredEvents = [
  "speech-listen-enter", "speech-mode-enter-start", "speech-mode-active",
  "recognition-start-call", "recognition-onstart", "recognition-result",
  "hello-early-commit", "release-speech-audio-start", "recognition-stop-call",
  "recognition-onerror", "recognition-onend", "adapter-resolve", "adapter-reject",
  "speech-listen-finally", "exit-speech-mode-start", "audio-context-before-resume",
  "audio-context-resume-call", "audio-context-resume-resolved",
  "audio-context-resume-rejected", "context-statechange", "speech-mode-idle",
  "bgm-restore-start", "bgm-play-call", "bgm-play-resolved",
  "bgm-play-rejected", "bgm-playing-event"
];

let checks = 0;
function check(value, message) { assert(value, message); checks += 1; }

requiredEvents.forEach(eventName => {
  check(combined.includes(`"${eventName}"`), `trace event exists: ${eventName}`);
});

check(audioSource.includes("audioSessionTraceSnapshot"), "Audio Session read-only snapshot exists");
check(audioSource.includes('label: "unsupported"'), "unsupported Audio Session is reported");
check(!/audioSession\s*\.\s*type\s*=/.test(combined), "navigator.audioSession.type is never written");
check(audioSource.includes('"EVENT LOG (latest "'), "existing EVENT LOG remains present");
check(audioSource.includes('"CTX: "') && audioSource.includes('"BGM: "') && audioSource.includes('"VOICE: "'),
  "existing CTX/BGM/VOICE trace remains present");

const traces = [];
const recognitions = [];
class Recognition {
  constructor() { recognitions.push(this); }
  start() { if (this.onstart) this.onstart(); }
  stop() {}
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
  console: { log() {} },
  Promise,
  SpeechRecognition: Recognition,
  GainNodeVoiceRuntimeTrace: { record(type, detail) { traces.push({ type, detail: detail || {} }); } },
  setTimeout,
  clearTimeout
};
context.window = context;
vm.createContext(context);
vm.runInContext(adapterSource, context);

(async () => {
  const success = context.SpeechRecognitionAdapter.listen({});
  const first = recognitions[0];
  first.result("hel", false);
  first.result("hello", true);
  first.end();
  check(await success === "hello", "adapter success result remains unchanged");
  const successOrder = traces.map(item => item.type);
  check(successOrder.indexOf("recognition-start-call") < successOrder.indexOf("recognition-onstart"),
    "start call precedes onstart");
  check(successOrder.indexOf("recognition-onend") < successOrder.indexOf("adapter-resolve"),
    "normal success settles after onend");
  check(traces.filter(item => item.type === "recognition-result").some(item => item.detail.final === false) &&
    traces.filter(item => item.type === "recognition-result").some(item => item.detail.final === true),
    "interim and final results are distinguished without transcript logging");

  traces.length = 0;
  const stopped = context.SpeechRecognitionAdapter.listen({});
  const second = recognitions[1];
  context.SpeechRecognitionAdapter.stop();
  second.end();
  await stopped.catch(() => null);
  const stopOrder = traces.map(item => item.type);
  check(stopOrder.indexOf("recognition-stop-call") < stopOrder.indexOf("recognition-onend"),
    "stop boundary order is observable");

  traces.length = 0;
  const failed = context.SpeechRecognitionAdapter.listen({});
  const third = recognitions[2];
  third.error("network");
  third.end();
  await failed.catch(error => check(error.message === "network", "adapter error remains unchanged"));
  const errorOrder = traces.map(item => item.type);
  check(errorOrder.indexOf("recognition-onerror") < errorOrder.indexOf("recognition-onend"),
    "error precedes browser teardown completion");
  check(errorOrder.indexOf("recognition-onend") < errorOrder.indexOf("adapter-reject"),
    "error settlement is serialized after onend");

  console.log(`iPhone Speech Teardown Order Trace V1: ${checks}/${checks} PASS`);
})().catch(error => { console.error(error); process.exitCode = 1; });
