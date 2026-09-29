"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function resultEvent(transcript, isFinal, alternatives) {
  const values = [transcript].concat(alternatives || []).map(value => ({
    transcript: value,
    confidence: 0.9
  }));
  values.isFinal = isFinal;
  return { resultIndex: 0, results: [values] };
}

function createContext(plans) {
  let planIndex = 0;
  let retries = 0;
  let clock = 0;

  class FakeRecognition {
    start() {
      const plan = plans[planIndex++];
      if (!plan) throw new Error("missing-recognition-plan");
      if (this.onstart) this.onstart();
      for (const event of plan.events || []) {
        clock = event.at === undefined ? clock : event.at;
        if (event.type === "result" && this.onresult) {
          this.onresult(resultEvent(event.transcript, event.isFinal, event.alternatives));
        } else if (event.type === "error" && this.onerror) {
          this.onerror({ error: event.error, message: event.message || "" });
        } else if (event.type === "end" && this.onend) {
          this.onend();
        }
      }
    }

    stop() {
      if (this.onend) this.onend();
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
    retries: () => retries
  };
}

function interimPlan(transcript) {
  return { events: [
    { type: "result", at: 100, transcript, isFinal: false },
    { type: "end", at: 120 }
  ] };
}

function finalPlan(transcript) {
  return { events: [
    { type: "result", at: 200, transcript, isFinal: true },
    { type: "end", at: 220 }
  ] };
}

function entries(context, attempt) {
  return Array.from(context.LegacySpeechTrace.getEntries()).filter(entry =>
    attempt === undefined || entry.attempt === attempt
  );
}

function names(context, attempt) {
  return entries(context, attempt).map(entry => entry.event);
}

function assertOrder(actual, expected) {
  for (let index = 1; index < expected.length; index += 1) {
    assert(
      actual.indexOf(expected[index - 1]) < actual.indexOf(expected[index]),
      expected[index - 1] + " must precede " + expected[index]
    );
  }
}

(async () => {
  // 1-3. Exact interim Hello records every runtime condition before selection.
  let item = createContext([interimPlan("Hello")]);
  let result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  const check = entries(item.context).find(entry =>
    entry.event === "legacy-interim-fallback-check"
  );
  assert(check);
  assert.strictEqual(check.questionId, "word.hello");
  assert.strictEqual(check.attempt, 1);
  assert.strictEqual(check.errorCode, "no-speech");
  assert.strictEqual(check.latestPrimaryInterim, "Hello");
  assert.strictEqual(check.normalizedCandidate, "hello");
  assert.strictEqual(check.fallbackPolicy, "primary-normalized-exact");
  assert.strictEqual(check.currentAttempt, 1);
  assert.strictEqual(check.attemptSerial, 1);
  assert.strictEqual(check.errorIsNoSpeech, true);
  assert.strictEqual(check.policyEnabled, true);
  assert.strictEqual(check.candidatePresent, true);
  assert.strictEqual(check.attemptIsCurrent, true);
  assert.strictEqual(check.runIsCurrent, true);
  assert.deepStrictEqual(
    Array.from(check.accepted),
    ["hello", "hello!", "ハロー", "はろー", "はろう"]
  );
  assert.deepStrictEqual(
    Array.from(check.normalizedAccepted),
    ["hello", "hello", "ハロー", "はろー", "はろう"]
  );
  assert.strictEqual(check.exactMatch, true);
  assert.strictEqual(check.fallbackEligible, true);
  assertOrder(names(item.context), [
    "recognition-end",
    "adapter-reject",
    "legacy-interim-fallback-check",
    "legacy-interim-fallback-selected",
    "legacy-judge-start",
    "legacy-judge-result",
    "legacy-success"
  ]);

  // 4. No Recognition result records candidatePresent=false and then Retry.
  item = createContext([
    { events: [{ type: "end", at: 3935 }] },
    finalPlan("Hello")
  ]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(item.retries(), 1);
  const emptyCheck = entries(item.context, 1).find(entry =>
    entry.event === "legacy-interim-fallback-check"
  );
  assert(emptyCheck);
  assert.strictEqual(emptyCheck.latestPrimaryInterim, "");
  assert.strictEqual(emptyCheck.normalizedCandidate, "");
  assert.strictEqual(emptyCheck.candidatePresent, false);
  assert.strictEqual(emptyCheck.exactMatch, false);
  assert.strictEqual(emptyCheck.fallbackEligible, false);
  assertOrder(names(item.context, 1), [
    "recognition-end",
    "adapter-reject",
    "legacy-interim-fallback-check",
    "legacy-retry-show"
  ]);

  // 5. A normal final success never enters catch and records no check event.
  item = createContext([finalPlan("Hello")]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  assert(!names(item.context).includes("legacy-interim-fallback-check"));

  // 6. Monster remains opted out of Hello Fallback but is handled by Common Rescue.
  item = createContext([interimPlan("two"), finalPlan("two")]);
  result = await item.context.QuestionManager.start("word.single-digit-number", {
    __legacyTraceContext: { runtime: "monster", monsterId: "m002" }
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(item.retries(), 0);
  const monsterCheck = entries(item.context, 1).find(entry =>
    entry.event === "legacy-interim-fallback-check"
  );
  assert(monsterCheck);
  assert.strictEqual(monsterCheck.latestPrimaryInterim, "two");
  assert.strictEqual(monsterCheck.policyEnabled, false);
  assert.strictEqual(monsterCheck.exactMatch, true);
  assert.strictEqual(monsterCheck.fallbackEligible, false);
  assertOrder(names(item.context, 1), [
    "adapter-reject",
    "legacy-interim-fallback-check",
    "legacy-common-interim-rescue-selected",
    "legacy-judge-start",
    "legacy-judge-result",
    "legacy-success"
  ]);

  // A non-no-speech error is observable but remains ineligible.
  item = createContext([
    { events: [
      { type: "result", at: 60, transcript: "Hello", isFinal: false },
      { type: "error", at: 80, error: "network" },
      { type: "end", at: 90 }
    ] },
    finalPlan("Hello")
  ]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  const networkCheck = entries(item.context, 1).find(entry =>
    entry.event === "legacy-interim-fallback-check"
  );
  assert(networkCheck);
  assert.strictEqual(networkCheck.errorCode, "network");
  assert.strictEqual(networkCheck.errorIsNoSpeech, false);
  assert.strictEqual(networkCheck.exactMatch, true);
  assert.strictEqual(networkCheck.fallbackEligible, false);

  // Instrumentation remains synchronous and contains no timing/control primitives.
  const source = read("engine/services/speech-engine.js");
  const checkStart = source.indexOf('LegacySpeechTrace.record(attemptTraceContext, "legacy-interim-fallback-check"');
  const fallbackStart = source.indexOf('if (errorCode === "no-speech"', checkStart);
  assert(checkStart !== -1 && checkStart < fallbackStart);
  const checkBlock = source.slice(checkStart, fallbackStart);
  for (const forbidden of ["await ", "setTimeout", "Promise", "queueMicrotask", ".stop(", ".abort("]) {
    assert(!checkBlock.includes(forbidden), forbidden);
  }

  console.log("Legacy Interim Fallback Condition Trace V1 tests: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
