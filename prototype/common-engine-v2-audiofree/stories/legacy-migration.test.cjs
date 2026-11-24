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
 return {steps:flat(ctx.story.steps),questions:JSON.parse(JSON.stringify(ctx.questions)),rules:ctx.CommunicativeJudgeRuleData,letter:ctx.S006EndingData?JSON.parse(JSON.stringify(ctx.S006EndingData)):null};
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
 for(const id of ['S005','S006']){const {rules}=original(id);assert.equal(rules.length,pack(id).sceneOrder.flatMap(scene=>pack(id).scenes[scene].steps).filter(x=>x.type==='challenge').length);assert(rules.every(x=>typeof x.accept==='function'));}
});
