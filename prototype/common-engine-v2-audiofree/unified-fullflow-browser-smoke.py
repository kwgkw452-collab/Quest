"""Unified browser E2E for actual migrated Story data; mocked microphone only.
No actual microphone, Voice, Audio playback or Production integration.
"""
import functools
import http.server
import json
import os
import threading
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as playwright:
  try:browser=playwright.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome:raise RuntimeError('Chromium not available')
   browser=playwright.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  for story_id in ('S005','S006'):
   pack=json.loads((HERE/'stories'/story_id/'story.json').read_text(encoding='utf8'))
   steps=[s for scene in pack['sceneOrder'] for s in pack['scenes'][scene]['steps']]
   ids=[s['id'] for s in steps if s['type']=='challenge']
   answers=[pack['challenges'][id]['modelEn'] for id in ids]
   errors=[]
   context=browser.new_context()
   context.add_init_script(script=f"""
window.__questAnswers={json.dumps(answers)};
window.SpeechRecognition=class {{
 start(){{const text=window.__questAnswers.shift();queueMicrotask(()=>{{this.onresult?.({{results:[ [ {{ transcript:text }} ] ],resultIndex:0}});this.onend?.();}});}}
 abort(){{this.onend?.();}}
}};
""")
   page=context.new_page()
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story={story_id}',wait_until='load')
   page.get_by_role('button',name='次へ').wait_for(timeout=15000)
   checked_translation=False
   for _ in range(400):
    if 'このStoryをクリアしました' in page.locator('#text').inner_text():break
    if 'エラー：' in page.locator('#text').inner_text():raise AssertionError(story_id+' '+page.locator('#text').inner_text())
    buttons=page.locator('#actions button').all_text_contents()
    if story_id=='S006' and not checked_translation and '日本語' in buttons:
     page.get_by_role('button',name='日本語').click()
     assert 'おじいちゃんへ' in page.locator('#support').inner_text(),'Japanese line of letter missing'
     page.get_by_role('button',name='English').click()
     assert 'Dear Grandpa' in page.locator('#support').inner_text(),'English line not restored'
     checked_translation=True
     buttons=page.locator('#actions button').all_text_contents()
    if '次へ' in buttons:action='次へ'
    elif '話す' in buttons:action='話す'
    elif '次の文' in buttons:action='次の文'
    elif '読み終えた' in buttons:action='読み終えた'
    else:raise AssertionError(story_id+' Unexpected buttons '+str(buttons))
    before=len([x for x in page.locator('#log').text_content().splitlines() if x])
    page.get_by_role('button',name=action).click()
    page.wait_for_function('(before)=>document.querySelector("#log").textContent.split("\\n").filter(Boolean).length>before',arg=before,timeout=12000)
   else:raise AssertionError(story_id+' STEP_LIMIT')
   events=[json.loads(x) for x in page.locator('#log').text_content().splitlines() if x.strip()]
   lines=sum(e.get('type')=='line' for e in events)
   questions=sum(e.get('type')=='challenge' for e in events)
   documents=sum(e.get('type')=='document' for e in events)
   assert lines==sum(s['type']=='line' for s in steps),(story_id,'lines',lines)
   assert questions==len(ids),(story_id,'questions',questions)
   assert documents==(1 if story_id=='S006' else 0),(story_id,'documents',documents)
   if story_id=='S006':
    assert sum(e.get('type')=='document-page' for e in events)==15,'letter must present all 16 lines'
    assert checked_translation,'translation toggle untested'
   assert not page.evaluate('window.__questAnswers.length'),story_id+' incomplete recognition'
   assert not errors,(story_id,errors)
   persisted=page.evaluate("(id)=>JSON.parse(localStorage.getItem('quest.v2.test.'+id))",story_id)
   assert persisted and persisted['status']=='READY' and persisted['storyId']==story_id,story_id+' READY checkpoint missing'
   assert persisted['scene']==pack['sceneOrder'][-1],story_id+' last scene was not checkpointed'
   page.reload(wait_until='load')
   page.wait_for_function("()=>document.querySelector('#status')?.textContent.includes('ENDED')",timeout=15000)
   assert 'このStoryをクリアしました' in page.locator('#text').inner_text(),story_id+' checkpoint replay failed'
   assert not errors,(story_id,errors)
   print(f'{story_id} SAVE RELOAD PASS: automatic last-scene checkpoint restores completed Story')
   print(f'{story_id} BROWSER PASS: {lines} dialogues, {questions} spoken challenges, {documents} document(s), all scenes complete')
   context.close()
  # Repro: old Story microphone result arrives after user has switched Stories.
  # The prior session must never paint into, or advance, the newly selected Story.
  race_context=browser.new_context()
  race_context.add_init_script(script="""
window.SpeechRecognition=class {
 start(){setTimeout(()=>{this.onresult?.({results:[[{transcript:'No, we do not.'}]],resultIndex:0});this.onend?.();},900);}
 abort(){/* deliberately deliver a late result to stress session isolation */}
};
""")
  race=race_context.new_page()
  race_errors=[]
  race.on('pageerror',lambda e:race_errors.append(str(e)))
  race.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story=S005',wait_until='load')
  race.get_by_role('button',name='次へ').wait_for(timeout=15000)
  for _ in range(80):
   choices=race.locator('#actions button').all_text_contents()
   if '話す' in choices:break
   assert '次へ' in choices,choices
   race.get_by_role('button',name='次へ').click()
  else:raise AssertionError('S005 did not reach first microphone question')
  race.get_by_role('button',name='話す').click()
  race.locator('#story-select').select_option('S006')
  race.wait_for_function("()=>document.querySelector('#status')?.textContent.includes('Scene: scene01 / READY')")
  race.wait_for_timeout(1400)
  assert race.locator('#story-select').input_value()=='S006'
  assert 'Scene: scene01 / READY' in race.locator('#status').inner_text(),race.locator('#status').inner_text()
  assert '成功しました' not in race.locator('#text').inner_text()
  assert not race_errors,race_errors
  print('SESSION SWITCH PASS: late old-Story microphone result cannot alter S006 screen')
  # Scene callbacks can also arrive from an abandoned runner, independently of talk()/advance().
  # Capture an old onEvent callback while creating a new S005 runner, then invoke it after switching to S006.
  race.evaluate("""() => {
    // This scenario needs the opening scene; the previous scenario saved S005 mid-story.
    localStorage.removeItem('quest.v2.test.S005');
    window.__oldStoryCallbacks=[];
    const original=window.QuestV2.createRunner;
    window.QuestV2.createRunner=function(data,options){
      window.__oldStoryCallbacks.push(options.onEvent);
      return original.call(this,data,options);
    };
  }""")
  race.locator('#story-select').select_option('S005')
  race.wait_for_function("()=>window.__oldStoryCallbacks.length===1 && document.querySelector('#status')?.textContent.includes('Scene: scene01 / READY')")
  race.locator('#story-select').select_option('S006')
  race.wait_for_function("()=>window.__oldStoryCallbacks.length===2 && document.querySelector('#status')?.textContent.includes('Scene: scene01 / READY')")
  before=race.locator('#backdrop').get_attribute('aria-label')
  race.evaluate("() => window.__oldStoryCallbacks[0]({type:'scene',asset:'images/005/stale.png'})")
  assert race.locator('#backdrop').get_attribute('aria-label')==before,'stale runner changed new Story backdrop'
  assert 'Scene: scene01 / READY' in race.locator('#status').inner_text()
  assert not race_errors,race_errors
  print('STALE SCENE CALLBACK PASS: old onEvent cannot overwrite current Story background')
  # Slow network must not leave old Story's buttons interactive or backdrop visible.
  # Hold the next S005 fetch without blocking browser UI, then release it.
  race.evaluate("""() => {
    const oldFetch=window.fetch.bind(window);
    window.__releaseStoryLoad=null;
    window.fetch=(url,...args)=>{
      if(String(url).includes('/stories/S005/story.json')){
        return new Promise(resolve=>{window.__releaseStoryLoad=()=>resolve(oldFetch(url,...args));});
      }
      return oldFetch(url,...args);
    };
  }""")
  race.locator('#story-select').select_option('S005')
  race.wait_for_function("()=>typeof window.__releaseStoryLoad==='function'")
  assert race.locator('#actions button').count()==0,'old Story actions remain clickable during load'
  assert 'Storyを読み込み中' in race.locator('#text').inner_text()
  assert 'LOADING' in race.locator('#status').inner_text()
  assert not race.locator('#backdrop').get_attribute('aria-label'),'old Story backdrop remains during load'
  race.evaluate("() => window.__releaseStoryLoad()")
  race.wait_for_function("()=>window.__oldStoryCallbacks.length===3 && document.querySelector('#status')?.textContent.includes('Scene: scene01 / READY')")
  assert race.get_by_role('button',name='次へ').count()==1
  assert not race_errors,race_errors
  print('LOADING GUARD PASS: Story controls are disabled while network request is pending')
  # A stale reference to the same "Next" button can be invoked twice in one JS turn.
  # Exactly one runner advance and UI event must result.
  count_before=len([line for line in race.locator('#log').text_content().splitlines() if line])
  race.evaluate("""() => {
    const nextButton=[...document.querySelectorAll('#actions button')].find(b=>b.textContent==='次へ');
    nextButton.click();
    nextButton.click();
  }""")
  race.wait_for_function("(n)=>document.querySelector('#log').textContent.split('\\n').filter(Boolean).length>n",arg=count_before)
  count_after=len([line for line in race.locator('#log').text_content().splitlines() if line])
  assert count_after==count_before+1,('double next advanced Story more than once',count_before,count_after)
  assert not race_errors,race_errors
  print('NEXT SINGLE-FLIGHT PASS: double click processes one Story advance')
  race_context.close()
  # Same control reference is programmatically activated twice before ASR resolves.
  mic_context=browser.new_context()
  mic_context.add_init_script(script="""
window.__speechStarts=0;
window.SpeechRecognition=class {
 start(){
  window.__speechStarts++;
  setTimeout(()=>{this.onresult?.({results:[[{transcript:'No, we do not.'}]],resultIndex:0});this.onend?.();},600);
 }
 abort(){this.onend?.();}
};
""")
  mic=mic_context.new_page()
  mic_errors=[]
  mic.on('pageerror',lambda e:mic_errors.append(str(e)))
  mic.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story=S005',wait_until='load')
  mic.get_by_role('button',name='次へ').wait_for(timeout=15000)
  for _ in range(80):
   choices=mic.locator('#actions button').all_text_contents()
   if '話す' in choices:break
   assert '次へ' in choices,choices
   mic.get_by_role('button',name='次へ').click()
  else:raise AssertionError('S005 did not reach speech test challenge')
  mic.evaluate("""() => {
    const button=[...document.querySelectorAll('#actions button')].find(b=>b.textContent==='話す');
    button.click();
    button.click();
  }""")
  mic.wait_for_function("()=>window.__speechStarts===1")
  mic.wait_for_timeout(900)
  assert mic.evaluate('window.__speechStarts')==1,'duplicate microphone recognition started'
  assert not mic_errors,mic_errors
  print('SPEECH SINGLE-FLIGHT PASS: double activation starts one recognition')
  # A temporary Story fetch error must not erase the already persisted checkpoint.
  checkpoint=mic.evaluate("()=>JSON.parse(localStorage.getItem('quest.v2.test.S005'))")
  assert checkpoint and checkpoint['storyId']=='S005','missing saved progress before retry'
  mic.evaluate("""() => {
    const original=window.fetch.bind(window);
    window.fetch=(url,...args)=>{
      if(String(url).includes('/stories/S005/story.json')){
        window.fetch=original;
        return Promise.resolve(new Response('',{status:503}));
      }
      return original(url,...args);
    };
  }""")
  mic.locator('#resume').click()
  mic.get_by_role('button',name='保存地点から再試行').wait_for(timeout=15000)
  assert mic.evaluate("()=>JSON.parse(localStorage.getItem('quest.v2.test.S005'))")==checkpoint,'checkpoint cleared on failed fetch'
  mic.get_by_role('button',name='保存地点から再試行').click()
  mic.wait_for_function("()=>document.querySelector('#status')?.textContent.includes('Scene:') && !document.querySelector('#status')?.textContent.includes('LOADING')")
  after=mic.evaluate("()=>JSON.parse(localStorage.getItem('quest.v2.test.S005'))")
  assert after and after['storyId']=='S005','checkpoint lost after retry'
  assert after['scene']==checkpoint['scene'],'retry unexpectedly restarted scene'
  assert after['index']>=checkpoint['index'],'retry rolled checkpoint backward'
  assert not mic_errors,mic_errors
  print('RETRY SAVE PASS: temporary fetch error preserves and resumes prior Story checkpoint')
  # A malformed package is a failed restart, so keep its prior save.
  mic.evaluate("""() => {
    const original=window.fetch.bind(window);
    window.fetch=(url,...args)=>{
      if(String(url).includes('/stories/S005/story.json')){
        window.fetch=original;
        return Promise.resolve(Response.json({id:'S005',schemaVersion:1}));
      }
      return original(url,...args);
    };
  }""")
  mic.locator('#restart').click()
  mic.get_by_role('button',name='保存地点から再試行').wait_for(timeout=15000)
  assert mic.evaluate("()=>JSON.parse(localStorage.getItem('quest.v2.test.S005'))")==after,'invalid restart erased checkpoint'
  assert not mic_errors,mic_errors
  print('RESTART SAVE PASS: invalid replacement package preserves prior checkpoint')
  mic_context.close()
  # QA35-02: hold each recognition open, then resolve it or let its real timer expire.
  goal_context=browser.new_context()
  goal_context.add_init_script(script="""
window.SpeechRecognition=class {
 start(){window.activeRecognition=this;}
 abort(){}
};
window.finishRecognition=(text)=>{
 const recognition=window.activeRecognition;
 recognition.onresult?.({results:[[{transcript:text}]],resultIndex:0});
 recognition.onend?.();
};
""")
  goal_page=goal_context.new_page()
  goal_page.clock.install()
  goal_page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story=S005')
  goal_page.get_by_role('button',name='次へ',exact=True).wait_for()
  # The same player must also resolve backgrounds with a plain local HTTP root.
  image_url=goal_page.locator('#backdrop').evaluate('node => node.style.backgroundImage.slice(5,-2)')
  image=goal_page.request.get(image_url)
  assert image.status==200 and image.body().startswith(b'\x89PNG'),image_url
  for _ in range(80):
   if goal_page.get_by_role('button',name='話す',exact=True).count():break
   goal_page.get_by_role('button',name='次へ',exact=True).click()
  else:raise AssertionError('S005 first question not reached')
  goal=goal_page.locator('#text').inner_text()
  assert goal=='いいえ、予約していません。',goal

  def begin_attempt():
   goal_page.get_by_role('button',name='話す',exact=True).click()
   assert goal_page.locator('#text').inner_text()==goal
   assert '聞き取り中…' in goal_page.locator('#support').inner_text()
   assert goal_page.locator('#actions input, #actions textarea').count()==0

  begin_attempt()
  goal_page.evaluate("window.finishRecognition('purple bananas')")
  goal_page.get_by_role('button',name='話す',exact=True).wait_for()
  assert goal_page.locator('#text').inner_text()==goal
  assert 'もう一度' in goal_page.locator('#support').inner_text()
  begin_attempt()
  goal_page.clock.fast_forward(12500)
  goal_page.get_by_role('button',name='話す',exact=True).wait_for()
  assert goal_page.locator('#text').inner_text()==goal
  assert '聞き取り時間' in goal_page.locator('#support').inner_text()
  begin_attempt()
  goal_page.evaluate("window.finishRecognition('No, we do not.')")
  goal_page.get_by_role('button',name='次へ',exact=True).wait_for()
  assert goal_page.locator('#text').inner_text()==goal
  assert '成功しました' in goal_page.locator('#support').inner_text()
  print('QA35-02 PASS: Goal persists through listening, rejection, timeout, retry and acceptance')
  goal_context.close()
  # QA36: measure the real player with the actual S006 package and a controllable microphone.
  dialogue_context=browser.new_context(viewport={'width':1280,'height':800})
  dialogue_context.add_init_script(script="""
window.SpeechRecognition=class {
 start(){window.activeRecognition=this;}
 abort(){}
};
window.finishRecognition=(text)=>{
 const recognition=window.activeRecognition;
 recognition.onresult?.({results:[[{transcript:text}]],resultIndex:0});
 recognition.onend?.();
};
""")
  s006=json.loads((HERE/'stories/S006/story.json').read_text(encoding='utf8'))
  q1=s006['challenges']['s006.communication.1']
  q2=s006['challenges']['s006.communication.2']
  evidence=os.environ.get('DIALOGUE_SCREENSHOTS')
  if evidence:
   evidence=Path(evidence)
   evidence.mkdir(parents=True,exist_ok=True)
  for width,height in ((1280,800),(844,390),(390,844),(320,568)):
   page=dialogue_context.new_page()
   page.set_viewport_size({'width':width,'height':height})
   page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story=S006')

   def button(label):
    return page.get_by_role('button',name=label,exact=True)

   def reach_question():
    for _ in range(80):
     if button('話す').count():
      return
     button('次へ').click()
    raise AssertionError('S006 question not reached')

   def measure(label,expected,goal,detail='',listening=False):
    assert page.locator('#text').inner_text()==goal
    assert detail in page.locator('#support').inner_text()
    actions=[] if listening else ['話す','ピコサポート','冒険に戻る']
    assert page.locator('#actions button').all_text_contents()==actions
    result=page.locator('#dialogue').evaluate("""async (dialogue, detail) => {
     const bounds = node => node.getBoundingClientRect().toJSON();
     const panel = bounds(dialogue);
     const game = bounds(dialogue.parentElement);
     const backdrop = document.querySelector('#backdrop');
     const background = bounds(backdrop);
     const style = getComputedStyle(dialogue);
     const backgroundStyle = getComputedStyle(backdrop);
     const image = new Image();
     image.src = JSON.parse(backgroundStyle.backgroundImage.slice(4, -1));
     await image.decode();
     const fit = backgroundStyle.backgroundSize === 'contain' ? Math.min : Math.max;
     const scale = fit(background.width / image.naturalWidth, background.height / image.naturalHeight);
     const crop = Math.max(0, (image.naturalWidth - background.width / scale) / 2);
     const goal = bounds(document.querySelector('#text'));
     const controls = [...dialogue.querySelectorAll('button')];
     const buttons = controls.map(bounds);
     const support = document.querySelector('#support');
     const panelContains = rect => rect.top >= panel.top && rect.bottom <= panel.bottom
       && rect.left >= panel.left && rect.right <= panel.right;
     let detailVisible = true;
     if (detail) {
       const start = support.textContent.indexOf(detail);
       const range = document.createRange();
       range.setStart(support.firstChild, start);
       range.setEnd(support.firstChild, start + detail.length);
       const rect = bounds(support);
       detailVisible = [...range.getClientRects()].every(part => part.top >= rect.top - 1
         && part.bottom <= rect.bottom + 1 && part.left >= rect.left && part.right <= rect.right + 1);
     }
     return {
       gameHeight: game.height,
       height: panel.height, css: style.height, min: style.minHeight, max: style.maxHeight,
       goalAndButtonsInside: [goal, ...buttons].every(panelContains),
       detailVisible, bottomInset: game.bottom - panel.bottom,
       background: [background.width, background.height], asset: backdrop.getAttribute('aria-label'),
       image: [image.naturalWidth, image.naturalHeight], horizontalCropEachSide: Math.round(crop),
       artworkHeight: image.naturalHeight * scale,
       verticalCrop: Math.max(0, image.naturalHeight - background.height / scale),
       backgroundEndsAtPanel: Math.abs(background.bottom - panel.top) < 0.02,
       documentFitsWidth: document.documentElement.scrollWidth <= window.innerWidth,
       canReachControls: buttons.every((rect, index) => {
         const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
         return rect.bottom <= window.innerHeight + 0.02 && rect.top >= 0 && controls[index].contains(hit);
       }),
       pageHeight: document.documentElement.scrollHeight,
       visibleAbovePanel: panel.top - background.top,
       backdropFillsStage: background.bottom === panel.bottom && background.top === game.top + 1,
       backgroundSize: backgroundStyle.backgroundSize, backgroundPosition: backgroundStyle.backgroundPosition,
     };
    }""",detail)
    assert abs(result['height']-expected)<=1/64,result
    assert abs(float(result['css'].removesuffix('px'))-expected)<=1/64,result
    assert result['min']==result['max']==f'{expected:g}px',result
    assert result['bottomInset']==1 and result['goalAndButtonsInside'] and result['detailVisible'],result
    assert result['documentFitsWidth'] and result['visibleAbovePanel']>0,result
    if width < height:
     assert result['backgroundSize']=='contain' and result['backgroundEndsAtPanel'],result
     assert result['horizontalCropEachSide']==0 and result['verticalCrop']<0.01,result
     assert result['artworkHeight'] >= 140 and result['canReachControls'],result
    else:
     assert result['backgroundSize']=='cover' and result['backdropFillsStage'],result
    assert result['backgroundPosition']=='50% 50%',result
    print(f'QA37-01 S006 {width}x{height} {label}: {json.dumps(result)}',flush=True)
    if evidence and label in ('initial','rejected','pico-press-2'):
     page.locator('.game').screenshot(path=evidence/f's006-{width}x{height}-{label}.png')

   reach_question()
   measure('initial',108,q1['goalJa'])
   button('話す').click()
   measure('listening',108,q1['goalJa'],'聞き取り中…',listening=True)
   page.evaluate("window.finishRecognition('purple bananas')")
   button('話す').wait_for()
   assert json.loads(page.locator('#log').text_content().splitlines()[-1])['type']=='unknown'  # QA38: unrelated ASR lacks enough evidence
   measure('rejected',108,q1['goalJa'],'認識：purple bananas')
   for press,stage in enumerate((1,2,3,3),start=1):
    button('ピコサポート').click()
    event=json.loads(page.locator('#log').text_content().splitlines()[-1])
    assert event['view']['supportStage']==stage,event
    measure(f'pico-press-{press}',140,q1['goalJa'],q1['hints'][stage-1])
   button('話す').click()
   measure('listening-with-pico',140,q1['goalJa'],q1['hints'][2],listening=True)
   page.evaluate('window.finishRecognition',q1['modelEn'])
   button('次へ').wait_for()
   assert page.locator('#support').inner_text()=='成功しました！'
   reach_question()
   measure('next-question',108,q2['goalJa'])
   assert not page.locator('#support').inner_text()
   button('冒険に戻る').click()
   assert page.locator('#text').inner_text()=='冒険に戻りました。'
   page.evaluate('localStorage.removeItem("quest.v2.test.S006")')
   page.close()
  for story_id in ('S005', 'S007'):
   page=dialogue_context.new_page()
   page.set_viewport_size({'width':320,'height':568})
   page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story={story_id}')
   for _ in range(120):
    if page.get_by_role('button',name='話す',exact=True).count():
     break
    page.get_by_role('button',name='次へ',exact=True).click()
   else:
    raise AssertionError(f'{story_id} first question not reached')
   page.get_by_role('button',name='ピコサポート',exact=True).click()
   assert page.locator('#text').inner_text()
   assert 'ピコ：' in page.locator('#support').inner_text()
   assert page.locator('#backdrop').evaluate("""backdrop => {
     const panel = document.querySelector('#dialogue');
     return getComputedStyle(backdrop).backgroundSize === 'contain'
       && Math.abs(backdrop.getBoundingClientRect().bottom - panel.getBoundingClientRect().top) < .02
       && panel.getBoundingClientRect().height === 140
       && document.documentElement.scrollWidth <= innerWidth;
   }""")
   if evidence:
    page.locator('.game').screenshot(path=evidence/f'{story_id.lower()}-320x568-pico.png')
   page.get_by_role('button',name='冒険に戻る',exact=True).click()
   print(f'{story_id} portrait Graphic and Pico controls PASS',flush=True)
   page.close()
  dialogue_context.close()
  browser.close()
finally:
 server.shutdown()
 server.server_close()
