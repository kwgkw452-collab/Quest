"""Check an immutable HTTPS staging URL for the independent prototype.

This does not claim real-device microphone success or independent QA PASS.
Uses third-party raw.githack CDN only as an optional development preview; no Production deployment.
"""
import os
import sys
import urllib.request

sha=os.environ.get("PREVIEW_SHA","").strip()
if len(sha)!=40 or any(c not in "0123456789abcdef" for c in sha):
    raise SystemExit("PREVIEW_SHA must be a full Git commit SHA")
root=f"https://rawcdn.githack.com/kwgkw452-collab/Quest/{sha}/"
prefix=root+"prototype/common-engine-v2-audiofree/"
targets=[
 (prefix+"play.html","text/html",b"quest-v2.browser.js"),
 (prefix+"play.js","javascript",b"window.QuestV2"),
 (prefix+"quest-v2.browser.js","javascript",b"QuestV2"),
 (prefix+"stories/catalog.json","json",b"S005"),
 (prefix+"stories/S005/story.json","json",b"s005.communication"),
 (root+"images/007/S007-Scene-01.png","image/png",b"\x89PNG"),
]
for url,mime,marker in targets:
 req=urllib.request.Request(url,headers={"User-Agent":"Quest-preview-ci-check/1.0"})
 try:
  with urllib.request.urlopen(req,timeout=25) as resp:
   header=resp.headers.get("Content-Type","").lower()
   data=resp.read(500000)
   status=resp.status
 except Exception as e:
  print("PREVIEW_UNREACHABLE",url,repr(e),file=sys.stderr)
  raise
 if status!=200 or mime not in header or marker not in data:
  raise AssertionError(f"PREVIEW_ASSET_INVALID: {url}: HTTP{status}, {header}, marker={marker in data}")
 print("PREVIEW_ASSET_OK:",url,"mime:",header,"bytes_checked:",len(data))
print("HTTPS_STAGING_ASSETS_PASS",prefix+"play.html?story=S005")
