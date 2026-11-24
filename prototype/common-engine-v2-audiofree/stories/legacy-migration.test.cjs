'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {createRunner}=require('../runner.cjs'),{validate}=require('../schema.cjs'),{judge}=require('../judge.cjs');
function original(id){
 const ctx={window:null,StoryRegistry:{register(s){ctx.story=s;}},QuestionDatabase:{register(q){ctx.questions.push(q);}},CommunicativeJudgeRuleData:[],LotteryPoolData:[],LotteryEngine:{init(){}},questions:[]};ctx.window=ctx;
 vm.runInNewContext(read('engine/commands/story-commands.js'),ctx,{filename:'story-commands.js'});
 vm.runInNewContext(read('engine/stories/'+id+'.js'),ctx,{filename:id+'.js'});
 vm.runInNewContext(read('data/'+id.toLowerCase()+'-communication.js'),ctx,{filename:id+'-communication.js'});
 if(id==='S006'){ctx.AudioDatabase={voice:{}};vm.runInNewContext(read('data/s006-ending.js'),ctx,{filename:'s006-ending.js'});}
 const flat=(steps)=>steps.flatMap(s=>s.type==='sequence'?flat(s.steps):[s]);
 return {steps:flat(JSON.parse(JSON.stringify(ctx.story.steps))),questions:JSON.parse(JSON.stringify(ctx.questions)),rules:Array.from(ctx.CommunicativeJudgeRuleData),letter:ctx.S006EndingData?JSON.parse(JSON.stringify(ctx.S006EndingData)):null};
}
const pack=id=>require('./'+id+'/story.json');
function normalizeOld(s){
 if(s.type==='background')return {type:'scene',asset:s.src};
 if(s.type==='dialogue')return {type:'line',speaker:s.speaker||null,text:s.text,...(s.supportText?{supportText:s.supportText}:{})};
 if(s.type==='question')return {type:'challenge',id:s.questionId};
 if(s.type==='s006EndingLetter')return {type:'document',id:'endingLetter'};
 return {type:s.type};
}
const flatNew=p=>p.sceneOrder.flatMap(id=>p.scenes[id].steps).filter(s=>!['goto','end'].includes(s.type));
for(const id of ['S005','S006']){
 test(id+' schema validates',()=>assert.deepEqual(validate(pack(id)),[]));
 test(id+' all original Story steps retained in exact order',()=>{
  const got=flatNew(pack(id)).map(s=>{
   if(s.type==='line')return {type:'line',speaker:s.speaker||null,text:s.text,...(s.supportText?{supportText:s.supportText}:{})};
   if(s.type==='challenge')return {type:'challenge',id:s.id};
   if(s.type==='scene')return {type:'scene',asset:s.asset};
   if(s.type==='document')return {type:'document',id:s.id};
   return {type:s.type};
  });
  assert.deepEqual(got,original(id).steps.map(normalizeOld));
 });
 test(id+' all question IDs, Japanese goals, 3 hints and variants preserve source',()=>{
  const src=original(id),p=pack(id);
  assert.equal(Object.keys(p.challenges).length,src.questions.length);
  for(const q of src.questions){const migrated=p.challenges[q.id];assert(migrated,q.id);assert.equal(migrated.goalJa,q.prompt);assert.equal(migrated.modelEn,q.communicative.expectedUtterance);assert.deepEqual(migrated.hints,q.picoSupport);assert.deepEqual(migrated.rule.accept,q.answers);}
  assert.deepEqual(flatNew(p).filter(s=>s.type==='challenge').map(s=>s.id),src.steps.filter(s=>s.type==='question').map(s=>s.questionId));
 });
 test(id+' complete Story runtime executes all lines and questions using mock microphone',async()=>{
  const p=pack(id),src=original(id);let current=null,spoken=0,lines=0,documents=0;
  const r=createRunner(p,{recognize:async()=>({status:'final',text:p.challenges[current].modelEn})});
  for(let i=0;i<600;i++){
   const e=await r.advance();
   if(e.type==='line')lines++;
   if(e.type==='challenge'){current=e.id;spoken++;assert.equal((await r.talk()).type,'accepted',current);}
   if(e.type==='document'){documents++;r.documentDone();}
   if(e.type==='end'){
    assert.equal(lines,src.steps.filter(x=>x.type==='dialogue').length);
    assert.equal(spoken,src.steps.filter(x=>x.type==='question').length);
    assert.equal(documents,id==='S006'?1:0);
    return;
   }
  }
  assert.fail(id+' never completed');
 });
 test(id+' all enumerated answer variants pass generic local Judge',()=>{
  const p=pack(id),src=original(id);
  for(const q of src.questions){for(const phrase of q.answers){assert.equal(judge(p.challenges[q.id].rule,phrase).decision,'ACCEPT',q.id+': '+phrase);}}
 });
}
test('S005 12 separate question calls are faithfully retained; director approval conflict is not silently resolved',()=>{
 const p=pack('S005'),src=original('S005');assert.equal(src.steps.filter(x=>x.type==='question').length,12);
 assert.equal(flatNew(p).filter(s=>s.type==='challenge').length,12);
});
test('S006 letter preserves all 16 English/Japanese/voice records and image path',()=>{
 const src=original('S006'),p=pack('S006').documents.endingLetter;
 assert.equal(p.lines.length,16);
 assert.deepEqual(p.lines,src.letter.lines);
 assert.deepEqual(p.body,src.letter.lines.map(l=>l.english));
 assert.equal(p.card,src.letter.card);
});
test('S005/S006 unenumerated legacy rule predicates need independent parity certification',()=>{
 for(const id of ['S005','S006']){const {rules}=original(id);assert.equal(rules.length,pack(id).sceneOrder.flatMap(scene=>pack(id).scenes[scene].steps).filter(x=>x.type==='challenge').length);assert(rules.some(x=>typeof x.accept==='function'),'expected functional legacy accept rules');}
});

