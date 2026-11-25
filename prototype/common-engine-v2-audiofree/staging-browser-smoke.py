"""Open the immutable HTTPS staging URL in real Chromium (mock mic only)."""
import os
import json
from shutil import which
from pathlib import Path
from playwright.sync_api import sync_playwright

sha=os.environ['PREVIEW_SHA']
base=f"https://rawcdn.githack.com/kwgkw452-collab/Quest/{sha}/prototype/common-engine-v2-audiofree/"
stories=Path(__file__).resolve().parent/'stories'
data=json.loads((stories/'S006/story.json').read_text())
s005=json.loads((stories/'S005/story.json').read_text())

def checkpoint_before(pack, predicate):
 for scene in pack['sceneOrder']:
  for index, step in enumerate(pack['scenes'][scene]['steps']):
   if predicate(step):
    return dict(schemaVersion=1,storyId=pack['id'],scene=scene,index=index,status='READY',flags={})
 raise AssertionError('Preview test command not found')

def assert_image(page, asset):
 page.wait_for_function("(asset) => document.querySelector('#backdrop').getAttribute('aria-label') === asset",arg=asset)
 actual=page.locator('#backdrop').evaluate('node => node.style.backgroundImage.slice(5,-2)')
 # Read the exact URL emitted by the player and verify the real image response.
 response=page.request.get(actual,timeout=25000)
 assert response.status==200,(actual,response.status)
 assert response.headers.get('content-type','').startswith('image/png'),actual
 assert response.body().startswith(b'\x89PNG\r\n\x1a\n'),actual
 assert f'/{sha}/{asset}' in actual,actual
 print('QA35-01 HTTP 200 PNG:',actual,flush=True)

def resume_at(page, snapshot):
 page.evaluate("(snap)=>localStorage.setItem('quest.v2.test.'+snap.storyId,JSON.stringify(snap))",snapshot)
 page.locator('#resume').click()

first_id=next(x['id'] for scene in data['sceneOrder'] for x in data['scenes'][scene]['steps'] if x['type']=='challenge')
answer=data['challenges'][first_id]['modelEn']
with sync_playwright() as pw:
 try:
  browser=pw.chromium.launch(headless=True)
 except Exception:
  chrome=next((which(n) for n in ('google-chrome','google-chrome-stable','chromium','chromium-browser') if which(n)),None)
  if not chrome:raise
  browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.add_init_script(script=f"""
 window.SpeechRecognition=class {{
  start(){{queueMicrotask(()=>{{this.onresult?.({{results:[[{{transcript:{json.dumps(answer)} }}]],resultIndex:0}});this.onend?.();}});}}
  abort(){{this.onend?.();}}
 }};
 """)
 url=base+'play.html?story=S006'
 page.goto(url,wait_until='load',timeout=55000)
 if 'External Content Notice' in page.title():
  page.get_by_text('Open the page',exact=True).click(timeout=15000)
  page.wait_for_load_state('domcontentloaded',timeout=20000)
 page.wait_for_timeout(2500)
 print('REMOTE_DIAGNOSTIC',{'url':page.url,'title':page.title(),'body':page.locator('body').inner_text()[:1000],'errors':errors,'questApi':page.evaluate('typeof window.QuestV2'),'status':page.locator('#status').inner_text() if page.locator('#status').count() else '(missing)'},flush=True)
 page.get_by_role('button',name='次へ').wait_for(timeout=12000)
 assert page.locator('#status').inner_text().startswith('Scene: scene01'),page.locator('#status').inner_text()
 assert 'S006' in page.locator('#story-select').input_value()
 assert 'S006-Scene-01.png' in page.locator('#backdrop').get_attribute('style')
 for i in range(120):
  opts=page.locator('#actions button').all_text_contents()
  if '話す' in opts:break
  assert '次へ' in opts,('UNEXPECTED_UI',opts,page.locator('#text').inner_text())
  page.get_by_role('button',name='次へ').click()
 else:raise AssertionError('NEVER_REACHED_FIRST_SPEECH_CHALLENGE')
 assert page.locator('#text').inner_text()==data['challenges'][first_id]['goalJa']
 rect_game=page.locator('.game').bounding_box()
 rect_actions=page.locator('#actions').bounding_box()
 assert rect_game and rect_actions
 assert rect_actions['y']+rect_actions['height']<=rect_game['y']+rect_game['height']+1,'MOBILE_ACTIONS_CLIPPED'
 page.get_by_role('button',name='話す').click()
 page.get_by_role('button',name='次へ').wait_for(timeout=15000)
 assert page.locator('#text').inner_text()==data['challenges'][first_id]['goalJa']
 assert '成功' in page.locator('#support').inner_text()

 letter_checkpoint=checkpoint_before(data,lambda step:step['type']=='document')
 letter_step=data['scenes'][letter_checkpoint['scene']]['steps'][letter_checkpoint['index']]
 letter_card=data['documents'][letter_step['id']]['card']
 resume_at(page,letter_checkpoint)
 page.get_by_role('button',name='日本語',exact=True).wait_for()
 assert_image(page,letter_card)

 page.locator('#story-select').select_option('S005')
 page.get_by_role('button',name='次へ',exact=True).wait_for()
 scene3='images/005/reference-v1/Scene3.png'
 resume_at(page,checkpoint_before(s005,lambda step:step.get('asset')==scene3))
 assert_image(page,scene3)

 assert not errors,errors
 print('HTTPS PREVIEW CHROMIUM PASS:',url,'first question:',first_id,'mobile viewport 390x844, mock mic')
 browser.close()
