'use strict';
const {normalize}=require('./judge.cjs');
function createVocabularyBattle(data,{recognize,cancelSpeech}={}){
 if(!Array.isArray(data?.words)||data.words.length===0)throw Error('INVALID_BATTLE');
 let pos=0,active=0,status='READY',last=null;
 const view=()=>({status,index:pos,total:data.words.length,prompt:data.words[pos]?.prompt||null,feedback:last});
 async function speak(){if(status!=='READY')throw Error('NOT_READY');if(typeof recognize!=='function')throw Error('NO_RECOGNIZER');status='LISTENING';const token=++active;let r;try{r=await recognize({attemptId:token});}catch{r={status:'error'};}
  if(token!==active||status==='CANCELLED')return {type:'stale',view:view()};status='READY';
  if(r?.status!=='final'){last='うまく聞き取れなかったピコ。';return {type:'no-speech',view:view()};}
  const a=data.words[pos].answers||[];
  if(a.some(x=>normalize(x)===normalize(r.text))){pos++;last=null;if(pos===data.words.length)status='COMPLETE';return {type:status==='COMPLETE'?'complete':'accepted',view:view()};}
  last=r.text+' と聞こえたよ。';return {type:'rejected',view:view()};
 }
 function cancel(){active++;status='CANCELLED';cancelSpeech?.();return view();}
 return {view,speak,cancel};
}
module.exports={createVocabularyBattle};

