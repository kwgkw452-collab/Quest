# S005 + S006 Migration Evidence — Audio-free common engine

**Status:** Content conversion completed. Production integration **HOLD**, independent QA **NOT EXECUTED**.

## Immutable sources

- Production SHA: `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`
- Story source: `engine/stories/S005.js`, `engine/stories/S006.js`
- Communication source: `data/s005-communication.js`, `data/s006-communication.js`
- Ending source: `data/s006-ending.js`

## Recorded source coverage

| | S005 | S006 |
|---|---:|---:|
| Story grouping in new JSON | 11 original `sequence` groups | 13 successive background frames |
| Backdrop commands | 21 | 13 |
| Dialogue commands | 141 | 59 |
| Communication calls | **12** | 10 |
| Explicit answer phrases | 104 | 136 |
| Japanese Pico hint strings | 36 | 30 |
| Document/letter | none | 1 letter, 16 bilingual lines + 16 voice key records |

The 11-question historical handover for S005 conflicts with **12 distinct actual calls and 12 definitions** on the cited Production SHA. The data port deliberately preserves the source's 12; the director-approved final question count is **UNRESOLVED**, not overwritten by this conversion.

S005's 11 `C.sequence()` groups are flattened into ordinary declarative commands rather than copied as Story-specific execution code. S006's original `s006EndingLetter` handler is **not copied**; its 16-line content becomes a generic document object. The new document UI supports page-by-page progression and an English/Japanese toggle, with Voice temporarily silent because Audio playback is deferred.

## Verified and unverified properties

Source parity tests load legacy StoryCommands and source registrations in a restricted Node VM, compare every ordered command and question field, and complete each new Story with a mock microphone. The browser uses one shared catalog-driven player for all migrated stories; no dedicated S005 or S006 engine branches.

The declared answer lists are **not** enough to certify the original functional `accept` / `reject` predicates. Those still require independent, per-question Judge verification. Also, legacy `question.saveAs` runtime bookkeeping and the S006 Ending controller's button/Voice lifecycle have **not yet been fully migrated**. The 16 original voice keys and filenames exist but are not played.

No iPhone real microphone validation, no approved Judge corpus certification, no Production save compatibility verification, no independent QA PASS, and no Production merge.

## Important architectural constraints

- Never copy `s006EndingLetter` into the new runtime as a local handler.
- New document variations require typed common document data/capabilities, not path checks or Story ID tests.
- `?v=` in backgrounds is supported generically for cache versions, not by special-case S006 CSS.
- Existing Production code and story/graphic/audio assets remain unchanged.
- Independent QA final PASS and director approval remain mandatory before any Production integration.
