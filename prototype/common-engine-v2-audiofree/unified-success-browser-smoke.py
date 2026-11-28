"""CI regression for Director-reported successful speech feedback alignment.
Checks left-aligned accepted Communication in S005/S006/S007 on actual unified UI,
with mocked speech recognition, without touching Production, Audio or Voice.
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
 with sync_playwright() as p:
  try: browser=p.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome: raise RuntimeError('Chromium unavailable')
   browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  for story in ('S005','S006','S007'):
   data=json.loads((HERE/'stories'/story/'story.json').read_text(encoding='utf8'))
   first=next(s['id'] for scene in data['sceneOrder'] for s in data['scenes'][scene]['steps'] if s['type']=='challenge')
   answer=data['challenges'][first]['modelEn']
   for width,height in ((390,844),(844,390)):
    page=browser.new_page(viewport={'width':width,'height':height})
    page.add_init_script(script=f"""
window.SpeechRecognition=class {{
 start(){{queueMicrotask(()=>{{this.onresult?.({{results:[ [ {{transcript:{json.dumps(answer)} }} ] ],resultIndex:0}});this.onend?.();}});}}
 abort(){{this.onend?.();}}
}};
""")
    page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story={story}')
    page.get_by_role('button',name='次へ',exact=True).wait_for(timeout=15000)
    for _ in range(160):
     if page.get_by_role('button',name='話す',exact=True).count():break
     page.get_by_role('button',name='次へ',exact=True).click()
    else:raise AssertionError(story+' never reached challenge')
    page.get_by_role('button',name='話す',exact=True).click()
    page.get_by_role('button',name='次へ',exact=True).wait_for(timeout=10000)
    assert page.locator('#text').inner_text()=='成功しました！',(story,width,'missing success text')
    assert page.locator('#dialogue').evaluate("(el)=>el.classList.contains('successFeedback')"),(story,width,'not success mode')
    assert page.locator('#actions button').all_text_contents()==['次へ'],(story,width,'button list changed')
    geo=page.evaluate("""() => {
      const r=el=>el.getBoundingClientRect();
      const root=r(document.querySelector('.game')),text=r(document.querySelector('#text'));
      const panel=r(document.querySelector('#dialogue')),button=r(document.querySelector('#actions button'));
      return {stageH:panel.height/root.width*1560,leftInset:text.left-panel.left,
        align:getComputedStyle(document.querySelector('#text')).textAlign,
        buttonLeft:button.left-panel.left};
    }""")
    assert abs(geo['stageH']-108)<2,(story,width,geo)
    assert geo['leftInset']>0 and geo['leftInset']<20 and geo['align']=='left',(story,width,geo)
    assert geo['buttonLeft']<20,(story,width,geo)
    page.close()
   print(story+' success left alignment PASS')
  browser.close()
finally:
 server.shutdown()
 server.server_close()
