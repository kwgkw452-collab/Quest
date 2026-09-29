"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function load(context, file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

function createContext(answers) {
  const calls = { backgrounds: [], dialogues: [], questions: [] };
  const queue = answers.slice();
  const context = {
    console,
    window: {},
    GameConfig: { dialogueNextLabel: "次へ", defaultLanguage: "en-US" },
    GameCore: { clearVisuals() {} },
    EffectManager: {
      setBackground(src) { calls.backgrounds.push(src); },
      async wait() {}, async play() {}, async backgroundSequence() {}, async playTravelTransition() {}
    },
    CharacterManager: { show() {}, clear() {}, changeImage() {}, addFloatingText() {} },
    MonsterManager: { show() {}, changeState() {}, clear() {} },
    DialogManager: {
      show(speaker, text) { calls.dialogues.push([speaker, text]); },
      async next() { return "next"; },
      async choice() { return "next"; },
      hide() {}
    },
    QuestionManager: {
      async start(questionId) {
        const answer = queue.shift();
        calls.questions.push([questionId, answer]);
        return { questionId, status: "success", answer, error: null };
      }
    },
    SaveManager: { getData() { return {}; } },
    StoryEvents: { async emit() {} },
    AudioManager: {}, VideoManager: {}, PicoBreakManager: {}, MonsterBattleManager: {}, CampManager: {}, MorningManager: {}
  };
  context.window = context;
  context.calls = calls;
  vm.createContext(context);
  [
    "engine/services/speech-normalizer.js",
    "engine/commands/story-commands.js",
    "engine/core/story-registry.js",
    "engine/core/story-engine.js",
    "engine/core/event-system.js",
    "engine/stories/story-saki-departure.js"
  ].forEach(file => load(context, file));
  return context;
}

function createRealQuestionContext(answer) {
  const context = {
    console,
    window: {},
    SpeechEngine: { getStatus() { return "idle"; }, stop() {} }
  };
  context.window = context;
  vm.createContext(context);
  load(context, "engine/services/speech-normalizer.js");
  context.GameCore = {
    async speechMission(config) {
      return {
        matched: context.SpeechNormalizer.includesAny(answer, config.accepted),
        answer
      };
    }
  };
  load(context, "data/word-dictionaries.js");
  load(context, "data/questions.js");
  load(context, "engine/managers/question-manager.js");
  return context;
}

function findEvent(story) {
  return story.steps.find(step => step.type === "sequence" && step.steps.some(nested =>
    nested.type === "dialogue" && nested.text === "I'm waiting for you."
  ));
}

function flatten(steps) {
  return (steps || []).reduce((all, step) => all.concat(
    step,
    flatten(step.steps),
    flatten(step.thenSteps),
    flatten(step.elseSteps)
  ), []);
}

async function runCase(answers) {
  const context = createContext(answers);
  const story = context.StoryRegistry.get("st004");
  const event = findEvent(story);
  assert(event, "MAP / KEY event must exist");
  await context.StoryEngine.runStep(event, {}, 0, story);
  assert.strictEqual(answers.length, context.calls.questions.length);
  return context;
}

(async () => {
  const definitionContext = createContext([]);
  load(definitionContext, "data/word-dictionaries.js");
  load(definitionContext, "data/questions.js");
  assert.deepStrictEqual(Array.from(definitionContext.QuestionDatabase.get("word.map_or_key").answers), ["map", "key"]);
  assert.deepStrictEqual(Array.from(definitionContext.QuestionDatabase.get("word.map_only").answers), ["map"]);

  const realQuestionContext = createRealQuestionContext("Key.");
  const keyResult = await realQuestionContext.QuestionManager.start("word.map_or_key");
  assert.strictEqual(keyResult.status, "success", "KEY must be a successful Question answer");
  assert.strictEqual(keyResult.answer, "Key.");
  assert.deepStrictEqual(Object.keys(realQuestionContext.QuestionManager).sort(), ["cancel", "getResult", "reset", "start"]);

  const story = definitionContext.StoryRegistry.get("st004");
  const event = findEvent(story);
  const eventSteps = flatten(event.steps);
  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  assert(css.includes('#scene:has(#background[style*="s004_map_key_choice_final.png"]) > .dialogue-box'),
    "MAP / KEY must use a scene-local dialogue position");
  assert(/#scene:has\(#background\[style\*="s004_map_key_choice_final\.png"\]\)\s*>\s*\.dialogue-box\s*\{[^}]*top:\s*25%;[^}]*bottom:\s*auto;/s.test(css),
    "MAP / KEY dialogue must move upward without changing the shared dialogue position");
  assert(/@media \(max-width:\s*700px\)[\s\S]*#scene:has\(#background\[style\*="s004_map_key_choice_final\.png"\]\)\s*>\s*\.dialogue-box\s*\{[^}]*top:\s*24%;/s.test(css),
    "MAP / KEY mobile dialogue must use its scene-local raised position");
  assert(eventSteps.filter(step => step.type === "question").every(step => step.supportMessages === undefined));
  assert(fs.readFileSync(path.join(root, "engine/stories/story-saki-departure.js"), "utf8").includes("SpeechNormalizer.includesAny"));

  const caseA = await runCase(["Map."]);
  assert.deepStrictEqual(caseA.calls.questions.map(item => item[0]), ["word.map_or_key"]);
  assert(!caseA.calls.dialogues.some(item => item[0] === "ピコ"));

  const caseB = await runCase(["KEY!", "map"]);
  assert.deepStrictEqual(caseB.calls.questions.map(item => item[0]), ["word.map_or_key", "word.map_or_key"]);
  assert(caseB.calls.dialogues.some(item => item[1] === "その鍵、気になるピコ！"));

  const caseC = await runCase(["key", "The key.", "MAP!"]);
  assert.deepStrictEqual(caseC.calls.questions.map(item => item[0]), ["word.map_or_key", "word.map_or_key", "word.map_or_key"]);
  assert(caseC.calls.dialogues.some(item => item[1] === "道がわかるものは、どっちかな？"));

  const caseD = await runCase(["key", "key", "key", "map"]);
  assert.deepStrictEqual(caseD.calls.questions.map(item => item[0]), [
    "word.map_or_key", "word.map_or_key", "word.map_or_key", "word.map_only"
  ]);
  assert(caseD.calls.dialogues.some(item => item[1] === "今は MAP を選んで！"));
  assert(caseD.calls.dialogues.some(item => item[1] === "“Map.” と言ってみよう！"));

  [caseA, caseB, caseC, caseD].forEach(context => {
    assert.strictEqual(context.calls.dialogues.filter(item => item[1] === "OK.").length, 1);
    assert(!context.calls.dialogues.some(item => /wrong|incorrect|try again|不正解|違うよ/i.test(item[1])));
    assert(context.calls.backgrounds.includes("images/004/s004_map_key_choice_final.png"));
  });

  console.log("st004 MAP / KEY event test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
