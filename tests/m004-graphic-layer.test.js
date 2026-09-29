"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

function runtime(queue, rescueActions) {
  rescueActions = rescueActions || [];
  const calls = { layers: [], dialogue: [], support: [], se: [], bgm: [] };
  const context = {
    console, window: null,
    AudioDatabase: { se: {
      monsterWarningReveal: "warning.mp3", battleHit: "hit.mp3", battlePurify: "success.mp3",
      m004RecoveryMagic: "recovery.mp3", m004CompletionFanfare: "fanfare.mp3", zephyrGo: "go.mp3"
    } },
    QuestionManager: { start: async () => queue.shift(), cancel() {} },
    EffectManager: { async play() {}, async wait() {}, setBattleDamage() {}, setBackground() {} },
    AudioManager: { playSe: key => calls.se.push(key), playBgm: key => calls.bgm.push(key), async stopBgm() { calls.bgm.push("stop"); } },
    SaveManager: { recordMonsterEncounter() {}, recordMonsterDefeat() {} },
    MonsterManager: { showLayers: (_id, layers) => calls.layers.push(Array.from(layers)), show() {}, clear() {} },
    CampManager: { cancel() {} },
    DialogManager: { show: (speaker, text) => calls.dialogue.push([speaker, text]), showRecognized() {}, async next() {} },
    PicoSupportController: {
      async present(line) {
        const shown = line.initialView === "japanese" ? line.supportText : line.text;
        calls.support.push(shown);
        calls.dialogue.push([line.speaker, shown]);
      },
      dismiss() {}
    },
    FiniteRescue: {
      consume: () => null,
      isImmediateTechnicalFailure: () => false,
      async choose() { return rescueActions.shift() || "adventure_return"; }
    },
    SpeechRecognitionAdapter: { async listen() { return "eyes"; } }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of [
    "data/word-dictionaries.js", "data/questions.js", "data/monsters.js", "data/m004.js",
    "engine/services/monster-battle-data.js", "engine/managers/monster-battle-presenter.js",
    "engine/managers/monster-battle-manager.js", "engine/services/m004-battle-extension.js"
  ]) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  return { context, calls };
}

const hit = answer => ({ status: "success", answer });
(async () => {
  const run = runtime([hit("eyes"), hit("nose"), hit("mouth"), hit("ears")]);
  const monster = run.context.MonsterDatabase.get("m004");
  assert.equal(monster.battle.requiredUniqueAnswers, 4);
  assert.deepEqual(Array.from(run.context.WordDictionaryDatabase.get("face-parts.v1").entries, x => x.canonical),
    ["eyes", "nose", "mouth", "ears"]);
  for (const word of ["hair", "here", "hare", "air", "hear"])
    assert.equal(run.context.MonsterBattleData.canonicalAnswer(monster, word), null);

  const result = await run.context.MonsterBattleManager.start("m004");
  assert.equal(result.cleared, true);
  assert.deepEqual(Array.from(result.acceptedAnswers), ["eyes", "nose", "mouth", "ears"]);
  assert.deepEqual(run.calls.layers.at(-1), ["base", "eyes", "nose", "smile", "ears"]);
  assert(!run.calls.layers.at(-1).includes("mouth"));
  assert(!run.calls.layers.flat().includes("hair"));
  assert.equal(run.calls.se.filter(key => key === "m004RecoveryMagic").length, 3);
  assert.equal(run.calls.se.filter(key => key === "m004CompletionFanfare").length, 1);
  assert.equal(run.calls.se.filter(key => key === "battleHit").length, 0);
  assert.equal(run.calls.se.filter(key => key === "battlePurify").length, 0);
  assert.equal(run.calls.se.filter(key => key === "zephyrGo").length, 1);
  assert.deepEqual(run.calls.bgm, ["stop"]);
  assert.deepEqual(run.calls.dialogue.filter(x => x[0] === "Monster").map(x => x[1]),
    ["My face is back!", "Thank you!", "I'm happy now!"]);

  const aliases = runtime([hit("I"), hit("year"), hit("mouse"), hit("nose")]);
  const aliasResult = await aliases.context.MonsterBattleManager.start("m004");
  assert.deepEqual(Array.from(aliasResult.acceptedAnswers), ["eyes", "ears", "mouth", "nose"]);

  const duplicate = runtime([hit("eyes"), hit("eye"), hit("nose"), hit("mouth"), hit("ears")]);
  const duplicateResult = await duplicate.context.MonsterBattleManager.start("m004");
  assert.equal(duplicateResult.failureCount, 1);
  assert.equal(duplicate.calls.se.filter(key => key === "m004RecoveryMagic").length, 3,
    "duplicate must not play a recovery SE");
  assert.equal(duplicate.calls.se.filter(key => key === "m004CompletionFanfare").length, 1);

  const support = runtime([]);
  support.context.MonsterBattleManager.getContext = () => ({ monsterId: "m004", acceptedAnswers: ["eyes"] });
  const supportMonster = support.context.MonsterBattleData.getMonster("m004");
  assert.equal(supportMonster.battle.supportMessages[0], "まだ、鼻と口と耳が残っているピコ！");
  assert.equal(supportMonster.battle.supportMessages[1], "残っているのは、鼻と口と耳ピコ！");
  assert.equal(supportMonster.battle.supportMessages[2], "nose\nmouth\nears");

  const retrySupport = runtime([
    hit("eyes"),
    { status: "failure", answer: "unknown-1" },
    { status: "failure", answer: "unknown-2" },
    { status: "failure", answer: "unknown-3" },
    { status: "failure", answer: "unknown-4" },
    { status: "failure", answer: "unknown-5" }
  ], ["retry", "adventure_return"]);
  await retrySupport.context.MonsterBattleManager.start("m004");
  const supportLines = retrySupport.calls.support;
  assert.deepEqual(supportLines, [
    "まだ、鼻と口と耳が残っているピコ！",
    "残っているのは、鼻と口と耳ピコ！",
    "nose\nmouth\nears",
    "nose\nmouth\nears",
    "nose\nmouth\nears"
  ], "all support stages and both rescue/retry failures must keep a non-empty remainder hint");

  const speechRetry = runtime([
    hit("eyes"),
    { status: "speech-failure", error: "no-speech" },
    { status: "speech-failure", error: "no-speech" },
    { status: "speech-failure", error: "no-speech" },
    { status: "speech-failure", error: "no-speech" },
    { status: "speech-failure", error: "no-speech" }
  ], ["retry", "adventure_return"]);
  const speechRetryResult = await speechRetry.context.MonsterBattleManager.start("m004");
  assert.equal(speechRetryResult.controlResult, "adventure_return");
  assert.deepEqual(speechRetry.calls.support, [
    "まだ、鼻と口と耳が残っているピコ！",
    "残っているのは、鼻と口と耳ピコ！",
    "nose\nmouth\nears",
    "nose\nmouth\nears",
    "nose\nmouth\nears"
  ], "speech failures must run three support levels before the unlimited final-choice loop");

  for (const part of ["base", "eyes", "nose", "mouth", "ears", "hair", "smile"])
    assert(fs.statSync(path.join(root, monster.image.layers[part])).size > 0);
  console.log("m004 four-part graphic, aliases, support and completion: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
