# Common Engine Isolation Guard — disposable feasibility spike

This is an **independent technical spike**, not the approved Phase 2 implementation and not a QA PASS. GitHub Production is untouched. Use Node.js 20+.

```sh
node --test prototype/common-engine-isolation/check-isolation.test.cjs
node prototype/common-engine-isolation/check-isolation.cjs <new-common-engine-dir> [story-packages-dir]
```

Exit 0: no findings; 1: violations; 2: missing path or invalid usage. The guard detects obvious story ID and asset-path dependencies in shared JS/CSS and checks the *proposed* restrictive story format for unknown steps, direct executable payloads, missing targets, and undeclared save keys.

**Limitations:** regex cannot prove semantic independence and can flag comments; schema checks here are incomplete (no asset hashes, complete reference graph, Save types or lifecycle semantics). This is not yet wired to required GitHub status checks. Only target the **new** runtime folder; checking legacy Production would report known existing violations. It must not be used as the sole approval gate. Independent QA must review this implementation and fixtures against the approved architecture.

Baseline design: `4c97d090261ffcfe4f056cb7004c5b876400afb1`. Review: Issue #13, Draft PR #14. No audio, Story, or Production implementation changed.
