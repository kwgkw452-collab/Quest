"""Synthetic browser end-to-end test with a mocked microphone; no audio playback."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
html = (ROOT / 'demo.html').read_text()
demo_js = (ROOT / 'demo.js').read_text()
needle = "answers:['sunny']}]}"
assert needle in demo_js, 'SYNTHETIC_FIXTURE_DRIFT'
demo_js = demo_js.replace(needle, "answers:['sunny']},{prompt:'曇り',answers:['cloudy']}]}")
html = html.replace('<script src="./quest-v2.browser.js"></script>', '<script>' + (ROOT / 'quest-v2.browser.js').read_text() + '</script>')
html = html.replace('<script src="./demo.js"></script>', '<script>' + demo_js + '</script>')
mock = """window.__answers=['hello','rainy','sunny','cloudy'];window.SpeechRecognition=class {start(){const text=window.__answers.shift();queueMicrotask(()=>{this.onresult?.({results:[[{transcript:text}]],resultIndex:0});this.onend?.();});}abort(){this.onend?.();}};"""

with sync_playwright() as playwright:
    try:
        browser = playwright.chromium.launch(headless=True)
    except Exception:
        if not Path('/usr/bin/chromium').exists():
            raise
        browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.goto('about:blank')
    page.evaluate('() => {' + mock + '}')
    page.set_content(html, wait_until='load')
    page.get_by_role('button', name='次へ').click()
    page.get_by_role('button', name='ピコサポート').click()
    assert 'ピコ:' in page.locator('#content').inner_text()
    page.get_by_role('button', name='話す').click()
    page.get_by_role('button', name='次へ').click()
    assert '晴れ' in page.locator('#content').inner_text()
    page.get_by_role('button', name='英単語を話す').click()
    assert '晴れ' in page.locator('#content').inner_text(), 'WRONG_WORD_LEFT_BATTLE'
    assert page.get_by_role('button', name='英単語を話す').is_visible(), 'BATTLE_BUTTON_MISSING'
    page.get_by_role('button', name='英単語を話す').click()
    assert '曇り' in page.locator('#content').inner_text(), 'BATTLE_SKIPPED_AFTER_FIRST_WORD'
    assert page.get_by_role('button', name='英単語を話す').is_visible()
    page.get_by_role('button', name='英単語を話す').click()
    page.get_by_role('button', name='次へ').click()
    assert '手紙' in page.locator('#content').inner_text()
    page.get_by_role('button', name='読み終わった').click()
    page.get_by_role('button', name='次へ').click()
    assert 'テスト冒険クリア' in page.locator('#content').inner_text()
    assert not errors, errors
    print('BROWSER E2E PASS: 2-word Battle, Document, Save flag, End, no page errors')
    browser.close()
