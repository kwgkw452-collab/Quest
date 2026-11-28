import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).parent/'prototype/common-engine-v2-audiofree'
expected={x['id']:x['hints'] for x in json.load(open('expected.json'))}
results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='../qa40-chrome/chrome-headless-shell-linux64/chrome-headless-shell',args=['--no-sandbox'])
 for w in [320,390,844,1280]:
  ctx=b.new_context(viewport={'width':w,'height':720})
  for sid in ['S005','S006','S007']:
   pack=json.loads((root/f'stories/{sid}/story.json').read_text())
   for scene,v in pack['scenes'].items():
    for idx,s in enumerate(v['steps']):
     if s['type']!='challenge':continue
     q=pack['challenges'][s['id']];page=ctx.new_page()
     snap={'schemaVersion':1,'storyId':sid,'scene':scene,'index':idx,'status':'READY','flags':{}}
     page.add_init_script('localStorage.clear();localStorage.setItem('+json.dumps('quest.v2.test.'+sid)+','+json.dumps(json.dumps(snap))+');window.SpeechRecognition=class{start(){window.rec=this;}abort(){}};')
     page.goto('http://127.0.0.1:8765/prototype/common-engine-v2-audiofree/unified.html?story='+sid)
     page.get_by_role('button',name='話す',exact=True).wait_for()
     def g():
      return page.evaluate("""()=>{let d=document.querySelector('#dialogue'),g=document.querySelector('.game'),t=document.querySelector('#text'),s=document.querySelector('#support'),a=document.querySelector('#actions');return {height:d.getBoundingClientRect().height/(g.clientWidth/1560),mode:d.className,goal:t.textContent,hint:s.textContent,overflow:[t,s,a].map(x=>[x.scrollWidth>x.clientWidth+1,x.scrollHeight>x.clientHeight+1]),rows:[t,s,a].map(x=>x.getBoundingClientRect().top),colors:[t,s].map(x=>getComputedStyle(x).color),buttons:[...a.children].map(x=>[x.textContent,x.getBoundingClientRect().top])}}""")
     row={'id':s['id'],'width':w,'initial':g(),'stages':[]}
     def click(name):page.get_by_role('button',name=name,exact=True).click()
     def say(t):
      click('話す');page.evaluate("(t)=>{let r=window.rec;r.onresult({results:[[{transcript:t}]]});r.onend()}",t)
     say('xyzzy');page.wait_for_function("document.querySelector('#support').textContent.includes('と聞こえたよ')");row['feedback']=g()
     for i in range(4):
      click('ピコサポート');row['stages'].append(g())
     click('話す');page.evaluate("()=>{window.old=window.rec.onend;window.oldResult=window.rec.onresult}")
     click('聞き取りをやめる');row['stopped']=g();page.evaluate("()=>{window.oldResult?.({results:[[{transcript:'xyzzy'}]]});window.old?.()}");row['late']=g()
     say(q['modelEn']);page.wait_for_timeout(80);row['after']=g();row['accepted']='\"type\":\"accepted\"' in page.locator('#log').text_content()
     row['match']=[x['hint'] for x in row['stages']]==expected[s['id']]
     if s['id']=='s005.communication.10':page.screenshot(path=f'Q10-{w}.png')
     results.append(row)
     if len(results)%16==0: print('progress',len(results),flush=True)
     page.close()
  ctx.close()
 b.close()
pathlib.Path('results.json').write_text(json.dumps(results,ensure_ascii=False))
