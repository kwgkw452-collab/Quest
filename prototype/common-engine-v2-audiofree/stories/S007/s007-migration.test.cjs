'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../../../../');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const pack=require('./story.json');
const {validate}=require('../../schema.cjs');
const {createRunner}=require('../../runner.cjs');
const {judge}=require('../../judge.cjs');

function legacyStory(){
 const context={window:null,StoryRegistry:{register(s){context.story=s;}}};
 context.window=context;
 vm.runInNewContext(load('engine/commands/story-commands.js'),context,{filename:'story-commands.js'});
 vm.runInNewContext(load('engine/stories/S007.js'),context,{filename:'S007.js'});
 return JSON.parse(JSON.stringify(context.story.steps));
}
function legacyQuestions(){
 const questions=[],context={window:null,QuestionDatabase:{register(q){questions.push(q);}},CommunicativeJudgeRuleData:[],LotteryPoolData:[],LotteryEngine:{init(){}}};
 context.window=context;
 vm.runInNewContext(load('data/s007-communication.js'),context,{filename:'s007-communication.js'});
 return {questions:JSON.parse(JSON.stringify(questions)),metadata:JSON.parse(JSON.stringify(context.S007DraftCommunicationMetadata))};
}
function flat(){return pack.sceneOrder.flatMap(id=>pack.scenes[id].steps);}
test('converted S007 validates without runtime Story-specific branches',()=>assert.deepEqual(validate(pack),[]));
test('all 13 scenes preserve Production background order',()=>{
 const paths=flat().filter(x=>x.type==='scene').map(x=>x.asset);
 const original=legacyStory().filter(x=>x.type==='background').map(x=>x.src);
 assert.deepEqual(paths,original);
 assert.equal(paths.length,13);
});
test('every original dialogue and Japanese support text remains unchanged and ordered',()=>{
 const old=legacyStory().filter(x=>x.type==='dialogue').map(x=>({speaker:x.speaker||null,text:x.text,supportText:x.supportText??null}));
 const converted=flat().filter(x=>x.type==='line').map(x=>({speaker:x.speaker,text:x.text,supportText:x.supportText??null}));
 assert.deepEqual(converted,old);
 assert.equal(converted.length,112);
});
test('all ten original question identifiers and order preserved',()=>{
 const old=legacyStory().filter(x=>x.type==='question').map(x=>x.questionId);
 const converted=flat().filter(x=>x.type==='challenge').map(x=>x.id);
 assert.deepEqual(converted,old);
 assert.equal(converted.length,10);
});
test('all 146 registered variants and three Pico hints unchanged',()=>{
 const {questions}=legacyQuestions();assert.equal(questions.length,10);
 for(const q of questions){
  const migrated=pack.challenges[q.id];
  assert.deepEqual(migrated.rule.accept,q.answers,'answers changed: '+q.id);
  assert.deepEqual(migrated.hints,q.picoSupport,'hints changed: '+q.id);
  assert.equal(migrated.goalJa,q.prompt);
  assert.equal(migrated.modelEn,q.communicative.expectedUtterance);
 }
 assert.equal(questions.reduce((n,q)=>n+q.answers.length,0),146);
});
test('Meg joins after accepted invitation and before scene13 exactly as Production',()=>{
 const steps=flat(),index=steps.findIndex(s=>s.type==='setFlag');
 assert.equal(steps.filter(s=>s.type==='setFlag').length,1);
 assert.deepEqual(steps[index],{type:'setFlag',key:'s007.megJoined',value:true});
 assert(index>steps.findIndex(s=>s.text==='Yes! I want to see the world!'));
 assert(index<steps.findIndex(s=>s.asset==='images/007/S007-Scene-13.png'));
});
test('complete actual S007 dataset using mock microphone and exact model phrases, with Save',async()=>{
 const saved=[];
 let current='',questions=0,lines=0;
 const runner=createRunner(pack,{recognize:async()=>({status:'final',text:pack.challenges[current].modelEn}),storage:{write:async x=>saved.push(x)}});
 for(let i=0;i<350;i++){
  const step=await runner.advance();
  if(step.type==='line')lines++;
  if(step.type==='challenge'){
   current=step.id;questions++;
   const r=await runner.talk();assert.equal(r.type,'accepted','model phrase rejected for '+current);
  }
  if(step.type==='end'){
   assert.equal(questions,10);assert.equal(lines,112);
   assert.equal(step.flags['s007.megJoined'],true);
   assert.equal(saved.length,1);
   assert.equal(saved[0].flags['s007.megJoined'],true);
   return;
  }
 }
 assert.fail('S007 did not finish');
});
test('legacy judge has non-enumerated accept branches for questions 2 and 4; judge parity remains HOLD',()=>{
 const {metadata}=legacyQuestions();
 assert.equal(metadata.status,'DRAFT_NOT_APPROVED');
 const probe2='Do you take beautiful pictures?';
 const probe4='Look at the colorful birds!';
 assert.equal(judge(pack.challenges['s007.communication.2'].rule,probe2).decision,'REJECT');
 assert.equal(judge(pack.challenges['s007.communication.4'].rule,probe4).decision,'REJECT');
});
