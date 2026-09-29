"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function harness(dataSource) {
  const context = { console, JSON, Object, Array, Number, String, Math: Object.create(Math), isFinite };
  context.window = context;
  vm.createContext(context);
  if (dataSource !== false) vm.runInContext(read("data/lottery-pools.js"), context);
  vm.runInContext(read("engine/services/lottery-engine.js"), context);
  context.LotteryEngine.init(dataSource || context.LotteryPoolData);
  return context;
}

const context = harness();
const engine = context.LotteryEngine;
const poolId = "shopping.fruit.order.v1";

// 1 Pool取得、Sample構造。
const pool = engine.getPool(poolId);
assert(pool);
assert.strictEqual(pool.poolId, poolId);
assert.strictEqual(pool.items.length, 2);

// 2 存在しないPool、3 候補外を選ばない、4 空Pool、5 Filter後0件。
assert.strictEqual(engine.draw("missing.pool").reason, "pool-not-found");
assert(["apple", "banana"].includes(engine.draw(poolId).itemId));
const empty = harness([{ poolId: "empty", items: [] }]);
assert.strictEqual(empty.LotteryEngine.draw("empty").reason, "empty-pool");
assert.strictEqual(engine.draw(poolId, { difficulty: "unknown" }).reason, "no-matching-candidates");
assert.strictEqual(engine.draw(poolId, { promptType: "unknown" }).reason, "no-matching-candidates");

// 6 1候補、7 random=0、8 random=0.999、9 Random source注入。
const appleStarter = engine.draw(poolId, { difficulty: "starter", randomFn: () => 0 });
assert.strictEqual(appleStarter.itemId, "apple");
const bananaStarter = engine.draw(poolId, { difficulty: "starter", randomFn: () => 0.999 });
assert.strictEqual(bananaStarter.itemId, "banana");
let randomCalled = 0;
engine.draw(poolId, { randomFn: () => { randomCalled += 1; return 0; } });
assert.strictEqual(randomCalled, 1);
const one = harness([{
  poolId: "one",
  items: [{
    itemId: "only", conceptId: "only.concept", displayValue: "Only", metadata: {},
    prompts: [{ promptType: "word", difficulty: "starter", expectedUtterance: "Only.", acceptedVariants: ["only"], metadata: {} }]
  }]
}]);
assert.strictEqual(one.LotteryEngine.draw("one", { previousItemId: "only", randomFn: () => 0 }).itemId, "only");

// 10 複数itemの直前重複回避、11 1件では重複許可。
assert.strictEqual(engine.draw(poolId, { difficulty: "starter", previousItemId: "apple", randomFn: () => 0 }).itemId, "banana");
assert.strictEqual(engine.draw(poolId, { difficulty: "starter", previousItemId: "banana", randomFn: () => 0.999 }).itemId, "apple");
assert.strictEqual(one.LotteryEngine.draw("one", { previousItemId: "only" }).status, "selected");

// 12 itemId重複Validation。
const duplicate = JSON.parse(JSON.stringify(pool));
duplicate.items[1].itemId = duplicate.items[0].itemId;
assert(engine.validate([duplicate]).some(error => error.includes("Duplicate lottery itemId")));

// 13～19 結果Field保持。
assert.strictEqual(appleStarter.conceptId, "shopping.fruit.apple.order");
assert.strictEqual(appleStarter.displayValue, "🍎");
assert.strictEqual(appleStarter.promptType, "order");
assert.strictEqual(appleStarter.difficulty, "starter");
assert.strictEqual(appleStarter.expectedUtterance, "Apple, please.");
assert.deepStrictEqual(Array.from(appleStarter.acceptedVariants), ["apple please"]);
assert.strictEqual(appleStarter.metadata.fruit, "apple");
assert.strictEqual(appleStarter.metadata.pattern, "noun-please");

// 20 difficulty Filter、21 promptType Filter。
const appleBasic = engine.draw(poolId, { difficulty: "basic", previousItemId: "banana", randomFn: () => 0 });
assert.strictEqual(appleBasic.difficulty, "basic");
assert.strictEqual(appleBasic.expectedUtterance, "Can I have an apple?");
assert.strictEqual(engine.draw(poolId, { promptType: "order", randomFn: () => 0 }).promptType, "order");

