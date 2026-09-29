"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/word-dictionaries.js");
load("data/questions.js");
load("data/monsters.js");
load("engine/services/monster-battle-data.js");

const monster = context.MonsterDatabase.get("m002");
const canonical = answer => context.MonsterBattleData.canonicalAnswer(monster, answer);

assert.strictEqual(canonical("one"), "one");
assert.strictEqual(canonical("1"), "one");
assert.strictEqual(canonical("two"), "two");
assert.strictEqual(canonical("2"), "two");
assert.strictEqual(canonical("eight"), "eight");
assert.strictEqual(canonical("8"), "eight");
assert.strictEqual(canonical("nine"), "nine");
assert.strictEqual(canonical("9"), "nine");

const oneAnswers = new Set([canonical("one"), canonical("1")]);
assert.strictEqual(oneAnswers.size, 1, "one and 1 must count as one unique answer");
const eightAnswers = new Set([canonical("eight"), canonical("8")]);
assert.strictEqual(eightAnswers.size, 1, "eight and 8 must count as one unique answer");
const threeAnswers = new Set([canonical("1"), canonical("two"), canonical("8")]);
assert.strictEqual(threeAnswers.size, 3, "three different digits must complete the battle");

const question = context.QuestionDatabase.get("word.single-digit-number");
assert.strictEqual(question.prompt, "知っている1桁の数字を英語で言ってみよう。");
assert(!/say one digit|say a one-digit|say single-digit|one by one/i.test(question.prompt));
assert(monster.battle.guide.includes("1桁の数字"));
assert.strictEqual(monster.battle.requiredUniqueAnswers, 3);
assert.strictEqual(context.WordDictionaryDatabase.match("number.single-digit.v1", "4"), "four");
assert.strictEqual(context.WordDictionaryDatabase.match("number.single-digit.v1", "four"), "four");
assert.strictEqual(context.WordDictionaryDatabase.match("season.v1", "4"), "autumn");

console.log("m002 numeral recognition test: PASS");
