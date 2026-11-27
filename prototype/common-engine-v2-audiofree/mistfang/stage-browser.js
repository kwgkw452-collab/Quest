(function(){'use strict';
// Isolated QA harness: uses the existing QuestV2 vocabulary engine, no engine/Audio changes.
const words=['snow','snowy','mist','misty','storm','stormy','thunder','lightning','fine','frosty'];
const stageAt=n=>n===10?3:n>=6?2:n>=3?1:0;
const assets=[0,1,2,3].map(i=>'./assets/mistfang_stage_'+i+'.png');
const message=document.getElementById('message'),graphic=document.getElementById('graphic'),stage=document.getElementById('stage'),debug=document.getElementById('debug'),speak=document.getElementById('speak');
let runner=null,completed=false,generation=0;
function draw(index){const stageNumber=stageAt(index);stage.textContent='Mistfang / 段階 '+(stageNumber+1)+' / 4';graphic.src=assets[stageNumber];graphic.dataset.stage=String(stageNumber);graphic.onerror=()=>{message.textContent='GRAPHIC_MISSING: '+assets[stageNumber]+' （画像のGitHub登録待ち）';};}
async function start(){generation++;completed=false;speak.disabled=true;const serial=generation;
 const model={schemaVersion:1,id:'S889',title:'Mistfang QA candidate',entry:'battle',sceneOrder:['battle','ending'],saveKeys:{},challenges:{},
 battles:{mistfang:{words:words.map((word,i)=>({prompt:'天気に関する英単語を言おう ('+(i+1)+' / 10)',answers:[word]}))}},
 scenes:{battle:{steps:[{type:'battle',id:'mistfang'},{type:'goto',to:'ending'}]},ending:{steps:[{type:'line',text:'The mist is gone!'},{type:'end'}]}}};
 const speech=window.QuestV2.createBrowserSpeech({env:window});
 runner=window.QuestV2.createRunner(model,{recognize:speech.recognize,cancelSpeech:speech.cancel});
 await runner.advance();if(serial!==generation)return;
 draw(0);message.textContent='10語を順番に発話してください。';speak.disabled=!speech.isSupported();
 if(!speech.isSupported())message.textContent='マイク非対応。PCのChrome/Edgeで検証してください。';
}
async function talk(){if(!runner||completed)return;const serial=generation;speak.disabled=true;
 try{const event=await runner.talk();if(serial!==generation)return;
  debug.textContent=JSON.stringify({type:event.type,index:event.view?.index,stage:stageAt(event.view?.index||0)},null,2);
  if(event.type==='accepted'||event.type==='complete'){draw(event.view.index);}
  if(event.type==='complete'){completed=true;message.textContent='Mistfangの霧が晴れました。';await runner.advance();speak.disabled=true;return;}
  message.textContent=event.type==='accepted'?'正解！ 次の単語へ。':event.type==='rejected'?'もう一度挑戦しよう。':'認識できませんでした。もう一度どうぞ。';
 }catch(e){message.textContent=String(e);}finally{if(serial===generation&&!completed)speak.disabled=false;}
}
speak.addEventListener('click',talk);document.getElementById('restart').addEventListener('click',start);void start();
})();