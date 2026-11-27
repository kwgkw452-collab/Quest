# Common Engine V2 — completion candidate

This candidate starts at PR #34 head `9492a424a151751c6dcaca4326eb806a07f688b3`. The heads of PRs #14–34 are ancestors of that checkpoint or share its head. The candidate keeps their existing cumulative work and limits new changes to the isolated player and its verification.

## Faults addressed

- The Chromium session-switch test expected the opening of S005 after an earlier scenario had saved a later scene. Reset that scenario's starting fixture and keep its callback, loading, Next and microphone assertions.
- A malformed Story package could erase the existing checkpoint when the player restarted. Validate and construct the new runner before clearing the old checkpoint. The browser regression supplies a malformed package and compares the saved snapshot before and after.

## iPhone independent QA

1. Open the candidate's immutable HTTPS preview in Safari. Record the candidate SHA, iPhone model, iOS version and browser. Use the renamed branch only for GitHub review. Its preview files live under `prototype/common-engine-v2-audiofree/`.
2. Start S005, S006 and S007 from the Story selector. In portrait and landscape, check the scene artwork, Japanese Goal, buttons and the safe area. Verify the S006 bilingual letter and S007 Scene 12 Meg joining followed by Scene 13.
3. Use the actual microphone. Check a model answer, a known approved alias and a wrong answer. Open Pico support repeatedly, retake the same question, then enter the next one. Check the three-stage cap and reset. Press Next and Talk repeatedly, switch Stories during recognition, and confirm that late results do not affect the new Story.
4. Reload from a mid-Story checkpoint. Check the scene, backdrop and progress. Confirm a failed load keeps the previous checkpoint. Test Monster Vocabulary with the existing automated fixture separately from the public S005–S007 Story catalog.
5. Record the observed result per case. Audio playback and Production save compatibility require their own evidence. Review S005's 12 source calls versus the 11-question handover, the approval of S007's communication corpus and the approved S006 expectations. Independent QA decides final PASS. Director approval is required for Production.

CI runs and exact candidate SHA are linked on the Draft PR. A browser run with simulated recognition provides technical evidence for navigation and local Judge behavior. Actual iPhone recognition requires physical-device testing.
