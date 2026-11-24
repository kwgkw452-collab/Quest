'use strict';
const TYPES=new Set(['scene','clear','line','challenge','document','battle','setFlag','goto','end','hideDialogue']);
const BAD=new Set(['js','javascript','html','css','callback','onEnter','onExit','eval','expression','script']);
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function validatePackage(p){
 const errors=[];const add=x=>errors.push(x);
 if(!p||typeof p!=='object'||Array.isArray(p))return ['INVALID_PACKAGE'];
 for(const k of Object.keys(p))if(!new Set(['schemaVersion','id','title','entry','sceneOrder','scenes','assets','cast','challenges','rules','pools','documents','battles','saveKeys']).has(k))add('UNKNOWN_FIELD:'+k);
 if(p.schemaVersion!==1)add('INVALID_SCHEMA_VERSION');
 if(typeof p.id!=='string'||!/^S\d{3}$/.test(p.id))add('INVALID_ID');
 if(typeof p.title!=='string'||!p.title.trim())add('INVALID_TITLE');
 if(!p.scenes||typeof p.scenes!=='object'||Array.isArray(p.scenes))return [...errors,'INVALID_SCENES'];
 if(!has(p.scenes,p.entry))add('INVALID_ENTRY');
 if(!Array.isArray(p.sceneOrder)||p.sceneOrder.length!==Object.keys(p.scenes).length||new Set(p.sceneOrder).size!==p.sceneOrder.length||Object.keys(p.scenes).some(k=>!p.sceneOrder.includes(k)))add('INVALID_SCENE_ORDER');
 const saves=p.saveKeys||{},challenges=p.challenges||{};
 for(const [id,q] of Object.entries(challenges)){
  if(!q||typeof q.goalJa!=='string'||typeof q.modelEn!=='string'||!Array.isArray(q.hints)||q.hints.length!==3||q.hints.some(x=>typeof x!=='string'))add('INVALID_CHALLENGE:'+id);
  if(!q||!Array.isArray(q.accept)||!q.accept.length||q.accept.some(x=>typeof x!=='string'||!x.trim()))add('INVALID_ACCEPT_RULE:'+id);
 }
 for(const [id,scene] of Object.entries(p.scenes)){
  if(!scene||!Array.isArray(scene.steps)||!scene.steps.length){add('INVALID_STEPS:'+id);continue;}
  for(const [i,step] of scene.steps.entries()){
   const at=id+':'+i;
   if(!step||typeof step!=='object'||Array.isArray(step)){add('INVALID_STEP:'+at);continue;}
   if(!TYPES.has(step.type))add('UNKNOWN_STEP:'+at);
   if(step.type==='line'&&typeof step.text!=='string')add('INVALID_LINE:'+at);
   if(step.type==='challenge'&&!has(challenges,step.id))add('MISSING_CHALLENGE:'+at);
   if(step.type==='goto'&&!has(p.scenes,step.to))add('MISSING_SCENE:'+at);
   if(step.type==='setFlag'&&(!has(saves,step.key)||typeof step.value!==saves[step.key]))add('INVALID_SAVE_WRITE:'+at);
   if(step.type==='document'&&!has(p.documents||{},step.id))add('MISSING_FEATURE:'+at);
   if(step.type==='battle'&&!has(p.battles||{},step.id))add('MISSING_FEATURE:'+at);
  }
 }
 function forbid(x,at){if(!x||typeof x!=='object')return;for(const [k,v] of Object.entries(x)){if(BAD.has(k)||typeof v==='function')add('EXECUTABLE_DATA:'+at+'.'+k);if(v&&typeof v==='object')forbid(v,at+'.'+k);}}
 forbid(p,'$');return errors;
}
const normalize=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const judge=(q,s)=>q.accept.some(x=>normalize(x)===normalize(s))?'ACCEPT':'REJECT';
function createStoryRuntime(p,ports={}){
 const errors=validatePackage(p);if(errors.length)throw Error('INVALID_PACKAGE:'+errors.join(','));
 let scene=p.entry,index=0,state='READY',question=null,stage=0,attempts=0,seq=0,active=0,pending=false,feedback=null;
 const flags={...(ports.initialSave||{})},events=[];
 const emit=e=>{events.push(e);ports.onEvent?.(e);return e;};
 const snapshot=()=>({sceneId:scene,index,state,questionId:question?.id||null,supportStage:stage,attempts,activeAttempt:active,flags:{...flags},lastFeedback:feedback,events:[...events]});
 const view=()=>{if(!question)return null;const q=p.challenges[question.id];return {goalJa:q.goalJa,recognizedText:feedback?.recognizedText||null,feedbackJa:feedback?.feedbackJa||null,supportText:stage?q.hints[stage-1]:null,supportStage:stage,layoutMode:stage||feedback?.recognizedText?'threeRow':'twoRow',actions:['talk','support','return']};};
 function advance(){
  if(state!=='READY')throw Error('NOT_READY');
  for(let count=0;count<1000;count++){
   const x=p.scenes[scene]?.steps[index];if(!x)throw Error('RUN_OFF_SCENE');
   if(x.type==='goto'){scene=x.to;index=0;emit({type:'goto',sceneId:scene});continue;}
   if(x.type==='scene'||x.type==='clear'||x.type==='hideDialogue'){index++;emit({type:x.type,asset:x.asset||null});continue;}
   if(x.type==='setFlag'){flags[x.key]=x.value;ports.save?.(x.key,x.value);index++;emit({type:'flag',key:x.key,value:x.value});continue;}
   if(x.type==='line'){index++;return emit({type:'line',text:x.text,speaker:x.speaker||null,voice:x.voice||null});}
   if(x.type==='challenge'){question={id:x.id};stage=0;feedback=null;attempts=0;state='QUESTION';return emit({type:'challenge',id:x.id,view:view()});}
   if(x.type==='end'){state='ENDED';return emit({type:'end',result:x.result||'completed',save:{...flags}});}
   if(x.type==='document'||x.type==='battle'){if(typeof ports.features?.[x.type]!=='function')throw Error('UNSUPPORTED_FEATURE:'+x.type);state='FEATURE';return emit({type:'feature',kind:x.type,id:x.id});}
   throw Error('UNREACHABLE_STEP:'+x.type);
  }
  throw Error('RUNAWAY_STORY');
 }
 function hint(){if(state!=='QUESTION')throw Error('NOT_QUESTION');stage=Math.min(3,stage+1);return emit({type:'hint',stage,view:view()});}
 function back(){if(state==='ENDED')return emit({type:'ignored',reason:'already-ended'});active++;state='RETURNED';question=null;return emit({type:'return'});}
 async function speak(){
  if(state!=='QUESTION')throw Error('NOT_QUESTION');if(typeof ports.speech!=='function')throw Error('NO_SPEECH_PORT');if(pending)throw Error('SPEECH_ALREADY_PENDING');
  pending=true;const token=++seq;active=token;attempts++;emit({type:'listening',attemptId:token,view:view()});
  let outcome;try{outcome=await ports.speech({attemptId:token,questionId:question.id});}catch(_){outcome={status:'error'};}finally{pending=false;}
  if(token!==active||state!=='QUESTION')return emit({type:'ignored',reason:'stale-attempt',attemptId:token});
  const q=p.challenges[question.id];
  if(outcome?.status==='final'&&typeof outcome.text==='string'&&outcome.text.trim()){
   if(judge(q,outcome.text)==='ACCEPT'){const id=question.id;question=null;feedback=null;state='READY';index++;return emit({type:'accepted',id,attemptId:token});}
   feedback={recognizedText:outcome.text,feedbackJa:outcome.text+' と聞こえたよ。もう一度話してみよう。'};
   return emit({type:'rejected',attemptId:token,view:view()});
  }
  feedback={feedbackJa:outcome?.status==='cancelled'?'発話を中止しました。':'うまく聞き取れなかったピコ。もう一度話してみよう。'};
  return emit({type:outcome?.status==='cancelled'?'cancelled':'no-speech',attemptId:token,view:view()});
 }
 function featureComplete(){if(state!=='FEATURE')throw Error('NOT_FEATURE');state='READY';index++;return emit({type:'feature-complete'});}
 return {advance,hint,speak,view,getState:snapshot,returnToAdventure:back,featureComplete};
}
module.exports={validatePackage,normalize,judge,createStoryRuntime};
