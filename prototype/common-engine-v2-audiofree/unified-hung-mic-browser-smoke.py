"""Regression: Pico Support remains usable while mobile SpeechRecognition never ends.
Mocks a recognizer whose start() never fires result/end and abort() does nothing,
checks no lost questions, 0/1/2/3 Support levels and adventure return on S005-S007.
This does not claim actual iPhone hardware testing.
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
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  try: browser=pw.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(x) for x in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(x)),None)
   if not chrome:raise RuntimeError('Chromium unavailable')
   browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  for story in ('S005','S006','S007'):
   data=json.loads((HERE/'stories'/story/'story.json').read_text(encoding='utf8'))
   first=next(s['id'] for scene in data['sceneOrder'] for s in data['scenes'][scene]['steps'] if s['type']=='challenge')
   hint=data['challenges'][first]['hints']
   goal=data['challenges'][first]['goalJa']
   page=browser.new_page(viewport={'width':390,'height':844})
   page.add_init_script(script="""
window.__micStarted=0;window.__micAborted=0;
window.SpeechRecognition=class {
 start(){ window.__micStarted++; } // deliberately NO onresult/onend
 abort(){ window.__micAborted++; } // deliberately NO onend
};
""")
   page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story={story}')
   button=lambda name:page.get_by_role('button',name=name,exact=True)
   button('次へ').wait_for(timeout=15000)
   for _ in range(160):
    if button('話す').count(): break
    button('次へ').click()
   else:raise AssertionError(story+' did not reach question')
   assert page.locator('#text').inner_text()==goal
   button('話す').click()
   page.wait_for_function('()=>window.__micStarted===1')
   assert page.locator('#actions button').all_text_contents()==['聞き取りをやめる','ピコサポート','冒険に戻る']
   assert page.locator('#text').inner_text()==goal
   button('ピコサポート').click()
   assert page.locator('#actions button').all_text_contents()==['話す','ピコサポート','冒険に戻る']
   assert page.locator('#text').inner_text()==goal
   assert hint[0] in page.locator('#support').inner_text()
   assert page.locator('#dialogue').evaluate("el=>el.classList.contains('threeRow')"),story+' Support 1 must use 3-row mode'
   assert page.evaluate('window.__micAborted')==1
   assert not any('成功しました' in t for t in page.locator('#actions button').all_text_contents())
   for target in (2,3,3):
    button('ピコサポート').click()
    assert hint[target-1] in page.locator('#support').inner_text()
    assert page.locator('#dialogue').evaluate("el=>el.classList.contains('threeRow')"),story+' Support '+str(target)+' must stay 3-row'
   button('話す').click()
   page.wait_for_function('()=>window.__micStarted===2')
   assert button('冒険に戻る').is_visible()
   button('冒険に戻る').click()
   assert page.locator('#text').inner_text()=='冒険に戻りました。'
   assert page.evaluate('window.__micAborted')==2
   assert button('冒険を再開').is_visible()
   assert not page.locator('#log').text_content().count('NOT_READY')
   page.close()
   print(story+' HUNG_MIC_PICO_SUPPORT_AND_RETURN_PASS',flush=True)
  browser.close()
finally:
 server.shutdown()
 server.server_close()
