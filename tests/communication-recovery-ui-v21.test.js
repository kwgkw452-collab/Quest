"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const source = fs.readFileSync(path.join(__dirname, "../engine/presenters/communicative-question-presenter.js"), "utf8");
const ui = { recognized: [], languages: 0, resets: 0 };
const q = { prompt: "挨拶してね。", answers: ["Hello."] };
let onStep;
const c = { console, Promise, document: { getElementById: () => ({ appendChild(button) { ui.talk = button; } }) },
  QuestionDatabase: { get: () => q }, StoryEvents: { on: (_, listener) => { onStep = listener; } },
  DialogManager: {
    resetCommunicationInformation() { ui.resets++; },
    showCommunication(_, text, goal) { ui.text = text; ui.goal = goal; ui.buttons = []; },
    showRecognized(text) { ui.recognized.push(text); }, hideRecognized() {},
    addCommunicationLanguageControls() { ui.languages++; },
    showSpeechStatus() { ui.status = true; ui.buttons = []; },
    button(label, click) { return { label, click }; },
    choice(choices) { ui.buttons = choices.map(x => x.value); return Promise.resolve("continue"); },
    next() { return Promise.resolve("next"); }
  }, addEventListener(_, listener) { listener(); } };
c.window = c; vm.createContext(c); vm.runInContext(source, c);
onStep({ step: { type: "question", questionId: "any" } });
(async () => {
 const p = c.CommunicativeQuestionPresenter, token = p.begin();
 p.speech(() => new Promise(() => {}), token, {}, q.prompt);
 assert.strictEqual(ui.text, q.prompt);
 for (const status of ["reject", "unknown", "speech-failure"]) {
   await p.recovery({ status, answer: "High" }, { retry: true, support: true }, token);
   assert(ui.text.includes("High と聞こえたよ。 ｜ "));
   assert.strictEqual(ui.text.split(q.prompt).length - 1, 1);
   assert.strictEqual(ui.languages, 0);
   assert.deepStrictEqual(Array.from(ui.buttons), ["retry", "support", "continue"]);
 }
 assert.strictEqual(ui.recognized.length, 0, "Recovery never creates a standalone transcript row");
 await p.recovery({ status: "reject", answer: "High" }, { retry: true, support: true, supportText: "Support 1" }, token);
 assert.strictEqual(ui.text, q.prompt + "\n\nSupport 1");
 assert.strictEqual(ui.languages, 1);
 p.speech(() => new Promise(() => {}), token, {}, q.prompt);
 assert.strictEqual(ui.text, q.prompt + "\n\nSupport 1");
 ui.talk.click(); assert(ui.status);
 p.listening("Hello", token); assert.strictEqual(ui.recognized.at(-1), "Hello");
 const next = p.begin(); p.speech(() => new Promise(() => {}), next, {}, q.prompt);
 assert.strictEqual(ui.text, q.prompt, "next Challenge clears previous Support");
 console.log("communication-recovery-ui-v21.test.js: PASS");
})().catch(e => { console.error(e); process.exitCode = 1; });
