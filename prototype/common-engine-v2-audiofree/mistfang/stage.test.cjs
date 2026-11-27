'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {WORDS,MILESTONES,GRAPHICS,stageForCorrect,pack}=require('./stage.cjs');
const {validate}=require('../schema.cjs');
const {createRunner}=require('../runner.cjs');
test('Mistfang is 10 English vocabulary items and 4 graphics milestones',()=>{
 assert.deepEqual(WORDS,['snow','snowy','mist','misty','storm','stormy','thunder','lightning','fine','frosty']);
 assert.deepEqual(MILESTONES,[0,3,6,10]);assert.equal(GRAPHICS.length,4);
 assert.deepEqual(Array.from({length:11},(_,i)=>stageForCorrect(i)),[0,0,0,1,1,1,2,2,2,2,3]);
 assert.throws(()=>stageForCorrect(-1));assert.throws(()=>stageForCorrect(11));
});
test('existing V2 vocabulary engine advances all 10 prompts, ends and rejects wrong word',async()=>{
 const p=pack();assert.deepEqual(validate(p),[]);
 let wordIndex=0;let wrong=true;
 const recognize=async()=>({status:'final',text:wrong?'banana':WORDS[wordIndex++]});
 const runner=createRunner(p,{recognize,cancelSpeech(){}});
 let e=await runner.advance();assert.equal(e.type,'battle');
 e=await runner.talk();assert.equal(e.type,'rejected');assert.equal(runner.state().battle.index,0);wrong=false;
 for(let i=0;i<10;i++){
  e=await runner.talk();assert.equal(e.type,i===9?'complete':'accepted');assert.equal(e.view.index,i+1);
 }
 assert.equal(runner.state().status,'READY');
 e=await runner.advance();assert.equal(e.type,'line');
 e=await runner.advance();assert.equal(e.type,'end');
});
