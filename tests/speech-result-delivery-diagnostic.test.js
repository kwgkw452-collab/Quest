"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
function setup(search = "?micReleaseTrace=1", holdAudio = false) {
  const instances = [], seen = [], audio = [];
  let releaseAudio;
  const release = new Promise(resolve => { releaseAudio = resolve; });
  class Recognition {
    constructor() { this.listeners = {}; instances.push(this); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, event = {}) { if (this["on" + name]) this["on" + name](event); for (const fn of this.listeners[name] || []) fn(event); }
    start() { this.emit("start"); }
    stop() { throw Error("Unexpected stop"); }
  }
  const c = { console: { log() {}, warn() {} }, Date, URLSearchParams, Promise, setTimeout, clearTimeout,
    location: { search }, SpeechRecognition: Recognition, GameConfig: { defaultLanguage: "en-US" },
    AudioManager: { enterSpeechMode() { audio.push("enter"); }, exitSpeechMode() { audio.push("exit"); return holdAudio ? release : Promise.resolve(); } } };
  c.window = c; vm.createContext(c);
  for (const file of ["engine/services/speech-normalizer.js", "engine/services/speech-recognition-adapter.js", "engine/services/speech-engine.js", "engine/services/speech-start-controller.js", "data/word-dictionaries.js", "data/questions.js", "data/communicative-judge-rules.js", "engine/services/local-communicative-judge.js", "engine/services/communicative-judge.js", "engine/services/communicative-question-adapter.js", "engine/managers/question-manager.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), c, { filename: file });
  }
  c.MicReleaseTrace.subscribe(entry => seen.push(entry));
  return { c, instances, seen, audio, releaseAudio };
}
function nativeResult(text, final, confidence = 0.91) { const r = [{ transcript: text, confidence }, { transcript: "Are you okay?", confidence: 0.5 }]; r.isFinal = final; return r; }
async function flush() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
(async () => {
  const t = setup(); let resolved = false;
  const p = t.c.QuestionManager.start("phrase.are_you_ok", {}).then(v => { resolved = true; return v; });
  await flush(); assert.equal(t.instances.length, 1);
  const r = t.instances[0], interim = nativeResult("Are you", false), final = nativeResult("Are you OK?", true);
  r.emit("result", { resultIndex: 0, results: [interim] });
  r.emit("result", { resultIndex: 1, results: [final, final] });
  const raw = t.seen.filter(e => e.type === "native-result");
  assert.equal(raw.length, 2); assert.equal(raw[1].resultIndex, 1); assert.equal(raw[1].resultsLength, 2);
  assert.equal(raw[0].results[0].isFinal, false); assert.equal(raw[1].results[1].isFinal, true);
  assert.equal(raw[1].results[1].alternatives[0].transcript, "Are you OK?"); assert.equal(raw[1].results[1].alternatives[0].confidence, 0.91);
  assert.equal(raw[1].results[0].index, 0, "snapshot includes unchanged native entries before resultIndex");
  final[0].transcript = "mutated after dispatch";
  assert.equal(raw[1].results[1].alternatives[0].transcript, "Are you OK?", "native snapshot retains strings, not event references");
  assert(!t.seen.some(e => e.type === "adapter-output" && e.boundary === "resolve"));
  await flush(); assert.equal(resolved, false); r.emit("end");
  const result = await p; assert.equal(result.status, "success"); assert.equal(result.answer, "Are you OK?");
  const output = t.seen.find(e => e.type === "adapter-output" && e.boundary === "resolve"); assert.equal(output.transcript, "Are you OK?");
  assert(t.seen.some(e => e.type === "consumer-received" && e.component === "SpeechEngine" && e.boundary === "Adapter.resolve" && e.transcript === output.transcript));
  assert(t.seen.some(e => e.type === "consumer-received" && e.component === "QuestionManager" && e.boundary === "startListening.resolve" && e.transcript === output.transcript));
  assert(t.seen.some(e => e.type === "judge-input" && e.component === "QuestionManager" && e.transcript === output.transcript && e.hasTranscript));
  assert.deepEqual(t.audio, ["enter", "exit"]);

  // Diagnose delivery blocked after recognition, without changing or releasing Audio.
  const stalled = setup("?micReleaseTrace=1", true); const pending = stalled.c.QuestionManager.start("phrase.are_you_ok", {}); await flush();
  stalled.instances[0].emit("result", { resultIndex: 0, results: [nativeResult("Are you OK?", true)] }); stalled.instances[0].emit("end"); await flush();
  assert(stalled.seen.some(e => e.type === "consumer-received" && e.boundary === "return-before-finally"));
  assert(!stalled.seen.some(e => e.type === "consumer-received" && e.component === "QuestionManager" && e.boundary === "startListening.resolve"));
  assert(!stalled.seen.some(e => e.type === "judge-input")); stalled.releaseAudio(); assert.equal((await pending).status, "success");

  // Interim-only ending keeps the existing reject/fallback contracts visible.
  const partial = setup(); const pp = partial.c.QuestionManager.start("phrase.are_you_ok", {}); await flush();
  partial.instances[0].emit("result", { resultIndex: 0, results: [nativeResult("Are you OK?", false)] }); partial.instances[0].emit("end");
  assert.equal((await pp).status, "success"); assert(partial.seen.some(e => e.type === "adapter-output" && e.boundary === "reject" && e.transcript === "" && e.latestInterim === "Are you OK?" && e.error === "no-speech"));
  assert(partial.seen.some(e => e.type === "judge-input" && e.transcript === "Are you OK?"));

  for (const mode of ["off", "broken"]) {
    const h = setup(mode === "off" ? "" : "?micReleaseTrace=1");
    if (mode === "broken") h.c.MicReleaseTrace.recordDelivery = () => { throw Error("trace failed"); };
    const pending = h.c.QuestionManager.start("phrase.are_you_ok", {}); await flush(); h.instances[0].emit("result", { resultIndex: 0, results: [nativeResult("Are you OK?", true)] }); h.instances[0].emit("end");
    assert.equal((await pending).status, "success"); if (mode === "off") assert.equal(h.seen.length, 0);
  }
  console.log("speech-result-delivery-diagnostic.test.js: PASS (native metadata/all entries, immutable snapshots, callbacks/resolve/reject, real SpeechEngine/QuestionManager/Judge, Audio wait boundary, interim fallback, OFF/failed sink)");
})().catch(e => { console.error(e); process.exitCode = 1; });
