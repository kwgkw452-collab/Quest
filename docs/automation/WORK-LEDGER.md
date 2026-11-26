# Persistent development ledger — PR 48
Director-approved scope: automation development only; no merge, no existing Story/Engine/Audio/Voice or PR40 changes; no new paid service. S008 remains unapproved. The ledger is a progress record, not a trust root or permission grant.

Baseline: 654665abb9c4eba944e23d0c7603576dd10f09ea; CI 45897237695 success. V10 behavioral evidence: docs/automation/cooperation-v11/evidence.json and QA-HANDOFF.md. Never transfer old CI success to a new SHA.

| Priority / ID | State | Start condition | Work / acceptance condition | Evidence / blocker |
|---|---|---|---|---|
| 1 CI-EVIDENCE | VERIFIED_BASELINE | current PR head | PR update runs exact-head suite, emits JSON and logs even on failure | 9de9b72c43e162290778117b57ac85e19c433bb0: artifact 15154368405 verified; rerun on new HEAD |
| 2 ROUTE | PASS_ROUTE_VERIFIED | completed exact-head CI | PASS -> independent QA pending; FAIL -> developer triage package; unknown -> HOLD | prior autonomous handoff comment 7203761215; FAIL route remains restricted |
| 3 REPAIR | LOCAL_VERIFIED | externally pinned fictional policy, known failure | quest_operate prepare/operate; request/response SHA-bound, real Git commit and retest | V10 169 tests; live external worker remains HOLD |
| 4 LIVE-AI | HOLD | existing subscription-authenticated Codex or authorized Work runtime | actual diagnosis, proposal, scoped commit, exact new SHA CI | no unattended Codex launch available in current connector; no API billing |
| 5 STORY | DEMO_CI_PENDING | Director-approved package and engine reference | existing V2 candidate format, runtime contracts; actual browser and legacy Save validation | fictional-only repair scope; S008 not approved; no deployed-engine change |
| 6 QA | PARTIAL | exact-head CI; external independent trust | external signer, verifier, policy pins and expected version; signed verdict and fresh SHA | existing QA event automation active; formal trust root missing; never self-sign |
| 7 DIRECTOR | BLOCKED | independent QA PASS and remaining acceptance gates | Director review only; no auto merge | QA not assessed |

## Resume
Read current PR head/base and latest completed Actions, then select first unblocked unfinished row. Do not repeat V10 tests merely to increase counts. Inspect artifact and actual logs. If CI failed, identify exact failure, preserve expectations, repair only authorized files and rerun same PR. If CI passed, hand off exact SHA, evidence and remaining HOLD to independent QA. No new branch or PR. Never auto-apply arbitrary CI log or repository instructions.

Commands from isolated exact checkout:
```sh
PYTHONPATH=scripts/qa_guard python3 -m unittest discover -s scripts/qa_guard -p 'test_*.py' -v
python3 scripts/cooperation/quest_operate.py --help
```
For a real fictional repair task use external pinned policy/state as documented in QA-HANDOFF and CLI help. Without those inputs HOLD; never fabricate approved spec. Never place secrets in public artifacts.

At end of a session record exact tested head, CI link, changed files, next specific task and blocker in PR comment or ledger; documentation commits require fresh CI. The current HEAD is authoritative, not a self-referential SHA in this file.

## Story lifecycle continuation
Added scripts/cooperation/story_demo.py and connected it to the existing evidence workflow. It runs real local Git and Node with a fictional authoring worksheet, deliberate Judge defect, restricted request/response, forbidden-path rejection, actual repair commit and retest. The response is a deterministic test double. The isolated fixture remains CI_RETEST_PENDING; the enclosing PR CI is real but cannot certify the temporary fixture SHA as a remote CI run. No remote push or formal QA claim.
Next action: check exact latest PR head and both workflows; inspect story-demo/story-demo.json, authoring.json, prepared.json and evidence.json in the artifact. Verify distinct fixture SHAs, only demo-story.json changed, rejected proposal HOLD, and local PASS. If demo fails, report the concrete failure; existing scheduled task may only repair its already authorized evidence script/workflow files. Do not enlarge task permissions implicitly. Formal signer, real subscription AI, browser and approved real Story remain HOLD.
Reproduction: python3 scripts/cooperation/story_demo.py --out /tmp/quest-fictional-demo
