"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const calls = { backgrounds: [], items: [], itemClasses: [], characters: [], changes: [], companions: [], dialogues: [], questions: [], battles: [], saves: 0 };
const context = {
  console,
  window: {},
  document: {},
  localStorage: {
    data: Object.create(null),
    setItem(key, value) { this.data[key] = String(value); },
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    removeItem(key) { delete this.data[key]; }
  }
};
context.window = context;
context.addEventListener = function () {};
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

[
  "data/poses.js", "data/characters.js", "data/backgrounds.js", "data/items.js",
  "engine/services/asset-resolver.js", "engine/managers/save-manager.js",
  "engine/commands/story-commands.js", "engine/core/story-compiler.js",
  "engine/core/story-registry.js"
].forEach(load);

context.GameConfig = { initialStoryId: "S001", dialogueNextLabel: "つぎへ" };
context.GameCore = {
  clearVisuals() {},
  showItem(key, className) {
    const resolved = context.AssetResolver.item(key);
    calls.items.push(resolved);
    calls.itemClasses.push(className);
    return { src: resolved };
  },
  async speechMission(config) {
    calls.questions.push(config.message);
    return { matched: true, answer: config.accepted[0] };
  }
};
context.EffectManager = {
  setBackground(key) { calls.backgrounds.push(context.AssetResolver.background(key)); },
  async play() {},
  async wait() {}
};
context.CharacterManager = {
  show(items) {
    calls.characters.push(items.map(item => context.AssetResolver.characterSpec(item)));
  },
  changeImage(id, pose) {
    calls.changes.push([id, context.AssetResolver.character(id, pose)]);
  }
};
context.DialogManager = {
  show(speaker, text) { calls.dialogues.push([speaker, text]); },
  async next() {},
  async choice() { return "next"; }
};
context.MonsterBattleManager = {
  async start(monsterId) {
    calls.battles.push(monsterId);
    return { monsterId, status: "completed", cleared: true };
  }
};
context.AudioManager = { playSe(key) { calls.audio = (calls.audio || []).concat(key); } };
context.CommunicativeQuestionFlowController = {
  async start(id) {
    const question = context.QuestionDatabase.get(id);
    calls.questions.push(question.prompt);
    return { questionId: id, judgeMode: "communicative", status: "success", resolution: "accepted" };
  }
};

["data/word-dictionaries.js", "data/questions.js", "engine/managers/question-manager.js", "engine/core/story-engine.js"].forEach(load);
load("engine/stories/S004.js");

const originalAdd = context.SaveManager.addCompanion;
context.SaveManager.addCompanion = function (id) {
  calls.companions.push(id);
  return originalAdd(id);
};
const originalSave = context.SaveManager.save;
context.SaveManager.save = function () {
  calls.saves += 1;
  return originalSave();
};

(async () => {
  const story = context.StoryRegistry.get("S004");
  assert(story, "S004 must register");
  assert.strictEqual(context.StoryEngine.validate(story).length, 0);
  assert.strictEqual(story.nextStoryId, "st004", "m003 completion must continue to Saki's departure");

  const source = fs.readFileSync(path.join(root, "engine/stories/S004.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
  assert(!/barney/i.test(source));
  assert(!/player[^\n]*(character|pose)|character[^\n]*player/i.test(source));
  assert(!/images\/characters\/bernie|bernie_(?:\d|cooking)/.test(source), "Story must not hard-code Bernie image files");
  assert(/\.s004-left-upper\s*\{\s*left:\s*25%;\s*bottom:\s*35%;/.test(css));
  assert(/\.s004-center-upper\s*\{\s*left:\s*50%;\s*bottom:\s*35%;/.test(css));

  await context.StoryEngine.playById("S004", {});

  assert(calls.backgrounds.includes("images/004/s004_background.png"));
  assert.deepStrictEqual(calls.items, [
    "images/004/s004_frying_pan_01.png",
    "images/004/s004_frying_pan_02.png",
    "images/004/s004_frying_pan_03.png",
    "images/004/s004_frying_pan_04.png",
    "images/004/s004_meal_event.png"
  ]);
  assert.strictEqual(new Set(calls.items).size, 5);
  assert.strictEqual(calls.itemClasses.at(-1), "event-fullscreen");
  assert.deepStrictEqual(calls.questions, [
    "“Are you OK?”（大丈夫ですか？）と尋ねてみよう。",
    "最初は肉を入れてみよう！\n肉、牛肉、豚肉、鶏肉など、知っている英語を言ってみよう！",
    "次は野菜を入れよう！\n知っている野菜を英語で言ってみよう！",
    "最後はフルーツ！\n知っているフルーツを英語で言ってみよう！",
    "“Yes! It's good!”（はい！おいしいです！）と言ってみよう。",
    "『一緒に行こう』を英語で言ってみよう。"
  ]);

  const dialogueTexts = calls.dialogues.map(call => call[1]);
  const requiredDialogueOrder = [
    "Is it good?", "There is a lot of food in the world!",
    "French food! Italian food! Chinese food!", "Fruits! Vegetables! Drinks!",
    "And more!", "Let's go and find them!", "Food from around the world...",
    "I want to see it!", "Really!?", "OK! I will go with you!"
  ];
  let priorIndex = -1;
  requiredDialogueOrder.forEach(text => {
    const index = dialogueTexts.indexOf(text);
    assert(index > priorIndex, `Dialogue must appear in order: ${text}`);
    priorIndex = index;
  });

  const shown = calls.characters.flat();
  ["pico", "kong", "saki", "bernie"].forEach(id => assert(shown.some(item => item.id === id)));
  assert(!shown.some(item => item.id === "player" || item.character === "player"));
  assert(shown.some(item => item.id === "bernie" && item.src === "images/characters/bernie/bernie_11.png"));
  assert(shown.some(item => item.id === "bernie" && item.className === "s004-center-upper size-medium"));
  assert(shown.filter(item => item.className === "s004-left-upper size-medium").length === 3,
    "S004 cooking-scene left placements must use the story-specific quarter position");
  assert(shown.filter(item => item.id === "bernie" && item.className === "pos-right-low size-medium").length >= 3,
    "S004 right-position Bernie scenes must remain unchanged");
  assert(calls.changes.some(([id, src]) => id === "bernie" && src === "images/characters/bernie/bernie_02.png"));
  assert.deepStrictEqual(calls.companions, [4]);
  assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [4]);
  context.SaveManager.addCompanion(4);
  assert.deepStrictEqual(Array.from(context.SaveManager.getCompanionIds()), [4], "Companion 4 must not be duplicated");
  assert.strictEqual(calls.saves, 1);
  assert.deepStrictEqual(calls.battles, ["m003"]);

  ["s004_background.png", "s004_frying_pan_01.png", "s004_frying_pan_02.png", "s004_frying_pan_03.png", "s004_frying_pan_04.png", "s004_meal_event.png"]
    .forEach(file => assert(fs.existsSync(path.join(root, "images/004", file))));

  console.log("S004 full-flow test: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
