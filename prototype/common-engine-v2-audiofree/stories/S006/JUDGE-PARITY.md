# S006 Judge: legacy technical parity evidence and approval boundaries

**Status:** implementation complete for the 10 *current Production* predicate grammars; **director-approved final ACCEPT parity remains HOLD**.

## Source of this port

Production branch `s005-fixed-195-stage-clean-test`, immutable baseline `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`, file `data/s006-communication.js`. The new data file is `stories/S006/story.json`.

## What has been implemented

- All ten original local `accept` functions are represented using the shared data-driven `fullPatterns` operator. Each is anchored to a complete normalized utterance; permissive substring matching across unrelated questions is not used.
- The generic Judge supports `patternNormalization: contractions`, `stripPlease`, and whole-utterance patterns, without Story-ID checks.
- The 136 explicitly registered answer examples and 30 original Japanese Pico Support strings remain unchanged.
- Node tests execute the original `CommunicativeJudgeRuleData[i].accept` functions in a restricted VM and compare them with the new Judge on **60 positive/negative phrases** (6 per question).
- Cross-question test checks **90** mismatched pairs using the ten model utterances, to catch incorrect acceptance across questions.
- The Q2/Q3/Q7 `another box` case and Q7 `book/books` speech-recognition ambiguity have explicit regression assertions.
- Shared Chromium E2E still checks actual S005/S006/S007 paths using a synthetic SpeechRecognition, **not a real microphone**.

## Items that must NOT be silently treated as confirmed

The formal Production source is not necessarily the complete director-approved acceptance specification. Earlier acceptance instructions also mention a Q4 broader `show me` + `box` fallback, Q6 partial `Look at the …` / `Look at that …` recognition when `ribbon` is misrecognized, and a Q10 Japanese Goal of `これはあなたの箱です。`. In the inspected Production source, Q6 still requires a ribbon expression in its grammar and Q10 still says `私は箱を見つけました！`. These differences are **documented and HOLD**, rather than silently overwriting the GitHub source or claiming complete director-approval parity.

Production is not changed. S001–S004 are frozen. BGM/SE/Voice playback remains deferred. Independent QA Lab alone may issue final PASS, and director approval is required for Production merge.
