(function(root){'use strict';
  // Opt-in integration boundary. This file never modifies legacy AudioManager.
  // A host must supply its own initialized AudioManager; the isolated player
  // remains audio-free when none is present.
  function createLegacySpeechBridge({recognizer,audioManager}={}){
    if(!recognizer||typeof recognizer.recognize!=='function'||typeof recognizer.cancel!=='function')throw Error('RECOGNIZER_REQUIRED');
    if(!audioManager||typeof audioManager.enterSpeechMode!=='function'||typeof audioManager.exitSpeechMode!=='function')throw Error('AUDIO_CONTRACT_REQUIRED');
    let generation=0,queue=Promise.resolve(),active=false;
    function serialized(task){const p=queue.then(task,task);queue=p.catch(()=>{});return p;}
    function cancel(){++generation;try{recognizer.cancel();}catch(e){/* A failed microphone abort must not block queued audio restoration. */}}
    async function recognize(input){
      const id=++generation;
      return serialized(async()=>{
        if(id!==generation)return {status:'cancelled',attemptId:input?.attemptId};
        try{
          // No options: this is the explicitly tested isolation API.
          await audioManager.enterSpeechMode();
          active=true;
          if(id!==generation)return {status:'cancelled',attemptId:input?.attemptId};
          const result=await recognizer.recognize(input);
          if(id!==generation)return {status:'cancelled',attemptId:input?.attemptId};
          return result;
        }finally{
          if(active){active=false;await audioManager.exitSpeechMode();}
        }
      });
    }
    // Cancel alone never abandons exitSpeechMode; await idle before switching Stories.
    async function stop(){cancel();await queue;}
    return {recognize,cancel,stop,isSupported:()=>recognizer.isSupported?.()??true};
  }
  root.QuestV2LegacySpeechBridge={createLegacySpeechBridge};
  if(typeof module!=='undefined'&&module.exports)module.exports={createLegacySpeechBridge};
})(typeof window!=='undefined'?window:globalThis);
