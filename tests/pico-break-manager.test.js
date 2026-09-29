"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

function createHarness(data) {
  const elements = {};
  ["pico-break-layer", "pico-break-card", "pico-break-title", "pico-break-text", "pico-break-close"].forEach((id) => {
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

  let state = { shownIds: {}, lastStoryNumber: 0, recentIds: [] };
  const flags = { picoBreakState: state };
  const context = {
    console,
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
    document: { getElementById(id) { return elements[id]; } },
    requestAnimationFrame(callback) { callback(); },
    GameConfig: {
      picoBreakRandomChance: 0.12,
      picoBreakEveryStories: 4,
      picoBreakApiWaitThresholdMs: 20,
      picoBreakCooldownMs: 0,
      picoBreakRecentLimit: 3
    },
    SaveManager: {
      getData() { return { storyState: {} }; },
      getFlag(key, fallback) { return Object.prototype.hasOwnProperty.call(flags, key) ? flags[key] : fallback; },
      setFlag(key, value) {
        flags[key] = JSON.parse(JSON.stringify(value));
        if (key === "picoBreakState") state = flags[key];
      }
    },
    PicoBreakData: data
  };
  context.window = context;
  vm.createContext(context);
  [
    "engine/services/pico-break-store.js",
    "engine/services/pico-break-catalog.js",
    "engine/managers/pico-break-manager.js"
  ].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  });
  context.PicoBreakManager.init();
  return { manager: context.PicoBreakManager, elements, getState: () => state, context };
}

async function testApiTiming() {
  const waitItem = [{ id: "WAIT", category: "wait", title: "wait", text: "wait", once: false }];

  let h = createHarness(waitItem);
  const fastResult = await h.manager.during(() => delay(5).then(() => "fast"), { storyId: "S001", thresholdMs: 20 });
  assert.strictEqual(fastResult, "fast");
  assert.strictEqual(h.manager.isActive(), false, "fast API must not show Pico Break");

  h = createHarness(waitItem);
  const slow = h.manager.during(() => delay(45).then(() => "slow"), { storyId: "S001", thresholdMs: 20 });
  await delay(28);
  assert.strictEqual(h.manager.isActive(), true, "slow API must show wait Pico Break");
  assert.strictEqual(await slow, "slow");
  assert.strictEqual(h.manager.isActive(), false, "API completion must close its wait Pico Break");
}

async function testStory20AndOnce() {
  const h = createHarness([
    { id: "EN", category: "english", title: "English", text: "English", excludeStories: [20], once: false },
    { id: "RUMOR", category: "rumor", title: "Rumor", text: "Rumor", once: false },
    { id: "ONCE", category: "foreshadow", title: "Once", text: "Once", once: true }
  ]);

  assert.notStrictEqual(h.manager.select({ storyId: "S020" }).id, "EN", "story 20 must exclude English category");
  const first = h.manager.forced("ONCE", { storyId: "S003" });
  assert.strictEqual(h.manager.isActive(), true, "forced item must display regardless of probability");
  h.manager.close();
  assert.strictEqual(await first, true);
  assert.strictEqual(await h.manager.forced("ONCE", { storyId: "S003" }), false, "once item must not display twice");
}

async function testIntervalRecentAndCollision() {
  const h = createHarness([
    { id: "WAIT", category: "wait", title: "Wait", text: "Wait", once: false },
    { id: "TIP", category: "tip", title: "Tip", text: "Tip", once: false }
  ]);

  const interval = h.manager.maybeInterval({ storyId: "S004", every: 4, category: "tip" });
  assert.strictEqual(h.manager.isActive(), true, "fourth story must trigger interval item");
  h.manager.close();
  await interval;
  assert.deepStrictEqual(Array.from(h.getState().recentIds), ["TIP"], "recent history must be persisted");
  assert.strictEqual(await h.manager.maybeInterval({ storyId: "S004", every: 4, category: "tip" }), false, "same story must not trigger interval twice");

  const manual = h.manager.showSelected({ storyId: "S005", category: "tip", allowRecent: true });
  assert.strictEqual(h.manager.isActive(), true);
  const api = h.manager.during(() => delay(40), { storyId: "S005", thresholdMs: 10 });
  await delay(18);
  await api;
  assert.strictEqual(h.manager.isActive(), true, "API completion must not close an unrelated Pico Break");
  h.manager.close();
  await manual;
}

async function testAutoAndOnOff() {
  const h = createHarness([
    { id: "WAIT", category: "wait", title: "Wait", text: "Wait", once: false },
    { id: "TIP", category: "tip", title: "Tip", text: "Tip", once: false }
  ]);
  h.context.Math.random = () => 0;

  const auto = h.manager.evaluate({ storyId: "S004", every: 4 });
  assert.strictEqual(h.manager.isActive(), true, "PICO_BREAK must run Manager interval judgment");
  assert.strictEqual(h.elements["pico-break-card"].attributes["data-category"], "tip", "normal judgment must exclude wait-only content");
  h.manager.close();
  assert.strictEqual(await auto, true);

  h.manager.setEnabled(false);
  assert.strictEqual(h.manager.isEnabled(), false);
  assert.strictEqual(await h.manager.forced("TIP", { storyId: "S005" }), false, "OFF must block even forced display");
  h.manager.setEnabled(true);
  assert.strictEqual(h.manager.isEnabled(), true);
}

async function testCloseThenImmediateReopen() {
  const h = createHarness([
    { id: "TIP", category: "tip", title: "Tip", text: "Tip", once: false }
  ]);
  const first = h.manager.showSelected({ storyId: "S001", category: "tip", allowRecent: true });
  h.manager.close();
  await first;
  const second = h.manager.showSelected({ storyId: "S003", category: "tip", allowRecent: true });
  await delay(220);
  assert.strictEqual(h.manager.isActive(), true);
  assert.strictEqual(h.elements["pico-break-layer"].hidden, false, "old close timer must not hide a new Pico Break");
  h.manager.close();
  await second;
}

(async function run() {
  await testApiTiming();
  await testStory20AndOnce();
  await testIntervalRecentAndCollision();
  await testAutoAndOnOff();
  await testCloseThenImmediateReopen();
  console.log("Pico Break tests: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
