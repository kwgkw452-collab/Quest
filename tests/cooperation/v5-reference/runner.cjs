'use strict';
const {validate}=require('./schema.cjs');
const {createCommunication}=require('./communication.cjs');
const {createVocabularyBattle}=require('./vocabulary-battle.cjs');
function createRunner(pack,{recognize,judge,cancelSpeech,storage,onEvent,initialSnapshot}={}){
 const errors=validate(pack);if(errors.length)throw Error('INVALID_PACKAGE:'+errors.join(','));
 let scene=pack.entry,index=0,status='READY',communication=null,battle=null,feature=null,serial=0,advancing=false;
 let flags={};let events=[];
 if(initialSnapshot){if(initialSnapshot.storyId!==pack.id||initialSnapshot.schemaVersion!==1)throw Error('SAVE_MISMATCH');if(!pack.scenes[initialSnapshot.scene]||!Number.isInteger(initialSnapshot.index)||initialSnapshot.index<0||initialSnapshot.index>=pack.scenes[initialSnapshot.scene].steps.length)throw Error('INVALID_SAVE_CURSOR');if(initialSnapshot.status!=='READY')throw Error('UNSAFE_RESUME_STATE');if(!initialSnapshot.flags||typeof initialSnapshot.flags!=='object'||Array.isArray(initialSnapshot.flags)||Object.entries(initialSnapshot.flags).some(([k,v])=>!Object.prototype.hasOwnProperty.call(pack.saveKeys||{},k)||typeof v!==pack.saveKeys[k]))throw Error('INVALID_SAVE_FLAGS');scene=initialSnapshot.scene;index=initialSnapshot.index;flags={...initialSnapshot.flags};}
 const emit=e=>{events.push(e);onEvent?.(e);return e;};
 const snapshot=()=>({schemaVersion:1,storyId:pack.id,scene,index,status,flags:{...flags}});
 const state=()=>({...snapshot(),question:communication?.view()||null,battle:battle?.view()||null,feature,events:[...events]});
 async function advance(){
  if(advancing)throw Error('ADVANCE_ALREADY_RUNNING');
  if(status!=='READY')throw Error('NOT_READY');
  advancing=true;try {for(let n=0;n<500;n++){
   const s=pack.scenes[scene]?.steps[index];if(!s)throw Error('RUN_OFF_SCENE');
   switch(s.type){
    case 'scene':case 'clear':case 'hideDialogue':index++;emit({type:s.type,asset:s.asset||null});break;
    case 'line':index++;return emit({type:'line',speaker:s.speaker||null,text:s.text,supportText:s.supportText||null,voice:s.voice||null});
    case 'goto':scene=s.to;index=0;emit({type:'goto',scene});break;
    case 'setFlag':{const changed={...flags,[s.key]:s.value};const next={schemaVersion:1,storyId:pack.id,scene,index:index+1,status:'READY',flags:changed};if(storage)await storage.write(next);flags=changed;index++;emit({type:'flag',key:s.key,value:s.value});break;}
    case 'challenge':communication=createCommunication(pack.challenges[s.id],{recognize,judge,cancelSpeech});status='QUESTION';return emit({type:'challenge',id:s.id,view:communication.view()});
    case 'battle':battle=createVocabularyBattle(pack.battles[s.id],{recognize,cancelSpeech});status='BATTLE';return emit({type:'battle',id:s.id,view:battle.view()});
    case 'document':feature={type:'document',id:s.id,content:pack.documents[s.id]};status='DOCUMENT';return emit({...feature});
    case 'end':status='ENDED';return emit({type:'end',result:s.result||'completed',flags:{...flags}});
    default:throw Error('UNSUPPORTED_STEP:'+s.type);
   }
  }throw Error('RUNAWAY_STORY');} finally {advancing=false;}
 }
 const support=()=>{if(status!=='QUESTION')throw Error('NOT_QUESTION');return emit({type:'hint',view:communication.support()});};
 async function talk(){if(status!=='QUESTION'&&status!=='BATTLE')throw Error('NOT_SPEECH_STEP');const previous=serial;const target=status==='QUESTION'?communication:battle;const result=await target.speak();if(serial!==previous||!['QUESTION','BATTLE'].includes(status))return emit({type:'stale'});
  if(result.type==='accepted'&&status==='QUESTION'){status='READY';communication=null;index++;return emit(result);}
  if(result.type==='complete'){status='READY';battle=null;index++;return emit(result);}
  return emit(result);
 }
 function documentDone(){if(status!=='DOCUMENT')throw Error('NOT_DOCUMENT');status='READY';feature=null;index++;return emit({type:'document-complete'});}
 function back(){if(advancing)return emit({type:'ignored',reason:'save-in-progress'});serial++;communication?.cancel();battle?.cancel();communication=null;battle=null;feature=null;status='RETURNED';return emit({type:'return'});}
 return {advance,talk,support,documentDone,returnToAdventure:back,state,snapshot};
}
module.exports={createRunner};

