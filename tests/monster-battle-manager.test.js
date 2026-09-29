const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = { effects: [], audio: [], hints: [], saves: [], damage: [], timeline: [], recognized: [], waits: [] };
const results = Array(3).fill(null).map(() => ({ status: "failure", answer: "wrong" })).concat([
  { status: "success", answer: "apple" },
  { status: "success", answer: "apples" },
  { status: "success", answer: "banana" },
  { status: "success", answer: "orange" }
]);
const rescueActions = ["retry", "adventure_return"];
const context = {
  console,
  window: {},
  AudioDatabase: {
    se: {
      monsterWarningTensePiano: "audio/se/se_monster_warning_tense_piano_v1.mp3",
      battleHit: "audio/se/battle_hit.mp3",
      battlePurify: "audio/se/battle_purify.mp3",
      monsterDefeatExplosion: "audio/se/se_monster_defeat_explosion_v1.mp3"
    }
  },
  QuestionManager: {
    start: async id => Object.assign({ questionId: id }, results.shift()),
    cancel: () => ({ status: "cancelled" })
  },
  EffectManager: {
    play: async key => { calls.effects.push(key); },
    wait: async ms => { calls.waits.push(ms); },
    setBattleDamage: level => { calls.damage.push(level); },
    playPseudoCampTransition: async () => { calls.timeline.push("transition"); }
  },
  GameConfig: { dialogueNextLabel: "次へ" },
  DialogManager: {
    show: (npcId, hint) => {
      calls.hints.push([
        npcId,
        hint,
        context.MonsterBattleManager.getContext().failureCount,
        context.MonsterBattleManager.getContext().hintLevel
      ]);
      if (/ネット|画像検索|Apple, banana/.test(hint)) calls.timeline.push("hint");
    },
    showRecognized: (text, prefix) => { calls.recognized.push([prefix, text]); },
    next: async () => {},
    choice: async () => "adventure_return",
    hide: () => {}
  },
  FiniteRescue: {
    isImmediateTechnicalFailure: error => String(error || "").includes("not-allowed"),
    choose: async () => rescueActions.shift() || "adventure_return",
    consume: () => null
  },
  PicoBreakManager: { showSelected: async () => false },
  AudioManager: { playSe: key => { calls.audio.push(key); } },
  SaveManager: {
    recordMonsterEncounter: id => calls.saves.push(["encounter", id]),
    recordMonsterDefeat: id => calls.saves.push(["defeat", id])
  },
  MonsterBattlePresenter: { showMonster: () => {} }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/word-dictionaries.js");
load("data/questions.js");
load("data/monsters.js");
load("data/camps.js");
load("engine/services/monster-battle-data.js");
load("engine/managers/camp-manager.js");
load("engine/managers/monster-battle-manager.js");

(async () => {
  const result = await context.MonsterBattleManager.start("m001");
  assert.strictEqual(result.phase, "COMPLETE");
  assert.strictEqual(result.failureCount, 4);
  assert.strictEqual(result.retreatCount, 0);
  assert.strictEqual(result.hintLevel, 0);
  assert.strictEqual(result.hintNpcId, "pico");
  assert.strictEqual(result.requiredHits, 3);
  assert.strictEqual(result.hitCount, 3);
  assert.deepStrictEqual(Array.from(result.acceptedAnswers), ["apple", "banana", "orange"]);
  assert.strictEqual(result.cleared, true);
  assert.strictEqual(result.aborted, false);
  const pseudoHints = calls.hints.filter(item => /ネット|画像検索|Apple, banana/.test(item[1]));
  assert.strictEqual(pseudoHints.length, 0, "Finite Rescue must not enter pseudo Camp");
  assert.strictEqual(calls.hints.filter(item => item[1] === "One more fruit!").length, 1,
    "a duplicate fruit must prompt and connect to the finite failure count");
  assert(calls.hints.some(item => item[1].includes("ポンコツでごめんね")));
  assert(calls.hints.some(item => item[1].includes("色や形")));
  assert(calls.hints.some(item => item[1].includes("いったん休んで")));
  assert.deepStrictEqual(calls.damage, [0, 1, 2, 3, 0]);
  assert.strictEqual(calls.recognized.filter(item => item[1] === "wrong").length, 6,
    "each failed recognition must remain visible in the support message");
  ["apple", "apples", "banana", "orange"].forEach(word => {
    assert(calls.recognized.some(item => item[1] === word), `recognized word must be shown: ${word}`);
  });
  assert(calls.recognized.every(item => item[0] === "聞き取った言葉："));
  assert.strictEqual(calls.waits.filter(ms => ms === 1600).length, 7);
  assert.deepStrictEqual(calls.timeline, [], "Finite Rescue removes pseudo Camp repetition");
  assert.deepStrictEqual(calls.saves, [["encounter", "m001"], ["defeat", "m001"]]);
  assert.strictEqual(calls.audio.filter(key => key === "monsterWarningTensePiano").length, 1,
    "Monster Warning must play once at the shared battle entrance");
  assert.strictEqual(calls.audio.filter(key => key === "battleHit").length, 3,
    "Battle Hit must play once per newly accepted correct answer");
  assert.strictEqual(calls.audio.filter(key => key === "battlePurify").length, 0,
    "m001 explosion/defeat must not use the purification sound");
  assert.strictEqual(calls.audio.filter(key => key === "monsterDefeatExplosion").length, 1,
    "m001 explosion graphic must play its dedicated defeat sound exactly once");
  assert(Object.isFrozen(context.MonsterBattleManager.PHASE));

  const monster = context.MonsterDatabase.get("m001");
  assert.strictEqual(monster.questionId, "word.fruit");
  assert.strictEqual(monster.battle.requiredUniqueAnswers, 3);
  assert.strictEqual(monster.answers, undefined);

  load("engine/core/story-compiler.js");
  const command = context.StoryCompiler.commandFromText("MONSTER_BATTLE m001");
  assert.strictEqual(command.type, "monsterBattle");
  assert.strictEqual(command.monsterId, "m001");
  assert.strictEqual(context.MonsterDatabase.get("M001").monsterId, "m001",
    "legacy uppercase input must normalize to the lowercase canonical id");

  context.QuestionManager.start = async () => ({
    status: "failure",
    error: "not-allowed"
  });
  const rescued = await context.MonsterBattleManager.start("m001");
  assert.strictEqual(rescued.controlResult, "adventure_return");
  assert.strictEqual(context.MonsterBattleManager.getContext().failureCount, 0,
    "technical Speech failure must not count as a Vocabulary failure");
  assert.strictEqual(context.MonsterBattleManager.getContext().aborted, true);
  assert.strictEqual(calls.damage.at(-1), 0, "damage must be cleared after an error");
  console.log("Monster Battle Manager tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
