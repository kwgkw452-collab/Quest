import json,pathlib
from playwright.sync_api import sync_playwright
root=pathlib.Path('prototype/common-engine-v2-audiofree')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='../qa40-chrome/chrome-headless-shell-linux64/chrome-headless-shell',args=['--no-sandbox'])
 for sid in ['S005','S006','S007']:
  pack=json.loads((root/f'stories/{sid}/story.json').read_text())
  page=b.new_page(viewport={'width':844,'height':720})
  page.add_init_script("window.SpeechRecognition=class{start(){window.rec=this;}abort(){}};")
  page.goto('http://127.0.0.1:8766/prototype/common-engine-v2-audiofree/unified.html?story='+sid)
  page.locator('#actions button').first.wait_for()
  count=0; goals=[]; errors=[]
  def click(n):page.get_by_role('button',name=n,exact=True).click()
  for i in range(600):
   page.wait_for_timeout(15)
   buttons=page.locator('#actions button').all_text_contents()
   if '話す' in buttons:
    goal=page.locator('#text').text_content()
    assert page.locator('#support').text_content()==''
    ev=[json.loads(x) for x in page.locator('#log').text_content().splitlines() if x.strip()]
    cid=[e['id'] for e in ev if e.get('type')=='challenge'][-1]
    assert goal==pack['challenges'][cid]['goalJa']
    click('ピコサポート');click('話す')
    page.evaluate("(t)=>{let r=window.rec;r.onresult({results:[[{transcript:t}]]});r.onend()}",pack['challenges'][cid]['modelEn'])
    count+=1;goals.append(cid)
   elif '次へ' in buttons:
    if count==0 and i==0 and 'ピコサポート' in buttons:
     click('ピコサポート');assert '英文を見る' in page.locator('#actions button').all_text_contents()
    click('次へ')
   elif '次の文' in buttons:click('次の文')
   elif '読み終えた' in buttons:click('読み終えた')
   elif 'このStoryをクリアしました。' in page.locator('#text').text_content():break
   else:raise Exception((sid,buttons,page.locator('#text').text_content()))
  assert count==len(pack['challenges']), (sid,count)
  print(sid,'full flow',count,'PASS',flush=True)
  page.close()
  page=b.new_page()
  mapping=json.loads((root/f'stories/{sid}/legacy-cursors.json').read_text())
  pos=min(3,len(mapping['cursors'])-1)
  save={'saveVersion':1,'progress':{'currentStoryId':sid,'currentStepIndex':pos},'flags':{}}
  raw=json.dumps(save)
  page.add_init_script('localStorage.setItem("eigo-de-quest:save:v2",'+json.dumps(raw)+');')
  page.goto('http://127.0.0.1:8766/prototype/common-engine-v2-audiofree/unified.html?story='+sid)
  page.locator('#actions button').first.wait_for()
  status=page.locator('#status').text_content()
  assert mapping['cursors'][pos]['scene'] in status, (status,mapping['cursors'][pos])
  assert page.evaluate('localStorage.getItem("eigo-de-quest:save:v2")')==raw
  print(sid,'legacy cursor',pos,status,'PASS',flush=True)
  page.close()
 b.close()
