'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCommunication}=require('./communication.cjs');
const {createRunner}=require('./runner.cjs');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(setImmediate);
const packs=['S005','S006','S007'].map(id=>require('./stories/'+id+'/story.json'));
for(const pack of packs)for(const [id,q]of Object.entries(pack.challenges)){
 test(id+': single view contract, wrong/unknown -> Pico, stop/retry and 1/2/3/3',async()=>{
  for(const decision of ['REJECT','UNKNOWN']){
   const c=createCommunication(q,{recognize:async()=>({status:'final',text:'xyzzy'}),judge:()=>decision});
   assert.equal(c.view().displayMode,'normal');assert.equal(c.view().layoutMode,'twoRow');
   assert.deepEqual(c.view().actions,['talk','support','return']);
   const result=await c.speak();
   assert.equal(result.view.displayMode,'feedback');assert.equal(result.view.layoutMode,'threeRow');
   assert.match(result.view.displayText,/xyzzy と聞こえたよ/);
   for(const stage of [1,2,3,3]){
    const v=c.support();assert.equal(v.supportStage,stage);assert.equal(v.supportText,q.hints[stage-1]);
    assert.equal(v.displayMode,'support');assert.equal(v.layoutMode,'threeRow');
    assert.equal(v.displayText,'ピコ：'+q.hints[stage-1]);assert.equal(v.feedbackJa,null);assert.equal(v.recognizedText,null);
   }
  }
  let pending=deferred(),cancelled=0;
  const c=createCommunication(q,{recognize:()=>pending.promise,cancelSpeech:()=>cancelled++});
  const first=c.speak();assert.equal(c.view().displayMode,'listening');assert.equal(c.view().layoutMode,'twoRow');
  assert.deepEqual(c.view().actions,['stop','support','return']);
  c.stopListening();const hint=c.support();assert.equal(hint.supportStage,1);assert.match(hint.supportText,/[A-Za-z]+/);
  pending.resolve({status:'final',text:q.modelEn});assert.equal((await first).type,'stale');assert.equal(c.view().state,'READY');
  pending=deferred();const second=c.speak();assert.equal(c.view().layoutMode,'threeRow');
  c.stopListening();pending.resolve({status:'cancelled'});assert.equal((await second).type,'stale');assert.equal(cancelled,2);
 });
}
for(const outcome of ['resolve','reject'])test('PICO-04: stale Judge '+outcome+' cannot overwrite the newer LISTENING attempt',async()=>{
 const q=packs[0].challenges[Object.keys(packs[0].challenges)[0]],old=deferred(),current=deferred();let n=0;
 const c=createCommunication(q,{recognize:async()=>({status:'final',text:q.modelEn}),judge:()=>++n===1?old.promise:current.promise});
 const a=c.speak();await tick();c.stopListening();const b=c.speak();await tick();
 if(outcome==='reject')old.reject(Error('old Judge failure'));else old.resolve('ACCEPT');
 assert.equal((await a).type,'stale');assert.equal(c.view().state,'LISTENING');assert.deepEqual(c.view().actions,['stop','support','return']);
 current.resolve('ACCEPT');assert.equal((await b).type,'accepted');assert.equal(c.view().state,'ACCEPTED');
});
test('latest Judge rejection still propagates and permits support/retry',async()=>{
 const q=packs[0].challenges[Object.keys(packs[0].challenges)[0]];
 const c=createCommunication(q,{recognize:async()=>({status:'final',text:q.modelEn}),judge:()=>Promise.reject(Error('current failure'))});
 await assert.rejects(c.speak(),/current failure/);assert.equal(c.view().state,'READY');assert.equal(c.support().supportStage,1);
});
for(const status of ['timeout','unsupported','permission-denied','no-speech'])test(status+' is declarative feedback and clears on Support',async()=>{
 const q=packs[0].challenges[Object.keys(packs[0].challenges)[0]];
 const c=createCommunication(q,{recognize:async()=>({status})});
 const r=await c.speak();assert.equal(r.view.displayMode,'feedback');assert.equal(r.view.layoutMode,'threeRow');assert.equal(r.view.recognizedText,null);
 assert.equal(c.support().displayText,'ピコ：'+q.hints[0]);
});
test('runner resets support on consecutive questions without altering the story cursor contract',async()=>{
 const pack=JSON.parse(JSON.stringify(require('./fixture.json')));
 pack.scenes.intro.steps=[{type:'challenge',id:'hello'},{type:'challenge',id:'hello'},{type:'line',text:'Next story line'}];
 const r=createRunner(pack,{recognize:async()=>({status:'final',text:'hello'})});
 await r.advance();r.support();r.support();assert.equal((await r.talk()).type,'accepted');
 const next=await r.advance();assert.equal(next.type,'challenge');assert.equal(next.view.supportStage,0);assert.equal(next.view.layoutMode,'twoRow');
 await r.talk();assert.equal((await r.advance()).text,'Next story line');
});
