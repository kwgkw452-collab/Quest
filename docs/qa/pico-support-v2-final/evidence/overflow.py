import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='../qa40-chrome/chrome-headless-shell-linux64/chrome-headless-shell',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':720})
 snap={'schemaVersion':1,'storyId':'S005','scene':'scene05','index':20,'status':'READY','flags':{}}
 page.add_init_script('localStorage.setItem("quest.v2.test.S005",'+json.dumps(json.dumps(snap))+');')
 page.goto('http://127.0.0.1:8767/prototype/common-engine-v2-audiofree/unified.html?story=S005')
 for _ in range(3):page.get_by_role('button',name='ピコサポート',exact=True).click()
 print(json.dumps(page.evaluate("""()=>Object.fromEntries(['text','support','actions','dialogue'].map(id=>{let e=document.getElementById(id),r=e.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);return [id,{text:e.textContent,client:e.clientHeight,scroll:e.scrollHeight,top:r.top,bottom:r.bottom,rects:[...range.getClientRects()].map(x=>({top:x.top,bottom:x.bottom})),font:getComputedStyle(e).fontSize,line:getComputedStyle(e).lineHeight}]}))"""),ensure_ascii=False))
 page.screenshot(path='overflow-1280.png')
 b.close()
