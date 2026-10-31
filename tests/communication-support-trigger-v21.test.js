"use strict";
const assert = require("assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const questions = [];
let plans, results, seen;
const c = { console, Promise, CommunicativeJudgeRuleData: [], LotteryPoolData: [], LotteryEngine: { init() {} }, StoryRegistry: { register() {} },
 QuestionDatabase: { register(q) { questions.push(q); }, get(id) { return questions.find(q => q.id === id); } },
 QuestionManager: { cancel() {}, async start() { return { status: results.shift(), answer: "High" }; } },
 CommunicativeQuestionPresenter: { begin() { return 1; }, cancel() {}, async continued() { return "next"; },
  async recovery(result, options) {
   seen.push({ status: result.status, text: options.supportText, support: options.support, retry: options.retry });
   assert(plans.length, "Recovery requires an explicit user action");
   return plans.shift();
  } }
}; c.window=c; vm.createContext(c);
for (const file of ["engine/commands/story-commands.js", "data/s005-communication.js", "engine/stories/S005.js", "engine/controllers/communicative-question-flow-controller.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),c);
(async()=>{
 assert.strictEqual(questions.length,11);
 for(const q of questions){
  plans=["support","support","support","support","retry","retry","support","continue"];
  results=["reject","unknown","speech-failure"];seen=[];
  const value=await c.CommunicativeQuestionFlowController.start(q.id);
  assert.strictEqual(value.status,"continued");
  assert.deepStrictEqual(seen.map(x=>x.text),[null,q.picoSupport[0],q.picoSupport[1],q.picoSupport[2],q.picoSupport[2],q.picoSupport[2],q.picoSupport[2],q.picoSupport[2]]);
  assert(seen.every(x=>x.support && x.retry));
  assert.strictEqual(seen[5].status,"unknown");
  assert.strictEqual(seen[6].status,"speech-failure");
  for (const stage of [1,2,3]) {
   for (const status of ["reject","unknown","speech-failure"]) {
    plans=Array(stage).fill("support").concat(["retry","retry","continue"]);
    results=["reject",status,status];seen=[];
    await c.CommunicativeQuestionFlowController.start(q.id);
    assert.deepStrictEqual(seen.map(x=>x.text),[null].concat(q.picoSupport.slice(0,stage),[q.picoSupport[stage-1],q.picoSupport[stage-1]]));
    assert(seen.every(x=>x.retry), "Retry remains available at every Support stage and result");
   }
  }
  plans=["support","continue"];results=["speech-failure"];seen=[];
  await c.CommunicativeQuestionFlowController.start(q.id);
  assert.deepStrictEqual(seen.map(x=>x.text),[null,q.picoSupport[0]],"new Challenge and speech failure never advance Support");
  plans=["retry","retry","continue"];results=["speech-failure","speech-failure","unknown"];seen=[];
  await c.CommunicativeQuestionFlowController.start(q.id);
  assert.deepStrictEqual(seen.map(x=>x.text),[null,null,null],"Retry and speech failure never advance Stage 0");
 }
 console.log("communication-support-trigger-v21.test.js: PASS (11 challenges, every stage/result, repeated retry, cap, reset)");
})().catch(e=>{console.error(e);process.exitCode=1});

