# Birdie m005 — implementation preparation

Status: STAGED ONLY — not wired to Production or Dev Menu, not browser/iPhone validated.

## User approved
- Name Birdie (バーディ); no magic, no new powers. Helps Birdie learn bird names.
- 15 canonical bird words plus birdy=>bird and chiken=>chicken transcription aliases.
- Three DISTINCT canonical words to succeed, no duplicate credit.
- Four approved visual states (Stage 0 to Stage 3). Existing Pico three levels and m004-success audio approach are to be reused.

## Prepared in repository
- data/m005.js — dictionary + question + MonsterDatabase declaration
- engine/stories/m005.js — standalone m005 story entry, with preserveBgm; no connection to any existing episode
- data/bird-vocabulary-candidates.json — previously approved vocabulary source

## BLOCKERS BEFORE ACTIVATION
1. Upload and visually inspect four approved *actual* Birdie image files. Required paths: images/monsters/m005/birdie_stage0.png through birdie_stage3.png. These files do NOT exist at this commit. DO NOT wire registration while absent.
2. Progress mapping was added as an opt-in `battle.progressStates` array (0/1/2/3); existing m004 and other monsters without this setting retain their behavior. Runtime/browser testing of this addition remains pending because the actual approved images are not yet installed.
3. Existing m005 lacks established Pico camp IDs; campIds intentionally empty. Review failure/retry/pseudoCamp wiring prior to launch. No changes to audio, Speech, common engine, S006.
4. Confirm how Dev Menu can start m005 independently, without automatically inserting it into S006->S007 progression. Ensure success/abandon return paths and iPhone mic/audio acceptance.
5. Run dictionary canonicalization tests, duplicate and three-hit tests, complete visual path tests, Dev Menu/browser inspection, S005/S006/m004 regression suite. Record any existing failures separately.
6. Name assignment m005 is provisional for this staged file since historical Chimera m005 had been discussed; verify chosen ID before runtime connection.

No GitHub Pages behavior change is intended in this staging commit.
