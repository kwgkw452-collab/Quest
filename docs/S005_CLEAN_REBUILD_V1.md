# S005 Clean Rebuild V1 — latest LOCK

Base: `cb391376267fcaf58ddcab663930cbe5bb04fe1f`, branch `s005-fixed-195-stage-clean-test`.

This specification supersedes the prior eleven-task rebuild. Priority is the latest user-provided Clean Rebuild specification, latest locked S005 details, completed shared S004 foundations, then old branch content only as reference.

## Content

- Eleven Scene sequences use the existing StoryCommands/StoryEngine/EventSystem. No Scene callbacks, runtime branches or S005-specific Engine/Controller/Presenter are introduced.
- Twelve declarative Communication definitions use existing QuestionManager, Speech, local Judge, Lottery and Support. Four guests are player, Kong, Pico and Bernie; Pico is counted. The player remains the camera POV.
- Challenge 2 is Four / 4人です。 Challenge 3 asks for a king-size bed; Challenge 4 requests One king-size bed, please. The other goals retain their narrative purpose.
- Ending order: Ben “My color is back!” → 町の人 “How cute!” → Kong “Ben is cool!” → final Communication 12 “His name is Ben.”

## Common Support, without the S005 five-button additions

The existing common Controller owns stage 0→1→2→3→3. Retry, REJECT, UNKNOWN and speech failure preserve stage; only a new Challenge resets it. No S005-specific Support implementation is added.

The prior Communication Presenter additions that captured Story Questions and appended English/Japanese controls are removed. Recovery retains the existing three actions: Retry, Pico Support, Continue. Dialogue translation in PicoSupportController and DialogManager is unchanged. The generic common Formal-flow regression verifies non-S005 behavior.

SpeechRecognition Adapter, SpeechEngine, QuestionManager core, Judge core, Audio, DialogManager, CSS/UI dimensions, Fixed Stage, Save, other Stories, Monster Battle and Camp remain unchanged. Eighty-six shared source files are checked against base Git blob hashes. Presenter removal is the only shared-runtime change; it deletes old UI additions rather than adding a new path.

## Graphics

Original adopted assets remain in the repository. Ten identity-preserving edited compositions are saved under `images/005/clean-v1/`, using the built-in image_gen tool. Inputs and the final prompt set are recorded in `docs/S005_GRAPHIC_PROMPTS.json`.

Frames use player POV, the official two-horned Kong, and reserved quiet lower foreground for the Dialogue Box. New complete scene compositions replace old character-overlay placements; Ben is rendered once per scene, with intermediate color stages represented by explicit backgrounds. The four already adopted safe-v2 backgrounds are retained where compatible. No Graphic path-replacement callbacks or CSS offsets are added.

## Verification

Targeted tests cover twelve ordered goals, four guests, the added bed request, final Communication order, Support state/retry retention, the three-action recovery UI, shared Speech/Judge/Lottery, all eleven Scene sequences and both success/continue Story outcomes. Browser verification uses the actual shared runtime at 844×390; only native Recognition input is a test fixture.

Physical iPhone acceptance and native microphone stability are not claimed. No Production Trace or Diagnostic is added.
