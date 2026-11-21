# Historical tests — NOT current expectations

These verbatim copies preserve the superseded assertions. They are excluded from `npm test` and are not reported as PASS.

- `s006-v1/`: old cart Q7, old Q9, V1 concepts/pools. Replaced by the Final Review contract and V2 runtime tests.
- `pre-engine-guard/formal-communicative-isolation-v1.test.js`: obsolete whole-file hashes. Replaced by the Production lock baseline plus retained loading-order/runtime checks.
- `pre-engine-guard/s005-clean-rebuild-v1.test.js`: hashes of cb391376 and a single-wrapper assumption. Replaced by full Production S005 identity, registry order and common UI checks.
- `pre-engine-guard/s005-support-controller-production.test.js`: expects old hint immediately after Retry. Current contract displays the latest recognition first, then redisplays the retained hint stage.
- `pre-engine-guard/s007-delta.test.js`: missing setFlag stub, obsolete 11-scene count, former utterances and external asset-manifest. Replaced by actual 13-scene/model registrations and Git asset locks. Alternate S007 utterances need their own canonical specification before being promoted to current expectations.

No historical data is loaded by index.html or dev.html. Git history is preserved.
