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

const speechQueue = [];
let speechStarts = 0;
let speechCancels = 0;
let legacyCalls = 0;
let legacyMission = async () => "hello";
const context = {
  console,
  setTimeout,
  clearTimeout,
  GameConfig: { defaultLanguage: "en-US" },
  AudioManager: { stopAll() {} },
  GameCore: {
    speechMission(config) {
      legacyCalls += 1;
      return legacyMission(config);
    }
  },
  SpeechEngine: {
    supported: true,
    getStatus: () => "idle",
    stop() {},
    listen(options) {
      const plan = speechQueue.shift();
      if (!plan) throw new Error("missing-speech-plan");
      speechStarts += 1;
      return plan(options);
    }
  },
  SpeechStartController: {
    prepare: async () => {},
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
vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }

load("engine/services/speech-normalizer.js");
load("data/word-dictionaries.js");
load("data/questions.js");
load("data/communicative-judge-rules.js");
load("engine/services/local-communicative-judge.js");
load("engine/services/communicative-judge.js");
load("engine/services/communicative-question-adapter.js");
load("engine/managers/question-manager.js");

const questionSource = read("data/questions.js");
const managerSource = read("engine/managers/question-manager.js");
const originalQuestions = context.QuestionDatabase.all();
const appleQuestionId = "integration.apple-order";

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

(async () => {
  equal(originalQuestions.length, 21, "The product database still has exactly 21 Questions");
  equal(originalQuestions.filter(question => question.communicative).length, 1, "Only one product Question is Communicative");
  equal(originalQuestions.filter(question => !question.communicative).length, 20, "The other 20 product Questions remain Legacy");
  equal(context.QuestionDatabase.get("phrase.are_you_ok").communicative.conceptId, "social.wellbeing.ask");
  equal(crypto.createHash("sha256").update(questionSource.slice(questionSource.indexOf("  register({"))).digest("hex"),
    "03287599209d890b0764f7f2423c695f6ca3d49a30e6275b29daab100513ddbf",
    "The 21 product Question definitions match Formal V1");

  const legacyBeforeSpeech = speechStarts;
  legacyMission = async config => {
    equal(config.retryOnMismatch, false);
    return "hello";
  };
  const legacySuccess = await context.QuestionManager.start("word.hello");
  same(legacySuccess, {
    questionId: "word.hello", category: "word", status: "success", answer: "hello",
    success: "その調子！", failure: "もう一度、一緒にやってみよう！", hint: "ハロー", error: null
  }, "Legacy success result is unchanged");
  equal(speechStarts, legacyBeforeSpeech, "Legacy does not enter Communicative Speech path");

  legacyMission = async () => ({ matched: false, answer: "goodbye" });
  const legacyFailure = await context.QuestionManager.start("word.hello");
  same(legacyFailure, {
    questionId: "word.hello", category: "word", status: "failure", answer: "goodbye",
    success: "その調子！", failure: "もう一度、一緒にやってみよう！", hint: "ハロー", error: null
  }, "Legacy failure result is unchanged");

  const legacyPending = deferred();
  legacyMission = () => legacyPending.promise;
  const legacyRun = context.QuestionManager.start("word.hello");
  await flush();
  equal(context.QuestionManager.cancel().status, "cancelled", "Legacy cancel status is preserved");
  legacyPending.resolve("hello");
  equal((await legacyRun).status, "cancelled", "Old Legacy result stays cancelled");

  ["start", "cancel", "getResult", "reset"].forEach(name => ok(typeof context.QuestionManager[name] === "function", `QuestionManager.${name} remains public`));
  assert.throws(() => context.QuestionDatabase.register({
    id: "integration.invalid", category: "word", prompt: "Invalid", answers: ["unused"], communicative: {}
  }), /conceptId/, "Missing conceptId must be a configuration error");
  checks += 1;
  equal(context.QuestionDatabase.get("integration.invalid"), null, "Invalid Communicative Question is not registered");

  const registered = context.QuestionDatabase.register({
    id: appleQuestionId,
    category: "word",
    prompt: "Order an apple.",
    answers: ["unused-legacy-answer"],
    success: "Communicated.",
    failure: "Not communicated.",
    hint: "Can I get an apple?",
    communicative: {
      conceptId: "shopping.fruit.apple.order",
      difficulty: "starter",
      promptType: "order",
      expectedUtterance: "Can I get an apple?"
    }
  });
  equal(registered.communicative.conceptId, "shopping.fruit.apple.order", "Optional schema survives registration");
  registered.communicative.conceptId = "tampered";
  equal(context.QuestionDatabase.get(appleQuestionId).communicative.conceptId,
    "shopping.fruit.apple.order", "Communicative settings are copied non-destructively");
  ok(managerSource.includes("question.communicative"), "Communicative opt-in uses schema presence");
  ok(!managerSource.includes(`questionId === \"${appleQuestionId}\"`), "Question ID is not hard-coded");
  ok(!/category\s*===\s*["']communicative["']/.test(managerSource), "Category does not select Judge mode");

  const realJudge = context.CommunicativeJudge.judge;
  let judgeCalls = 0;
  context.CommunicativeJudge.judge = async input => {
    judgeCalls += 1;
    return realJudge(input);
  };

  queueSpeech("Can I get an apple?", ["Can I get an apple?"]);
  let value = await context.QuestionManager.start(appleQuestionId);
  equal(value.judgeMode, "communicative");
  equal(value.status, "success");
  equal(value.resolution, "accepted");
  equal(value.judge.verdict, "ACCEPT");
  equal(value.attemptCount, 1);
  equal(value.maxRetries, 1);

  queueSpeech("I don't want an apple.", ["I don't want an apple."]);
  value = await context.QuestionManager.start(appleQuestionId);
  equal(value.status, "reject");
  equal(value.judge.verdict, "REJECT");
  ok(value.status !== "failure" && value.status !== "unknown", "REJECT remains distinct");
  equal(value.resolution, null, "REJECT does not auto-continue");

  queueSpeech("Can I have apple", ["Can I have apple", "Can I have a apple", "Can I have Appel", "Can I have a ball"]);
  value = await context.QuestionManager.start(appleQuestionId);
  equal(value.status, "unknown");
  equal(value.judge.verdict, "UNKNOWN");
  equal(value.judge.reason, "no-provider");
  ok(value.status !== "failure" && value.status !== "reject", "UNKNOWN remains distinct");
  equal(value.resolution, null, "UNKNOWN does not auto-continue");

  for (const error of ["no-speech", "speech-timeout", "recognition-error", "not-allowed"]) {
    const callsBeforeFailure = judgeCalls;
    queueSpeechError(error);
    value = await context.QuestionManager.start(appleQuestionId);
    equal(value.status, "speech-failure", `${error} maps to speech-failure`);
    equal(value.judge, null, `${error} has no Judge result`);
    equal(value.error, error, `${error} is retained`);
    equal(judgeCalls, callsBeforeFailure, `${error} does not call Judge`);
  }

  const cancelledSpeech = deferred();
  queueDeferredSpeech(cancelledSpeech, "Can I get an apple?", []);
  const cancelledCalls = judgeCalls;
  const cancelledRun = context.QuestionManager.start(appleQuestionId);
  await flush();
  value = context.QuestionManager.cancel();
  equal(value.status, "cancelled");
  equal(value.resolution, "cancelled");
  cancelledSpeech.resolve();
  equal((await cancelledRun).status, "cancelled");
  equal(judgeCalls, cancelledCalls, "Cancelled Speech never reaches Judge");

  const oldSpeech = deferred();
  const newSpeech = deferred();
  queueDeferredSpeech(oldSpeech, "Can I get an apple?", []);
  const raceCalls = judgeCalls;
  const oldRun = context.QuestionManager.start(appleQuestionId);
  await flush();
  queueDeferredSpeech(newSpeech, "Can I get an apple?", []);
  const newRun = context.QuestionManager.start(appleQuestionId);
  await flush();
  oldSpeech.resolve();
  equal((await oldRun).status, "cancelled", "A new Question cancels the old run");
  equal(judgeCalls, raceCalls, "Old run never reaches Judge");
  newSpeech.resolve();
  equal((await newRun).status, "success", "The current run still completes");
  equal(judgeCalls, raceCalls + 1, "Only the current run calls Judge");

  const alternatives = [
    "I don't want an apple.", "Can I get an apple?", "three", "four", "five", "six"
  ];
  const alternativesBefore = alternatives.slice();
  queueSpeech("Can I get an apple?", alternatives);
  value = await context.QuestionManager.start(appleQuestionId);
  equal(value.status, "success", "Primary transcript stays ahead of a rejecting alternative");
  equal(value.judge.matchedVariant, "Can I get an apple?", "Primary transcript is the matched variant");
  equal(value.alternatives.length, 5, "Alternatives are hard-capped at five");
  same(alternatives, alternativesBefore, "The source alternatives array is not mutated");

  for (const [utterance, accepted] of [
    ["10", "1"], ["eighteen", "eight"], ["pineapple", "apple"],
    ["yesterday", "yes"], ["someone", "one"], ["can't", "can"]
  ]) {
    const token = context.CommunicativeQuestionAdapter.begin();
    const exact = await context.CommunicativeQuestionAdapter.evaluate({
      conceptId: "integration.exact", acceptedVariants: [accepted], difficulty: "starter",
      promptType: "test", expectedUtterance: accepted, poolId: null, itemId: "exact"
    }, { status: "recognized", transcript: utterance, alternatives: [] }, token);
    ok(exact.status !== "accept", `${utterance} must not partially match ${accepted}`);
  }

  equal(context.QuestionDatabase.all().filter(question => question.id !== appleQuestionId).length, 21,
    "The Integration Question exists only inside this test VM");
  ok(!/fetch\s*\(|XMLHttpRequest|API_KEY|Gemini|OpenAI/.test(managerSource + questionSource),
    "No Provider, fetch, or API key is added");
  ok(!managerSource.includes("while (true)") && !managerSource.includes("do {"), "Communicative path has no automatic retry loop");

  equal(treeHash("engine/stories"), "93a0332efb2803acf52af0591972edf9bb26a5f76a980875d609973311b0a7b7");
  equal(treeHash("stories"), "d8546e5e7990c8306acb9ad1d82962868cc6ef78520137bf2760a68c877a8fe2");
  equal(hash("data/monsters.js"), "af1afabcf11f4536eacb69b8370c465273b1b9adce8e98b94b69bac4e38b8073");
  equal(hash("engine/managers/monster-battle-manager.js"), "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3");
  equal(hash("data/mornings.js"), "89007415f111ab883dd2a10b47e9a7026608bfd377dd8ee1ec7ad0f5d9027470");
  equal(hash("engine/managers/morning-manager.js"), "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856");
  equal(hash("index.html"), "3835bbaa7e5ef05b5a3e852f3bd0e078b76a13660d602ef52fc3eaa3ae8da900");
  equal(hash("dev.html"), "ce04f6533099f2cd461fc2f94a5e3c011182c1f1cd80a438c28abc58c23a2c3d");
  equal(hash("engine/services/speech-engine.js"), "3318e03a55a2506fccfeca2481d0b286e69074c63f5539d73b1b5b27e6371264");
  equal(hash("engine/services/speech-start-controller.js"), "73ea61ec3cc4a2532b220f298d2e48d8e66d03fac9901cbf4662bc89c65a883b");
  equal(hash("engine/services/communicative-question-adapter.js"), "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f");
  equal(hash("engine/services/communicative-judge.js"), "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04");
  equal(hash("engine/services/local-communicative-judge.js"), "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58");
  equal(hash("data/communicative-judge-rules.js"), "acae74a247318a54ef09ac75c04c444c14dedc798c67abf3b793fc0529dd9279");

  ok(speechCancels > 0, "QuestionManager continues to cancel Speech through the shared controller");
  equal(speechQueue.length, 0, "All Speech plans were consumed");
  console.log(`Communicative Question Manager Integration V1 tests (${checks} checks): PASS`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
