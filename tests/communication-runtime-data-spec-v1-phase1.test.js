"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const files = [
  "data/communication-task-specs.js", "data/communication-concept-catalog.js",
  "data/communication-action-catalog.js", "data/communication-recognition-dictionaries.js",
  "data/local-judge-profiles.js", "data/pico-support-profiles.js",
  "engine/services/local-communication-judge-provider.js", "engine/services/communication-judge-adapter.js",
  "engine/services/communication-judge-gateway.js", "engine/services/support-focus-resolver.js",
  "engine/services/local-pico-support-provider.js", "engine/controllers/communication-task-progress-controller.js"
];

function runtime() {
  const context = { console, Promise, setTimeout, clearTimeout };
  context.window = context;
  context.SpeechStartController = { prepare: () => Promise.resolve(), startListening: () => Promise.resolve(""), cancel() {} };
  vm.createContext(context);
  files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }));
  return context;
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex"); }

(async () => {
  const c = runtime();
  const tasks = plain(c.CommunicationTaskSpecDatabase.all());
  assert.strictEqual(tasks.length, 4);
  assert.deepStrictEqual(tasks.map(task => task.taskId), [
    "dev.shop.order.apple.2", "dev.shop.order.orange.3", "dev.shop.order.banana.1", "dev.shop.order.banana.3"
  ]);
  tasks.forEach(task => {
    assert.deepStrictEqual(Object.keys(task).sort(), ["action", "mode", "requiredInformation", "situation", "speakerRole", "taskId"]);
    assert.deepStrictEqual(plain(c.CommunicationTaskSpecDatabase.validate(task)), []);
    task.requiredInformation.forEach(entry => {
      assert.strictEqual(typeof entry.slotId, "string");
      assert.notStrictEqual(Object.prototype.hasOwnProperty.call(entry, "conceptId"), Object.prototype.hasOwnProperty.call(entry, "value"));
    });
  });
  const invalid = plain(tasks[0]);
  invalid.requiredInformation[0].value = "apple";
  assert(c.CommunicationTaskSpecDatabase.validate(invalid).some(error => error.includes("exactly one")));

  const apple = plain(c.CommunicationConceptCatalog.get("item.apple"));
  assert.deepStrictEqual(apple.forms, [{ text: "apple", number: "singular" }, { text: "apples", number: "plural" }]);
  assert.strictEqual(apple.slotId, "item");

  const dictionary = plain(c.CommunicationRecognitionDictionary.all());
  assert.deepStrictEqual(plain(c.CommunicationRecognitionDictionary.validate(dictionary)), []);
  assert(dictionary.some(entry => entry.scope.type === "slot" && entry.match === "three" && entry.candidate.value === 3));
  assert(dictionary.some(entry => entry.scope.type === "task" && entry.match === "tree" && entry.candidate.value === 3));
  assert(dictionary.some(entry => entry.scope.type === "task" && entry.scope.id === "dev.shop.order.orange.3" &&
    entry.match === "free" && entry.candidate.slotId === "quantity" && entry.candidate.value === 3));
  assert.strictEqual(dictionary.some(entry => entry.match === "free" && entry.scope.type !== "task"), false,
    "Promoted free Candidate remains Task-scoped");
  assert(dictionary.some(entry => entry.scope.type === "task" && entry.match === "watt" && entry.candidate.token === "want"));
  assert.strictEqual(dictionary.some(entry => ["to", "too"].includes(entry.match)), false);
  assert.strictEqual(JSON.stringify(dictionary).match(/priority|confidence|score|replacementText|correctedTranscript/g), null);

  const orangeTask = c.CommunicationTaskSpecDatabase.get("dev.shop.order.orange.3");
  const analysisInput = {
    taskSpec: orangeTask,
    transcript: "I watt tree orange",
    concepts: c.CommunicationConceptCatalog.all()
  };
  const analysis = plain(c.LocalCommunicationJudgeProvider.buildEvidence(analysisInput));
  assert.strictEqual(analysis.rawTranscript, "I watt tree orange", "Raw transcript remains unchanged");
  assert(analysis.evidence.some(value => value.candidate.token === "want"));
  assert(analysis.evidence.some(value => value.candidate.slotId === "quantity" && value.candidate.value === 3));
  assert(analysis.evidence.some(value => value.candidate.conceptId === "item.orange"));

  const taskPriority = plain(c.LocalCommunicationJudgeProvider.buildEvidence(analysisInput, [
    { scope: { type: "slot", id: "quantity" }, match: "tree", candidate: { slotId: "quantity", value: 1 } },
    { scope: { type: "task", id: orangeTask.taskId }, match: "tree", candidate: { slotId: "quantity", value: 3 } }
  ]));
  assert.strictEqual(taskPriority.dictionaryConflict, false);
  assert(taskPriority.evidence.some(value => value.candidate.value === 3));
  assert.strictEqual(taskPriority.evidence.some(value => value.candidate.value === 1), false, "Task evidence wins before common evidence");

  const originalDictionary = c.CommunicationRecognitionDictionary.all;
  c.CommunicationRecognitionDictionary.all = () => [
    { scope: { type: "slot", id: "quantity" }, match: "tree", candidate: { slotId: "quantity", value: 1 } },
    { scope: { type: "task", id: orangeTask.taskId }, match: "tree", candidate: { slotId: "quantity", value: 3 } }
  ];
  const prioritized = await c.CommunicationJudgeGateway.judge(orangeTask, "I want tree oranges");
  assert.strictEqual(prioritized.verdict, "ACCEPT", "Task evidence drives the semantic result before common evidence");
  c.CommunicationRecognitionDictionary.all = () => [
    { scope: { type: "slot", id: "quantity" }, match: "tree", candidate: { slotId: "quantity", value: 1 } },
    { scope: { type: "slot", id: "quantity" }, match: "tree", candidate: { slotId: "quantity", value: 3 } }
  ];
  const conflict = await c.CommunicationJudgeGateway.judge(orangeTask, "I want tree oranges");
  assert.strictEqual(conflict.verdict, "UNKNOWN");
  assert.strictEqual(conflict.reason, "recognition_conflict");
  c.CommunicationRecognitionDictionary.all = originalDictionary;

  const appleTask = c.CommunicationTaskSpecDatabase.get("dev.shop.order.apple.2");
  async function judge(text, task = appleTask, options) { return plain(await c.CommunicationJudgeGateway.judge(task, text, options)); }
  assert.strictEqual((await judge("I want two apples")).verdict, "ACCEPT");
  assert.strictEqual((await judge("Two apples please")).verdict, "ACCEPT");
  const singular = await judge("Two apple please");
  assert.strictEqual(singular.verdict, "ACCEPT");
  assert.strictEqual(singular.improvement, "plural_form");
  assert.strictEqual((await judge("Can I have two apples")).verdict, "ACCEPT");
  assert.strictEqual((await judge("Can I get two apples")).verdict, "ACCEPT");
  assert.strictEqual((await judge("Apples please")).verdict, "UNKNOWN");
  const wrongQuantity = await judge("I want four apples");
  assert.strictEqual(wrongQuantity.verdict, "REJECT");
  assert.strictEqual(wrongQuantity.reasonSlotId, "quantity");
  assert.strictEqual((await judge("I don't want two apples")).verdict, "REJECT");
  assert.strictEqual((await judge("Apple want please")).verdict, "UNKNOWN");
  assert.strictEqual((await judge("Two apple want")).verdict, "UNKNOWN");
  assert.strictEqual((await judge("OK two apples")).verdict, "UNKNOWN");
  assert.strictEqual((await judge("Did you say two apples")).verdict, "REJECT");
  assert.strictEqual((await judge("OK can I have two apples")).verdict, "ACCEPT");
  assert.strictEqual((await judge("Unlisted expression two apples")).verdict, "UNKNOWN");

  const orangeThreeTask = c.CommunicationTaskSpecDatabase.get("dev.shop.order.orange.3");
  let overlayEntries = [];
  c.CommunicationRecognitionCandidateStore = { approvedDictionaryEntries: () => overlayEntries.map(entry => plain(entry)) };
  assert.strictEqual((await judge("I want free oranges", orangeThreeTask)).verdict, "ACCEPT",
    "Formal Task dictionary works without localStorage overlay");
  overlayEntries = [{ scope: { type: "task", id: orangeThreeTask.taskId }, match: "free",
    candidate: { slotId: "quantity", value: 3 } }];
  const approvedFree = await judge("I want free oranges", orangeThreeTask);
  assert.strictEqual(approvedFree.verdict, "ACCEPT", "Approved Candidate becomes Task-scoped evidence");
  const approvedAnalysis = plain(c.LocalCommunicationJudgeProvider.buildEvidence({
    taskSpec: orangeThreeTask, transcript: "I want free oranges", concepts: c.CommunicationConceptCatalog.all()
  }));
  assert.strictEqual(approvedAnalysis.rawTranscript, "I want free oranges", "Overlay never rewrites Raw transcript");
  assert.strictEqual((await judge("I want four oranges", orangeThreeTask)).verdict, "REJECT");
  assert.strictEqual((await judge("I want free apples", appleTask)).verdict, "UNKNOWN",
    "Approved overlay never escapes its Task scope");
  overlayEntries.push({ scope: { type: "task", id: orangeThreeTask.taskId }, match: "free",
    candidate: { slotId: "quantity", value: 2 } });
  const overlayConflict = await judge("I want free oranges", orangeThreeTask);
  assert.strictEqual(overlayConflict.verdict, "UNKNOWN");
  assert.strictEqual(overlayConflict.reason, "recognition_conflict");
  overlayEntries = [];

  const bananaOneTask = c.CommunicationTaskSpecDatabase.get("dev.shop.order.banana.1");
  assert.strictEqual((await judge("I want a banana", bananaOneTask)).verdict, "ACCEPT");
  assert.strictEqual((await judge("Can I have a banana", bananaOneTask)).verdict, "ACCEPT");
  const orangeOneTask = c.CommunicationTaskSpecDatabase.get("dev.shop.order.orange.3");
  orangeOneTask.requiredInformation.filter(entry => entry.slotId === "quantity")[0].value = 1;
  assert.strictEqual((await judge("I'd like an orange", orangeOneTask)).verdict, "ACCEPT");
  const articleMismatch = await judge("I want an apple", appleTask);
  assert.strictEqual(articleMismatch.verdict, "REJECT");
  assert.strictEqual(articleMismatch.reasonSlotId, "quantity");
  assert.strictEqual((await judge("I want two bananas", bananaOneTask)).verdict, "REJECT");
  assert.strictEqual((await judge("Banana please", bananaOneTask)).verdict, "UNKNOWN");
  const articleAnalysis = plain(c.LocalCommunicationJudgeProvider.buildEvidence({
    taskSpec: bananaOneTask, transcript: "I want a banana", concepts: c.CommunicationConceptCatalog.all()
  }));
  assert.strictEqual(articleAnalysis.rawTranscript, "I want a banana");
  assert(articleAnalysis.evidence.some(entry => entry.relation === "article-modifies-item" && entry.candidate.value === 1));
  assert.strictEqual(dictionary.some(entry => entry.match === "a" || entry.match === "an"), false,
    "Articles must not be registered as global quantity dictionary entries");

  assert.deepStrictEqual(await judge("I want two apples"), {
    technicalStatus: "AVAILABLE", verdict: "ACCEPT", reason: "goal_achieved", reasonSlotId: null, improvement: "none"
  });
  const invalidTask = plain(appleTask); delete invalidTask.mode;
  assert.deepStrictEqual(await judge("I want two apples", invalidTask), {
    technicalStatus: "JUDGE_UNAVAILABLE", verdict: null, reason: null, reasonSlotId: null,
    improvement: "none", technicalReason: "invalid_task_spec"
  });

  let providerCalls = 0;
  const provider = { judge() { providerCalls += 1; return { technicalStatus: "AVAILABLE", verdict: "ACCEPT", reason: "goal_achieved", reasonSlotId: null, improvement: "none" }; } };
  await judge("I want two apples", appleTask, { provider });
  await judge("I want four apples", appleTask, { provider });
  assert.strictEqual(providerCalls, 0, "Local ACCEPT and REJECT never call the provider");
  assert.strictEqual((await judge("Apples please", appleTask, { provider })).verdict, "ACCEPT");
  assert.strictEqual(providerCalls, 1, "Only Local UNKNOWN reaches the provider");
  const apiOffUnknown = await judge("Apples please");
  assert.strictEqual(apiOffUnknown.technicalStatus, "AVAILABLE");
  assert.strictEqual(apiOffUnknown.verdict, "UNKNOWN");

  const taskCases = [
    ["dev.shop.order.apple.2", "I want two apples"],
    ["dev.shop.order.orange.3", "I watt tree oranges"],
    ["dev.shop.order.banana.1", "Can I have one banana"],
    ["dev.shop.order.banana.3", "Three bananas please"]
  ];
  for (const [taskId, transcript] of taskCases) {
    assert.strictEqual((await judge(transcript, c.CommunicationTaskSpecDatabase.get(taskId))).verdict, "ACCEPT", taskId);
  }

  c.SpeechStartController.startListening = () => Promise.reject(new Error("no-speech"));
  const speechFailure = plain(await c.CommunicationTaskProgressController.start(appleTask.taskId));
  assert.strictEqual(speechFailure.status, "SPEECH_FAILURE");
  assert.strictEqual(speechFailure.judgeResult, null);

  const judgeSource = fs.readFileSync(path.join(root, "engine/services/local-communication-judge-provider.js"), "utf8");
  assert.strictEqual(/if\s*\([^)]*taskId\s*===/.test(judgeSource), false, "Judge contains no Task-specific branch");
  const phaseSources = [
    "data/communication-task-specs.js", "data/communication-concept-catalog.js", "data/communication-action-catalog.js",
    "data/communication-recognition-dictionaries.js", "data/local-judge-profiles.js",
    "engine/services/local-communication-judge-provider.js", "engine/services/communication-judge-adapter.js",
    "engine/services/communication-judge-gateway.js", "engine/services/support-focus-resolver.js"
  ].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.strictEqual(/technicalStatus\s*:\s*["']OK["']/.test(phaseSources), false, "Phase 1 has no OK technical status");
  assert.strictEqual(/fetch\s*\(|XMLHttpRequest|API_KEY|Gemini|OpenAI/.test(phaseSources), false, "No API implementation or call was added");

  const lockedHashes = {
    "data/word-dictionaries.js": "8c8c49386c8bd935cbb40d1f067441f3f032f423a579c8193d3b95d167d68d89",
    "engine/managers/question-manager.js": "98047b0cb21bd12f4fd5e2c432ea28836a6b82b7b0a3067639781ad538d87c6d",
    "engine/services/speech-start-controller.js": "b241bc1f079eb9c4b645cb0084c62236994934b222f00589d1d1bb2934fee450",
    "engine/services/speech-engine.js": "3318e03a55a2506fccfeca2481d0b286e69074c63f5539d73b1b5b27e6371264",
    "engine/services/speech-recognition-adapter.js": "1261497515055b11c6caa0d26eb8773d848d656bc17ba7a5c9f7b53798b365ad",
    "engine/services/local-communicative-judge.js": "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58",
    "engine/services/communicative-judge.js": "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04"
  };
  Object.keys(lockedHashes).forEach(file => assert.strictEqual(sha(file), lockedHashes[file], file + " must remain locked"));
  assert(!fs.readFileSync(path.join(root, "index.html"), "utf8").includes("communication-recognition-dictionaries"), "Story runtime remains disconnected");

  console.log("Communication Runtime Data Specification V1 Phase 1 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
