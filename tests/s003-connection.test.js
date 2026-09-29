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
  "engine/commands/story-commands.js",
  "engine/core/story-registry.js",
  "data/monsters.js",
  "data/camps.js",
  "data/mornings.js",
  "engine/stories/m001.js",
  "engine/stories/S002.js",
  "engine/stories/S003.js",
  "engine/stories/S004.js"
].forEach(load);

const s002 = context.StoryRegistry.get("S002");
const s003 = context.StoryRegistry.get("S003");
const camp = context.CampDatabase.get("CAMP_M002");

assert.strictEqual(s002.nextStoryId, "S003");
assert(s003, "S003 must be registered");
assert.strictEqual(s003.nextStoryId, "S004");
assert(context.StoryRegistry.has("S004"), "S004 must be registered");
assert.deepStrictEqual(Array.from(s003.steps, step => step.type), ["morning", "monsterBattle", "camp"]);
assert.strictEqual(s003.steps[0].morningId, "MORNING_001");
assert.strictEqual(s003.steps[1].monsterId, "m002");
assert.strictEqual(s003.steps[2].campId, "CAMP_M002");
assert.strictEqual(context.StoryRegistry.has("m002"), false, "Monster ID m002 must not become a Story ID");
assert.strictEqual(context.StoryRegistry.get("m001").nextStoryId, "S002");

assert(camp, "CAMP_M002 must be registered");
assert.strictEqual(camp.steps.length, 6);
assert.deepStrictEqual(Array.from(camp.steps, step => step.type), [
  "clear", "background", "filter", "companions", "dialogue", "clear"
]);
assert.strictEqual(camp.steps[4].text, "数字の怪物との戦いを終え、静かな夜が訪れた。");
assert.strictEqual(camp.steps[4].button, "休む");
[1, 2, 3].forEach(number => {
  const pseudo = context.CampDatabase.get(`CAMP_M002_${number}`);
  assert(pseudo, `CAMP_M002_${number} must remain registered`);
  assert.strictEqual(pseudo.steps.length, 1);
  assert.strictEqual(pseudo.steps[0].type, "dialogue");
  assert.strictEqual(pseudo.steps[0].button, "再挑戦");
});

const monster = context.MonsterDatabase.get("m002");
assert.strictEqual(monster.questionId, "word.single-digit-number");
assert.strictEqual(monster.battle.requiredUniqueAnswers, 3);
assert.deepStrictEqual(Array.from(Object.keys(monster.image)), ["normal", "defeated", "attack", "reaction", "purify", "smile"]);
assert.strictEqual(context.MorningDatabase.get("MORNING_001").id, "MORNING_001");

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(index.includes('<script src="engine/stories/S003.js"></script>'));
assert(index.indexOf("engine/stories/S002.js") < index.indexOf("engine/stories/S003.js"));

console.log("S003 connection test: PASS");
