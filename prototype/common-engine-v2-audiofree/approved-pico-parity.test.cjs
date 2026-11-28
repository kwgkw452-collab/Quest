'use strict';
// LOCKED migration guard: PR #7 (bfdb08666f3a9b12b4d9ff13483ab14d13c7638f) English-word Support 1,
// older Production Support 2/3, and Director-approved S006 Q10 updated Goal/Support overrides.
// Never silently replace newer approvals with outdated Production data.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const stage1=Object.freeze(require('./approved-pico-stage1-lock.json'));
function productionQuestions(storyId){
 const questions=[];
 const ctx={QuestionDatabase:{register(q){questions.push(q)}},CommunicativeJudgeRuleData:[],LotteryPoolData:[],LotteryEngine:{init(){}},window:{}};
 ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync(path.join(root,'data',storyId.toLowerCase()+'-communication.js'),'utf8'),ctx,{filename:storyId+'.js',timeout:3000});
 return questions;
}
const override10={
 goal:'これはあなたの箱です。',
 model:'This is your box!',
 lastTwo:['『これは』は This is、『あなたの箱』は your box だピコ。','This is your box! と言うピコ。']
};
for(const storyId of ['S005','S006','S007']){
 test(storyId+' Stage1 English-word LOCK + approved Goal/Support 2/3 parity',()=>{
  const pack=require('./stories/'+storyId+'/story.json'),questions=productionQuestions(storyId);
  assert.equal(Object.keys(pack.challenges).length,questions.length);
  for(const q of questions){
   const actual=pack.challenges[q.id];assert(actual,'missing '+q.id);
   assert.equal(actual.hints.length,3,q.id);
   assert.equal(actual.hints[0],stage1[q.id],'PR7 Support1 mismatch: '+q.id);
   assert.match(actual.hints[0],/[A-Za-z]+/,'Support1 requires English word: '+q.id);
   if(q.id==='s006.communication.10'){
    assert.equal(actual.goalJa,override10.goal);
    assert.equal(actual.modelEn,override10.model);
    assert.deepEqual(actual.hints.slice(1),override10.lastTwo);
   }else{
    assert.equal(actual.goalJa,q.prompt,'Goal mismatch: '+q.id);
    assert.equal(actual.modelEn,q.communicative.expectedUtterance,'Model mismatch: '+q.id);
    assert.deepEqual(actual.hints.slice(1),Array.from(q.picoSupport).slice(1),'Support2/3 mismatch: '+q.id);
   }
  }
 });
}
test('common UI never adds an invented generic English support prompt',()=>{
 const src=fs.readFileSync(path.join(__dirname,'unified.js'),'utf8');
 assert(!src.includes('How would you say this in English?'));
 const engine=fs.readFileSync(path.join(__dirname,'communication.cjs'),'utf8');
 assert(engine.includes("supportText?'ピコ：'+supportText:''"));
 assert(src.includes('setText(v.goalJa,v.displayText)'));
});
