'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../../../../');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const pack=require('./story.json');
const stage1=require('../../approved-pico-stage1-lock.json');
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
 return {questions:JSON.parse(JSON.stringify(questions)),metadata:JSON.parse(JSON.stringify(context.S007DraftCommunicationMetadata)),legacyRules:context.CommunicativeJudgeRuleData};
}
// Director LOCK: source variants missing a required referent, pace or place.
const incompleteSourceVariants= {
 "s007.communication.2": [
  "Do you take a picture?",
  "Do you take pictures?",
  "Do you take photos?",
  "Do you take a photo?",
  "Did you take a picture?",
  "Did you take pictures?",
  "Did you take photos?",
  "You take pictures?",
  "You take photos?",
  "Do you like to take pictures?"
 ],
 "s007.communication.3": [
  "Let's walk."
 ],
 "s007.communication.4": [
  "Look at birds!"
 ],
 "s007.communication.7": [
  "Please wait."
 ]
};
const sourceReplacement= q=>q.answers.filter(a=>!(incompleteSourceVariants[q.id]||[]).includes(a));
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
test('source variants audited against the Director LOCK; Pico hints unchanged',()=>{
 const {questions}=legacyQuestions();assert.equal(questions.length,10);
 for(const q of questions){
  const migrated=pack.challenges[q.id];
  assert.deepEqual(migrated.rule.accept,[...sourceReplacement(q),...(q.id.endsWith('.10')?['Great shot!']:[])],'answers changed: '+q.id);
  assert.deepEqual(migrated.hints,[stage1[q.id],...q.picoSupport.slice(1)],'hints changed: '+q.id);
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
test('all 146 enumerated S007 variants are checked against the Director LOCK',()=>{
 const {questions,metadata}=legacyQuestions();
 assert.equal(metadata.status,'DRAFT_NOT_APPROVED');
 for(const q of questions)for(const phrase of q.answers){
  const want=(incompleteSourceVariants[q.id]||[]).includes(phrase)?'UNKNOWN':'ACCEPT';
  assert.equal(judge(pack.challenges[q.id].rule,phrase).decision,want,q.id+' '+phrase);
 }
});

test('all ten S007 Goals distinguish matching intent, contradictions and incomplete evidence',()=>{
 const cases=[
  ['Hi, Meg!','Goodbye!','Hello? I'],
  ['Do you take pictures of birds?','Do you take pictures of cars?','Do you take pictures?'],
  ["Let's walk slowly.",'Let’s walk fast.','Let’s walk'],
  ['Look at the baby bird!','Look at the adult bird.','Look at'],
  ["Don't move!",'Please move!','Don’t'],
  ["Don't worry.",'You should worry.','Please don’t'],
  ['Please wait here.','Please wait over there.','Please wait'],
  ['Just a moment.','Wait for an hour.','Just a'],
  ['Be quiet, please.','Speak louder, please.','Please be'],
  ['Nice picture!','Nice camera!','Nice']
 ];
 for(const [i,phrases] of cases.entries())for(const [j,phrase] of phrases.entries()){
  const id='s007.communication.'+(i+1);
  assert.equal(judge(pack.challenges[id].rule,phrase).decision,['ACCEPT','REJECT','UNKNOWN'][j],id+' '+phrase);
 }
});

test('S007 target and pronoun interpretations are tied to the current question',()=>{
 const cases={
  2:[['Do you take pictures of them?','ACCEPT'],['Do you take photos of it?','UNKNOWN'],
     ['Do you take beautiful pictures?','UNKNOWN'],['Do you take pictures of cars?','REJECT'],['Do you take photos of mountains?','REJECT'],
     ['Do not take pictures of birds.','REJECT'],['Did you take some bird photos?','ACCEPT']],
  4:[['Look at it!','ACCEPT'],['Look at them!','UNKNOWN'],['Look at birds!','UNKNOWN'],
     ['Look at the birds!','ACCEPT'],['Look at the colorful birds!','UNKNOWN'],
     ['Look at the adult birds!','REJECT'],["Don't look at the birds.",'REJECT'],
     ['Look at the tree.','REJECT'],['Look at the elephant.','REJECT'],['Look at the beautiful baby birds.','ACCEPT']]
 };
 for(const [n,phrases] of Object.entries(cases))for(const [phrase,expected] of phrases){
  assert.equal(judge(pack.challenges['s007.communication.'+n].rule,phrase).decision,expected,'Q'+n+' '+phrase);
 }
});

test('S007 cross-question scenarios preserve valid shared answers and reject accidental advancement',()=>{
 const {questions,legacyRules}=legacyQuestions();
 let count=0;
 for(const [i,q] of questions.entries())for(const [j,source] of questions.entries())for(const phrase of source.answers){
  if(i===j){count++;continue;}
  const actual=judge(pack.challenges[q.id].rule,phrase).decision==='ACCEPT';
  assert.equal(actual,Boolean(legacyRules[i].accept(phrase)),q.id+' vs '+source.id+' '+phrase);
  count++;
 }
 assert.equal(count,1460);
});
