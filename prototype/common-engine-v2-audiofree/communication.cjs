'use strict';
const {judge:localJudge}=require('./judge.cjs');
function createCommunication(q,{recognize,judge=localJudge,cancelSpeech}={}){
 let stage=0,state='READY',attempt=0,active=0,feedback=null;
 const view=()=>{
  const supportText=stage?q.hints[stage-1]:null;
  return {
   state,
   goalJa:q.goalJa,
   supportStage:stage,
   supportText,
   recognizedText:feedback?.recognizedText??null,
   feedbackJa:feedback?.feedbackJa??null,
   layoutMode:supportText?'threeRow':'twoRow',
   actions:state==='READY'?['talk','support','return']:[],
  };
 };
 function support(){if(state!=='READY')throw Error('NOT_READY');stage=Math.min(stage+1,3);return view();}
 // User may open Pico Support even if Safari's ASR is still listening.
 // Invalidate the pending attempt without cancelling the question itself.
 function stopListening(){
  if(state!=='LISTENING')return view();
  active=++attempt;state='READY';
  try{cancelSpeech?.();}catch{}
  feedback=null;
  return view();
 }
 function cancel(){active=++attempt;state='CANCELLED';cancelSpeech?.();return view();}
 async function speak(){if(state!=='READY')throw Error('NOT_READY');if(typeof recognize!=='function')throw Error('NO_RECOGNIZER');
  state='LISTENING';feedback=null;const token=++attempt;active=token;let r;
  try{r=await recognize({attemptId:token});}catch(e){r={status:'error',reason:String(e)};}
  if(active!==token||state==='CANCELLED')return {type:'stale',view:view()};
  if(r?.status!=='final'||!r.text){state='READY';feedback={feedbackJa:r?.status==='permission-denied'?'マイクの許可を確認してください。':r?.status==='unsupported'?'このブラウザは音声認識に対応していません。':r?.status==='timeout'?'聞き取り時間を超えたピコ。もう一度話してみよう。':'うまく聞き取れなかったピコ。'};return {type:'no-speech',view:view()};}
  let answer;try{answer=await judge(q.rule||{accept:q.accept||[]},r.text);}catch(e){state='READY';throw e;}
  if(active!==token||state==='CANCELLED')return {type:'stale',view:view()};
  const decision=typeof answer==='string'?answer:answer?.decision;
  if(decision==='ACCEPT'){state='ACCEPTED';return {type:'accepted',view:view(),recognizedText:r.text};}
  state='READY';feedback={recognizedText:r.text,feedbackJa:`${r.text} と聞こえたよ。もう一度話してみよう。`};return {type:decision==='UNKNOWN'?'unknown':'rejected',view:view()};
 }
 return {view,support,stopListening,cancel,speak};
}
module.exports={createCommunication};

