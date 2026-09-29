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

load("engine/services/speech-normalizer.js");
load("engine/commands/story-commands.js");
load("engine/core/story-registry.js");
load("engine/stories/story-saki-departure.js");
load("data/word-dictionaries.js");
load("data/questions.js");

const story = context.StoryRegistry.get("st004");
const stay = context.QuestionDatabase.get("phrase.stay_here");
const farewell = context.QuestionDatabase.get("phrase.farewell_saki");

[
  "Stay here?",
  "Staying here?",
  "Do you stay here?",
  "Are you staying here?",
  "Do you staying here?"
].forEach(answer => {
  assert(context.SpeechNormalizer.includesAny(answer, stay.answers), answer + " must be accepted");
});

[
  "Bye!", "Bye-bye!", "Goodbye!", "See you!", "See you again!",
  "See you later!", "Good luck!", "Take care!", "God bless you!", "Farewell!"
].forEach(answer => {
  assert(context.SpeechNormalizer.includesAny(answer, farewell.answers), answer + " must be accepted");
});

const texts = story.steps.filter(step => step.type === "dialogue").map(step => step.text);
function before(first, second) {
  assert(texts.indexOf(first) !== -1, "Missing dialogue: " + first);
  assert(texts.indexOf(second) !== -1, "Missing dialogue: " + second);
  assert(texts.indexOf(first) < texts.indexOf(second), first + " must precede " + second);
}

before("I want to stay here.", "Yes.");
before("Pico?", "Call me!");
before("Call me!", "Can you hear me?");
before("Can you hear me?", "Yes! I can hear you!");
before("Yes! I can hear you!", "It's not goodbye.");
before("It's not goodbye.", "See you again, Master!");
before("See you again, Master!", "Thank you!");
before("Thank you!", "See you!");
before("See you!", "Hello!");
before("Hello!", "See you, Master!");
before("ちょっと寂しくなったピコ……。", "Let's go, Master!");
before("Let's go, Master!", "See you, Master!");

[
  "またね、マスター！",
  "サキは振り返りながら、バザールの人々の中へ歩いていく。",
  "コングとバーニーも、サキが去った方向を見ている。",
  "でも、サキは自分のやりたいことを見つけたんだ。",
  "きっとまた話せるピコ！",
  "マスター。",
  "僕たちも行こう！",
  "一行は次の目的地へ向かう。バザールでは、人々の声がまだ聞こえている。"
].forEach(text => assert(!texts.includes(text), "Removed final narration must stay absent: " + text));

const stayStep = story.steps.find(step => step.type === "question" && step.questionId === "phrase.stay_here");
const farewellStep = story.steps.find(step => step.type === "question" && step.questionId === "phrase.farewell_saki");
assert.strictEqual(stayStep.supportMessages.length, 3);
assert.strictEqual(farewellStep.supportMessages.length, 3);
assert(!story.steps.some(step => step.type === "question" && step.questionId === "phrase.good_luck"));

const graphicIndex = story.steps.findIndex(step => step.type === "background" && step.src === "images/004/s004_saki_headset_call_final.png");
const callIndex = story.steps.findIndex(step => step.type === "dialogue" && step.text === "Pico?");
assert(graphicIndex !== -1 && graphicIndex < callIndex, "Graphic 9 must appear before the headset call");

const removalIndex = story.steps.findIndex(step => step.type === "removeCompanion" && step.characterId === 3);
const finalIndex = story.steps.findIndex(step => step.type === "dialogue" && step.text === "See you, Master!");
assert(removalIndex !== -1 && removalIndex < finalIndex, "Saki must leave the party before the final distant voice");

const finalParty = story.steps.find(step => step.type === "characters" && step.items &&
  step.items.some(item => item.id === "kong") && step.items.some(item => item.id === "bernie"));
assert(finalParty, "Final bazaar party placement must exist");
assert.strictEqual(finalParty.items.find(item => item.id === "kong").className, "pos-center-low size-medium");
assert.strictEqual(finalParty.items.find(item => item.id === "bernie").className, "pos-right-low size-medium");
assert.strictEqual(finalParty.items.find(item => item.id === "pico").className, "st004-farewell-pico size-medium");

const css = fs.readFileSync(path.join(root, "css/style.css"), "utf8");
assert(css.includes(".st004-farewell-pico { left: 68%; bottom: 18%; transform: translateX(-50%); }"));

const sakiPicoScene = story.steps.find(step => step.type === "characters" && step.items &&
  step.items.length === 2 && step.items.some(item => item.id === "pico") && step.items.some(item => item.id === "saki"));
assert(sakiPicoScene, "Saki and Pico scene must exist");
assert.strictEqual(sakiPicoScene.items.find(item => item.id === "pico").className, "st004-saki-pico-low size-medium");
assert.strictEqual(sakiPicoScene.items.find(item => item.id === "saki").className, "pos-right-low size-medium");
assert(css.includes(".st004-saki-pico-low { left: 50%; bottom: 17%; transform: translateX(-50%); }"));

const mapFinal = fs.readFileSync(path.join(root, "images/004/s004_map_key_choice_final.png"));
const headset = fs.readFileSync(path.join(root, "images/004/s004_saki_headset_call.png"));
const headsetFinal = fs.readFileSync(path.join(root, "images/004/s004_saki_headset_call_final.png"));
assert(mapFinal.length > 0, "Final small-KEY graphic must be packaged");
assert(headset.equals(headsetFinal), "Final headset connection must preserve the approved existing graphic exactly");

console.log("st004 Saki ending test: PASS");
