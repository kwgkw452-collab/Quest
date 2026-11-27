# Common Engine V2 — residual HOLD verification

Base PR #40 54126d398ed882cf07ac3fa3ae683f2b56d6f471, stacked on #39 518ba415a03a8b0fb054b5c4694c2d2ea1ead8d4. PR #34 checkpoint 9492a424a151751c6dcaca4326eb806a07f688b3. Production baseline 70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f. This branch is an independent review candidate. Director approval and independent QA final PASS are needed for integration.

## Save

Production SaveManager stores version 1 in eigo-de-quest:save:v2, with progress.currentStoryId and currentStepIndex (top-level legacy command index), flags, party, inventory, bestiary, storyState and player data. V2 stores per-Story snapshots in quest.v2.test.<id>. A legacy cursor must be translated rather than treated as a V2 scene-local index. The new mapping generator checks legacy compiled command order against migrated steps, flattens sequence commands, maps omitted redundant clear before full-background steps to that background, and handles the end cursor. The player reads the old key only when resuming its matching Story and no V2 checkpoint exists. The old key is never written or removed. Invalid cursor/version/flag errors leave the legacy data intact. Existing V2 checkpoint takes precedence.

Node tests use the actual legacy SaveManager in a VM and execute the matching next dialogue using the V2 runner for each of S005/S006/S007, reload the new snapshot, reload the untouched old data through legacy SaveManager, and reject an invalid cursor. Chromium test exercises imported cursor, actual visible dialogue, reload, backdrop and Story switch. The tested nonzero legacy saves are synthetic, generated with the old manager or equivalent schema. Production GameConfig.autoSaveStepInterval is 0, and legacy StoryEngine.play starts its loop at zero even when initialState stores an old index. A missing historical cursor cannot be recovered. Original Save roll-back is readable, but continuing V2 progress in the old engine and true old-engine mid-step resume remain HOLD. StoryState/party/inventory/bestiary remain in the intact old save; this isolated runner imports only declared typed flags and cursor. Same-origin storage is required. The external immutable preview cannot access Production-origin localStorage. Cross-origin import and Production entry integration remain HOLD.

## Audio / Voice

No legacy Audio, Voice or Speech source changes. V2 play.html loads only the isolated browser bundle and player; its Speech adapter directly invokes browser SpeechRecognition and does not invoke the legacy enterSpeechMode/exitSpeechMode contract or DialogueVoiceController. Existing unchanged legacy contract tests phase 1 (43 checks) and phase 2 (181 checks) were executed locally and are included in candidate CI. These are simulated browser/audio tests of the old subsystem. This demonstrates the preserved old contract, not integrated V2 playback. Actual V2 Story switch, SpeechMode/Voice/SE overlap, Scene change and resume with audio remain HOLD until an approved integration path exists. No audio changes or iPhone loudness investigation in this branch.

## Director iPhone minimum

Use immutable candidate preview and record SHA/model/iOS. Open S006; check dialogue and graphic in portrait/landscape, actual microphone permission and recognition, wrong/incomplete/correct response, Pico 1/2/3 and next-question reset, switch during recognition, return and reload. Confirm S007 Scene 12 join and Scene 13 only if not already tested on that exact build. Physical safe-area and real microphone remain HOLD. Production-origin legacy Save migration must be tested on an isolated copy of the user's save under the same origin prior to integration; never clear user storage.

## Evidence

Exact-head Actions and results will be linked in the Draft PR. Existing PR #40 CI success and the PM receipt of the independent 152-case archive are inherited; the latter does not contain actual case-level totals or independent final verdict. Keep all three integration gates separated from previously verified mock-browser/Judge behavior.
