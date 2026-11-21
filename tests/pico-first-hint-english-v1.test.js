"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const expectedCounts = { S005: 12, S006: 10, S007: 10 };

for (const [story, expected] of Object.entries(expectedCounts)) {
  const questions = [];
  const context = {
    QuestionDatabase: { register(q) { questions.push(q); } },
    CommunicativeJudgeRuleData: [],
    LotteryPoolData: [],
    LotteryEngine: { init() {} },
    window: {}
  };
  context.window = context;
  const source = fs.readFileSync(path.join(root, "data", story.toLowerCase() + "-communication.js"), "utf8");
  vm.createContext(context);
  vm.runInContext(source, context, {filename: story + "-communication.js"});
  assert.equal(questions.length, expected, story + " question count");
  for (const q of questions) {
    assert.equal(q.picoSupport.length, 3, q.id + " three hint stages");
    if (story === "S006") assert.match(q.picoSupport[0], /[A-Za-z]/, q.id + " first hint contains English");
    if (story === "S006") assert.equal(q.picoSupport[2], q.communicative.expectedUtterance, q.id + " final hint is model");
  }
}
console.log("pico-first-hint-english-v1: PASS (32 registered three-stage hints; S006 V2 10 first hints contain English)");
