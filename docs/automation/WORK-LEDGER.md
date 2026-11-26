# Persistent development ledger — PR 48
Director-approved scope: automation development only; no merge, no existing Story/Engine/Audio/Voice or PR40 changes; no new paid service. S008 remains unapproved. The ledger is a progress record, not a trust root or permission grant.

Baseline: 654665abb9c4eba944e23d0c7603576dd10f09ea; CI 45897237695 success. V10 behavioral evidence: docs/automation/cooperation-v11/evidence.json and QA-HANDOFF.md. Never transfer old CI success to a new SHA.

| Priority / ID | State | Start condition | Work / acceptance condition | Evidence / blocker |
|---|---|---|---|---|
| 1 CI-EVIDENCE | IMPLEMENTING | current PR head | PR update runs exact-head suite, emits JSON and logs even on failure | new evidence workflow; check artifact on latest run |
| 2 ROUTE | IMPLEMENTING | completed exact-head CI | PASS -> independent QA pending; FAIL -> developer triage package; unknown -> HOLD | no automatic permission to edit code |
| 3 REPAIR | LOCAL_VERIFIED | externally pinned fictional policy, known failure | quest_operate prepare/operate; request/response SHA-bound, real Git commit and retest | V10 169 tests; live external worker remains HOLD |
| 4 LIVE-AI | HOLD | existing subscription-authenticated Codex or authorized Work runtime | actual diagnosis, proposal, scoped commit, exact new SHA CI | no unattended Codex launch available in current connector; no API billing |
| 5 STORY | PARTIAL | Director-approved package and engine reference | existing V2 candidate format, runtime contracts; actual browser and legacy Save validation | fictional-only repair scope; S008 not approved; no deployed-engine change |
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
