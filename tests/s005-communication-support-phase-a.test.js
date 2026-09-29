"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = file => fs.readFileSync(path.join(root, file), "utf8");
const context = {
  console,
  WordDictionaryDatabase: { answers() { return ["stub"]; } },
  StoryCommands: {
    background(src) { return { type: "background", src }; },
    item(src) { return { type: "item", src }; },
    dialogue(who, text) { return { type: "dialogue", who, text }; },
    question(id) { return { type: "question", questionId: id }; },
    clear() { return { type: "clear" }; }
  },
  StoryRegistry: { register(story) { this.story = story; } }
};
context.window = context;
vm.createContext(context);
for (const file of ["data/questions.js", "data/communicative-judge-rules.js",
  "engine/stories/S005.js", "engine/services/local-communicative-judge.js"]) {
  vm.runInContext(source(file), context, { filename: file });
}
const questions = Array.from({ length: 11 }, (_, i) => context.QuestionDatabase.get("s005.communication." + (i + 1)));
const rules = context.CommunicativeJudgeRuleData;
assert.equal(questions.length, 11);
assert.equal(context.LocalCommunicativeJudge.validateRules(rules).length, 0);
const prompts = [
  "いいえ、予約していません。", "3人です。", "キングサイズのベッドはありますか？",
  "2部屋お願いします。", "はい、お願いします。", "大丈夫ですか？",
  "（あなたの）名前は何ですか？", "物を盗みましたか？", "私たちと一緒に来て。",
  "バッグを見ましたか？", "彼の名前はBenです。"
];
const supports = [
  ["「いいえ」だから……ピコ。", "“No” を使って答えるピコ。", "No, we don’t."],
  ["3人だから……ピコ。", "“Three” を使って答えるピコ。", "Three."],
  ["“Do you...” から始めてみるピコ。", "“king-size bed” を使うピコ。", "Do you have a king-size bed?"],
  ["2だから……ピコ。", "“Two” から始めるピコ。", "Two rooms, please."],
  ["「はい」だから……ピコ。", "“Yes” を使って答えるピコ。", "Yes, please."],
  ["“Are you...” から始めるピコ。", "“OK” を使うピコ。", "Are you OK?"],
  ["“What’s...” から始めてみるピコ。", "“your name” を使うピコ。", "What’s your name?"],
  ["“Did you...” または “Do you...” から始めるピコ。", "“steal” を使うピコ。", "Did you steal something?"],
  ["“Come” または “Let’s” から始めるピコ。", "“with us” または “go” を使うピコ。", "Come with us.\nLet’s go."],
  ["“Did you...” から始めるピコ。", "“see” と “bag” を使うピコ。", "Did you see a bag?"],
  ["“His...” から始めるピコ。", "“name” と “Ben” を使うピコ。", "His name is Ben."]
];
const examples = [
  ["No.", "No, we don't.", "No, we do not.", "No reservation.", "We have no reservation."],
  ["Three.", "3.", "Three people.", "We are three."],
  ["Do you have a king-size bed?", "Do you have king-size beds?", "Does this hotel have a king-size bed?",
    "Does this hotel have king-size beds?", "Does the hotel have a king-size bed?", "Is there a king-size bed?",
    "Are there any king-size beds?", "Do you have any king-size beds?", "Is a king-size bed available?",
    "King-size bed, please.", "A king-size bed, please.", "King-size beds, please."],
  ["Two rooms, please.", "two rooms", "2 rooms", "two room", "2 room"],
  ["Yes, please.", "Yes.", "Please.", "Sure.", "OK.", "Okay."],
  ["Are you OK?", "Are you okay?", "Are you all right?", "Are you alright?",
    "You OK?", "You okay?", "All right?", "Everything OK?"],
  ["What’s your name?", "What is your name?", "Your name, please?", "Name, please?",
    "May I have your name?", "Can I have your name?", "Could I have your name?",
    "May I know your name?", "Can I know your name?", "I want to know your name.",
    "I’d like to know your name.", "I would like to know your name.",
    "Tell me your name, please.", "Please tell me your name."],
  ["Do you steal things?", "Did you steal?", "Do you steal?", "Did you steal something?",
    "Did you steal anything?", "Do you steal something?", "Do you steal anything?",
    "Steal something?", "Steal anything?", "Stole something?", "Stole anything?",
    "Steal things?", "Stole things?", "Did you take something?", "Did you take anything?",
    "Did you take the bag?"],
  ["Come with us.", "Come with me.", "Let’s go.", "Please come with us.",
    "Come with me, please.", "Let’s go together."],
  ["Did you see a bag?", "Do you see a bag?", "Have you seen a bag?", "Did you find a bag?",
    "Do you find a bag?", "Have you found a bag?", "See a bag?", "Find a bag?"],
  ["His name is Ben.", "His name’s Ben.", "He is Ben.", "He’s Ben.",
    "This is Ben.", "The monster is Ben.", "His name, Ben."]
];
const alternativesAfterSupport3 = [
  "No reservation.", "3 people.", "King-size beds, please.", "2 room.", "Sure.",
  "You okay?", "May I have your name?", "Did you take the bag?", "Let’s go together.",
  "Have you found a bag?", "This is Ben."
];
function verdict(index, utterance) {
  return context.LocalCommunicativeJudge.evaluate({
    conceptId: questions[index].communicative.conceptId, difficulty: "starter", utterance
  }, rules).verdict;
}
questions.forEach((q, i) => {
  assert.equal(q.prompt, prompts[i]);
  assert.deepEqual(Array.from(q.picoSupport), supports[i]);
  assert(!q.prompt.includes(q.communicative.expectedUtterance));
  examples[i].forEach(text => assert.equal(verdict(i, text), "ACCEPT", `${i + 1}: ${text}`));
  assert.equal(verdict(i, "The weather is warm."), "UNKNOWN", `${i + 1} unrelated`);
  assert.equal(verdict(i, alternativesAfterSupport3[i]), "ACCEPT", `${i + 1} after Support 3`);
});
assert.equal(verdict(6, "My name is Tom."), "UNKNOWN");
assert.equal(verdict(7, "Steal."), "UNKNOWN");
assert.equal(verdict(9, "Did you watch a bag?"), "UNKNOWN");
assert.equal(verdict(10, "Ben."), "UNKNOWN");
assert.equal(verdict(0, "Yes, we do."), "REJECT");

