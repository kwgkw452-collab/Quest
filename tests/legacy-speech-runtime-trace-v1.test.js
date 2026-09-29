"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function resultEvent(transcript, isFinal, alternatives) {
  const values = [transcript].concat(alternatives || []).map((value, index) => ({
    transcript: value,
    confidence: 0.9 - (index * 0.1)
  }));
  values.isFinal = isFinal;
  return { resultIndex: 0, results: [values] };
}

function createContext(plans) {
  let clock = 0;
  let planIndex = 0;
  let retries = 0;
  const formalEvents = [];

  class FakeRecognition {
    start() {
      const plan = plans[planIndex++];
      if (!plan) throw new Error("missing-recognition-plan");
      if (plan.startAt !== undefined) clock = plan.startAt;
      if (this.onstart) this.onstart();
      for (const event of plan.events) {
        clock = event.at;
        if (event.type === "result" && this.onresult) {
          this.onresult(resultEvent(event.transcript, event.isFinal, event.alternatives));
        } else if (event.type === "error" && this.onerror) {
          this.onerror({ error: event.error, message: event.message || "" });
        } else if (event.type === "end" && this.onend) {
          this.onend();
        }
      }
    }
    stop() {}
  }

  const context = {
    console,
    performance: { now: () => clock },
    setTimeout: fn => { fn(); return 1; },
    clearTimeout() {},
    SpeechRecognition: FakeRecognition,
    GameConfig: { defaultLanguage: "en-US" },
    AudioManager: { stopAll() {} },
    DialogueVoiceController: { stop() {} },
    SpeechAudioDuckingInternal: { isArmed: () => false },
    FormalSpeechTrace: { record(name) { formalEvents.push(name); } }
  };
  context.window = context;
  vm.createContext(context);

  [
    "data/word-dictionaries.js",
    "data/questions.js",
    "data/communicative-judge-rules.js",
    "engine/services/speech-normalizer.js",
    "engine/services/legacy-speech-trace.js",
    "engine/services/speech-recognition-adapter.js",
    "engine/services/speech-engine.js",
    "engine/services/speech-start-controller.js",
    "engine/services/local-communicative-judge.js",
    "engine/services/communicative-judge.js",
    "engine/services/communicative-question-adapter.js"
  ].forEach(file => vm.runInContext(read(file), context, { filename: file }));

  context.GameCore = {
    speechMission(config) {
      return context.SpeechEngine.mission(config, {
        showMission() {},
        clearControls() {},
        showRecognized() {},
        addStartButton(startListening) { startListening(); },
        showRetry(error, startListening) {
          retries += 1;
          startListening();
        },
        onSuccess() {}
      });
    }
  };
  vm.runInContext(read("engine/managers/question-manager.js"), context, { filename: "engine/managers/question-manager.js" });

  return {
    context,
    retries: () => retries,
    formalEvents
  };
}

function events(context) {
  return Array.from(context.LegacySpeechTrace.getEntries());
}

function names(list, attempt) {
  return list.filter(entry => attempt === undefined || entry.attempt === attempt).map(entry => entry.event);
}

function assertChronology(list) {
  for (let i = 1; i < list.length; i += 1) {
    assert(list[i].sequence > list[i - 1].sequence, "sequence must increase");
    assert(list[i].timestampMs >= list[i - 1].timestampMs, "timestamp must not move backwards");
    assert(list[i].elapsedMs >= list[i - 1].elapsedMs, "elapsedMs must not move backwards");
  }
}

