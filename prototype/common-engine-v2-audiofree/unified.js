(function(){'use strict';
const api=window.QuestV2;
const view={backdrop:document.getElementById('backdrop'),dialogue:document.getElementById('dialogue'),text:document.getElementById('text'),support:document.getElementById('support'),actions:document.getElementById('actions'),status:document.getElementById('status'),log:document.getElementById('log'),select:document.getElementById('story-select')};
let catalog=[],runner=null,store=null,recognizer=null,dialogueVoice=null,documentCursor=0,documentLanguage='en',lastSceneAsset=null,sessionEpoch=0,advanceBusy=false,speechBusy=false;
const showStatus=s=>{view.status.textContent=s;};
const setText=(main,secondary='')=>{view.text.textContent=main;view.support.textContent=secondary;};
const clearButtons=()=>view.actions.replaceChildren();
const addButton=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.addEventListener('click',action);view.actions.append(b);return b;};
const report=e=>{view.log.textContent+=JSON.stringify(e)+'\n';view.log.scrollTop=view.log.scrollHeight;};
const error=e=>{report({error:String(e)});setText('エラー：'+String(e?.message||e));clearButtons();addButton('保存地点から再試行',()=>void reset(true));};
function setBackdrop(asset){
 if(typeof asset!=='string'||!/^images\/\d{3}\/[\w./-]+\.png(?:\?v=[\w.-]+)?$/.test(asset)||asset.split('?')[0].split('/').includes('..')){report({warning:'INVALID_ASSET',asset});return;}
 view.backdrop.style.backgroundImage='url("'+new URL('../../'+asset,location.href).href+'")';
 view.backdrop.setAttribute('aria-label',asset);
}
function lastBackdropBeforeCursor(pack,snapshot){
 if(!snapshot||!Array.isArray(pack.sceneOrder))return null;
 const last=pack.sceneOrder.indexOf(snapshot.scene);
 if(last<0)return null;
 let backdrop=null;
 for(let n=0;n<=last;n++){
  const name=pack.sceneOrder[n],steps=pack.scenes[name]?.steps||[];
  const limit=n===last?Math.min(snapshot.index,steps.length):steps.length;
  for(let i=0;i<limit;i++)if(steps[i]?.type==='scene')backdrop=steps[i].asset;
 }
 return backdrop;
}
function paintQuestion(v,{listening=false}={}){
 const heard=Boolean(!listening&&v.feedbackJa&&/と聞こえたよ/.test(v.feedbackJa));
 view.dialogue.className=heard?'threeRow':'twoRow';
 // Reserve the third (yellow) row ONLY for recognized-result feedback.
 const guidance=v.supportStage===1?'How would you say this in English?　':'';
 const help=v.supportText?guidance+'ピコ：'+v.supportText:'';
 setText(v.goalJa,heard?v.feedbackJa:[help,listening?'聞き取り中…':'',!listening&&v.feedbackJa?v.feedbackJa:''].filter(Boolean).join('　'));
 view.support.scrollTop=0;
 clearButtons();
 if(listening)return;
 addButton('話す',()=>void speech());
 addButton('ピコサポート',()=>{try{paint(runner.support());}catch(e){error(e);}});
 addButton('冒険に戻る',()=>paint(runner.returnToAdventure()));
}
function paintDialogueLine(event){
 view.dialogue.className='twoRow';
 const english=(event.speaker?event.speaker+'：':'')+event.text;
 const japanese=event.supportText||'';
 let opened=false;
 function display(language){
  view.dialogue.className='twoRow';
  setText(language==='ja'&&japanese?japanese:english,'');
  clearButtons();
  addButton('次へ',()=>void next());
  if(!opened){addButton('ピコサポート',()=>{opened=true;display('en');});return;}
  addButton('英文を見る',()=>display('en'));
  const jp=addButton('日本語を見る',()=>display('ja'));
  jp.disabled=!japanese;
  const replay=addButton('もう一度聞く',()=>{});
  replay.disabled=true;
  replay.title='音響凍結中';
 }
 display('en');
}
function showDocument(content){
 const lines=Array.isArray(content.lines)?content.lines:[];
 if(!lines.length){setText(content.title||'文書',(content.body||[]).join('\n'));clearButtons();addButton('読み終えた',()=>{runner.documentDone();if(lastSceneAsset)setBackdrop(lastSceneAsset);void next();});return;}
 const item=lines[documentCursor];
 const line=documentLanguage==='ja'?item.japanese:item.english;
 setText((content.title||'文書')+' ('+(documentCursor+1)+' / '+lines.length+')',line||'');
 clearButtons();
 addButton(documentLanguage==='en'?'日本語':'English',()=>{documentLanguage=documentLanguage==='en'?'ja':'en';report({type:'document-language',language:documentLanguage,index:documentCursor});showDocument(content);});
 if(documentCursor<lines.length-1)addButton('次の文',()=>{documentCursor++;report({type:'document-page',index:documentCursor});showDocument(content);});
 else addButton('読み終えた',()=>{runner.documentDone();documentCursor=0;documentLanguage='en';if(lastSceneAsset)setBackdrop(lastSceneAsset);void next();});
 addButton('冒険に戻る',()=>paint(runner.returnToAdventure()));
}
function checkpoint(event){
 if(!runner||!store||!['line','accepted','complete','document-complete'].includes(event.type))return;
 const snapshot=runner.snapshot();
 if(snapshot.status!=='READY')return;
 try{store.write(snapshot);}catch(e){report({warning:'CHECKPOINT_FAILED',reason:String(e?.message||e)});}
}
function paint(event){
 report(event);checkpoint(event);dialogueVoice?.stop();if(event.type==='line'&&event.voice)dialogueVoice?.play(event.voice);view.dialogue.className='twoRow';
 const state=runner.state();
 showStatus('Scene: '+state.scene+' / '+state.status+' / マイク: '+(recognizer.isSupported()?'対応':'非対応')+' / 音楽・Voice: OFF');
 clearButtons();
 if(event.type==='line')paintDialogueLine(event);
 else if(event.type==='challenge'||event.type==='hint'||(state.status==='QUESTION'&&['no-speech','rejected','unknown'].includes(event.type)))paintQuestion(event.view);
 else if(state.status==='BATTLE'&&['battle','accepted','rejected','no-speech'].includes(event.type)){setText(event.view?.prompt||state.battle?.prompt||'単語を言おう',event.view?.feedback||'');addButton('英単語を話す',()=>void speech());addButton('冒険に戻る',()=>paint(runner.returnToAdventure()));}
 else if(event.type==='document'){documentCursor=0;documentLanguage='en';if(event.content.card)setBackdrop(event.content.card);showDocument(event.content);}
 else if(event.type==='accepted'&&event.view?.goalJa){view.dialogue.className='twoRow';setText(event.view.goalJa,'成功しました！');addButton('次へ',()=>void next());}
 else if(event.type==='accepted'||event.type==='complete'||event.type==='document-complete'){setText('成功しました！');addButton('次へ',()=>void next());}
 else if(event.type==='end'){setText('このStoryをクリアしました。',JSON.stringify(event.flags));}
 else if(event.type==='return'){setText('冒険に戻りました。','再開するStoryを選択できます。保存地点がある場合は、そこから再開します。');addButton('冒険を再開',()=>void reset(true));addButton('最初からやり直す',()=>void reset(false));}
 else if(event.type==='stale'){setText('古い音声認識結果を無視しました。');}
 else {setText('処理状態：'+event.type);if(state.status==='READY')addButton('次へ',()=>void next());}
}
async function next(){const epoch=sessionEpoch,current=runner;if(!current||advanceBusy)return;advanceBusy=true;clearButtons();try{const event=await current.advance();if(epoch===sessionEpoch&&current===runner)paint(event);}catch(e){if(epoch===sessionEpoch&&current===runner)error(e);}finally{if(epoch===sessionEpoch&&current===runner)advanceBusy=false;}}
async function speech(){const epoch=sessionEpoch,current=runner;if(!current||speechBusy)return;speechBusy=true;try{const question=current.state().question;if(question)paintQuestion(question,{listening:true});else{clearButtons();setText('聞き取り中…');}const event=await current.talk();if(epoch===sessionEpoch&&current===runner)paint(event);}catch(e){if(epoch===sessionEpoch&&current===runner)error(e);}finally{if(epoch===sessionEpoch&&current===runner)speechBusy=false;}}
async function reset(resume){
 const epoch=++sessionEpoch;
 advanceBusy=false;speechBusy=false;
 const previousRecognizer=recognizer;
 dialogueVoice?.stop();dialogueVoice=null;
 // A Story change invalidates old controls before the new pack finishes loading.
 runner=null;store=null;recognizer=null;
 clearButtons();setText('Storyを読み込み中…');
 showStatus('Story: LOADING / 音楽・Voice: OFF');
 view.dialogue.className='';
 view.backdrop.style.backgroundImage='';
 view.backdrop.removeAttribute('aria-label');
 lastSceneAsset=null;documentCursor=0;documentLanguage='en';
 try{
  await (previousRecognizer?.stop?.() ?? previousRecognizer?.cancel?.());
  const entry=catalog.find(x=>x.id===view.select.value);if(!entry)throw Error('STORY_NOT_REGISTERED');
  const response=await fetch(new URL('./stories/'+entry.path.replace(/^\.\//,''),location.href));
  if(!response.ok)throw Error('STORY_FETCH_FAILED:'+response.status);
  const data=await response.json();
  if(epoch!==sessionEpoch)return;
  if(data.id!==entry.id)throw Error('CATALOG_ID_MISMATCH');
  const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
  store=api.createSaveStore({storage,key:'quest.v2.test.'+entry.id});
  const nativeRecognizer=api.createBrowserSpeech({env:window});
  dialogueVoice=window.AudioManager&&window.DialogueVoiceAudioInternal&&window.QuestV2LegacyDialogueBridge
   ?window.QuestV2LegacyDialogueBridge.createLegacyDialogueBridge({voiceInternal:window.DialogueVoiceAudioInternal})
   :null;
  recognizer=window.AudioManager&&window.QuestV2LegacySpeechBridge
   ?window.QuestV2LegacySpeechBridge.createLegacySpeechBridge({recognizer:nativeRecognizer,audioManager:window.AudioManager})
   :nativeRecognizer;
  let savedSnapshot=resume?(store.read()||undefined):undefined;
  if(resume&&!savedSnapshot&&storage){
   const raw=storage.getItem(api.LEGACY_KEY);
   if(raw&&JSON.parse(raw).progress?.currentStoryId===entry.id){
    const mappingResponse=await fetch(new URL('./stories/'+entry.path.replace(/story\.json$/,'legacy-cursors.json').replace(/^\.\//,''),location.href));
    if(!mappingResponse.ok)throw Error('LEGACY_CURSOR_MAP_FETCH_FAILED');
    const mapping=await mappingResponse.json();
    if(epoch!==sessionEpoch)return;
    savedSnapshot=api.legacySnapshot(storage,data,mapping);
   }
  }
  runner=api.createRunner(data,{recognize:recognizer.recognize,cancelSpeech:recognizer.cancel,storage:store,onEvent:(event)=>{if(epoch!==sessionEpoch)return;if(event.type==='scene'&&event.asset){lastSceneAsset=event.asset;setBackdrop(event.asset);}},initialSnapshot:savedSnapshot});
  if(!resume)store.clear();
  view.log.textContent='';view.backdrop.style.backgroundImage='';lastSceneAsset=null;documentCursor=0;documentLanguage='en';
  const restored=lastBackdropBeforeCursor(data,savedSnapshot);
  if(restored){lastSceneAsset=restored;setBackdrop(restored);}
  await next();
 }catch(e){if(epoch===sessionEpoch)error(e);}
}
async function start(){
 try{
  const response=await fetch('./stories/catalog.json');
  if(!response.ok)throw Error('CATALOG_FETCH_FAILED');
  const data=await response.json();catalog=data.stories||[];
  view.select.replaceChildren();
  for(const entry of catalog){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.id+' — '+entry.status;view.select.append(option);}
  const requested=new URLSearchParams(location.search).get('story');
  if(catalog.some(x=>x.id===requested))view.select.value=requested;
  view.select.addEventListener('change',()=>void reset(true));
  document.getElementById('restart').onclick=()=>void reset(false);
  document.getElementById('resume').onclick=()=>void reset(true);
  await reset(true);
 }catch(e){error(e);}
}
void start();
})();
