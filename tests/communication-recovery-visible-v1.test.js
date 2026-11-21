"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const load = p => fs.readFileSync(path.join(root, p), "utf8");
const css = load("css/dialogue-information.css");
assert(css.includes(".communication-dialogue:is(.communication-has-explanation, .communication-feedback)"),
  "140px must activate for both hints and feedback");
assert(css.includes("--compact-three-row-height: 140px"));
assert(css.includes(".communication-feedback > .dialogue-information"));
assert(css.includes("min-height: 28px"), "feedback must reserve a readable message row");


(async function () {
  const events = [];
  const answers = [
    { status: "reject", answer: "wrong first" },
    { status: "reject", answer: "wrong second" }
  ];
  let nextChoice = ["support", "retry", "continue"];
  const context = {
    console, Promise,
    QuestionDatabase: { get() { return { communicative: true, picoSupport: ["hint one", "hint two", "hint three"], prompt: "日本語Goal" }; } },
    QuestionManager: { cancel() {}, async start() { return answers.shift() || { status: "reject", answer: "wrong second" }; } },
    CommunicativeQuestionPresenter: {
      begin() { return 1; },
      cancel() {},
      async recovery(result, opts) {
        events.push({ result: result.answer, supportText: opts.supportText });
        return nextChoice.shift();
      },
      async continued() { return "next"; }
    },
    window: {}
  };
  vm.createContext(context);
  vm.runInContext(load("engine/controllers/communicative-question-flow-controller.js"), context);
  await context.window.CommunicativeQuestionFlowController.start("s005.communication.1");
  assert.deepEqual(events.map(e => [e.result, e.supportText]), [
    ["wrong first", null],
    ["wrong first", "hint one"],
    ["wrong second", null]
  ], "new transcript after retry must override stored support without resetting support stage");
  console.log("communication-recovery-visible-v1: PASS (contract + retry priority; browser measurements still required)");
})().catch(e => { console.error(e); process.exitCode = 1; });
