const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
function treeHash(directory) {
  const files = [];
  function visit(relative) {
    for (const name of fs.readdirSync(path.join(root, relative)).sort()) {
      const next = path.join(relative, name);
      if (fs.statSync(path.join(root, next)).isDirectory()) visit(next);
      else files.push(next);
    }
  }
  visit(directory);
  const digest = crypto.createHash("sha256");
  for (const file of files) digest.update(file).update("\0").update(fs.readFileSync(path.join(root, file))).update("\0");
  return digest.digest("hex");
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

let checks = 0;
function ok(value, message) { assert(value, message); checks += 1; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function same(actual, expected, message) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message);
  checks += 1;
}

const nodes = [];
const scene = { id: "scene", children: [], appendChild(node) { this.children.push(node); } };
const document = {
  createElement(tag) {
    const node = {
      tag, children: [], style: {}, hidden: false, disabled: false, textContent: "", value: "",
      appendChild(child) { this.children.push(child); },
      addEventListener(name, listener) { this[name] = listener; }
    };
    nodes.push(node);
    return node;
  },
  getElementById(id) {
    if (id === "scene") return scene;
    return nodes.find(node => node.id === id) || null;
  }
};

const speechQueue = [];
let speechStarts = 0;
let speechCancels = 0;
let legacyCalls = 0;
const context = {
  console, setTimeout, clearTimeout, document,
  GameConfig: { defaultLanguage: "en-US" },
  AudioManager: { stopAll() {} },
  GameCore: {
    async speechMission() { legacyCalls += 1; return "hello"; }
  },
  SpeechEngine: {
    supported: true, getStatus: () => "idle", stop() {},
    listen(options) {
      const plan = speechQueue.shift();
      if (!plan) throw new Error("missing-speech-plan");
      speechStarts += 1;
      return plan(options);
    }
  },
  SpeechStartController: {
    async prepare() {},
    startListening(options) {
      const plan = speechQueue.shift();
      if (!plan) throw new Error("missing-speech-plan");
      speechStarts += 1;
      return plan(options);
    },
    cancel() { speechCancels += 1; }
  }
};
context.window = context;
context.addEventListener = () => {};
vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }
for (const file of [
  "engine/services/speech-normalizer.js",
  "data/word-dictionaries.js",
  "data/questions.js",
  "data/communicative-judge-rules.js",
  "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js",
  "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js",
  "dev/communicative-question-manager-playtest.js"
]) load(file);

const source = read("dev/communicative-question-manager-playtest.js");
const devHtml = read("dev.html");
const indexHtml = read("index.html");
const questionSource = read("data/questions.js");
const questionDefinitionHash = crypto.createHash("sha256")
  .update(questionSource.slice(questionSource.indexOf("  register({"))).digest("hex");

function queueSpeech(transcript, alternatives) {
  speechQueue.push(async options => {
    if (typeof options.onAlternatives === "function") options.onAlternatives(alternatives || []);
    return transcript;
  });
}
function queueSpeechError(message) {
  speechQueue.push(async () => { throw new Error(message); });
}
function queueDeferredSpeech(pending, transcript, alternatives) {
  speechQueue.push(async options => {
    await pending.promise;
    if (typeof options.onAlternatives === "function") options.onAlternatives(alternatives || []);
    return transcript;
  });
}
function field(label) {
  const row = nodes.find(node => node.children && node.children[0] && node.children[0].textContent === `${label}: `);
  return row && row.children[1];
}

