"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

const index = read("index.html");
for (const file of [
  "engine/managers/dialog-manager.js",
  "engine/managers/morning-manager.js",
  "engine/managers/monster-battle-manager.js",
  "engine/core/core.js",
  "engine/core/story-engine.js",
  "engine/core/scene-manager.js"
]) {
  const version = file === "engine/managers/dialog-manager.js" ? "ui-japanese-v1" :
    file === "engine/core/story-engine.js" || file === "engine/core/scene-manager.js" ?
      "adventure-return-fix-v1" : "finite-rescue-runtime-wiring-v1";
  assert(index.includes(`${file}?v=${version}`), `${file} cache busting`);
  assert(!index.includes(`src="${file}"`), `${file} must not use the unversioned URL`);
}

const protectedHashes = {
  "engine/stories/S001.js": "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1",
  "engine/stories/m001.js": "187c5139107ab8c6f8a35a758d4bc3976f164fe161dccb341926778456fa6e2a",
  "engine/stories/S002.js": "bd05226b3e51d12a27e1504579f69cd97200231a68edecd8a8d6e6b2e7aaf525",
  "engine/stories/S003.js": "e532ff803cf57398d0cd457ba118a9ec004d484af27a77e6fce81dc5da5c991c",
  "engine/stories/S004.js": "b004f23146691f28a420e8918dd61577ad0f45a9daee4af63e2c82c42b0cc905",
  "data/questions.js": "4c3387cce771b78dfaf7e33933a9df43da0defda28b487de84e5ac0b2a611c18",
  "engine/services/communicative-judge.js": "e37901643b7df9799ff9ad743508b0414e58b952777aa81ab97b74dadc218542",
  "engine/services/local-communicative-judge.js": "034cbf4431bcb6d5a1ab3d9afdc8526665d8ea357959383f11faa13fc3baa4d6",
  "engine/controllers/communicative-question-flow-controller.js": "b674ea304e2097350149c7e59394c47bf7a2f5d387555c849d4ebb882936e1b3"
};
for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.strictEqual(hash(file), expected, `${file} must remain unchanged`);
}

function storyContext(results) {
  const calls = { questions: 0, monsters: [], mornings: 0, nextSteps: 0 };
  const context = {
    console, window: {}, GameConfig: {}, StoryEvents: null,
    GameCore: { clearVisuals() {} }, EffectManager: {}, CharacterManager: {}, MonsterManager: {},
    DialogManager: { show() {}, async next() {}, async choice() { return "adventure_return"; } },
    AudioManager: {}, VideoManager: {}, SaveManager: {}, PicoBreakManager: {}, CampManager: {},
    QuestionDatabase: { get() { return { id: "word.test" }; } },
    QuestionManager: { async start() { calls.questions += 1; return results.question; } },
    MonsterBattleManager: { async start(id) { calls.monsters.push(id); return results.monster; } },
    MorningManager: { async start() { calls.mornings += 1; return results.morning; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("engine/core/story-engine.js"), context);
  context.StoryEngine.register("testNext", async function () { calls.nextSteps += 1; });
  return { context, calls };
}

(async () => {
  const rescue = { status: "adventure_return", controlResult: "adventure_return" };

  for (const type of ["question", "monsterBattle", "morning"]) {
    const setup = storyContext({ question: rescue, monster: rescue, morning: rescue });
    const first = type === "question" ? { type, questionId: "word.test" } :
      type === "monsterBattle" ? { type, monsterId: "m001" } : { type, morningId: "MORNING_001" };
    const state = await setup.context.StoryEngine.play({ id: `TEST-${type}`, steps: [first, { type: "testNext" }] }, {});
    assert.strictEqual(state.controlResult, undefined, `${type} consumes the control result at its challenge step`);
    assert.strictEqual(setup.calls.nextSteps, 1, `${type} executes the next step`);
  }

  for (const monsterId of ["m001", "m002", "m003"]) {
    const setup = storyContext({ question: rescue, monster: rescue, morning: rescue });
    const state = await setup.context.StoryEngine.play({
      id: `TEST-${monsterId}`,
      steps: [{ type: "monsterBattle", monsterId, saveAs: "battle" }, { type: "testNext" }]
    }, {});
    assert.deepStrictEqual(setup.calls.monsters, [monsterId]);
    assert.strictEqual(setup.calls.nextSteps, 1, `${monsterId} returns to Story continuation`);
    assert.strictEqual(state.battle.status, "adventure_return", `${monsterId} remains a non-success Rescue result`);
    assert.strictEqual(state.battle.cleared, undefined, `${monsterId} is not recorded as cleared`);
  }

  const legacy = storyContext({ question: rescue, monster: rescue, morning: rescue });
  let pending = rescue;
  legacy.context.GameCore.speechMission = async () => rescue;
  legacy.context.FiniteRescue = {
    consume() { const value = pending; pending = null; return value; }
  };
  const legacyState = await legacy.context.StoryEngine.play({
    id: "TEST-legacy-speech",
    steps: [{ type: "speech", message: "Hello", saveAs: "speech" }, { type: "testNext" }]
  }, {});
  assert.strictEqual(legacy.calls.nextSteps, 1, "Legacy Speech returns to the next Story step");
  assert.strictEqual(legacyState.speech.status, "adventure_return", "Legacy Speech keeps Rescue semantics");
  assert.strictEqual(pending, null, "Legacy Speech consumes the pending control result");

  const success = storyContext({
    question: { status: "success", answer: "hello" },
    monster: { status: "completed", cleared: true },
    morning: { status: "completed" }
  });
  const successState = await success.context.StoryEngine.play({
    id: "SUCCESS", steps: [{ type: "question", questionId: "word.test" }, { type: "testNext" }]
  }, {});
  assert.strictEqual(success.calls.nextSteps, 1, "normal success continues");
  assert.strictEqual(successState.controlResult, undefined);

  const played = [];
  const sceneContext = {
    console, window: {},
    StoryRegistry: { get(id) { return { id, nextStoryId: id === "S001" ? "NEXT" : null }; } },
    StoryEngine: { async play(story) { played.push(story.id); return {}; } },
    AudioManager: { stopAll() {} },
    DialogManager: { hideRecognized() {}, hide() {} }
  };
  sceneContext.window = sceneContext;
  vm.createContext(sceneContext);
  vm.runInContext(read("engine/core/scene-manager.js"), sceneContext);
  const sceneResult = await sceneContext.SceneManager.start("S001", {});
  assert.strictEqual(sceneResult.controlResult, undefined);
  assert.strictEqual(sceneContext.SceneManager.getCurrentStoryId(), "NEXT");
  assert.deepStrictEqual(played, ["S001", "NEXT"], "SceneManager keeps the existing nextStoryId route");

  console.log("Finite Rescue Runtime Wiring V1 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
