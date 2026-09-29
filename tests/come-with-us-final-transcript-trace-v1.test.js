"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function resultEvent(transcript, isFinal) {
  const values = [{ transcript, confidence: 0.9 }];
  values.isFinal = isFinal;
  return { resultIndex: 0, results: [values] };
}

function harness(plans) {
  let planIndex = 0;
  let retries = 0;
  const shown = [];
  class Recognition {
    start() {
      const plan = plans[planIndex++];
      assert(plan, "recognition plan");
      this.onstart();
      for (const event of plan) {
        if (event.type === "result") this.onresult(resultEvent(event.transcript, event.isFinal));
        if (event.type === "error") this.onerror({ error: event.error });
        if (event.type === "end") this.onend();
      }
    }
    stop() {}
  }
  const context = {
    window: {}, console, SpeechRecognition: Recognition,
    GameConfig: { defaultLanguage: "en-US" },
    AudioManager: { stopAll() {} },
    setTimeout() { return 1; }, clearTimeout() {}
  };
  context.window = context;
  vm.createContext(context);
  for (const file of [
    "data/word-dictionaries.js", "data/questions.js", "engine/services/speech-normalizer.js",
    "engine/services/legacy-speech-trace.js", "engine/services/speech-recognition-adapter.js",
    "engine/services/speech-engine.js", "engine/services/speech-start-controller.js"
  ]) vm.runInContext(read(file), context, { filename: file });
  context.GameCore = {
    speechMission(config) {
      return context.SpeechEngine.mission(config, {
        showMission() {}, clearControls() {}, showRecognized(value) { shown.push(value); },
        addStartButton(start) { start(); },
        showRetry(_error, start) { retries += 1; start(); },
        onSuccess() {}, onMismatch() {}
      });
    }
  };
  vm.runInContext(read("engine/managers/question-manager.js"), context);
  return { context, shown, retries: () => retries };
}

function trace(run) { return Array.from(run.context.LegacySpeechTrace.getEntries()); }
function event(rows, name) { return rows.find(row => row.event === name); }
function ordered(rows, names) {
  const indices = names.map(name => rows.findIndex(row => row.event === name));
  assert(indices.every(index => index >= 0), names.join(" -> "));
  assert(indices.every((index, i) => i === 0 || index > indices[i - 1]), names.join(" -> "));
}

(async () => {
  const success = harness([[{ type: "result", transcript: "come with us", isFinal: false },
    { type: "result", transcript: "come with us", isFinal: true }, { type: "end" }]]);
  let result = await success.context.QuestionManager.start("phrase.come_with_us", { __legacyTraceContext: { storyId: "S004" } });
  assert.strictEqual(result.status, "success");
  assert.strictEqual(result.answer, "come with us");
  let rows = trace(success);
  ordered(rows, ["recognition-interim", "recognition-final", "adapter-resolve", "legacy-judge-input", "legacy-judge-result", "question-result"]);
  assert.strictEqual(event(rows, "recognition-interim").transcript, "come with us");
  assert.strictEqual(event(rows, "recognition-final").transcript, "come with us");
  assert.strictEqual(event(rows, "legacy-judge-input").normalizedTranscript, "come with us");
  assert.strictEqual(event(rows, "legacy-judge-result").matched, true);
  assert.strictEqual(event(rows, "legacy-judge-result").matchedAnswer, "come with us");
  assert(!event(rows, "retry-trigger"));

  const mismatch = harness([[{ type: "result", transcript: "go away", isFinal: true }, { type: "end" }]]);
  result = await mismatch.context.QuestionManager.start("phrase.come_with_us");
  assert.strictEqual(result.status, "failure");
  rows = trace(mismatch);
  ordered(rows, ["recognition-final", "adapter-resolve", "legacy-judge-input", "legacy-judge-result", "question-result"]);
  assert.strictEqual(event(rows, "legacy-judge-result").matched, false);
  assert.strictEqual(event(rows, "question-result").status, "failure");

  const error = harness([
    [{ type: "result", transcript: "come with us", isFinal: false }, { type: "error", error: "speech-timeout" }],
    [{ type: "result", transcript: "come with us", isFinal: true }, { type: "end" }]
  ]);
  result = await error.context.QuestionManager.start("phrase.come_with_us");
  assert.strictEqual(result.status, "success");
  assert.strictEqual(error.retries(), 1);
  rows = trace(error);
  ordered(rows, ["recognition-interim", "adapter-reject", "retry-trigger", "recognition-final", "adapter-resolve", "legacy-judge-input", "question-result"]);
  assert.strictEqual(event(rows, "adapter-reject").latestInterim, "come with us");
  assert.strictEqual(event(rows, "adapter-reject").latestFinal, "");
  assert.strictEqual(event(rows, "retry-trigger").error, "speech-timeout");

  const other = harness([[{ type: "result", transcript: "hello", isFinal: true }, { type: "end" }]]);
  result = await other.context.QuestionManager.start("word.hello");
  assert.strictEqual(result.status, "success");
  assert(!trace(other).some(row => ["recognition-interim", "recognition-final", "legacy-judge-input", "question-result", "retry-trigger"].includes(row.event)));
  console.log("Come with us final transcript trace V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
