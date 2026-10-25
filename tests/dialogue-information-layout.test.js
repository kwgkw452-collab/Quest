"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function setup(wide) {
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.parentNode = null;
      this.attributes = {};
      this.className = "";
      this.hidden = false;
      this.scrollTop = 0;
      this.listeners = {};
      this.ownText = "";
      this.classList = {
        add: value => { this.className += " " + value; },
        remove: value => { this.className = this.className.split(/\s+/).filter(x => x !== value).join(" "); }
      };
    }
    get textContent() { return this.ownText + this.children.map(x => x.textContent).join(""); }
    set textContent(value) { this.ownText = value; this.children.forEach(x => { x.parentNode = null; }); this.children = []; }
    set innerHTML(value) { assert.strictEqual(value, ""); this.textContent = ""; }
    appendChild(child) { return this.insertBefore(child, null); }
    insertBefore(child, before) {
      child.remove();
      const index = before ? this.children.indexOf(before) : this.children.length;
      assert(index >= 0);
      this.children.splice(index, 0, child);
      child.parentNode = this;
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
      this.parentNode = null;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    closest() { return wide ? {} : null; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    getBoundingClientRect() { return { top: 0, bottom: 300 }; }
  }
  const elements = {};
  for (const name of ["dialogueBox", "speaker", "message", "recognizedText", "controls"]) elements[name] = new Element("div");
  ["speaker", "message", "recognizedText", "controls"].forEach(name => elements.dialogueBox.appendChild(elements[name]));
  const context = { console, GameConfig: {}, document: {
    createElement: tag => new Element(tag),
    createTextNode: text => { const e = new Element("#text"); e.textContent = text; return e; }
  } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../engine/managers/dialog-manager.js"), "utf8"), context);
  context.DialogManager.init(elements);
  return { manager: context.DialogManager, elements, setWide(value) { wide = value; } };
}


const ui = setup(true);
const { manager, elements } = ui;
const goal = "日本語Goal";
const support = "既存のヒント\n次の行";
manager.showCommunication("ピコ", goal + "\n\n" + support, goal);
const information = elements.message.parentNode;
const primary = elements.dialogueBox.children[0];
const goalNode = primary.children[1];
assert.strictEqual(primary.className, "dialogue-primary");
assert.strictEqual(goalNode.textContent, goal);
assert.strictEqual(elements.speaker.hidden, true);
assert.strictEqual(elements.message.textContent, support, "Goal must not be repeated in Support");
assert.deepStrictEqual(elements.dialogueBox.children, [primary, information, elements.controls]);
assert.strictEqual(elements.recognizedText.parentNode, information);
manager.addControl("もう一度話す", () => {});
const retryAction = elements.controls.children[0];
let current = true;
manager.addCommunicationLanguageControls("Existing model English.", goal, () => current);
const englishButton = elements.controls.children[1];
const japaneseButton = elements.controls.children[2];
englishButton.listeners.click();
assert.strictEqual(elements.message.textContent, "Existing model English.");
assert.strictEqual(goalNode.textContent, goal);
assert.strictEqual(elements.controls.children[0], retryAction);
japaneseButton.listeners.click();
assert.strictEqual(elements.message.textContent, "", "the already-visible Japanese Goal must not be duplicated");
assert.strictEqual(information.hidden, true);
assert.strictEqual(goalNode.textContent, goal);
current = false;
englishButton.listeners.click();
assert.strictEqual(elements.message.textContent, "");

manager.showCommunication("ピコ", goal, goal); // Retry gate preserves the existing Support.
assert.strictEqual(elements.message.textContent, support);
manager.addControl("話す", () => {});
manager.showSpeechStatus("ピコ", goal, "🎤 聞き取り中…");
assert.strictEqual(elements.message.textContent, support);
assert.strictEqual(goalNode.textContent, goal);
assert.strictEqual(elements.speaker.hidden, true);
assert.strictEqual(elements.controls.children.length, 1);
const status = elements.controls.children[0];
assert.strictEqual(status.attributes.role, "status");
assert.strictEqual(status.children[0].textContent, "🎤 聞き取り中…");
assert.strictEqual(status.children[1].textContent, "聞き取った内容：");
manager.showRecognized("…", "聞き取り中：");
assert.strictEqual(status.children[1].textContent, "聞き取った内容：");
manager.showRecognized("Two rooms please", "聞き取り中：");
assert.strictEqual(status.children[1].textContent, "聞き取った内容：Two rooms please");
assert.strictEqual(elements.recognizedText.hidden, true);
assert(!information.textContent.includes("Two rooms please"), "interim transcript belongs in the bottom-right status");
assert.strictEqual(elements.message.textContent, support);
assert.strictEqual(elements.dialogueBox.scrollTop, 0);
manager.showCommunication("ピコ", goal + "\n\n" + support, goal);
assert.strictEqual(elements.controls.textContent, "", "completed listening must clear the whole status row");
manager.showRecognized("final answer", "You said:\n");
assert.strictEqual(elements.recognizedText.textContent, "final answer と聞こえたよ。");
manager.showCommunication("ピコ", goal + "\n\nShe と聞こえたよ。 ｜ うまく判断できなかったピコ。", goal, { feedback: true });
assert(elements.dialogueBox.className.includes("communication-feedback"));
assert.strictEqual(elements.recognizedText.hidden, true);
manager.showCommunication("ピコ", goal + "\n\n" + support, goal);
assert(!elements.dialogueBox.className.includes("communication-feedback"), "Support must retain its existing layout");
manager.resetCommunicationInformation();
manager.showCommunication("ピコ", goal, goal);
assert.strictEqual(elements.message.textContent, "", "a new Challenge must not retain previous Support");
assert.strictEqual(information.hidden, true);
manager.show("Kong", "通常のStory本文");
assert.strictEqual(elements.speaker.parentNode, primary);
assert.strictEqual(elements.message.parentNode, primary, "name and normal Dialogue share one horizontal area");
assert.strictEqual(elements.speaker.hidden, false);
assert.strictEqual(goalNode.hidden, true);
assert.strictEqual(elements.message.textContent, "通常のStory本文");
ui.setWide(false);
manager.show("Kong", "Legacy");
assert.deepStrictEqual(elements.dialogueBox.children, [elements.speaker, elements.message, elements.recognizedText, elements.controls]);
assert.strictEqual(elements.dialogueBox.className, "dialogue-box");

const legacy = setup(false);
legacy.manager.showCommunication("ピコ", goal + "\n\n" + support, goal);
legacy.manager.addCommunicationLanguageControls("Existing model English.", goal);
assert.strictEqual(legacy.elements.controls.children.length, 0);
assert.strictEqual(legacy.elements.message.parentNode, legacy.elements.dialogueBox);
assert.strictEqual(legacy.elements.message.textContent, goal + "\n\n" + support);
legacy.manager.showSpeechStatus("ピコ", goal, "🎤 聞き取り中…");
assert.strictEqual(legacy.elements.recognizedText.textContent, "🎤 聞き取り中…");
assert.strictEqual(legacy.elements.recognizedText.hidden, false);
console.log("dialogue-information-layout.test.js: PASS");
