"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function button() {
  return {
    disabled: false,
    handlers: {},
    addEventListener(name, handler) { this.handlers[name] = handler; }
  };
}

const elements = {
  "pico-break-demo-now": button(),
  "pico-break-demo-wait": button(),
  "pico-break-demo-20": button(),
  "pico-break-demo-status": { textContent: "" }
};
let readyHandler = null;
const calls = [];
const context = {
  console,
  Promise,
  setTimeout,
  clearTimeout,
  document: { getElementById(id) { return elements[id] || null; } },
  SceneManager: { getCurrentStoryId() { return "S001"; } },
  PicoBreakManager: {
    showSelected(options) { calls.push(["showSelected", options]); return Promise.resolve(true); },
    during(factory, options) { calls.push(["during", options]); return factory(); },
    select(options) { calls.push(["select", options]); return null; }
  }
};
context.window = context;
context.addEventListener = function (name, handler) { if (name === "DOMContentLoaded") readyHandler = handler; };
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../js/pico-break-demo.js"), "utf8"),
  context
);

assert(readyHandler, "demo must bind at DOMContentLoaded");
readyHandler();
assert(elements["pico-break-demo-now"].handlers.click, "immediate demo button must be active");
assert(elements["pico-break-demo-wait"].handlers.click, "API wait demo button must be active");
assert(elements["pico-break-demo-20"].handlers.click, "story 20 demo button must be active");

elements["pico-break-demo-now"].handlers.click();
assert.strictEqual(calls[0][0], "showSelected");
assert.strictEqual(calls[0][1].category, "tip");

elements["pico-break-demo-20"].handlers.click();
assert(calls.some((call) => call[0] === "select" && call[1].storyId === "S020" && call[1].category === "english"));
assert(elements["pico-break-demo-status"].textContent.includes("合格"));
console.log("Pico Break demo wiring test: PASS");
