"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const starts = [];
let browserBusy = false;
let instanceCount = 0;

class FakeRecognition {
  constructor() { this.id = ++instanceCount; }
  start() {
    starts.push({ id: this.id, busy: browserBusy, event: "start-call" });
    if (browserBusy) throw new Error("InvalidStateError: recognition is still ending");
    browserBusy = true;
    setTimeout(() => {
      starts.push({ id: this.id, event: "onstart" });
      this.onstart();
      if (this.id < 3) {
        this.onerror({ error: "no-speech", message: "" });
        setTimeout(() => {
          browserBusy = false;
          starts.push({ id: this.id, event: "onend" });
          this.onend();
        }, 25);
        return;
      }
      const alternative = { transcript: "eyes", confidence: 1 };
      const result = [alternative];
      result.isFinal = true;
      this.onresult({ resultIndex: 0, results: [result] });
      browserBusy = false;
      starts.push({ id: this.id, event: "onend" });
      this.onend();
    }, 0);
  }
  stop() {}
}

const context = {
  console,
  performance: { now: () => Date.now() },
  setTimeout,
  clearTimeout,
  webkitSpeechRecognition: FakeRecognition,
  SpeechEngine: { getStatus: () => "listening" },
  SpeechStartController: { isListening: () => false },
  MonsterDatabase: { normalizeId: id => String(id), get: id => ({ monsterId: id }) },
  MonsterBattlePresenter: { showLayers() {} },
  DialogManager: { show() {}, async next() {} },
  QuestionManager: { async start() { return { status: "failure", answer: null }; } },
  MonsterBattleData: {
    canonicalAnswer(monster, answer) {
      const value = String(answer || "").toLowerCase();
      return ["eyes", "eye", "nose", "mouth", "ears", "ear"].includes(value) ?
        ({ eye: "eyes", ear: "ears" }[value] || value) : null;
    },
    getMonster(id) { return { monsterId: id, battle: { supportMessages: [] } }; },
    getHint() { return ""; }
  }
};
context.window = context;
context.MonsterBattleManager = {
  getContext() { return { monsterId: "m004", acceptedAnswers: [] }; },
  async start() {
    const session = context.LegacySpeechTrace.begin({ questionId: "word.face-parts", runtime: "monster", monsterId: "m004" });
    const failures = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const traceContext = context.LegacySpeechTrace.startAttempt(session);
      try {
        const answer = await context.SpeechRecognitionAdapter.listen({ lang: "en-US", legacyTraceContext: traceContext });
        return { answer, failures };
      } catch (error) {
        failures.push(error.message);
      }
    }
    return { answer: null, failures };
  }
};
vm.createContext(context);
for (const file of ["engine/services/legacy-speech-trace.js", "engine/services/speech-recognition-adapter.js", "engine/services/m004-battle-extension.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

(async () => {
  const result = await context.MonsterBattleManager.start("m004");
  assert.equal(result.answer, "eyes");
  assert.deepEqual(result.failures, ["no-speech", "no-speech"]);
  assert.equal(starts.filter(item => item.event === "start-call").length, 3);
  assert.equal(starts.filter(item => item.event === "onstart").length, 3, "second Retry must reach onstart");
  assert(starts.filter(item => item.event === "start-call").every(item => item.busy === false));

  const trace = Array.from(context.LegacySpeechTrace.getEntries());
  assert.equal(trace.filter(item => item.event === "m004-retry-listen-call").length, 3);
  assert.equal(trace.filter(item => item.event === "m004-retry-wait-for-recognition-end").length, 2);
  assert.equal(trace.filter(item => item.event === "m004-retry-recognition-end-confirmed").length, 2);
  assert.equal(trace.filter(item => item.event === "m004-retry-recognition-end-timeout").length, 0);

  const monster = { monsterId: "m004" };
  for (const value of ["I", "i", "hi"]) assert.equal(context.MonsterBattleData.canonicalAnswer(monster, value), "eyes");
  for (const value of ["ear", "year", "years", "yeah"]) assert.equal(context.MonsterBattleData.canonicalAnswer(monster, value), "ears");
  for (const value of ["hair", "here", "hare", "air", "hear"]) assert.equal(context.MonsterBattleData.canonicalAnswer(monster, value), null);
  assert.equal(context.MonsterBattleData.canonicalAnswer(monster, "mouse"), "mouth");
  assert.equal(context.MonsterBattleData.canonicalAnswer({ monsterId: "m003" }, "year"), null);
  console.log("m004 second Retry waits for recognition end and reaches onstart: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
