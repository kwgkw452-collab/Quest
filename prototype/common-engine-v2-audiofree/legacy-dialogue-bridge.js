(function(root){'use strict';
  // Optional V2 dialogue boundary over the existing legacy internal API.
  // Only used when the host has loaded the authentic legacy AudioManager.
  function createLegacyDialogueBridge({voiceInternal}={}){
    if(!voiceInternal||typeof voiceInternal.play!=='function'||typeof voiceInternal.stop!=='function')throw Error('DIALOGUE_CONTRACT_REQUIRED');
    let current=null,serial=0;
    function stop(){serial++;if(current){voiceInternal.stop();current=null;}}
    function play(key){
      stop();
      if(typeof key!=='string'||!/^voice_[a-z0-9_]+$/.test(key))return null;
      const id=serial;
      const result=voiceInternal.play(key);
      current=result;
      if(result&&typeof result.completion?.then==='function'){
        result.completion.then(()=>{if(id===serial)current=null;},()=>{if(id===serial)current=null;});
      }
      return result;
    }
    return {play,stop,isPlaying:()=>Boolean(current)};
  }
  root.QuestV2LegacyDialogueBridge={createLegacyDialogueBridge};
  if(typeof module!=='undefined'&&module.exports)module.exports={createLegacyDialogueBridge};
})(typeof window!=='undefined'?window:globalThis);
