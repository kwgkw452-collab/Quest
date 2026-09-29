"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }

load("data/word-dictionaries.js");
load("data/questions.js");
load("engine/commands/story-commands.js");
load("engine/core/story-registry.js");
load("engine/stories/S004.js");

const meat = context.QuestionDatabase.get("cooking.meat");
const vegetable = context.QuestionDatabase.get("cooking.vegetable");
const fruit = context.QuestionDatabase.get("cooking.fruit");
["meat", "beef", "pork", "chicken"].forEach(word => assert(meat.answers.includes(word)));
["onion", "potato", "tomato", "corn", "cabbage", "carrot"].forEach(word => assert(vegetable.answers.includes(word)));
["banana", "orange", "grape", "peach"].forEach(word => assert(fruit.answers.includes(word)));
assert.strictEqual(meat.hint, "beef");
assert.strictEqual(vegetable.hint, "onion");
assert.strictEqual(fruit.hint, "peach");

const story = context.StoryRegistry.get("S004");
const questions = story.steps.filter(step => step.type === "question");
const cooking = questions.filter(step => /^cooking\./.test(step.questionId));
assert.deepStrictEqual(Array.from(cooking, step => step.questionId), ["cooking.meat", "cooking.vegetable", "cooking.fruit"]);
assert.deepStrictEqual(Array.from(cooking, step => step.supportMessages.length), [3, 3, 3]);
assert(cooking[0].supportMessages[2].includes("beef（ビーフ）"));
assert(cooking[1].supportMessages[2].includes("onion（オニオン・玉ねぎ）"));
assert(cooking[2].supportMessages[2].includes("peach（ピーチ・もも）"));
assert(!/apple|melon|lemon/i.test(cooking[2].supportMessages[2]));

const sequence = story.steps.filter(step => step.type === "question" || step.type === "item").map(step => step.questionId || step.src);
const expected = [
  "s004FryingPan01", "cooking.meat", "s004FryingPan02", "cooking.vegetable",
  "s004FryingPan03", "cooking.fruit", "s004FryingPan04"
];
let position = -1;
expected.forEach(value => {
  position = sequence.indexOf(value, position + 1);
  assert(position >= 0, `missing cooking sequence entry: ${value}`);
});

console.log("S004 cooking category flow test: PASS");
