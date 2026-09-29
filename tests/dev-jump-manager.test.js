const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
const normalSaveText = JSON.stringify({ player: { name: "Hiro" }, party: { companionIds: [99] } });
let imported = null;
let saveData = { player: { name: "Old Dev" } };

const context = {
  console,
  localStorage: {
    getItem(key) {
      calls.push(["storage.get", key]);
      return key === "eigo-de-quest:save:v2" ? normalSaveText : null;
    },
    setItem() { throw new Error("DevJumpManager must not write normal localStorage directly"); }
  },
  SaveManager: {
    getData() { return JSON.parse(JSON.stringify(saveData)); },
    importData(text) {
      imported = JSON.parse(text);
      saveData = JSON.parse(JSON.stringify(imported));
      calls.push(["save.import"]);
      return imported;
    },
    completeStory(id) {
      if (!saveData.progress.completedStories.includes(id)) saveData.progress.completedStories.push(id);
      calls.push(["save.complete", id]);
    }
  },
  SceneManager: {
    isRunning() { return false; },
    async start(id, state) { calls.push(["story", id, state.playerName]); return state; }
  },
  MonsterBattleManager: {
    cancel() { calls.push(["monster.cancel"]); },
    async start(id) { calls.push(["monster", id]); return { cleared: true, aborted: false }; }
  },
  CampManager: {
    cancel() { calls.push(["camp.cancel"]); },
    async start(id) { calls.push(["camp", id]); return { status: "completed" }; }
  },
  MorningManager: { cancel() { calls.push(["morning.cancel"]); } },
  QuestionManager: { cancel() { calls.push(["question.cancel"]); } },
  SpeechEngine: { stop() { calls.push(["speech.stop"]); } },
  AudioManager: { stopAll() { calls.push(["audio.stopAll"]); } },
  VideoManager: { clear() { calls.push(["video.clear"]); } },
  DialogManager: {
    hideRecognized() { calls.push(["dialog.hideRecognized"]); },
    hide() { calls.push(["dialog.hide"]); }
  },
  CharacterManager: { clear() { calls.push(["character.clear"]); } },
  MonsterManager: { clear() { calls.push(["monster.clear"]); } },
  EffectManager: {
    setBattleDamage() { calls.push(["effect.damage"]); },
    setFilter() { calls.push(["effect.filter"]); }
  },
  GameCore: { clearVisuals() { calls.push(["visual.clear"]); } }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "dev/dev-checkpoints.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "dev/dev-jump-manager.js"), "utf8"), context);

async function run(id) {
  calls.length = 0;
  imported = null;
  saveData = { player: { name: "Old Dev" } };
  await context.DevJumpManager.start(id);
  return { calls: calls.slice(), imported: JSON.parse(JSON.stringify(imported)) };
}

(async () => {
  const checkpoints = JSON.parse(JSON.stringify(context.DevCheckpointDatabase.list()));
  for (const checkpoint of checkpoints) {
    const result = await run(checkpoint.id);
    assert.deepStrictEqual(result.imported.party.companionIds, checkpoint.party, checkpoint.id);
    assert.deepStrictEqual(result.imported.progress.completedStories, checkpoint.completedStories, checkpoint.id);
    assert.deepStrictEqual(result.imported.bestiary, checkpoint.bestiary, checkpoint.id);
    assert.strictEqual(result.imported.player.name, "Hiro", checkpoint.id);
    assert(result.calls.some(call => call[0] === "audio.stopAll"), checkpoint.id);
    assert(result.calls.some(call => call[0] === "question.cancel"), checkpoint.id);
    assert(result.calls.some(call => call[0] === "speech.stop"), checkpoint.id);
    assert(!result.imported.party.companionIds.includes(99), checkpoint.id);
  }

  const m002 = await run("M002_BATTLE");
  assert.deepStrictEqual(m002.calls.filter(call => ["monster", "camp", "story"].includes(call[0])), [
    ["monster", "m002"], ["camp", "CAMP_M002"], ["story", "S004", "Hiro"]
  ]);
  assert(m002.calls.some(call => call[0] === "save.complete" && call[1] === "S003"));

  const camp = await run("CAMP_M002");
  assert.deepStrictEqual(camp.calls.filter(call => ["camp", "story"].includes(call[0])), [
    ["camp", "CAMP_M002"], ["story", "S004", "Hiro"]
  ]);

  const m003 = await run("M003_BATTLE");
  assert.deepStrictEqual(m003.calls.filter(call => ["monster", "story"].includes(call[0])), [
    ["monster", "m003"], ["story", "st004", "Hiro"]
  ]);
  assert(m003.calls.some(call => call[0] === "save.complete" && call[1] === "S004"));

  const m004 = await run("M004");
  assert.deepStrictEqual(m004.calls.filter(call => call[0] === "story"), [
    ["story", "m004", "Hiro"]
  ]);

  assert.strictEqual(JSON.parse(normalSaveText).party.companionIds[0], 99);
  console.log("dev-jump-manager.test.js: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
