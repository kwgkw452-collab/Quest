'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const pack=require('./fixture.json');
const {validate}=require('./schema.cjs');const {createRunner}=require('./runner.cjs');
const {judge}=require('./judge.cjs');const {createCommunication}=require('./communication.cjs');const {createBrowserSpeech}=require('./speech-browser.cjs');const {createVocabularyBattle}=require('./vocabulary-battle.cjs');const {createSaveStore}=require('./save.cjs');
const fresh=()=>JSON.parse(JSON.stringify(pack));
const runToQuestion=async r=>{await r.advance();await r.advance();};
test('package schema valid',()=>assert.deepEqual(validate(fresh()),[]));
test('reject Story-local JS callback',()=>{const p=fresh();p.scenes.intro.steps[0].callback='bad';assert(validate(p).some(e=>e.startsWith('EXECUTABLE')));});
test('reject unknown step',()=>{const p=fresh();p.scenes.intro.steps[0].type='s006Magic';assert(validate(p).some(e=>e.startsWith('STEP')));});
test('reject broken transition',()=>{const p=fresh();p.scenes.intro.steps[4].to='none';assert(validate(p).some(e=>e.startsWith('GOTO')));});
test('reject unknown save key',()=>{const p=fresh();p.scenes.end.steps[0].key='oops';assert(validate(p).some(e=>e.startsWith('SAVE_KEY')));});
test('all required question hints',()=>{const p=fresh();p.challenges.hello.hints.pop();assert(validate(p).some(e=>e.startsWith('CHALLENGE')));});
test('accept exact approved fixture variant',()=>assert.equal(judge({accept:['hello','hi']},'Hi!').decision,'ACCEPT'));
test('unrelated phrase without evidence is UNKNOWN',()=>assert.equal(judge({accept:['hello']},'goodbye').decision,'UNKNOWN'));
test('reject excluded even if accepted',()=>assert.equal(judge({accept:['hello no'],exclude:['no']},'hello no').decision,'REJECT'));
test('recognized mistake shows recognition',async()=>{const c=createCommunication(pack.challenges.hello,{recognize:async()=>({status:'final',text:'Good bye'})});const r=await c.speak();assert.equal(r.type,'unknown');assert.match(r.view.feedbackJa,/Good bye と聞こえたよ/);assert.equal(r.view.layoutMode,'threeRow');});
test('no-speech never fabricates heard text',async()=>{const c=createCommunication(pack.challenges.hello,{recognize:async()=>({status:'no-speech'})});const r=await c.speak();assert.equal(r.type,'no-speech');assert.equal(r.view.recognizedText,null);});
test('support stage 1 2 3 3',()=>{const c=createCommunication(pack.challenges.hello);assert.deepEqual([c.support().supportStage,c.support().supportStage,c.support().supportStage,c.support().supportStage],[1,2,3,3]);});
test('late microphone event ignored after cancel',async()=>{let done;const c=createCommunication(pack.challenges.hello,{recognize:()=>new Promise(r=>done=r)});const p=c.speak();c.cancel();done({status:'final',text:'hello'});assert.equal((await p).type,'stale');});
test('concurrent speech cannot start',async()=>{let done;const c=createCommunication(pack.challenges.hello,{recognize:()=>new Promise(r=>done=r)});const p=c.speak();await assert.rejects(c.speak(),/NOT_READY/);done({status:'final',text:'hello'});await p;});
test('browser SpeechRecognition unsupported returns explicit result',async()=>{const s=createBrowserSpeech({env:{}});assert.equal(s.isSupported(),false);assert.equal((await s.recognize()).status,'unsupported');});
test('browser speech delivers result only after onend',async()=>{let fake;class S{constructor(){fake=this;}start(){}abort(){this.onend?.();}}const s=createBrowserSpeech({env:{SpeechRecognition:S}});const x=s.recognize({attemptId:9});fake.onresult({results:[[{transcript:'sunny'}]],resultIndex:0});fake.onend();assert.deepEqual(await x,{status:'final',text:'sunny',alternatives:['sunny'],attemptId:9});});
test('browser speech cancel prevents late recognition',async()=>{let fake;class S{constructor(){fake=this;}start(){}abort(){this.onend?.();}}const s=createBrowserSpeech({env:{SpeechRecognition:S}});const p=s.recognize({attemptId:1});s.cancel();assert.equal((await p).status,'cancelled');fake.onend?.();});
test('vocabulary accepts target',async()=>{const b=createVocabularyBattle(pack.battles.vocab,{recognize:async()=>({status:'final',text:'sunny'})});assert.equal((await b.speak()).type,'complete');});
test('battle wrong word does not pass',async()=>{const b=createVocabularyBattle(pack.battles.vocab,{recognize:async()=>({status:'final',text:'rainy'})});assert.equal((await b.speak()).type,'rejected');});
test('battle speech failure does not advance',async()=>{const b=createVocabularyBattle(pack.battles.vocab,{recognize:async()=>({status:'error'})});await b.speak();assert.equal(b.view().index,0);});
test('save read/write memory and snapshot isolation',()=>{const save=createSaveStore();const a=save.write({storyId:'S888',flags:{done:true}});a.flags.done=false;assert.equal(save.read().flags.done,true);});
test('save reload through injected storage',()=>{const m=new Map();const s={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};createSaveStore({storage:s}).write({storyId:'S888',flags:{x:true}});assert.equal(createSaveStore({storage:s}).read().flags.x,true);});
test('full synthetic Story → speech → monster → document → Save → end',async()=>{const phrases=['hello','sunny'];let n=0;const written=[];const store={write:async v=>{written.push(v);}};const r=createRunner(fresh(),{recognize:async()=>({status:'final',text:phrases[n++]}),storage:store});assert.equal((await r.advance()).type,'line');assert.equal((await r.advance()).type,'challenge');r.support();assert.equal((await r.talk()).type,'accepted');assert.equal((await r.advance()).type,'battle');assert.equal((await r.talk()).type,'complete');assert.equal((await r.advance()).type,'document');r.documentDone();assert.equal((await r.advance()).type,'line');assert.equal((await r.advance()).type,'end');assert.equal(written.length,1);assert.equal(r.snapshot().flags.found,true);});
test('save error does not modify state or skip step',async()=>{const p=fresh();const r=createRunner(p,{recognize:async()=>({status:'final',text:'hello'}),storage:{write:async()=>{throw Error('FULL');}}});await r.advance();await r.advance();await r.talk();const b=createVocabularyBattle(p.battles.vocab,{recognize:async()=>({status:'final',text:'sunny'})});await r.advance();r.returnToAdventure();assert.equal(b.view().status,'READY');});
test('save failure after proceeding through feature does not persist flag',async()=>{const answers=['hello','sunny'];let i=0;const r=createRunner(fresh(),{recognize:async()=>({status:'final',text:answers[i++]}),storage:{write:async()=>{throw Error('NO_STORAGE');}}});await r.advance();await r.advance();await r.talk();await r.advance();await r.talk();await r.advance();r.documentDone();await assert.rejects(r.advance(),/NO_STORAGE/);assert.equal(r.snapshot().flags.found,undefined);assert.equal(r.snapshot().scene,'end');assert.equal(r.snapshot().index,0);});
test('resume snapshot READY only',async()=>{const p=fresh();const r=createRunner(p,{initialSnapshot:{schemaVersion:1,storyId:'S888',scene:'end',index:1,status:'READY',flags:{found:true}}});assert.equal((await r.advance()).type,'line');});
test('reject unsafe resume during question',()=>assert.throws(()=>createRunner(fresh(),{initialSnapshot:{schemaVersion:1,storyId:'S888',scene:'intro',index:1,status:'QUESTION'}}),/UNSAFE_RESUME/));
test('100 Story IDs use same runtime',async()=>{for(let i=1;i<=100;i++){const p=fresh();p.id='S'+String(i).padStart(3,'0');assert.equal((await createRunner(p).advance()).type,'line');}});
test('return makes pending Speech stale',async()=>{let finish;const r=createRunner(fresh(),{recognize:()=>new Promise(y=>finish=y)});await runToQuestion(r);const pending=r.talk();r.returnToAdventure();finish({status:'final',text:'hello'});assert.equal((await pending).type,'stale');});

