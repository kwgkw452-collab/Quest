"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const goals = [
  "No, we don’t.", "Three.", "Do you have a king-size bed?",
  "Two rooms, please.", "Yes, please.", "Are you OK?",
  "What’s your name?", "Do you steal things?", "Come with us.",
  "Did you see a bag?", "His name is Ben."
];
const prompts = [
  "いいえ、予約していません。", "3人です。", "キングサイズのベッドはありますか？",
  "2部屋お願いします。", "はい、お願いします。", "大丈夫ですか？",
  "（あなたの）名前は何ですか？", "物を盗みましたか？", "私たちと一緒に来て。",
  "バッグを見ましたか？", "彼の名前はBenです。"
];
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
  "engine/core/story-engine.js", "engine/stories/S005.js",
  "engine/services/local-communicative-judge.js"
]) vm.runInContext(read(file), context, { filename: file });

assert.equal(questions.length, 11);
assert.equal(rules.length, 12);
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

const story = context.StoryRegistry.get("S005");
assert(story);
assert.equal(story.nextStoryId, undefined);
assert.equal(story.steps.filter(s => s.type === "question").length, 11);
const images = [...new Set(story.steps.filter(s => s.type === "background" || s.type === "item").map(s => s.src))];
assert.equal(images.length, 14);
images.forEach(src => assert(fs.existsSync(path.join(root, src)), src));
assert(!images.some(src => src.includes("flower_tree_square_day")));
assert(fs.existsSync(path.join(root, "images/005/ben_flower_tree_square_day.png")));
const stages = story.steps.filter(s => s.type === "item").map(s => path.basename(s.src, ".png"));
assert.equal(JSON.stringify([...new Set(stages)]),
  JSON.stringify(["ben_stage0", "ben_stage1", "ben_stage2", "ben_stage3", "ben_stage4_full"]));
const at = (type, text) => story.steps.findIndex(s => s.type === type &&
  (type === "dialogue" ? s.text === text : s.src.endsWith(text + ".png")));
assert(at("dialogue", "Good evening.") < at("item", "ben_stage3"));
assert(at("dialogue", "We are happy now.") < at("item", "ben_stage4_full"));
assert(at("background", "ben_town_relief_cast_night") < at("dialogue", "11:55"));
assert(at("dialogue", "11:55") < at("dialogue", "11:57"));
assert(at("dialogue", "11:57") < at("dialogue", "11:58"));
assert(at("dialogue", "11:58") < at("dialogue", "11:59"));
assert(at("dialogue", "My bed!") < at("dialogue", "Good night!"));
assert.equal(story.steps.at(-2).text, "Kongがベッドへ。");
assert.equal(story.steps.at(-1).text, "Good night!");

(async () => {
  let reference;
  for (const status of ["success", "continued"]) {
    calls.length = 0;
    outcome = status;
    const state = await context.StoryEngine.play(story, {});
    assert.equal(state.s005Challenge11.status, status);
    assert.equal(calls.filter(x => x[0] === "question").length, 11);
    assert(calls.some(x => x[0] === "event" && x[1] === "story:complete"));
    const stage1 = calls.findIndex(x => x[0] === "item" && x[1].endsWith("ben_stage1.png"));
    const stage2 = calls.findIndex(x => x[0] === "item" && x[1].endsWith("ben_stage2.png"));
    assert(stage1 >= 0 && stage2 > stage1);
    assert(!calls.slice(stage1, stage2).some(x => x[0] === "clear"),
      "Ben remains at Stage 1 through the police and bakery scenes");
    const progression = calls.filter(x => ["dialogue", "item", "background"].includes(x[0]));
    if (reference) assert.equal(JSON.stringify(progression), JSON.stringify(reference),
      "Challenge outcome must not change the locked narrative or Ben stages");
    reference = progression;
  }
  console.log("S005 Ben Story Phase 1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
