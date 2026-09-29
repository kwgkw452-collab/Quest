"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const appended = [];
function element() {
  return {
    hidden: false, className: "", textContent: "", innerHTML: "", scrollTop: 0,
    appendChild(value) { appended.push(value); },
    addEventListener(_name, listener) { this.listener = listener; },
    getBoundingClientRect() { return { top: 0, bottom: 0 }; }
  };
}
const els = {
  dialogueBox: element(), speaker: element(), message: element(),
  recognizedText: element(), controls: element()
};
const context = {
  console, window: {}, GameConfig: { dialogueNextLabel: "Next", recognizedPrefix: "" },
  document: { createElement: element }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/managers/dialog-manager.js"), "utf8"), context);
context.DialogManager.init(els);

async function chooseAndCapture(allowRetry) {
  const start = appended.length;
  const pending = context.FiniteRescue.choose(allowRetry);
  const buttons = appended.slice(start);
  const labels = buttons.map(button => button.textContent);
  const message = els.message.textContent;
  buttons[buttons.length - 1].listener();
  await pending;
  return { labels, message };
}

(async () => {
  const retryAvailable = await chooseAndCapture(true);
  assert.strictEqual(retryAvailable.message,
    "うまく聞き取れなかったピコ。\nもう一度やってもいいし、\nこのまま冒険に戻ってもいいピコ。");
  assert.deepStrictEqual(retryAvailable.labels, ["もう一度言う", "言わずに冒険に戻る"]);

  const retryConsumed = await chooseAndCapture(false);
  assert.strictEqual(retryConsumed.message,
    "うまく聞き取れなかったピコ。\n今回はこのまま冒険に戻るピコ。");
  assert.deepStrictEqual(retryConsumed.labels, ["言わずに冒険に戻る"]);

  console.log("Finite Rescue final message consistency V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