test('multi-word Battle accepts one word without skipping whole Battle',async()=>{const p=fresh();p.battles.vocab.words.push({prompt:'曇り',answers:['cloudy']});let i=0;const answers=['hello','sunny','cloudy'];const r=createRunner(p,{recognize:async()=>({status:'final',text:answers[i++]})});await r.advance();await r.advance();await r.talk();assert.equal((await r.advance()).type,'battle');const first=await r.talk();assert.equal(first.type,'accepted');assert.equal(r.state().status,'BATTLE');assert.equal(r.state().battle.index,1);assert.equal((await r.talk()).type,'complete');assert.equal(r.state().status,'READY');assert.equal((await r.advance()).type,'document');});
test('Battle wrong recognition stays in Battle',async()=>{const answers=['hello','rainy','sunny'];let i=0;const r=createRunner(fresh(),{recognize:async()=>({status:'final',text:answers[i++]})});await r.advance();await r.advance();await r.talk();await r.advance();const wrong=await r.talk();assert.equal(wrong.type,'rejected');assert.equal(r.state().status,'BATTLE');assert.equal((await r.talk()).type,'complete');});
test('concurrent advance while save pending is rejected',async()=>{let release;const p=fresh();let n=0;const r=createRunner(p,{recognize:async()=>({status:'final',text:['hello','sunny'][n++]}),storage:{write:()=>new Promise(done=>{release=done;})}});await r.advance();await r.advance();await r.talk();await r.advance();await r.talk();await r.advance();r.documentDone();const writing=r.advance();await Promise.resolve();await assert.rejects(r.advance(),/ADVANCE_ALREADY_RUNNING/);assert.equal(r.returnToAdventure().reason,'save-in-progress');release();assert.equal((await writing).type,'line');assert.equal(r.snapshot().flags.found,true);});
test('save error releases advance lock for a retry',async()=>{let fail=true,n=0;const r=createRunner(fresh(),{recognize:async()=>({status:'final',text:['hello','sunny'][n++]}),storage:{write:()=>{if(fail)throw Error('disk full');}}});await r.advance();await r.advance();await r.talk();await r.advance();await r.talk();await r.advance();r.documentDone();await assert.rejects(r.advance(),/disk full/);fail=false;assert.equal((await r.advance()).type,'line');});
test('restoring unknown and mistyped flags is refused',()=>{for(const flags of [{unknown:true},{found:'yes'},null]){assert.throws(()=>createRunner(fresh(),{initialSnapshot:{schemaVersion:1,storyId:'S888',scene:'end',index:1,status:'READY',flags}}),/INVALID_SAVE_FLAGS/);}});

