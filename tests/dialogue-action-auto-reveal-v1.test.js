"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.hidden = false;
    this.scrollTop = 0;
    this.rect = { top: 0, bottom: 0 };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(name, listener) {
    this.listeners[name] = listener;
  }

  click() {
    if (this.listeners.click) this.listeners.click();
  }

  getBoundingClientRect() {
    return this.rect;
  }

  set innerHTML(value) {
    if (value === "") this.children = [];
  }
}

function setup(boxRect, buttonRect) {
  const elements = {
    dialogueBox: new Element("section"),
    speaker: new Element("div"),
    message: new Element("div"),
    recognizedText: new Element("div"),
    controls: new Element("div")
  };
  elements.dialogueBox.rect = boxRect;
  elements.dialogueBox.clientHeight = boxRect.bottom - boxRect.top;
  elements.dialogueBox.scrollHeight = Math.max(
    elements.dialogueBox.clientHeight,
    buttonRect.bottom - boxRect.top
  );

  const context = {
    console,
    window: {},
    GameConfig: { dialogueNextLabel: "次へ", recognizedPrefix: "" },
    document: {
      createElement(tagName) {
        const element = new Element(tagName);
        if (tagName === "button") element.rect = buttonRect;
        return element;
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(root, "engine/managers/dialog-manager.js"), "utf8"),
    context,
    { filename: "engine/managers/dialog-manager.js" }
  );
  context.DialogManager.init(elements);
  return { context, elements };
}

(async () => {
  const visible = setup({ top: 100, bottom: 300 }, { top: 240, bottom: 280 });
  assert.strictEqual(visible.elements.dialogueBox.scrollHeight <= visible.elements.dialogueBox.clientHeight, true);
  const visiblePending = visible.context.DialogManager.next("次へ");
  assert.strictEqual(visible.elements.dialogueBox.scrollTop, 0,
    "an already-visible action must not move the dialogue scroll position");

  let visibleResolved = 0;
  visiblePending.then(() => { visibleResolved += 1; });
  await Promise.resolve();
  assert.strictEqual(visibleResolved, 0, "next must remain pending before click");
  visible.elements.controls.children[0].click();
  await visiblePending;
  visible.elements.controls.children[0].click();
  await Promise.resolve();
  assert.strictEqual(visibleResolved, 1, "next must resolve exactly once after click");

  const overflow = setup({ top: 100, bottom: 300 }, { top: 320, bottom: 360 });
  assert.strictEqual(overflow.elements.dialogueBox.clientHeight < overflow.elements.dialogueBox.scrollHeight, true,
    "the regression case must represent real dialogue overflow");
  const overflowPending = overflow.context.DialogManager.next("出発");
  assert.strictEqual(overflow.elements.controls.children[0].textContent, "出発");
  assert.strictEqual(overflow.elements.dialogueBox.scrollTop, 60,
    "an action below the dialogue viewport must be revealed by container-local scrolling");

  let overflowResolved = false;
  overflowPending.then(() => { overflowResolved = true; });
  await Promise.resolve();
  assert.strictEqual(overflowResolved, false, "auto-reveal must not auto-resolve next");
  overflow.elements.controls.children[0].click();
  await overflowPending;
  assert.strictEqual(overflowResolved, true);

  const above = setup({ top: 100, bottom: 300 }, { top: 60, bottom: 90 });
  above.elements.dialogueBox.scrollTop = 80;
  const abovePending = above.context.DialogManager.next("戻る");
  assert.strictEqual(above.elements.dialogueBox.scrollTop, 40,
    "an action above the dialogue viewport must be revealed without scrolling the page");
  above.elements.controls.children[0].click();
  await abovePending;

  console.log("Dialogue Action Auto-Reveal V1 test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
