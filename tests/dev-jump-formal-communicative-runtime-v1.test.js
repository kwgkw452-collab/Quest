"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const devHtml = read("dev.html");
const scripts = Array.from(devHtml.matchAll(/<script\s+src="([^"]+)"/g), match => match[1]);

const productionHashes = {
  "index.html": "e6c5b6e1c6155506d4a80fe46c2a442dbaa40180065a7e9905d8b6bb18ce3855",
  "data/questions.js": "4c3387cce771b78dfaf7e33933a9df43da0defda28b487de84e5ac0b2a611c18",
  "data/communicative-judge-rules.js": "86488ef0705d709fac04183cdd0ccd90edf1de4a236b3e1015d84589d159a828",
  "engine/services/local-communicative-judge.js": "034cbf4431bcb6d5a1ab3d9afdc8526665d8ea357959383f11faa13fc3baa4d6",
  "engine/services/communicative-judge.js": "e37901643b7df9799ff9ad743508b0414e58b952777aa81ab97b74dadc218542",
  "engine/services/communicative-question-adapter.js": "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f",
  "engine/managers/question-manager.js": "5821246389f2ca4e622cc3c8b2e75302e244cea24e502737323b37f9f46de6c8",
  "engine/presenters/communicative-question-presenter.js": "323a1947b8b09033387fd57899b7a74412aa58cf11e9b7cd5d29843b08263653",
  "engine/controllers/communicative-question-flow-controller.js": "b674ea304e2097350149c7e59394c47bf7a2f5d387555c849d4ebb882936e1b3",
  "engine/core/story-engine.js": "ecca2bac442d5002fec99d8f9e826756bee6afd2efd24a093c187d041f5afbeb",
  "engine/stories/S004.js": "b004f23146691f28a420e8918dd61577ad0f45a9daee4af63e2c82c42b0cc905"
};
for (const [file, expected] of Object.entries(productionHashes)) {
  assert.strictEqual(hash(file), expected, `${file} must remain unchanged`);
}

