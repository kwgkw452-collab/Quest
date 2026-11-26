# V11 independent QA handoff — PR 48
Status: DRAFT / NO MERGE / independent QA NOT_ASSESSED.
Repository kwgkw452-collab/Quest. Production base 70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f.
Behavior baseline daf7fbcd095019ac7c0af567662528ce0d608edd.
Actual CI: https://github.com/kwgkw452-collab/Quest/actions/runs/45895995868/job/140169903106
169 tests OK; 61 changed paths; zero frozen-path violations. The baseline job has no downloadable artifact; its log is the evidence.
For any newer candidate, record actual PR head/base and rerun; never transfer the old PASS.

## Independent reproduction
Use a disposable checkout of the exact candidate SHA, Python 3, Node and OpenSSH ssh-keygen. No API keys or paid dependencies. Do not execute unreviewed candidate code in a privileged environment.
From the checkout:
```sh
PYTHONPATH=scripts/qa_guard python3 -m unittest discover -s scripts/qa_guard -p 'test_*.py' -v
PYTHONPATH=scripts/cooperation:scripts/qa_guard python3 -m unittest discover -s scripts/cooperation -p 'test_quest_operate.py' -v
```
The first command includes the cooperation tests through the existing bridge. The second isolates the seven V10 CLI cases. Expected: baseline 169/169 and 7/7 respectively.
Inspect test_quest_operate.py for the complete temporary Git fixture and expected results:
- real CLI prepare, operate, response consumption, exact scoped commit, local PASS
- wrong response paths, altered policy, candidate-local control files: HOLD
- concurrent head change, production branch: HOLD
- declared safe-area subject box below y=612, wrong save identity: rejected
- CI pending stays pending, failed CI: HOLD (injected CI records)
- signed HOLD remains HOLD, mutated signature/PR context rejected (disposable test key)
- live worker invocation uses a deterministic proposal double, not actual AI.
The original CI log prints the explicit V10 evidence chain.

## Separate gates
Machine tests are not independent QA. Reference modules are byte-pinned copies of the V2 candidate, not the deployed engine. Graphic checks cover PNG framing/dimensions and declared bounding boxes, not actual image subject detection. Save checks cover schema/namespace only. No physical browser, old Production Save, or real V10/V11 Codex repair proof.
Formal QA trust must originate outside producer control; use independently approved verifier, policy digest, signer bytes and external trust commit. No production QA private key in candidate checkout. Do not rely on candidate-modifiable verifier or expectations as authority. Test SSH keys never qualify.
A real subscription worker requires existing ChatGPT-authenticated Codex CLI, no API keys or extra paid credits. Do not claim live proof until its actual execution is recorded.
QA must independently review baseline and candidate changes, compare exact SHA and approved expectations, and report PASS/FAIL/HOLD with evidence. Only Director may authorize integration. No changes to PR40, Production, existing Story, engine, Audio/Voice through S015. S008 unapproved.
