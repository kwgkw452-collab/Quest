"""E2E of the REAL migrated S007 content in a generic browser player (mock microphone only).
Does not claim Production, iPhone, voice playback, or independent QA approval.
"""
import functools
import http.server
import json
import threading
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]  # repo root: .../prototype/common-engine-v2-audiofree -> ../..
STORY = json.loads((HERE / "stories/S007/story.json").read_text(encoding="utf-8"))
QUESTION_IDS = [s["id"] for scene in STORY["sceneOrder"] for s in STORY["scenes"][scene]["steps"] if s["type"] == "challenge"]
ANSWERS = [STORY["challenges"][id]["modelEn"] for id in QUESTION_IDS]
assert len(QUESTION_IDS) == 10

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
errors = []
try:
    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(headless=True)
        except Exception:
            chrome = next((which(name) for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser") if which(name)), None)
            if not chrome:
                raise RuntimeError("Chromium/Chrome unavailable")
            browser = playwright.chromium.launch(headless=True, executable_path=chrome, args=["--no-sandbox"])
        page = browser.new_page()
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.add_init_script(script=f"""
window.__questAnswers = {json.dumps(ANSWERS)};
window.SpeechRecognition=class {{
 start(){{const text=window.__questAnswers.shift();queueMicrotask(()=>{{this.onresult?.({{results:[ [ {{ transcript:text }} ] ],resultIndex:0}});this.onend?.();}});}}
 abort(){{this.onend?.();}}
}};
""")
        url=f"http://127.0.0.1:{server.server_port}/prototype/common-engine-v2-audiofree/play.html?story=S007"
        page.goto(url, wait_until="load")
        page.get_by_role("button", name="次へ").wait_for(timeout=15000)
        hints = 0
        for i in range(190):
            if "このStoryをクリアしました" in page.locator("#text").inner_text():
                break
            if "エラー：" in page.locator("#text").inner_text():
                raise AssertionError("PLAYER_ERROR: " + page.locator("#text").inner_text())
            options=page.locator("#actions button").all_text_contents()
            if "次へ" in options:
                target="次へ"
            elif "話す" in options:
                if not hints:
                    count=len(page.locator("#log").text_content().splitlines())
                    page.get_by_role("button", name="ピコサポート").click()
                    page.wait_for_function("(count)=>document.querySelector('#log').textContent.split('\\n').filter(Boolean).length>count", arg=count)
                    assert "ピコ：" in page.locator("#support").inner_text()
                    hints+=1
                target="話す"
            else:
                raise AssertionError("UNEXPECTED_CONTROLS: " + str(options))
            count=len(page.locator("#log").text_content().splitlines())
            page.get_by_role("button", name=target).click()
            page.wait_for_function("(count)=>document.querySelector('#log').textContent.split('\\n').filter(Boolean).length>count", arg=count, timeout=12000)
        else:
            raise AssertionError("STEP_LIMIT_EXCEEDED")
        assert "このStoryをクリアしました" in page.locator("#text").inner_text(), "S007_NOT_COMPLETED"
        assert "S007-Scene-13.png" in page.locator("#backdrop").get_attribute("style"), "LAST_BACKGROUND_WRONG"
        events=[json.loads(line) for line in page.locator("#log").text_content().splitlines() if line.strip()]
        line_count=sum(e.get("type")=="line" for e in events)
        challenge_count=sum(e.get("type")=="challenge" for e in events)
        accepted_count=sum(e.get("type")=="accepted" for e in events)
        assert (line_count,challenge_count,accepted_count)==(112,10,10), (line_count,challenge_count,accepted_count)
        assert events[-1]["flags"]["s007.megJoined"] is True
        assert page.evaluate("window.__questAnswers.length")==0, "NOT_ALL_10_QUESTIONS_SPOKEN"
        assert not errors, errors
        persisted=page.evaluate("JSON.parse(localStorage.getItem('quest.v2.test.S007'))")
        assert persisted['storyId']=='S007'
        assert persisted['flags']['s007.megJoined'] is True
        assert persisted['scene']=='scene12'
        page.reload(wait_until='load')
        page.get_by_role("button",name="次へ").wait_for(timeout=15000)
        assert 'scene13' in page.locator('#status').inner_text(),"SAVE_DID_NOT_ADVANCE_FROM_SCENE12_CHECKPOINT"
        assert 'S007-Scene-13.png' in page.locator('#backdrop').get_attribute('style'),"SAVE_RESTORED_WRONG_NEXT_SCENE"
        assert page.evaluate("JSON.parse(localStorage.getItem('quest.v2.test.S007')).flags['s007.megJoined']") is True
        page.evaluate("""() => {const key='quest.v2.test.S007';const snapshot=JSON.parse(localStorage.getItem(key));snapshot.scene='scene03';snapshot.index=1;snapshot.flags={};localStorage.setItem(key,JSON.stringify(snapshot));}""")
        page.reload(wait_until='load')
        page.get_by_role("button",name="次へ").wait_for(timeout=15000)
        assert 'scene03' in page.locator('#status').inner_text(),"MID_SCENE_RESUME_CURSOR_BAD"
        assert 'S007-Scene-03.png' in page.locator('#backdrop').get_attribute('style'),"MID_SCENE_BACKGROUND_NOT_RESTORED"
        page.get_by_role("button",name="最初から").click()
        page.wait_for_function("()=>document.querySelector('#status').textContent.includes('scene01')")
        assert page.evaluate("localStorage.getItem('quest.v2.test.S007')") is None,"MANUAL_RESTART_DID_NOT_CLEAR_CHECKPOINT"
        assert not errors, errors
        print("S007 SAVE RELOAD PASS: checkpoint to scene13, mid-scene background restoration, explicit restart only")
        print("S007 BROWSER E2E PASS: 13 scenes, 112 dialogue lines, 10 spoken challenges, Meg Save flag, last background")
        browser.close()
finally:
    server.shutdown()
    server.server_close()
