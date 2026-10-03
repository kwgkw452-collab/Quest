"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const s003Runtime = read("engine/stories/S004.js");
const s004Runtime = read("engine/stories/story-saki-departure.js");

assert(s003Runtime.includes('id: "S004"'));
assert(s003Runtime.includes('button: "S003を終了する"'));
assert(!s003Runtime.includes('button: "S004を終了する"'));
assert(s004Runtime.includes('id: "st004"'));
assert(s004Runtime.includes('button: "S004を終了する"'));
assert(!s004Runtime.includes('button: "S003を終了する"'));
assert(s003Runtime.includes('nextStoryId: "st004"'));
assert(s004Runtime.includes('nextStoryId: "m004"'));

for (const page of ["index.html", "dev.html"]) {
  const html = read(page);
  for (const asset of [
    "engine/stories/S004.js",
    "engine/stories/story-saki-departure.js"
  ]) assert(html.includes(asset + "?v=s003-s004-end-label-m004-rescue-v1"), page + ": " + asset);
  assert(html.includes("engine/services/m004-battle-extension.js?v=m004-ears-recognition-rescue-v1"));
}

let battleContext = { monsterId: "m004", acceptedAnswers: [] };
let nextTranscript = "";
const faceParts = { eyes: "eyes", eye: "eyes", nose: "nose", mouth: "mouth", ears: "ears", ear: "ears" };
const context = {
  console,
  window: {},
  setTimeout,
  MonsterBattleData: {
    canonicalAnswer(monster, answer) {
      if (!monster || monster.monsterId !== "m004") return null;
      return faceParts[String(answer || "").toLowerCase()] || null;
    },
    getMonster(id) { return { monsterId: id, battle: { supportMessages: ["", "", ""] } }; },
    getHint() { return null; }
  },
  MonsterBattleManager: {
    getContext() { return battleContext; },
    async start() { return context.QuestionManager.start("word.face-parts", {}); }
  },
  MonsterDatabase: { normalizeId: id => id, get: id => ({ monsterId: id, battle: {} }) },
  MonsterBattlePresenter: { showLayers() {} },
  DialogManager: { next() {}, show() {} },
  SpeechRecognitionAdapter: { async listen() {} },
  QuestionManager: { async start() { return { status: "failure", answer: nextTranscript }; } },
  AudioManager: {},
  FiniteRescue: null
};
context.window = context;
vm.createContext(context);
vm.runInContext(read("engine/services/m004-battle-extension.js"), context);

const m004 = { monsterId: "m004" };
const other = { monsterId: "m001" };
const acceptanceCases = [
  ["eyes", "eyes", "eyes"], ["eyes", "ice", "eyes"],
  ["nose", "nose", "nose"], ["nose", "no", "nose"],
  ["ear", "ear", "ears"], ["ear", "year", "ears"],
  ["ears", "ears", "ears"], ["ears", "years", "ears"], ["ears", "year", "ears"],
  ["ears", "yes", "ears"]
];
for (const [expected, transcript, canonical] of acceptanceCases) {
  battleContext = { monsterId: "m004", acceptedAnswers: ["eyes", "nose", "mouth", "ears"].filter(word => word !== canonical) };
  assert.strictEqual(context.MonsterBattleData.canonicalAnswer(m004, transcript), canonical, expected + " <- " + transcript);
}

battleContext = { monsterId: "m004", acceptedAnswers: ["eyes"] };
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(m004, "ice"), null, "eyes alias is rejected when eyes is not current");
battleContext = { monsterId: "m004", acceptedAnswers: ["nose"] };
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(m004, "no"), null, "nose alias is rejected when nose is not current");
battleContext = { monsterId: "m004", acceptedAnswers: ["ears"] };
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(m004, "year"), null, "ear alias is rejected when ears is not current");
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(m004, "yes"), null, "yes alias is rejected when ears is not current");
battleContext = { monsterId: "m001", acceptedAnswers: [] };
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(m004, "no"), null, "alias requires active m004 context");
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(other, "no"), null, "other Monster does not map no to nose");
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(other, "ice"), null, "other Monster does not map ice to eyes");
assert.strictEqual(context.MonsterBattleData.canonicalAnswer(other, "yes"), null, "other Monster does not map yes to ears");
assert.strictEqual(context.MonsterBattleData.canonicalAnswer({ monsterId: "S005" }, "No."), null, "Story Communication No is isolated");
assert.strictEqual(context.MonsterBattleData.canonicalAnswer({ monsterId: "S005" }, "Yes."), null, "Story Communication Yes is isolated");

(async () => {
  for (const [expected, transcript, canonical] of acceptanceCases) {
    nextTranscript = transcript;
    battleContext = { monsterId: "m004", acceptedAnswers: ["eyes", "nose", "mouth", "ears"].filter(word => word !== canonical) };
    const result = await context.MonsterBattleManager.start("m004");
    assert.strictEqual(result.status, "success", expected + " accepts runtime transcript " + transcript);
  }
  console.log("S003/S004 End Label + m004 Recognition Rescue V1 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
