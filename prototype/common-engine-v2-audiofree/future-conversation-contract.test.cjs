'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pack=require('./fixture.json');
const {validate}=require('./schema.cjs');
const {createRunner}=require('./runner.cjs');
const copy=()=>JSON.parse(JSON.stringify(pack));
const withHook=()=>{const p=copy();const line=p.scenes[p.entry].steps.find(s=>s.type==='line');line.futureConversation={mode:'reserved',challengeId:Object.keys(p.challenges)[0]};return p;};
test('reserved dialogue conversation schema validates with a known Communication challenge',()=>{
 assert.deepEqual(validate(withHook()),[]);
});
test('reserved hook rejects unknown challenge, active mode and arbitrary code fields',()=>{
 for(const value of [{mode:'reserved',challengeId:'missing'},{mode:'active',challengeId:'hello'},{mode:'reserved',challengeId:'hello',callback:'eval'}]){
  const p=withHook();p.scenes[p.entry].steps.find(s=>s.type==='line').futureConversation=value;
  assert(validate(p).some(e=>e.startsWith('FUTURE_CONVERSATION')||e.startsWith('EXECUTABLE')));
 }
});
test('reserved hook emits metadata but does not listen, change button flow or enter a challenge',async()=>{
 const p=withHook();let calls=0;
 const r=createRunner(p,{recognize:async()=>{calls++;return {status:'final',text:'hello'};}});
 const first=await r.advance();
 assert.equal(first.type,'line');
 assert.deepEqual(first.conversationHook,{mode:'reserved',challengeId:Object.keys(p.challenges)[0]});
 assert.equal(r.state().status,'READY');
 assert.equal(calls,0);
 assert.equal(r.snapshot().index,1);
});
test('existing Story line without hook has no speech requirement or behaviour change',async()=>{
 const p=copy();const r=createRunner(p,{recognize:()=>{throw Error('microphone must not run')}});
 const first=await r.advance();
 assert.equal(first.type,'line');
 assert.equal(first.conversationHook,null);
 assert.equal(r.state().status,'READY');
});
