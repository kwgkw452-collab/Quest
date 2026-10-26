"use strict";
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
function setup(direct = false) {
  class Node {
    constructor(tag) { this.tagName=tag;this.children=[];this.style={};this.textContent="";this.scrollTop=0;this.clientHeight=200;this.attributes={}; }
    appendChild(child) { this.children.push(child);return child; }
    insertBefore(child,before) { const i=this.children.indexOf(before);assert(i>=0);this.children.splice(i,0,child);return child; }
    setAttribute(k,v) { this.attributes[k]=v; }
    get scrollHeight() { return this.children.length*24; }
  }
  let time=10, micListener, poll;
  const epoch=1800000000000, panel=new Node("section"), body=new Node("body");
  const c={Date,Promise,URL,URLSearchParams,performance:{timeOrigin:epoch,now:()=>time},console:{log(){}},location:{search:direct?"?jump=S005&micReleaseTrace=1&formalTrace=1":"?micReleaseTrace=1",href:"https://example.com/dev.html"},
    document:{readyState:"complete",body,getElementById:id=>!direct&&id==="communicative-question-manager-playtest"?panel:null,createElement:tag=>new Node(tag)},
    setInterval(fn,delay){assert.equal(delay,150);poll=fn;},
    MicReleaseTrace:{enabled:()=>true,events:()=>[],subscribe:fn=>{micListener=fn;}}};c.window=c;
  for(const key of ["SpeechRecognition","SpeechEngine","QuestionManager","AudioManager","localStorage","sessionStorage"])Object.defineProperty(c,key,{get(){throw Error("Viewer must not access "+key);}});
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root,"dev/formal-speech-trace.js"),"utf8"),c);
  const originalRecord=c.FormalSpeechTrace.record;
  const context={source:"formal-story",runId:1,questionManagerRunId:3,presenterToken:4,attemptCount:1,speechRetries:0};
  c.FormalSpeechTrace.record("task-selected",{...context,questionId:"s005.communication.2",conceptId:"hotel.party.three"});
  vm.runInContext(fs.readFileSync(path.join(root,"dev/speech-event-trace-view.js"),"utf8"),c);
  const section=direct?body.children[0].children[1]:panel.children[0],list=section.children[2];
  return {c,epoch,context,list,body,poll:()=>poll(),at:t=>{time=t},mic:entry=>micListener(entry),originalRecord};
}
const h=setup(true);assert.equal(h.body.children[0].tagName,"details");assert(!h.body.children[0].open,"diagnostic drawer starts collapsed");
h.mic({type:"judge-input",at:h.epoch+10,transcript:"Hi",hasTranscript:true});
h.at(11);h.c.FormalSpeechTrace.record("judge-result",{...h.context,status:"unknown",transcript:"Hi",verdict:"UNKNOWN",judgeReason:"no-provider",judgeSource:"fallback",candidateCount:0});
h.at(12);h.c.FormalSpeechTrace.record("recovery-show",{...h.context,status:"unknown",transcript:"Hi",candidateCount:0});
const before=h.c.FormalSpeechTrace.getEntries().map(e=>JSON.stringify(e));
h.poll();assert.equal(h.list.children.length,3);
const text=n=>n.textContent+n.children.map(text).join("\n");
assert.deepEqual(h.list.children.map(n=>n.textContent.replace(/^.*?  /,"").split("  ")[0]),["JUDGE INPUT:","JUDGE RESULT","RECOVERY SHOW"]);
for(const value of ['questionId="s005.communication.2"','status="unknown"','transcript="Hi"','judge.verdict="UNKNOWN"','judge.reason="no-provider"','judge.source="fallback"','flowRunId=1','questionManagerRunId=3','presenterToken=4','attemptCount=1','speechRetries=0'])assert(text(h.list.children[1]).includes(value),value);
assert(text(h.list.children[2]).includes("candidateCount=0"));assert(!text(h.list.children[2]).includes("supportText"),"no inferred/unrecorded values");
h.poll();assert.equal(h.list.children.length,3,"polling cannot duplicate records");
assert.equal(h.c.FormalSpeechTrace.record,h.originalRecord,"record() is never wrapped or replaced");
assert.deepEqual(h.c.FormalSpeechTrace.getEntries().map(e=>JSON.stringify(e)),before,"no events added or records mutated");
// Read before the next Mic event, keeping mixed diagnostic streams in time order.
h.at(13);h.c.FormalSpeechTrace.record("flow-end",{...h.context,status:"continued",resolution:"continue"});
h.mic({type:"onend",at:h.epoch+14});assert(h.list.children[3].textContent.includes("FLOW END"));assert(text(h.list.children[3]).includes('resolution="continue"'));assert(h.list.children[4].textContent.includes("end"));
// Out-of-order delivery uses event time, not the later polling time.
h.mic({type:"onresult",at:h.epoch+10.5});assert(h.list.children[1].textContent.includes("result"));
// Source clear/repopulation is observed without inventing a flow-end.
h.c.FormalSpeechTrace.clear();h.at(20);h.c.FormalSpeechTrace.record("task-selected",{...h.context,runId:2,questionId:"s005.communication.3"});h.c.FormalSpeechTrace.record("recovery-show",{...h.context,runId:2,status:"unknown",transcript:"<unsafe>",candidateCount:0});h.poll();assert(text(h.list.children.at(-1)).includes('questionId="s005.communication.3"'));assert(text(h.list.children.at(-1)).includes('transcript="<unsafe>"'));
assert.equal(h.list.children.at(-1).children[0].children.length,0,"text-only rendering");
assert.equal(setup(true).list.children.length,0,"fresh page has no persisted records");assert.equal(setup(false).body.children.length,0,"normal Pilot uses its original panel");
console.log("formal-speech-trace-view.test.js: PASS (existing records only, no record wrapping/mutation, Ch2 identity/fields, mixed clock order, duplicate/clear handling, direct drawer, text safety/reload)");
