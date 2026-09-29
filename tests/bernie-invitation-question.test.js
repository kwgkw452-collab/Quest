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

load("data/word-dictionaries.js");
load("data/questions.js");
load("engine/services/speech-normalizer.js");

const question = context.QuestionDatabase.get("phrase.come_with_us");
assert.strictEqual(question.prompt, "『一緒に行こう』を英語で言ってみよう。");
[
  "Come with me.", "Come with us.", "Let's go!", "Shall we go?", "Come on!"
].forEach(answer => {
  assert(context.SpeechNormalizer.includesAny(answer, question.answers), answer + " must be accepted");
});

const story = fs.readFileSync(path.join(root, "engine/stories/S004.js"), "utf8");
assert(story.includes('C.dialogue("ピコ", "『一緒に行こう』を英語で言ってみよう。"'));
assert(story.includes('C.addCompanion(4)'));
assert(story.includes('C.monsterBattle("m003", "seasonTreeBattle")'));

console.log("Bernie invitation multi-answer question test: PASS");
