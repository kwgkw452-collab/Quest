#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=path.resolve(process.argv[2]),c={console:{log(){},warn(){}},Promise};c.window=c;vm.createContext(c);
const load=p=>vm.runInContext(fs.readFileSync(path.join(source,p),"utf8"),c,{filename:p});
["data/word-dictionaries.js","data/questions.js","data/communicative-judge-rules.js","data/lottery-pools.js",
"engine/services/lottery-engine.js","data/s005-communication.js","data/s006-communication.js","data/s007-communication.js"].forEach(load);
let actions=[],seen=[],calls=0;
c.QuestionManager={cancel(){},async start(id){calls++;return {questionId:id,status:"reject",answer:"attempt "+calls};}};
c.CommunicativeQuestionPresenter={begin(){return 1;},cancel(){},
async recovery(result,opts){seen.push({text:opts.supportText,allowText:opts.text});return actions.shift();},
async continued(){return "next";}};
load("engine/controllers/communicative-question-flow-controller.js");
const results=[];
(async()=>{
 for(const story of ["s005","s006","s007"]){
  const questions=c.QuestionDatabase.all().filter(q=>q.id.startsWith(story+".communication."));
  for(const q of questions){
   actions=["support","support","support","support","continue"];seen=[];calls=0;
   await c.CommunicativeQuestionFlowController.start(q.id);
   const cap=JSON.stringify(seen.map(x=>x.text))===JSON.stringify([null,...q.picoSupport,q.picoSupport[2]]);
   actions=["support","support","retry","support","support","support","continue"];seen=[];calls=0;
   await c.CommunicativeQuestionFlowController.start(q.id);
   const actual=seen.map(x=>x.text);
   const expected=[null,q.picoSupport[0],q.picoSupport[1],null,q.picoSupport[1],q.picoSupport[2],q.picoSupport[2]];
   const retry=JSON.stringify(actual)===JSON.stringify(expected),noText=seen.every(x=>!x.allowText);
   actions=["support","continue"];seen=[];calls=0;
   await c.CommunicativeQuestionFlowController.start(q.id);
   const reset=JSON.stringify(seen.map(x=>x.text))===JSON.stringify([null,q.picoSupport[0]]);
   results.push({id:q.id,cap,reset,noText,retry,expected,actual});
  }
 }
 const failures=results.filter(x=>!x.cap||!x.reset||!x.noText||!x.retry);
 console.log(JSON.stringify({source,boundary:"real Flow, QuestionManager/Presenter stubbed; no DOM claims",
   questions:results.length,failures:failures.length,summary:{cap:results.filter(x=>x.cap).length,reset:results.filter(x=>x.reset).length,
   noText:results.filter(x=>x.noText).length,retry:results.filter(x=>x.retry).length},results},null,2));
 process.exitCode=failures.length?1:0;
})().catch(e=>{console.error(e);process.exitCode=2;});