(async () => {
  const productQuestions = context.QuestionDatabase.all();
  equal(productQuestions.length, 21, "Product Question Database starts with 21 Questions");
  equal(productQuestions.filter(question => question.communicative).length, 1, "Only phrase.are_you_ok is formally Communicative");
  equal(productQuestions.filter(question => !question.communicative).length, 20, "The other 20 product Questions remain Legacy");
  equal(questionDefinitionHash, "03287599209d890b0764f7f2423c695f6ca3d49a30e6275b29daab100513ddbf",
    "The 21 Question definition block matches Formal V1");
  ok(!questionSource.includes("dev.communicative.apple-order.playtest"), "Playtest Question is absent from product data");

  context.CommunicativeQuestionManagerPlaytest.show();
  const playtestId = context.CommunicativeQuestionManagerPlaytest.questionId;
  const playtestQuestion = context.QuestionDatabase.get(playtestId);
  equal(context.QuestionDatabase.all().length, 22, "Only the dev VM receives one Playtest Question");
  equal(playtestQuestion.communicative.conceptId, "shopping.fruit.apple.order");
  equal(playtestQuestion.communicative.expectedUtterance, "Apple, please.");
  ok(document.getElementById("communicative-question-manager-playtest"), "Independent Playtest panel is created");
  ok(document.getElementById("communicative-question-manager-playtest") !== document.getElementById("communicative-judge-pilot"),
    "Question Manager Playtest and Pilot panels are separate");

  const ruleIndex = devHtml.indexOf('data/communicative-judge-rules.js');
  const localIndex = devHtml.indexOf('engine/services/local-communicative-judge.js');
  const judgeIndex = devHtml.indexOf('engine/services/communicative-judge.js');
  const adapterIndex = devHtml.indexOf('engine/services/communicative-question-adapter.js');
  const managerIndex = devHtml.indexOf('engine/managers/question-manager.js');
  const harnessIndex = devHtml.indexOf('dev/communicative-question-manager-playtest.js');
  ok(ruleIndex < localIndex && localIndex < judgeIndex && judgeIndex < adapterIndex && adapterIndex < managerIndex && managerIndex < harnessIndex,
    "dev dependencies load in Rules -> Local -> Judge -> Adapter -> Question Manager -> Harness order");
  const playtestVersion = "qm-playtest-v1-fix1";
  ok(devHtml.includes(`src="data/word-dictionaries.js?v=${playtestVersion}"`),
    "Word Dictionary keeps the Playtest runtime version");
  const unifiedVersion = "communicative-formal-runtime-unified-v1-legacy-speech-trace-v1";
  const versionedScripts = [
    "engine/services/speech-normalizer.js", "engine/services/speech-recognition-adapter.js",
    "engine/services/speech-engine.js", "engine/services/speech-start-controller.js"
  ];
  for (const script of versionedScripts) {
    ok(devHtml.includes(`src="${script}?v=${unifiedVersion}"`), `${script} uses the unified Formal runtime version`);
  }
  ok(devHtml.includes('src="dev/communicative-question-manager-playtest.js?v=communicative-formal-trace-v1"'),
    "Playtest harness uses the DEV trace runtime version");
  const unchangedFormalScripts = [
    "engine/services/communicative-question-adapter.js",
    "engine/core/story-engine.js"
  ];
  for (const script of unchangedFormalScripts) {
    ok(devHtml.includes(`src="${script}?v=${unifiedVersion}"`), `${script} uses the unified Formal runtime version`);
  }
  for (const script of ["data/questions.js"]) {
    ok(devHtml.includes(`src="${script}?v=s005-phase-a2-v1"`), `${script} loads Phase A-2 in dev`);
  }
  ok(devHtml.includes('src="data/communicative-judge-rules.js?v=s005-registry-instance-fix-v1"'));
  ok(devHtml.includes('src="engine/services/local-communicative-judge.js?v=s005-rule-real-browser-trace-v1"'));
  ok(devHtml.includes('src="engine/services/communicative-judge.js?v=s005-rule-real-browser-trace-v1"'));
  const speechStartScripts = [
    "engine/managers/question-manager.js",
    "engine/presenters/communicative-question-presenter.js",
    "engine/controllers/communicative-question-flow-controller.js"
  ];
  for (const script of speechStartScripts) {
    const version = script === "engine/managers/question-manager.js" ?
      "s005-rule-real-browser-trace-v1" : script === "engine/presenters/communicative-question-presenter.js" ?
      "s005-listening-ui-v1" : "s005-phase-a2-v1";
    ok(devHtml.includes(`src="${script}?v=${version}"`), `${script} uses the current version in dev`);
    ok(indexHtml.includes(`src="${script}?v=${version}"`), `${script} uses the current version in index`);
  }
  ok(!devHtml.includes("engine/managers/question-manager.js?v=communicative-formal-v1"),
    "dev cannot load the pre-fallback QuestionManager cache key");
  ok(!indexHtml.includes("engine/managers/question-manager.js?v=communicative-formal-v1"),
    "index cannot load the pre-fallback QuestionManager cache key");
  equal((devHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 6,
    "Unchanged Formal assets retain the unified release version");
  equal((devHtml.match(/\?v=communicative-formal-late-result-v1/g) || []).length, 0,
    "DEV no longer loads the pre-trace Formal asset cache key");
  equal((devHtml.match(/\?v=communicative-formal-speech-fallback-v1/g) || []).length, 0,
    "The previous fallback-only cache key is no longer loaded");
  ok(!indexHtml.includes("communicative-question-manager-playtest"), "Production index does not load the Harness");
  ok(source.includes("QuestionManager.start(QUESTION_ID,"), "Every Playtest evaluation enters QuestionManager.start");
  ok(!/CommunicativeJudge\s*\.\s*judge/.test(source), "Playtest Controller never calls Judge directly");
  ok(!/CommunicativeQuestionAdapter\s*\.\s*evaluate/.test(source), "Playtest Controller never calls Adapter directly");

  const databaseGet = context.QuestionDatabase.get;
  const managerStart = context.QuestionManager.start;
  let managerStarts = 0;
  context.QuestionDatabase.get = function (id) {
    const question = databaseGet.call(context.QuestionDatabase, id);
    if (id !== playtestId || !question) return question;
    const oldQuestion = Object.assign({}, question);
    delete oldQuestion.communicative;
    return oldQuestion;
  };
  context.QuestionManager.start = async function () { managerStarts += 1; return managerStart.apply(this, arguments); };
  let value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "runtime-error", "Missing communicative metadata is a dev runtime error");
  equal(value.error, "dev-runtime-version-mismatch");
  equal(field("status").textContent, "runtime-error", "Runtime mismatch is explicit in the Playtest UI");
  equal(field("Judge reason").textContent, "dev-runtime-version-mismatch", "Runtime mismatch reason is explicit in the Playtest UI");
  equal(managerStarts, 0, "QuestionManager.start is not called when communicative metadata is missing");
  context.QuestionDatabase.get = databaseGet;
  context.QuestionManager.start = managerStart;

  context.QuestionManager.start = async function () {
    return { questionId: playtestId, category: "word", status: "failure", answer: "can I get an apple", error: null };
  };
  value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "runtime-error", "A Legacy result is not displayed as a learning failure");
  equal(value.error, "dev-runtime-version-mismatch");
  equal(value.diagnosticDetail, "non-communicative-result");
  equal(value.diagnosticResult.status, "failure", "The original Legacy result is retained for diagnosis");
  context.QuestionManager.start = managerStart;

  const realJudge = context.CommunicativeJudge.judge;
  let judgeCalls = 0;
  context.CommunicativeJudge.judge = async input => { judgeCalls += 1; return realJudge(input); };

  queueSpeech("Can I get an apple?", ["Can I get an apple?"]);
  value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "success");
  equal(value.judgeMode, "communicative");
  equal(value.judge.verdict, "ACCEPT");
  equal(value.resolution, "accepted");
  equal(context.CommunicativeQuestionManagerPlaytest.getState().inputMode, "speech");

  queueSpeech("I don't want an apple.", ["I don't want an apple."]);
  value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "reject");
  equal(value.judge.verdict, "REJECT");
  ok(value.status !== "failure", "REJECT is not converted to Legacy failure");

  queueSpeech("Can I have apple", ["Can I have apple"]);
  value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "unknown");
  equal(value.judge.verdict, "UNKNOWN");
  ok(value.status !== "reject" && value.status !== "failure", "UNKNOWN remains distinct");

  const callsBeforeFailure = judgeCalls;
  queueSpeechError("no-speech");
  value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "speech-failure");
  equal(value.judge, null);
  equal(judgeCalls, callsBeforeFailure, "Speech failure never reaches Judge");

  queueSpeech("Can I have apple", []);
  await context.CommunicativeQuestionManagerPlaytest.start();
  const startsBeforeRetry = speechStarts;
  queueSpeech("I don't want an apple.", []);
  value = await context.CommunicativeQuestionManagerPlaytest.retry();
  equal(value.status, "reject", "Retry creates a fresh Question Manager run");
  equal(context.CommunicativeQuestionManagerPlaytest.getState().retries, 1);
  equal(speechStarts, startsBeforeRetry + 1);
  equal(await context.CommunicativeQuestionManagerPlaytest.retry(), null, "A second Retry is blocked");
  equal(speechStarts, startsBeforeRetry + 1, "Blocked Retry starts no Speech");

  queueSpeech("Can I have apple", []);
  await context.CommunicativeQuestionManagerPlaytest.start();
  value = await context.CommunicativeQuestionManagerPlaytest.judgeText("Can I get an apple?");
  equal(value.status, "success", "Text fallback ACCEPT uses Question Manager");
  equal(value.judge.verdict, "ACCEPT");
  equal(context.CommunicativeQuestionManagerPlaytest.getState().inputMode, "text");

  queueSpeech("Can I have apple", []);
  await context.CommunicativeQuestionManagerPlaytest.start();
  value = await context.CommunicativeQuestionManagerPlaytest.judgeText("I don't want an apple.");
  equal(value.status, "reject", "Text fallback preserves REJECT");
  equal(value.judge.verdict, "REJECT");

  queueSpeechError("speech-timeout");
  await context.CommunicativeQuestionManagerPlaytest.start();
  value = await context.CommunicativeQuestionManagerPlaytest.judgeText("Can I have apple");
  equal(value.status, "unknown", "Text fallback preserves UNKNOWN");
  equal(value.judge.verdict, "UNKNOWN");
  ok(value.status !== "success", "Text input is never automatically accepted");

  const verdictBeforeSkip = value.judge.verdict;
  const continued = context.CommunicativeQuestionManagerPlaytest.skipContinue();
  equal(continued.status, "continued");
  equal(continued.resolution, "continue");
  equal(continued.lastResult.judge.verdict, verdictBeforeSkip, "Skip does not rewrite Judge verdict");

  const cancelledSpeech = deferred();
  queueDeferredSpeech(cancelledSpeech, "Can I get an apple?", []);
  const callsBeforeCancel = judgeCalls;
  const cancelledRun = context.CommunicativeQuestionManagerPlaytest.start();
  await flush();
  context.CommunicativeQuestionManagerPlaytest.cancel();
  cancelledSpeech.resolve();
  equal(await cancelledRun, null, "Cancelled old run returns no Playtest result");
  equal(judgeCalls, callsBeforeCancel, "Cancelled Speech never reaches Judge");
  equal(context.CommunicativeQuestionManagerPlaytest.getState().status, "cancelled");
  equal(field("status").textContent, "cancelled", "Old result does not overwrite cancelled UI");
  ok(speechCancels > 0, "Cancel reaches shared Speech controller");

  queueSpeech("Can I have apple", []);
  await context.CommunicativeQuestionManagerPlaytest.start();
  const oldRetrySpeech = deferred();
  queueDeferredSpeech(oldRetrySpeech, "Can I get an apple?", []);
  const retryCalls = judgeCalls;
  const oldRetry = context.CommunicativeQuestionManagerPlaytest.retry();
  await flush();
  const currentSpeech = deferred();
  queueDeferredSpeech(currentSpeech, "I don't want an apple.", []);
  const currentRun = context.CommunicativeQuestionManagerPlaytest.start();
  await flush();
  oldRetrySpeech.resolve();
  equal(await oldRetry, null, "Old Retry result is discarded after a new run");
  equal(judgeCalls, retryCalls, "Old Retry Speech does not reach Judge");
  currentSpeech.resolve();
  value = await currentRun;
  equal(value.status, "reject", "Current run controls the UI result");
  equal(judgeCalls, retryCalls + 1);

  const alternatives = ["I don't want an apple.", "two", "three", "four", "five", "six"];
  const alternativesBefore = alternatives.slice();
  queueSpeech("Can I get an apple?", alternatives);
  value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "success", "Primary transcript remains authoritative");
  equal(value.judge.matchedVariant, "Can I get an apple?");
  equal(value.alternatives.length, 5, "Alternatives are capped at five");
  same(alternatives, alternativesBefore, "Source alternatives remain unmodified");

  queueSpeech("Can I have apple", ["Can I have a apple", "Can I have Appel", "Can I have a ball"]);
  value = await context.CommunicativeQuestionManagerPlaytest.start();
  equal(value.status, "unknown", "Missing article remains UNKNOWN");
  ok(value.judge.verdict !== "ACCEPT");

  for (const [utterance, accepted] of [
    ["10", "1"], ["eighteen", "eight"], ["pineapple", "apple"],
    ["yesterday", "yes"], ["someone", "one"], ["can't", "can"]
  ]) {
    const token = context.CommunicativeQuestionAdapter.begin();
    const exact = await context.CommunicativeQuestionAdapter.evaluate({
      conceptId: "playtest.exact", acceptedVariants: [accepted], difficulty: "starter",
      promptType: "test", expectedUtterance: accepted, poolId: null, itemId: "exact"
    }, { status: "recognized", transcript: utterance, alternatives: [] }, token);
    ok(exact.status !== "accept", `${utterance} must not partially match ${accepted}`);
  }

  context.GameCore.speechMission = async () => { legacyCalls += 1; return "hello"; };
  const legacyResult = await context.QuestionManager.start("word.hello");
  equal(legacyResult.status, "success", "Legacy Question still uses Legacy path");
  equal(legacyCalls, 1);
  equal(context.QuestionDatabase.all().filter(question => question.id !== playtestId).length, 21,
    "Dev registration does not replace product Questions");
  ok(!source.includes("StoryEngine") && !source.includes("MonsterBattle") && !source.includes("MorningManager") && !source.includes("SaveManager"),
    "Harness has no progression or Save responsibility");
  ok(!source.includes("CommunicativeJudgePilot"), "Harness does not call the old Pilot Controller");
  ok(read("dev/communicative-judge-pilot.js").includes("window.CommunicativeJudgePilot"), "Existing Pilot remains present");

  ok(!/fetch\s*\(|XMLHttpRequest|API_KEY|Gemini|OpenAI/.test(source), "No Provider, fetch, or API key is added");
  equal(hash("index.html"), "c99068ee785e67531a68ed155c588cee3039d82fba23e07e819f8efeedd7a91c");
  equal(hash("data/questions.js"), "7f94f150fff8ef7af49e4bd7f86614900eafb0fb1d3d772861142feb68d75904");
  equal(hash("engine/managers/question-manager.js"), "98047b0cb21bd12f4fd5e2c432ea28836a6b82b7b0a3067639781ad538d87c6d");
  equal(hash("engine/services/speech-engine.js"), "3318e03a55a2506fccfeca2481d0b286e69074c63f5539d73b1b5b27e6371264");
  equal(hash("engine/services/speech-start-controller.js"), "73ea61ec3cc4a2532b220f298d2e48d8e66d03fac9901cbf4662bc89c65a883b");
  equal(hash("engine/services/communicative-question-adapter.js"), "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f");
  equal(hash("engine/services/communicative-judge.js"), "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04");
  equal(hash("engine/services/local-communicative-judge.js"), "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58");
  equal(hash("data/communicative-judge-rules.js"), "acae74a247318a54ef09ac75c04c444c14dedc798c67abf3b793fc0529dd9279");
  equal(hash("dev/communicative-judge-pilot.js"), "96b9dc24d72b9d7bc9857662e9a81dac170ea329da6f59930850d9eb8023bc7d");
  equal(treeHash("engine/stories"), "f8cbb9d1ec8d9dd3ee4028c1377d16f2763cd2ef02f10938128b068d1d88e163");
  equal(treeHash("stories"), "d8546e5e7990c8306acb9ad1d82962868cc6ef78520137bf2760a68c877a8fe2");
  equal(hash("data/monsters.js"), "af1afabcf11f4536eacb69b8370c465273b1b9adce8e98b94b69bac4e38b8073");
  equal(hash("engine/managers/monster-battle-manager.js"), "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3");
  equal(hash("data/mornings.js"), "89007415f111ab883dd2a10b47e9a7026608bfd377dd8ee1ec7ad0f5d9027470");
  equal(hash("engine/managers/morning-manager.js"), "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856");
  equal(hash("engine/managers/save-manager.js"), "9e1ac817a96a24b4550f976a02881167e7b7cb2b690cc69505be6aaaa4a5b992");

  equal(speechQueue.length, 0, "All planned Speech runs were consumed");
  console.log(`Communicative Question Manager Playtest tests (${checks} checks): PASS`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
