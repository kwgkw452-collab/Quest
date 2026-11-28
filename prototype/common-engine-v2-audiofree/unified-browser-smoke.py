"""Four-story unified UI acceptance, using the same V2 runner and no live audio."""
import functools,http.server,threading
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  try:browser=p.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome:raise RuntimeError('Chromium unavailable')
   browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  for story in ('S005','S006','S007'):
   for width,height in ((390,844),(320,568),(844,390),(1280,800)):
    page=browser.new_page(viewport={'width':width,'height':height})
    page.add_init_script("""window.SpeechRecognition=class {
      start(){queueMicrotask(()=>{this.onresult?.({results:[[{transcript:'unrelated words'}]],resultIndex:0});this.onend?.();});}
      abort(){this.onend?.();}
    };""")
    page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story={story}')
    page.get_by_role('button',name='ピコサポート').wait_for(timeout=12000)
    geometry=lambda:page.evaluate("""() => {
      const root=document.querySelector('.game').getBoundingClientRect();
      const dialog=document.querySelector('#dialogue').getBoundingClientRect();
      const controls=[...document.querySelectorAll('#actions button')].map(e=>e.getBoundingClientRect());
      return {refHeight:dialog.height/root.width*1560, panelBottom:dialog.bottom-root.bottom,
       leftAligned:controls.length===0||Math.abs(controls[0].left-dialog.left-(16/1560*root.width))<=3,
       oneRow:controls.every(b=>Math.abs(b.top-controls[0].top)<1),
       compact:controls.every(b=>b.width<root.width*.6),
       stageRatio:root.width/root.height};
    }""")
    def check(ref):
     g=geometry()
     assert abs(g['refHeight']-ref)<1.5,(story,width,ref,g)
     assert abs(g['panelBottom'])<2,(story,width,g)
     assert g['leftAligned'] and g['oneRow'] and g['compact'],(story,width,g)
     assert abs(g['stageRatio']-13/6)<.06,(story,width,g)
    assert page.locator('#actions button').all_text_contents()==['次へ','ピコサポート']
    assert page.locator('#support').inner_text()==''
    check(108)
    page.get_by_role('button',name='ピコサポート').click()
    assert page.locator('#actions button').all_text_contents()==['次へ','英文を見る','日本語を見る','もう一度聞く']
    check(108)
    assert page.get_by_role('button',name='もう一度聞く').is_disabled()
    assert page.locator('#support').inner_text()==''
    for _ in range(130):
     controls=page.locator('#actions button').all_text_contents()
     if '話す' in controls:break
     assert '次へ' in controls,(story,width,controls)
     page.get_by_role('button',name='次へ').click()
    else:raise AssertionError(story+' challenge not reached')
    assert page.locator('#actions button').all_text_contents()==['話す','ピコサポート','冒険に戻る']
    check(108)
    page.get_by_role('button',name='ピコサポート').click()
    assert 'How would you say this in English?' in page.locator('#support').inner_text()
    check(108)
    page.get_by_role('button',name='話す').click()
    page.wait_for_function("()=>document.querySelector('#support')?.textContent.includes('と聞こえたよ')",timeout=10000)
    check(140)
    page.close()
  browser.close()
finally:
 server.shutdown()
print('UNIFIED_UI_PASS: 3 migrated Stories x 4 sizes, 108/140 scaled heights, left 2/3/4 controls, Pico, feedback')
