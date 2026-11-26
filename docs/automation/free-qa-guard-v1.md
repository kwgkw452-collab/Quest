# Eigo DE Quest — Zero-cost QA Guard V1

## Goal and boundaries

Enable repeatable, free automated PR checks without adding an AI API subscription or interrupting new Stories. Official Production is `s005-fixed-195-stage-clean-test`; Audio is frozen until after S015. Work drafts and independent QA remain separate. **This pilot neither alters Production nor merges any branch.**

The pilot provides a `pull_request` GitHub Actions job, read-only `GITHUB_TOKEN`, Python standard-library policy, 10+ tests including real local Git fixtures, and an Actions step summary of the exact base/head SHA, PASS/FAIL, and changed-path count.

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
4. Add **Restrict file paths** for critical policy files, at minimum `.github/workflows/qa-guard-free.yml`, `scripts/qa_guard/**/*`, and `docs/approved/**/*`. Extend server-side restrictions to specific frozen S001–S004/Audio paths in existing Production after inventory and test these against new Story file names; do not broadly block `prototype/common-engine-v2-audiofree/**`.
5. Do not allow automated bypass. To update the guard or a formally approved specification, use a clearly recorded Director-authorized temporary exception and independent QA; restore protection afterward.

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
