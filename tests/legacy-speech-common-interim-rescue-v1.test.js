"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(read(file)).digest("hex");

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
  let valid = true;
  const missionConfigs = [];
  const instances = [];

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
      this.stopHandled = false;
      instances.push(this);
    }

    start() {
      if (!this.plan) throw new Error("missing-recognition-plan");
      if (this.onstart) this.onstart();
      if (this.plan.defer) return;
      for (const event of this.plan.events || []) deliver(this, event);
    }

    stop() {
      if (this.stopHandled) return;
      this.stopHandled = true;
      for (const event of this.plan.stopEvents || [{ type: "end", at: clock + 1 }]) {
        deliver(this, event);
      }
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
        onSuccess() {},
        onMismatch() {}
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
    isValid: () => valid,
    invalidate: () => { valid = false; },
    deliver
  };
}

function interimEnd(transcript, alternatives) {
  return { events: [
    { type: "result", at: 100, transcript, isFinal: false, alternatives },
    { type: "end", at: 150 }
  ] };
}

function errorPlan(error, transcript) {
  const events = [];
  if (transcript !== undefined) {
    events.push({ type: "result", at: 100, transcript, isFinal: false });
  }
  events.push({ type: "error", at: 150, error });
  events.push({ type: "end", at: 160 });
  return { events };
}

function trace(item, attempt) {
  return Array.from(item.context.LegacySpeechTrace.getEntries()).filter(entry =>
    attempt === undefined || entry.attempt === attempt
  );
}

function names(item, attempt) {
  return trace(item, attempt).map(entry => entry.event);
}

function rescueEntries(item, attempt) {
  return trace(item, attempt).filter(entry => entry.event === "legacy-common-interim-rescue-selected");
}

