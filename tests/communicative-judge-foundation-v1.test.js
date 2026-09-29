const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, setTimeout, clearTimeout };
context.window = context;
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }

load("engine/services/speech-normalizer.js");
load("data/word-dictionaries.js");
load("data/communicative-judge-rules.js");
load("engine/services/local-communicative-judge.js");
load("engine/services/communicative-judge.js");

const judge = (input, options) => context.CommunicativeJudge.judge(input, options);
const apple = utterance => ({ conceptId: "shopping.fruit.apple.order", utterance });
const dictionaryRule = (conceptId, dictionaryId, canonical) => [{
  conceptId, variants: [], dictionary: { dictionaryId, canonical }
}];

(async () => {
  assert.strictEqual(context.CommunicativeJudge.validateInput({ utterance: "hello" }), "concept-id-required"); // 1
  assert.strictEqual(context.CommunicativeJudge.validateInput({ conceptId: "x" }), "utterance-required"); // 2
  assert.strictEqual(context.CommunicativeJudge.validateInput(apple("Apple, please.")), null); // 3
  assert.strictEqual((await judge(null)).verdict, "UNKNOWN"); // 4

  const accepted = await judge(apple("Can I have an apple?"));
  assert.strictEqual(accepted.verdict, "ACCEPT"); // 5
  const rejected = await judge(apple("I don't want an apple."));
  assert.strictEqual(rejected.verdict, "REJECT"); // 6
  const unknown = await judge(apple("May I get an apple?"));
  assert.strictEqual(unknown.verdict, "UNKNOWN"); // 7
  assert(context.CommunicativeJudge.verdicts.every(v => ["ACCEPT", "REJECT", "UNKNOWN"].includes(v))); // 8
  assert.strictEqual(accepted.source, "local"); // 9
  assert.strictEqual(accepted.reason, "approved-variant"); // 10
  assert.strictEqual(accepted.normalizedUtterance, "can i have an apple"); // 11
  assert.strictEqual(accepted.matchedVariant, "Can I have an apple?"); // 12
  assert.strictEqual(typeof accepted.retryable, "boolean"); // 13
  assert.strictEqual(accepted.providerTrace, null); // 14
  assert.strictEqual((await judge(apple("An apple, please."))).verdict, "ACCEPT"); // 15
  assert.strictEqual(rejected.reason, "explicit-negative"); // 16
  assert.strictEqual(unknown.verdict, "UNKNOWN"); // 17
  assert.strictEqual((await judge({ conceptId: "unknown.concept", utterance: "hello" })).verdict, "UNKNOWN"); // 18
  assert.strictEqual(unknown.reason, "no-provider"); // 19

  let calls = 0;
  const provider = { async judge() { calls += 1; return { verdict: "REJECT" }; } };
  assert.strictEqual((await judge(apple("Apple, please."), { provider })).verdict, "ACCEPT");
  assert.strictEqual(calls, 0); // 20
  assert.strictEqual((await judge(apple("May I get an apple?"), { provider: { async judge() { return { verdict: "ACCEPT", reason: "semantic-match" }; } } })).verdict, "ACCEPT"); // 21
  assert.strictEqual((await judge(apple("May I get an apple?"), { provider: { async judge() { return { verdict: "REJECT" }; } } })).verdict, "REJECT"); // 22
  assert.strictEqual((await judge(apple("May I get an apple?"), { provider: { async judge() { return { verdict: "UNKNOWN" }; } } })).verdict, "UNKNOWN"); // 23
  const timeout = await judge(apple("May I get an apple?"), { provider: { async judge() { throw new Error("timeout"); } } });
  assert.strictEqual(timeout.verdict, "UNKNOWN");
  assert.strictEqual(timeout.reason, "provider-timeout"); // 24
  const thrown = await judge(apple("May I get an apple?"), { provider: { async judge() { throw new Error("offline"); } } });
  assert.strictEqual(thrown.verdict, "UNKNOWN"); // 25
  assert.strictEqual((await judge(apple("May I get an apple?"), { provider: { async judge() { return { answer: true }; } } })).verdict, "UNKNOWN"); // 26
  assert.notStrictEqual(timeout.verdict, "REJECT");
  assert.notStrictEqual(thrown.verdict, "REJECT"); // 27

  for (const [utterance, variant] of [["eighteen", "eight"], ["someone", "one"], ["yesterday", "yes"], ["10", "1"], ["pineapple", "apple"], ["can't", "can"]]) {
    const value = await judge({ conceptId: "test.exact", utterance, acceptedVariants: [variant] });
    assert.strictEqual(value.verdict, "UNKNOWN", `${utterance} must not match ${variant}`);
  } // 28-33
  assert.notStrictEqual(rejected.verdict, "ACCEPT"); // 34
  assert.strictEqual((await judge(apple("Can I have an apple?"))).verdict, "ACCEPT"); // 35
  assert.strictEqual((await judge(apple("Can I get an apple?"))).verdict, "ACCEPT"); // 36
  assert.strictEqual((await judge(apple("Could I get an apple?"))).verdict, "ACCEPT"); // 37
  assert.strictEqual((await judge(apple("May I get an apple?"))).verdict, "UNKNOWN"); // 38

  assert.strictEqual(context.CommunicativeJudge.validateInput({ conceptId: "x", utterance: "noise", alternatives: ["answer"] }), null); // 39
  assert.strictEqual((await judge({ ...apple("recognition noise"), alternatives: ["Apple, please."] })).verdict, "ACCEPT"); // 40
  const retained = await judge({ ...apple("Apple, please."), difficulty: "starter", context: { promptType: "order" } });
  assert.strictEqual(retained.difficulty, "starter"); // 41
  assert.strictEqual(retained.context.promptType, "order"); // 42
  assert.notStrictEqual(retained.conceptId, retained.matchedVariant); // 43

  function localDictionary(conceptId, dictionaryId, canonical, utterance) {
    return context.LocalCommunicativeJudge.evaluate({ conceptId, utterance }, dictionaryRule(conceptId, dictionaryId, canonical));
  }
  assert.strictEqual(localDictionary("number.1", "number.single-digit.v1", "one", "one").verdict, "ACCEPT");
  assert.strictEqual(localDictionary("number.1", "number.single-digit.v1", "one", "1").verdict, "ACCEPT"); // 44
  assert.strictEqual(localDictionary("number.8", "number.single-digit.v1", "eight", "eight").verdict, "ACCEPT");
  assert.strictEqual(localDictionary("number.8", "number.single-digit.v1", "eight", "8").verdict, "ACCEPT"); // 45
  assert.strictEqual(localDictionary("fruit.apple", "fruit.v1", "apple", "apples").verdict, "ACCEPT"); // 46
  assert.strictEqual(localDictionary("season.autumn", "season.v1", "autumn", "fall").verdict, "ACCEPT"); // 47
  assert(!read("data/word-dictionaries.js").includes("CommunicativeJudge")); // 48

  const serviceSources = read("engine/services/communicative-judge.js") + read("engine/services/local-communicative-judge.js");
  for (const forbidden of ["QuestionManager", "SpeechEngine", "MonsterBattle", "MorningManager", "LotteryEngine", "AudioManager", "VoiceAsset", "StoryEngine", "fetch(", "API_KEY", "Gemini", "OpenAI"]) {
    assert(!serviceSources.includes(forbidden), `Foundation must not depend on ${forbidden}`);
  } // 49-59
  const alternateProvider = { async judge() { return { verdict: "ACCEPT", providerTrace: { provider: "replaceable-test" } }; } };
  assert.strictEqual((await judge(apple("Unlisted expression"), { provider: alternateProvider })).source, "provider"); // 60
  assert(!/while\s*\(\s*true\s*\)/.test(serviceSources)); // 61
  assert(!serviceSources.includes("StoryManager") && !serviceSources.includes("DialogManager")); // 62-63

  const questionApi = read("engine/managers/question-manager.js");
  for (const name of ["start", "cancel", "getResult", "reset"]) assert(questionApi.includes(name + ": " + name)); // 64
  const speechApi = read("engine/services/speech-engine.js");
  for (const name of ["listen", "mission", "judge", "normalize", "includesAny", "stop", "on", "getStatus"]) assert(speechApi.includes(name)); // 65
  assert.strictEqual(context.WordDictionaryDatabase.match("number.single-digit.v1", "8"), "eight"); // 66
  assert(!read("engine/services/lottery-engine.js").includes("CommunicativeJudge")); // 67
  assert.strictEqual(context.LocalCommunicativeJudge.validateRules(context.CommunicativeJudgeRuleData).length, 0); // 68

  const invalidRules = [
    [{ conceptId: "", variants: [] }],
    [{ conceptId: "x", variants: [""] }],
    [{ conceptId: "x", variants: [], difficulty: 1 }],
    [{ conceptId: "x", variants: [], promptType: 1 }],
    [{ conceptId: "x", variants: [], rejects: [{ variants: [] }] }],
    [{ conceptId: "x", variants: [], metadata: [] }]
  ];
  invalidRules.forEach(rules => assert(context.LocalCommunicativeJudge.validateRules(rules).length > 0));

  console.log("Communicative Judge Foundation V1.0 tests (68 checks): PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
