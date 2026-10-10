"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

function storyRun(results, choices) {
  const calls = { starts: 0, supports: [], choices: [] };
  const queue = results.slice();
  const choiceQueue = choices.slice();
  const context = {
    console, window: {}, GameConfig: {}, StoryEvents: null,
    GameCore: {}, EffectManager: {}, CharacterManager: {}, MonsterManager: {}, AudioManager: {},
    VideoManager: {}, SaveManager: {}, PicoBreakManager: {}, MonsterBattleManager: {}, CampManager: {}, MorningManager: {},
    QuestionDatabase: { get() { return { id: "word.fruit" }; } },
    QuestionManager: {
      async start() { calls.starts += 1; return queue.shift(); },
      cancel() {}
    },
    DialogManager: {
      show(speaker, message) { calls.supports.push([speaker, message]); },
      async next(label) { calls.supports.push(["button", label]); },
      async choice(options) {
        calls.choices.push(options.map(item => item.label));
        return choiceQueue.shift();
      }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("engine/core/story-engine.js"), context);
  const state = {};
  return context.StoryEngine.runStep({
    type: "question", questionId: "word.fruit", saveAs: "answer",
    supportMessages: ["Support 1", "Support 2", "Support 3"]
  }, state, 0, { id: "TEST" }).then(() => ({ result: state.answer, calls }));
}

function legacyRun(errorCode, choices) {
  const pendingChoices = choices.slice();
  let failures = 0;
  const controls = {
    innerHTML: "",
    appendChild(button) { if (button && button.onClick) button.onClick(); }
  };
  const context = {
    console, window: {}, document: { getElementById(id) { return id === "controls" ? controls : {}; } },
    GameConfig: { speechButtonLabel: "Talk", speechSuccessDelayMs: 0 },
    DialogManager: {
      init() {}, show() {}, hideRecognized() {}, showRecognized() {}, textInput() {},
      button(label, onClick) { return { label, onClick }; },
      async next() {}, async choice() { return pendingChoices.shift(); }
    },
    FiniteRescue: {
      pending: null, clear() { this.pending = null; },
      isImmediateTechnicalFailure(error) { return String(error && error.message).includes("not-allowed"); },
      async choose() { return pendingChoices.shift(); },
      result(error) { return { status: "adventure_return", controlResult: "adventure_return", error: error && error.message }; },
      record(value) { this.pending = value; }
    },
    SpeechEngine: {
      mission(config, ui) {
        return new Promise(resolve => {
          function start() {
            failures += 1;
            ui.showRetry(new Error(errorCode), start, config);
          }
          ui.addStartButton(start, config);
        });
      }
    },
    CharacterManager: { init() {}, clear() {} }, MonsterManager: { init() {}, clear() {}, show() {} },
    EffectManager: { init() {}, wait: async () => {} }, VideoManager: { init() {}, clear() {} },
    PicoBreakManager: { init() {} }, AudioManager: {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("engine/core/core.js"), context);
  context.GameCore.cache();
  return context.GameCore.speechMission({ accepted: ["hello"] }).then(result => ({ result, failures }));
}

(async () => {
  const fourFailures = Array(4).fill(null).map(() => ({ status: "failure", answer: "wrong", error: null }));
  let run = await storyRun(fourFailures, ["adventure_return"]);
  assert.strictEqual(run.calls.starts, 4, "Story Question reaches Rescue after Support 3");
  assert.deepStrictEqual(run.calls.supports.filter(item => item[0] === "ピコ").map(item => item[1]),
    ["Support 1", "Support 2", "Support 3"]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(run.calls.choices[0])), ["もう一度言う", "言わずに冒険に戻る"]);
  assert.strictEqual(run.result.controlResult, "adventure_return");

  run = await storyRun(Array(5).fill(null).map(() => ({ status: "failure", answer: "wrong", error: null })),
    ["retry", "adventure_return"]);
  assert.strictEqual(run.calls.starts, 5, "Rescue Retry is limited to one fresh Speech attempt");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(run.calls.choices[1])), ["言わずに冒険に戻る"]);

  let legacy = await legacyRun("no-speech", ["adventure_return"]);
  assert.strictEqual(legacy.failures, 4, "Legacy technical Retry is finite");
  assert.strictEqual(legacy.result.controlResult, "adventure_return");
  legacy = await legacyRun("not-allowed", ["retry", "adventure_return"]);
  assert.strictEqual(legacy.failures, 2, "Immediate technical Rescue permits exactly one retry");

  const monsterSource = read("engine/managers/monster-battle-manager.js");
  assert(!monsterSource.includes("context.failureCount % 3 === 0"), "Monster pseudo Camp retry cycle is disconnected");
  assert(monsterSource.includes("context.failureCount > 3"));
  const morningSource = read("engine/managers/morning-manager.js");
  for (const code of ["not-allowed", "speech-not-supported", "recognition-start-failure"]) {
    assert(read("engine/managers/dialog-manager.js").includes(code), code + " is routed to immediate Rescue");
  }
  assert(morningSource.includes("FiniteRescue.choose(!rescueRetryUsed)"));

  assert(!JSON.stringify({ controlResult: "adventure_return" }).includes("ACCEPT"));
  assert(!JSON.stringify({ controlResult: "adventure_return" }).includes("REJECT"));
  assert(!JSON.stringify({ controlResult: "adventure_return" }).includes("UNKNOWN"));

  assert.strictEqual(sha("engine/services/speech-engine.js"),
    "2d85fa0af3bd8f109ca9d95995361f44e3240e97ce5fba54bed1d14e66260824");
  assert.strictEqual(sha("engine/managers/question-manager.js"),
    "98047b0cb21bd12f4fd5e2c432ea28836a6b82b7b0a3067639781ad538d87c6d");
  assert.strictEqual(sha("data/questions.js"),
    "7f94f150fff8ef7af49e4bd7f86614900eafb0fb1d3d772861142feb68d75904");
  assert.strictEqual(sha("engine/services/communicative-judge.js"),
    "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04");

  console.log("Finite Rescue V1 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
