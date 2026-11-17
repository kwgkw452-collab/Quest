"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const load = name => fs.readFileSync(path.join(root, name), "utf8");
const questions = [], rules = [];
const ctx = {
  QuestionDatabase: { register(d) { questions.push(d); } },
  CommunicativeJudgeRuleData: rules, LotteryPoolData: [],
  LotteryEngine: { init() {} }
};
vm.createContext(ctx);
vm.runInContext(load("data/s006-communication.js"), ctx);
const approved = [
  ["お手伝いしましょうか？", "Can we help you?"],
  ["その箱は何色ですか？", "What color is the box?"],
  ["ほかの箱はどこにありますか？", "Where are the other boxes?"],
  ["その箱を見せてもらえますか？", "Can we see that box?"],
  ["その箱を持っていますか？", "Do you have the box?"],
  ["このリボンを見てください。", "Please look at this ribbon."],
  ["箱を見ましたか？", "Did you see the box?"],
  ["ちょっと待ってください！", "Please wait!"],
  ["その箱を見つけてください。", "Please find the box."],
  ["私は箱を見つけました！", "I found the box!"]
];
assert.equal(questions.length, 10);
assert.equal(rules.length, 10);
for (let i = 0; i < 10; i++) {
  const q = questions[i], [goal, expected] = approved[i];
  assert.equal(q.id, "s006.communication." + (i + 1));
  assert.equal(q.prompt, goal, "Q" + (i + 1) + " Goal changed");
  assert.equal(q.communicative.expectedUtterance, expected);
  assert.equal(q.picoSupport.length, 3);
  assert(q.answers.includes(expected));
  assert(rules[i].accept(expected), "Q" + (i + 1) + " rejected own target");
  assert(!rules[i].accept(""), "Q" + (i + 1) + " accepted empty speech");
}
for (const utterance of ["Did you see the box?", "Do you see the box?", "Can you see the box?", "Have you seen the box?", "Did you see the books?"]) {
  assert(rules[6].accept(utterance), "Q7 rejected: " + utterance);
}
for (const utterance of ["Is the box on the cart?", "Did you hear the box?"]) {
  assert(!rules[6].accept(utterance), "Q7 accepted wrong purpose: " + utterance);
}
for (const utterance of ["Please find the box.", "Find the box.", "Can you find my box?", "Please look for the box."]) {
  assert(rules[8].accept(utterance), "Q9 rejected: " + utterance);
}
for (const utterance of ["Please find the book.", "Do not find the box."]) {
  assert(!rules[8].accept(utterance), "Q9 accepted wrong purpose: " + utterance);
}
const story = load("engine/stories/S006.js");
assert.equal((story.match(/C\.question\("s006\.communication\./g) || []).length, 10);
assert(story.includes("はい、見ました。誰かがバス乗り場へ運んでいきました。"));
assert(story.includes('{ type: "s006EndingLetter" }'));
const css = load("css/dialogue-information.css");
assert(css.includes(".communication-dialogue.communication-has-explanation"));
assert(css.includes("--compact-two-row-height: 100.2px"));
assert(css.includes("--compact-three-row-height: 140px"));
assert(!css.includes(":has(> .communication-dialogue:not([hidden]) .dialogue-primary-goal:not([hidden]):not(:empty))"));
const dialog = load("engine/managers/dialog-manager.js");
const presenter = load("engine/presenters/communicative-question-presenter.js");
assert(dialog.includes('classList.add("communication-has-explanation")'));
assert(dialog.includes('classList.remove("communication-has-explanation")'));
assert(presenter.includes("support: showingSupport"));
console.log("S006 all-10 goals/targets/hints and Judge, Q7/Q9 plus 2-row/3-row contracts: PASS");
