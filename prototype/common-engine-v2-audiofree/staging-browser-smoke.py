"""Open the immutable HTTPS staging URL in real Chromium (mock mic only)."""
import os
import json
from shutil import which
from pathlib import Path
from playwright.sync_api import sync_playwright

sha=os.environ['PREVIEW_SHA']
base=f"https://rawcdn.githack.com/kwgkw452-collab/Quest/{sha}/prototype/common-engine-v2-audiofree/"
data=json.loads((Path(__file__).resolve().parent/'stories/S006/story.json').read_text())
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
 assert '成功' in page.locator('#text').inner_text(),page.locator('#text').inner_text()
 assert not errors,errors
 print('HTTPS PREVIEW CHROMIUM PASS:',url,'first question:',first_id,'mobile viewport 390x844, mock mic')
 browser.close()
