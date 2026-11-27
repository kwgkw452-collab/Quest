'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createLegacySpeechBridge}=require('./legacy-audio-bridge.js');
function setup(){
 const calls=[];let resolveResult;
 const recognizer={recognize:()=>{calls.push('recognize');return new Promise(r=>resolveResult=r);},cancel:()=>calls.push('cancel'),isSupported:()=>true};
 const manager={enterSpeechMode:async()=>{calls.push('enter');},exitSpeechMode:async()=>{calls.push('exit');}};
 return {calls,bridge:createLegacySpeechBridge({recognizer,audioManager:manager}),finish:v=>resolveResult(v)};
}
test('enter before microphone and restore after result',async()=>{
 const x=setup(),p=x.bridge.recognize({attemptId:1});
 await new Promise(setImmediate);
 assert.deepEqual(x.calls,['enter','recognize']);
 x.finish({status:'final',text:'hello'});
 assert.deepEqual(await p,{status:'final',text:'hello'});
 assert.deepEqual(x.calls,['enter','recognize','exit']);
});
test('cancel during recognition discards stale result but still restores',async()=>{
 const x=setup(),p=x.bridge.recognize({attemptId:9});
 await new Promise(setImmediate);x.bridge.cancel();
 x.finish({status:'final',text:'stale'});
 assert.deepEqual(await p,{status:'cancelled',attemptId:9});
 assert.deepEqual(x.calls,['enter','recognize','cancel','exit']);
});
test('cancel before queued entry prevents microphone activation',async()=>{
 const x=setup(),p=x.bridge.recognize({attemptId:2});x.bridge.cancel();
 assert.deepEqual(await p,{status:'cancelled',attemptId:2});
 assert.deepEqual(x.calls,['cancel']);
});
test('recognition exception still exits speech mode',async()=>{
 const calls=[],bridge=createLegacySpeechBridge({recognizer:{recognize:()=>{throw Error('microphone');},cancel:()=>{}},audioManager:{enterSpeechMode:async()=>calls.push('enter'),exitSpeechMode:async()=>calls.push('exit')}});
 await assert.rejects(bridge.recognize(),/microphone/);assert.deepEqual(calls,['enter','exit']);
});
test('missing legacy contract is explicit HOLD',()=>{
 assert.throws(()=>createLegacySpeechBridge({recognizer:{recognize(){},cancel(){}}}),/AUDIO_CONTRACT_REQUIRED/);
});

test('failed microphone cancellation cannot skip speech-mode restoration',async()=>{
 const calls=[];let resolveRecognition;
 const recognizer={
  recognize:()=>new Promise(resolve=>{calls.push('recognize');resolveRecognition=resolve;}),
  cancel:()=>{calls.push('cancel');throw Error('abort failed');}
 };
 const manager={enterSpeechMode:async()=>calls.push('enter'),exitSpeechMode:async()=>calls.push('exit')};
 const bridge=createLegacySpeechBridge({recognizer,audioManager:manager});
 const pending=bridge.recognize({attemptId:17});
 await new Promise(setImmediate);
 bridge.cancel();
 resolveRecognition({status:'final',text:'stale'});
 assert.deepEqual(await pending,{status:'cancelled',attemptId:17});
 assert.deepEqual(calls,['enter','recognize','cancel','exit']);
});
test('stop waits for audio exit and rejects stale recognition after Story switch',async()=>{
 const calls=[];let resolveRecognition,resolveExit;
 const recognizer={
  recognize:()=>new Promise(resolve=>{calls.push('recognize');resolveRecognition=resolve;}),
  cancel:()=>calls.push('cancel')
 };
 const manager={
  enterSpeechMode:async()=>calls.push('enter'),
  exitSpeechMode:()=>new Promise(resolve=>{calls.push('exit-start');resolveExit=()=>{calls.push('exit-end');resolve();};})
 };
 const bridge=createLegacySpeechBridge({recognizer,audioManager:manager});
 const pending=bridge.recognize({attemptId:21});
 await new Promise(setImmediate);
 let stopped=false;
 const stopping=bridge.stop().then(()=>{stopped=true;});
 resolveRecognition({status:'final',text:'old Story'});
 await new Promise(setImmediate);
 assert.equal(stopped,false);
 assert.deepEqual(calls,['enter','recognize','cancel','exit-start']);
 resolveExit();
 assert.deepEqual(await pending,{status:'cancelled',attemptId:21});
 await stopping;
 assert.equal(stopped,true);
 assert.deepEqual(calls,['enter','recognize','cancel','exit-start','exit-end']);
});
test('cancel failure before queued entry does not start microphone or duck audio',async()=>{
 const calls=[];
 const bridge=createLegacySpeechBridge({
  recognizer:{recognize:()=>{calls.push('recognize');},cancel:()=>{calls.push('cancel');throw Error('abort failed');}},
  audioManager:{enterSpeechMode:async()=>calls.push('enter'),exitSpeechMode:async()=>calls.push('exit')}
 });
 const pending=bridge.recognize({attemptId:22});
 bridge.cancel();
 assert.deepEqual(await pending,{status:'cancelled',attemptId:22});
 assert.deepEqual(calls,['cancel']);
});
