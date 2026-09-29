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
load("data/camps.js");
load("engine/services/monster-battle-data.js");
load("engine/services/asset-resolver.js");

const monsters = context.MonsterDatabase.all();
assert.deepStrictEqual(Array.from(monsters, monster => monster.monsterId), ["m001", "m002", "m003"]);

const monster = context.MonsterDatabase.get("03");
assert(monster, "Monster ID 03 must be registered");
assert.strictEqual(monster.monsterId, "m003");
assert.strictEqual(monster.name, "シーズン・ツリー");
assert.strictEqual(monster.questionId, "word.season");
assert.strictEqual(monster.encyclopedia.englishName, "Season Tree");
assert.strictEqual(monster.battle.requiredUniqueAnswers, 4);
assert.strictEqual(monster.battle.dictionaryId, "season.v1");
assert.strictEqual(monster.image.normal, "images/monsters/season_tree_03.png");
assert.strictEqual(monster.image.reaction, "images/monsters/season_tree_hit.png");
assert.strictEqual(monster.image.restored, "images/monsters/season_tree_02.png");
assert.strictEqual(monster.image.defeated, monster.image.restored);

[monster.image.normal, monster.image.reaction, monster.image.restored].forEach(image => {
  assert(fs.existsSync(path.join(root, image)), "Season Tree image must exist: " + image);
});

const question = context.QuestionDatabase.get("word.season");
assert(question);
assert.strictEqual(question.prompt, "知っている季節の英語を1つ言ってみよう！");
assert.deepStrictEqual(Array.from(context.WordDictionaryDatabase.get("season.v1").entries, entry => entry.canonical),
  ["spring", "summer", "autumn", "winter"]);
assert.strictEqual(context.WordDictionaryDatabase.match("season.v1", "spring"), "spring");
assert.strictEqual(context.WordDictionaryDatabase.match("season.v1", "summer"), "summer");
assert.strictEqual(context.WordDictionaryDatabase.match("season.v1", "fall"), "autumn");
assert.strictEqual(context.WordDictionaryDatabase.match("season.v1", "autumn"), "autumn");
['fool', '4', 'four', 'pull', 'phone', 'forward', 'full', 'cold'].forEach(answer => {
  assert.strictEqual(context.WordDictionaryDatabase.match("season.v1", answer), "autumn");
});
assert.strictEqual(context.WordDictionaryDatabase.match("season.v1", "winter"), "winter");
assert.strictEqual(new Set(["spring", "summer", "fall", "autumn"].map(answer =>
  context.WordDictionaryDatabase.match("season.v1", answer))).size, 3,
  "fall and autumn must count as the same season");

assert.deepStrictEqual(Array.from(monster.campIds), ["CAMP_M003_1", "CAMP_M003_2", "CAMP_M003_3"]);
monster.campIds.forEach(id => assert(context.CampDatabase.has(id), "Pseudo Camp must exist: " + id));
assert.strictEqual(context.MonsterBattleData.getHint(monster, 1), "春・夏・秋・冬を英語で考えてみよう！");
assert.strictEqual(context.MonsterBattleData.getHint(monster, 2), "『春』は s... から始まるよ！");
assert.strictEqual(context.MonsterBattleData.getHint(monster, 3), "例えば、春は spring だよ！");

const stories = fs.readdirSync(path.join(root, "engine/stories")).filter(name => name.endsWith(".js"));
stories.forEach(file => {
  const source = fs.readFileSync(path.join(root, "engine/stories", file), "utf8");
  const connections = source.match(/monsterBattle\s*\(\s*["']m003["']/g) || [];
  assert.strictEqual(connections.length, file === "S004.js" ? 1 : 0,
    "m003 must be connected exactly once, from S004 only: " + file);
  assert(!source.includes("candidate-007"), "Runtime must not use the Monster Library key: " + file);
});

const managerSource = fs.readFileSync(path.join(root, "engine/managers/monster-battle-manager.js"), "utf8");
assert(!/m003|season[_ -]?tree|シーズン・ツリー/i.test(managerSource),
  "Monster Battle Manager must not contain Season Tree branches");

console.log("m003 Season Tree test: PASS");
