"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const protectedHashes = {
  "data/monsters.js": "af1afabcf11f4536eacb69b8370c465273b1b9adce8e98b94b69bac4e38b8073",
  "data/mornings.js": "89007415f111ab883dd2a10b47e9a7026608bfd377dd8ee1ec7ad0f5d9027470",
  "data/word-dictionaries.js": "8c8c49386c8bd935cbb40d1f067441f3f032f423a579c8193d3b95d167d68d89",
  "dev.html": "552a680d562ffc47ae12986df561cb1dbde9c77b1723412b83a9a845483ab678",
  "dev/communicative-question-manager-playtest.js": "1cce50bfddfa360319fdd335333ccd785f30dac5d0f255dc626860f2ade0f87e",
  "engine/commands/story-commands.js": "d51dff6ca978d9f7df844448048302949f0b5d5c412badce98d67686f173b3e0",
  "engine/managers/monster-battle-manager.js": "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3",
  "engine/managers/morning-manager.js": "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856",
  "engine/services/communicative-judge.js": "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04"
};

// The Adapter hash is checked separately to keep the full expected value readable.
protectedHashes["engine/services/communicative-question-adapter.js"] = "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f";
Object.assign(protectedHashes, {
  "engine/services/local-communicative-judge.js": "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58",
  "engine/services/speech-engine.js": "3318e03a55a2506fccfeca2481d0b286e69074c63f5539d73b1b5b27e6371264",
  "engine/services/speech-normalizer.js": "c891131b3fc76dafa87f4500e2f5913eb0d2d4d1ee94ae7350a5b2e6a6f61e6f",
  "engine/services/speech-recognition-adapter.js": "1261497515055b11c6caa0d26eb8773d848d656bc17ba7a5c9f7b53798b365ad",
  "engine/services/speech-start-controller.js": "73ea61ec3cc4a2532b220f298d2e48d8e66d03fac9901cbf4662bc89c65a883b",
  "engine/stories/S001.js": "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1",
  "engine/stories/S002.js": "bd05226b3e51d12a27e1504579f69cd97200231a68edecd8a8d6e6b2e7aaf525",
  "engine/stories/S003.js": "e532ff803cf57398d0cd457ba118a9ec004d484af27a77e6fce81dc5da5c991c",
  "engine/stories/S004.js": "ca801b7658fe1bddf98cf8c21ee1794adf602b68afa5a7f94599758fb3437070",
  "engine/stories/m001.js": "187c5139107ab8c6f8a35a758d4bc3976f164fe161dccb341926778456fa6e2a",
  "engine/stories/story-saki-departure.js": "a1378627be33f2c4b4b9c23fcc19423f4f69b91f304579cdad785dfb60d68d6d"
});

for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.strictEqual(hash(file), expected, `${file} must remain unchanged`);
}

const index = read("index.html");
const ordered = [
  "data/questions.js?v=mobile-ui-story-polish-v1-1",
  "data/communicative-judge-rules.js?v=s005-registry-instance-fix-v1",
  "engine/services/speech-normalizer.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-recognition-adapter.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-engine.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-start-controller.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/local-communicative-judge.js?v=s005-rule-real-browser-trace-v1",
  "engine/services/communicative-judge.js?v=s005-rule-real-browser-trace-v1",
  "engine/services/communicative-question-adapter.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/managers/dialog-manager.js?v=mobile-ui-story-polish-v1-1",
  "engine/managers/question-manager.js?v=s005-rule-real-browser-trace-v1",
  "engine/presenters/communicative-question-presenter.js?v=mobile-ui-story-polish-v1-1",
  "engine/controllers/communicative-question-flow-controller.js?v=s005-phase-a2-v1",
  "engine/core/core.js?v=finite-rescue-runtime-wiring-v1",
  "engine/commands/story-commands.js",
  "engine/core/story-engine.js?v=adventure-return-fix-v1"
];
let previous = -1;
for (const source of ordered) {
  const current = index.indexOf(source);
  assert(current > previous, `index dependency order: ${source}`);
  previous = current;
}
assert(!index.includes("dev/communicative-question-manager-playtest.js"));
assert(!index.includes("dev/communicative-judge-pilot.js"));
assert.strictEqual((index.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 5);
assert.strictEqual((index.match(/\?v=communicative-formal-late-result-v1/g) || []).length, 0);
assert.strictEqual((index.match(/\?v=communicative-formal-speech-fallback-v1/g) || []).length, 0);
assert(!index.includes("engine/managers/question-manager.js?v=communicative-formal-v1"));

const productionSources = [
  "data/questions.js", "data/communicative-judge-rules.js", "engine/managers/question-manager.js",
  "engine/presenters/communicative-question-presenter.js", "engine/controllers/communicative-question-flow-controller.js",
  "engine/core/story-engine.js", "index.html"
].map(read).join("\n");
for (const forbidden of ["fetch(", "XMLHttpRequest", "API_KEY", "Gemini", "OpenAI", "GrowingDictionary", "localStorage"]) {
  assert(!productionSources.includes(forbidden), `No formal implementation dependency: ${forbidden}`);
}

const context = {
  console, window: {}, GameConfig: { dialogueNextLabel: "next" }, StoryEvents: { async emit() {} },
  GameCore: { clearVisuals() {} }, EffectManager: {}, CharacterManager: {}, MonsterManager: {},
  DialogManager: { show() {}, async next() {} }, AudioManager: {}, VideoManager: {}, SaveManager: {},
  PicoBreakManager: {}, CampManager: {}, MorningManager: {}, MonsterBattleManager: {}
};
context.window = context;
let formalCalls = 0;
let legacyCalls = 0;
const legacyResults = [{ status: "failure" }, { status: "success" }];
context.QuestionManager = { async start() { legacyCalls += 1; return legacyResults.shift(); } };
context.CommunicativeQuestionFlowController = {
  async start(id) { formalCalls += 1; return { questionId: id, judgeMode: "communicative", status: "continued", resolution: "continue" }; }
};
vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }
load("engine/services/speech-normalizer.js");
load("data/word-dictionaries.js");
load("data/questions.js");
load("engine/commands/story-commands.js");
load("engine/core/story-engine.js");

(async () => {
  const formalState = {};
  await context.StoryEngine.runStep({ type: "question", questionId: "phrase.are_you_ok", saveAs: "formal" }, formalState, 0, { id: "test" });
  assert.strictEqual(formalCalls, 1);
  assert.strictEqual(legacyCalls, 0);
  assert.strictEqual(formalState.formal.status, "continued");
  assert.strictEqual(formalState.formal.resolution, "continue");

  const legacyState = {};
  await context.StoryEngine.runStep({ type: "question", questionId: "word.hello", saveAs: "legacy" }, legacyState, 1, { id: "test" });
  assert.strictEqual(formalCalls, 1);
  assert.strictEqual(legacyCalls, 2, "Legacy do/while must remain active until success");
  assert.strictEqual(legacyState.legacy.status, "success");

  const monsterSource = read("data/monsters.js");
  for (const id of ["word.fruit", "word.single-digit-number", "word.season"]) {
    assert(monsterSource.includes(`questionId: "${id}"`));
    assert.strictEqual(context.QuestionDatabase.get(id).communicative, undefined);
  }
  assert(!read("engine/managers/monster-battle-manager.js").includes("CommunicativeJudge"));
  assert(!read("engine/managers/morning-manager.js").includes("CommunicativeJudge"));
  assert.deepStrictEqual(Object.keys(context.StoryEngine).sort(), ["play", "playById", "register", "runStep", "runSteps", "validate", "valueOf"].sort());
  console.log("Formal Communicative Isolation V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
