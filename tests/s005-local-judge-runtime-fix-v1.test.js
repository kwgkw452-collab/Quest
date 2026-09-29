"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const c = { console };
c.window = c;
vm.createContext(c);
for (const file of [
  "data/communicative-judge-rules.js",
  "data/s005-communicative-judge-rules.js",
  "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js"
]) vm.runInContext(read(file), c, { filename: file });

const cases = [
  ["hotel.reservation.none", "No"],
  ["hotel.reservation.none", "No, we don't."],
  ["hotel.party.three", "Three"],
  ["hotel.party.three", "3"],
  ["hotel.bed.king.ask", "King-size bed, please."],
  ["hotel.bed.king.ask", "Do you have king-size beds?"],
  ["hotel.bed.king.ask", "Does this hotel have a king-size bed?"],
  ["hotel.rooms.two.request", "2 rooms"],
  ["s005.social.wellbeing.ask", "Are you all right?"],
  ["social.name.ask", "Name, please?"],
  ["mystery.stealing.ask", "Did you steal?"],
  ["social.come.with.us", "Let's go."],
  ["mystery.bag.sighting.ask", "Did you find a bag?"],
  ["social.ben.introduce", "His name is Ben."]
];

(async () => {
  assert.equal(c.LocalCommunicativeJudge.validateRules(c.CommunicativeJudgeRuleData).length, 0);
  for (const [conceptId, utterance] of cases) {
    const result = await c.CommunicativeJudge.judge({
      conceptId, utterance, difficulty: "starter", acceptedVariants: []
    });
    assert.equal(result.verdict, "ACCEPT", utterance);
    assert.equal(result.source, "local", utterance);
    assert.notEqual(result.reason, "no-provider", utterance);
  }
  const count = c.CommunicativeJudgeRuleData.length;
  const canonicalRegistry = c.CommunicativeJudgeRuleData;
  vm.runInContext(read("data/communicative-judge-rules.js"), c);
  assert.strictEqual(c.CommunicativeJudgeRuleData, canonicalRegistry, "foundation reload preserves canonical registry");
  assert.equal(c.CommunicativeJudgeRuleData.length, count, "foundation reload is idempotent");
  vm.runInContext(read("data/s005-communicative-judge-rules.js"), c);
  assert.equal(c.CommunicativeJudgeRuleData.length, count, "registration is idempotent");
  assert.equal(c.CommunicativeJudgeRuleData.filter(rule =>
    ["hotel.reservation.none", "hotel.party.three", "hotel.bed.king.ask",
      "hotel.rooms.two.request", "hotel.breakfast.yes", "s005.social.wellbeing.ask",
      "social.name.ask", "mystery.stealing.ask", "social.come.with.us",
      "mystery.bag.sighting.ask", "social.ben.introduce"].includes(rule.conceptId)).length, 11);
  const questionManager = read("engine/managers/question-manager.js");
  assert(questionManager.includes('"judge-start"'));
  assert(questionManager.includes('"judge-result"'));
  console.log("S005 Local Judge Runtime Fix V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
