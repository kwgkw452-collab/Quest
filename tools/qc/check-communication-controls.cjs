#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=path.resolve(process.argv[2]);
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.attributes={};this.className="";this.hidden=false;this.scrollTop=0;this.listeners={};this.ownText="";
 this.classList={add:v=>{if(!this.className.split(/\s+/).includes(v))this.className+=" "+v;},remove:v=>this.className=this.className.split(/\s+/).filter(x=>x!==v).join(" "),toggle:(v,on)=>on?this.classList.add(v):this.classList.remove(v)};}
 get textContent(){return this.ownText+this.children.map(x=>x.textContent).join("");}
 set textContent(v){this.ownText=v;this.children.forEach(x=>x.parentNode=null);this.children=[];}
 set innerHTML(v){if(v!=="")throw Error("unexpected HTML");this.textContent="";}
 appendChild(c){return this.insertBefore(c,null);}
 insertBefore(c,b){c.remove();const i=b?this.children.indexOf(b):this.children.length;if(i<0)throw Error("missing child");this.children.splice(i,0,c);c.parentNode=this;return c;}
 remove(){if(this.parentNode)this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}
 setAttribute(k,v){this.attributes[k]=v;}
 closest(){return {};}
 addEventListener(k,f){this.listeners[k]=f;}
 getBoundingClientRect(){return {top:0,bottom:300,height:30,width:100};}
}
const els={};for(const name of ["dialogueBox","speaker","message","recognizedText","controls"])els[name]=new Element("div");
for(const name of ["speaker","message","recognizedText","controls"])els.dialogueBox.appendChild(els[name]);
const domCallbacks={},c={console,Promise,setTimeout,clearTimeout,GameConfig:{},document:{
 createElement:tag=>new Element(tag),createTextNode:t=>{const e=new Element("#text");e.textContent=t;return e;},
 getElementById:id=>id==="controls"?els.controls:null
},addEventListener:(event,fn)=>domCallbacks[event]=fn};
c.window=c;vm.createContext(c);
const load=p=>vm.runInContext(fs.readFileSync(path.join(source,p),"utf8"),c,{filename:p});
["data/word-dictionaries.js","data/questions.js","data/communicative-judge-rules.js","data/lottery-pools.js",
"engine/services/lottery-engine.js","data/s005-communication.js","data/s006-communication.js","data/s007-communication.js","engine/core/story-events.js",
"engine/managers/dialog-manager.js","engine/presenters/communicative-question-presenter.js"].forEach(load);
c.DialogManager.init(els);
(async()=>{
 if(domCallbacks.DOMContentLoaded)domCallbacks.DOMContentLoaded();
 const snapshots=[];
 for (const q of c.QuestionDatabase.all().filter(q=>/^s00[567]\.communication\./.test(q.id))) {
  await c.StoryEvents.emit("step:enter",{step:{type:"question",questionId:q.id}});
  const token=c.CommunicativeQuestionPresenter.begin();
  c.CommunicativeQuestionPresenter.speech(()=>new Promise(()=>{}),token,{},q.prompt,false);
  for (const status of ["reject", "unknown", "speech-failure"]) {
   for (const supportText of [null,q.picoSupport[0]]) {
    c.CommunicativeQuestionPresenter.recovery({status,answer:"latest recognition"},
      {retry:true,support:true,text:false,supportText},token);
    const message=els.message.textContent;
    snapshots.push({id:q.id,status,support:!!supportText,
      buttons:els.controls.children.filter(x=>x.tagName==="button").map(x=>x.textContent),
      goal:els.dialogueBox.children[0].children[1].textContent,expectedGoal:q.prompt,message,
      informationVisible: supportText ? message === supportText : status === "speech-failure" ? message.includes("聞き取れなかった") : message.includes("latest recognition") && message.includes("聞こえたよ")});
   }
  }
  c.CommunicativeQuestionPresenter.cancel();
 }
 const expected=["もう一度話す","ピコのサポート","冒険を続ける"];
 const pass=snapshots.every(x=>JSON.stringify(x.buttons)===JSON.stringify(expected)&&x.goal===x.expectedGoal&&x.informationVisible);
 console.log(JSON.stringify({source,kind:"real Presenter + DialogManager, fake DOM; no CSS/geometry claims",pass,expected,snapshots},null,2));
 c.CommunicativeQuestionPresenter.cancel();
 process.exitCode=pass?0:1;
})().catch(e=>{console.error(e);process.exitCode=2;});

