"use strict";
const assert = require("assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const source = fs.readFileSync(path.join(__dirname,"../engine/services/speech-recognition-adapter.js"),"utf8");
const nativeEvents = ["audiostart","audioend","soundstart","soundend","speechstart","speechend"];
function harness(search, options = {}) {
 const instances = [], logs = [];
 class Recognition {
  constructor() { this.listeners = {}; this.stopCalls = 0; instances.push(this); if(options.noEventTarget) this.addEventListener = undefined; }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, detail = {}) { if(this["on"+name]) this["on"+name](detail); for(const fn of this.listeners[name]||[]) fn(detail); }
  start() { this.startCalls = (this.startCalls || 0) + 1; this.emit("start"); }
  stop() { this.stopCalls++; }
 }
 const c = { Promise, Date, URLSearchParams, setTimeout, clearTimeout, SpeechRecognition: Recognition,
  location: { search }, console: { log(...args) { if(options.throwLog) throw Error("diagnostic-log-failed"); logs.push(args); } } };
 c.window = c; vm.createContext(c); vm.runInContext(source,c);
 return { c, instances, logs };
}
async function success(search, options) {
 const h=harness(search,options);const p=h.c.SpeechRecognitionAdapter.listen({lang:"en-US",interimResults:true,continuous:false,maxAlternatives:3});const r=h.instances[0];
 const handlers=[r.onstart,r.onresult,r.onerror,r.onend];
 for(const e of ["audiostart","soundstart","speechstart"])r.emit(e);
 const item=[{transcript:"Three",confidence:0.9}];item.isFinal=true;r.emit("result",{resultIndex:0,results:[item]});
 for(const e of ["speechend","soundend","audioend"])r.emit(e);
 r.emit("end");assert.strictEqual(await p,"Three");
 assert.strictEqual(r.startCalls,1);assert.strictEqual(r.stopCalls,0);assert.strictEqual(r.lang,"en-US");assert.strictEqual(r.maxAlternatives,3);
 assert.deepStrictEqual([r.onstart,r.onresult,r.onerror,r.onend],handlers,"diagnostic listeners never replace existing handlers");return h;
}
(async()=>{
 const on=await success("?micReleaseTrace=1");const r=on.instances[0];assert.deepStrictEqual(Object.keys(r.listeners),nativeEvents);
 const names=Array.from(on.c.MicReleaseTrace.events(),e=>e.type);const expected=["onaudiostart","onsoundstart","onspeechstart","onspeechend","onsoundend","onaudioend"];
 assert.deepStrictEqual(names.filter(x=>expected.includes(x)),expected);assert(names.includes("onstart")&&names.includes("onend"));
 assert.deepStrictEqual(on.logs.filter(x=>x[0]==="[SPEECH TRACE]").map(x=>x[1].event),expected);
 assert(on.logs.filter(x=>x[0]==="[SPEECH TRACE]").every(x=>x[1].instanceId==="rec1"&&typeof x[1].time==="string"));
 const off=await success("");assert.deepStrictEqual(Object.keys(off.instances[0].listeners),[]);assert.strictEqual(off.c.MicReleaseTrace.events().length,0);
 await success("?audioTrace=1");await success("?micReleaseTrace=1",{throwLog:true});await success("?micReleaseTrace=1",{noEventTarget:true});
 const fail=harness("?micReleaseTrace=1");const failure=fail.c.SpeechRecognitionAdapter.listen({}).catch(e=>e.message);fail.instances[0].emit("error",{error:"not-allowed"});fail.instances[0].emit("end");assert.strictEqual(await failure,"not-allowed");assert(Array.from(fail.c.MicReleaseTrace.events(),e=>e.type).includes("onerror"));
 const stalled=harness("?micReleaseTrace=1");let settled=false;const pending=stalled.c.SpeechRecognitionAdapter.listen({}).then(()=>{settled=true;},()=>{settled=true;});stalled.instances[0].emit("audiostart");await Promise.resolve();assert.strictEqual(settled,false);assert.strictEqual(stalled.instances[0].stopCalls,0);stalled.instances[0].emit("end");await pending;
 console.log("speech-native-event-diagnostics.test.js: PASS (6 listeners, trace ON/OFF, existing handlers, success/error/stall, diagnostic exceptions)");
})().catch(e=>{console.error(e);process.exitCode=1;});