(async () => {
  // CASE A: final Hello -> onend -> adapter resolve -> judge success.
  let item = createContext([{ events: [
    { type: "result", at: 100, transcript: "Hello", isFinal: true, alternatives: ["Hallo"] },
    { type: "end", at: 140 }
  ] }]);
  let value = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(value.status, "success");
  let list = events(item.context);
  assert.deepStrictEqual(names(list), [
    "legacy-speech-start", "recognition-start-call", "recognition-onstart",
    "recognition-result", "legacy-final", "recognition-end", "adapter-resolve",
    "legacy-judge-start", "legacy-judge-result", "legacy-success", "legacy-flow-end"
  ]);
  assert.strictEqual(list.find(entry => entry.event === "recognition-result").primaryConfidence, 0.9);
  assert.strictEqual(list[0].questionId, "word.hello");
  assert.strictEqual(list[0].storyId, "S001");
  assert.strictEqual(list[0].runtime, "story");
  assertChronology(list);

  // CASE B: opted-in word.hello recovers exact interim after onend/no-speech.
  item = createContext([
    { events: [
      { type: "result", at: 80, transcript: "Hello", isFinal: false },
      { type: "end", at: 120 }
    ] },
    { startAt: 150, events: [
      { type: "result", at: 200, transcript: "Hello", isFinal: true },
      { type: "end", at: 220 }
    ] }
  ]);
  value = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(value.status, "success");
  assert.strictEqual(item.retries(), 0);
  list = events(item.context);
  assert(names(list, 1).includes("legacy-interim"));
  assert(names(list, 1).includes("adapter-reject"));
  assert(names(list, 1).includes("legacy-interim-fallback-selected"));
  assert.strictEqual(list.find(entry => entry.event === "adapter-reject").error, "no-speech");
  assert(names(list, 1).includes("legacy-judge-start"));

  // CASE C: final Hello -> onerror network -> reject -> Retry.
  item = createContext([
    { events: [
      { type: "result", at: 60, transcript: "Hello", isFinal: true },
      { type: "error", at: 90, error: "network", message: "network failed" },
      { type: "end", at: 100 }
    ] },
    { startAt: 130, events: [
      { type: "result", at: 160, transcript: "Hello", isFinal: true },
      { type: "end", at: 180 }
    ] }
  ]);
  value = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(value.status, "success");
  assert.strictEqual(item.retries(), 1);
  list = events(item.context);
  const errorEntry = list.find(entry => entry.event === "recognition-error");
  assert.strictEqual(errorEntry.error, "network");
  assert.strictEqual(errorEntry.hadFinalText, true);
  assert.strictEqual(errorEntry.finalText, "Hello");
  assert.strictEqual(errorEntry.attempt, 1);
  assert.strictEqual(list.find(entry => entry.event === "recognition-end" && entry.lastError === "network").attempt, 1);
  assert(!names(list, 1).includes("legacy-judge-start"));

  // CASE D: 5.1-second interim-only wait is visible in elapsedMs before no-speech.
  item = createContext([
    { events: [
      { type: "result", at: 100, transcript: "Hello", isFinal: false },
      { type: "end", at: 5100 }
    ] },
    { startAt: 5200, events: [
      { type: "result", at: 5250, transcript: "Hello", isFinal: true },
      { type: "end", at: 5280 }
    ] }
  ]);
  await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  list = events(item.context);
  const longEnd = list.find(entry => entry.event === "recognition-end" && entry.attempt === 1);
  assert.strictEqual(longEnd.elapsedMs, 5100);
  assert.strictEqual(longEnd.finalText, "");
  assert.strictEqual(longEnd.latestInterim, "Hello");

  // CASE E: Number Monster's normal final remains successful and is identified.
  item = createContext([{ events: [
    { type: "result", at: 70, transcript: "two", isFinal: true },
    { type: "end", at: 100 }
  ] }]);
  value = await item.context.QuestionManager.start("word.single-digit-number", {
    __legacyTraceContext: { runtime: "monster", monsterId: "m002" }
  });
  assert.strictEqual(value.status, "success");
  list = events(item.context);
  assert.strictEqual(list[0].runtime, "monster");
  assert.strictEqual(list[0].monsterId, "m002");
  assert(names(list).includes("legacy-success"));

  // CASE F: Communicative input keeps Formal trace and creates no Legacy entries.
  item = createContext([]);
  value = await item.context.QuestionManager.start("phrase.are_you_ok", {
    inputMode: "text",
    transcript: "Are you all right?",
    __formalTraceContext: { source: "trace-test" }
  });
  assert.strictEqual(value.status, "success");
  assert.strictEqual(events(item.context).length, 0);
  assert(item.formalEvents.includes("question-manager-start"));
  assert(item.formalEvents.includes("judge-result"));

  const indexHtml = read("index.html");
  const devHtml = read("dev.html");
  const traceSource = read("engine/services/legacy-speech-trace.js");
  assert(indexHtml.includes("engine/services/legacy-speech-trace.js?v=legacy-speech-runtime-trace-v1"));
  assert(devHtml.includes("engine/services/legacy-speech-trace.js?v=legacy-speech-runtime-trace-v1"));
  assert(!indexHtml.includes("dev/formal-speech-trace.js"));
  assert(devHtml.includes("dev/formal-speech-trace.js?v=communicative-formal-trace-v1"));
  assert(!traceSource.includes("setTimeout"));
  assert(!traceSource.includes("Promise"));
  assert(!traceSource.includes("console.log"));
  assert(!traceSource.includes("queueMicrotask"));
  assert(read("engine/services/speech-recognition-adapter.js").includes("if (options.timeoutMs > 0)"));
  assert(!read("engine/services/speech-recognition-adapter.js").includes("5000"));

  console.log("Legacy Speech Runtime Trace V1 tests: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
