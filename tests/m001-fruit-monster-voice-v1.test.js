"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const context = { window: {} };
context.window = context;
vm.createContext(context);
vm.runInContext(read("engine/commands/story-commands.js"), context);
context.StoryRegistry = { register(story) { context.story = story; } };
vm.runInContext(read("engine/stories/m001.js"), context);
vm.runInContext(read("data/audio.js"), context);

function flatten(steps) {
  return (steps || []).flatMap(step => [step, ...flatten(step.thenSteps), ...flatten(step.elseSteps)]);
}
const story = context.story;
const dialogues = flatten(story.steps).filter(step => step.type === "dialogue");
const expected = [
  ["voice_c13_m001_001", "Fruit Monster", "I am the strongest! But I don't like fruit!", "『俺は最強だ！でも、フルーツは苦手だ！』と言っているよ！", "Next"],
  ["voice_c01_m001_001", "ピコ", "Master! He doesn't like fruit! Say three fruit words!", "マスター！あいつはフルーツが苦手だ！違うフルーツの英単語を3つ言おう！", "Battle"],
  ["voice_c01_m001_002", "ピコ", "Great! So much delicious fruit!", "やったー！おいしそうなフルーツがいっぱいだピコ！", "Camp"]
];
assert.strictEqual(dialogues.length, 3);
assert.deepStrictEqual(Array.from(dialogues, step => [step.voiceKey, step.speaker, step.text, step.supportText, step.button]), expected);
assert.strictEqual(story.steps.filter(step => step.type === "monsterBattle").length, 1);
assert.strictEqual(story.steps.filter(step => step.type === "camp").length, 1);
for (const step of dialogues) {
  const file = context.AudioDatabase.voice[step.voiceKey];
  assert(file && fs.statSync(path.join(root, file)).size > 10000, step.voiceKey);
  assert.strictEqual(context.AudioDatabase.assets[step.voiceKey].file, file);
}

async function checkSupport(step) {
  const controls = [];
  const plays = [];
  const content = [];
  const ui = { window: {}, Promise, GameConfig: { dialogueNextLabel: "Next" },
    DialogManager: {
      show() {}, setContent(speaker, text) { content.push([speaker, text]); },
      clearControls() { controls.length = 0; },
      addControl(label, handler) { controls.push({ label, handler }); }
    },
    DialogueVoiceController: {
      play(key, options) { plays.push(["play", key, options]); return Promise.resolve({ status: "ended" }); },
      stop() { plays.push(["stop"]); }
    }
  };
  ui.window = ui;
  vm.createContext(ui);
  vm.runInContext(read("engine/controllers/pico-support-controller.js"), ui);
  const click = label => { const control = controls.find(item => item.label === label); assert(control, label); control.handler(); };
  const done = ui.PicoSupportController.present(step);
  await Promise.resolve();
  click("Pico's Support");
  click("英文を見る");
  assert.strictEqual(content.at(-1)[1], step.text);
  click("日本語を見る");
  assert.strictEqual(content.at(-1)[1], step.supportText);
  assert.strictEqual(content.at(-1)[0], "ピコ");
  click("もう一度聞く");
  assert.deepStrictEqual(plays.filter(call => call[0] === "play").map(call => call[1]), [step.voiceKey, step.voiceKey]);
  click(step.button);
  assert.strictEqual(await done, "next");
  assert.strictEqual(plays.at(-1)[0], "stop");
}

(async () => {
  for (const step of dialogues) await checkSupport(step);
  console.log("m001 Fruit Monster Voice V1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
