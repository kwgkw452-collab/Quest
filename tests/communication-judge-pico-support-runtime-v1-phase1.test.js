const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const files = [
  "data/communication-concept-catalog.js",
  "data/communication-action-catalog.js",
  "data/communication-task-specs.js",
  "data/local-judge-profiles.js",
  "data/pico-support-profiles.js",
  "data/communication-recognition-dictionaries.js",
  "engine/services/local-communication-judge-provider.js",
  "engine/services/communication-judge-adapter.js",
  "engine/services/communication-judge-gateway.js",
  "engine/services/support-focus-resolver.js",
  "engine/services/local-pico-support-provider.js",
  "engine/controllers/communication-task-progress-controller.js"
];

function runtime() {
  const context = { console, Promise, setTimeout, clearTimeout };
  context.window = context;
  context.SpeechStartController = { prepare: () => Promise.resolve(), startListening: () => Promise.resolve(""), cancel: () => {} };
  vm.createContext(context);
  files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }));
  return context;
}

(async function () {
  const c = runtime();
  const traceEvents = [];
  c.CommunicationTaskV1Trace = { record: (name, detail) => traceEvents.push({ name, detail }) };
  const task = c.CommunicationTaskSpecDatabase.get("dev.shop.order.apple.2");
  async function judge(text, selectedTask = task) { return c.CommunicationJudgeGateway.judge(selectedTask, text); }

  assert.deepStrictEqual(JSON.parse(JSON.stringify(await judge("I want two apples."))),
    { technicalStatus: "AVAILABLE", verdict: "ACCEPT", reason: "goal_achieved", reasonSlotId: null, improvement: "none" });
  assert.strictEqual((await judge("I want two apple.")).verdict, "ACCEPT");
  assert.strictEqual((await judge("I want two apple.")).improvement, "plural_form");
  assert.strictEqual((await judge("Two apple, please.")).verdict, "ACCEPT");
  assert.strictEqual((await judge("Two apple, please.")).improvement, "plural_form");
  assert.strictEqual((await judge("Two apple want.")).reason, "unknown_expression");
  assert.strictEqual((await judge("Two apple want.")).verdict, "UNKNOWN");
  assert.strictEqual((await judge("Apple want please.")).reason, "missing_required_information");
  assert.strictEqual((await judge("Apples, please.")).verdict, "UNKNOWN");
  assert.strictEqual((await judge("Apples, please.")).reason, "missing_required_information");
  assert.strictEqual((await judge("One apple, please.")).reason, "wrong_quantity");
  assert.strictEqual((await judge("Three apples, please.")).reason, "wrong_quantity");
  assert.strictEqual((await judge("Two oranges, please.")).reason, "wrong_item");
  assert.strictEqual((await judge("I don't want apples.")).reason, "opposite_intent");

  const supported = await judge("Could I have two apples?");
  assert.strictEqual(supported.technicalStatus, "AVAILABLE");
  assert.strictEqual(supported.verdict, "ACCEPT");

  const orange = JSON.parse(JSON.stringify(task));
  orange.requiredInformation.filter(value => value.slotId === "item")[0].conceptId = "item.orange";
  assert.strictEqual((await judge("I want two oranges.", orange)).verdict, "ACCEPT");
  const banana = JSON.parse(JSON.stringify(task));
  banana.requiredInformation.filter(value => value.slotId === "item")[0].conceptId = "item.banana";
  assert.strictEqual((await judge("Two bananas, please.", banana)).verdict, "ACCEPT");

  const providerSource = fs.readFileSync(path.join(root, "engine/services/local-communication-judge-provider.js"), "utf8").toLowerCase();
  ["apple", "apples", '"two"', '"2"'].forEach(value => assert.strictEqual(providerSource.includes(value), false));

  let gatewayCalled = false;
  const originalJudge = c.CommunicationJudgeGateway.judge;
  c.CommunicationJudgeGateway.judge = () => { gatewayCalled = true; return Promise.resolve(null); };
  c.SpeechStartController.startListening = () => Promise.reject(new Error("no-speech"));
  const speechFailure = await c.CommunicationTaskProgressController.start(task.taskId);
  assert.strictEqual(speechFailure.status, "SPEECH_FAILURE");
  assert.strictEqual(speechFailure.judgeResult, null);
  assert.strictEqual(speechFailure.semanticAttemptCount, 0);
  assert.strictEqual(speechFailure.speechFailureCount, 1);
  assert.strictEqual(gatewayCalled, false);
  assert.deepStrictEqual(traceEvents.map(entry => entry.name), [
    "phase1-speech-request", "prepare-start", "prepare-complete", "startListening-call",
    "speech-promise-pending", "speech-rejected", "speech-error-name"
  ]);
  assert.strictEqual(traceEvents[6].detail.name, "Error");
  assert.strictEqual(traceEvents[6].detail.message, "no-speech");

  traceEvents.length = 0;
  c.CommunicationJudgeGateway.judge = originalJudge;
  c.SpeechStartController.startListening = () => Promise.resolve("Two apples, please.");
  const heard = await c.CommunicationTaskProgressController.start(task.taskId);
  assert.strictEqual(heard.status, "ACCEPT");
  assert.deepStrictEqual(traceEvents.map(entry => entry.name), [
    "phase1-speech-request", "prepare-start", "prepare-complete", "startListening-call",
    "speech-promise-pending", "speech-resolved", "speech-result-transcript", "judge-start", "judge-complete"
  ]);
  assert.strictEqual(traceEvents[6].detail.transcript, "Two apples, please.");
  const first = await c.CommunicationTaskProgressController.start(task.taskId, { transcript: "Two apple want." });
  assert.strictEqual(first.semanticAttemptCount, 1);
  assert.strictEqual(first.speechFailureCount, 0);
  assert.strictEqual(first.support, "まず I から始めてみようピコ！");
  const unknownSupport = c.LocalPicoSupportProvider.support(task, { kind: "quantity", slotId: "quantity" }, 1, "UNKNOWN");
  assert.strictEqual(unknownSupport, "いくつほしいかも伝えてみようピコ！");
  const wrongQuantitySupport = c.LocalPicoSupportProvider.support(task, { kind: "quantity", slotId: "quantity" }, 1, "REJECT");
  assert.strictEqual(wrongQuantitySupport, "今回は2個ほしいことを伝えてみようピコ！");
  const wrongItemSupport = c.LocalPicoSupportProvider.support(task, { kind: "item", slotId: "item" }, 1, "REJECT");
  assert.strictEqual(wrongItemSupport, "今回はリンゴをお願いしたいピコ！");
  const success = await c.CommunicationTaskProgressController.retry({ transcript: "I want two apple." });
  assert.strictEqual(success.status, "ACCEPT");
  assert.strictEqual(success.resolution, "accepted");
  assert.strictEqual(success.semanticAttemptCount, 1);

  await c.CommunicationTaskProgressController.start(task.taskId, { transcript: "Two apple want." });
  await c.CommunicationTaskProgressController.retry({ transcript: "Apples, please." });
  const rescued = await c.CommunicationTaskProgressController.retry({ transcript: "Kindly arrange produce." });
  assert.strictEqual(rescued.status, "FINAL_RESCUE");
  assert.strictEqual(rescued.resolution, "adventure_return");
  assert.notStrictEqual(rescued.status, "ACCEPT");

  let capturedArguments;
  c.CommunicationJudgeGateway.judge = function () { capturedArguments = Array.from(arguments); return originalJudge.apply(this, arguments); };
  await c.CommunicationTaskProgressController.start(task.taskId, { transcript: "Apples, please." });
  assert.strictEqual(capturedArguments.length, 2);
  assert.strictEqual(JSON.stringify(capturedArguments).includes("semanticAttemptCount"), false);

  let release;
  c.CommunicationJudgeGateway.judge = () => new Promise(resolve => { release = resolve; });
  const pending = c.CommunicationTaskProgressController.start(task.taskId, { transcript: "I want two apples." });
  await Promise.resolve();
  c.CommunicationTaskProgressController.cancel();
  release({ technicalStatus: "AVAILABLE", verdict: "ACCEPT", reason: "goal_achieved", reasonSlotId: null, improvement: "none" });
  const stale = await pending;
  assert.strictEqual(stale.status, "CANCELLED");
  assert.strictEqual(stale.resolution, "cancelled");

  const supportSources = ["engine/services/support-focus-resolver.js", "engine/services/local-pico-support-provider.js",
    "engine/presenters/communication-task-presenter.js"].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.strictEqual(/StoryEngine|PicoBreakManager|StoryRegistry/.test(supportSources), false);
  assert.strictEqual(/fetch\s*\(|GEMINI|OPENAI|API_KEY/.test(files.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n")), false);

  const devHtml = fs.readFileSync(path.join(root, "dev-communication-runtime-v1.html"), "utf8");
  assert(devHtml.includes("dev/communication-task-v1-playtest.js"));
  assert(fs.readFileSync(path.join(root, "dev/communication-task-v1-playtest.js"), "utf8").includes("話す — Communication Runtime V1"));
  assert(!fs.readFileSync(path.join(root, "index.html"), "utf8").includes("communication-task-v1-playtest"));
  console.log("Communication Judge → Pico Support Runtime V1 Phase 1 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
