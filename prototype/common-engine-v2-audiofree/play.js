(function(){'use strict';
const api=window.QuestV2;
const view={backdrop:document.getElementById('backdrop'),dialogue:document.getElementById('dialogue'),text:document.getElementById('text'),support:document.getElementById('support'),actions:document.getElementById('actions'),status:document.getElementById('status'),log:document.getElementById('log'),select:document.getElementById('story-select')};
let catalog=[],runner=null,store=null,recognizer=null;
const showStatus=s=>{view.status.textContent=s;};
const setText=(main,secondary='')=>{view.text.textContent=main;view.support.textContent=secondary;};
const clearButtons=()=>view.actions.replaceChildren();
const addButton=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.addEventListener('click',action);view.actions.append(b);return b;};
const report=e=>{view.log.textContent+=JSON.stringify(e)+'\n';view.log.scrollTop=view.log.scrollHeight;};
const error=e=>{report({error:String(e)});setText('エラー：'+String(e?.message||e));clearButtons();addButton('再試行',()=>void reset(false));};
function setBackdrop(asset){
 if(typeof asset!=='string'||!/^images\/\d{3}\/[\w./-]+\.png$/.test(asset)||asset.split('/').includes('..')){report({warning:'INVALID_ASSET',asset});return;}
 view.backdrop.style.backgroundImage='url("'+new URL('../../../'+asset,location.href).href+'")';
 view.backdrop.setAttribute('aria-label',asset);
}
function paintQuestion(v){
 view.dialogue.className=v.layoutMode==='threeRow'?'threeRow':'twoRow';
 setText(v.goalJa,[v.recognizedText?'認識：'+v.recognizedText:'',v.feedbackJa||'',v.supportText?'ピコ：'+v.supportText:''].filter(Boolean).join('　'));
 clearButtons();addButton('話す',()=>void speech());addButton('ピコサポート',()=>{try{paint(runner.support());}catch(e){error(e);}});addButton('冒険に戻る',()=>paint(runner.returnToAdventure()));
}
function paint(event){
 report(event);view.dialogue.className='';
 const state=runner.state();
 showStatus('Scene: '+state.scene+' / '+state.status+' / マイク: '+(recognizer.isSupported()?'対応':'非対応')+' / 音楽・Voice: OFF');
 clearButtons();
 if(event.type==='line'){setText((event.speaker?event.speaker+'：':'')+event.text,event.supportText||'');addButton('次へ',()=>void next());}
 else if(event.type==='challenge'||event.type==='hint'||(state.status==='QUESTION'&&['no-speech','rejected','unknown'].includes(event.type)))paintQuestion(event.view);
 else if(state.status==='BATTLE'&&['battle','accepted','rejected','no-speech'].includes(event.type)){setText(event.view?.prompt||state.battle?.prompt||'単語を言おう',event.view?.feedback||'');addButton('英単語を話す',()=>void speech());addButton('冒険に戻る',()=>paint(runner.returnToAdventure()));}
 else if(event.type==='document'){setText(event.content.title,(event.content.body||[]).join('\n'));addButton('読み終えた',()=>{runner.documentDone();void next();});}
 else if(event.type==='accepted'||event.type==='complete'||event.type==='document-complete'){setText('成功しました！');addButton('次へ',()=>void next());}
 else if(event.type==='end'){setText('このStoryをクリアしました。',JSON.stringify(event.flags));}
 else if(event.type==='return'){setText('冒険に戻りました。');}
 else if(event.type==='stale'){setText('古い音声認識結果を無視しました。');}
 else {setText('処理状態：'+event.type);if(state.status==='READY')addButton('次へ',()=>void next());}
}
async function next(){try{paint(await runner.advance());}catch(e){error(e);}}
async function speech(){try{clearButtons();setText('聞き取り中…');paint(await runner.talk());}catch(e){error(e);}}
async function reset(resume){
 try{
  const entry=catalog.find(x=>x.id===view.select.value);if(!entry)throw Error('STORY_NOT_REGISTERED');
  const response=await fetch(new URL('./stories/'+entry.path.replace(/^\.\//,''),location.href));
  if(!response.ok)throw Error('STORY_FETCH_FAILED:'+response.status);
  const data=await response.json();
  if(data.id!==entry.id)throw Error('CATALOG_ID_MISMATCH');
  const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
  store=api.createSaveStore({storage,key:'quest.v2.test.'+entry.id});
  if(!resume)store.clear();
  recognizer?.cancel();
  recognizer=api.createBrowserSpeech({env:window});
  runner=api.createRunner(data,{recognize:recognizer.recognize,cancelSpeech:recognizer.cancel,storage:store,initialSnapshot:resume?(store.read()||undefined):undefined});
  view.log.textContent='';view.backdrop.style.backgroundImage='';
  await next();
 }catch(e){error(e);}
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
  view.select.addEventListener('change',()=>void reset(false));
  document.getElementById('restart').onclick=()=>void reset(false);
  document.getElementById('resume').onclick=()=>void reset(true);
  await reset(false);
 }catch(e){error(e);}
}
void start();
})();
