"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function runtime(results, rescueActions) {
  const calls = { shown: [], saves: [], choices: 0, effects: [], audio: [], states: [], events: [] };
  const context = {
    console,
    window: {},
    AudioDatabase: { se: {
      monsterWarningTensePiano: "warning.mp3", monsterWarningReveal: "reveal.mp3",
      battleHit: "hit.mp3", battlePurify: "purify.mp3", monsterDefeatExplosion: "explosion.mp3"
    } },
    QuestionManager: {
      start: async () => results.shift() || { status: "failure", answer: "wrong" },
      cancel: () => ({ status: "cancelled" })
    },
    EffectManager: {
      play: async key => calls.effects.push(key), wait: async () => {},
      setBattleDamage: () => {}, setBackground: () => {}
    },
    AudioManager: {
      playSe: key => calls.audio.push(key), playBgm: key => calls.audio.push(key), stopAll: () => {}
    },
    SaveManager: {
      recordMonsterEncounter: id => calls.saves.push(["encounter", id]),
      recordMonsterDefeat: id => calls.saves.push(["defeat", id])
    },
    MonsterBattlePresenter: { showMonster: (_monster, state) => calls.states.push(state) },
    CampManager: { start: async () => ({ status: "completed" }), cancel: () => {} },
    DialogManager: {
      show: (speaker, text) => calls.shown.push([speaker, text]), showRecognized: () => {},
      next: async () => {}, choice: async () => "adventure_return", hide: () => {}
    },
    FiniteRescue: {
      isImmediateTechnicalFailure(error) {
        const code = String(error && error.message ? error.message : error || "").toLowerCase();
        return /not-allowed|permission|unsupported|start-failure|recognition-start-failure/.test(code);
      },
      async choose() { calls.choices += 1; return rescueActions.shift() || "adventure_return"; },
      consume: () => null,
      result: error => ({ status: "adventure_return", controlResult: "adventure_return", error })
    },
    GameConfig: { dialogueNextLabel: "次へ" },
    GameCore: { clearVisuals: () => {}, choice: async () => "next" },
    CharacterManager: { show: () => {}, changeImage: () => {}, addFloatingText: () => {} },
    MonsterManager: { show: () => {}, changeState: () => {}, clear: () => {} },
    VideoManager: { play: async () => {}, clear: () => {} },
    PicoBreakManager: {}, MorningManager: {}, StoryEvents: { emit: async name => calls.events.push(name) }
  };
  context.window = context;
  vm.createContext(context);
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  [
    "data/word-dictionaries.js", "data/questions.js", "data/monsters.js",
    "engine/services/monster-battle-data.js", "engine/managers/monster-battle-manager.js"
  ].forEach(load);
  return { context, calls, load };
}

