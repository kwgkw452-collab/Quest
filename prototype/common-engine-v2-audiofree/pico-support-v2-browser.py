"""PICO-01..03 + 32 questions x 4 widths, using independent QA's cursor/mic/geometry reproduction.
Adapted from immutable QA check.py/targeted.py at 509de4d; no real microphone or audio.
"""
import functools
import http.server
import json
import os
from pathlib import Path
from shutil import which
import threading
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=Path(os.environ.get('PICO_EVIDENCE','/tmp/quest-pico-v2-browser'))
OUT.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
rows=[]
try:
 with sync_playwright() as p:
  try:browser=p.chromium.launch(headless=True)
  except Exception:
   chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
   if not chrome:raise RuntimeError('Chromium unavailable')
   browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
  for width in (320,390,844,1280):
   context=browser.new_context(viewport={'width':width,'height':720})
   for sid in ('S005','S006','S007'):
    pack=json.loads((HERE/'stories'/sid/'story.json').read_text())
    for scene,part in pack['scenes'].items():
     for index,step in enumerate(part['steps']):
      if step['type']!='challenge':continue
      q=pack['challenges'][step['id']]
      traced=width==390 and step['id']=='s005.communication.10'
      if traced:context.tracing.start(screenshots=True,snapshots=True,sources=True)
      page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
      snapshot={'schemaVersion':1,'storyId':sid,'scene':scene,'index':index,'status':'READY','flags':{}}
      page.add_init_script('localStorage.clear();localStorage.setItem('+json.dumps('quest.v2.test.'+sid)+','+json.dumps(json.dumps(snapshot))+''');
window.__recognizers=[];
window.SpeechRecognition=class { start(){window.rec=this;window.__recognizers.push(this);} abort(){} };
''')
      page.goto(f'http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/unified.html?story={sid}')
      button=lambda name:page.get_by_role('button',name=name,exact=True)
      button('話す').wait_for()
      def geom():
       return page.evaluate('''()=>{
        const d=document.querySelector('#dialogue'),g=document.querySelector('.game'),t=document.querySelector('#text'),s=document.querySelector('#support'),a=document.querySelector('#actions');
        const r=x=>x.getBoundingClientRect(),buttons=[...a.children].map(r);
        return {height:r(d).height/(g.clientWidth/1560),mode:d.className,goal:t.textContent,hint:s.textContent,
         overflow:[t,s,a].map(x=>[x.scrollWidth>x.clientWidth+1,x.scrollHeight>x.clientHeight+1]),
         rows:[t,s,a].map(x=>({top:r(x).top,bottom:r(x).bottom})),
         oneRow:buttons.every(x=>Math.abs(x.top-buttons[0].top)<1),
         horizontal:document.documentElement.scrollWidth<=innerWidth,
         goalColor:getComputedStyle(t).color,supportColor:getComputedStyle(s).color};
       }''')
      def check(height,hint=None):
       v=geom();assert abs(v['height']-height)<1.7,(step['id'],width,height,v)
       assert v['goalColor']=='rgb(245, 248, 255)' and v['supportColor']=='rgb(255, 223, 145)',v
       assert v['goal']==q['goalJa'] and v['oneRow'] and v['horizontal'],(step['id'],width,v)
       assert not any(any(pair) for pair in v['overflow']),(step['id'],width,'internal overflow',v)
       if hint is not None:
        assert v['hint']==hint,(step['id'],width,hint,v)
        assert v['rows'][0]['bottom']<=v['rows'][1]['top']+1 and v['rows'][1]['bottom']<=v['rows'][2]['top']+1,(step['id'],width,'row overlap',v)
       return v
      initial=check(108)
      button('話す').click();assert page.locator('#actions button').all_text_contents()==['聞き取りをやめる','ピコサポート','冒険に戻る']
      # The old callback is retained on purpose to simulate a browser invoking it after abort.
      page.evaluate('()=>{window.__lateResult=window.rec.onresult;window.__lateEnd=window.rec.onend;}')
      button('聞き取りをやめる').click();check(108)
      page.evaluate("()=>{window.__lateResult({results:[[{transcript:'stale old phrase'}]]});window.__lateEnd()}")
      check(108);assert button('話す').is_visible()
      button('話す').click()
      page.evaluate("()=>{const r=window.rec;r.onresult({results:[[{transcript:'xyzzy'}]]});r.onend()}")
      page.wait_for_function("document.querySelector('#support').textContent.includes('xyzzy と聞こえたよ')")
      feedback=check(140)
      stages=[]
      for stage in (1,2,3,3):
       button('ピコサポート').click();stages.append(check(140,'ピコ：'+q['hints'][stage-1]))
      if step['id']=='s005.communication.10':page.locator('.game').screenshot(path=str(OUT/f'S005-Q10-stage3-{width}.png'))
      # Retry while support is open, then Pico while recognition hangs; support stays at3.
      button('話す').click();button('ピコサポート').click();check(140,'ピコ：'+q['hints'][2])
      button('話す').click()
      page.evaluate("(answer)=>{const r=window.rec;r.onresult({results:[[{transcript:answer}]]});r.onend()}",q['modelEn'])
      page.wait_for_function("document.querySelector('#log').textContent.includes('\"type\":\"accepted\"')")
      page.wait_for_function("()=>!document.querySelector('#actions').textContent.includes('聞き取りをやめる')")
      events=[json.loads(x) for x in page.locator('#log').text_content().splitlines() if x.strip()]
      accepted=next(i for i,e in enumerate(events) if e.get('type')=='accepted')
      assert len(events)>accepted+1,(step['id'],'did not auto advance')
      after=events[accepted+1]
      assert after['type'] in ('line','challenge','document','end'),(step['id'],after)
      assert '成功しました！' not in page.locator('#text').inner_text()
      if after['type']=='challenge':
       assert after['view']['supportStage']==0 and after['view']['displayMode']=='normal'
       assert page.locator('#support').inner_text()==''
      assert not errors,(step['id'],errors)
      rows.append({'width':width,'id':step['id'],'initial':initial,'feedback':feedback,'stages':stages,'after':after['type'],'status':'PASS'})
      page.close()
      if traced:context.tracing.stop(path=str(OUT/'pico-support-390-trace.zip'))
   context.close();print('PICO_MATRIX_WIDTH_PASS',width,len(rows),flush=True)
  browser.close()
finally:
 server.shutdown();server.server_close()
 (OUT/'matrix.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
assert len(rows)==128,len(rows)
print('PICO_MATRIX_PASS: 32 questions x 4 widths; wrong->Support 1/2/3/3, stop, retry, stale callbacks, exact authored text, no overflow, next-step/reset')
