# Free QA Guard V1 — Eigo DE Quest

**Goal:** start protecting the project without a new subscription, paid AI API, or repeated manual copying of test commands.

## Scope of this pilot

On a pull request **targeting `s005-fixed-195-stage-clean-test`**, GitHub Actions checks the exact base and head commits, detects paths belonging to frozen S001–S004 Stories or Audio/Voice/BGM/Sound, and marks the check **FAIL** if those files changed. New Story paths such as S008 and S015 stay allowed. A small Python unittest suite exercises the gate. The guard uses only Python standard library and GitHub-hosted Actions.

This is the **first automated, deterministic check**, **not** automated multi-AI programming or independent QA certification. It does not certify accepted dialogue, images, speech behavior, save compatibility, or full Story completion. It does not invoke an AI API, change Production, or auto-merge. Failed checks are visible in PR Actions and do not require new manual comments.

## Safety and activation

- This Draft PR **must not be merged without independent QA and Director authorization**.
- An Actions failure is a warning, not a hard merge ban unless repository admins configure **branch protection or repository rulesets** to require the named check **Protect S001-S004 and Audio (no paid API)**. Direct pushes also require branch protection. GitHub may have plan-specific restrictions on rulesets, so verify current available controls instead of assuming enforcement.
- During the very first installation PR, the proposed guard runs from the PR branch; **after installation**, the workflow deliberately runs the guard loaded from the *base SHA*, preventing a future PR from silently weakening only the Python guard. Admin-controlled protection of workflow/guard changes is still recommended because editing the workflow itself can bypass checks if not protected.
- This guard is not a replacement for independent QA or Director sign-off.
- Public repository GitHub-hosted standard Actions are generally provided at no charge; monitor GitHub billing and do not enable paid runners or external AI APIs. No secret tokens are requested.

## No interruption of existing work

PR #40 remains an independent Draft development/QA candidate. This pilot branch starts from the official Production baseline, **does not touch PR #40**, and changes only this workflow, guard script, tests and documentation. It is not a new Engine V2 candidate and should not cause a redesign or delay S008 Story production.

## Next phase, only if this pilot passes

Add actual source-of-truth rules per Story (question IDs, explicit ACCEPT/REJECT/UNKNOWN examples, assets, expected ending flags), version them alongside approved Director decisions, and automatically generate focused per-Story CI tests. AI implementation and independent AI QA orchestration are **not installed by this PR**; permission and cost must be reviewed separately.
