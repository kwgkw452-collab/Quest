'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {judge}=require('../judge.cjs');
const {createCommunication}=require('../communication.cjs');
const s006=require('./S006/story.json'),s005=require('./S005/story.json'),s007=require('./S007/story.json');
const q=n=>s006.challenges['s006.communication.'+n];
const cases=[
 {n:1,valid:'Can we help you?',alternative:'Could we help you?',wrongIntent:'I cannot help you',wrongTarget:'Can we help the bus?',ambiguous:'Can we',asr:null},
 {n:2,valid:'What color is the box?',alternative:'What color is it?',wrongIntent:'Where is the box?',wrongTarget:'What color is another box?',ambiguous:'What color',asr:'What color is the book?'},
 {n:3,valid:'Where are the other boxes?',alternative:'Where is another box?',wrongIntent:'Did you see the box?',wrongTarget:'Where is the bag?',ambiguous:'Where are',asr:'Where are the other books?'},
 {n:4,valid:'Can we see that box?',alternative:'Could you show me that red box?',wrongIntent:'Do not show me the box',wrongTarget:'Show us that little bag, please.',ambiguous:'Could you show',asr:'Show us that little book, please.'},
 {n:5,valid:'Do you have the box?',alternative:'Have you got that box?',wrongIntent:'You do not have the box?',wrongTarget:'Do you have the bag?',ambiguous:'Do you have',asr:'Do you have the book?'},
 {n:6,valid:'Please look at this ribbon.',alternative:'Look at the',wrongIntent:'Do not look at the ribbon',wrongTarget:'Look at the cart',ambiguous:'Look at',asr:null},
 {n:7,valid:'Did you see the box?',alternative:'Did you see the books?',wrongIntent:'Please find the box.',wrongTarget:'Did you see the cart?',ambiguous:'Did you',asr:'Did you see the book?'},
 {n:8,valid:'Please wait!',alternative:'Just a moment.',wrongIntent:'Please do not wait.',wrongTarget:'Stop the train',ambiguous:'Please',asr:null},
 {n:9,valid:'Please find the box.',alternative:'Can you help me find the box?',wrongIntent:'I found the box!',wrongTarget:'Please find the bag.',ambiguous:'Please find',asr:'Please find the book.'},
 {n:10,valid:'This is your box!',alternative:'Here is your box!',wrongIntent:'I lost the box.',wrongTarget:'This is another box.',ambiguous:'This is',asr:'This is your book!'}
];
test('QA38 S006 ten-question ACCEPT / REJECT / UNKNOWN matrix including approved ASR',()=>{
 let count=0;
 for(const c of cases){
  const rule=q(c.n).rule;
  for(const [field,want] of [['valid','ACCEPT'],['alternative','ACCEPT'],['wrongIntent','REJECT'],['wrongTarget','REJECT'],['ambiguous','UNKNOWN'],['asr','ACCEPT']]){
   if(!c[field])continue;
   assert.equal(judge(rule,c[field]).decision,want,'Q'+c.n+' '+field+': '+c[field]);count++;
  }
 }
 assert.equal(count,57);
});
test('QA38 explicitly protects Q2 / Q3 / Q10 another-box distinction and old Q10 HOLD',()=>{
 assert.equal(judge(q(2).rule,'What color is another box?').decision,'REJECT');
 assert.equal(judge(q(3).rule,'Where is another box?').decision,'ACCEPT');
 assert.equal(judge(q(10).rule,'This is another box.').decision,'REJECT');
 assert.equal(judge(q(10).rule,'I found the box.').decision,'ACCEPT'); // preserve old behavior, formal approval HOLD
 assert.equal(judge(q(4).rule,'Show us that little box, please.').decision,'ACCEPT');
});
test('QA38 exclusion precedence and declaration schema are independent of Story ID',()=>{
 const rule={accept:['go now','approved'],fullPatterns:['(?:go now)'],excludeExact:['go now'],exclude:['forbidden'],rejectPatterns:['(?:approved)']};
 assert.equal(judge(rule,'go now').decision,'REJECT');
 assert.equal(judge(rule,'forbidden approved').decision,'REJECT');
 assert.equal(judge(rule,'approved').decision,'REJECT');
 assert.equal(judge({accept:['approved'],fullPatterns:['(?:fine)']},'unfinished').decision,'UNKNOWN');
 assert.equal(judge({accept:['approved'],fullPatterns:['(?:fine)']},'fine').decision,'ACCEPT');
});
test('QA38 wrong answers of other S006 questions never gain ACCEPT',()=>{
 for(const [a,question] of Object.entries(s006.challenges))for(const [b,other] of Object.entries(s006.challenges)){
  if(a===b)continue;
  assert.notEqual(judge(question.rule,other.modelEn).decision,'ACCEPT',a+' accepted model '+b);
 }
});
test('QA38 existing S005/S007 model variants and explicit excluded cases retain meaning',()=>{
 for(const story of [s005,s007])for(const [id,question] of Object.entries(story.challenges)){
  assert.equal(judge(question.rule,question.modelEn).decision,'ACCEPT',id);
  for(const phrase of question.rule.excludeExact||[])assert.equal(judge(question.rule,phrase).decision,'REJECT',id+' '+phrase);
 }
});
test('QA38 UNKNOWN prevents progression, retains Japanese Goal and Pico support on retry',async()=>{
 const item=q(2),answers=['What color','What color is the box?'];
 const c=createCommunication(item,{recognize:async()=>({status:'final',text:answers.shift()})});
 assert.equal(c.support().supportStage,1);
 const unknown=await c.speak();
 assert.equal(unknown.type,'unknown');
 assert.equal(unknown.view.goalJa,item.goalJa);
 assert.equal(unknown.view.supportStage,1);
 assert.equal(unknown.view.supportText,item.hints[0]);
 assert.equal(unknown.view.state,'READY');
 assert.equal(unknown.view.actions.includes('talk'),true);
 assert.equal((await c.speak()).type,'accepted');
 const fresh=createCommunication(q(3),{recognize:async()=>({status:'final',text:'Where are the other boxes?'})});
 assert.equal(fresh.view().supportStage,0);
});

test('Independent QA PR39: all six reported mismatches are corrected without broadening other questions',()=>{
 const checks=[
  [2,'What color is the suitcase?','REJECT'],
  [2,'How big is the box?','REJECT'],
  [4,'Show me that small box, please.','ACCEPT'],
  [6,'Look at the watch.','REJECT'],
  [10,'This is my box.','REJECT'],
  [10,"This is someone else’s box.",'REJECT']
 ];
 for(const [n,utterance,decision] of checks){
  assert.equal(judge(q(n).rule,utterance).decision,decision,'QA39 Q'+n+' '+utterance);
 }
 assert.equal(judge(q(2).rule,'What color is it?').decision,'ACCEPT');
 assert.equal(judge(q(3).rule,'Where is another box?').decision,'ACCEPT');
 assert.equal(judge(q(4).rule,'Show us that little box, please.').decision,'ACCEPT');
 assert.equal(judge(q(6).rule,'Look at the').decision,'ACCEPT'); // preserve existing ASR HOLD boundary
 assert.equal(judge(q(10).rule,'This is your box.').decision,'ACCEPT');
 assert.equal(judge(q(10).rule,'I found the box.').decision,'ACCEPT'); // legacy HOLD
 assert.equal(judge(q(10).rule,'This is another box.').decision,'REJECT');
 assert.equal(judge(q(10).rule,'This is').decision,'UNKNOWN');
});
