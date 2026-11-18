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
  // Parse the authored question definitions without invoking the engine.
  const blocks = [...source.matchAll(/"id"\s*:\s*"(s00[567]\.communication\.\d+)"[\s\S]*?"picoSupport"\s*:\s*\[\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")\s*,\s*("(?:[^"\\]|\\.)*")/g)];
  assert.equal(blocks.length, expected, story + " question count");
  for (const block of blocks) {
    const first = JSON.parse(block[2]);
    assert.match(first, /[A-Za-z]/, block[1] + " first Pico hint must contain usable English");
    assert(first.trim().length > 0, block[1] + " first Pico hint is empty");
  }
}
console.log("pico-first-hint-english-v1: PASS (32 first hints contain English)");
