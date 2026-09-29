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

load("engine/commands/story-commands.js");
load("engine/core/story-registry.js");
load("engine/stories/S004.js");
load("engine/stories/story-saki-departure.js");
load("data/word-dictionaries.js");
load("data/questions.js");
load("data/backgrounds.js");

const prior = context.StoryRegistry.get("S004");
const story = context.StoryRegistry.get("st004");
assert(story, "st004 must register");
assert.strictEqual(prior.nextStoryId, "st004");
assert.strictEqual(story.title, "004 サキの旅立ち");
assert.strictEqual(story.steps[2].src, "images/004/s004_ethnic_bazaar_overview_illustrated.png");

const questions = story.steps.filter(step => step.type === "question");
assert.deepStrictEqual(Array.from(questions, step => step.questionId), [
  "word.orange_or_banana", "phrase.stay_here", "phrase.farewell_saki"
]);
assert.deepStrictEqual(Array.from(context.QuestionDatabase.get("phrase.stay_here").answers), ["stay here", "staying here"]);
assert.deepStrictEqual(Array.from(context.QuestionDatabase.get("phrase.farewell_saki").answers), [
  "see you", "see you again", "see you later", "bye",
  "bye bye", "goodbye", "good luck", "take care",
  "god bless you", "farewell"
]);

const stayQuestion = questions.find(step => step.questionId === "phrase.stay_here");
const farewellQuestion = questions.find(step => step.questionId === "phrase.farewell_saki");
assert.deepStrictEqual(Array.from(stayQuestion.supportMessages), [
  "『いる』は “stay” を使うよ！",
  "“stay” と “here” を使ってみよう！",
  "“Stay here?” と言ってみよう！"
]);
assert.deepStrictEqual(Array.from(farewellQuestion.supportMessages), [
  "お別れするときの英語だよ！",
  "“Bye!” や “See you!” でもいいよ！",
  "“Goodbye!” って言ってみよう！"
]);

const removalIndex = story.steps.findIndex(step => step.type === "removeCompanion" && step.characterId === 3);
const saveIndex = story.steps.findIndex(step => step.type === "save");
assert(removalIndex !== -1, "Character ID 3 must leave the active party");
assert(removalIndex < saveIndex, "Saki party removal must be saved");
assert(!story.steps.some(step => step.type === "removeCompanion" && step.characterId !== 3));

const source = fs.readFileSync(path.join(root, "engine/stories/story-saki-departure.js"), "utf8");
assert(!/delete|splice\s*\(/.test(source), "Character Database and IDs must not be deleted or renumbered");
assert(source.includes('character: "saki", pose: "sideWalk"'));
assert(source.includes('C.characterImage("saki", "smile")'));
assert(fs.existsSync(path.join(root, "images/004/s004_ethnic_bazaar_overview_illustrated.png")));
assert(fs.existsSync(path.join(root, "images/004/s004_map_key_choice_final.png")));
assert(fs.existsSync(path.join(root, "images/004/s004_saki_headset_call_final.png")));
assert(source.includes('C.background("images/004/s004_map_key_choice_final.png")'));
assert(source.includes('C.background("images/004/s004_saki_headset_call_final.png")'));
assert(!source.includes('C.question("phrase.good_luck"'));
assert(source.includes('C.dialogue("サキ", "Can you hear me?", { voiceKey: "voice_c03_st004_012", supportText: "私の声が聞こえる？", voiceEffect: "radio" })'));
assert(source.includes('C.dialogue("ピコ", "Yes! I can hear you!", { voiceKey: "voice_c01_st004_005", supportText: "うん！聞こえるピコ！", voiceEffect: "radio" })'));

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(index.includes('engine/stories/story-saki-departure.js'));

console.log("st004 Saki departure test: PASS");
