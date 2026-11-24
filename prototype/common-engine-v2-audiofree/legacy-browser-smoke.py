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
   for _ in range(400):
    if 'このStoryをクリアしました' in page.locator('#text').inner_text():break
    if 'エラー：' in page.locator('#text').inner_text():raise AssertionError(story_id+' '+page.locator('#text').inner_text())
    buttons=page.locator('#actions button').all_text_contents()
    if '次へ' in buttons:action='次へ'
    elif '話す' in buttons:action='話す'
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
   assert not page.evaluate('window.__questAnswers.length'),story_id+' incomplete recognition'
   assert not errors,(story_id,errors)
   print(f'{story_id} BROWSER PASS: {lines} dialogues, {questions} spoken challenges, {documents} document(s), all scenes complete')
   context.close()
  browser.close()
finally:
 server.shutdown()
 server.server_close()
