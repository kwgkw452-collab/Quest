# Eigo DE Quest — Zero-cost QA Guard V1

## Goal and boundaries

Enable repeatable, free automated PR checks without adding an AI API subscription or interrupting new Stories. Official Production is `s005-fixed-195-stage-clean-test`; Audio is frozen until after S015. Work drafts and independent QA remain separate. **This pilot neither alters Production nor merges any branch.**

The pilot provides a `pull_request` GitHub Actions job, read-only `GITHUB_TOKEN`, Python standard-library policy, 10+ tests including real local Git fixtures, an Actions step summary of the exact base/head SHA, PASS/FAIL, and changed-path count; and a machine-readable JSON repair handoff printed in the CI logs.

## What is checked automatically

- S001–S004 source and images, including files with those episode IDs
- Audio/Voice/BGM/Sound sources and audio file formats
- Approved specification folder `docs/approved/` and the guard's source/workflow files
- Ordinary new Story files (e.g. S008 and later) remain allowed
- Git comparisons use exact `pull_request.base.sha` and `pull_request.head.sha`, not a floating branch name
- Findings are visible in GitHub Actions with error annotations and a readable step summary

**This checks file-path scope, not Story correctness or semantic changes to generic engine files.** It does not provide independent QA PASS, automated AI coding or automatic repair. An Actions FAIL *by itself* does not enforce a merge ban.

## Critical hardening requirement: GitHub ruleset

A `pull_request` check runs workflow code from the proposed merge result. Consequently, a malicious or mistaken PR could change the workflow itself. The checker reports changes to its own files, but **cannot reliably protect itself alone**.

The repository is **public**. GitHub Free supports branch rulesets for public repositories, including **required status checks**, **require a pull request**, **prevent direct pushes**, and **restrict file paths**. Thus an administrator can apply a **server-enforced repository ruleset** to Production independently of the PR's submitted workflow:

1. GitHub repository **Settings → Rules → Rulesets → New branch ruleset**; target only `s005-fixed-195-stage-clean-test`.
2. Require pull requests before merging, block force pushes, and prohibit direct pushes/bypasses where available. Keep independent QA and Director approval separate.
3. Require the status check `Protect S001-S004 and Audio (no paid API)` after this PR is installed and the check has run against a Production-targeting PR.
4. **Only if the current GitHub plan/repository Settings offers the restriction without an upgrade**, add **Restrict file paths** for critical policy files, at minimum `.github/workflows/qa-guard-free.yml`, `scripts/qa_guard/**/*`, and `docs/approved/**/*`. Extend server-side restrictions to specific frozen S001–S004/Audio paths in existing Production after inventory and test these against new Story file names; do not broadly block `prototype/common-engine-v2-audiofree/**`.
5. If **Restrict file paths** is not available on the free plan, do not buy a paid tier merely to enable it. The checks then remain best-effort rather than tamper-proof; enforce PR reviews and required checks, and explicitly record the residual bypass risk. Do not claim the policy is impossible to bypass.\n6. Do not allow automated bypass. To update the guard or a formally approved specification, use a clearly recorded Director-authorized temporary exception and independent QA; restore protection afterward.

**No ruleset or Production setting has been changed.** The controls are not active as merge enforcement until a repository administrator configures them. Ruleset UI details and available features must be verified against the repository's live Settings.

References:
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets

## Why we do not use pull_request_target

GitHub announced an upcoming **December 2, 2026** default security policy enforcement for `pull_request_target` on affected public repositories. That event also runs in a more privileged trust context. The pilot therefore deliberately uses the ordinary read-only `pull_request` workflow plus GitHub's independent server-side ruleset rather than relying on a future-blocked privileged event. Relevant GitHub advisory:
https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target

## Cost and rollout

- Public repository; standard GitHub-hosted Actions are free, under GitHub's current public repository policies.
- No new SaaS subscription, paid runner, LLM API, external secrets or agent execution token.
- This PR remains **Draft**; independent QA and Director approval are required to install it on Production.
- Do not enable a premium service or billing setting automatically.
- Once installed, the guard will run on future PRs **targeting Production**. Stacked draft PRs that target other feature branches are outside the automatic check until a Production-targeting candidate is opened.
- Existing PR #40 is untouched. New S008+ Story production can continue in parallel; no redesign or Audio work is authorized.

