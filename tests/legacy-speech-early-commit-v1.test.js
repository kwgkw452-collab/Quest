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
  values.isFinal = Boolean(isFinal);
  return { resultIndex: 0, results: [values] };
}

function createContext(plans) {
  let clock = 0;
  let planIndex = 0;
  let retries = 0;
  let judgeCount = 0;
  let successCount = 0;
  let valid = true;
  const instances = [];
  const missionConfigs = [];

  function deliver(instance, event) {
    if (event.at !== undefined) clock = event.at;
    if (event.type === "result" && instance.onresult) {
      instance.onresult(resultEvent(event.transcript, event.isFinal, event.alternatives));
    } else if (event.type === "error" && instance.onerror) {
      instance.onerror({ error: event.error, message: event.message || "" });
    } else if (event.type === "end" && instance.onend) {
      instance.onend();
    } else if (event.type === "invalidate") {
      valid = false;
    }
  }

  class FakeRecognition {
    constructor() {
      this.plan = plans[planIndex++];
      this.stopped = false;
      this.stopHandled = false;
      instances.push(this);
    }

    start() {
      if (!this.plan) throw new Error("missing-recognition-plan");
      if (this.onstart) this.onstart();
      for (const event of this.plan.events || []) {
        if (this.stopped) break;
        deliver(this, event);
      }
    }

    stop() {
      this.stopped = true;
      if (this.stopHandled) return;
      this.stopHandled = true;
      for (const event of this.plan.stopEvents || [{ type: "end" }]) deliver(this, event);
    }
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
    FormalSpeechTrace: { record() {} }
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

  context.SpeechEngine.on("result", () => { judgeCount += 1; });
  context.SpeechEngine.on("success", () => { successCount += 1; });
  context.GameCore = {
    speechMission(config) {
      missionConfigs.push(config);
      return context.SpeechEngine.mission(config, {
        showMission() {},
        clearControls() {},
        showRecognized() {},
        addStartButton(startListening) { startListening(); },
        showRetry(error, startListening) {
          retries += 1;
          if (planIndex < plans.length) startListening();
        },
        onSuccess() {}
      });
    }
  };
  vm.runInContext(read("engine/managers/question-manager.js"), context, {
    filename: "engine/managers/question-manager.js"
  });

  return {
    context,
    instances,
    missionConfigs,
    retries: () => retries,
    judgeCount: () => judgeCount,
    successCount: () => successCount,
    invalidate: () => { valid = false; },
    isValid: () => valid,
    deliver
  };
}

function entries(item, attempt) {
  return Array.from(item.context.LegacySpeechTrace.getEntries()).filter(entry =>
    attempt === undefined || entry.attempt === attempt
  );
}

function selected(item, attempt) {
  return entries(item, attempt).filter(entry => entry.event === "legacy-early-commit-selected");
}

function helloQuestion(item) {
  return item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
}

function plan(updates, stopEvents) {
  return {
    events: updates.map((value, index) => ({
      type: "result",
      at: 100 + (index * 50),
      transcript: value,
      isFinal: false
    })),
    stopEvents: stopEvents || [{ type: "end", at: 210 }]
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  // 1. Two exact hello updates select once.
  let item = createContext([plan(["hello", "hello"])]);
  let result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item).length, 1);
  assert.strictEqual(selected(item)[0].candidate, "hello");
  assert.strictEqual(selected(item)[0].normalizedCandidate, "hello");
  assert.strictEqual(selected(item)[0].consecutiveExactCount, 2);
  assert.strictEqual(selected(item)[0].attemptSerial, 1);
  assert.strictEqual(selected(item)[0].runIsCurrent, true);
  assert.strictEqual(selected(item)[0].attemptIsCurrent, true);
  assert.strictEqual(selected(item)[0].questionId, "word.hello");
  assert.strictEqual(typeof selected(item)[0].elapsedMs, "number");

  // 2. Normalization allows Hello! followed by hello.
  item = createContext([plan(["Hello!", "hello"])]);
  result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item).length, 1);

  // 3-7. Non-consecutive, partial, and alternative-only values never select.
  const rejectedUpdates = [
    ["hello", "yellow"],
    ["yellow", "hello"],
    ["hello"],
    ["hello there", "hello there"]
  ];
  for (const updates of rejectedUpdates) {
    item = createContext([{
      events: updates.map((value, index) => ({ type: "result", at: 100 + index, transcript: value, isFinal: false }))
        .concat([{ type: "end", at: 200 }])
    }]);
    void helloQuestion(item);
    await flush();
    assert.strictEqual(selected(item).length, 0, updates.join(" -> "));
  }
  item = createContext([{
    events: [
      { type: "result", at: 100, transcript: "yellow", isFinal: false, alternatives: ["hello"] },
      { type: "result", at: 150, transcript: "yellow", isFinal: false, alternatives: ["hello"] },
      { type: "end", at: 200 }
    ]
  }]);
  void helloQuestion(item);
  await flush();
  assert.strictEqual(selected(item).length, 0);

  // 8. A final produced by stop is cleanup; Judge and success happen once.
  item = createContext([plan(["hello", "hello"], [
    { type: "result", at: 205, transcript: "hello", isFinal: true },
    { type: "end", at: 210 }
  ])]);
  result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(entries(item).filter(entry => entry.event === "legacy-judge-start").length, 1);
  assert.strictEqual(item.successCount(), 1);
  assert.strictEqual(selected(item).length, 1);
  assert(entries(item).some(entry => entry.event === "adapter-resolve"));

  // 9. A no-speech rejection produced by stop still commits once.
  item = createContext([plan(["hello", "hello"], [{ type: "end", at: 210 }])]);
  result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(entries(item).filter(entry => entry.event === "legacy-judge-start").length, 1);
  assert.strictEqual(item.successCount(), 1);
  assert.strictEqual(item.retries(), 0);
  assert(entries(item).some(entry => entry.event === "adapter-reject" && entry.error === "no-speech"));
  assert(!entries(item).some(entry => entry.event === "legacy-interim-fallback-selected"));

  // 10. A network rejection after selection is cleanup, not Retry.
  item = createContext([plan(["hello", "hello"], [
    { type: "error", at: 205, error: "network" },
    { type: "end", at: 210 }
  ])]);
  result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(entries(item).filter(entry => entry.event === "legacy-judge-start").length, 1);
  assert.strictEqual(item.successCount(), 1);
  assert.strictEqual(item.retries(), 0);

  // 11. Invalidating the run during stop prevents success.
  item = createContext([plan(["hello", "hello"], [
    { type: "invalidate", at: 205 },
    { type: "end", at: 210 }
  ])]);
  const cancelledMission = item.context.SpeechEngine.mission({
    accepted: ["hello"],
    __legacyInterimFallback: "primary-normalized-exact",
    __legacyEarlyCommit: "stable-primary-normalized-exact-hello",
    __legacyInterimFallbackIsCurrent: item.isValid
  }, { addStartButton(start) { start(); }, showRetry() {} });
  await flush();
  assert.strictEqual(item.successCount(), 0);
  void cancelledMission;

  // 12. A stale run cannot select on its second exact update.
  item = createContext([{
    events: [
      { type: "result", at: 100, transcript: "hello", isFinal: false },
      { type: "invalidate", at: 120 },
      { type: "result", at: 150, transcript: "hello", isFinal: false },
      { type: "end", at: 200 }
    ]
  }]);
  void item.context.SpeechEngine.mission({
    accepted: ["hello"],
    __legacyEarlyCommit: "stable-primary-normalized-exact-hello",
    __legacyInterimFallbackIsCurrent: item.isValid
  }, { addStartButton(start) { start(); }, showRetry() {} });
  await flush();
  assert.strictEqual(selected(item).length, 0);

  // 13. Late updates from attempt 1 are rejected by the existing attempt serial.
  item = createContext([
    { events: [{ type: "error", at: 100, error: "network" }] },
    { events: [] }
  ]);
  void item.context.SpeechEngine.mission({
    accepted: ["hello"],
    __legacyEarlyCommit: "stable-primary-normalized-exact-hello"
  }, {
    addStartButton(start) { start(); },
    showRetry(error, start) { start(); }
  });
  await flush();
  item.deliver(item.instances[0], { type: "result", at: 200, transcript: "hello", isFinal: false });
  item.deliver(item.instances[0], { type: "result", at: 210, transcript: "hello", isFinal: false });
  assert.strictEqual(selected(item, 1).length, 0);

  // 14. Retry resets the consecutive count; selection occurs on attempt 2's second hello.
  item = createContext([
    { events: [
      { type: "result", at: 100, transcript: "hello", isFinal: false },
      { type: "error", at: 120, error: "network" }
    ] },
    plan(["hello", "hello"])
  ]);
  result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item, 1).length, 0);
  assert.strictEqual(selected(item, 2).length, 1);
  assert.strictEqual(selected(item, 2)[0].consecutiveExactCount, 2);

  // 15. Existing CASE A remains natural no-speech -> fallback -> success.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "hello", isFinal: false },
    { type: "end", at: 150 }
  ] }]);
  result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item).length, 0);
  assert(entries(item).some(entry => entry.event === "legacy-interim-fallback-selected"));

  // 16. A normal final remains on the adapter-resolve route.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "hello", isFinal: true },
    { type: "end", at: 150 }
  ] }]);
  result = await helloQuestion(item);
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item).length, 0);
  assert(entries(item).some(entry => entry.event === "adapter-resolve"));

  // 17. Monster Legacy questions do not receive the opt-in.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "hello", isFinal: false },
    { type: "result", at: 120, transcript: "hello", isFinal: false },
    { type: "result", at: 150, transcript: "two", isFinal: true },
    { type: "end", at: 180 }
  ] }]);
  result = await item.context.QuestionManager.start("word.single-digit-number", {
    __legacyTraceContext: { runtime: "monster", monsterId: "m002" }
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item).length, 0);
  assert.strictEqual(item.missionConfigs[0].__legacyEarlyCommit, undefined);

  // 18. Morning owns no Early Commit opt-in and retains 8000 ms.
  const morningSource = read("engine/managers/morning-manager.js");
  assert(!morningSource.includes("__legacyEarlyCommit"));
  assert(morningSource.includes("var timeoutMs = prompt.timeoutMs || 8000;"));

  // 19. Formal text input remains isolated from Legacy trace and Early Commit.
  item = createContext([]);
  result = await item.context.QuestionManager.start("phrase.are_you_ok", {
    inputMode: "text",
    transcript: "Are you OK?"
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item).length, 0);
  assert.strictEqual(item.missionConfigs.length, 0);

  // 20. Other Legacy questions do not receive the opt-in.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "hello", isFinal: false },
    { type: "result", at: 120, transcript: "hello", isFinal: false },
    { type: "result", at: 150, transcript: "japan", isFinal: true },
    { type: "end", at: 180 }
  ] }]);
  result = await item.context.QuestionManager.start("word.japan");
  assert.strictEqual(result.status, "success");
  assert.strictEqual(selected(item).length, 0);
  assert.strictEqual(item.missionConfigs[0].__legacyEarlyCommit, undefined);

  // Static isolation and unchanged shared settings.
  const adapterSource = read("engine/services/speech-recognition-adapter.js");
  assert(adapterSource.includes("recognition.interimResults = options.interimResults !== false;"));
  assert(adapterSource.includes("recognition.continuous = Boolean(options.continuous);"));
  assert(adapterSource.includes("recognition.maxAlternatives = options.maxAlternatives || 1;"));
  assert(read("engine/managers/question-manager.js").includes("}, 250);"));
  assert(read("data/mornings.js").includes("timeoutMs: 8000"));

  console.log("Legacy Speech Early Commit V1 tests: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
