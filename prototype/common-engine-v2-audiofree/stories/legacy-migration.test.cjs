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
  for(const q of src.questions){const migrated=p.challenges[q.id];assert(migrated,q.id);
   const revisedQ10=id==='S006'&&q.id==='s006.communication.10';
   const q6Recognition=id==='S006'&&q.id==='s006.communication.6';
   assert.equal(migrated.goalJa,revisedQ10?'これはあなたの箱です。':q.prompt);
   assert.equal(migrated.modelEn,revisedQ10?'This is your box!':q.communicative.expectedUtterance);
   assert.deepEqual(migrated.hints,q.picoSupport);
   assert.deepEqual(migrated.rule.accept,q6Recognition?[...q.answers,'Look at the','Look at that','Please look at the','Please look at that']:q.answers);
  }
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
  const rejected=JSON.parse(JSON.stringify(sourceRule.rejects?.flatMap(x=>x.variants)||[]));
  assert.deepEqual(rule.excludeExact,rejected,'negative examples differ at '+id);
  for(const phrase of rejected){
   assert.equal(judge(rule,phrase).decision,'REJECT',id+' contradictory '+phrase);
   checked++;
  }
 });
 assert.equal(checked,14);
});

test('S006 ten anchored grammar rules agree with original legacy accept predicates on 60 sentence probes',()=>{
 const old=original('S006'),p=pack('S006');
 const matrix=[
 ['Could we help you?','I can help you','Do you need some help?','You need help','I cannot help you','Could we help you and steal it?'],
 ['What color is another box?','What colour is it?','Can you describe another box?','Where is another box?','What is the color?','What color is that box and where is it?'],
 ['Where are the other boxes?','Where is another box?','Where can we find the boxes?','Did you see another box?','Where is the book?','Where are the other boxes and carts?'],
 ['Show me another box','Could you show us the boxes?','Can I check the box?','Can you show me a book?','Can I see the bag?','Show me another box and take it away'],
 ['You have a box?','Have you got those boxes?','Is another box here?','Do you see the box?','You do not have the box?','Do you have a book?'],
 ['Please look at the ribbon','Look at those red ribbons','Could you check your ribbon?','Look at the cart','Please do not look at the ribbon','Look at the ribbons and the box'],
 ['Did you see the book?','Have you seen another box?','You saw the books?','Did you see the cart?','Did you see the box and book?','I did see another box'],
 ['Wait a minute','Please wait for us','Just one moment','Wait for the bus tomorrow','Please do not wait','Wait a minute and then go'],
 ['Please find another box','Can you help me find the box?','Could you look for those boxes?','Please find a book','I found the box','Find the box and keep it'],
 ['This is your box','We have found the boxes now','Your box is here','We have lost your box','I found the book','Here is your box and the ribbon']
 ];
 assert.equal(matrix.length,10);let count=0;
 for(let i=0;i<10;i++){
  const id='s006.communication.'+(i+1),rule=p.challenges[id].rule,legacy=old.rules[i];
  assert.equal(typeof legacy.accept,'function');
  assert.equal(rule.fullPatterns.length,1);
  for(const phrase of matrix[i]){
   const sourceAccept=Boolean(legacy.accept(phrase));
   const actual=judge(rule,phrase).decision==='ACCEPT';
   assert.equal(actual,sourceAccept,id+' source parity: '+phrase);
   count++;
  }
 }
 assert.equal(count,60);
});
test('S006 anchored rules do not confuse another box with an unrelated question',()=>{
 const p=pack('S006');
 for(const phrase of ['Where is another box?','I found another box','Did you see another box?']){
  assert.equal(judge(p.challenges['s006.communication.2'].rule,phrase).decision,'REJECT','Q2 must not accept '+phrase);
 }
 assert.equal(judge(p.challenges['s006.communication.3'].rule,'Where is another box?').decision,'ACCEPT');
 assert.equal(judge(p.challenges['s006.communication.7'].rule,'Did you see the book?').decision,'ACCEPT');
});

test('S006 ten official model answers cannot pass a different question',()=>{
 const p=pack('S006');
 const ids=Array.from({length:10},(_,i)=>'s006.communication.'+(i+1));
 for(let i=0;i<10;i++)for(let j=0;j<10;j++){
  if(i===j)continue;
  const answer=p.challenges[ids[j]].modelEn;
  assert.equal(judge(p.challenges[ids[i]].rule,answer).decision,'REJECT',
   'cross-question false positive: Q'+(i+1)+' accepted Q'+(j+1)+' sentence '+answer);
 }
});

test('S006 current Q7 saw-box spec is not replaced by obsolete cart-centered QA fixture',()=>{
 const current=pack('S006').challenges['s006.communication.7'];
 const obsolete=JSON.parse(read('tests/s006-q7-final-cases.json'));
 assert.equal(current.goalJa,'箱を見ましたか？');
 assert.equal(current.modelEn,'Did you see the box?');
 assert.equal(judge(current.rule,'Did you see the book?').decision,'ACCEPT');
 assert.equal(judge(current.rule,'Is the box on the cart?').decision,'REJECT');
 assert(obsolete.required.includes('Is the box on the cart?'));
 assert(!current.rule.accept.includes('Is the box on the cart?'));
});

test('S006 previously approved ASR fallbacks are local to the correct question',()=>{
 const p=pack('S006');
 const by=n=>p.challenges['s006.communication.'+n].rule;
 for(const n of [2,3,4,5,7,9,10]){
  assert.deepEqual(by(n).wordAliases,{book:'box',books:'boxes'});
 }
 assert.equal(judge(by(2),'What color is the book?').decision,'ACCEPT');
 assert.equal(judge(by(3),'Where are the other books?').decision,'ACCEPT');
 assert.equal(judge(by(4),'Could you show me the books?').decision,'ACCEPT');
 assert.equal(judge(by(5),'Do you have the books?').decision,'ACCEPT');
 assert.equal(judge(by(7),'Did you see the books?').decision,'ACCEPT');
 assert.equal(judge(by(9),'Can you find the books?').decision,'ACCEPT');
 assert.equal(judge(by(10),'This is your book!').decision,'ACCEPT');
 for(const n of [2,3,4,5,7,9,10]){
  assert.equal(judge(by(n),'I have a book about birds.').decision,'REJECT',
   'ASR replacement must not accept unrelated utterances at Q'+n);
 }
 for(const phrase of ['Look at the','Look at that','Please look at the','Please look at that']){
  assert.equal(judge(by(6),phrase).decision,'ACCEPT',phrase);
 }
 for(const phrase of ['Look at the bus','Do not look at the','Look at that cart']){
  assert.equal(judge(by(6),phrase).decision,'REJECT',phrase);
 }
 assert.equal(p.challenges['s006.communication.10'].goalJa,'これはあなたの箱です。');
 assert.equal(p.challenges['s006.communication.10'].modelEn,'This is your box!');
});
test('generic ASR token alias only applies on the question where configured',()=>{
 const p=pack('S006');
 const q2={...p.challenges['s006.communication.2'].rule};
 delete q2.wordAliases;
 assert.equal(judge(q2,'What color is the book?').decision,'REJECT');
 assert.equal(judge(q2,'What color is the box?').decision,'ACCEPT');
});
