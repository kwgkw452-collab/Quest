# Common Engine V2 — executable isolated vertical slice

This implementation is an **experimental prototype only**, not the approved replacement for Eigo DE Quest Production.

Run: `node --test prototype/common-engine-v2/story-runtime.test.cjs`.

Features in this vertical slice: validated declarative packages; dialogue, question, exact-match fixture judge, feedback model and Pico support 1→2→3→3; attempted Speech through an injected mock; cancellation and stale result dismissal; scene transition; flags through Save callback; completion. No Story-specific code is required; 100 synthetic IDs can execute using the same runtime.

**Important limits:** No real SpeechRecognition, iPhone audio, BGM/Voice mix, HTML/CSS renderer, fully supported Document or Monster Battle, existing S001–S007 conversion, actual legacy Save migrations, CI gate, independent QA, or Production integration. Some schema constraints remain provisional and incomplete. Passing unit tests cannot be represented as browser or real-device PASS.

Base design: `4c97d090261ffcfe4f056cb7004c5b876400afb1`.
This prototype runs only on an isolated branch; Production stays unchanged. Independent QA and director approval are required before integration.
