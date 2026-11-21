"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const cases = JSON.parse(read("tests/s006-communication-v2-cases.json"));
const questions=[],rules=[],pools=[];
const ctx={console,window:null,
  QuestionDatabase:{register(d){questions.push(d);}},
  CommunicativeJudgeRuleData:rules,LotteryPoolData:pools,
  LotteryEngine:{init(){}}
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(read("data/s006-communication.js"),ctx,{filename:"data/s006-communication.js"});
vm.runInContext(read("engine/services/local-communicative-judge.js"),ctx,{filename:"local-communicative-judge.js"});
assert.equal(questions.length,10); assert.equal(rules.length,10); assert.equal(pools.length,10);
assert.equal(ctx.LocalCommunicativeJudge.validateRules(rules).length,0);
const ids=new Set(),concepts=new Set(),poolIds=new Set();
for(const c of cases){
 const i=c.q-1,q=questions[i],rule=rules[i],pool=pools[i];
 assert.equal(q.id,"s006.communication."+c.q);
 assert(!ids.has(q.id));ids.add(q.id);
 assert.equal(q.prompt,c.goal);assert.equal(q.communicative.expectedUtterance,c.model);
 assert.equal(q.communicative.conceptId,"s006.mystery.v2."+c.q);
 assert.equal(q.communicative.poolId,q.id+".v2");
 assert(!concepts.has(rule.conceptId));concepts.add(rule.conceptId);
 assert(!poolIds.has(pool.poolId));poolIds.add(pool.poolId);
 assert.equal(rule.conceptId,q.communicative.conceptId);
 assert.equal(pool.poolId,q.communicative.poolId);
 assert.equal(pool.items[0].displayValue,q.prompt);
 assert.equal(pool.items[0].prompts[0].expectedUtterance,c.model);
 assert.deepEqual(Array.from(q.picoSupport),c.hints);
 assert(/[a-z]{2}/i.test(q.picoSupport[0]),"Q"+c.q+" first hint missing English");
 assert.equal(q.picoSupport[2],c.model);
 assert.deepEqual(Array.from(q.answers),Array.from(rule.variants));
 assert.deepEqual(Array.from(q.answers),Array.from(pool.items[0].prompts[0].acceptedVariants));
 for(const text of c.accept){
  const result=ctx.LocalCommunicativeJudge.evaluate({conceptId:rule.conceptId,difficulty:"starter",utterance:text},rules);
  assert.equal(result.verdict,"ACCEPT","Q"+c.q+" ACCEPT "+text);
 }
 for(const text of c.reject){
  const result=ctx.LocalCommunicativeJudge.evaluate({conceptId:rule.conceptId,difficulty:"starter",utterance:text,
    alternatives:[c.model]},rules);
  assert.equal(result.verdict,"REJECT","Q"+c.q+" REJECT "+text);
 }
 for(const text of c.unknown){
  const result=ctx.LocalCommunicativeJudge.evaluate({conceptId:rule.conceptId,difficulty:"starter",utterance:text},rules);
  assert.equal(result.verdict,"UNKNOWN","Q"+c.q+" UNKNOWN "+text);
 }
}
const q7=rules[6],q9=rules[8];
for(const utterance of ["Did you see the book?","Did you see the books?","Is the box on the cart?"]){
 assert.notEqual(ctx.LocalCommunicativeJudge.evaluate({conceptId:q7.conceptId,difficulty:"starter",utterance:utterance},rules).verdict,"ACCEPT");
}
assert.notEqual(ctx.LocalCommunicativeJudge.evaluate({conceptId:q9.conceptId,difficulty:"starter",utterance:"Please look at the box."},rules).verdict,"ACCEPT");
for(const html of ["index.html","dev.html"]){
 const text=read(html);
 assert(text.includes("data/s006-communication.js?v=s006-communication-v2-engine-guard-v1"));
 assert.equal((text.match(/src="data\/s006-communication\.js\?/g)||[]).length,1);
}
const story=read("engine/stories/S006.js");
assert.equal((story.match(/C\.question\("s006\.communication\./g)||[]).length,10);
assert(story.includes('{ type: "s006EndingLetter" }'));
console.log("S006 Communication V2: 10 questions / rules / pools, hint/accept/reject/unknown/Story/HTML contracts PASS");
