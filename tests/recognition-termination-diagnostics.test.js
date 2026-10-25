"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
const source=fs.readFileSync(path.join(__dirname,"../engine/services/speech-recognition-adapter.js"),"utf8");
function harness(search="?micReleaseTrace=1",noStack=false){
 let now=1000;const timers=[],instances=[];
 class Clock extends Date {constructor(value){super(value===undefined?now:value)}static now(){return now}}
 class Recognition {
  constructor(){this.listeners={};this.stopCalls=0;instances.push(this)}
  addEventListener(name,fn){(this.listeners[name]||=[]).push(fn)}
  emit(name,extra={}){if(this["on"+name])this["on"+name](extra);for(const fn of this.listeners[name]||[])fn(extra)}
  start(){this.startCalls=(this.startCalls||0)+1}
  stop(){this.stopCalls++;this.emit("audioend");this.emit("error",{error:"aborted"});this.emit("end")}
 }
 class NoStackError extends Error {constructor(message){super(message);Object.defineProperty(this,"stack",{get(){throw Error("stack unavailable")}})}}
 const c={Date:Clock,URLSearchParams,Promise,SpeechRecognition:Recognition,location:{search},console:{log(){}},setTimeout(fn,delay){timers.push({fn,delay,at:now,cleared:false});return timers.length},clearTimeout(id){timers[id-1].cleared=true}};
 if(noStack)c.Error=NoStackError;c.window=c;vm.createContext(c);vm.runInContext(source,c,{filename:"engine/services/speech-recognition-adapter.js"});return {c,timers,instances,at:t=>{now=t},events:()=>Array.from(c.MicReleaseTrace.events())};
}
(async()=>{
 const t=harness();const pending=t.c.SpeechRecognitionAdapter.listen({timeoutMs:8000}).catch(e=>e.message);const r=t.instances[0];
 assert.strictEqual(t.timers.length,1);assert.strictEqual(t.timers[0].delay,8000);
 t.at(2000);r.emit("start");t.at(9000);t.timers[0].fn();assert.strictEqual(await pending,"aborted");assert.strictEqual(r.stopCalls,1);
 const arm=t.events().find(e=>e.type==="timeout-armed"),request=t.events().find(e=>e.type==="termination-call");
 assert.strictEqual(arm.at,1000);assert.strictEqual(arm.elapsedSinceStartMs,null);assert.strictEqual(request.elapsedSinceStartMs,7000);assert.strictEqual(request.configuredTimeoutMs,8000);assert.strictEqual(request.caller,"SpeechRecognitionAdapter.listen.timeout");assert.strictEqual(request.reason,"timeout");assert.strictEqual(request.method,"stop");
 assert(t.events().find(e=>e.type==="onerror").appTerminationCallBeforeEvent);assert(t.events().find(e=>e.type==="onend").appTerminationCallBeforeEvent);
 const direct=harness();const p=direct.c.SpeechRecognitionAdapter.listen({}).catch(e=>e.message);direct.at(2000);direct.instances[0].emit("start");direct.at(9000);
 function cancelRequest(){direct.c.SpeechRecognitionAdapter.stop()}cancelRequest();assert.strictEqual(await p,"aborted");const call=direct.events().find(e=>e.type==="termination-call");assert.strictEqual(call.caller,"SpeechRecognitionAdapter.stop");assert.strictEqual(call.reason,"adapter-stop");assert.strictEqual(call.elapsedSinceStartMs,7000);assert(call.stack.includes("cancelRequest"));
 const native=harness();const n=native.c.SpeechRecognitionAdapter.listen({timeoutMs:8000}).catch(e=>e.message);native.at(1500);native.instances[0].emit("start");native.at(8500);native.instances[0].emit("audioend");native.instances[0].emit("error",{error:"aborted"});native.instances[0].emit("end");assert.strictEqual(await n,"aborted");assert.strictEqual(native.instances[0].stopCalls,0);assert(!native.events().some(e=>e.type==="termination-call"));assert.strictEqual(native.events().find(e=>e.type==="onend").appTerminationCallBeforeEvent,null);assert(native.timers[0].cleared);
 const broken=harness("?micReleaseTrace=1",true);broken.c.MicReleaseTrace.subscribe(()=>{throw Error("viewer failed")});const b=broken.c.SpeechRecognitionAdapter.listen({}).catch(e=>e.message);broken.instances[0].emit("start");broken.c.SpeechRecognitionAdapter.stop();assert.strictEqual(await b,"aborted");assert.strictEqual(broken.instances[0].stopCalls,1);assert(broken.events().find(e=>e.type==="termination-call"));
 const off=harness("");const o=off.c.SpeechRecognitionAdapter.listen({timeoutMs:8000}).catch(e=>e.message);off.instances[0].emit("start");off.timers[0].fn();assert.strictEqual(await o,"aborted");assert.strictEqual(off.instances[0].stopCalls,1);assert.strictEqual(off.events().length,0);
 console.log("recognition-termination-diagnostics.test.js: PASS (8000ms timer/7000ms from native start, direct caller, no-app-call end, diagnostic failures, OFF behavior)");
})().catch(e=>{console.error(e);process.exitCode=1});
