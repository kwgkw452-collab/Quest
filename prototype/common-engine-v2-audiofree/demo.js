(function(){'use strict';
 const q=window.QuestV2;const target=document.getElementById('content'),actions=document.getElementById('actions'),log=document.getElementById('log'),stat=document.getElementById('status');
 const speech=q.createBrowserSpeech({env:window});let persistent=null;try{persistent=window.localStorage;}catch{}const store=q.createSaveStore({storage:persistent,key:'quest.v2.experimental'});
 const synthetic={schemaVersion:1,id:'S888',title:'New Engine Test Story',entry:'start',sceneOrder:['start','finish'],saveKeys:{visited:'boolean'},challenges:{hello:{goalJa:'「こんにちは」と英語で言おう',modelEn:'Hello',hints:['挨拶を言ってね','Hで始まる短い言葉','Hello'],rule:{accept:['hello','hi']}}},battles:{weather:{words:[{prompt:'晴れを表す英単語を言おう',answers:['sunny']}]}},documents:{letter:{title:'手紙',body:['Thank you for helping us!']}},scenes:{start:{steps:[{type:'line',speaker:'Pico',text:'Hello! Can you help me?'},{type:'challenge',id:'hello'},{type:'battle',id:'weather'},{type:'document',id:'letter'},{type:'goto',to:'finish'}]},finish:{steps:[{type:'setFlag',key:'visited',value:true},{type:'line',text:'You did it!'},{type:'end'}]}}};
 let runner;
 const button=(label,fn)=>{const el=document.createElement('button');el.textContent=label;el.onclick=fn;actions.append(el);return el;};
 const plain=(s)=>{const p=document.createElement('p');p.textContent=s;target.append(p);};
 const error=(err)=>{plain('エラー: '+String(err.message||err));appendLog({error:String(err)});};
 function appendLog(e){log.textContent+=JSON.stringify(e)+'\n';log.scrollTop=log.scrollHeight;}
 function showView(view){target.replaceChildren();const wrap=document.createElement('div');wrap.className='layout-'+view.layoutMode;target.append(wrap);const goal=document.createElement('div');goal.className='goal';goal.textContent=view.goalJa;wrap.append(goal);if(view.recognizedText)plain('認識: '+view.recognizedText);if(view.feedbackJa)plain(view.feedbackJa);if(view.supportText){const help=document.createElement('div');help.className='hint';help.textContent='ピコ: '+view.supportText;wrap.append(help);}}
 async function next(){try{const event=await runner.advance();render(event);}catch(e){error(e);}}
 async function trySpeech(){try{const result=await runner.talk();render(result);}catch(e){error(e);}}
 function render(event){appendLog(event);const state=runner.state();stat.textContent='Scene: '+state.scene+' / Status: '+state.status+' / Speech: '+(speech.isSupported()?'ブラウザ対応':'ブラウザ非対応');actions.replaceChildren();target.replaceChildren();
  if(event.type==='line'){plain((event.speaker?event.speaker+': ':'')+event.text);button('次へ',next);}
  else if(event.type==='challenge'||event.type==='hint'||['no-speech','rejected','unknown'].includes(event.type)){showView(event.view);button('話す',trySpeech);button('ピコサポート',()=>{try{render(runner.support());}catch(e){error(e);}});button('冒険に戻る',()=>render(runner.returnToAdventure()));}
  else if(event.type==='battle'){plain(event.view.prompt);button('英単語を話す',trySpeech);button('冒険に戻る',()=>render(runner.returnToAdventure()));}
  else if(event.type==='document'){plain(event.content.title);for(const line of event.content.body)plain(line);button('読み終わった',()=>{runner.documentDone();next();});}
  else if(event.type==='end'){plain('テスト冒険クリア！');plain(JSON.stringify(event.flags));}
  else if(event.type==='return'){plain('冒険を中断しました（テスト用）。');}
  else if(event.type==='accepted'||event.type==='complete'||event.type==='document-complete'){plain('成功しました。');button('次へ',next);}
  else if(event.type==='stale'){plain('古い音声結果を破棄しました');}
 }
 function start(resume){try{const prior=resume?store.read():null;runner=q.createRunner(synthetic,{recognize:speech.recognize,cancelSpeech:speech.cancel,storage:store,initialSnapshot:prior||undefined});log.textContent='';target.replaceChildren();actions.replaceChildren();next();}catch(e){error(e);}}
 document.getElementById('restart').onclick=()=>{store.clear();start(false);};document.getElementById('resume').onclick=()=>start(true);start(false);
})();

