# Eigo DE Quest — Modular Common Engine V2 (isolated experiment)

This is an **executable technical prototype**, not an accepted production migration, and is not permitted to be merged into Production without independent QA and director approval.

## Components

- `schema.cjs`: validates a provisional declarative Story package and rejects unsupported steps, invalid references, undeclared Save keys, and executable callbacks.
- `communication.cjs`: isolated Communication state machine with injected Speech and Judge ports, stale-attempt protection, three-stage Pico Support and feedback view data.
- `runner.cjs`: Story progression, transitions, Save callback, feature ports, cancellation.
- `runner.test.cjs`: 19 Node unit tests including 100 synthetic Story IDs, no-speech, recognition feedback, cancellation, Save failure, and invalid schemas.

## Run

```sh
node --test prototype/common-engine-v2-modules/runner.test.cjs
```

The submitted module code and matching test logic were exercised locally under Node 22 with **19 passing tests**. GitHub Actions and independent QA results must be checked separately.

## Boundaries and unresolved work

No real browser SpeechRecognition, iPhone Audio, 2/3-row CSS, actual voice assets, production Save restore/migration, full document or battle renderer, approved S001–S007 migration, or complete capability catalogue. The exact string fixture judge is **not** an implementation of the approved Communicative Judge; its real rules and alternative acceptance remain separate.

**Bug risks and limitations requiring follow-up**: persistence callback currently assumes synchronous saves; async persistence needs a transaction contract. The communication module has no browser-specific microphone lifecycle or audio lease. Schema is intentionally narrow and will need `rules`, `pools` and authorized operation shapes before importing real stories. Runtime does not yet support resuming a scene after app reload.

Base comparison: Production `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`. Parent prototype PR #16; architecture Draft PR #14; review Issue #13.
