"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const cases = JSON.parse(read('tests/s006-communication-final-cases.json'));
const additional = ['Could I help?', 'What colour are those boxes?',
 'Where could we find other box?', 'Could we check those boxes?',
 'Do you have those boxes?', 'Look, please, at these red ribbons.',
 'The boxes is on cart?', 'Would you wait for me?',
 'Would you help us to find our boxes?', 'We have found those boxes now.'];
let transcript, speechError;
const c = { console, setTimeout, clearTimeout, GameConfig: {defaultLanguage:'en-US'},
  AudioManager:{stopAll(){}}, GameCore:{},
  SpeechEngine:{supported:true,getStatus:()=> 'idle',stop(){},async listen(){if(speechError)throw new Error(speechError);return transcript;}},
  SpeechStartController:{prepare:async()=>{},cancel(){},async startListening(){if(speechError)throw new Error(speechError);return transcript;}}
};c.window=c;vm.createContext(c);
function load(f){vm.runInContext(read(f),c,{filename:f});}
['data/word-dictionaries.js','data/questions.js','data/communicative-judge-rules.js',
 'data/lottery-pools.js','engine/services/speech-normalizer.js','engine/services/lottery-engine.js',
 'engine/services/local-communicative-judge.js','engine/services/communicative-judge.js',
 'engine/services/communicative-question-adapter.js','engine/managers/question-manager.js',
 'data/s006-communication.js'].forEach(load);
const results=[];
function record(q,text,expected,actual,mode){results.push({q,text,expected,actual,mode});assert.equal(actual,expected,`Q${q}: ${text} (${mode})`);}
(async()=>{
 assert.equal(c.LocalCommunicativeJudge.validateRules(c.CommunicativeJudgeRuleData).length,0);
 assert.equal(c.QuestionDatabase.all().filter(q=>q.id.startsWith('s006.communication.')).length,10);
 for(const row of cases){
  const q=c.QuestionDatabase.get('s006.communication.'+row.q);
  assert.equal(q.picoSupport.length,3);
  assert(!/[a-z]{2}/i.test(q.prompt.replace('（カート）','')));
  assert(!q.answers.includes(additional[row.q-1]), 'pattern-only example is not a memorized variant');
  for(const text of row.accept.concat(additional[row.q-1])){
   const v=await c.CommunicativeJudge.judge({conceptId:q.communicative.conceptId,utterance:text,difficulty:'starter',acceptedVariants:q.answers});
   record(row.q,text,'ACCEPT',v.verdict,'judge');
   transcript=text;speechError=null;
   const managed=await c.QuestionManager.start(q.id);
   record(row.q,text,'success',managed.status,'real QuestionManager / simulated recognition');
  }
  for(const text of row.reject){
   const v=await c.CommunicativeJudge.judge({conceptId:q.communicative.conceptId,utterance:text,difficulty:'starter',acceptedVariants:q.answers,alternatives:[q.answers[0]]});
   record(row.q,text,text?'REJECT':'UNKNOWN',v.verdict,'negative primary wins over positive alternative');
   if(text){transcript=text;speechError=null;const managed=await c.QuestionManager.start(q.id);record(row.q,text,'reject',managed.status,'real QuestionManager / simulated recognition');}
  }
  // Case / punctuation normalization is exercised through the same runtime path.
  transcript=q.communicative.expectedUtterance.toUpperCase().replace(/[?!]/g,'!!!');speechError=null;
  assert.equal((await c.QuestionManager.start(q.id)).status,'success');
  speechError='no-speech';assert.equal((await c.QuestionManager.start(q.id)).status,'speech-failure');speechError=null;
 }
 // Existing flow controller, actual S006 definitions; only UI/recognition are mocked.
 let plans=[],statuses=[],seen=[],goals=[];
 const realManager=c.QuestionManager;
 c.QuestionManager={cancel(){},async start(id,options){await options.speechStart(async()=>{});return {status:statuses.shift(),answer:''};}};
 c.CommunicativeQuestionPresenter={begin(){return 1;},cancel(){},async speech(start,token,trace,goal){goals.push(goal);await start();},async continued(){return 'next';},
  async recovery(value,options){seen.push({status:value.status,text:options.supportText,fallback:options.text});return plans.shift();}};
 load('engine/controllers/communicative-question-flow-controller.js');
 for(const row of cases){
  const q=c.QuestionDatabase.get('s006.communication.'+row.q);
  plans=['support','support','support','support','retry','continue'];statuses=['speech-failure','speech-failure'];seen=[];goals=[];
  assert.equal((await c.CommunicativeQuestionFlowController.start(q.id)).status,'continued');
  assert.deepEqual(seen.map(x=>x.text),[null,q.picoSupport[0],q.picoSupport[1],q.picoSupport[2],q.picoSupport[2],q.picoSupport[2]]);
  assert(seen.every(x=>!x.fallback));assert(goals.every(x=>x===q.prompt));
  plans=['support','continue'];statuses=['speech-failure'];seen=[];
  assert.equal((await c.CommunicativeQuestionFlowController.start(q.id)).status,'continued');
  assert.deepEqual(seen.map(x=>x.text),[null,q.picoSupport[0]],'reset + no failure-driven stage skip');
 }
 c.QuestionManager=realManager;
 // Non-S006 rules have no optional rejection predicate and retain UNKNOWN fallback.
 assert.equal((await c.CommunicativeJudge.judge({conceptId:'missing',utterance:'unrelated'})).verdict,'UNKNOWN');
 fs.writeFileSync(process.env.S006_RESULTS || '/tmp/s006-communication-final-results.json',JSON.stringify(results,null,2));
 console.log(`S006 Communication Final V1: PASS (${results.length} recorded judge/manager cases; 10 Support/retry/reset flows).`);
})().catch(e=>{console.error(e);process.exitCode=1;});
