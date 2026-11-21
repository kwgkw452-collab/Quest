"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
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
const spec=JSON.parse(read('tests/s006-q7-final-cases.json'));
const q=c.QuestionDatabase.get('s006.communication.7'),out=[];
(async()=>{
 assert.equal(q.prompt,'その台車（カート）に箱はありますか？');
 assert.equal(q.communicative.expectedUtterance,'Is the box on the cart?');
 assert.deepEqual(Array.from(q.picoSupport),['Is the box ...? で始めるピコ！','台車は cart、上にあるなら on だピコ！','Is the box on the cart? と聞くピコ！']);
 for(const [group,values] of Object.entries(spec)) for(const text of values){
  const expected=group==='reject'?(text?'REJECT':'UNKNOWN'):'ACCEPT';
  const j=await c.CommunicativeJudge.judge({conceptId:q.communicative.conceptId,utterance:text,acceptedVariants:q.answers,alternatives:group==='reject'?[q.answers[0]]:[],difficulty:'starter'});
  assert.equal(j.verdict,expected,text);out.push({group,text,path:'Local Judge',actual:j.verdict});
  if(text){transcript=text;speechError=null;const v=await c.QuestionManager.start(q.id);assert.equal(v.status,expected==='ACCEPT'?'success':'reject',text);out.push({group,text,path:'Question Manager / simulated recognition',actual:v.status});}
 }
 speechError='no-speech';assert.equal((await c.QuestionManager.start(q.id)).status,'speech-failure');
 fs.writeFileSync(process.env.Q7_RESULTS||'/tmp/s006-q7-results.json',JSON.stringify(out,null,2));
 console.log('S006 Q7 Final Correction: PASS ('+out.length+' Judge / Question Manager checks; required12 + additional14 + contrary/unrelated19 + empty).');
})().catch(e=>{console.error(e);process.exitCode=1;});
