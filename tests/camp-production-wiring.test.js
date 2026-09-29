"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
const flags = {};
let nextResolve = null;

function makeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

const elements = {};
["pico-break-layer", "pico-break-card", "pico-break-title", "pico-break-text", "pico-break-close"].forEach(id => {
  elements[id] = {
    hidden: id === "pico-break-layer",
    textContent: "",
    classList: makeClassList(),
    attributes: {},
    listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; }
  };
});

const dialogueBox = { hidden: true };
const context = {
  console,
  window: {},
  setTimeout,
  clearTimeout,
  Date,
  Math: Object.create(Math),
  Promise,
  Object,
  Array,
  Number,
  String,
  isFinite,
  requestAnimationFrame(callback) { callback(); },
  document: { getElementById(id) { return elements[id]; } },
  GameConfig: {
    dialogueNextLabel: "つぎへ",
    picoBreakRecentLimit: 3
  },
  EffectManager: {
    setBackground(src) { calls.push(["background", src]); },
    setFilter(visible) { calls.push(["filter", visible]); },
    play: async () => {}
  },
  DialogManager: {
    show(speaker, text) {
      dialogueBox.hidden = false;
      calls.push(["dialogue", speaker, text]);
    },
    next(button) {
      calls.push(["waitButton", button]);
      return new Promise(resolve => { nextResolve = resolve; });
    },
    hide() {
      dialogueBox.hidden = true;
      calls.push(["hide"]);
    }
  },
  AudioManager: { playSe() {} },
  SaveManager: {
    getCompanionIds() { return [1, 2]; },
    getData() { return { storyState: {} }; },
    getFlag(key, fallback) {
      return Object.prototype.hasOwnProperty.call(flags, key) ? flags[key] : fallback;
    },
    setFlag(key, value) { flags[key] = JSON.parse(JSON.stringify(value)); }
  },
  CharacterManager: {
    clear() { calls.push(["charactersClear"]); },
    show(items) { calls.push(["characters", items]); },
    addFloatingText(text, className) { calls.push(["floatingText", text, className]); }
  }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

async function flush() {
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}

[
  "data/poses.js",
  "data/characters.js",
  "data/camps.js",
  "data/word-dictionaries.js",
  "data/questions.js",
  "data/monsters.js",
  "engine/services/monster-battle-data.js",
  "data/pico-breaks.js",
  "engine/services/pico-break-store.js",
  "engine/services/pico-break-catalog.js",
  "engine/managers/pico-break-manager.js",
  "engine/managers/camp-manager.js"
].forEach(load);

context.PicoBreakManager.init();

(async () => {
  let resolved = false;
  const pending = context.CampManager.start("CAMP_001").then(result => {
    resolved = true;
    return result;
  });

  await flush();
  assert.strictEqual(calls.at(-1)[1], "休む");
  assert.strictEqual(resolved, false);

  nextResolve();
  const result = await pending;

  assert.strictEqual(context.PicoBreakManager.isActive(), false,
    "CAMP_001 must not run Pico Break");
  assert.strictEqual(elements["pico-break-layer"].hidden, true);
  assert.strictEqual(dialogueBox.hidden, true);
  assert.deepStrictEqual(calls.at(-1), ["hide"]);
  assert.strictEqual(result.status, "completed");
  assert.strictEqual(result.completedSteps, 6);
  assert.strictEqual(context.CampManager.getResult().status, "completed");
  assert.strictEqual(resolved, true);
  assert.deepStrictEqual(calls.filter(call => call[0] === "background"), [["background", "camp"]]);
  assert(!calls.some(call => call.includes("出発")));
  assert(!calls.some(call => call.includes("冒険にもどる")));

  console.log("Camp production wiring test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
