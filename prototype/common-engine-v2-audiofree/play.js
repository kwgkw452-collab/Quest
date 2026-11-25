(function(){'use strict';
const api=window.QuestV2;
const view={backdrop:document.getElementById('backdrop'),dialogue:document.getElementById('dialogue'),text:document.getElementById('text'),support:document.getElementById('support'),actions:document.getElementById('actions'),status:document.getElementById('status'),log:document.getElementById('log'),select:document.getElementById('story-select')};
let catalog=[],runner=null,store=null,recognizer=null,documentCursor=0,documentLanguage='en',lastSceneAsset=null,sessionEpoch=0;
const showStatus=s=>{view.status.textContent=s;};
const setText=(main,secondary='')=>{view.text.textContent=main;view.support.textContent=secondary;};
const clearButtons=()=>view.actions.replaceChildren();
const addButton=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.addEventListener('click',action);view.actions.append(b);return b;};
const report=e=>{view.log.textContent+=JSON.stringify(e)+'\n';view.log.scrollTop=view.log.scrollHeight;};
const error=e=>{report({error:String(e)});setText('エラー：'+String(e?.message||e));clearButtons();addButton('再試行',()=>void reset(false));};
function setBackdrop(asset){
 if(typeof asset!=='string'||!/^images\/\d{3}\/[\w./-]+\.png(?:\?v=[\w.-]+)?$/.test(asset)||asset.split('?')[0].split('/').includes('..')){report({warning:'INVALID_ASSET',asset});return;}
 view.backdrop.style.backgroundImage='url("'+new URL('../../../'+asset,location.href).href+'")';
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
function paintQuestion(v){
 view.dialogue.className=v.layoutMode==='threeRow'?'threeRow':'twoRow';
 setText(v.goalJa,[v.recognizedText?'認識：'+v.recognizedText:'',v.feedbackJa||'',v.supportText?'ピコ：'+v.supportText:''].filter(Boolean).join('　'));
 clearButtons();addButton('話す',()=>void speech());addButton('ピコサポート',()=>{try{paint(runner.support());}catch(e){error(e);}});addButton('冒険に戻る',()=>paint(runner.returnToAdventure()));
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
 report(event);checkpoint(event);view.dialogue.className='';
 const state=runner.state();
 showStatus('Scene: '+state.scene+' / '+state.status+' / マイク: '+(recognizer.isSupported()?'対応':'非対応')+' / 音楽・Voice: OFF');
 clearButtons();
 if(event.type==='line'){setText((event.speaker?event.speaker+'：':'')+event.text,event.supportText||'');addButton('次へ',()=>void next());}
 else if(event.type==='challenge'||event.type==='hint'||(state.status==='QUESTION'&&['no-speech','rejected','unknown'].includes(event.type)))paintQuestion(event.view);
 else if(state.status==='BATTLE'&&['battle','accepted','rejected','no-speech'].includes(event.type)){setText(event.view?.prompt||state.battle?.prompt||'単語を言おう',event.view?.feedback||'');addButton('英単語を話す',()=>void speech());addButton('冒険に戻る',()=>paint(runner.returnToAdventure()));}
 else if(event.type==='document'){documentCursor=0;documentLanguage='en';if(event.content.card)setBackdrop(event.content.card);showDocument(event.content);}
 else if(event.type==='accepted'||event.type==='complete'||event.type==='document-complete'){setText('成功しました！');addButton('次へ',()=>void next());}
 else if(event.type==='end'){setText('このStoryをクリアしました。',JSON.stringify(event.flags));}
 else if(event.type==='return'){setText('冒険に戻りました。','再開するStoryを選択できます。保存地点がある場合は、そこから再開します。');addButton('冒険を再開',()=>void reset(true));addButton('最初からやり直す',()=>void reset(false));}
 else if(event.type==='stale'){setText('古い音声認識結果を無視しました。');}
 else {setText('処理状態：'+event.type);if(state.status==='READY')addButton('次へ',()=>void next());}
}
async function next(){const epoch=sessionEpoch,current=runner;try{const event=await current.advance();if(epoch===sessionEpoch&&current===runner)paint(event);}catch(e){if(epoch===sessionEpoch&&current===runner)error(e);}}
async function speech(){const epoch=sessionEpoch,current=runner;try{clearButtons();setText('聞き取り中…');const event=await current.talk();if(epoch===sessionEpoch&&current===runner)paint(event);}catch(e){if(epoch===sessionEpoch&&current===runner)error(e);}}
async function reset(resume){
 const epoch=++sessionEpoch;
 const previousRecognizer=recognizer;
 // A Story change invalidates old controls before the new pack finishes loading.
 runner=null;store=null;recognizer=null;
 clearButtons();setText('Storyを読み込み中…');
 showStatus('Story: LOADING / 音楽・Voice: OFF');
 view.dialogue.className='';
 view.backdrop.style.backgroundImage='';
 view.backdrop.removeAttribute('aria-label');
 lastSceneAsset=null;documentCursor=0;documentLanguage='en';
 try{
  previousRecognizer?.cancel();
  const entry=catalog.find(x=>x.id===view.select.value);if(!entry)throw Error('STORY_NOT_REGISTERED');
  const response=await fetch(new URL('./stories/'+entry.path.replace(/^\.\//,''),location.href));
  if(!response.ok)throw Error('STORY_FETCH_FAILED:'+response.status);
  const data=await response.json();
  if(epoch!==sessionEpoch)return;
  if(data.id!==entry.id)throw Error('CATALOG_ID_MISMATCH');
  const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
  store=api.createSaveStore({storage,key:'quest.v2.test.'+entry.id});
  if(!resume)store.clear();
  recognizer=api.createBrowserSpeech({env:window});
  const savedSnapshot=resume?(store.read()||undefined):undefined;
  runner=api.createRunner(data,{recognize:recognizer.recognize,cancelSpeech:recognizer.cancel,storage:store,onEvent:(event)=>{if(epoch!==sessionEpoch)return;if(event.type==='scene'&&event.asset){lastSceneAsset=event.asset;setBackdrop(event.asset);}},initialSnapshot:savedSnapshot});
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
