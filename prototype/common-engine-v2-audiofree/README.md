# Eigo DE Quest — Common Engine V2 No-Audio Functional Prototype

This is **not** the production engine and **not** an approved S001–S007 migration. It exists independently of the deployed application and does not copy the old Audio Manager.

## Run

- Unit tests: `node --test runtime.test.cjs` (34 passed with Node 22 on 2026-11-25).
- Browser build: `node build-browser.cjs`.
- Browser E2E: `python browser-smoke.py` (requires Playwright/Chromium; runs full synthetic Story with fake microphone speech, two vocabulary words, document, Save, and ending).
- Browser demonstration: serve this folder over a local development HTTP server, then open `demo.html`. `file:` URLs may be blocked by browser security policy. The demo shows a **synthetic** Story, not any published Story. On browsers with SpeechRecognition support and permission, the Talk buttons use a real microphone. No text answer fallback.

## Included

- `schema.cjs`: restrictive Story package validation (not yet full spec).
- `judge.cjs`: deterministic local fixture judge; **not** current approved per-question accept corpus.
- `communication.cjs`: Speech attempt ownership, feedback, 3-stage Pico hint, cancellation and stale-result rejection.
- `speech-browser.cjs`: optional browser SpeechRecognition adapter with explicit unsupported/permission/no-speech responses; **not yet iPhone verified**.
- `vocabulary-battle.cjs`: shared vocabulary-only battle with its own exact-match criterion, separate from communication judgement.
- `save.cjs`: versioned JSON save store; prototype checkpoint and reload.
- `runner.cjs`: Story progression, challenge, battle, document, scene transition, typed flag and atomic async save checkpoint.
- `build-browser.cjs` and `quest-v2.browser.js`: source bundle for standalone browser validation; no external package dependencies.
- `demo.html` / `demo.js`: browser-visible smoke interface with no audio playback.
- `runtime.test.cjs`: 34 Node tests; including 100 synthetic IDs, concurrent speech, stale result, invalid schema, Save error, end-to-end synthetic adventure.
- `browser-smoke.py`: complete Chromium E2E test with mock SpeechRecognition (requires installed Playwright and Chromium). GitHub Actions also runs this browser job.

## Still missing (do not claim PASS)

Production integration; S001–S007 conversion and accepted Judge expectations; full story feature and layout schema; real Story assets and voice; iPhone mic interaction verification; certified independent QA; Production Save compatibility and restore-at-any-step; complete Word/Communication rule matching; complete UI/layout system; accessibility and iPhone viewport; Battle stage graphics; official handover.

Audio Playback BGM/SE/Voice/duck/restore is intentionally **deferred** per director instruction. Microphone speech functionality is *not* deferred.

When submitting: source SHA and build artifacts must be checked separately; neither testing a sandbox zip nor creating a Draft PR constitutes independent QA PASS or Production authorization.


## Regression hardening

Multi-word vocabulary battles must not exit after the first accepted word. Save writes are serialized through the Story progression lock; a Return attempted while a Save write is pending is reported as ignored, and must be retried. Snapshot restoration rejects undeclared or mistyped Save flags. These safeguards have regression tests, but do not imply real-device microphone QA or Production Save compatibility.
