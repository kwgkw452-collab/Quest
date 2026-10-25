"use strict";
const assert = require("assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const questions = [];
let plans, results, seen;
const c = { console, Promise, StoryRegistry: { register() {} },
 QuestionDatabase: { register(q) { questions.push(q); }, get(id) { return questions.find(q => q.id === id); } },
 QuestionManager: { cancel() {}, async start() { return { status: results.shift(), answer: "High" }; } },
 CommunicativeQuestionPresenter: { begin() { return 1; }, cancel() {}, async continued() { return "next"; },
  async recovery(result, options) { seen.push({ status: result.status, text: options.supportText, support: options.support }); return plans.shift(); } }
}; c.window=c; vm.createContext(c);
for (const file of ["engine/commands/story-commands.js", "engine/stories/S005.js", "engine/controllers/communicative-question-flow-controller.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),c);
(async()=>{
 assert.strictEqual(questions.length,11);
 for(const q of questions){
  plans=["support","support","support","support","retry","support","continue"];
  results=["reject","unknown"];seen=[];
  const value=await c.CommunicativeQuestionFlowController.start(q.id);
  assert.strictEqual(value.status,"continued");
  assert.deepStrictEqual(seen.map(x=>x.text),[null,q.picoSupport[0],q.picoSupport[1],q.picoSupport[2],q.picoSupport[2],null,q.picoSupport[2]]);
  assert(seen.every(x=>x.support));assert.strictEqual(seen[5].status,"unknown");
  plans=["support","continue"];results=["speech-failure"];seen=[];
  await c.CommunicativeQuestionFlowController.start(q.id);
  assert.deepStrictEqual(seen.map(x=>x.text),[null,q.picoSupport[0]],"new Challenge and speech failure never advance Support");
 }
 console.log("communication-support-trigger-v21.test.js: PASS (11 challenges, reject/unknown/failure, 0→1→2→3→3, retry, reset)");
})().catch(e=>{console.error(e);process.exitCode=1});
