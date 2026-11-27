"""Director-LOCK dialogue/Pico layout contract in a real Chromium viewport.
Visual/control regression only; no Audio/Voice modification or playback certification.
"""
import functools
import http.server
import threading
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()

def height(page):
 return page.locator('#dialogue').evaluate('(el)=>el.getBoundingClientRect().height')

try:
 with sync_playwright() as p:
  try:browser=p.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome:raise RuntimeError('Chromium not available')
   browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  for width,height_px in [(390,844),(320,568),(844,390),(1280,800)]:
   for story_id in ('S005','S006','S007'):
    page=browser.new_page(viewport={'width':width,'height':height_px})
    page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/play.html?story={story_id}')
    page.get_by_role('button',name='ピコサポート').wait_for(timeout=20000)
    assert height(page)==108,(story_id,width,height(page))
    assert page.locator('#actions button').all_text_contents()==['次へ','ピコサポート']
    assert page.locator('#support').inner_text()=='','Translation must not be revealed without request'
    page.get_by_role('button',name='ピコサポート').click()
    assert height(page)==140,(story_id,width,height(page))
    assert page.locator('#actions button').all_text_contents()==['次へ','英文を見る','日本語を見る','もう一度聞く']
    assert page.locator('#support').inner_text().startswith('ピコサポート')
    replay=page.get_by_role('button',name='もう一度聞く',exact=False)
    assert replay.is_disabled(),'Replay must stay off while Audio/Voice are frozen'
    page.get_by_role('button',name='日本語を見る').click()
    assert page.locator('#support').inner_text(),'Japanese must be shown explicitly'
    page.get_by_role('button',name='英文を見る').click()
    assert page.locator('#support').inner_text(),'English must be shown explicitly'
    assert height(page)==140
    assert page.locator('#dialogue').evaluate('el=>el.scrollHeight <= el.clientHeight+1'),'Panel exceeded 140px'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Horizontal overflow'
    page.get_by_role('button',name='次へ').click()
    page.locator('#text').wait_for()
    page.close()
  browser.close()
finally:
 server.shutdown()
print('PICO_DIALOGUE_LAYOUT_PASS: 108/140, 2/4 controls, explicit translation, 3 Stories x 4 viewports')
