import json, pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).parent/'prototype/common-engine-v2-audiofree'
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/workspace/scratch/8cae5b43d4b1/qa40-chrome/chrome-headless-shell-linux64/chrome-headless-shell',args=['--no-sandbox'])
 for width in [320,390,844,1280]:
  ctx=b.new_context(viewport={'width':width,'height':720})
  for sid in ['S005','S006','S007']:
   pack=json.loads((root/f'stories/{sid}/story.json').read_text())
   for scene,v in pack['scenes'].items():
    for idx,s in enumerate(v['steps']):
     if s['type']!='challenge': continue
     q=pack['challenges'][s['id']]
     page=ctx.new_page()
     snap={'schemaVersion':1,'storyId':sid,'scene':scene,'index':idx,'status':'READY','flags':{}}
     page.add_init_script('localStorage.clear();localStorage.setItem('+json.dumps('quest.v2.test.'+sid)+','+json.dumps(json.dumps(snap))+');window.SpeechRecognition=class {start(){window.rec=this;} abort(){} };')
     page.goto('http://127.0.0.1:8765/prototype/common-engine-v2-audiofree/unified.html?story='+sid)
     page.locator('#actions button').first.wait_for()
     def geom():
      return page.evaluate("""()=>{let d=document.querySelector('#dialogue'),g=document.querySelector('.game'),t=document.querySelector('#text'),s=document.querySelector('#support'),a=document.querySelector('#actions');return {height:d.offsetHeight/(g.clientWidth/1560),mode:d.className,goal:t.textContent,hint:s.textContent,overflow:[t,s,a].map(x=>[x.scrollWidth>x.clientWidth+1,x.scrollHeight>x.clientHeight+1]),rows:[t,s,a].map(x=>x.getBoundingClientRect().top),font:getComputedStyle(s).fontSize}}""")
     row={'width':width,'id':s['id'],'initial':geom(),'stages':[]}
     page.get_by_role('button',name='話す',exact=True).click()
     page.get_by_role('button',name='ピコサポート',exact=True).click()
     for n in range(4):
      if n: page.get_by_role('button',name='ピコサポート',exact=True).click()
      row['stages'].append(geom())
     page.get_by_role('button',name='話す',exact=True).click()
     page.evaluate("""()=>{let r=window.rec;r.onresult({results:[[{transcript:'xyzzy'}]]});r.onend()}""")
     page.wait_for_function("document.querySelector('#support').textContent.includes('と聞こえたよ')")
     row['feedback']=geom()
     page.get_by_role('button',name='話す',exact=True).click()
     page.evaluate("(answer)=>{let r=window.rec;r.onresult({results:[[{transcript:answer}]]});r.onend()}",q['modelEn'])
     page.wait_for_timeout(80)
     row['after']=geom()
     row['accepted']='"type":"accepted"' in page.locator('#log').text_content()
     row['next']='"type":"line"' in page.locator('#log').text_content() or (page.locator('#dialogue').get_attribute('class')=='twoRow' and row['after']['goal']!=q['goalJa'])
     results.append(row)
     if len(results)%16==0: print('progress',len(results),flush=True)
     page.close()
  ctx.close()
 b.close()
(root.parent.parent/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
