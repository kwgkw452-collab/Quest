'use strict';
const {validate}=require('./schema.cjs');
const {createCommunication}=require('./communication.cjs');
function createRunner(pack,ports={}){
 const errors=validate(pack);if(errors.length)throw Error('INVALID_PACKAGE:'+errors.join(','));
 const save={...(ports.initialSave||{})};let scene=pack.entry,index=0,status='READY',communication=null;
 const events=[];
 const publish=e=>{events.push(e);ports.onEvent?.(e);return e;};
 const state=()=>({scene,index,status,flags:{...save},communication:communication?.getView()??null,events:[...events]});
 function advance(){
  if(status!=='READY')throw Error('NOT_READY');
  for(let n=0;n<1000;n++){
   const step=pack.scenes[scene]?.steps[index];if(!step)throw Error('RUN_OFF_STORY');
   switch(step.type){
    case 'goto':scene=step.to;index=0;publish({type:'goto',scene});break;
    case 'scene':case 'clear':case 'hideDialogue':index++;publish({type:step.type,asset:step.asset||null});break;
    case 'line':index++;return publish({type:'line',text:step.text,speaker:step.speaker||null,voice:step.voice||null});
    case 'challenge':{const q=pack.challenges[step.id];communication=createCommunication(q,{recognize:ports.speech,judge:ports.judge,cancel:ports.cancelSpeech});status='QUESTION';return publish({type:'challenge',id:step.id,view:communication.getView()});}
    case 'setFlag':{if(typeof ports.save==='function')ports.save(step.key,step.value);save[step.key]=step.value;index++;publish({type:'flag',key:step.key,value:step.value});break;}
    case 'end':status='ENDED';return publish({type:'end',result:step.result||'completed',flags:{...save}});
    case 'document':case 'battle':if(typeof ports.features?.[step.type]!=='function')throw Error('UNSUPPORTED_FEATURE:'+step.type);status='FEATURE';return publish({type:'feature',kind:step.type,id:step.id});
    default:throw Error('UNKNOWN_RUNTIME_STEP:'+step.type);
   }
  }
  throw Error('RUNAWAY_STORY');
 }
 function support(){if(status!=='QUESTION')throw Error('NOT_QUESTION');return publish({type:'hint',view:communication.support()});}
 async function talk(){if(status!=='QUESTION')throw Error('NOT_QUESTION');const active=communication;const result=await active.attempt();if(status!=='QUESTION'||active!==communication)return publish({type:'ignored',reason:'closed-question'});if(result.result==='ACCEPT'){status='READY';index++;communication=null;return publish({type:'accepted'});}return publish({type:result.result.toLowerCase(),view:result.view});}
 function returnToAdventure(){if(status==='ENDED')return publish({type:'ignored'});communication?.cancel();communication=null;status='RETURNED';return publish({type:'return'});}
 function featureComplete(){if(status!=='FEATURE')throw Error('NOT_FEATURE');status='READY';index++;return publish({type:'feature-complete'});}
 return {advance,talk,support,returnToAdventure,featureComplete,state};
}
module.exports={createRunner};
