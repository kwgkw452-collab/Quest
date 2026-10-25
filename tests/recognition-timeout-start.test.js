"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const source = fs.readFileSync(path.join(__dirname, "../engine/services/speech-recognition-adapter.js"), "utf8");
function harness(search = "?micReleaseTrace=1", startError = false) {
  let now = 0;
  const timers = [], instances = [];
  class Clock extends Date { constructor(value) { super(value === undefined ? now : value); } static now() { return now; } }
  class Recognition {
    constructor() { this.listeners = {}; this.stopCalls = 0; instances.push(this); }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    emit(name, event = {}) { if (this["on" + name]) this["on" + name](event); for (const fn of this.listeners[name] || []) fn(event); }
    start() { if (startError) throw Error("start-failed"); }
    stop() { this.stopCalls++; }
  }
  const c = { Date: Clock, URLSearchParams, Promise, SpeechRecognition: Recognition, location: { search }, console: { log() {} },
    setTimeout(fn, delay) { timers.push({ fn, due: now + delay, delay, cleared: false }); return timers.length; },
    clearTimeout(id) { timers[id - 1].cleared = true; } };
  c.window = c; vm.createContext(c); vm.runInContext(source, c);
  return { c, timers, instances, at(value) { now = value; for (const timer of timers) if (!timer.cleared && timer.due <= now) { timer.cleared = true; timer.fn(); } } };
}
function result(text, final = true, secondary) {
  const item = [{ transcript: text }]; if (secondary) item.push({ transcript: secondary }); item.isFinal = final;
  return { resultIndex: 0, results: [item] };
}
(async () => {
  // Startup latency never consumes the 8000ms native speech window.
  const t = harness(); let settled = false;
  const pending = t.c.SpeechRecognitionAdapter.listen({ timeoutMs: 8000 }).catch(e => e.message).then(v => { settled = true; return v; });
  const r = t.instances[0]; t.at(1400); assert.equal(t.timers.length, 0); r.emit("start");
  assert.equal(t.timers[0].due, 9400); r.emit("start"); assert.equal(t.timers.length, 1);
  t.at(8000); assert.equal(r.stopCalls, 0); t.at(9399); assert.equal(r.stopCalls, 0);
  t.at(9400); assert.equal(r.stopCalls, 1); await Promise.resolve(); assert.equal(settled, false);
  r.emit("end"); assert.equal(await pending, "speech-timeout");
  for (const [text, final, secondary] of [["Hello", true], ["Hello", false], ["", false, "Hello"]]) {
    const h = harness(); let done = false; const observed = [];
    const p = h.c.SpeechRecognitionAdapter.listen({ timeoutMs: 8000, onInterim: value => observed.push(value) }).catch(e => e.message).then(v => { done = true; return v; });
    const rec = h.instances[0]; h.at(1400); rec.emit("start"); h.at(7000); rec.emit("result", result(text, final, secondary));
    assert.equal(h.timers[0].cleared, true); assert.equal(observed.length, 1);
    h.at(10000); h.timers[0].fn(); rec.emit("start"); // stale queued callback / duplicate start
    assert.equal(rec.stopCalls, 0); assert.equal(h.timers.length, 1); await Promise.resolve(); assert.equal(done, false);
    rec.emit("end"); assert.equal(await p, final ? "Hello" : "no-speech");
    assert(!h.c.MicReleaseTrace.events().some(e => ["timeout-fired", "termination-call"].includes(e.type)));
    h.c.SpeechRecognitionAdapter.listen({ timeoutMs: 8000 }).catch(() => {});
    h.instances[1].emit("start"); assert.equal(h.timers.length, 2); assert.equal(h.timers[1].cleared, false);
  }
  const empty = harness(); const ep = empty.c.SpeechRecognitionAdapter.listen({ timeoutMs: 8000 }).catch(e => e.message);
  empty.instances[0].emit("start"); empty.instances[0].emit("result", result("   ", false)); assert.equal(empty.timers[0].cleared, false);
  empty.at(8000); assert.equal(empty.instances[0].stopCalls, 1); empty.instances[0].emit("end"); await ep;
  const ended = harness(); const endp = ended.c.SpeechRecognitionAdapter.listen({ timeoutMs: 8000 }).catch(e => e.message);
  ended.instances[0].emit("end"); await endp; ended.instances[0].emit("start"); assert.equal(ended.timers.length, 0);
  const failed = harness("", true); assert.equal(await failed.c.SpeechRecognitionAdapter.listen({ timeoutMs: 8000 }).catch(e => e.message), "start-failed"); assert.equal(failed.timers.length, 0);
  const off = harness(""); const op = off.c.SpeechRecognitionAdapter.listen({ timeoutMs: 8000 }); off.at(1400); off.instances[0].emit("start"); off.instances[0].emit("result", result("Hello")); off.at(10000); off.instances[0].emit("end"); assert.equal(await op, "Hello"); assert.equal(off.c.MicReleaseTrace.events().length, 0);
  console.log("recognition-timeout-start.test.js: PASS (delayed start, full 8000ms, valid/empty results, stale callbacks, end ownership, instance isolation, trace OFF)");
})().catch(e => { console.error(e); process.exitCode = 1; });
