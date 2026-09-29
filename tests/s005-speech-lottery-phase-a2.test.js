"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const traces = [], displays = [], choices = [];
let transcript = "", nextChoice = "continue";
const c = {
  console, setTimeout, clearTimeout, Promise,
  Math: Object.create(Math),
  WordDictionaryDatabase: { answers() { return ["stub"]; } },
  StoryCommands: {
    background(src) { return { type: "background", src }; },
    item(src) { return { type: "item", src }; },
    dialogue(who, text) { return { type: "dialogue", who, text }; },
    question(questionId) { return { type: "question", questionId }; },
    clear() { return { type: "clear" }; }
  },
  StoryRegistry: { register(story) { this.story = story; } },
  FormalSpeechTrace: { record(event, detail) { traces.push({ event, ...detail }); } },
  document: { getElementById() { return { appendChild(button) { Promise.resolve().then(button.click); } }; } },
  DialogManager: {
    show(who, text) { displays.push(text); },
    showRecognized() {}, hideRecognized() {},
    button(label, click) { return { click }; },
    choice(options) { choices.push(options.map(x => x.value)); return Promise.resolve(nextChoice); },
    next() { return Promise.resolve("next"); }
  },
  SpeechStartController: {
    prepare() {}, cancel() {},
    startListening(options) {
      options.onStart();
      if (transcript instanceof Error) return Promise.reject(transcript);
      return Promise.resolve(transcript);
    }
  }
};
c.window = c;
vm.createContext(c);
for (const file of [
  "data/questions.js", "data/lottery-pools.js", "data/communicative-judge-rules.js",
  "engine/services/speech-normalizer.js", "engine/services/lottery-engine.js",
  "engine/services/local-communicative-judge.js", "engine/services/communicative-judge.js",
  "engine/services/communicative-question-adapter.js", "engine/managers/question-manager.js",
  "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js", "engine/stories/S005.js",
  "data/s005-communicative-judge-rules.js"
]) vm.runInContext(read(file), c, { filename: file });
const utterances = [
  "No", "Three", "King-size bed, please.", "2 rooms", "Yes, please.",
  "Are you all right?", "May I have your name?", "Did you steal?",
  "Come with me.", "Did you find a bag?", "His name is Ben."
];
const additional = [
  [1, "No, we don't."], [2, "3"], [3, "Do you have king-size beds?"],
  [3, "Does this hotel have a king-size bed?"], [4, "Two rooms"],
  [4, "Two room"], [4, "2 room"], [7, "Name, please?"],
  [8, "Do you steal?"], [9, "Come with us."], [9, "Let's go."],
  [10, "Did you see a bag?"]
];
const html = ["index.html", "dev.html"];
for (const page of html) {
  const source = read(page);
  for (const asset of ["data/questions.js", "engine/controllers/communicative-question-flow-controller.js"]) {
    assert(source.includes(asset + "?v=s005-phase-a2-v1"), page + ": " + asset);
  }
  assert(source.includes("engine/presenters/communicative-question-presenter.js?v=s005-listening-ui-v1"));
  assert(source.includes("engine/stories/S005.js?v=s005-local-judge-runtime-fix-v1"));
  for (const asset of ["engine/services/local-communicative-judge.js",
    "engine/services/communicative-judge.js", "engine/managers/question-manager.js",
    "data/s005-communicative-judge-rules.js"]) {
    assert(source.includes(asset + "?v=s005-rule-real-browser-trace-v1"), page + ": " + asset);
  }
  assert(source.indexOf("engine/stories/S005.js") < source.indexOf("data/s005-communicative-judge-rules.js"));
  assert(source.includes("data/lottery-pools.js?v=s005-phase-a2-v1"));
  assert(source.includes("engine/services/lottery-engine.js?v=s005-phase-a2-v1"));
}
assert.equal(c.LotteryEngine.getPool("s005.communication.1.v1").items.length, 1);
assert.equal(c.LotteryEngine.getPool("shopping.fruit.order.v1").items.length, 2);
async function attempt(n, phrase, random) {
  c.Math.random = () => random;
  transcript = phrase;
  nextChoice = "continue";
  traces.length = displays.length = choices.length = 0;
  const q = c.QuestionDatabase.get("s005.communication." + n);
  const result = await c.CommunicativeQuestionFlowController.start(q.id);
  const selected = traces.find(x => x.event === "task-selected");
  assert.equal(selected.questionId, q.id);
  assert.equal(selected.taskSpecId, null); // Formal Question runtime has no TaskSpec.
  assert.equal(selected.lotteryStatus, "selected");
  assert.equal(selected.poolId, q.communicative.poolId);
  assert.equal(selected.displayValue, q.prompt);
  assert.equal(displays[0], q.prompt);
  assert.equal(result.status, "success", n + ": " + phrase);
  assert.equal(result.judge.verdict, "ACCEPT");
  assert.equal(result.judge.source, "local");
  assert.equal(result.judge.context.poolId, selected.poolId);
  assert.equal(result.judge.context.itemId, selected.itemId);
  assert(!choices.length);
  return selected;
}
(async () => {
  for (let n = 1; n <= 11; n++) {
    const first = await attempt(n, utterances[n - 1], 0);
    const second = await attempt(n, utterances[n - 1], 0.99);
    assert.notEqual(first.expectedUtterance, second.expectedUtterance, "Lottery varies within the same locked goal");
  }
  for (const [n, phrase] of additional) await attempt(n, phrase, 0.99);
  transcript = "unrelated weather";
  nextChoice = "continue";
  choices.length = traces.length = displays.length = 0;
  const continued = await c.CommunicativeQuestionFlowController.start("s005.communication.1");
  assert.equal(continued.status, "continued");
  assert(choices.length && choices[0].includes("retry") && choices[0].includes("support"));
  assert(choices.every(values => !values.includes("text")), "S005 never offers text entry");
  assert(traces.some(x => x.event === "recovery-show" && x.status === "unknown"));
  transcript = new Error("not-allowed");
  choices.length = traces.length = 0;
  const failed = await c.CommunicativeQuestionFlowController.start("s005.communication.1");
  assert.equal(failed.status, "continued");
  assert(choices.every(values => !values.includes("text")));
  assert(!choices[0].includes("retry"), "Permission denial is not REJECT or a speech retry");
  assert(traces.some(x => x.event === "speech-failure-result"));
  console.log("S005 Speech/Judge/Lottery Phase A-2: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
