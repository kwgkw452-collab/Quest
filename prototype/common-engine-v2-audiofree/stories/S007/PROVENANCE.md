# S007 — Production-to-declarative migration provenance

**Migration status: CONTENT PORTED / JUDGE PARITY HOLD / INDEPENDENT QA NOT PERFORMED.**

- Immutable Production source: `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`
- `engine/stories/S007.js`: 13 background commands, 112 dialogue commands, 10 question commands, one setFlag (`s007.megJoined=true`).
- `data/s007-communication.js`: 10 records, 146 explicit answer variants, 3 Pico hint strings each.
- New target: `stories/S007/story.json`; 13 scenes, exactly preserved dialogue text, speaker and Japanese supportText, question IDs/goals/model/answers/hints, and Meg join flag. The source's `onExit` SpeechEngine cleanup is not directly copied: new general lifecycle must own microphone cancellation.
- The converted file adds **generic** declarative `goto` commands and a final `end` to represent the old implicit linear execution. No Story-specific executable conditions have been transferred.
- Source script itself sets `S007DraftCommunicationMetadata.status = DRAFT_NOT_APPROVED`. Although found in the Production source, this cannot be treated as proof that the question acceptance metadata is formally approved. Independently check the director-approved expectations.
- **Known Judge gap**: Source question 2 accepts some utterances involving "you + take/takes/took + pictures/photos" beyond the enumerated answers. Source question 4 accepts "look at + bird(s)" beyond the enumerated answers; both reject explicit negation. The new fixture Judge currently only understands exact variants / simple rules. This means S007 is **NOT ready for integration** despite content parity.
- **Known display gap**: The converter preserves dialogue supportText but the current test presenter does not render the complete official dialogue-support behavior, voice profiles, stage graphic safe area or real Speech.
- **Known Save gap**: `s007.megJoined` type and event location are preserved; legacy save migration/continuation has not been verified.
- **Known asset gap**: JSON holds each original relative background URL; visual/size/hash parity was not established by this migration.
- No BGM, SE, or Voice playback is implemented (deliberately deferred). SpeechRecognition remains in scope.

## Tests (independent of source conversion implementation)

`node --test prototype/common-engine-v2-audiofree/stories/S007/s007-migration.test.cjs`

Tests load the original S007 JS into a restricted Node VM with the original StoryCommands module and compare its emitted command sequence with the new data; they load the legacy question registrations using a stub database to compare all exact text and variants. They also execute the migrated 13-scene Story using mocked microphone recognition to check 112 lines, 10 questions, the flag write, and completion.

This tests basic source parity, **not independent QA acceptance parity** or actual device compatibility.