function startQuestion(item, questionId, runtime) {
  const traceContext = runtime === "monster" ?
    { runtime: "monster", monsterId: "m002" } :
    { runtime: "story", storyId: "S001" };
  return item.context.QuestionManager.start(questionId, { __legacyTraceContext: traceContext });
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

(async () => {
  // A, N, Q. Number Monster rescues primary "one" and Judge succeeds once.
  let item = createContext([interimEnd("one")]);
  let result = await startQuestion(item, "word.single-digit-number", "monster");
  assert.strictEqual(result.status, "success");
  assert.strictEqual(result.answer, "one");
  assert.strictEqual(rescueEntries(item).length, 1);
  assert.strictEqual(rescueEntries(item)[0].candidate, "one");
  assert.strictEqual(rescueEntries(item)[0].questionId, "word.single-digit-number");
  assert.strictEqual(rescueEntries(item)[0].runtime, "monster");
  assert.strictEqual(typeof rescueEntries(item)[0].runId, "number");
  assert.strictEqual(rescueEntries(item)[0].attempt, 1);
  assert.strictEqual(names(item).filter(name => name === "legacy-judge-start").length, 1);
  assert.strictEqual(names(item).filter(name => name === "legacy-success").length, 1);
  assert.strictEqual(names(item).filter(name => name === "legacy-retry-show").length, 0);
  assert.deepStrictEqual(names(item), [
    "legacy-speech-start", "recognition-start-call", "recognition-onstart",
    "recognition-result", "legacy-interim", "recognition-end", "adapter-reject",
    "legacy-interim-fallback-check", "legacy-common-interim-rescue-selected",
    "legacy-judge-start", "legacy-judge-result", "legacy-success", "legacy-flow-end"
  ]);

  // B. "won" is rescued as a candidate; only the existing Judge marks failure.
  item = createContext([interimEnd("won")]);
  result = await startQuestion(item, "word.single-digit-number", "monster");
  assert.strictEqual(result.status, "failure");
  assert.strictEqual(result.answer, "won");
  assert.strictEqual(rescueEntries(item).length, 1);
  assert.strictEqual(names(item).filter(name => name === "legacy-judge-start").length, 1);
  assert.strictEqual(names(item).filter(name => name === "legacy-judge-result").length, 1);
  assert.strictEqual(names(item).filter(name => name === "legacy-success").length, 0);
  assert.strictEqual(names(item).filter(name => name === "legacy-retry-show").length, 0);

  // C. Exact Hello keeps its existing question-specific Fallback and never doubles.
  item = createContext([interimEnd("hello")]);
  result = await startQuestion(item, "word.hello", "story");
  assert.strictEqual(result.status, "success");
  assert(names(item).includes("legacy-interim-fallback-selected"));
  assert.strictEqual(rescueEntries(item).length, 0);
  assert.strictEqual(names(item).filter(name => name === "legacy-judge-start").length, 1);
  assert.strictEqual(names(item).filter(name => name === "legacy-success").length, 1);

  // D. Non-exact Hello candidate bypasses exact Fallback, then existing Judge fails.
  item = createContext([interimEnd("yellow")]);
  result = await startQuestion(item, "word.hello", "story");
  assert.strictEqual(result.status, "failure");
  assert.strictEqual(result.answer, "yellow");
  assert(!names(item).includes("legacy-interim-fallback-selected"));
  assert.strictEqual(rescueEntries(item).length, 1);

  // E. Empty interim remains on the existing Retry path.
  item = createContext([{ events: [{ type: "end", at: 150 }] }]);
  void startQuestion(item, "word.japan", "story");
  await flush();
  assert.strictEqual(rescueEntries(item).length, 0);
  assert.strictEqual(item.retries(), 1);

  // F. Normal final remains adapter-resolve and does not Rescue.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "japan", isFinal: true },
    { type: "end", at: 150 }
  ] }]);
  result = await startQuestion(item, "word.japan", "story");
  assert.strictEqual(result.status, "success");
  assert(names(item).includes("adapter-resolve"));
  assert.strictEqual(rescueEntries(item).length, 0);

  // G-I. Only no-speech is eligible.
  for (const errorCode of ["network", "not-allowed", "speech-timeout"]) {
    item = createContext([errorPlan(errorCode, "japan")]);
    void startQuestion(item, "word.japan", "story");
    await flush();
    assert.strictEqual(rescueEntries(item).length, 0, errorCode);
    assert.strictEqual(item.retries(), 1, errorCode);
  }

  // J. Alternatives are never substituted for the primary interim.
  item = createContext([interimEnd("won", ["one"])]);
  result = await startQuestion(item, "word.single-digit-number", "monster");
  assert.strictEqual(result.status, "failure");
  assert.strictEqual(result.answer, "won");
  assert.strictEqual(rescueEntries(item)[0].candidate, "won");

  // K. Cancelling the real QuestionManager run before onend prevents Rescue/Judge.
  item = createContext([{ defer: true }]);
  const cancelled = startQuestion(item, "word.single-digit-number", "monster");
  await flush();
  item.deliver(item.instances[0], { type: "result", at: 100, transcript: "one", isFinal: false });
  item.context.QuestionManager.cancel();
  await flush();
  assert.strictEqual(rescueEntries(item).length, 0);
  assert(!names(item).includes("legacy-judge-start"));
  void cancelled;

  // L. A stale run callback prevents Rescue.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "one", isFinal: false },
    { type: "invalidate", at: 120 },
    { type: "end", at: 150 }
  ] }]);
  void item.context.SpeechEngine.mission({
    accepted: ["one"],
    retryOnMismatch: false,
    __legacyCommonInterimRescue: true,
    __legacyInterimFallbackIsCurrent: item.isValid
  }, { addStartButton(start) { start(); }, showRetry() {} });
  await flush();
  assert.strictEqual(rescueEntries(item).length, 0);

  // M. Retry state is attempt-local; attempt 1's "one" cannot replace attempt 2's "won".
  item = createContext([
    errorPlan("network", "one"),
    interimEnd("won")
  ]);
  result = await startQuestion(item, "word.single-digit-number", "monster");
  assert.strictEqual(result.status, "failure");
  assert.strictEqual(result.answer, "won");
  assert.strictEqual(rescueEntries(item, 1).length, 0);
  assert.strictEqual(rescueEntries(item, 2).length, 1);
  assert.strictEqual(rescueEntries(item, 2)[0].candidate, "won");

  // O. Hello Early Commit remains first and Common Rescue never duplicates it.
  item = createContext([{
    events: [
      { type: "result", at: 100, transcript: "hello", isFinal: false },
      { type: "result", at: 120, transcript: "hello", isFinal: false }
    ],
    stopEvents: [{ type: "end", at: 130 }]
  }]);
  result = await startQuestion(item, "word.hello", "story");
  assert.strictEqual(result.status, "success");
  assert.strictEqual(names(item).filter(name => name === "legacy-early-commit-selected").length, 1);
  assert.strictEqual(rescueEntries(item).length, 0);
  assert.strictEqual(names(item).filter(name => name === "legacy-success").length, 1);

  // P, R. Legacy Story words/phrases all use the same existing Judge after Rescue.
  for (const sample of [
    ["word.japan", "japan"],
    ["word.yes", "yes"],
    ["word.fruit", "apple"],
    ["phrase.its_ok", "it's ok"]
  ]) {
    item = createContext([interimEnd(sample[1])]);
    result = await startQuestion(item, sample[0], "story");
    assert.strictEqual(result.status, "success", sample[0]);
    assert.strictEqual(rescueEntries(item).length, 1, sample[0]);
    assert.strictEqual(item.missionConfigs[0].__legacyCommonInterimRescue, true, sample[0]);
    assert.strictEqual(typeof item.missionConfigs[0].__legacyInterimFallbackIsCurrent, "function", sample[0]);
  }

  // S. Morning uses listen(), owns no opt-in, and retains 8000 ms.
  const morningSource = read("engine/managers/morning-manager.js");
  assert(!morningSource.includes("__legacyCommonInterimRescue"));
  assert(morningSource.includes("var timeoutMs = prompt.timeoutMs || 8000;"));
  item = createContext([interimEnd("one")]);
  await assert.rejects(item.context.SpeechEngine.listen({ lang: "en-US" }), /no-speech/);
  assert.strictEqual(rescueEntries(item).length, 0);

  // T. Formal Communicative stays outside GameCore.speechMission/Common Rescue.
  item = createContext([]);
  result = await item.context.QuestionManager.start("phrase.are_you_ok", {
    inputMode: "text",
    transcript: "Are you OK?"
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(item.missionConfigs.length, 0);
  assert.strictEqual(rescueEntries(item).length, 0);

  // U. Generic Story speech/confirmSpeechName do not receive the internal opt-in.
  const storySource = read("engine/core/story-engine.js");
  assert(!storySource.includes("__legacyCommonInterimRescue"));
  item = createContext([interimEnd("japan")]);
  void item.context.SpeechEngine.mission({ accepted: ["japan"] }, {
    addStartButton(start) { start(); },
    showRetry() {}
  });
  await flush();
  assert.strictEqual(rescueEntries(item).length, 0);

  // V. RecognitionAdapter content is unchanged from Early Commit V1.
  assert.strictEqual(
    hash("engine/services/speech-recognition-adapter.js"),
    "9150d5bfd19f57d90ece2da3df3a074172f6c57fb17a4ec8fd13ae7268ee6c1c"
  );

  // W. Recognition settings and timeout values remain unchanged.
  const adapterSource = read("engine/services/speech-recognition-adapter.js");
  assert(adapterSource.includes('recognition.lang = options.lang || "ja-JP";'));
  assert(adapterSource.includes("recognition.interimResults = options.interimResults !== false;"));
  assert(adapterSource.includes("recognition.continuous = Boolean(options.continuous);"));
  assert(adapterSource.includes("recognition.maxAlternatives = options.maxAlternatives || 1;"));
  assert(read("engine/services/speech-engine.js").includes("timeoutMs: config.timeoutMs || 0,"));
  assert(read("engine/managers/question-manager.js").includes("timeoutMs: 8000,"));
  assert(read("engine/managers/question-manager.js").includes("}, 250);"));
  assert(read("data/mornings.js").includes("timeoutMs: 8000"));

  console.log("Legacy Speech Common Interim Rescue V1 tests: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
