const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = [];
const context = {
  console,
  window: {},
  GameConfig: { dialogueNextLabel: "次へ" },
  EffectManager: {
    setBackground: src => calls.push(["background", src]),
    setFilter: visible => calls.push(["filter", visible]),
    play: async (key, ms) => calls.push(["effect", key, ms]),
    wait: async ms => calls.push(["wait", ms])
  },
  DialogManager: {
    show: (speaker, text) => calls.push(["dialogue", speaker, text]),
    next: async button => calls.push(["next", button]),
    hide: () => calls.push(["hide", context.CampManager.getResult().status])
  },
  AudioManager: {
    playSe: key => calls.push(["audio", key]),
    playBgm: (key, options) => calls.push(["bgm", key, options]),
    stopBgm: () => calls.push(["stopBgm"])
  },
  SaveManager: { getCompanionIds: () => [1, 2] },
  CharacterManager: {
    clear: () => calls.push(["charactersClear"]),
    show: items => calls.push(["characters", items]),
    addFloatingText: (text, className) => calls.push(["floatingText", text, className])
  },
  MonsterBattleData: null,
  MonsterDatabase: null
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("data/poses.js");
load("data/characters.js");
load("data/camps.js");
load("data/word-dictionaries.js");
load("data/questions.js");
load("data/monsters.js");
load("engine/services/monster-battle-data.js");
load("engine/managers/camp-manager.js");

(async () => {
  assert.deepStrictEqual(
    Object.keys(context.CampManager).sort(),
    ["cancel", "getResult", "reset", "start"]
  );

  const normal = await context.CampManager.start("CAMP_001");
  assert.strictEqual(normal.status, "completed");
  assert.strictEqual(normal.recovery, undefined);
  assert.strictEqual(normal.morning, undefined);
  assert.strictEqual(normal.picoBreak, undefined);
  assert.strictEqual(normal.completedSteps, 6);
  const bgmCalls = calls.filter(call => call[0] === "bgm");
  assert.strictEqual(bgmCalls.length, 1);
  assert.strictEqual(bgmCalls[0][1], "campNightAtmosphere");
  assert.strictEqual(bgmCalls[0][2].loop, true);
  assert.strictEqual(bgmCalls[0][2].volume, 0.52);
  assert.strictEqual(calls.filter(call => call[0] === "stopBgm").length, 2,
    "Camp pre-start cancellation and completion must leave no ambience running");
  assert.deepStrictEqual(calls.filter(call => call[0] === "background"), [
    ["background", "camp"]
  ]);
  assert.strictEqual(calls.filter(call => call[0] === "characters")[0][1].length, 2);
  assert.strictEqual(calls.filter(call => call[0] === "floatingText").length, 1,
    "only the sleeping companion receives Zzz");
  assert(calls.some(call => call[0] === "hide" && call[1] === "running"));
  const finalWait = calls.findIndex(call => call[0] === "wait" && call[1] === 1000);
  const finalClear = calls.map(call => call[0]).lastIndexOf("charactersClear");
  const hideBeforeWait = calls.slice(0, finalWait).map(call => call[0]).lastIndexOf("hide");
  assert(hideBeforeWait !== -1 && hideBeforeWait < finalWait && finalWait < finalClear,
    "final click must hide Dialog, hold the Camp graphic for 1 second, then clear");
  assert.strictEqual(context.CampManager.getResult().status, "completed");

  calls.length = 0;
  const pseudo = await context.CampManager.start("CAMP_M001_1");
  assert.strictEqual(pseudo.status, "completed");
  assert.strictEqual(pseudo.recovery, undefined);
  assert.strictEqual(pseudo.morning, undefined);
  assert.strictEqual(pseudo.completedSteps, 1);
  assert.strictEqual(calls.filter(call => call[0] === "bgm").length, 0,
    "pseudo Camp must not start the normal night atmosphere");
  assert(calls.some(call => call[0] === "dialogue" && call[2].includes("ネットや辞書")));
  assert.deepStrictEqual(calls[calls.length - 1], ["hide", "running"]);

  context.CampDatabase.register({ id: "CAMP_DISABLED", enabled: false });
  const disabled = await context.CampManager.start("CAMP_DISABLED");
  assert.strictEqual(disabled.status, "disabled");

  let release;
  context.CampDatabase.register({
    id: "CAMP_CANCEL",
    steps: [{ type: "dialogue", text: "wait" }]
  });
  context.DialogManager.next = () => new Promise(resolve => { release = resolve; });
  const pending = context.CampManager.start("CAMP_CANCEL");
  await Promise.resolve();
  const cancelled = context.CampManager.cancel();
  assert.strictEqual(cancelled.status, "cancelled");
  release();
  assert.strictEqual((await pending).status, "cancelled");

  context.CampManager.reset();
  assert.strictEqual(context.CampManager.getResult(), null);
  await assert.rejects(() => context.CampManager.start("UNKNOWN"), /Camp not found/);
  console.log("Camp Manager tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
