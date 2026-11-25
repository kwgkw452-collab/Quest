'use strict';
// No dependency on AudioManager; only browser SpeechRecognition. No implicit text fallback.
function createBrowserSpeech({env=(typeof window==='undefined'?{}:window),language='en-US',timeoutMs=12000}={}){
 let seq=0,live=null;
 function cancel(){if(!live)return;const x=live;live=null;x.finish({status:'cancelled'});try{x.instance.abort();}catch{}}
 function recognize({attemptId,lang=language}={}){
  const Cls=env.SpeechRecognition||env.webkitSpeechRecognition;
  if(!Cls)return Promise.resolve({status:'unsupported'});
  cancel();
  const id=++seq;
  return new Promise(resolve=>{
   const instance=new Cls();let ended=false,choice=null,timer=null;
   const finish=value=>{if(ended)return;ended=true;if(timer!==null)clearTimeout(timer);if(live?.id===id)live=null;instance.onresult=null;instance.onerror=null;instance.onend=null;resolve({...value,attemptId});};
   live={id,instance,finish};instance.lang=lang;instance.interimResults=false;instance.continuous=false;instance.maxAlternatives=3;
   instance.onresult=event=>{const a=event.results?.[event.resultIndex??0];const texts=[];for(let k=0;k<(a?.length||0);k++){const s=a[k]?.transcript;if(typeof s==='string'&&s.trim())texts.push(s.trim());}if(texts.length)choice={status:'final',text:texts[0],alternatives:texts};};
   instance.onerror=event=>{const code=event?.error;choice={status:code==='not-allowed'||code==='service-not-allowed'?'permission-denied':code==='no-speech'?'no-speech':'error',reason:code||'unknown'};};
   instance.onend=()=>finish(choice||{status:'no-speech'});
   try{instance.start();if(!ended&&Number.isFinite(timeoutMs)&&timeoutMs>0)timer=setTimeout(()=>{finish({status:'timeout'});try{instance.abort();}catch{}},timeoutMs);}catch(e){finish({status:'error',reason:String(e?.message||e)});}
  });
 }
 return {recognize,cancel,isSupported:()=>Boolean(env.SpeechRecognition||env.webkitSpeechRecognition)};
}
module.exports={createBrowserSpeech};

