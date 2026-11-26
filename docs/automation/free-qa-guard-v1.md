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

## Verified November 26, 2026

- Repository metadata reports `visibility: public` and the official Production branch remains `s005-fixed-195-stage-clean-test`.
- The original PR #41 Actions job `45799426272` completed successfully. Its log showed an exact PR-base/head diff of four files and four offline guard tests passing.
- Following audit we extended the guard to protect future changes to the guard workflow, its source code and `docs/approved/`, while allowing the one-time installation using `--bootstrap` **only when the exact PR base has no guard**. Subsequent requests load the **base SHA's guard source**, not the contributor's modified checker.
- Audio-free prototype paths are not incorrectly blocked just because they contain `audiofree` or `audio-free`; changing a real Audio source file or audio-format asset remains a freeze violation.
- These checks are **file path protections**, not a semantic guarantee that generic code cannot affect Audio or previously published Stories.

## GitHub Free activation (admin operation, not done by this PR)

The repository is public, and standard GitHub-hosted GitHub Actions are free. A public GitHub Free repository can also use branch protection/rulesets. An administrator should inspect **Settings → Rules → Rulesets** (or Branches) and set a ruleset specifically targeting `s005-fixed-195-stage-clean-test`:

1. Require a pull request before merging; prohibit direct pushes; apply to admins where available.
2. Require the status check `Protect S001-S004 and Audio (no paid API)` from the installed Free QA Guard workflow; make sure the check has first run on a PR targeting Production.
3. Keep independent QA verification and Director approval as **separate explicit responsibilities**. A machine PASS does not certify Story quality. Human reviewers can be required where repository roles make that useful.
4. Disable bypass allowances except for explicitly authorized incident recovery, and avoid making these changes until Director approval.

**Important:** GitHub branch/ruleset configuration itself has NOT been changed. Without these settings, an Actions FAIL is observable but does not reliably block an administrator or direct push. Do not present the system as a fully automated multi-agent system.

**Zero-cost boundary:** no additional provider subscription, AI API, premium runner, paid marketplace app, or new secrets. GitHub Free standard runners for this PUBLIC repository; plan/repo visibility changes require reassessment. An AI that writes fixes automatically would need an independently authorized, budgeted execution route and is intentionally excluded from V1.

## Trusted-base CI security improvement (November 26, 2026)

A second workflow `.github/workflows/qa-guard-trusted.yml` runs on **`pull_request_target`**. Once this PR is installed in Production, its workflow definition and checkout are resolved from **the trusted Production base**, not the submitted branch. It fetches the PR's GitHub read-only head ref for a name-only diff, validates the fetched SHA matches the event's expected SHA, and executes **only the guard and tests from the base checkout**, never an untrusted PR script.

This avoids the central limitation of the initial `pull_request` workflow, where a PR can also edit its own CI workflow file. The initial `pull_request` job stays as an unprivileged bootstrap/fast check; the **trusted check must be the required branch rule** once this pilot is installed. The trusted workflow will not run on PR #41 itself because it is not yet present in the Production base; its static contract is regression-tested now, but its live activation must be checked after the Director authorizes installation.

**Required GitHub rule check name:** `Trusted Production frozen-scope check`. Do not rely solely on `Protect S001-S004 and Audio (no paid API)`, the less-trusted bootstrap check. Both jobs use only GitHub-hosted Ubuntu, local Python, and `contents: read` permissions.

Any change to either workflow, `scripts/qa_guard/`, or `docs/approved/` intentionally fails the guard after bootstrap. Thus updates to the guard itself require explicit administrative exception and independent review, not a silent PR edit. This is a security property, not a promise that routine updates will pass without maintenance.

## Deliberate limits of V1

- The path policy checks changed **filenames**, not semantically equivalent changes to generic files, runtime imports, browser behavior, or Story dialogue. Independent QA remains necessary.
- The trusted check is not active until the workflow is installed on the Production branch and a GitHub admin makes it a required status check. **No branch/ruleset configuration is changed here.**
- Rulesets and approval restrictions must be checked on the actual repository Settings screen; no automatic Production merge is requested.
- No AI review/fix scheduler or agent-to-agent handoff is installed. Without an authorized agent runtime, claiming an autonomous AI relay would be inaccurate.
