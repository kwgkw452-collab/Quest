"""Synthetic Battle regression through the same unified UI; no real Story is modified."""
import functools,http.server,json,threading
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
fixture=json.loads((HERE/'fixture.json').read_text())
fixture['battles']['vocab']['words'].append({'prompt':'曇り','answers':['cloudy']})
try:
 with sync_playwright() as p:
  try:browser=p.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome:raise RuntimeError('Chromium unavailable')
   browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/stories/catalog.json',lambda r:r.fulfill(json={'stories':[{'id':fixture['id'],'path':'synthetic/story.json','status':'TEST_ONLY'}]}))
  page.route('**/stories/synthetic/story.json',lambda r:r.fulfill(json=fixture))
  page.add_init_script('window.__starts=0;window.SpeechRecognition=class{start(){window.__starts++;window.rec=this;}abort(){}};')
  page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html')
  b=lambda name:page.get_by_role('button',name=name,exact=True)
  def say(text):
   page.evaluate("(text)=>{const r=window.rec;r.onresult({results:[[{transcript:text}]]});r.onend()}",text)
  b('次へ').click();b('話す').click();say('hello');b('英単語を話す').wait_for()
  page.evaluate("()=>{const b=[...document.querySelectorAll('#actions button')].find(x=>x.textContent==='英単語を話す');b.click();b.click();}")
  assert page.evaluate('window.__starts')==2,'duplicate Battle recognition started'
  say('rainy');b('英単語を話す').wait_for();assert 'rainy' in page.locator('#support').inner_text()
  b('英単語を話す').click();say('sunny');b('英単語を話す').wait_for()
  assert page.locator('#text').inner_text()=='曇り','first correct word skipped Battle'
  assert not b('ピコサポート').count(),'Communication Support leaked into Battle'
  b('英単語を話す').click();say('cloudy');b('読み終えた').wait_for()
  b('読み終えた').click();b('次へ').wait_for()
  saved=page.evaluate("(id)=>JSON.parse(localStorage.getItem('quest.v2.test.'+id))",fixture['id'])
  assert saved['flags']['found'] is True and saved['status']=='READY'
  b('次へ').click();assert 'このStoryをクリアしました' in page.locator('#text').inner_text()
  assert not errors,errors
  browser.close()
finally:server.shutdown();server.server_close()
print('UNIFIED_SYNTHETIC_BATTLE_PASS: duplicate activation, wrong word, two accepted words, document, Save, Story progression')