const ordered = [
  "data/questions.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "data/communicative-judge-rules.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-normalizer.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-recognition-adapter.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-engine.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/speech-start-controller.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/local-communicative-judge.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/communicative-judge.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/services/communicative-question-adapter.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/managers/dialog-manager.js",
  "engine/managers/question-manager.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/presenters/communicative-question-presenter.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/controllers/communicative-question-flow-controller.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1",
  "engine/core/core.js",
  "engine/core/story-engine.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1"
];
let previous = -1;
for (const source of ordered) {
  const current = scripts.indexOf(source);
  assert(current > previous, `dev dependency order: ${source}`);
  assert.strictEqual(scripts.filter(value => value === source).length, 1, `load exactly once: ${source}`);
  previous = current;
}
assert.strictEqual((devHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 13);
assert.strictEqual((devHtml.match(/\?v=communicative-formal-trace-v1/g) || []).length, 3);
assert.strictEqual((devHtml.match(/\?v=communicative-formal-speech-fallback-v1/g) || []).length, 0);
assert(!devHtml.includes("engine/managers/question-manager.js?v=communicative-formal-v1"));
assert(devHtml.includes('<script src="dev/formal-speech-trace.js?v=communicative-formal-trace-v1"></script>'));
assert(devHtml.includes('<script src="dev/communicative-judge-pilot.js?v=communicative-formal-trace-v1"></script>'));
assert(devHtml.includes('<script src="dev/communicative-question-manager-playtest.js?v=communicative-formal-trace-v1"></script>'));
assert.strictEqual(hash("dev/formal-speech-trace.js"), "dea48c46f18f757dde5c119fa7226f7340030b9371f42647116823a6f8c49901");
assert.strictEqual(hash("dev/communicative-judge-pilot.js"), "e1a0a13cea7dd0bfc429fadeb82065ba12be4aff1d5aa3bcc93add37f60ad2f0");
assert.strictEqual(hash("dev/communicative-question-manager-playtest.js"), "1cce50bfddfa360319fdd335333ccd785f30dac5d0f255dc626860f2ade0f87e");
assert.strictEqual(hash("dev/dev-checkpoints.js"), "3fd716b3363cb2412a33ad9b5ae4ea5a048a22bc27696857f29050c5b8a51ea1");
assert.strictEqual(hash("dev/dev-jump-manager.js"), "2404155bf8862ae2a3e91d236a87841ecdcc9391ceeae042643a648407bcfa33");
assert.strictEqual(hash("dev/dev-jump-ui.js"), "a1f534af7a55743243bd219f677b1770d4aa26c40221ab00d8d3c698728d8e9e");
assert.strictEqual(hash("dev/dev-jump-runtime-trace.js"), "adbc79a576ad565723f0a0a55182904cd8355b93b2a03be776d3a6b2c1cc0a53");
const checkpoints = read("dev/dev-checkpoints.js");
for (const target of ["S001", "S002", "S003", "m002", "CAMP_M002", "S004", "m003", "st004"]) {
  assert(checkpoints.includes(`id: "${target}"`), `Dev Jump target remains available: ${target}`);
}
assert(read("engine/stories/S004.js").includes('C.question("phrase.are_you_ok", "askBernie")'),
  "S004 must route phrase.are_you_ok through the question command");

const speechCalls = [];
const context = { console, window: {}, setTimeout, clearTimeout };
context.window = context;
context.document = {
  getElementById(id) {
    if (id !== "controls") return null;
    return { appendChild(button) { Promise.resolve().then(() => button.click()); } };
  }
};
context.GameConfig = { defaultLanguage: "ja-JP", dialogueNextLabel: "next" };
context.StoryEvents = { async emit() {} };
context.GameCore = { clearVisuals() {}, async speechMission() { throw new Error("legacy-flow-used"); } };
context.EffectManager = {};
context.CharacterManager = {};
context.MonsterManager = {};
context.DialogManager = {
  button(label, onClick) { return { label, click: onClick }; },
  show() {}, showRecognized() {}, hideRecognized() {},
  async choice() { throw new Error("unexpected-recovery"); },
  async textInput() { throw new Error("unexpected-text-fallback"); },
  async next() { return "next"; }
};
context.AudioManager = { stopAll() {} };
context.VideoManager = {};
context.SaveManager = {};
context.PicoBreakManager = {};
context.CampManager = {};
context.MorningManager = {};
context.MonsterBattleManager = {};
context.SpeechStartController = {
  async prepare() {},
  async startListening(options) {
    speechCalls.push(options);
    if (options.onAlternatives) options.onAlternatives(["Are you okay?"]);
    return "Are you OK?";
  },
  cancel() {}
};
context.SpeechEngine = { getStatus: () => "idle", stop() {}, async listen() { throw new Error("direct-speech-engine-used"); } };
vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }
[
  "engine/services/speech-normalizer.js",
  "data/word-dictionaries.js",
  "data/questions.js",
  "data/communicative-judge-rules.js",
  "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js",
  "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js",
  "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js",
  "engine/commands/story-commands.js",
  "engine/core/story-engine.js"
].forEach(load);

(async () => {
  assert(context.CommunicativeQuestionPresenter, "Production Presenter must be loaded in dev runtime");
  assert(context.CommunicativeQuestionFlowController, "Production Flow Controller must be loaded before S004");
  const question = context.QuestionDatabase.get("phrase.are_you_ok");
  assert(question && question.communicative, "phrase.are_you_ok must select Formal flow");
  const state = {};
  let thrown = null;
  try {
    await context.StoryEngine.runStep({ type: "question", questionId: "phrase.are_you_ok", saveAs: "askBernie" }, state, 0, { id: "S004" });
  } catch (error) {
    thrown = error;
  }
  assert.strictEqual(thrown, null, thrown && thrown.message);
  assert.strictEqual(speechCalls.length, 1, "S004 Formal flow must reach shared SpeechStartController");
  assert.strictEqual(state.askBernie.status, "success");
  assert.strictEqual(state.askBernie.resolution, "accepted");
  assert.strictEqual(state.askBernie.judgeMode, "communicative");
  assert(!String(thrown && thrown.message).includes("Communicative Question Flow Controller is not loaded."));
  console.log("Dev Jump Formal Communicative Runtime V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
