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
  "engine/stories/story-saki-departure.js",
  "data/word-dictionaries.js",
  "data/questions.js"
].forEach(load);

function flatten(steps) {
  return (steps || []).reduce((all, step) => all.concat(
    step,
    flatten(step.steps),
    flatten(step.thenSteps),
    flatten(step.elseSteps)
  ), []);
}

const story = context.StoryRegistry.get("st004");
const allSteps = flatten(story.steps);
const source = fs.readFileSync(path.join(root, "engine/stories/story-saki-departure.js"), "utf8");
const backgrounds = allSteps.filter(step => step.type === "background").map(step => step.src);
const expectedGraphics = [
  "images/004/s004_ethnic_bazaar_overview_illustrated.png",
  "images/004/s004_kong_fruit_shop.png",
  "images/004/s004_bernie_ingredient_shop.png",
  "images/004/s004_orange_banana_choice.png",
  "images/004/s004_bazaar_rumor_scene.png",
  "images/004/s004_saki_bazaar_conversation.png",
  "images/004/s004_mysterious_bazaar_shop.png",
  "images/004/s004_map_key_choice_final.png"
];

let previousIndex = -1;
expectedGraphics.forEach(graphic => {
  const index = backgrounds.indexOf(graphic);
  assert(index > previousIndex, "Graphic order must advance through: " + graphic);
  assert(fs.existsSync(path.join(root, graphic)), "Graphic must exist: " + graphic);
  previousIndex = index;
});

const dialogues = allSteps.filter(step => step.type === "dialogue").map(step => step.text);
assert(dialogues.includes("I want to eat bananas."));
assert(dialogues.includes("I want to eat bananas!"));
assert(dialogues.includes("Dragon pepper."));
assert(!source.includes("Choose one."));
assert(!source.includes("さっきからずっと、街の人たちを見てるピコ。"));

const rumors = [
  "There is a black forest in the north.",
  "People see a blue light in the desert at night.",
  "There is an old castle in the mountains."
];
rumors.forEach(rumor => assert(dialogues.includes(rumor)));

const sakiConversation = [
  "Where are you from?",
  "I'm from Future City.",
  "Do you like this town?",
  "Yes! I love it!",
  "Me too!",
  "It's fun!"
];
let dialogueIndex = -1;
sakiConversation.forEach(line => {
  const index = dialogues.indexOf(line);
  assert(index > dialogueIndex, "Saki conversation order must include: " + line);
  dialogueIndex = index;
});

const waitingIndex = dialogues.indexOf("I'm waiting for you.");
const whichIndex = dialogues.indexOf("Which do you want?");
const stayIndex = dialogues.indexOf("I want to stay here.");
assert(waitingIndex > dialogueIndex);
assert(whichIndex > waitingIndex);
assert(stayIndex > whichIndex, "Saki must not say she wants to stay during Graphic 6");

const fruitQuestion = context.QuestionDatabase.get("word.orange_or_banana");
assert.strictEqual(fruitQuestion.prompt, "バナナかオレンジ、好きなほうを英語で答えてください。");
assert.deepStrictEqual(Array.from(fruitQuestion.answers), ["orange", "banana", "no thank you"]);

const normalizeContext = { console, window: {} };
normalizeContext.window = normalizeContext;
vm.createContext(normalizeContext);
vm.runInContext(fs.readFileSync(path.join(root, "engine/services/speech-normalizer.js"), "utf8"), normalizeContext);
["Orange.", "BANANA!", "No, thank you."].forEach(answer => {
  assert(normalizeContext.SpeechNormalizer.includesAny(answer, fruitQuestion.answers));
});

assert(!source.includes('C.dialogue("商人A", "How about this?"'));
assert(!source.includes('C.dialogue("商人B", "How much?"'));
assert(!source.includes('C.dialogue("客", "I\'ll take it!"'));

console.log("st004 bazaar front-half test: PASS");
