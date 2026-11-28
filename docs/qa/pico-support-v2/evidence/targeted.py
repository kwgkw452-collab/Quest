import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='../qa40-chrome/chrome-headless-shell-linux64/chrome-headless-shell',args=['--no-sandbox'])
 for width in [320,390,844,1280]:
  page=b.new_page(viewport={'width':width,'height':720})
  snap={'schemaVersion':1,'storyId':'S005','scene':'scene03','index':3,'status':'READY','flags':{}}
  page.add_init_script('localStorage.setItem("quest.v2.test.S005",'+json.dumps(json.dumps(snap))+');window.SpeechRecognition=class{start(){window.rec=this;}abort(){}};')
  page.goto('http://127.0.0.1:8765/prototype/common-engine-v2-audiofree/unified.html?story=S005')
  page.get_by_role('button',name='話す',exact=True).click()
  page.evaluate("()=>{let r=window.rec;r.onresult({results:[[{transcript:'xyzzy'}]]});r.onend()}")
  page.wait_for_function("document.querySelector('#support').textContent.includes('と聞こえたよ')")
  page.get_by_role('button',name='ピコサポート',exact=True).click()
  print(width,'after reject then support:',page.locator('#support').text_content(), 'text metrics',page.locator('#text').evaluate("x=>({client:x.clientHeight,scroll:x.scrollHeight,font:getComputedStyle(x).fontSize,line:getComputedStyle(x).lineHeight})"),flush=True)
  page.screenshot(path=f'qa56-reject-support-{width}.png')
  page.close()
 b.close()
