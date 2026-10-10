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
  "index.html": "f23e926a942fbb740763528fd139838ef5059fd7df4065f4a89b7d6beed2cda2",
  "engine/services/speech-recognition-adapter.js": "d064c492f13bfa46014962becabaaa15a25aaf5c208563e06ee1616af3480d9a",
  "engine/services/speech-engine.js": "2d85fa0af3bd8f109ca9d95995361f44e3240e97ce5fba54bed1d14e66260824",
  "engine/services/speech-start-controller.js": "f6d1224d0ae71f8ee12067f0ede79650dae84a88d2c68b7ce474ce48c24b8161",
  "engine/managers/monster-battle-manager.js": "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3",
  "engine/managers/morning-manager.js": "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856"
};
for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.strictEqual(hash(file), expected, `${file} logic must remain unchanged`);
}

const buttons = [];
const plans = [];
let speechStarts = 0;
const controls = { children: [], appendChild(button) { this.children.push(button); buttons.push(button); } };
const quietConsole = { log() {}, table() {}, warn: console.warn, error: console.error };
const context = {
  console: quietConsole,
  setTimeout,
  clearTimeout,
  performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
  document: {
    getElementById(id) { return id === "controls" ? controls : null; },
    createElement() { return { appendChild() {}, addEventListener() {}, style: {} }; }
  },
  AudioManager: { stopAll() {} },
  GameCore: { async speechMission() { return "hello"; } },
  SpeechEngine: { getStatus: () => "idle", stop() {}, async listen() { throw new Error("direct-engine-used"); } },
  SpeechStartController: {
    async prepare() {},
    async startListening(options) {
      speechStarts += 1;
      const plan = plans.shift();
      if (!plan) throw new Error("missing-plan");
      if (options.onStart) options.onStart();
      if (plan.run) return plan.run(options);
      if (plan.interim && options.onInterim) options.onInterim(plan.interim);
      if (plan.alternatives && options.onAlternatives) options.onAlternatives(plan.alternatives);
      if (plan.error) throw new Error(plan.error);
      return plan.final;
    },
    cancel() {}
  }
};
context.window = context;
context.addEventListener = () => {};
context.DialogManager = {
  show() { controls.children = []; },
  showRecognized() {},
  hideRecognized() {},
  button(label, click) { return { label, click }; },
  choice() { return Promise.resolve("continue"); },
  textInput() { return Promise.resolve("cancelled"); },
  next() { return Promise.resolve("next"); }
};

vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }
[
  "dev/formal-speech-trace.js",
  "engine/services/speech-normalizer.js",
  "data/word-dictionaries.js",
  "data/questions.js",
  "data/communicative-judge-rules.js",
  "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js",
  "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js",
  "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js"
].forEach(load);

async function flush() {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}
function events(source) {
  return context.FormalSpeechTrace.getEntries().filter(entry => !source || entry.source === source);
}
function eventNames(source) { return events(source).map(entry => entry.event); }

(async () => {
  context.FormalSpeechTrace.clear();
  plans.push({ interim: "are you okay", alternatives: ["are you okay"], final: "Are you OK?" });
  const run = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();

  assert.strictEqual(speechStarts, 0, "Speech must not start before the gate click");
  assert(eventNames("formal-story").includes("speech-gate-shown"));
  assert(!eventNames("formal-story").includes("startListening-call"));
  assert(!eventNames("formal-story").includes("speech-failure-result"));
  const gateShown = events("formal-story").find(entry => entry.event === "speech-gate-shown");
  assert.strictEqual(gateShown.attemptCount, 1, "Known pre-click attemptCount remains observable and unchanged");
  assert.strictEqual(typeof gateShown.runId, "number");
  assert.strictEqual(typeof gateShown.questionManagerRunId, "number");
  assert.strictEqual(typeof gateShown.presenterToken, "number");

  buttons.at(-1).click();
  const result = await run;
  assert.strictEqual(result.status, "success");
  assert.strictEqual(speechStarts, 1, "Speech starts exactly once after click");
  const formalNames = eventNames("formal-story");
  const shownIndex = formalNames.indexOf("speech-gate-shown");
  const clickIndex = formalNames.indexOf("speech-gate-click");
  const startIndex = formalNames.indexOf("startListening-call");
  assert(shownIndex < clickIndex && clickIndex < startIndex, "gate shown -> click -> startListening trace order");
  for (const required of [
    "formal-flow-start", "question-manager-start", "prepare-start", "prepare-complete",
    "speech-gate-create", "listening-start", "interim", "alternatives", "final",
    "judge-start", "judge-result", "flow-end"
  ]) assert(formalNames.includes(required), `Formal trace includes ${required}`);

  context.FormalSpeechTrace.clear();
  plans.push({
    run(options) {
      return new Promise((resolve, reject) => {
        reject(new Error("no-speech"));
        setTimeout(() => options.onInterim("are you okay"), 0);
      });
    }
  });
  const lateRun = context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  await flush();
  buttons.at(-1).click();
  const lateResult = await lateRun;
  assert.strictEqual(lateResult.status, "success");
  const lateNames = eventNames("formal-story");
  for (const required of ["no-speech", "late-result-wait-start", "late-result-candidate", "late-result-finalized"]) {
    assert(lateNames.includes(required), `Late-result trace includes ${required}`);
  }

  context.FormalSpeechTrace.clear();
  plans.push({ final: "Are you OK?" });
  const devContext = {
    source: "dev-question-manager-playtest", flowRunId: 7, presenterToken: null,
    attemptCount: 1, speechRetries: 0
  };
  const devResult = await context.QuestionManager.start("phrase.are_you_ok", { __formalTraceContext: devContext });
  assert.strictEqual(devResult.status, "success");
  assert(eventNames("dev-question-manager-playtest").includes("startListening-call"));
  assert(!events().some(entry => entry.source === "formal-story"), "DEV QuestionManager source stays distinct");

  const devHtml = read("dev.html");
  assert(devHtml.includes("dev/formal-speech-trace.js?v=communicative-formal-trace-v1"));
  assert(!read("index.html").includes("formal-speech-trace"), "Production index has no trace loader or UI");
  assert(read("dev/communicative-question-manager-playtest.js").includes('source: "dev-question-manager-playtest"'));
  assert(read("dev/communicative-judge-pilot.js").includes('source: "dev-judge-pilot"'));
  assert.strictEqual(Array.isArray(context.__FORMAL_SPEECH_TRACE__), true);

  context.CommunicativeQuestionFlowController.cancel();
  assert(eventNames().includes("cancel"), "Cancel remains synchronous and traceable");
  console.log("Formal Communicative Runtime Trace V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