## What remains unimplemented

**Autonomous multi-AI execution and QA-to-Work repair handoff have NOT been installed.** GitHub Actions can trigger deterministic checks for free, but unattended AI execution requires a permitted agent runner and credentials/access, whose free availability has not been established. Existing connected QA automations, where operational, may help monitor PR events; this PR does not configure them.

A successful pilot means **less manual inspection of scope**, not that the whole 1-Story-per-day development pipeline has been automated.

## Machine-readable QA → developer handoff

Each Production-targeting PR now produces a compact JSON payload in the workflow log (headed `QA handoff JSON (exact base/head):`). No separate storage or paid service is used. The object fields include:

- `schema: quest-free-qa-handoff-v1`
- `base_sha`, `head_sha`, `scope: filename-diff-only`, `changed_count`
- `status: PASS|FAIL`, array `violations[{path,reasons,action}]`
- `next_action` for the developer or independent QA
- `independent_qa: NOT_ASSESSED`, `production_merge: NOT_AUTHORIZED` regardless of scope result

**Design intent:** a separate authorized AI execution process could parse this exact-SHA JSON rather than asking the Director to carry the report manually. **Current status:** the payload generation and parsing tests run; the separate automatic AI task execution is still NOT connected. The existing independent PR monitoring automation may inspect GitHub CI but it does not automatically apply a fix.

Never feed an unverified repository comment or an arbitrary filename into an automated shell command as instructions. The handoff is evidence, not a command execution grant.

## Validation log

- GitHub Actions run `45805073491`, candidate SHA `c94ab6bc6480ee634a8b2e225876d195b8eacb3d`: 15 offline tests passed, including a temporary Git repository checking that both PASS and FAIL reports are strict JSON and preserve independent-QA/Director authority.
- Production remains unchanged. Independent QA and branch-rule deployment are still HOLD.

## Free coordination state machine (implemented)

`scripts/qa_guard/coordination.py` is a read-only **role router** that consumes the exact-SHA machine report, and optionally a future independent QA verdict of schema `quest-independent-qa-verdict-v1`. It neither invokes an AI API nor changes GitHub branches, issues, PRs or QA verdicts.

The current `pull_request` workflow actually calls this program following the scope scan and displays the next role in the GitHub Actions summary. On the first installation, and on all future ordinary PRs, both modes must generate a JSON handoff. The bootstrap and normal branches are checked by an automated workflow-contract test.

| Input | Next machine-reported gate | Intended role |
|---|---|---|
| Frozen-scope FAIL | `DEVELOPER_REPAIR` | Production developer fixes the same PR |
| Frozen-scope PASS, no independent QA evidence | `INDEPENDENT_QA_PENDING` | Independent QA |
| QA evidence with different head/base SHA | `QA_SHA_STALE` | Independent QA rechecks latest exact SHA |
| QA FAIL | `QA_REPAIR_REQUIRED` | Production developer |
| QA HOLD / UNKNOWN | `INDEPENDENT_QA_PENDING` | Independent QA |
| Matching QA PASS | `DIRECTOR_REVIEW_PENDING` | Director verifies the QA decision and decides separately |

**Every output contains `merge_authorized: false`.** A forged machine report claiming independent QA PASS or Director authorization is rejected. The future QA input is *advisory until the authenticity of its independent source is verified*. Even a matching QA PASS does not trigger a merge or prove the reviewer identity.

This is the most that can be safely automated with a **zero-cost, read-only** GitHub Actions worker and no AI agent execution credentials. Running an actual coding agent on the next role is a separate, unavailable deployment step; it cannot be claimed complete in V1.

### Current evidence

The coordination workflow was tested in GitHub Actions `45805996029`: it printed `INDEPENDENT_QA_PENDING` with `merge_authorized: false` for the exact PR head; **26 Python tests passed**. The bootstrap JSON missing-report defect found in a previous CI run was fixed before that successful run. Machine scope PASS is not independent QA PASS.
