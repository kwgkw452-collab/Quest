# Mistfang vocabulary battle — integration candidate

Branch-only isolated QA entry: `prototype/common-engine-v2-audiofree/mistfang/index.html`.
Uses the unmodified common V2 runner and vocabulary battle, with **10 sequential vocabulary answers**: snow, snowy, mist, misty, storm, stormy, thunder, lightning, fine, frosty.
Progress thresholds: 0–2, 3–5, 6–9, 10 correct answers show stages 0, 1, 2, 3 respectively. Wrong answers do not progress.
Image sources: four Library individual PNGs have been resized to **1560×720** and committed as binary images under `assets/`. Their exact dimensions are verified by `stage.test.cjs` and Chromium by `browser-smoke.py`. The HTML explicitly shows `GRAPHIC_MISSING` if any asset is removed. Original Library assets remain unchanged.

**Graphic QA HOLD:** The V3 collage's final panel includes the signpost `Long River Village`, while the highest-resolution individual ending PNG used for `mistfang_stage_3.png` does not visibly contain that sign. Do not certify ending-graphic fidelity or Director graphic PASS until this discrepancy is independently resolved using the approved source; do not manufacture a replacement or alter the original art.

The preview is not Production, has no Sound/Voice playback, and runs browser SpeechRecognition directly. Chrome/Edge device permissions are required for real-mic testing. No Story, Judge, Audio, Voice, Production, or PR #40 is changed. 2-row safe area 108px and 3-row safe area 140px apply to the source art; for this battle the 140px bottom overlay is reserved, in portrait the dialogue is below the artwork.
Independent QA and iPhone device acceptance remain pending.
