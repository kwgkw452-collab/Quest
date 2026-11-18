"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const cases = JSON.parse(read("tests/s006-communication-v2-cases.json"));
let transcript, speechError;
const c = {
  console, setTimeout, clearTimeout, GameConfig: { defaultLanguage: "en-US" },
  AudioManager: { stopAll() {} }, GameCore: {},
  SpeechEngine: { supported: true, getStatus: () => "idle", stop() {} },
  SpeechStartController: {
    prepare: async () => {}, cancel() {},
    async startListening() { if (speechError) throw new Error(speechError); return transcript; }
  }
};
c.window = c; vm.createContext(c);
const load = p => vm.runInContext(read(p), c, { filename: p });
[
  "data/word-dictionaries.js", "data/questions.js", "data/communicative-judge-rules.js",
  "data/lottery-pools.js", "engine/services/speech-normalizer.js",
  "engine/services/lottery-engine.js", "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js", "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js", "data/s005-communication.js"
].forEach(load);
const s005Before = JSON.stringify(c.QuestionDatabase.all().filter(q => q.id.startsWith("s005.")));
load("data/s006-communication.js"); load("data/s007-communication.js");
const plain = x => JSON.parse(JSON.stringify(x));
let judgeChecks = 0, managerChecks = 0;
async function judge(q, text, expected, alternatives = []) {
  const r = await c.CommunicativeJudge.judge({
    conceptId: q.communicative.conceptId, utterance: text, alternatives,
    acceptedVariants: q.answers, difficulty: "starter",
    context: { poolId: q.communicative.poolId, promptType: q.communicative.promptType }
  });
  assert.equal(r.verdict, expected, q.id + ": " + text + " (" + r.reason + ")");
  judgeChecks++;
}
async function managed(q, text, expected) {
  transcript = text; speechError = null;
  const r = await c.QuestionManager.start(q.id);
  assert.equal(r.status, expected, q.id + " manager: " + text);
  assert.equal(r.judgeMode, "communicative");
  managerChecks++;
}
(async () => {
  assert.equal(cases.length, 10);
  const questions = c.QuestionDatabase.all().filter(q => q.id.startsWith("s006."));
  const rules = c.CommunicativeJudgeRuleData.filter(r => r.conceptId.startsWith("s006."));
  const pools = c.LotteryPoolData.filter(p => p.poolId.startsWith("s006."));
  assert.equal(questions.length, 10); assert.equal(rules.length, 10); assert.equal(pools.length, 10);
  assert.equal(new Set(questions.map(q => q.id)).size, 10);
  assert.equal(c.LocalCommunicativeJudge.validateRules(c.CommunicativeJudgeRuleData).length, 0);
  assert.equal(c.LotteryEngine.validate(c.LotteryPoolData).length, 0);
  assert.equal(JSON.stringify(c.QuestionDatabase.all().filter(q => q.id.startsWith("s005."))), s005Before);
  for (const row of cases) {
    const q = c.QuestionDatabase.get("s006.communication." + row.q);
    const { conceptId, poolId } = q.communicative;
    assert.equal(conceptId, "s006.mystery.v2." + row.q);
    assert.equal(poolId, q.id + ".v2");
    assert.equal(q.prompt, row.goal); assert.equal(q.communicative.expectedUtterance, row.model);
    assert.deepEqual(plain(q.picoSupport), row.hints);
    assert(/[a-z]{2}/i.test(q.picoSupport[0]));
    assert.equal(q.picoSupport[2], row.model);
    assert.deepEqual(plain(q.answers), [row.model, ...row.accept]);
    const rule = rules.find(r => r.conceptId === conceptId);
    const pool = c.LotteryEngine.getPool(poolId);
    const draw = c.LotteryEngine.draw(poolId, { difficulty: "starter", promptType: q.communicative.promptType });
    assert.equal(draw.status, "selected");
    assert.equal(draw.displayValue, q.prompt); assert.equal(draw.conceptId, conceptId);
    assert.equal(draw.expectedUtterance, row.model);
    assert.deepEqual(plain(rule.variants), plain(q.answers));
    assert.deepEqual(plain(pool.items[0].prompts[0].acceptedVariants), plain(q.answers));
    assert.deepEqual(plain(draw.acceptedVariants), plain(q.answers));
    assert.equal(c.LotteryEngine.getPool(q.id + ".v1"), null);
    assert(!rules.some(r => r.conceptId === "s006.mystery." + row.q));
    for (const text of [row.model, ...row.accept, ...row.minor, ...row.additional]) {
      assert.equal(rule.reject(text), false, "reject must not shadow ACCEPT: " + text);
      await judge(q, text, "ACCEPT"); await managed(q, text, "success");
    }
    for (const text of row.reject) {
      await judge(q, text, "REJECT", [row.model]);
      await managed(q, text, "reject");
    }
    for (const text of row.unknown) {
      await judge(q, text, "UNKNOWN"); await managed(q, text, "unknown");
    }
    await judge(q, "", "UNKNOWN");
    // Existing Core may rescue an UNKNOWN primary with an accepted alternative.
    await judge(q, row.unknown[0], "ACCEPT", [row.model]);
    await managed(q, row.model.toUpperCase().replace(/[?.!]/g, "!!!"), "success");
    // A positive prefix followed by a contrary instruction never inherits ACCEPT.
    await judge(q, row.model + " but do not find the box.", "REJECT", [row.model]);
    speechError = "no-speech";
    assert.equal((await c.QuestionManager.start(q.id)).status, "speech-failure");
    speechError = null;
  }
  for (const entry of ["index.html", "dev.html"]) {
    const matches = read(entry).match(/<script src="data\/s006-communication\.js[^"]*"/g) || [];
    assert.deepEqual(matches, ['<script src="data/s006-communication.js?v=s006-communication-v2-20261119"']);
  }
  assert.throws(() => load("data/s006-communication.js"), /already registered/);

  // Real QuestionManager + real FlowController, speech and display boundary only mocked.
  let actions, recoveries, goals, choices;
  c.CommunicativeQuestionPresenter = {
    begin() { return 1; }, cancel() {}, listening() {},
    async speech(start, token, trace, goal) { goals.push(goal); return start(); },
    async recovery(r, opts) {
      recoveries.push(opts.supportText); choices.push(opts);
      return actions.shift();
    },
    async continued() { return "next"; }
  };
  load("engine/controllers/communicative-question-flow-controller.js");
  for (const row of cases) {
    const q = c.QuestionDatabase.get("s006.communication." + row.q);
    transcript = "flibbertigibbet";
    actions = ["support", "support", "support", "support", "retry", "continue"];
    recoveries = []; goals = []; choices = [];
    const result = await c.CommunicativeQuestionFlowController.start(q.id);
    assert.equal(result.status, "continued");
    assert.deepEqual(recoveries, [null, ...row.hints, row.hints[2], row.hints[2]]);
    assert.equal(goals.length, 2); assert(goals.every(g => g === row.goal));
    assert(choices.every(o => o.support && o.retry && !o.text));
    // New run/question resets the stage. First support is stage 1 again.
    actions = ["support", "continue"]; recoveries = []; goals = []; choices = [];
    await c.CommunicativeQuestionFlowController.start(q.id);
    assert.deepEqual(recoveries, [null, row.hints[0]]);
    // A support-click does not itself retry recognition; one initial gate only.
    assert.equal(goals.length, 1);
    // Retry at stage 1/2 must not advance the hint; do not only test the cap.
    for (const stage of [1, 2]) {
      actions = [...Array(stage).fill("support"), "retry", "support", "continue"];
      recoveries = []; goals = []; choices = [];
      await c.CommunicativeQuestionFlowController.start(q.id);
      assert.deepEqual(recoveries,
        [null, ...row.hints.slice(0, stage), row.hints[stage - 1], row.hints[stage]]);
      assert.equal(goals.length, 2);
      assert(choices.every(o => !o.text));
    }
    transcript = row.model; recoveries = []; goals = []; choices = []; actions = [];
    assert.equal((await c.CommunicativeQuestionFlowController.start(q.id)).status, "success");
    assert.equal(recoveries.length, 0);
  }
  console.log("S006 V2 PASS: 10 Question/rule/pool, " + judgeChecks + " Judge + " +
    managerChecks + " QuestionManager checks; 10 real Flow support/retry/reset/success paths.");
})().catch(e => { console.error(e); process.exitCode = 1; });

