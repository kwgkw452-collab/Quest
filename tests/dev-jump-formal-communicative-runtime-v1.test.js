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
  "index.html": "6c4ecbb8c3b250eba9b83d397ea3bca134cc491ef1dd648473c0a556f7c7d78d",
  "data/questions.js": "7f94f150fff8ef7af49e4bd7f86614900eafb0fb1d3d772861142feb68d75904",
  "data/communicative-judge-rules.js": "acae74a247318a54ef09ac75c04c444c14dedc798c67abf3b793fc0529dd9279",
  "engine/services/local-communicative-judge.js": "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58",
  "engine/services/communicative-judge.js": "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04",
  "engine/services/communicative-question-adapter.js": "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f",
  "engine/managers/question-manager.js": "98047b0cb21bd12f4fd5e2c432ea28836a6b82b7b0a3067639781ad538d87c6d",
  "engine/presenters/communicative-question-presenter.js": "8272cb38358bd5f4e4190a826e75bd07143eee3f8fd1f24e731e9263413a2e67",
  "engine/controllers/communicative-question-flow-controller.js": "8bf9a35dc37a6296b8afc0924e41824f3ae8a7a71f5eefbc5a624f05828f200e",
  "engine/core/story-engine.js": "ecca2bac442d5002fec99d8f9e826756bee6afd2efd24a093c187d041f5afbeb",
  "engine/stories/S004.js": "ca801b7658fe1bddf98cf8c21ee1794adf602b68afa5a7f94599758fb3437070"
};
for (const [file, expected] of Object.entries(productionHashes)) {
  assert.strictEqual(hash(file), expected, `${file} must remain unchanged`);
}

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
assert.strictEqual((devHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 6);
assert.strictEqual((devHtml.match(/\?v=communicative-formal-trace-v1/g) || []).length, 3);
assert.strictEqual((devHtml.match(/\?v=communicative-formal-speech-fallback-v1/g) || []).length, 0);
assert(!devHtml.includes("engine/managers/question-manager.js?v=communicative-formal-v1"));
assert(devHtml.includes('<script src="dev/formal-speech-trace.js?v=communicative-formal-trace-v1"></script>'));
assert(devHtml.includes('<script src="dev/communicative-judge-pilot.js?v=communicative-formal-trace-v1"></script>'));
assert(devHtml.includes('<script src="dev/communicative-question-manager-playtest.js?v=communicative-formal-trace-v1"></script>'));
assert.strictEqual(hash("dev/formal-speech-trace.js"), "dea48c46f18f757dde5c119fa7226f7340030b9371f42647116823a6f8c49901");
assert.strictEqual(hash("dev/communicative-judge-pilot.js"), "96b9dc24d72b9d7bc9857662e9a81dac170ea329da6f59930850d9eb8023bc7d");
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
