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
  return { manager: context.DialogManager, elements };
}

const { manager, elements } = setup(true);
const goal = "日本語Goal";
const support = "既存のヒント\n次の行";
manager.showCommunication("ピコ", goal + "\n\n" + support, goal);
const information = elements.message.parentNode;
assert.strictEqual(information.className, "dialogue-information");
assert.deepStrictEqual(elements.dialogueBox.children, [elements.speaker, information, elements.controls]);
assert.strictEqual(elements.recognizedText.parentNode, information);
assert.strictEqual(elements.message.textContent, goal + "\n\n" + support, "presentation must preserve all content");
assert.strictEqual(elements.message.children[0].textContent, goal);
assert.strictEqual(elements.message.children[2].textContent, support);
manager.showSpeechStatus("ピコ", goal, "🎤 聞き取り中…");
assert.strictEqual(elements.message.textContent, goal);
assert.strictEqual(elements.recognizedText.hidden, true);
assert.strictEqual(elements.controls.children[0].attributes.role, "status");
assert.strictEqual(elements.controls.textContent, "🎤 聞き取り中…");
assert(!information.textContent.includes("聞き取り中"), "status belongs to the control area");
manager.showRecognized("…", "聞き取り中：");
assert.strictEqual(elements.recognizedText.hidden, true, "speech placeholder must stay out of information");
manager.showRecognized("hello", "聞き取り中：");
assert.strictEqual(elements.recognizedText.parentNode, information);
assert.strictEqual(elements.recognizedText.textContent, "認識結果：hello");
manager.showCommunication("ピコ", goal + "\n\n" + support, goal);
assert.strictEqual(elements.controls.textContent, "", "completed listening must clear status");
manager.addControl("もう一度話す", () => {});
assert.strictEqual(elements.controls.children.length, 1);
assert.strictEqual(elements.dialogueBox.scrollTop, 0, "controls must not scroll the whole dialogue");
const speakerBefore = elements.speaker.textContent;
const retryAction = elements.controls.children[0];
let current = true;
manager.addCommunicationLanguageControls("Existing model English.", goal, () => current);
const englishButton = elements.controls.children[1];
const japaneseButton = elements.controls.children[2];
assert.strictEqual(englishButton.textContent, "英語を見る");
assert.strictEqual(japaneseButton.textContent, "日本語を見る");
englishButton.listeners.click();
assert.strictEqual(elements.message.textContent, goal + "\n\nExisting model English.");
assert.strictEqual(englishButton.attributes["aria-pressed"], "true");
japaneseButton.listeners.click();
assert.strictEqual(elements.message.textContent, goal);
assert.strictEqual(japaneseButton.attributes["aria-pressed"], "true");
assert.strictEqual(englishButton.attributes["aria-pressed"], "false");
assert.strictEqual(elements.speaker.textContent, speakerBefore);
assert.strictEqual(elements.controls.children[0], retryAction, "view switch must preserve the live action and its handler");
current = false;
englishButton.listeners.click();
assert.strictEqual(elements.message.textContent, goal, "stale question controls must not update the next view");
manager.show("Kong", "通常のStory本文");
assert.deepStrictEqual(elements.dialogueBox.children, [elements.speaker, elements.message, elements.recognizedText, elements.controls]);
assert.strictEqual(elements.message.textContent, "通常のStory本文");
assert.strictEqual(elements.dialogueBox.className, "dialogue-box");

const legacy = setup(false);
legacy.manager.showCommunication("ピコ", goal + "\n\n" + support, goal);
legacy.manager.addCommunicationLanguageControls("Existing model English.", goal);
assert.strictEqual(legacy.elements.controls.children.length, 0, "legacy UI must not gain language controls");
assert.strictEqual(legacy.elements.message.parentNode, legacy.elements.dialogueBox);
assert.strictEqual(legacy.elements.dialogueBox.className, "dialogue-box");
legacy.manager.showSpeechStatus("ピコ", goal, "🎤 聞き取り中…");
assert.strictEqual(legacy.elements.recognizedText.textContent, "🎤 聞き取り中…");
assert.strictEqual(legacy.elements.recognizedText.hidden, false);
assert.strictEqual(legacy.elements.controls.children.length, 0);
console.log("dialogue-information-layout.test.js: PASS");
