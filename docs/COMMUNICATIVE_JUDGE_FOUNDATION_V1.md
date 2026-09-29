# Communicative Judge Foundation V1.0

## Responsibility

Communicative Judge determines whether a recognized utterance safely satisfies a specified `conceptId`. It validates input, normalizes text, evaluates approved local variants, optionally reuses a closed Word Dictionary, evaluates explicit local reject rules, and returns one provider-neutral result shape.

It is Local First. A conclusive local result returns immediately. A local miss is not a learner error. If no provider is configured, the result is `UNKNOWN`. A future provider is an adapter beneath the Judge, not the Judge itself.

## Verdicts

- `ACCEPT`: an approved local variant, dictionary canonical, or future provider result safely satisfies the concept.
- `REJECT`: an explicit negative/reject rule or a different canonical in a closed set safely establishes a mismatch.
- `UNKNOWN`: local rules cannot decide, input is insufficient, no provider exists, or a provider times out, throws, or returns malformed data.

This is the No False Blame rule: dictionary absence, recognition uncertainty, provider failure, rate limits, and timeouts must not become learner failure.

## Input and result

Required input fields are `conceptId` and `utterance`. Optional fields are `alternatives`, `expectedUtterance`, `acceptedVariants`, `difficulty`, and a small `context` object such as `{ promptType }`.

The common result contains `verdict`, `source`, `reason`, `conceptId`, `normalizedUtterance`, `matchedVariant`, `confidence`, `retryable`, `providerTrace`, and retained `difficulty`/`context` values.

## Boundaries

- Word Dictionary owns canonical words, recognition aliases, and closed vocabulary sets. Its canonical string is not promoted to a global `conceptId`.
- Lottery Foundation owns what is selected: pool, item, display value, concept, prompt type, difficulty, expected utterance, and accepted variants. It does not judge speech.
- Speech owns what was recognized. This Foundation does not start, stop, retry, or configure recognition.
- Question, Monster, Morning, and Story own progress, support, retry, Skip, graphics, and gameplay. They are not connected in Phase 1.
- UI, Audio, Voice, Pico Break, and Pico Support are outside this Foundation.

## Local evaluation

Approved variants use normalized full-string equality, never substring acceptance. Explicit reject variants are checked before approved variants. A primary utterance is evaluated before recognition alternatives. Alternatives may provide an approved local match when the primary text is unknown.

The sample rule `shopping.fruit.apple.order` matches the Lottery Foundation sample and demonstrates approved requests and one explicit negative. Missing natural paraphrases remain `UNKNOWN` for a future provider or human-reviewed candidate process.

## Provider-neutral fallback

A future provider supplies an object with an asynchronous `judge(input)` operation returning the common verdict semantics. No HTTP client, API key, endpoint, provider name, model, quota, price, RPM, timeout constant, or vendor policy is embedded here. Provider replacement must not change `conceptId`, Local First, verdict semantics, or failure safety.

Provider timeout, exception, or malformed output becomes retryable `UNKNOWN`, never `REJECT`. A future cache may be inserted between Local and Provider without changing the public Judge contract.

## Future growth

A future growing dictionary may route `UNKNOWN` through Provider, Candidate, Review, and Approved states. Provider acceptance must never write directly into permanent local rules. Persistent cache, candidate storage, review UI, analytics, grammar scoring, pronunciation scoring, and adaptive learning are intentionally absent.

The Judge performs one evaluation and contains no retry loop. It returns `retryable`; a higher layer chooses Retry, Pico Support, Skip, or Story continuation. This preserves No Infinite Retry and keeps changing provider details out of the stable architecture.
