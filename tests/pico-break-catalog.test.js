"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { console, Object, Array, Number, String, Math, isFinite };
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../engine/services/pico-break-catalog.js"), "utf8"),
  context
);

const hundredStoryItems = [];
for (let story = 1; story <= 100; story += 1) {
  hundredStoryItems.push({
    id: "PB-100-" + String(story).padStart(3, "0"),
    category: story === 20 ? "english" : "rumor",
    title: "Story " + story,
    text: "Content " + story,
    minStory: story,
    maxStory: story,
    excludeStories: story === 20 ? [20] : [],
    weight: 1,
    once: false
  });
}

assert.strictEqual(context.PicoBreakCatalog.validate(hundredStoryItems).length, 0);
assert.strictEqual(context.PicoBreakCatalog.init(hundredStoryItems), 100);
assert.strictEqual(context.PicoBreakCatalog.size(), 100);
assert.strictEqual(
  context.PicoBreakCatalog.select({ storyId: "S100", category: "rumor" }, { shownIds: {} }, [], () => 0).id,
  "PB-100-100"
);
assert.strictEqual(
  context.PicoBreakCatalog.select({ storyId: "S020", category: "english" }, { shownIds: {} }, [], () => 0),
  null,
  "story exclusions must remain data-driven"
);

const duplicateErrors = context.PicoBreakCatalog.validate([
  { id: "DUP", category: "tip", title: "A", text: "A" },
  { id: "DUP", category: "tip", title: "B", text: "B" }
]);
assert(duplicateErrors.some((error) => error.includes("Duplicate")), "duplicate ids must fail validation");

context.PicoBreakCatalog.init([
  { id: "REPEAT-A", category: "tip", title: "A", text: "A", once: false },
  { id: "REPEAT-B", category: "tip", title: "B", text: "B", once: false },
  { id: "ONCE-DONE", category: "tip", title: "Once", text: "Once", once: true }
]);
const exhausted = context.PicoBreakCatalog.select(
  { storyId: "S100", category: "tip" },
  { shownIds: { "ONCE-DONE": 1 } },
  ["REPEAT-A", "REPEAT-B", "REPEAT-A"],
  () => 0
);
assert.strictEqual(exhausted.id, "REPEAT-B", "history exhaustion must recover without repeating the immediately previous item");
console.log("Pico Break Catalog 100-story test: PASS");
