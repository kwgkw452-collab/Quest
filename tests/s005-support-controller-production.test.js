"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function element() {
  const el = {
    children: [], parentNode: null, hidden: false, disabled: false,
    className: "", textContent: "", scrollTop: 0, listeners: {}, attributes: {},
    appendChild(child) {
      child.remove(); child.parentNode = this; this.children.push(child); return child;
    },
    insertBefore(child, before) {
      child.remove(); child.parentNode = this;
      const index = this.children.indexOf(before);
      this.children.splice(index < 0 ? this.children.length : index, 0, child);
    },
    remove() {
      if (this.parentNode) {
        const siblings = this.parentNode.children;
        siblings.splice(siblings.indexOf(this), 1); this.parentNode = null;
      }
    },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    click() { if (!this.disabled && this.listeners.click) this.listeners.click(); },
    closest() { return {}; },
    getBoundingClientRect() { return { top: 0, bottom: 100 }; }
  };
  el.classList = {
    add(name) { if (!el.className.split(" ").includes(name)) el.className += " " + name; },
    remove(name) { el.className = el.className.split(" ").filter(value => value !== name).join(" "); }
  };
  Object.defineProperty(el, "innerHTML", { set() {
    this.children.forEach(child => { child.parentNode = null; }); this.children = [];
  } });
  return el;
}

function harness() {
  const events = {}, questions = [], outcomes = [];
  let onStep, calls = 0;
  const els = Object.fromEntries(["dialogueBox", "speaker", "message", "recognizedText", "controls"]
    .map(name => [name, element()]));
  [els.speaker, els.message, els.recognizedText, els.controls].forEach(el => els.dialogueBox.appendChild(el));
  const c = { console, Promise, CommunicativeJudgeRuleData: [], LotteryPoolData: [], LotteryEngine: { init() {} },
    GameConfig: { dialogueNextLabel: "つぎへ", recognizedPrefix: "" },
    document: { createElement: element, getElementById: id => id === "controls" ? els.controls : null },
    addEventListener(name, callback) { events[name] = callback; },
    StoryRegistry: { register() {} },
    StoryEvents: { on(name, callback) { if (name === "step:enter") onStep = callback; } },
    QuestionDatabase: { register(q) { questions.push(q); }, get(id) { return questions.find(q => q.id === id); } },
    QuestionManager: {
      cancel() {},
      async start(id, options) {
        calls++;
        assert(outcomes.length, "Each attempt requires an outcome");
        const plan = outcomes.shift();
        const value = await options.speechStart(async () => {
          if (plan.pending) await plan.pending;
          if (plan.interim) options.onInterim(plan.interim);
          return { questionId: id, status: plan.status, answer: plan.answer || null, error: plan.error || null };
        });
        return value;
      }
    }
  };
  c.window = c; vm.createContext(c);
  for (const file of ["engine/commands/story-commands.js", "data/s005-communication.js", "engine/stories/S005.js",
    "engine/managers/dialog-manager.js", "engine/presenters/communicative-question-presenter.js",
    "engine/controllers/communicative-question-flow-controller.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), c, { filename: file });
  }
  c.DialogManager.init(els); events.DOMContentLoaded();
  return { c, els, questions, outcomes, get calls() { return calls; },
    start(q) { onStep({ step: { type: "question", questionId: q.id } }); return c.CommunicativeQuestionFlowController.start(q.id); }
  };
}

async function flush() { for (let i = 0; i < 24; i++) await Promise.resolve(); }
function button(h, label) { return h.els.controls.children.find(el => el.textContent === label); }
async function click(h, label) {
  const found = button(h, label); assert(found, "Missing enabled control: " + label);
  assert(!found.disabled); found.click(); await flush();
}
function support(h, q, stage) {
  assert.strictEqual(h.els.message.textContent, q.picoSupport[stage - 1]);
  for (const label of ["もう一度話す", "ピコのサポート", "英語を見る", "日本語を見る"]) {
    assert(button(h, label), "Support must retain " + label);
  }
}

(async () => {
  const h = harness();
  assert.strictEqual(h.questions.length, 11);
  for (const q of h.questions) {
    h.outcomes.push({ status: "reject" }, { status: "unknown" }, { status: "speech-failure" },
      { status: "reject" }, { status: "speech-failure" }, { status: "success" });
    const run = h.start(q); await flush();
    assert.strictEqual(h.els.message.textContent, "", "New Challenge shows no previous Support");
    await click(h, "話す");
    assert(!button(h, "英語を見る"), "Stage 0 has not opened Support");
    await click(h, "ピコのサポート"); support(h, q, 1);
    await click(h, "もう一度話す");
    assert.strictEqual(h.els.message.textContent, q.picoSupport[0], "S1 is visible at retry speech gate");
    await click(h, "話す"); support(h, q, 1);

    const callsBeforeLanguage = h.calls;
    await click(h, "英語を見る");
    assert.strictEqual(h.els.message.textContent, q.communicative.expectedUtterance);
    await click(h, "日本語を見る");
    assert.strictEqual(h.els.message.textContent, "", "Japanese Goal is already displayed in header");
    assert(button(h, "もう一度話す")); assert(button(h, "ピコのサポート"));
    assert.strictEqual(h.calls, callsBeforeLanguage, "Language controls do not start or resolve an attempt");
    await click(h, "ピコのサポート"); support(h, q, 2);
    await click(h, "もう一度話す"); await click(h, "話す"); support(h, q, 2);
    await click(h, "英語を見る");
    await click(h, "ピコのサポート"); support(h, q, 3);
    for (let retry = 0; retry < 2; retry++) {
      await click(h, "もう一度話す"); await click(h, "話す"); support(h, q, 3);
    }
    await click(h, "ピコのサポート"); support(h, q, 3);
    await click(h, "もう一度話す"); await click(h, "話す");
    assert.strictEqual((await run).status, "success");
  }

  // The Controller must leave listening as soon as the external attempt settles.
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  h.outcomes.push({ status: "speech-failure", error: "speech-timeout", pending });
  const delayed = h.start(h.questions[0]); await flush(); await click(h, "話す");
  assert(h.els.controls.children.some(el => el.className === "dialogue-listening-status"));
  release(); await flush();
  assert(button(h, "もう一度話す"), "Settled failure returns from listening without another Controller gate");
  await click(h, "冒険を続ける"); await click(h, "次へ");
  assert.strictEqual((await delayed).status, "continued");

  h.outcomes.push({ status: "reject" });
  const cancelled = h.start(h.questions[1]); await flush(); await click(h, "話す");
  await click(h, "ピコのサポート");
  h.c.CommunicativeQuestionFlowController.cancel();
  assert.strictEqual((await cancelled).status, "cancelled");
  console.log("S005 Production Controller + Presenter + DialogManager: PASS (11 challenges, S1/S2/S3 retries, language controls, cap/reset, settled failure, cancellation)");
})().catch(error => { console.error(error); process.exitCode = 1; });

