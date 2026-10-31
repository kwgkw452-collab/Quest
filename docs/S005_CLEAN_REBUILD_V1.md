# S005 Clean Rebuild V1

Base: `006d312395e54e377b98a0f0333ef1b63f6acecf`, branch `s005-fixed-195-stage-clean-test`.

S005 is newly authored as StoryCommands data. The prior Story's helper functions,
inline Judge functions, conditional registration, and asset-path repair logic are
not carried forward. Existing dialogue, communication goals, approved answer
examples, Support wording, and current graphic assets are specifications.

## Production composition

- `engine/stories/S005.js`: eleven scenes using the existing `sequence`, `clear`,
  `background`, `item`, `dialogue`, and `question` commands. No callbacks or runtime
  branching. The shared StoryEngine/EventSystem execute the scenes.
- `data/s005-communication.js`: eleven Question definitions, three Support texts
  per Question, approved/rejected answer variants, and shared Lottery pool data.
  Registration calls the existing databases and LotteryEngine. There is no custom
  Judge accept function or S005-specific Speech, Controller, Presenter or UI.
- `index.html` and `dev.html`: load the new definitions before the new Story.
- `data/s005-communicative-judge-rules.js`: removed; no second legacy registration.

The shared Engine, Speech, Recognition, QuestionManager, Judge, Support Controller,
Presenter, Audio, UI/CSS, Fixed Stage, Save, other Stories, Battle and Camp are
unchanged. The architecture test checks 87 shared source files against their
formal-base Git blob hashes; the commit is built on the complete base tree.

## Scene order

1. Town arrival and missing bag.
2. Choose the hotel rather than camping.
3. Reception: Challenges 1–5.
4. Follow the unseen visitor.
5. Meet Ben: Challenges 6–9, color Stage 0→1.
6. Police station and bakery; keep Stage 1.
7. Recover the bag: Challenge 10, color Stage 2.
8. Explain the footsteps and disappearing color.
9. Introduce Ben: Challenge 11, color Stages 3→4.
10. Return before twelve: 11:55→11:57→11:58→11:59.
11. Kong's king-size bed and “Good night!”.

Graphic references are explicit current-branch paths. The four finalized safe-v2
graphics and existing Ben stage images are used without path replacement code.
All 21 referenced graphics were decoded in browser verification.

## Support contract

The existing common Controller owns Support state. Each Challenge begins at 0;
only a Support action advances 0→1→2→3→3. Retry, REJECT, UNKNOWN and speech failure
preserve the current stage. English/Japanese controls only change presentation.
Stage 3 keeps Retry available. No S005-specific state machine is introduced.

## Validation and limits

Nine targeted suites pass: architecture, Story progression, communication data
and approved variants, common Speech/Judge/Lottery integration, Support state
matrix, real Presenter/DialogManager controls, and generic Formal flow regression.
Story progression is tested for both success and continue outcomes.

Browser verification at 844×390 follows all eleven Challenges through the final
Dialogue using the production shared runtime. It exercises Support 1–3,
repeated Retry and language controls, loads all graphics, and reports no script
errors. Only the native Recognition input is a test fixture outside Production.

Physical iPhone acceptance and native-microphone stability remain unverified.
No Speech timeout, recognition teardown, or Audio behavior is changed by this
Story/data rebuild. No new Trace or Diagnostic is added.