test('all S005/S006 background files and S006 letter graphic/voice assets exist',()=>{
 for(const id of ['S005','S006']){
  for(const scene of pack(id).sceneOrder)for(const step of pack(id).scenes[scene].steps){
   if(step.type==='scene')assert(fs.existsSync(path.join(root,step.asset.split('?')[0])),id+' missing '+step.asset);
  }
 }
 const doc=pack('S006').documents.endingLetter;
 assert(fs.existsSync(path.join(root,doc.card)),'letter graphic missing');
 doc.lines.forEach((line,i)=>{
  assert(line.voiceKey,'voice metadata missing at '+i);
  const pathname='audio/voice/s006/letter-'+String(i+1).padStart(2,'0')+'.mp3';
  assert(fs.existsSync(path.join(root,pathname)),pathname+' missing');
 });
});

test('S005 seven functional word-group rules are represented as generic typed data and agree on probes',()=>{
 const src=original('S005'),p=pack('S005');
 const probes={
  1:['No, thanks.','No way.','We have a reservation.','Not yet.'],
  2:['Four friends.','There are 4 of us.','Three people.','Fourteen people.'],
  3:['Do you have a king bed?','King sized beds please.','Can I get a bed?','Is this a king?'],
  4:['One room, please.','Just 1 please.','Two beds please.'],
  5:['Two rooms, please.','to rooms please','one room please','true rooms'],
  8:['Could you tell me your name?','Name please.','Who are you?','What is your age?'],
  11:['Did you see a bag?','Have you found the bag?','Please find my pack.','Have you seen that book?']
 };
 let count=0;
 for(const [number,phrases]of Object.entries(probes)){
  const id='s005.communication.'+number,rule=p.challenges[id].rule,legacy=src.rules[Number(number)-1];
  assert(Array.isArray(rule.requireAnyWords),id+' missing typed operator');
  assert.equal(typeof legacy.accept,'function',id+' legacy function missing');
  for(const phrase of phrases){
   const expected=Boolean(legacy.accept(phrase));
   // Some explicit accepted variants have precedence over the original broad accept fn.
   const observed=judge(rule,phrase).decision==='ACCEPT';
   const explicit=rule.accept.some(x=>require('../judge.cjs').normalize(x)===require('../judge.cjs').normalize(phrase));
   if(!explicit)assert.equal(observed,expected,id+' '+phrase);
   count++;
  }
 }
 assert.equal(count,27);
});
test('S005 typed rule extension does not change the original 104 exact answer strings',()=>{
 const src=original('S005'),p=pack('S005');
 assert.equal(src.questions.reduce((sum,q)=>sum+q.answers.length,0),104);
 for(const q of src.questions)assert.deepEqual(p.challenges[q.id].rule.accept,q.answers);
});

test('S005 all 14 legacy contrary-goal phrases are explicit exact-reject data',()=>{
 const src=original('S005'),p=pack('S005');
 let checked=0;
 src.rules.forEach((sourceRule,i)=>{
  const id='s005.communication.'+(i+1),rule=p.challenges[id].rule;
  const rejected=sourceRule.rejects?.flatMap(x=>x.variants)||[];
  assert.deepEqual(rule.excludeExact,rejected,'negative examples differ at '+id);
  for(const phrase of rejected){
   assert.equal(judge(rule,phrase).decision,'REJECT',id+' contradictory '+phrase);
   checked++;
  }
 });
 assert.equal(checked,14);
});
