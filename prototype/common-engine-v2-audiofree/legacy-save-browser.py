"""Exercise a real browser's legacy checkpoint import, reload and Story isolation."""
import functools
import http.server
import json
import threading
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  try: browser=pw.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome: raise
   browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  for story in ('S005','S006','S007'):
   pack=json.loads((HERE/'stories'/story/'story.json').read_text())
   mapping=json.loads((HERE/'stories'/story/'legacy-cursors.json').read_text())['cursors']
   candidates=[(i,c) for i,c in enumerate(mapping) if i>1 and c['scene']!='scene01']
   index,cursor=next((i,c) for i,c in candidates if any(step['type']=='line' for step in pack['scenes'][c['scene']]['steps'][c['index']:]))
   first_index=next(i for i,step in enumerate(pack['scenes'][cursor['scene']]['steps']) if i>=cursor['index'] and step['type']=='line')
   assert all(step['type'] in ('scene','clear','hideDialogue') for step in pack['scenes'][cursor['scene']]['steps'][cursor['index']:first_index])
   expected=pack['scenes'][cursor['scene']]['steps'][first_index]
   fixture={'saveVersion':1,'player':{'name':'QA'},'progress':{'currentStoryId':story,'currentStepIndex':index,'completedStories':['S004']},'flags':{'unrelated':True},'party':{'companionIds':[1,2]},'inventory':{'test':2},'bestiary':{},'storyState':{story:{'marker':'old'}}}
   raw=json.dumps(fixture)
   context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
   context.add_init_script(script=f"if(!localStorage.getItem('eigo-de-quest:save:v2'))localStorage.setItem('eigo-de-quest:save:v2',{json.dumps(raw)});")
   page=context.new_page()
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/play.html?story={story}')
   page.get_by_role('button',name='次へ').wait_for(timeout=15000)
   assert expected['text'] in page.locator('#text').inner_text(),(story,cursor,page.locator('#text').inner_text())
   assert cursor['scene'] in page.locator('#status').inner_text()
   assert page.locator('#backdrop').get_attribute('aria-label')
   saved=page.evaluate("(id)=>JSON.parse(localStorage.getItem('quest.v2.test.'+id))",story)
   assert saved['scene']==cursor['scene'] and saved['index']==first_index+1
   page.reload()
   page.wait_for_function("()=>document.querySelector('#status')?.textContent.startsWith('Scene:')")
   assert page.evaluate("()=>localStorage.getItem('eigo-de-quest:save:v2')")==raw
   other='S006' if story=='S005' else 'S005'
   page.locator('#story-select').select_option(other)
   page.wait_for_function("()=>document.querySelector('#status')?.textContent.includes('scene01 / READY')")
   assert page.evaluate("()=>localStorage.getItem('eigo-de-quest:save:v2')")==raw
   assert not errors,errors
   print(f'{story} LEGACY BROWSER PASS: cursor {index} -> {cursor}, reload, switch, original bytes preserved',flush=True)
   context.close()
  browser.close()
finally:
 server.shutdown()
 server.server_close()
