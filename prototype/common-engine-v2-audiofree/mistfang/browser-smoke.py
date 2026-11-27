"""Mistfang 10-word, four-stage isolated Chromium smoke test with mock SpeechRecognition."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from contextlib import contextmanager
import os

ROOT = Path(__file__).resolve().parents[3]
WORDS = ['snow','snowy','mist','misty','storm','stormy','thunder','lightning','fine','frosty']
STAGES = [0,0,0,1,1,1,2,2,2,2,3]

@contextmanager
def server():
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs):
            super().__init__(*args,directory=str(ROOT),**kwargs)
        def log_message(self,*args): pass
    s=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    t=Thread(target=s.serve_forever,daemon=True);t.start()
    try: yield s.server_address[1]
    finally: s.shutdown();s.server_close();t.join()

with server() as port,sync_playwright() as p:
    from shutil import which
    chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
    browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox']) if chrome else p.chromium.launch(headless=True)
    ctx=browser.new_context(viewport={'width':780,'height':540})
    ctx.add_init_script("""window.__mistfangAnswers=['banana','snow','snowy','mist','misty','storm','stormy','thunder','lightning','fine','frosty'];
window.SpeechRecognition=class {
 start(){
   const value=window.__mistfangAnswers.shift();
   queueMicrotask(()=>{this.onresult?.({resultIndex:0,results:[[{transcript:value}]]});this.onend?.();});
 }
 abort(){this.onend?.();}
};
""")
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{port}/prototype/common-engine-v2-audiofree/mistfang/index.html')
    page.wait_for_function("() => document.getElementById('graphic').naturalWidth===1560")
    def verify(stage):
        page.wait_for_function("(s) => document.querySelector('#graphic').dataset.stage===String(s)",arg=stage)
        assert page.locator('#graphic').evaluate("(img)=>img.complete && img.naturalWidth===1560 && img.naturalHeight===720")
        assert page.locator('#stage').inner_text().endswith(f'{stage+1} / 4')
    verify(0)
    page.get_by_role('button',name='英単語を話す').click()
    page.wait_for_function("() => JSON.parse(document.querySelector('#debug').textContent).type==='rejected'")
    verify(0)
    for i,word in enumerate(WORDS):
        page.get_by_role('button',name='英単語を話す').click()
        page.wait_for_function("(n) => {const d=document.querySelector('#debug').textContent;try{return JSON.parse(d).index===n}catch{return false}}",arg=i+1)
        verify(STAGES[i+1])
    assert '霧が晴れました' in page.locator('#message').inner_text()
    assert page.get_by_role('button',name='英単語を話す').is_disabled()
    assert not errors,errors
    assert page.locator('#graphic').evaluate("(img)=>img.getAttribute('src')").endswith('mistfang_stage_3.png')
    print('MISTFANG BROWSER PASS: 10 correct + 1 incorrect, all four 1560x720 graphics, complete')
    browser.close()
