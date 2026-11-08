'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function harness(){
 const elements={},events={},calls=[],controls=[];let mutation;
 function element(){return {children:[],isConnected:false,setAttribute(k,v){this[k]=v;},appendChild(e){this.children.push(e);e.isConnected=true;e.parent=this;if(e.id)elements[e.id]=e;return e;},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}};}
 elements['item-layer']=element();elements['item-layer'].isConnected=true;
 const c={console,setTimeout,clearTimeout,AudioDatabase:{voice:{}},document:{createElement:element,getElementById:id=>elements[id]||null}};
 c.window=c;c.addEventListener=(n,f)=>(events[n]||=([])).push(f);c.removeEventListener=(n,f)=>events[n]=events[n].filter(g=>g!==f);
 c.MutationObserver=class {constructor(f){mutation=f;}observe(){}disconnect(){mutation=null;}};
 c.DialogManager={show(s,t){c.current=t;controls.length=0;},setContent(s,t){c.current=t;},clearControls(){controls.length=0;},addControl(label,click){const e={label,click,setAttribute(k,v){this[k]=v;}};controls.push(e);return e;},next(label){return new Promise(resolve=>this.addControl(label||'次へ',resolve));},choice(items){return new Promise(resolve=>items.forEach(item=>this.addControl(item.label,()=>resolve(item.value))));}};
 let voice;
 c.DialogueVoiceAudioInternal={play(key){let resolve;const completion=new Promise(r=>resolve=r);voice={key,completion,resolve};calls.push(voice);return voice;},stop(){if(voice){voice.resolve({status:'stopped'});voice=null;}}};
 c.StoryRegistry={register(s){c.story=s;}};
 c.GameConfig={dialogueNextLabel:'次へ'};c.GameCore={clearVisuals(){}};c.EffectManager={setBackground(src){c.backgrounds.push(src);}};c.backgrounds=[];
 c.QuestionManager={async start(id){c.questions.push(id);return {status:'success'};}};c.questions=[];c.CommunicativeQuestionFlowController={start:c.QuestionManager.start};
 c.SpeechEngine={stop(){}};c.SaveManager={};
 vm.createContext(c);
 ['engine/commands/story-commands.js','engine/core/story-events.js','engine/core/story-engine.js','data/s006-ending.js','engine/controllers/s006-ending-controller.js','engine/stories/S006.js'].forEach(f=>vm.runInContext(read(f),c,{filename:f}));
 return {c,calls,controls,elements,events,click(label){const b=controls.find(v=>v.label===label);assert(b,'button '+label);b.click();},detach(){elements['s006-ending-letter'].remove();mutation();}};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const h=harness(),{c}=h;const owner={};let p=c.S006Ending.run(owner);
 assert.equal(c.S006Ending.getStatus().language,'english');assert.equal(h.calls.length,1);
 h.click('ピコのサポート');assert.equal(c.current,'おじいちゃんへ');assert.equal(h.calls.length,1);
 h.calls[0].resolve({status:'ended'});await tick();assert.equal(c.current,'これは、おじいちゃんのオルゴールだよ。');
 assert.equal(h.controls.length,3);h.click('英語を見る');assert.equal(c.current,'This is your music box.');assert.equal(h.calls.length,2);
 h.click('日本語を見る');h.click('次の文へ');await tick();assert.equal(c.current,'壊れていたんだ。');assert.equal(c.S006Ending.getStatus().index,2);
 // The stopped completion from a skipped line must not cancel/advance a new line.
 await tick();assert.equal(c.S006Ending.getStatus().index,2);
 for(let i=2;i<16;i++){h.calls.at(-1).resolve({status:'ended'});await tick();}
 assert.equal((await p).storyControl,'continue');assert.equal(h.calls.length,16);assert(!c.S006Ending.getStatus().active);assert.equal(h.events.pagehide.length,0);assert(!h.elements['s006-ending-letter'].isConnected);
 p=c.S006Ending.run({});assert.equal(c.S006Ending.getStatus().language,'english');h.calls.at(-1).resolve({status:'failed'});await tick();assert.equal(c.S006Ending.getStatus().index,0);h.click('次の文へ');await tick();assert.equal(c.S006Ending.getStatus().index,1);
 h.events.pagehide[0]();assert.equal((await p).storyControl,'cancelled');assert(!c.S006Ending.getStatus().active);
 p=c.S006Ending.run({});h.detach();assert.equal((await p).storyControl,'cancelled');assert(!c.S006Ending.getStatus().active);
 const oldOwner={};p=c.S006Ending.run(oldOwner);await c.StoryEvents.emit('story:enter',{story:{id:'S007'},state:{}});assert.equal((await p).storyControl,'cancelled');
 const newOwner={};p=c.S006Ending.run(newOwner);c.S006Ending.cancel(oldOwner);assert(c.S006Ending.getStatus().active);c.S006Ending.cancel(newOwner);await p;
 // Real StoryEngine runs every S006 step; dialogue clicks and speech results are simulated.
 let finished=false;const storyPlay=c.StoryEngine.play(c.story,{}).then(()=>finished=true);let safety=0;
 while(!finished && safety++<300){await tick();if(c.S006Ending.getStatus().active)h.click('次の文へ');else if(h.controls.length)h.controls[0].click();}
 await storyPlay;assert(finished);assert.equal(c.questions.length,10);assert.deepEqual(c.questions,Array.from({length:10},(_,i)=>'s006.communication.'+(i+1)));
 assert.deepEqual(c.backgrounds,Array.from({length:13},(_,i)=>'images/006/S006-Scene-'+String(i+1).padStart(2,'0')+'.png?v=s006-v22'));
 assert.equal(c.current,'Thank you.');assert(!c.S006Ending.getStatus().active);
 const xs=c.S006EndingData.lines.map(x=>x.english);assert.equal(xs.length,16);assert.equal(xs[0],'Dear Grandpa,');assert.equal(xs[15],'Your grandson');
 // Cancellation is consumed at the command boundary, not followed by old-story dialogue.
 const k=harness();const run=k.c.StoryEngine.play({id:'S006',steps:[{type:'s006EndingLetter'},{type:'dialogue',speaker:'BAD',text:'stale continuation'}]},{});
 await tick();k.c.S006Ending.cancel();await run;assert.notEqual(k.c.current,'stale continuation');
 console.log('S006 Ending V1 PASS: natural completion, exact16 lines, language persistence, no duplicate/skip race, failure continuation, pagehide/Dev clear/new story/restart cleanup, full13 scenes/10 questions, cancellation boundary.');
})().catch(e=>{console.error(e);process.exitCode=1;});
