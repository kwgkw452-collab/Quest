"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const lock = JSON.parse(read("tests/fixtures/s005-clean-lock.json"));
const goals = lock.goals;
const prompts = lock.prompts;
const questions = [];
const rules = [{ conceptId: "social.wellbeing.ask", variants: ["Are you OK?"] }];
const calls = [];
let outcome = "success";
const context = {
  console,
  CommunicativeJudgeRuleData: rules,
  QuestionDatabase: {
    register(q) { questions.push(q); },
    get(id) { return questions.find(q => q.id === id); }
  },
  StoryEvents: { async emit(type, detail) { calls.push(["event", type, detail.story.id]); } },
  GameCore: {
    clearVisuals() { calls.push(["clear"]); },
    showItem(src) { calls.push(["item", src]); }
  },
  EffectManager: { setBackground(src) { calls.push(["background", src]); } },
  CharacterManager: { clear() {} },
  MonsterManager: { clear() {} },
  DialogManager: {
    show(who, text) { calls.push(["dialogue", who, text]); },
    async next() {}
  },
  GameConfig: { dialogueNextLabel: "次へ" },
  CommunicativeQuestionFlowController: {
    async start(id) {
      calls.push(["question", id]);
      return { status: outcome, resolution: outcome === "success" ? "accepted" : "continue" };
    }
  },
  AudioManager: { stopAll() {} },
  SaveManager: { save() {} }
};
context.window = context;
vm.createContext(context);
for (const file of [
  "engine/commands/story-commands.js", "engine/core/story-registry.js",
  "engine/core/story-engine.js", "engine/core/event-system.js",
  "data/lottery-pools.js", "engine/services/lottery-engine.js", "data/s005-communication.js", "engine/stories/S005.js",
  "engine/services/local-communicative-judge.js"
]) vm.runInContext(read(file), context, { filename: file });

assert.equal(questions.length, 12);
assert.equal(rules.length, 13);
questions.forEach((q, i) => {
  assert.equal(q.id, "s005.communication." + (i + 1));
  assert.equal(q.prompt, prompts[i]);
  assert.equal(q.picoSupport.length, 3);
  assert.equal(q.communicative.expectedUtterance, goals[i]);
  const result = context.LocalCommunicativeJudge.evaluate(
    { conceptId: q.communicative.conceptId, utterance: goals[i], difficulty: "starter" }, rules);
  assert.equal(result.verdict, "ACCEPT", q.id);
});
assert.equal(context.LocalCommunicativeJudge.evaluate(
  { conceptId: questions[0].communicative.conceptId, utterance: "Yes, we do." }, rules).verdict, "REJECT");
assert.equal(context.LocalCommunicativeJudge.evaluate(
  { conceptId: questions[0].communicative.conceptId, utterance: "Are you happy?" }, rules).verdict, "UNKNOWN");

const registeredStory = context.StoryRegistry.get("S005");
assert.equal(registeredStory.steps.length, 11, "Eleven scenes use the existing sequence command");
assert(registeredStory.steps.every(scene => scene.type === "sequence"));
const story = { ...registeredStory, steps: registeredStory.steps.flatMap(scene => Array.from(scene.steps)) };
assert(story);
assert.equal(story.metadata.perspective, "player");
assert.deepEqual(Array.from(story.metadata.guests), ["player", "kong", "pico", "bernie"]);
assert.deepEqual(Array.from(story.metadata.nonGuestCompanions), []);
assert.deepEqual(lock.cast, ["主人公", "Kong", "Pico", "Bernie"]);
assert.equal(lock.picoCountsAsGuest, true);
assert.equal(story.nextStoryId, undefined);
assert.equal(story.steps.filter(s => s.type === "question").length, 12);
const images = [...new Set(story.steps.filter(s => s.type === "background" || s.type === "item").map(s => s.src))];
assert(images.length >= 16);
images.forEach(src => assert(fs.existsSync(path.join(root, src)), src));
assert(!images.some(src => src.includes("flower_tree_square_day")));
assert(fs.existsSync(path.join(root, "images/005/ben_flower_tree_square_day.png")));
assert.equal(story.steps.filter(s => s.type === "item").length, 0, "No old Ben sprite placement is inherited");
const at = (type, text) => story.steps.findIndex(s => s.type === type &&
  (type === "dialogue" ? s.text === text : s.src.endsWith(text + ".png")));



assert(at("dialogue", "11:55") < at("dialogue", "11:57"));
assert(at("dialogue", "11:57") < at("dialogue", "11:58"));
assert(at("dialogue", "11:58") < at("dialogue", "11:59"));
assert(at("dialogue", "My bed!") < at("dialogue", "Good night!"));
assert.equal(story.steps.at(-2).text, "Kongがベッドへ。");
assert.equal(story.steps.at(-1).text, "Good night!");


const ordered = lock.ending.map(([speaker, text]) => story.steps.findIndex(s => s.type === "dialogue" && s.speaker === speaker && s.text === text));
const finalCommunication = story.steps.findIndex(s => s.questionId === "s005.communication.12");
assert(ordered.every(i => i >= 0));
assert(ordered[0] < ordered[1] && ordered[1] < ordered[2] && ordered[2] < finalCommunication);
assert.equal(story.steps.filter(s => s.type === "question").at(-1).questionId, "s005.communication.12");
assert(!story.steps.some(s => s.text && /single room|three people/.test(s.text)));

(async () => {
  let reference;
  for (const status of ["success", "continued"]) {
    calls.length = 0;
    outcome = status;
    const state = await context.StoryEngine.play(registeredStory, {});
    assert.equal(state.s005Challenge12.status, status);
    assert.equal(calls.filter(x => x[0] === "question").length, 12);
    assert(calls.some(x => x[0] === "event" && x[1] === "story:complete"));
    const progression = calls.filter(x => ["dialogue", "item", "background"].includes(x[0]));
    if (reference) assert.equal(JSON.stringify(progression), JSON.stringify(reference),
      "Challenge outcome must not change the locked narrative");
    reference = progression;
  }
  console.log("S005 Ben Story Phase 1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });

