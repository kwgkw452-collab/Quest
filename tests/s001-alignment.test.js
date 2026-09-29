"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "engine/stories/S001.js"), "utf8");
const opening = fs.readFileSync(path.join(root, "engine/services/opening.js"), "utf8");

assert(index.includes('engine/stories/S002.js'), "product index must load S002");
assert(fs.existsSync(path.join(root, "engine/stories/S002.js")));
assert(!fs.existsSync(path.join(root, "stories/S002.md")));
assert(source.includes('nextStoryId: "m001"'));
assert(!source.includes("accepted:"));
assert(!source.includes("screen-flash"));
assert(!source.includes("monsterBattle"));
assert(source.includes('C.morning("MORNING_001")'));
assert(!opening.includes("eigoDeQuestPlayerName"), "Opening must not maintain a second player-name key");
assert(opening.includes("SaveManager.setPlayerName(name)"));

const context = { console, window: {} };
context.window = context;
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
load("engine/commands/story-commands.js");
load("engine/core/story-compiler.js");
load("engine/core/story-registry.js");
load("engine/stories/S001.js");
const story = context.StoryRegistry.get("S001");
assert.strictEqual(story.nextStoryId, "m001");
assert.deepStrictEqual(Array.from(story.steps.filter(step => step.type === "question"), step => step.questionId), [
  "word.hello", "word.japan", "word.yes"
]);
assert.strictEqual(story.steps.filter(step => step.type === "camp").length, 1);
assert.strictEqual(story.steps.at(-2).campId, "CAMP_001");
assert.strictEqual(story.steps.at(-1).morningId, "MORNING_001");
assert(story.steps.every(step => /^C\./m.test(source) || step.type));

console.log("S001 alignment test: PASS");