// 22 snapshot、23 Data変更から独立。
const snapshot = engine.snapshot(appleStarter);
assert.deepStrictEqual(JSON.parse(JSON.stringify(snapshot)), JSON.parse(JSON.stringify(appleStarter)));
snapshot.acceptedVariants.push("changed");
snapshot.metadata.fruit = "changed";
const unchanged = engine.draw(poolId, { difficulty: "starter", randomFn: () => 0 });
assert.deepStrictEqual(Array.from(unchanged.acceptedVariants), ["apple please"]);
assert.strictEqual(unchanged.metadata.fruit, "apple");

// 24 displayValueとconceptIdは独立。
const changedDisplay = JSON.parse(JSON.stringify(pool));
changedDisplay.items[0].displayValue = "APPLE IMAGE";
const changedContext = harness([changedDisplay]);
const changedResult = changedContext.LotteryEngine.draw(poolId, { difficulty: "starter", randomFn: () => 0 });
assert.strictEqual(changedResult.displayValue, "APPLE IMAGE");
assert.strictEqual(changedResult.conceptId, "shopping.fruit.apple.order");

// 25 acceptedVariantsは情報であり、Lotteryにjudge APIはない。
assert.strictEqual(typeof engine.judge, "undefined");
assert.strictEqual(typeof engine.match, "undefined");

// 26 重複回避はRandomを1回だけ呼び、Loopしない。
let repeatCalls = 0;
engine.draw(poolId, { previousItemId: "apple", randomFn: () => { repeatCalls += 1; return 0; } });
assert.strictEqual(repeatCalls, 1);

// 27～31 禁止責務への依存なし。
const engineSource = read("engine/services/lottery-engine.js");
[
  "SpeechEngine", "SpeechRecognition", "QuestionManager", "MonsterBattle",
  "AudioManager", "Voice", "fetch(", "XMLHttpRequest", "Gemini", "OpenAI", "Judge"
].forEach(token => assert(!engineSource.includes(token), "Lottery Engine must not depend on " + token));

// Validation必須FieldとconceptId重複許可。
const sameConcept = JSON.parse(JSON.stringify(pool));
sameConcept.items[1].conceptId = sameConcept.items[0].conceptId;
assert.deepStrictEqual(Array.from(engine.validate([sameConcept])), []);
const invalid = JSON.parse(JSON.stringify(pool));
delete invalid.items[0].prompts[0].expectedUtterance;
invalid.items[0].prompts[1].acceptedVariants = "invalid";
assert(engine.validate([invalid]).some(error => error.includes("expectedUtterance")));
assert(engine.validate([invalid]).some(error => error.includes("acceptedVariants")));

// 32～35 既存Dictionary dataを変更せず維持。
const dictionaryContext = { console, window: {} };
dictionaryContext.window = dictionaryContext;
vm.createContext(dictionaryContext);
vm.runInContext(read("data/word-dictionaries.js"), dictionaryContext);
assert.strictEqual(dictionaryContext.WordDictionaryDatabase.match("number.single-digit.v1", "one"), "one");
assert.strictEqual(dictionaryContext.WordDictionaryDatabase.match("number.single-digit.v1", "1"), "one");
assert.strictEqual(dictionaryContext.WordDictionaryDatabase.match("number.single-digit.v1", "eight"), "eight");
assert.strictEqual(dictionaryContext.WordDictionaryDatabase.match("number.single-digit.v1", "8"), "eight");
assert.strictEqual(dictionaryContext.WordDictionaryDatabase.match("fruit.v1", "apples"), "apple");
assert.strictEqual(dictionaryContext.WordDictionaryDatabase.match("season.v1", "fall"), "autumn");

// Question Manager公開APIを維持。S005のみ既存Lotteryを接続。
const questionManager = read("engine/managers/question-manager.js");
assert(/window\.QuestionManager\s*=\s*\{\s*start:\s*start,\s*cancel:\s*cancel,\s*getResult:\s*getResult,\s*reset:\s*reset\s*\}/.test(questionManager));
assert(read("index.html").includes("lottery-engine.js?v=s005-phase-a2-v1"));
assert(read("dev.html").includes("lottery-engine.js?v=s005-phase-a2-v1"));
assert(!read("engine/commands/story-commands.js").includes("lottery"));
assert(!read("engine/core/story-engine.js").includes("LotteryEngine"));

console.log("Lottery Foundation V1.0 tests (37 groups): PASS");
