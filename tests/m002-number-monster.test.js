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
load("engine/services/asset-resolver.js");

const monster = context.MonsterDatabase.get("02");
assert(monster, "Monster ID 02 must be registered");
assert.strictEqual(monster.monsterId, "m002");
assert.strictEqual(monster.name, "ナンバー・モンスター");
assert.strictEqual(monster.questionId, "word.single-digit-number");
assert.strictEqual(monster.image.normal, "images/monsters/m002_normal.png?v=user-final-20260816");
assert.strictEqual(monster.image.attack, "images/monsters/m002_attack.png?v=user-final-20260816");
assert.strictEqual(monster.image.reaction, "images/monsters/m002_reaction.png?v=user-final-20260816");
assert.strictEqual(monster.image.purify, "images/monsters/m002_purify.png?v=user-final-20260816");
assert.strictEqual(monster.image.smile, "images/monsters/m002_smile.png?v=user-final-20260816");
assert.strictEqual(monster.image.defeated, monster.image.smile);
assert(monster.battle.guide.includes("1桁の数字"));
assert.strictEqual(monster.battle.requiredUniqueAnswers, 3);

const question = context.QuestionDatabase.get(monster.questionId);
assert(question);
assert.deepStrictEqual(Array.from(context.WordDictionaryDatabase.get("number.single-digit.v1").entries)
  .map(entry => entry.canonical), ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]);
assert(question.answers.includes("one"));
assert(question.answers.includes("nine"));
assert(question.answers.includes("1"));
assert(question.answers.includes("9"));
assert.strictEqual(question.prompt, "知っている1桁の数字を英語で言ってみよう。");
assert(!/say\s+(a\s+)?one[- ]digit|say\s+single[- ]digit|one by one/i.test(question.prompt));

[
  ["one", "1", "one"],
  ["two", "2", "two"],
  ["three", "3", "three"],
  ["four", "4", "four"],
  ["five", "5", "five"],
  ["six", "6", "six"],
  ["seven", "7", "seven"],
  ["eight", "8", "eight"],
  ["nine", "9", "nine"]
].forEach(([word, numeral, canonical]) => {
  assert.strictEqual(context.WordDictionaryDatabase.match("number.single-digit.v1", word), canonical);
  assert.strictEqual(context.WordDictionaryDatabase.match("number.single-digit.v1", numeral), canonical);
});

assert.strictEqual(context.AssetResolver.monster("m002", "normal"), monster.image.normal);
assert.strictEqual(context.AssetResolver.monster("m002", "defeated"), monster.image.defeated);
assert.strictEqual(context.AssetResolver.monster("m002", "attack"), monster.image.attack);
assert.strictEqual(context.AssetResolver.monster("m002", "missing-optional-state"), monster.image.normal,
  "an absent optional state must safely fall back to normal");

const publicApiSource = fs.readFileSync(path.join(root, "engine/managers/question-manager.js"), "utf8");
const apiNames = [...publicApiSource.matchAll(/^\s{4}(start|cancel|getResult|reset):/gm)].map(match => match[1]);
assert.deepStrictEqual(apiNames, ["start", "cancel", "getResult", "reset"]);

const managerSource = fs.readFileSync(path.join(root, "engine/managers/monster-battle-manager.js"), "utf8");
assert(!/m002|number_monster|ナンバー・モンスター/i.test(managerSource),
  "Monster Battle Manager must not contain Monster 02 branches");
assert(!/graphics\.length|image\.length/.test(managerSource),
  "Monster Battle Engine must not depend on graphic count");

console.log("m002 Number Monster test: PASS");
