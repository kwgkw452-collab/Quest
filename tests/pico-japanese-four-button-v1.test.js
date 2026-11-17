"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "..");
const source = p => fs.readFileSync(path.join(root, p), "utf8");
const ui = {speaker:"",text:"",controls:[]};
const dm = {
  show:(who,text)=>{ui.speaker=who;ui.text=text;},
  setContent:(who,text)=>{ui.speaker=who;ui.text=text;},
  clearControls:()=>{ui.controls=[];},
  addControl:(label,action,options={})=>ui.controls.push({label,action,disabled:Boolean(options.disabled)})
};
const ctx = {Promise,DialogManager:dm,GameConfig:{dialogueNextLabel:"次へ"},DialogueVoiceController:{
  stop:()=>{},play:()=>Promise.resolve({status:"ended"})
}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source("engine/controllers/pico-support-controller.js"),ctx);
const press=label=>{const b=ui.controls.find(x=>x.label===label);assert(b&&!b.disabled,label);b.action();};
(async()=>{
  const first=ctx.PicoSupportController.present({speaker:"Meg",text:"Hello. I'm Meg.",
    supportText:"こんにちは。私はメグよ。",showEnglishInitially:true});
  assert.deepEqual(ui.controls.map(x=>x.label),["次へ","ピコサポート"]);
  assert.equal(ui.text,"Hello. I'm Meg.");
  press("ピコサポート");
  assert.deepEqual(ui.controls.map(x=>x.label),["次へ","英文を見る","日本語を見る","もう一度聞く"]);
  press("日本語を見る");assert.equal(ui.text,"こんにちは。私はメグよ。");
  press("英文を見る");assert.equal(ui.text,"Hello. I'm Meg.");
  press("次へ");await first;
  const missing=ctx.PicoSupportController.present({speaker:"Pico",text:"日本語のナレーション",showEnglishInitially:true});
  press("ピコサポート");assert(ctx.DialogManager && ui.controls.find(x=>x.label==="日本語を見る").disabled);
  press("次へ");await missing;
  for(const id of ["S005","S006","S007"]){
    const s=source("engine/stories/"+id+".js");
    const calls=[...s.matchAll(/C\\.dialogue\\("([^"]*)", "((?:[^"\\\\]|\\\\.)*)"(?:, (\\{[^\\n]*\\}))?\\)/g)];
    const english=calls.filter(m=>/[A-Za-z]/.test(m[2])&&!/[\\u3040-\\u30ff\\u3400-\\u9fff]/.test(m[2])&&!/^\\d\\d:\\d\\d$/.test(m[2]));
    assert(english.length>0,id+" no English dialogue");
    assert(english.every(m=>m[3]&&m[3].includes("supportText:")),id+" untranslated");
  }
  for(const page of ["dev.html","index.html"]){
    const html=source(page);assert(html.includes("pico-japanese-four-button-v1"));
  }
  console.log("pico-japanese-four-button-v1 PASS: four controls, English/Japanese, S005-S007 coverage");
})().catch(e=>{console.error(e);process.exitCode=1;});
