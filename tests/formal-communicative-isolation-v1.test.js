"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
// Current shared-code/content identity is enforced by the working-tree diff guard.
const {execFileSync} = require("node:child_process");
const baseline = JSON.parse(read("specs/locked-content-baseline.json"));
for (const f of baseline.files.filter(x=>x.path.startsWith("engine/"))) {
 const b=fs.readFileSync(path.join(root,f.path));
 const actual=crypto.createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
 assert.equal(actual,f.git_blob,f.path+" must match Production lock baseline");
}
const index = read("index.html");
const ordered = [
  "data/questions.js?v=mobile-ui-story-polish-v1-1",
  "data/communicative-judge-rules.js?v=s005-registry-instance-fix-v1",
  "engine/services/speech-normalizer.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-recognition-adapter.js?v=iphone-speech-audio-restore-timing-ab-v1&speechResultAudioTrace=iphone-safari-speech-result-audio-route-trace-v1",
  "engine/services/speech-engine.js?v=iphone-speech-audio-restore-timing-ab-v1",
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
  const current = index.indexOf(source.split("?")[0]);
  assert(current > previous, `index dependency order: ${source}`);
  previous = current;
}
assert(!index.includes("dev/communicative-question-manager-playtest.js"));
assert(!index.includes("dev/communicative-judge-pilot.js"));
assert.strictEqual((index.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 3);
assert.strictEqual((index.match(/\?v=iphone-speech-audio-restore-timing-ab-v1/g) || []).length, 3);
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
