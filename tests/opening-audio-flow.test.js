"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}
class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.classList = new ClassList();
    this.value = "";
    this.paused = true;
  }
  set className(value) { value.split(/\s+/).filter(Boolean).forEach(item => this.classList.add(item)); }
  set innerHTML(value) { if (value === "") this.children = []; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  dispatchEvent(event) { if (this.listeners[event.type]) this.listeners[event.type](event); }
  click() { this.dispatchEvent({ type: "click" }); }
  focus() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const layer = new Element("div");
const calls = [];
const context = {
  console,
  Promise,
  document: {
    createElement(tag) { return new Element(tag); },
    getElementById(id) { assert.strictEqual(id, "opening-layer"); return layer; }
  },
  SaveManager: { setPlayerName(name) { calls.push(["name", name]); } },
  AudioManager: { playBgm(key, options) { calls.push(["bgm", key, options]); } },
  AssetManager: { video() { return "video/opening.mp4"; } }
};
context.window = context;
context.setTimeout = callback => callback();
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/services/opening.js"), "utf8"), context);

function find(predicate, node = layer) {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const match = find(predicate, child);
    if (match) return match;
  }
  return null;
}
async function tick() { await Promise.resolve(); await Promise.resolve(); }

(async () => {
  const result = context.Opening.start();
  await tick();
  const video = find(node => node.tagName === "video");
  assert(video, "Opening video must be shown first");
  assert.strictEqual(calls.some(call => call[0] === "bgm"), false, "BGM must not play during video");

  video.dispatchEvent({ type: "ended" });
  await tick();
  const input = find(node => node.tagName === "input");
  const nameButton = find(node => node.textContent === "この名前にする");
  input.value = "AudioTest";
  nameButton.click();
  await tick();
  assert.deepStrictEqual(calls[0], ["name", "AudioTest"]);
  assert.strictEqual(calls[1][0], "bgm");
  assert.strictEqual(calls[1][1], "zephyrFields");
  assert.strictEqual(calls[1][2].volume, 0.23);
  assert(find(node => node.textContent === "🌟 たいせつな お約束"), "Disclaimer must follow name registration");

  find(node => node.textContent === "冒険を始める").click();
  assert.strictEqual(await result, "AudioTest");
  assert(layer.classList.contains("hidden"));
  console.log("Opening Audio Phase 1 flow test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
