'use strict';
const STEP_TYPES=new Set(['scene','clear','line','challenge','document','battle','setFlag','goto','end','hideDialogue']);
const TOP=new Set(['schemaVersion','id','title','entry','sceneOrder','scenes','challenges','saveKeys','assets','cast','documents','battles']);
const BANNED=new Set(['js','javascript','html','css','callback','onEnter','onExit','eval','expression','script']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function validate(p){
 const errors=[];const fail=s=>errors.push(s);
 if(!p||typeof p!=='object'||Array.isArray(p))return ['INVALID_PACKAGE'];
 for(const k of Object.keys(p))if(!TOP.has(k))fail('UNKNOWN_ROOT_FIELD:'+k);
 if(p.schemaVersion!==1)fail('INVALID_SCHEMA');
 if(typeof p.id!=='string'||!/^S\d{3}$/.test(p.id))fail('INVALID_ID');
 if(typeof p.title!=='string'||!p.title.trim())fail('INVALID_TITLE');
 if(!p.scenes||typeof p.scenes!=='object'||Array.isArray(p.scenes))return [...errors,'INVALID_SCENES'];
 if(typeof p.entry!=='string'||!own(p.scenes,p.entry))fail('INVALID_ENTRY');
 if(!Array.isArray(p.sceneOrder)||p.sceneOrder.length!==Object.keys(p.scenes).length||new Set(p.sceneOrder).size!==p.sceneOrder.length||Object.keys(p.scenes).some(k=>!p.sceneOrder.includes(k)))fail('INVALID_SCENE_ORDER');
 const saves=p.saveKeys||{},challenges=p.challenges||{};
 if(typeof saves!=='object'||Array.isArray(saves)||!saves)fail('INVALID_SAVE_KEYS');
 if(typeof challenges!=='object'||Array.isArray(challenges)||!challenges)fail('INVALID_CHALLENGES');
 for(const [id,q] of Object.entries(challenges)){
  if(!q||typeof q.goalJa!=='string'||typeof q.modelEn!=='string'||!Array.isArray(q.hints)||q.hints.length!==3||q.hints.some(x=>typeof x!=='string'))fail('INVALID_CHALLENGE:'+id);
  if(!q||!Array.isArray(q.accept)||!q.accept.length||q.accept.some(x=>typeof x!=='string'))fail('INVALID_ACCEPT:'+id);
 }
 for(const [sceneId,scene]of Object.entries(p.scenes)){
  if(!scene||!Array.isArray(scene.steps)||!scene.steps.length){fail('INVALID_STEPS:'+sceneId);continue;}
  for(const [i,s]of scene.steps.entries()){
   const loc=sceneId+':'+i;
   if(!s||typeof s!=='object'||Array.isArray(s)){fail('INVALID_STEP:'+loc);continue;}
   if(!STEP_TYPES.has(s.type))fail('UNKNOWN_STEP:'+loc);
   if(s.type==='line'&&typeof s.text!=='string')fail('INVALID_LINE:'+loc);
   if(s.type==='goto'&&!own(p.scenes,s.to))fail('BROKEN_GOTO:'+loc);
   if(s.type==='challenge'&&!own(challenges,s.id))fail('MISSING_CHALLENGE:'+loc);
   if(s.type==='setFlag'&&(!own(saves,s.key)||typeof s.value!==saves[s.key]))fail('INVALID_FLAG:'+loc);
   if(s.type==='document'&&!own(p.documents||{},s.id))fail('MISSING_DOCUMENT:'+loc);
   if(s.type==='battle'&&!own(p.battles||{},s.id))fail('MISSING_BATTLE:'+loc);
  }
 }
 const scan=(o,loc)=>{if(!o||typeof o!=='object')return;for(const [key,value]of Object.entries(o)){if(BANNED.has(key)||typeof value==='function')fail('EXECUTABLE_FIELD:'+loc+'.'+key);if(value&&typeof value==='object')scan(value,loc+'.'+key);}};
 scan(p,'$');return [...new Set(errors)];
}
module.exports={validate,STEP_TYPES};
