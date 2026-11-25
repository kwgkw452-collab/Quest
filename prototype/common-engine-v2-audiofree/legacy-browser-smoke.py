"""Browser E2E for actual migrated Story data; mocked microphone only.
No actual microphone, Voice, Audio playback or Production integration.
"""
import functools
import http.server
import json
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
   page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/play.html?story={story_id}',wait_until='load')
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
  race.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/play.html?story=S005',wait_until='load')
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
  count_before=len([line for line in race.locator('#log').inner_text().splitlines() if line])
  race.evaluate("""() => {
    const nextButton=[...document.querySelectorAll('#actions button')].find(b=>b.textContent==='次へ');
    nextButton.click();
    nextButton.click();
  }""")
  race.wait_for_function("(n)=>document.querySelector('#log').textContent.split('\\n').filter(Boolean).length>n",arg=count_before)
  count_after=len([line for line in race.locator('#log').inner_text().splitlines() if line])
  assert count_after==count_before+1,('double next advanced Story more than once',count_before,count_after)
  assert not race_errors,race_errors
  print('NEXT SINGLE-FLIGHT PASS: double click processes one Story advance')
  race_context.close()
  browser.close()
finally:
 server.shutdown()
 server.server_close()
