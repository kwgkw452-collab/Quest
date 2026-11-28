'use strict';
// Migration guard: approved Production Story question text and Pico Support are the authority.
// NEVER regenerate pedagogical hints from the model answer in V2.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function approved(id){
 const questions=[];
 const context={
  QuestionDatabase:{register(q){questions.push(q)}},
  CommunicativeJudgeRuleData:[],
  LotteryPoolData:[],
  LotteryEngine:{init(){}},
  window:{}
 };
 context.window=context;
 vm.runInNewContext(fs.readFileSync(path.join(root,'data',id.toLowerCase()+'-communication.js'),'utf8'),context,
  {filename:id+'.js',timeout:3000});
 return questions;
}
for(const storyId of ['S005','S006','S007']){
 test(storyId+' Common V2 Pico hints and Goals match approved Production source exactly',()=>{
  const pack=require('./stories/'+storyId+'/story.json');
  const questions=approved(storyId);
  assert.equal(Object.keys(pack.challenges).length,questions.length);
  for(const q of questions){
   assert(pack.challenges[q.id], 'missing '+q.id);
   // Director-approved later change overrides the older Production source for S006 Q10.
   if(q.id==='s006.communication.10'){
    assert.equal(pack.challenges[q.id].goalJa,'これはあなたの箱です。');
    assert.equal(pack.challenges[q.id].modelEn,'This is your box!');
    assert.deepEqual(pack.challenges[q.id].hints,[
     '見つけた箱を持ち主に渡すピコ。『これはあなたの箱です。』と伝えるピコ。',
     '『これは』は This is、『あなたの箱』は your box だピコ。',
     'This is your box! と言うピコ。'
    ]);
    continue;
   }
   assert.equal(pack.challenges[q.id].goalJa,q.prompt,'Goal mismatch: '+q.id);
   assert.deepEqual(pack.challenges[q.id].hints,Array.from(q.picoSupport),'Pico hint mismatch: '+q.id);
   assert.equal(pack.challenges[q.id].modelEn,q.communicative.expectedUtterance,'Answer mismatch: '+q.id);
  }
 });
}
test('unified UI must never fabricate generic English support prompt',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'unified.js'),'utf8');
 assert(!ui.includes('How would you say this in English?'));
 assert(ui.includes("v.supportText?'ピコ：'+v.supportText:''"));
});
