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
  let valid = true;
  const missionConfigs = [];

  class FakeRecognition {
    start() {
      const plan = plans[planIndex++];
      if (!plan) throw new Error("missing-recognition-plan");
      if (plan.throwOnStart) throw new Error(plan.throwOnStart);
      if (this.onstart) this.onstart();
      for (const event of plan.events || []) {
        clock = event.at === undefined ? clock : event.at;
        if (event.type === "result" && this.onresult) {
          this.onresult(resultEvent(event.transcript, event.isFinal, event.alternatives));
        } else if (event.type === "error" && this.onerror) {
          this.onerror({ error: event.error, message: event.message || "" });
        } else if (event.type === "invalidate") {
          valid = false;
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
      missionConfigs.push(config);
      return context.SpeechEngine.mission(config, {
        showMission() {},
        clearControls() {},
        showRecognized() {},
        addStartButton(startListening) { startListening(); },
        showRetry() {
          retries += 1;
          if (planIndex < plans.length) arguments[1]();
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
    retries: () => retries,
    missionConfigs,
    isValid: () => valid
  };
}

function trace(context, attempt) {
  return Array.from(context.LegacySpeechTrace.getEntries()).filter(entry =>
    attempt === undefined || entry.attempt === attempt
  );
}

function eventNames(context, attempt) {
  return trace(context, attempt).map(entry => entry.event);
}

function firstEvent(context, event, attempt) {
  return trace(context, attempt).find(entry => entry.event === event);
}

function finalPlan(transcript, alternatives) {
  return { events: [
    { type: "result", at: 200, transcript, isFinal: true, alternatives },
    { type: "end", at: 220 }
  ] };
}

function interimPlan(transcript, alternatives) {
  return { events: [
    { type: "result", at: 100, transcript, isFinal: false, alternatives },
    { type: "end", at: 120 }
  ] };
}

async function interimThenRetry(transcript, alternatives) {
  const item = createContext([interimPlan(transcript, alternatives), finalPlan("Hello")]);
  const result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  return { item, result };
}

(async () => {
  // 1. Existing final route remains unchanged and never uses fallback.
  let item = createContext([finalPlan("Hello")]);
  let result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  assert(!eventNames(item.context).includes("legacy-interim-fallback-selected"));

  // 2-3. Exact normalized interim primary is recovered only for word.hello.
  for (const candidate of ["Hello", "Hello!"]) {
    item = createContext([interimPlan(candidate)]);
    result = await item.context.QuestionManager.start("word.hello", {
      __legacyTraceContext: { runtime: "story", storyId: "S001" }
    });
    assert.strictEqual(result.status, "success", candidate);
    assert.strictEqual(item.retries(), 0, candidate);
    const selected = firstEvent(item.context, "legacy-interim-fallback-selected");
    assert(selected, candidate);
    assert.strictEqual(selected.candidate, candidate);
    assert.strictEqual(selected.normalizedCandidate, "hello");
    assert(["hello", "hello!"].includes(selected.matchedAccepted));
  }

  // 4-11. Non-exact candidates bypass Hello Fallback, then Common Rescue uses the existing Judge.
  for (const candidate of ["yellow", "hello there", "well hello", "hell", "Hotel", "shellow", "helloing"]) {
    const run = await interimThenRetry(candidate);
    const expectedStatus = run.item.context.SpeechEngine.judge(candidate, ["hello", "hello!", "ハロー", "はろー", "はろう"]) ?
      "success" : "failure";
    assert.strictEqual(run.result.status, expectedStatus, candidate);
    assert.strictEqual(run.item.retries(), 0, candidate);
    assert(!eventNames(run.item.context, 1).includes("legacy-interim-fallback-selected"), candidate);
    assert(eventNames(run.item.context, 1).includes("legacy-common-interim-rescue-selected"), candidate);
    assert(!eventNames(run.item.context, 1).includes("legacy-retry-show"), candidate);
    assert(eventNames(run.item.context, 1).includes("legacy-judge-start"), candidate);
  }
  // 12. Empty interim still has no Rescue candidate and keeps Retry.
  let emptyRun = await interimThenRetry("");
  assert.strictEqual(emptyRun.result.status, "success");
  assert.strictEqual(emptyRun.item.retries(), 1);
  assert(!eventNames(emptyRun.item.context, 1).includes("legacy-common-interim-rescue-selected"));
  assert(eventNames(emptyRun.item.context, 1).includes("legacy-retry-show"));
  const falseHotel = await interimThenRetry("Hotel");
  assert.strictEqual(falseHotel.result.status, "failure");
  assert.strictEqual(falseHotel.item.retries(), 0);

  // 13. Final Hello followed by network error remains a Retry.
  item = createContext([
    { events: [
      { type: "result", at: 60, transcript: "Hello", isFinal: true },
      { type: "error", at: 90, error: "network" },
      { type: "end", at: 100 }
    ] },
    finalPlan("Hello")
  ]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(item.retries(), 1);
  assert(!eventNames(item.context, 1).includes("legacy-interim-fallback-selected"));

  // 14. A final alternative Hello keeps the existing success route.
  item = createContext([finalPlan("yellow", ["Hello"])]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(result.answer, "Hello");
  assert(!eventNames(item.context).includes("legacy-interim-fallback-selected"));

  // 15. An interim-only alternative Hello is ignored; Common Rescue passes primary yellow to Judge.
  let run = await interimThenRetry("yellow", ["Hello"]);
  assert.strictEqual(run.result.status, "failure");
  assert.strictEqual(run.item.retries(), 0);
  assert(!eventNames(run.item.context, 1).includes("legacy-interim-fallback-selected"));
  assert(eventNames(run.item.context, 1).includes("legacy-common-interim-rescue-selected"));

  // 16-17, 28. Only word.hello has a valid, copied policy; unknown policy is rejected.
  const allQuestions = Array.from(item.context.QuestionDatabase.all());
  const hello = item.context.QuestionDatabase.get("word.hello");
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(hello.speechPolicy)),
    { interimFallback: "primary-normalized-exact" }
  );
  const otherQuestions = allQuestions.filter(question => question.id !== "word.hello");
  assert.strictEqual(otherQuestions.length, 20);
  assert(otherQuestions.every(question => question.speechPolicy === undefined));
  assert.throws(() => item.context.QuestionDatabase.register({
    id: "word.invalid-policy",
    category: "word",
    prompt: "Invalid",
    answers: ["invalid"],
    speechPolicy: { interimFallback: "unknown" }
  }), /not supported/);

  // QuestionManager passes the internal policy only for the opted-in question.
  item = createContext([finalPlan("Hello")]);
  await item.context.QuestionManager.start("word.hello");
  assert.strictEqual(item.missionConfigs[0].__legacyInterimFallback, "primary-normalized-exact");
  item = createContext([finalPlan("Japan")]);
  await item.context.QuestionManager.start("word.japan");
  assert.strictEqual(item.missionConfigs[0].__legacyInterimFallback, undefined);

  // 18-19. Number Monster final and Common Interim Rescue both use the existing Judge.
  item = createContext([finalPlan("two")]);
  result = await item.context.QuestionManager.start("word.single-digit-number", {
    __legacyTraceContext: { runtime: "monster", monsterId: "m002" }
  });
  assert.strictEqual(result.status, "success");
  assert(!eventNames(item.context).includes("legacy-interim-fallback-selected"));

  item = createContext([interimPlan("two"), finalPlan("two")]);
  result = await item.context.QuestionManager.start("word.single-digit-number", {
    __legacyTraceContext: { runtime: "monster", monsterId: "m002" }
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(item.retries(), 0);
  assert(!eventNames(item.context).includes("legacy-interim-fallback-selected"));
  assert(eventNames(item.context).includes("legacy-common-interim-rescue-selected"));

  // 23. Cancelling invalidates the QuestionManager run before stop/onend rejects.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "Hello", isFinal: false }
  ] }]);
  const cancelledRun = item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  item.context.QuestionManager.cancel();
  await Promise.resolve();
  await Promise.resolve();
  assert(!eventNames(item.context).includes("legacy-interim-fallback-selected"));
  assert(!eventNames(item.context).includes("legacy-judge-start"));
  void cancelledRun;

  // 24. A stale attempt cannot select its exact interim candidate.
  item = createContext([{ events: [
    { type: "result", at: 100, transcript: "Hello", isFinal: false },
    { type: "invalidate", at: 110 },
    { type: "end", at: 120 }
  ] }]);
  const staleRun = item.context.SpeechEngine.mission({
    accepted: ["hello"],
    __legacyInterimFallback: "primary-normalized-exact",
    __legacyInterimFallbackIsCurrent: item.isValid
  }, {
    showRecognized() {},
    addStartButton(startListening) { startListening(); },
    showRetry() {}
  });
  await Promise.resolve();
  await Promise.resolve();
  assert(!eventNames(item.context).includes("legacy-interim-fallback-selected"));
  void staleRun;

  // 25. Retry starts with an empty latestPrimaryInterim; prior Hello cannot replace rescued Hotel.
  item = createContext([
    { events: [
      { type: "result", at: 60, transcript: "Hello", isFinal: false },
      { type: "error", at: 80, error: "network" },
      { type: "end", at: 90 }
    ] },
    interimPlan("Hotel"),
    finalPlan("Hello")
  ]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "failure");
  assert.strictEqual(result.answer, "Hotel");
  assert.strictEqual(item.retries(), 1);
  assert(!eventNames(item.context, 2).includes("legacy-interim-fallback-selected"));
  assert(eventNames(item.context, 2).includes("legacy-common-interim-rescue-selected"));

  // 7. Every non-no-speech error remains Retry, even with an exact candidate.
  for (const errorCode of [
    "network", "aborted", "audio-capture", "not-allowed",
    "service-not-allowed", "speech-timeout", "speech-not-supported"
  ]) {
    item = createContext([
      { events: [
        { type: "result", at: 60, transcript: "Hello", isFinal: false },
        { type: "error", at: 80, error: errorCode },
        { type: "end", at: 90 }
      ] },
      finalPlan("Hello")
    ]);
    result = await item.context.QuestionManager.start("word.hello", {
      __legacyTraceContext: { runtime: "story", storyId: "S001" }
    });
    assert.strictEqual(result.status, "success", errorCode);
    assert.strictEqual(item.retries(), 1, errorCode);
    assert(!eventNames(item.context, 1).includes("legacy-interim-fallback-selected"), errorCode);
  }

  item = createContext([{ throwOnStart: "start-failed" }, finalPlan("Hello")]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(item.retries(), 1);
  assert(!eventNames(item.context, 1).includes("legacy-interim-fallback-selected"));

  // 26. Successful fallback preserves adapter rejection and rejoins the existing Judge.
  item = createContext([interimPlan("Hello")]);
  result = await item.context.QuestionManager.start("word.hello", {
    __legacyTraceContext: { runtime: "story", storyId: "S001" }
  });
  const successNames = eventNames(item.context);
  const expectedOrder = [
    "recognition-end",
    "adapter-reject",
    "legacy-interim-fallback-selected",
    "legacy-judge-start",
    "legacy-judge-result",
    "legacy-success"
  ];
  for (let index = 1; index < expectedOrder.length; index += 1) {
    assert(successNames.indexOf(expectedOrder[index - 1]) < successNames.indexOf(expectedOrder[index]));
  }
  assert(!successNames.includes("adapter-resolve"));

  // 27. Failed exact fallback now proceeds to Common Rescue and the existing Judge.
  run = await interimThenRetry("Hotel");
  const failedNames = eventNames(run.item.context, 1);
  assert(failedNames.indexOf("adapter-reject") < failedNames.indexOf("legacy-common-interim-rescue-selected"));
  assert(failedNames.indexOf("legacy-common-interim-rescue-selected") < failedNames.indexOf("legacy-judge-start"));
  assert(!failedNames.includes("legacy-interim-fallback-selected"));
  assert(!failedNames.includes("legacy-retry-show"));

  // Static isolation: forbidden shared/runtime files and timing behavior are untouched by this feature.
  const speechSource = read("engine/services/speech-engine.js");
  assert(!speechSource.includes("includesAny(latestPrimaryInterim"));
  assert(!speechSource.includes("setTimeout(function () {\n                resolve(latestPrimaryInterim)"));
  assert(read("engine/services/speech-recognition-adapter.js").includes('else finish("reject", new Error("no-speech"))'));
  assert(read("engine/managers/morning-manager.js").includes("var timeoutMs = prompt.timeoutMs || 8000;"));
  assert(read("engine/managers/question-manager.js").includes("}, 250);"));

  console.log("Legacy Speech Interim Fallback V1 tests: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