(async () => {
  {
    const managerSource = fs.readFileSync(path.join(root, "engine/managers/monster-battle-manager.js"), "utf8");
    const monsterSource = fs.readFileSync(path.join(root, "data/monsters.js"), "utf8");
    assert(managerSource.includes('playRegisteredAudio("battleHit", { volume: 0.80 });'),
      "V1 must use the shared battleHit SE");
    assert(!/hitSe|hitAudio/.test(monsterSource), "V1 Monster Database must not add a per-Monster hit SE field");
  }

  {
    const repeated = runtime([
      { status: "success", answer: "apple" },
      { status: "success", answer: "apples" },
      { status: "success", answer: "apple" },
      { status: "success", answer: "apples" },
      { status: "success", answer: "apple" }
    ], ["adventure_return"]);
    const result = await repeated.context.MonsterBattleManager.start("m001");
    assert.strictEqual(result.cleared, false);
    assert.strictEqual(result.failureCount, 4);
    assert.strictEqual(result.hitCount, 1, "duplicate canonical must not become a new hit");
    assert.strictEqual(result.controlResult, "adventure_return");
    assert.strictEqual(repeated.calls.choices, 1, "duplicate repetition must reach Rescue finitely");
  }

  for (const error of ["no-speech", "speech-timeout", "permission denied",
    "recognition-start-failure", "unsupported", "browser recognition error"]) {
    const technical = runtime([{ status: "speech-failure", error }], ["adventure_return"]);
    const result = await technical.context.MonsterBattleManager.start("m001");
    assert.strictEqual(result.cleared, false, error);
    assert.strictEqual(result.failureCount, 0, error + " must not be a Vocabulary failure");
    assert.strictEqual(result.controlResult, "adventure_return", error);
    assert.strictEqual(technical.calls.choices, 1, error + " must reach speech Rescue");
    assert(!technical.calls.shown.some(call => /辞書にはない/.test(call[1])), error + " must not show Vocabulary REJECT support");
  }

  for (const monsterId of ["m001", "m002", "m003"]) {
    const failed = runtime(Array(4).fill(null).map(() => ({ status: "failure", answer: "wrong" })), ["adventure_return"]);
    const result = await failed.context.MonsterBattleManager.start(monsterId);
    assert.strictEqual(result.cleared, false, monsterId);
    assert.strictEqual(result.aborted, true, monsterId);
    assert.strictEqual(result.controlResult, "adventure_return", monsterId);
    assert.strictEqual(result.failureCount, 4, monsterId);
    assert(!failed.calls.saves.some(call => call[0] === "defeat"), monsterId + " must not record clear");
  }

  {
    const story = runtime(Array(4).fill(null).map(() => ({ status: "failure", answer: "wrong" })), ["adventure_return"]);
    ["engine/core/story-registry.js", "engine/commands/story-commands.js", "engine/core/story-engine.js",
      "engine/stories/m001.js"].forEach(story.load);
    const state = await story.context.StoryEngine.playById("m001");
    assert.strictEqual(state.fruitBattle.cleared, false);
    assert.strictEqual(state.stepIndex, 7, "Adventure Return must continue through the real m001 Story");
    assert(!story.calls.shown.some(call => call[1] === "Great! So much delicious fruit!"),
      "m001 success-only completion dialogue must not be shown");
    assert(story.calls.events.includes("story:complete"), "Story must continue through its normal completion event");
  }

  {
    const boundary = runtime(Array(8).fill(null).map(() => ({ status: "failure", answer: "wrong" })),
      ["adventure_return", "adventure_return"]);
    ["engine/core/story-registry.js", "engine/commands/story-commands.js", "engine/core/story-engine.js",
      "engine/stories/S003.js", "engine/stories/S004.js", "engine/stories/story-saki-departure.js"].forEach(boundary.load);
    const state = {};
    const s003 = boundary.context.StoryRegistry.get("S003");
    const s004 = boundary.context.StoryRegistry.get("S004");
    const st004 = boundary.context.StoryRegistry.get("st004");

    await boundary.context.StoryEngine.runStep(s003.steps[1], state, 1, s003);
    await boundary.context.StoryEngine.runStep(s003.steps[2], state, 2, s003);
    await boundary.context.StoryEngine.runStep(s004.steps[3], state, 3, s004);
    assert(boundary.calls.shown.some(call => call[1] === "一行は森の中を進んでいた。"),
      "m002 Adventure Return must not suppress the first S004 dialogue");

    await boundary.context.StoryEngine.runStep(s004.steps.at(-1), state, s004.steps.length - 1, s004);
    const firstSt004Dialogue = st004.steps.find(step => step.type === "dialogue");
    await boundary.context.StoryEngine.runStep(firstSt004Dialogue, state, 0, st004);
    assert(boundary.calls.shown.some(call => call[1] === "Wow!"),
      "m003 Adventure Return must not suppress the first st004 dialogue");
    assert(!Object.prototype.hasOwnProperty.call(state, "__skipMonsterCompletionDialogue"),
      "no dialogue suppression flag may cross a Story boundary");
  }

  console.log("Monster Battle Template V1 P0 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