test('reject undeclared Story-specific step properties',()=>{const p=fresh();p.scenes.intro.steps[0].specialSceneOverride='local';assert(validate(p).some(e=>e.startsWith('UNSUPPORTED_STEP_FIELD')));});
test('reject unregistered Judge operator in Story data',()=>{const p=fresh();p.challenges.hello.rule.storyOnlyCondition={};assert(validate(p).some(e=>e.startsWith('UNSUPPORTED_RULE_OPERATOR')));});
test('reject malformed generic ordered-group rule',()=>{const p=fresh();p.challenges.hello.rule.orderedGroups=[['say'],[]];assert(validate(p).some(e=>e.startsWith('RULE_GROUP_LIST')));});

test('SpeechRecognition times out when a browser never emits onend',async()=>{
 let fake;
 class Hangs{constructor(){fake=this;}start(){}abort(){this.aborted=true;}}
 const speech=createBrowserSpeech({env:{SpeechRecognition:Hangs},timeoutMs:15});
 const result=await speech.recognize({attemptId:44});
 assert.deepEqual(result,{status:'timeout',attemptId:44});
 assert.equal(fake.aborted,true);
});
test('timed-out SpeechRecognition cannot deliver a late accepted phrase',async()=>{
 let fake;
 class Hangs{constructor(){fake=this;}start(){}abort(){this.aborted=true;}}
 const speech=createBrowserSpeech({env:{SpeechRecognition:Hangs},timeoutMs:15});
 const c=createCommunication(pack.challenges.hello,{recognize:speech.recognize,cancelSpeech:speech.cancel});
 const result=await c.speak();
 assert.equal(result.type,'no-speech');
 assert.equal(result.view.recognizedText,null);
 assert.match(result.view.feedbackJa,/時間/);
 assert.equal(c.view().state,'READY');
 assert.equal(fake.onresult,null);
});
test('unsupported microphone explicitly explains no SpeechRecognition and preserves retry',async()=>{
 const speech=createBrowserSpeech({env:{}});
 const c=createCommunication(pack.challenges.hello,{recognize:speech.recognize});
 const result=await c.speak();
 assert.equal(result.type,'no-speech');
 assert.match(result.view.feedbackJa,/対応していません/);
 assert.equal(c.view().state,'READY');
});
test('Pico support is capped at stage 3 and each new question starts at stage 0',()=>{
 const a=createCommunication(pack.challenges.hello);
 a.support();a.support();a.support();a.support();
 assert.equal(a.view().supportStage,3);
 assert.equal(a.view().layoutMode,'twoRow');
 const b=createCommunication(pack.challenges.hello);
 assert.equal(b.view().supportStage,0);
 assert.equal(b.view().layoutMode,'twoRow');
});

test('exact contrary-goal rejection does not accidentally reject longer unrelated sentences',()=>{
 const rule={accept:['no','no you may go'],excludeExact:['no']};
 assert.equal(judge(rule,'No!').decision,'REJECT');
 assert.equal(judge(rule,'No, you may go.').decision,'ACCEPT');
});
test('schema rejects a malformed exact-rejection rule',()=>{
 const p=fresh();
 p.challenges.hello.rule.excludeExact='not a list';
 assert(validate(p).some(x=>x.startsWith('RULE_STRING_LIST')));
});
