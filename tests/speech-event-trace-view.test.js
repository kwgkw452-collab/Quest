"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const source = fs.readFileSync(path.join(__dirname,"../dev/speech-event-trace-view.js"),"utf8");
function setup(initial = []) {
 class Node {
  constructor(tag) { this.tagName=tag;this.children=[];this.style={};this.textContent="";this.scrollTop=0;this.clientHeight=200;this.attributes={}; }
  appendChild(child) { this.children.push(child);return child; }
  setAttribute(k,v) { this.attributes[k]=v; }
  get scrollHeight() { return this.children.length*24; }
 }
 const panel=new Node("section");let listener;
 const c={Date,URL,console,location:{href:"https://example.com/dev.html?micReleaseTrace=1"},document:{readyState:"complete",getElementById:id=>id==="communicative-question-manager-playtest"?panel:null,createElement:tag=>new Node(tag)},MicReleaseTrace:{enabled:()=>true,events:()=>initial,subscribe:fn=>{listener=fn;}}};c.window=c;
 for(const key of ["SpeechRecognition","SpeechEngine","QuestionManager","AudioManager","localStorage","sessionStorage"])Object.defineProperty(c,key,{get(){throw Error("Viewer must not access "+key);}});
 vm.createContext(c);vm.runInContext(source,c);
 return {panel,section:panel.children[0],list:panel.children[0].children[2],emit:e=>listener(e)};
}
const names=["start","audiostart","soundstart","speechstart","result","speechend","soundend","audioend","error","end"];
const first=setup();assert.strictEqual(first.section.children[0].textContent,"SPEECH EVENT TRACE");assert.strictEqual(first.list.children.length,0);
names.forEach((name,i)=>first.emit({type:"on"+name,at:1000,instanceId:"rec1",error:name==="error"?"no-speech":undefined}));
assert.deepStrictEqual(first.list.children.map(x=>x.textContent.replace(/^.*?  /,"").split("  ")[0]),names,"same-millisecond events retain arrival order");
assert(first.list.children.every(x=>/^\d{2}:\d{2}:\d{2}\.\d{3}  /.test(x.textContent)));
first.emit({type:"instance-created",at:1001});assert.strictEqual(first.list.children.length,10,"unrequested events never appear");
for(let i=0;i<150;i++)first.emit({type:"onresult",at:1002+i,instanceId:"rec1"});assert.strictEqual(first.list.children.length,160,"viewer retains every subscribed event beyond source ring capacity");
first.list.scrollTop=0;first.emit({type:"onend",at:1200});assert.strictEqual(first.list.scrollTop,0,"new events do not pull the user away from older rows");
assert(first.list.style.cssText.includes("overflow:auto"));assert(first.list.style.cssText.includes("touch-action:pan-y"));assert.strictEqual(setup().list.children.length,0,"fresh page starts empty");
(async function () {
 let recognition;
 class Recognition {
  constructor() { recognition=this; }
  addEventListener() {}
  start() { this.onstart(); }
  stop() {}
 }
 const c={Date,URLSearchParams,Promise,SpeechRecognition:Recognition,location:{search:"?micReleaseTrace=1"},console:{log(){}}};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../engine/services/speech-recognition-adapter.js"),"utf8"),c);
 const seen=[];c.MicReleaseTrace.subscribe(()=>{throw Error("display failed")});c.MicReleaseTrace.subscribe(e=>{e.type="changed-copy"});
 const unsubscribe=c.MicReleaseTrace.subscribe(e=>seen.push(e.type));
 const pending=c.SpeechRecognitionAdapter.listen({});
 const interim=[{transcript:"Th"}],final=[{transcript:"Three"}];interim.isFinal=false;final.isFinal=true;
 recognition.onresult({resultIndex:0,results:[interim,final]});
 assert.strictEqual(seen.filter(x=>x==="onresult").length,1,"one native result with multiple result entries is recorded once");
 assert.strictEqual(c.MicReleaseTrace.events().filter(x=>x.type==="onresult").length,1,"subscriber mutations never alter source records");
 unsubscribe();recognition.onend();assert.strictEqual(await pending,"Three");assert(!seen.includes("onend"),"unsubscribe only affects diagnostics");
 console.log("speech-event-trace-view.test.js: PASS (10 types, order/time, full scroll/reload, diagnostic subscription, result once, no runtime/storage access)");
})().catch(e=>{console.error(e);process.exitCode=1;});
