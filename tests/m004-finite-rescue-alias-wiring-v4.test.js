"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const support = [];
const rescueChoices = [];
const questionResults = [
  { status: "failure", answer: "I" },
  { status: "failure", answer: "here" },
  { status: "failure", answer: "mouse" }
];
let nextRescueAction = "retry";
let runtimeFailureCount = 0;

const finiteRescue = Object.freeze({
  isImmediateTechnicalFailure() { return true; },
  async choose(allowRetry) {
    rescueChoices.push(allowRetry);
    const action = nextRescueAction;
    nextRescueAction = "adventure_return";
    return action;
  },
  clear() {}, consume() { return null; }, result() { return { controlResult: "adventure_return" }; }
});

const context = {
  console, setTimeout, clearTimeout, performance: { now: () => Date.now() },
  LegacySpeechTrace: {
    entries: [],
    record(ctx, event, detail) { this.entries.push(Object.assign({ event }, detail || {})); },
    getEntries() { return this.entries.slice(); }
  },
  SpeechEngine: { getStatus: () => "idle" },
  SpeechStartController: { isListening: () => false },
  SpeechRecognitionAdapter: { async listen() { return "eyes"; } },
  DialogManager: { show() {}, async next() {} },
  MonsterBattlePresenter: { showLayers() {} },
  MonsterDatabase: { normalizeId: id => String(id), get: id => ({ monsterId: id }) },
  MonsterBattleData: {
    canonicalAnswer(monster, answer) {
      const value = String(answer || "").toLowerCase();
      const map = { eyes: "eyes", eye: "eyes", nose: "nose", mouth: "mouth", ears: "ears", ear: "ears" };
      return map[value] || null;
    },
    getMonster(id) { return { monsterId: id, battle: { supportMessages: [] } }; },
    getHint() { return ""; }
  },
  QuestionManager: {
    async start() { return questionResults.shift() || { status: "failure", answer: "unknown" }; }
  },
  FiniteRescue: finiteRescue
};
context.window = context;
context.MonsterBattleManager = {
  getContext() { return { monsterId: "m004", acceptedAnswers: [], failureCount: runtimeFailureCount }; },
  async start() {
    await context.SpeechRecognitionAdapter.listen({
      legacyTraceContext: { sessionId: "m004-v4", attempt: 1 }
    });
    const aliases = [];
    for (let i = 0; i < 3; i += 1) aliases.push(await context.QuestionManager.start("word.face-parts", {}));

    let recognitionFailures = 0;
    let rescueRetryUsed = false;
    for (let failure = 1; failure <= 5; failure += 1) {
      recognitionFailures += 1;
      runtimeFailureCount = recognitionFailures;
      const rescue = context.FiniteRescue.isImmediateTechnicalFailure(new Error("not-allowed")) ||
        recognitionFailures > 3 || rescueRetryUsed;
      if (!rescue) {
        support.push(failure);
        continue;
      }
      const action = await context.FiniteRescue.choose(!rescueRetryUsed);
      if (action === "retry" && !rescueRetryUsed) rescueRetryUsed = true;
      else break;
    }
    return { aliases, recognitionFailures, rescueRetryUsed };
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/services/m004-battle-extension.js"), "utf8"), context,
  { filename: "engine/services/m004-battle-extension.js" });

(async () => {
  const result = await context.MonsterBattleManager.start("m004");
  assert.deepEqual(support, [1, 2, 3]);
  assert.deepEqual(rescueChoices, [true, true], "m004 final choice must keep Retry available without a limit");
  assert.equal(result.recognitionFailures, 5);
  assert.equal(result.rescueRetryUsed, true);
  assert.deepEqual(result.aliases.map(item => [item.answer, item.status]), [
    ["I", "success"], ["here", "failure"], ["mouse", "success"]
  ]);

  const states = context.LegacySpeechTrace.entries.filter(item => item.event === "m004-finite-rescue-state");
  assert.deepEqual(states.slice(0, 3).map(item => ({
    failureCount: item.failureCount,
    supportLevel: item.supportLevel,
    finiteRescueStep: item.finiteRescueStep,
    retryAvailable: item.retryAvailable,
    adventureReturnAvailable: item.adventureReturnAvailable
  })), [
    { failureCount: 1, supportLevel: 1, finiteRescueStep: "support", retryAvailable: true, adventureReturnAvailable: false },
    { failureCount: 2, supportLevel: 2, finiteRescueStep: "support", retryAvailable: true, adventureReturnAvailable: false },
    { failureCount: 3, supportLevel: 3, finiteRescueStep: "support", retryAvailable: true, adventureReturnAvailable: false }
  ]);
  assert.equal(context.FiniteRescue, finiteRescue, "global FiniteRescue must be restored");
  console.log("m004 Finite Rescue counters and runtime alias wiring: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
