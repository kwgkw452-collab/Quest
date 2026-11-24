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
 return {questions:JSON.parse(JSON.stringify(questions)),metadata:JSON.parse(JSON.stringify(context.S007DraftCommunicationMetadata)),legacyRules:context.CommunicativeJudgeRuleData};
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
test('legacy open-ended question 2 and 4 rules now have typed declarative counterparts; QA parity remains HOLD',()=>{
 const {metadata}=legacyQuestions();
 assert.equal(metadata.status,'DRAFT_NOT_APPROVED');
 const probe2='Do you take beautiful pictures?';
 const probe4='Look at the colorful birds!';
 assert.equal(judge(pack.challenges['s007.communication.2'].rule,probe2).decision,'ACCEPT');
 assert.equal(judge(pack.challenges['s007.communication.4'].rule,probe4).decision,'ACCEPT');
 assert.equal(judge(pack.challenges['s007.communication.2'].rule,'Do not take pictures of birds.').decision,'REJECT');
 assert.equal(judge(pack.challenges['s007.communication.4'].rule,"Don't look at the birds.").decision,'REJECT');
});
test('all 146 enumerated S007 variants are accepted by the new declarative judge',()=>{
 const {questions}=legacyQuestions();
 for(const q of questions)for(const answer of q.answers){
  assert.equal(judge(pack.challenges[q.id].rule,answer).decision,'ACCEPT',q.id+' '+answer);
 }
});

test('typed generic rules agree with source predicates on representative open-ended and negative utterances',()=>{
 const {legacyRules}=legacyQuestions();
 const cases={
  2:['Do you take beautiful pictures?','take pictures for you','you took photos','Did you take some bird photos?','You never take pictures','Do not take photos','Do you take','pictures for you'],
  4:['Look at the colorful birds!','Birds! Look at them!','Look at bird','Look at the baby birds','Do not look at the bird','Never look at the birds','Please look down','The birds are beautiful']
 };
 for(const [number,phrases] of Object.entries(cases)){
  const index=Number(number)-1,q=pack.challenges['s007.communication.'+number];
  for(const utterance of phrases)assert.equal(judge(q.rule,utterance).decision==='ACCEPT',legacyRules[index].accept(utterance),number+': '+utterance);
 }
});

test('S007 cross-question judge parity against Production for every official model answer (100 pairs)',()=>{
 const {questions,legacyRules}=legacyQuestions();
 let checks=0,shared=[];
 for(let i=0;i<10;i++)for(let j=0;j<10;j++){
  const phrase=questions[j].communicative.expectedUtterance;
  const actual=judge(pack.challenges[questions[i].id].rule,phrase).decision==='ACCEPT';
  const expected=Boolean(legacyRules[i].accept(phrase));
  assert.equal(actual,expected,questions[i].id+' incorrectly classified '+phrase+' from Q'+(j+1));
  if(i!==j && expected)shared.push([i+1,j+1,phrase]);
  checks++;
 }
 assert.equal(checks,100);
 // A deliberate shared phrase is not necessarily a false positive: it is present in the old registered corpus.
 assert(Array.isArray(shared));
});
test('S007 every official alternate accepted expression matches legacy intent, not just its own question',()=>{
 const {questions,legacyRules}=legacyQuestions();let checks=0;
 for(let i=0;i<10;i++)for(let j=0;j<10;j++)for(const phrase of questions[j].answers){
  const expected=Boolean(legacyRules[i].accept(phrase));
  const actual=judge(pack.challenges[questions[i].id].rule,phrase).decision==='ACCEPT';
  assert.equal(actual,expected,'Q'+(i+1)+' vs Q'+(j+1)+' variant '+phrase);
  checks++;
 }
 assert.equal(checks,1460);
});
test('S007 open-ended photo and bird predicates match legacy for 60 positive/negative probes',()=>{
 const {legacyRules}=legacyQuestions();
 const cases={
  2:[
   'Do you take many pictures?','Can you take beautiful pictures?','You took lots of photos.',
   'Would you take photos?','How do you take pictures?','Take a photo for you?',
   'Do you take pictures of birds?','Are you taking pictures?','You will take photos later.',
   'Do you never take pictures?','You do not take pictures.','Dont you take photos?',
   'Never do you take photographs?','You did not take pictures.','Do not take pictures!',
   'He takes pictures of birds.','Does Meg take beautiful pictures?','Do you watch birds?',
   'Do you take photos and pictures?','Did you take pictures yesterday?',
   'I think you took lovely photos.','Where did you take pictures?',
   'Take pictures of the bird please','You took pictures but not of birds.',
   'You never take photos of birds.','Do you enjoy taking photos?','Can you take photo?',
   'You take photographs?','You take a picture.','Do you take a video?'
  ],
  4:[
   'Look at the beautiful baby birds.','Look at this bird.','Look at those birds.',
   'Please look at the colorful birds!','Can you look at a bird?','Look at bird',
   'Look at the bird and fly.','Look at the baby bird!','Look at bird feathers.',
   'Look at the tree.','Please look for a bird.','Look for the birds.',
   'Do not look at the birds!','Dont look at the bird.','Never look at a bird.',
   "Don't look at the bird!",'Look at the bird but never touch it.',
   'Look at the nest, not birds.','We are looking at birds.','I look at birds.',
   'Birds look at me.','A baby bird is here!','The birds are beautiful.',
   'Look at the butterfly.','I looked at the bird.','Please look at the birds.',
   'Look at the baby birds from here.','Look at birds and nests.',
   'I will not look at the birds.','Look at a blue bird.'
  ]
 };
 let count=0;
 for(const [num,utterances] of Object.entries(cases)){
  const id='s007.communication.'+num,fn=legacyRules[Number(num)-1].accept;
  for(const phrase of utterances){
   assert.equal(judge(pack.challenges[id].rule,phrase).decision==='ACCEPT',Boolean(fn(phrase)),id+': '+phrase);
   count++;
  }
 }
 assert.equal(count,60);
});
