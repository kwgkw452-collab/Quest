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

[
  "data/word-dictionaries.js",
  "data/questions.js",
  "data/monsters.js",
  "engine/commands/story-commands.js",
  "engine/core/story-registry.js",
  "engine/stories/m001.js"
].forEach(load);

const dictionary = context.WordDictionaryDatabase.get("fruit.v1");
assert.strictEqual(dictionary.entries.length, 20);
assert.strictEqual(context.WordDictionaryDatabase.match("fruit.v1", "Apple!"), "apple");
assert.strictEqual(context.WordDictionaryDatabase.match("fruit.v1", "apples"), "apple");
assert.strictEqual(context.WordDictionaryDatabase.match("fruit.v1", "I said strawberries."), "strawberry");
assert.strictEqual(context.WordDictionaryDatabase.match("fruit.v1", "water melon"), "watermelon");
assert.strictEqual(context.WordDictionaryDatabase.match("fruit.v1", "unknown"), null);
assert.strictEqual(context.WordDictionaryDatabase.match("fruit.v1", "lemon"), "lemon");
assert.strictEqual(context.WordDictionaryDatabase.match("fruit.v1", "レモン"), "lemon");

const question = context.QuestionDatabase.get("word.fruit");
assert(question.answers.includes("apple"));
assert(question.answers.includes("apples"));
assert.strictEqual(question.prompt, "Say a fruit word!");

const monster = context.MonsterDatabase.get("m001");
assert.strictEqual(monster.questionId, "word.fruit");
assert.strictEqual(monster.battle.dictionaryId, "fruit.v1");
assert.strictEqual(monster.battle.requiredUniqueAnswers, 3);
assert.strictEqual(monster.image.normal, "images/monsters/m001_normal.png?v=user-final-20260816");
assert.strictEqual(monster.image.damage, "images/monsters/m001_damage.png?v=user-final-20260816");
assert.strictEqual(monster.image.explosion, "images/monsters/m001_explosion.png?v=user-final-20260816");
assert.strictEqual(monster.image.fruits, "images/monsters/m001_fruits.png?v=user-final-20260816");
assert.strictEqual(monster.image.defeated, monster.image.fruits);
assert.deepStrictEqual(JSON.parse(JSON.stringify(monster.battle.graphicFlow)), {
  normal: "normal",
  reaction: "damage",
  postReaction: "damage",
  purify: "explosion",
  complete: "fruits",
  reactionMs: 650,
  purifyMs: 1000
});
assert.strictEqual(monster.battle.duplicateMessage, "One more fruit!");
assert.strictEqual(monster.battle.supportMessages.length, 3);
assert(monster.battle.supportMessages[0].includes("ポンコツでごめんね"));
assert.strictEqual(monster.battle.pseudoCampMessages.length, 3);
assert(monster.battle.pseudoCampMessages[0].includes("ネットや辞書"));

const story = context.StoryRegistry.get("m001");
assert(story);
assert.strictEqual(story.id, "m001");
assert.strictEqual(story.steps.filter(step => step.type === "monsterBattle").length, 1);
assert.strictEqual(story.steps.find(step => step.type === "monsterBattle").monsterId, "m001");
assert.strictEqual(story.steps.filter(step => step.type === "camp").length, 1);
assert.strictEqual(story.steps.at(-1).campId, "CAMP_M001");
assert.strictEqual(story.nextStoryId, "S002", "m001 must continue to the approved S002 story");

const allSteps = story.steps.reduce((items, step) => items.concat(
  step.type === "branch" ? Array.from(step.thenSteps || []).concat(Array.from(step.elseSteps || [])) : [step]
), []);
const supported = allSteps.filter(step => step.type === "dialogue" && step.supportText);
assert.strictEqual(supported.length, 3);
assert(supported.every(step => step.supportLabel === undefined || step.supportLabel === "Pico's Support"));
assert(!allSteps.some(step => step.type === "dialogue" && /[ぁ-んァ-ヶ一-龠]/.test(step.text)),
  "normal m001 dialogue must remain English; Japanese belongs in supportText");

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(index.indexOf("data/word-dictionaries.js") < index.indexOf("data/questions.js"));
assert(index.includes("engine/stories/m001.js"));

console.log("m001 Fruit Story test: PASS");
