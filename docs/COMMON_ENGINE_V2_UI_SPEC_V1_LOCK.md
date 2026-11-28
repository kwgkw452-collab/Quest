# Eigo DE Quest — Common Engine V2 Unified UI Specification V1.0

**Status:** Director-approved UI contract (2026-11-28), specification-only branch.
**Scope:** Shared V2 UI for S005–S100, evaluated first against S005–S007.
**Authority:** Director approval is for the rules below; this is **not** an implementation PASS or authorization to merge to Production.

## 1. Purpose and separation

Rebuild the common Story engine to remove the complexity of old Story-specific implementations. Reuse approved Story content, graphics, pedagogical/Judge rules, without blindly copying legacy UI code. All stories use one shared UI system and Story data; no Story-specific CSS hacks.

There are **two different Pico Support functions**, which must never be conflated:
1. Dialogue translation/display support in ordinary Story lines.
2. Three-level pedagogical hints during a Communication Challenge.

## 2. Geometry and controls — mandatory

- Reference game artwork/stage: **1560 × 720**, ratio **13:6**.
- Dialogue UI baseline: **two rows, 108 reference-stage pixels**.
- Three-row mode: **140 reference-stage pixels**, **only while yellow speech-recognition feedback** (e.g. `"..." と聞こえたよ`) is being shown. Do **not** enter 140 mode just because Pico Support is open, translation is visible, or a three-stage hint was requested.
- Coordinate contract: those are dimensions relative to the reference game stage; scale the whole stage consistently for a smaller device. Do not equate CSS pixels on a responsive phone with reference-stage pixels. No content-driven height growth.
- Buttons: **left-aligned, one horizontal row, intrinsic/content-sized widths**, stable gaps, never full-width/stretch, never wrap to a second row; retain safe tap targets without changing the agreed geometry. If there is insufficient width, apply stage-consistent scaling or an accessible internal scrolling solution; do not wrap buttons or grow dialogue height.
- Long text is contained/scrollable inside the reserved region; buttons remain visible. No unintended overlay, clipping, or page-level horizontal overflow.
- Artwork under the dialogue and character framing must respect 108/140 reference pixels. Do not silently mutate approved graphics.

## 3. Ordinary Story dialogue Pico Support

| State | Visible text | Exact button order |
| --- | --- | --- |
| Normal | English dialogue (no automatically revealed Japanese translation) | 次へ / ピコサポート |
| Support opened | English dialogue or language selected by user | 次へ / 英文を見る / 日本語を見る / もう一度聞く |

- Both states remain **108 reference pixels, two rows**.
- `英文を見る`: show the current English dialogue.
- `日本語を見る`: show its approved Japanese translation, not an invented or machine-guessed translation.
- `次へ`: advance the dialogue.
- `もう一度聞く`: control reserved for replay; **disabled with a clear unavailable state during the S015 Audio/Voice freeze**. No fake replay or new playback implementation.
- Buttons remain left aligned and on one horizontal row in both states.

## 4. Communication Challenge Pico Support

- Communication uses the Japanese **Goal constantly displayed** and speech input to resolve the situation.
- Challenge controls in the standard interaction: **話す / ピコサポート / 冒険に戻る**, left aligned, horizontal.
- 3-stage pedagogical hint progression on successive requests: **0 → 1 → 2 → 3 → 3**. A new question starts at 0. State must persist on speech retry within the same question.
- **Support 1**: prompts the learner to think/speak in English, **without revealing the full model answer**. This is an English-language prompt/scaffold, not merely a Japanese encouragement; exact approved wording is Story/question data and must not be guessed from the answer.
- **Support 2**: more specific English vocabulary or structural guidance, short of automatic acceptance.
- **Support 3**: sufficient assistance including a model English utterance.
- Displaying a hint never itself triggers an ACCEPT. Keep approved tri-state Judge logic `ACCEPT / REJECT / UNKNOWN` and individual question rules.
- Opening Support 1, 2, or 3 does **not** cause the dialogue to expand to 140.

## 5. Speech recognition feedback

- The **only** transition to **140 reference pixels / three rows** is when showing yellow recognized-result feedback, such as `“…“ と聞こえたよ`. The Goal remains visible and buttons stay in one horizontal row.
- Upon leaving recognized-result feedback, return to 108 reference pixels / two rows.
- Listening status and ordinary support hints do not independently trigger 140.
- Incorrect, unknown, and no-speech flows must preserve the challenge state and existing retry rules.

## 6. Shared V2 boundary

- Common Scene progression, Communication/Judge, vocabulary-only Monster Battle, versioned Save/restart and legacy Save compatibility as applicable.
- Story Challenges are Communication, Monster Battle is Vocabulary; do not mix.
- S005–S007 actual Story data, graphics, and approved acceptance logic are preserved.
- S001–S004 are not part of this refactor.
- **Audio/BGM/SE/Voice changes remain frozen until implementation of S015 is complete.**
- Production branch `s005-fixed-195-stage-clean-test` must not be modified or merged without explicit Director approval.
- Final PASS authority is the independent QA Lab, not the implementing agent.

## 7. Testable acceptance requirements

Automated real-browser tests must compare reference-stage geometry across landscape/portrait device viewports (including narrow iPhone), not just assert fixed CSS pixels:
1. All ordinary dialogue modes: two rows and 108 reference pixels.
2. Open ordinary Pico support: still 108, exact four buttons in one left-aligned row; approved translation revealed only on selection.
3. Communication stages 0–3: still 108, correct hints/stage progression and left-aligned controls.
4. Only yellow `〜と聞こえたよ` feedback: 140, three rows, returns to 108 afterward.
5. No full-width buttons, no two-row buttons, no character cropping induced by the layout, no unintended horizontal overflow.
6. Save/resume preserves state and speech retries do not reset stage; a new question does.
7. Record screenshot/measurements for S005–S007. Mock-mic CI alone is not independent or physical-device QA.

**Explicit non-approval:** Current PR #53 was developed with incorrect rules (support-triggered 140 and speculative English hint generation). It remains HOLD and must not be treated as proof of this specification. Correct implementation requires a separate reviewed diff and independent QA.

## 8. Future interactive English conversation at ordinary Story dialogue — reserved contract (Director request)

Ordinary Story dialogue is currently a **display-and-next** interaction, but later the same dialogue location may become **a player-spoken English exchange**. Do not make a separate incompatible player or change the artwork/layout contract.

**Already reserved in the V2 schema and runner, but deliberately inactive:**
- A Story `line` step may optionally contain `"futureConversation":{"mode":"reserved","challengeId":"<existing approved challenge ID>"}`.
- The referenced `challengeId` must exist in the Story's `challenges` dictionary and follow the shared Communication/Judge contract. No new or dynamic executable fields are accepted.
- The runner exposes `conversationHook:{mode:"reserved",challengeId:"..."}` on the line event. It **does not begin microphone recognition, change UI buttons, alter progression, call an API, or require Audio/Voice**.
- Existing `line` records without this optional field run unchanged, including save/resume. All published S005–S007 records remain unmodified.
- When dialogue speaking is explicitly activated in a future approved phase, it must reuse the common `Communication` pipeline: Goal, recognition/Judge tri-state, support stages, listening/feedback and cancellation. The 108 reference-stage baseline and 140 speech-feedback-only rule continue to apply.
- Any future mode besides `reserved` is rejected until a separately approved and tested schema revision. **No Audio/Voice freeze exception** is implied.

This reserves the data/runtime seam while keeping the feature disabled. It is a concrete implementation reservation, **not a claim that interactive spoken dialogue is already operational**.
