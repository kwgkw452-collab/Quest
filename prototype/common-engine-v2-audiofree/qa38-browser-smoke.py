"""QA38 focused real Chromium test with a controllable mock SpeechRecognition.
Production, Audio and iPhone hardware are not exercised.
"""
import functools
import http.server
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
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome:raise
   browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844})
  context.add_init_script(script="""
window.__qa38Speech=[];
window.SpeechRecognition=class {
 start(){
  const text=window.__qa38Speech.shift();
  queueMicrotask(()=>{
   this.onresult?.({results:[[{transcript:text}]],resultIndex:0});
   this.onend?.();
  });
 }
 abort(){this.onend?.();}
};
""")
  page=context.new_page()
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/play.html?story=S006',wait_until='load')
  button=lambda label:page.get_by_role('button',name=label,exact=True)
  button('次へ').wait_for(timeout=15000)
  for _ in range(100):
   if button('話す').count():break
   button('次へ').click()
  else:raise AssertionError('Q1 challenge not reached')
  goal=page.locator('#text').inner_text()
  assert goal=='お手伝いしましょうか？',goal
  button('ピコサポート').click()
  hint=page.locator('#support').inner_text()
  assert 'ピコ' in hint and goal==page.locator('#text').inner_text()
  def speech(phrase,expected):
   page.evaluate('(text)=>window.__qa38Speech.push(text)',phrase)
   button('話す').click()
   if expected=='accepted':
    button('次へ').wait_for(timeout=10000)
    assert '成功' in page.locator('#support').inner_text()
   else:
    button('話す').wait_for(timeout=10000)
    assert goal==page.locator('#text').inner_text()
    assert 'もう一度' in page.locator('#support').inner_text()
    log=page.locator('#log').inner_text()
    assert '"type":"'+expected+'"' in log,log[-700:]
   assert not errors,errors
  speech('Can we','unknown')
  speech('I cannot help you','rejected')
  speech('Can we help you?','accepted')
  button('次へ').click()
  for _ in range(100):
   if button('話す').count():break
   button('次へ').click()
  else:raise AssertionError('Q2 challenge not reached')
  goal=page.locator('#text').inner_text()
  assert goal=='その箱は何色ですか？',goal
  speech('What color is another box?','rejected')
  speech('What color','unknown')
  speech('What color is the book?','accepted')
  assert not errors,errors
  print('QA38 CHROMIUM PASS: S006 Q1/Q2 ACCEPT REJECT UNKNOWN, Goal, Pico hint, retry and ASR alias',flush=True)
  context.close()
  browser.close()
finally:
 server.shutdown()
 server.server_close()
