"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

class Element {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.textContent = "";
    this.className = "";
    this.listeners = {};
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    };
  }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  click() { if (this.listeners.click) this.listeners.click(); }
  querySelector(selector) {
    const match = selector.match(/^\[data-id="(.+)"\]$/);
    return match ? this.children.find(child => child.dataset.id === match[1]) || null : null;
  }
  set innerHTML(value) { if (value === "") this.children = []; }
  get innerHTML() { return ""; }
}

const storage = new Map();
const elements = {
  scene: new Element("section"), background: new Element("div"), blueFilter: new Element("div"),
  characterLayer: new Element("div"), dialogueBox: new Element("div"), speaker: new Element("div"),
  message: new Element("div"), recognizedText: new Element("div"), controls: new Element("div")
};
const context = {
  console, window: {}, document: { createElement: tag => new Element(tag) },
  GameConfig: { dialogueNextLabel: "次へ", initialStoryId: "S001", recognizedPrefix: "" },
  localStorage: {
    setItem(key, value) { storage.set(key, value); }, getItem(key) { return storage.get(key) || null; },
    removeItem(key) { storage.delete(key); }
  },
  AudioManager: { playSe() {} }, MonsterBattleData: null, MonsterDatabase: null,
  setTimeout, clearTimeout, Date, Math, Promise, Object, Array, Number, String, isFinite
};
context.window = context;
context.window.addEventListener = () => {};
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
[
  "data/poses.js", "data/characters.js", "data/backgrounds.js", "data/camps.js", "engine/services/asset-resolver.js",
  "engine/managers/character-manager.js", "engine/managers/dialog-manager.js", "engine/managers/effect-manager.js",
  "engine/managers/save-manager.js", "engine/managers/camp-manager.js"
].forEach(load);

context.CharacterManager.init(elements.characterLayer);
context.DialogManager.init(elements);
context.EffectManager.init(elements);
context.SaveManager.reset();
context.SaveManager.addCompanion(1);
context.SaveManager.addCompanion(2);
context.CharacterManager.show([{ id: "story-kong", character: "kong", pose: "normal", className: "pos-center-low" }]);

async function flush() {
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}

(async () => {
  let resolved = false;
  const pending = context.CampManager.start("CAMP_001").then(result => { resolved = true; return result; });
  await flush();

  assert.strictEqual(resolved, false, "Camp must wait for the production Rest button");
  assert.strictEqual(elements.characterLayer.querySelector('[data-id="story-kong"]'), null,
    "the Story-position Kong must be cleared at normal Camp start");
  const images = elements.characterLayer.children.filter(child => child.tagName === "IMG");
  const floating = elements.characterLayer.children.filter(child => child.tagName === "DIV");
  assert.strictEqual(images.length, 2);
  const picoImage = images.find(image => image.dataset.id === "camp-character-1");
  const kongImage = images.find(image => image.dataset.id === "camp-character-2");
  assert(picoImage && /pico_01\.png$/.test(picoImage.src),
    "Pico must use the existing awake default pose through Character Data");
  assert(kongImage && /kong_08\.png$/.test(kongImage.src),
    "Kong must keep the inactive sleeping pose through Character Data");
  assert.strictEqual(floating.length, 1, "Pico must not receive Zzz and Kong must receive it");
  assert.strictEqual(elements.blueFilter.hidden, false);
  assert(elements.background.style.backgroundImage.includes("bg_camp.png"));
  assert.strictEqual(elements.controls.children.length, 1);
  assert.strictEqual(elements.controls.children[0].textContent, "休む");

  elements.controls.children[0].click();
  const result = await pending;
  assert.strictEqual(result.status, "completed");
  assert.strictEqual(context.CampManager.getResult().status, "completed");
  assert.strictEqual(elements.characterLayer.children.length, 0, "Camp characters and Zzz must be cleaned up");
  assert.strictEqual(elements.dialogueBox.hidden, true);
  assert.strictEqual(elements.blueFilter.hidden, true);

  console.log("Camp production DOM test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
