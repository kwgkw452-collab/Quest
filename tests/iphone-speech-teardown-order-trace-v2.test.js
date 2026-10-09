const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const vm = require("vm");

const manager = fs.readFileSync("engine/managers/audio-manager.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const adapter = fs.readFileSync("engine/services/speech-recognition-adapter.js", "utf8");
const engine = fs.readFileSync("engine/services/speech-engine.js", "utf8");
const startController = fs.readFileSync("engine/services/speech-start-controller.js", "utf8");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");

let checks = 0;
function check(value, message) { assert(value, message); checks += 1; }

check(manager.includes('SPEECH_TRACE_VERSION = "iphone-speech-teardown-order-trace-v2"'), "V2 production marker exists");
check(manager.includes('"Speech Trace: " + SPEECH_TRACE_VERSION'), "V2 marker is visible in panel");
check(manager.includes("speechOrderTraceState"), "dedicated speech order storage exists");
check(manager.includes("SPEECH_ORDER_STORAGE_LIMIT = 48"), "speech storage is bounded at 48");
check(manager.includes("SPEECH_ORDER_DISPLAY_LIMIT = 30"), "speech display is bounded at 30");
check(manager.includes('"SPEECH ORDER (latest "'), "dedicated SPEECH ORDER panel exists");

const allowlist = manager.slice(manager.indexOf("var SPEECH_ORDER_EVENT_TYPES"), manager.indexOf("var speechOrderTraceState"));
for (const eventName of [
  "recognition-stop-call", "recognition-onend", "exit-speech-mode-start", "bgm-play-call",
  "hello-early-commit", "release-speech-audio-start", "speech-mode-idle", "bgm-playing-event"
]) check(allowlist.includes(`"${eventName}"`), `speech event is routed: ${eventName}`);
for (const gestureName of ["trusted-gesture", "touchstart", "touchend", "pointerdown", "click", "focus", "blur", "visibilitychange"]) {
  check(!allowlist.includes(`"${gestureName}"`), `gesture is excluded: ${gestureName}`);
}

check(manager.includes('resultType = record.final === true ? "final" : "interim"'), "recognition result types are separated");
check(manager.includes("speechOrderTraceState.resultSeen[resultType]"), "duplicate result type is suppressed in trace only");
check(manager.includes("recordSpeechOrderEvent(record);\n    renderVoiceRuntimeTracePanel();"), "speech storage adds no extra render call");
check(manager.includes('session=" + stringifyTraceValue(event.audioSession)'), "audio session is displayed for speech events");
check(!/audioSession\s*\.\s*(type|state)\s*=/.test(manager + adapter + engine), "navigator.audioSession is read only");

check(index.includes("speech-recognition-adapter.js?v=iphone-speech-native-mic-release-boundary-trace-v1"), "mic release trace cache key: speech-recognition-adapter.js");
check(index.includes("speech-engine.js?v=iphone-speech-recognition-teardown-serialization-fix-v1"), "serialization fix cache key: speech-engine.js");
check(index.includes("audio-manager.js?v=iphone-speech-native-mic-release-boundary-trace-v1"), "mic release trace cache key: audio-manager.js");

check(hash(adapter) === "d44acdd663e52a668d15f2af74ff67d63d7df796da46cb881b991543c68f92db", "Recognition adapter matches mic release boundary trace");
check(hash(engine) === "572453a24e542091eaf54e90fffa9c5d4f7e2c045b3706c2494d57748e526e39", "Speech engine matches teardown serialization fix");
check(hash(startController) === "f6d1224d0ae71f8ee12067f0ede79650dae84a88d2c68b7ce474ce48c24b8161", "SpeechStartController is unchanged from V1");

const runtime = {
  console: { log() {}, warn() {}, error() {} },
  URLSearchParams,
  Date,
  Math,
  Promise,
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() { return 1; },
  clearInterval() {},
  location: { search: "?audioTrace=1" },
  navigator: { audioSession: { type: "playback", state: "active" } },
  screen: { orientation: { type: "portrait-primary", addEventListener() {} } },
  innerWidth: 390,
  innerHeight: 844,
  addEventListener() {},
  removeEventListener() {},
  document: {
    body: null,
    visibilityState: "visible",
    hidden: false,
    hasFocus() { return true; },
    addEventListener() {},
    removeEventListener() {}
  }
};
runtime.window = runtime;
runtime.globalThis = runtime;
vm.runInNewContext(manager, runtime);
const trace = runtime.GainNodeVoiceRuntimeTrace;
trace.record("speech-listen-enter");
trace.record("gesture-click");
trace.record("recognition-result", { final: false });
trace.record("recognition-result", { final: false });
trace.record("recognition-result", { final: true });
trace.record("recognition-stop-call");
trace.record("recognition-onend");
trace.record("exit-speech-mode-start");
trace.record("bgm-play-call");
const ordered = trace.speechOrder();
check(ordered.map(item => item.type).join(",") ===
  "speech-listen-enter,recognition-result,recognition-result,recognition-stop-call,recognition-onend,exit-speech-mode-start,bgm-play-call",
  "speech order is preserved and gesture/result spam is excluded");
check(ordered.every(item => item.audioSession === "playback/active"), "audio session snapshot is stored per speech event");
for (let i = 0; i < 60; i += 1) trace.record("context-statechange", { serial: i });
check(trace.speechOrder().length === 48, "speech order storage enforces its finite limit");

console.log(`iPhone Speech Teardown Order Trace V2: ${checks}/${checks} PASS`);
