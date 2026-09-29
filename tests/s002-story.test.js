"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

[
  "engine/commands/story-commands.js",
  "engine/core/story-registry.js",
  "data/poses.js",
  "data/characters.js",
  "data/backgrounds.js",
  "data/items.js",
  "data/camps.js",
  "engine/stories/m001.js",
  "engine/stories/S002.js",
  "engine/stories/S003.js"
].forEach(load);

const story = context.StoryRegistry.get("S002");
const types = story.steps.map(step => step.type);
const dialogue = story.steps.filter(step => step.type === "dialogue");
const english = dialogue.map(step => step.text).join("\n");
const source = fs.readFileSync(path.join(root, "engine/stories/S002.js"), "utf8");

assert.strictEqual(story.id, "S002");
assert.strictEqual(story.nextStoryId, "S003");
assert(context.StoryRegistry.has("S003"));
assert.deepStrictEqual(
  Array.from(story.steps.filter(step => step.type === "question"), step => step.questionId),
  ["phrase.its_ok", "phrase.yes_can_hear_you", "phrase.come_with_me"]
);
assert.deepStrictEqual(Array.from(story.steps.filter(step => step.type === "wait"), step => step.ms), [3000, 3500, 3000, 3500]);
assert.strictEqual(types.filter(type => type === "addCompanion").length, 1);
assert.strictEqual(story.steps.find(step => step.type === "addCompanion").characterId, 3);
assert.strictEqual(types.filter(type => type === "morning").length, 1);
assert.strictEqual(story.steps.find(step => step.type === "morning").morningId, "MORNING_001");
assert.strictEqual(types.filter(type => type === "travelTransition").length, 1);
assert.strictEqual(story.steps.find(step => step.type === "travelTransition").src, "s002FutureCityOverview");
const cityTransitionIndex = story.steps.findIndex(step => step.type === "travelTransition");
const cityExplanationIndex = story.steps.findIndex(step =>
  step.type === "dialogue" &&
  step.text === "この都市では、人々は声を出さず、インカムだけでコミュニケーションをとっている。"
);
const firstSakiDialogueIndex = story.steps.findIndex(step => step.type === "dialogue" && step.speaker === "サキ");
assert(cityTransitionIndex < cityExplanationIndex);
assert(cityExplanationIndex < firstSakiDialogueIndex);
assert.strictEqual(story.steps[cityExplanationIndex].button, "Next");
assert.strictEqual(types.filter(type => type === "camp").length, 1);
assert.strictEqual(story.steps.find(step => step.type === "camp").campId, "CAMP_S002");
assert(context.CampDatabase.has("CAMP_S002"));
assert(!types.includes("monsterBattle"));

[
  "What a big city!",
  "Everyone is wearing a headset.",
  "People are not talking.",
  "They talk by using their headsets.",
  "I don't use my voice here.",
  "But I like my voice.",
  "I want to see other cities.",
  "I want to use my voice more and make many friends.",
  "Can I go with you?"
].forEach(line => assert(english.includes(line), `missing approved line: ${line}`));

assert(!/huge/i.test(english), "S002 must use big, not huge");
assert(!/no one|through|have never|outside this city/i.test(english));
assert.strictEqual(dialogue.filter(step => /[ぁ-んァ-ヶ一-龠]/.test(step.text)).length, 4,
  "only the city explanation and three fixed player instructions may be Japanese");
assert(dialogue.some(step => step.text === "「It's OK.（大丈夫！）」と言ってみよう。"));
assert(dialogue.some(step => step.text === "「はい」または「はい、聞こえます」と英語で言ってみよう。"));
assert(dialogue.some(step => step.text === "「Come with me.（俺たちと一緒に行こう）」と言ってみよう。"));
assert(!dialogue.some(step => step.text === "Yes! We can hear you!"));
assert(dialogue.filter(step => step.supportText).every(step =>
  step.supportSpeaker === undefined || step.supportSpeaker === "ピコ"));
assert(source.includes('C.travelTransition("s002FutureCityOverview")'));
assert(source.includes('C.background("s002FutureCitySos")'));
assert(source.includes('C.background("s002FutureCityActive")'));
assert(!source.includes("s002FutureFlower"));
assert(!source.includes("phrase.thank_you"));
assert(!source.includes("Take your time"));
assert(!source.includes("Come with us"));
assert(source.includes('C.dialogue("ピコ", "Master! She needs help."'));
assert(!/\bscared\b/i.test(source));
assert(!source.includes('C.dialogue("サキ", "Thank you."'));

const saki = context.CharacterDatabase.get(3);
assert.strictEqual(saki.folder, "images/characters/income");
assert.deepStrictEqual(Array.from(saki.availablePoses), ["01", "02", "04", "09"]);
assert.strictEqual(context.BackgroundDatabase.s002FutureCityOverview, "images/002/bg_future_city_overview.png");
assert.strictEqual(context.BackgroundDatabase.s002FutureCitySos, "images/002/bg_future_city_sos.png");
assert.strictEqual(context.BackgroundDatabase.s002FutureCityActive, "images/002/bg_future_city_active.png");
[
  "bg_future_city_overview.png",
  "bg_future_city_sos.png",
  "bg_future_city_active.png"
].forEach(file => assert(fs.existsSync(path.join(root, "images/002", file)), `missing asset: ${file}`));
assert(!fs.readdirSync(path.join(root, "images/002")).some(file => /^income_/i.test(file)));
assert.strictEqual(context.StoryRegistry.get("m001").nextStoryId, "S002");
assert(!fs.readFileSync(path.join(root, "engine/stories/m001.js"), "utf8").includes("barney"));

console.log("S002 Saki story test: PASS");