const displayed = [];
const opened = [];
let actionQueue = [];
let speechCount = 0;
context.document = { getElementById() {
  return { appendChild(button) { Promise.resolve().then(button.click); } };
} };
context.DialogManager = {
  show(who, text) { displayed.push(text); },
  button(label, click) { return { label, click }; },
  showRecognized() {}, hideRecognized() {},
  choice(choices) {
    const next = actionQueue.shift();
    assert(choices.some(c => c.value === next), next);
    return Promise.resolve(next);
  },
  next() { return Promise.resolve("next"); }
};
context.QuestionManager = {
  cancel() {},
  async start(id, options) {
    speechCount += 1;
    await options.speechStart(() => Promise.resolve("unrelated"));
    return { questionId: id, status: "unknown", answer: "unrelated", alternatives: [] };
  }
};
for (const file of ["engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js"]) {
  vm.runInContext(source(file), context, { filename: file });
}
(async () => {
  for (let i = 0; i < questions.length; i += 1) {
    displayed.length = 0;
    actionQueue = ["support", "support", "continue"];
    const previousSpeechCount = speechCount;
    const result = await context.CommunicativeQuestionFlowController.start(questions[i].id);
    assert.equal(result.status, "continued", `challenge ${i + 1}`);
    assert.equal(speechCount, previousSpeechCount + 1, "Support escalation does not add speech retries");
    assert.equal(displayed[0], prompts[i], "Japanese prompt appears before speech");
    assert(displayed.some(text => text === prompts[i] + "\n\n🎤 聞き取り中…"));
    assert.deepEqual(displayed.filter(text => supports[i].some(support => text.endsWith(support))),
      supports[i].map(support => prompts[i] + "\n\n" + support));
    assert(!displayed.slice(0, displayed.findIndex(text => text.endsWith(supports[i][2])))
      .some(text => text.endsWith(supports[i][2])));
  }
  for (let i = 0; i < questions.length; i += 1) {
    displayed.length = 0;
    actionQueue = ["retry", "support", "continue"];
    const previousSpeechCount = speechCount;
    const result = await context.CommunicativeQuestionFlowController.start(questions[i].id);
    assert.equal(result.status, "continued", `retry challenge ${i + 1}`);
    assert.equal(speechCount, previousSpeechCount + 2, "One speech retry");
    assert.equal(displayed.filter(text => text === prompts[i]).length, 2);
    assert.equal(displayed.filter(text => text === prompts[i] + "\n\n🎤 聞き取り中…").length, 2);
    supports[i].forEach(support =>
      assert(displayed.includes(prompts[i] + "\n\n" + support), `support with goal: ${i + 1}`));
  }
  displayed.length = 0;
  actionQueue = ["continue"];
  await context.CommunicativeQuestionFlowController.start("phrase.are_you_ok");
  assert(!displayed.some(text => text.includes(prompts[10])), "Previous S005 goal is cleared for other stories");
  console.log("S005 Communication Support Phase A: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
