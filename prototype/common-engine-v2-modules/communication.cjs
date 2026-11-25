'use strict';
function normalize(s){return String(s??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function createCommunication(question,ports={}){
 let stage=0,state='READY',seq=0,active=0,last=null;
 const getView=()=>({state,goalJa:question.goalJa,recognizedText:last?.recognizedText??null,feedbackJa:last?.feedbackJa??null,supportText:stage?question.hints[stage-1]:null,supportStage:stage,layoutMode:stage||last?.recognizedText?'threeRow':'twoRow'});
 function support(){if(state==='CLOSED'||state==='ACCEPTED')throw Error('NOT_ACTIVE');stage=Math.min(3,stage+1);return getView();}
 function cancel(){active=++seq;state='CLOSED';ports.cancel?.();return getView();}
 async function attempt(){
  if(state==='LISTENING')throw Error('ALREADY_LISTENING');
  if(state==='CLOSED'||state==='ACCEPTED')throw Error('NOT_ACTIVE');
  if(typeof ports.recognize!=='function')throw Error('MISSING_RECOGNIZER');
  const token=++seq;active=token;state='LISTENING';last=null;
  let outcome;try{outcome=await ports.recognize({attemptId:token});}catch{outcome={status:'error'};}
  if(state==='CLOSED'||active!==token)return {result:'STALE',view:getView()};
  state='READY';
  if(outcome?.status==='final'&&typeof outcome.text==='string'&&outcome.text.trim()){
   const recognized=outcome.text;
   const decision=await Promise.resolve(ports.judge?.({question,recognized})??(question.accept.map(normalize).includes(normalize(recognized))?'ACCEPT':'REJECT'));
   if(active!==token||state==='CLOSED')return {result:'STALE',view:getView()};
   if(decision==='ACCEPT'){state='ACCEPTED';return {result:'ACCEPT',view:getView()};}
   last={recognizedText:recognized,feedbackJa:recognized+' と聞こえたよ。もう一度話してみよう。'};
   return {result:decision==='UNKNOWN'?'UNKNOWN':'REJECT',view:getView()};
  }
  last={feedbackJa:outcome?.status==='cancelled'?'発話を中止しました。':'うまく聞き取れなかったピコ。もう一度話してみよう。'};
  return {result:'NO_SPEECH',view:getView()};
 }
 return {getView,support,cancel,attempt};
}
module.exports={normalize,createCommunication};
