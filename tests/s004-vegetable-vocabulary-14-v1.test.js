"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {}, Object, Array, String, RegExp };
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/word-dictionaries.js");
load("data/questions.js");

const expected = [
  "onion", "potato", "tomato", "corn", "cabbage", "carrot",
  "radish", "celery", "eggplant", "parsley", "cucumber", "lettuce", "broccoli", "pumpkin"
];
const existing = expected.slice(0, 6);
const added = expected.slice(6);
const dictionary = context.WordDictionaryDatabase.get("cooking.vegetable.v1");
const canonicals = Array.from(dictionary.entries, entry => entry.canonical);

assert.deepStrictEqual(canonicals, expected);
assert.strictEqual(new Set(canonicals).size, 14, "canonical words must be unique");

const aliases = dictionary.entries.flatMap(entry => Array.from(entry.aliases));
assert.strictEqual(new Set(aliases).size, aliases.length, "aliases must not collide");

const question = context.QuestionDatabase.get("cooking.vegetable");
existing.concat(added).forEach(word => {
  assert(question.answers.includes(word), word + " must remain accepted");
  assert.strictEqual(context.WordDictionaryDatabase.match("cooking.vegetable.v1", word), word);
});

["apple", "banana", "peach", "meat", "beef", "pork", "chicken"].forEach(word => {
  assert.strictEqual(context.WordDictionaryDatabase.match("cooking.vegetable.v1", word), null,
    word + " must not be accepted as a vegetable");
});

assert.strictEqual(question.prompt, "次は野菜を入れよう！\n知っている野菜を英語で言ってみよう！");
console.log("S004 vegetable vocabulary 14 V1 test: PASS");
