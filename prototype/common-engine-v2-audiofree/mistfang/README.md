# Mistfang vocabulary battle — integration candidate

Branch-only isolated QA entry: `prototype/common-engine-v2-audiofree/mistfang/index.html`.
Uses the unmodified common V2 runner and vocabulary battle, with **10 sequential vocabulary answers**: snow, snowy, mist, misty, storm, stormy, thunder, lightning, fine, frosty.
Progress thresholds: 0–2, 3–5, 6–9, 10 correct answers show stages 0, 1, 2, 3 respectively. Wrong answers do not progress.
Image sources: Library originals for four stages, resized to 1560x720 in a separate candidate package; do not claim they are GitHub assets until the four PNG files are actually committed under `assets/`. The HTML shows `GRAPHIC_MISSING` in that case and does not silently use substitute artwork.

The preview is not Production, has no Sound/Voice playback, and runs browser SpeechRecognition directly. Chrome/Edge device permissions are required for real-mic testing. No Story, Judge, Audio, Voice, Production, or PR #40 is changed. 2-row safe area 108px and 3-row safe area 140px apply to the source art; for this battle the 140px bottom overlay is reserved, in portrait the dialogue is below the artwork.
Independent QA and iPhone device acceptance remain pending.
