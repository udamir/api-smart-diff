# AsyncAPI benchmark: api-smart-diff vs the Netcracker fork vs @asyncapi/diff and openapi-changes

Part of the api-smart-diff benchmark; the [overview](README.md) holds the shared methodology, the feature matrix, bundle sizes and the fork build validation. This report covers an event API in AsyncAPI 2.6 and 3.0 with a hand-written change set, synthetic wide documents of both versions and identical documents. Run with `npm run bench:asyncapi` and render with `npm run report` ([README](../README.md)).

> **Provenance.** Full run of 2026-11-21 (Node.js 26.13, Intel Core i9-9880H, 16 GB, macOS, laptop not idle). "asd 1.0.6" is 1.0.6 built from its source (commit aaed6b3), not the published package; "asd 2.0.0" is the pre-release build of 2026-11-21. See the [overview](README.md) for details.

## 1. Environment

|  |  |
| --- | --- |
| Date | 2026-11-21 |
| Node | v26.13.0, run as `node --expose-gc --max-old-space-size=8192 --stack-size=4000` |
| CPU / RAM | Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz, 16 logical cores, 16 GB |
| OS | Darwin 24.6.0 x64 |
| Builder | esbuild 0.28.2 (`scripts/build.js`) |
| asd 1.0.6 | api-smart-diff 1.0.6 built from its source (git commit aaed6b3), not the published package; allof-merge 0.6.6, json-crawl 0.5.3 |
| asd 2.0.0 | api-smart-diff 2.0.0 pre-release build of 2026-11-21; allof-merge 1.0.1, json-crawl 1.2.0 |
| fork | 4.0.1 at ce76b66 (develop); api-unifier 2.9.3 (source 7d58769), json-crawl 1.2.3 (source 43d5730), graphapi 1.0.14 (source 1089f0c), ddlapi stubbed (stubs/ddlapi.js), fast-equals 6.0.2, object-hash 3.0.0, flatted 3.4.4 |
| Go CLI | openapi-changes 0.4.3 (GitHub release binary) |
| npm peers | asyncapi-diff 0.6.1, microdiff 1.6.0, jsondiffpatch 0.7.7, deep-diff 1.0.2, fast-json-patch 3.1.1 |

## 2. Variants and peers

| Id | What | How it is called |
| --- | --- | --- |
| asd 1.0.6 | api-smart-diff 1.0.6, the published npm package | `apiCompare(before, after)`; AsyncAPI 2.x only (a 3.0 document would be compared as a JSON Schema, so those cells are n/a) |
| asd 2.0.0 | api-smart-diff, the build of this repository | `apiCompare(before, after)` (default `merged: "original"`); auxiliary row `merged: "normalized"` |
| fork 4.0.1 | `@netcracker/qubership-apihub-api-diff`, built from source (see the [OpenAPI report](OPENAPI.md) §2) | `apiDiff(before, after, { validate: true, liftCombiners: true, unify: true, allowNotValidSyntheticChanges: true, beforeSource, afterSource })`; AsyncAPI 3.0 only (it throws on 2.x) |
| @asyncapi/diff | AsyncAPI initiative, npm | `diff(before, after, { outputType: "json" })` on the raw documents (the library expects dereferenced input; it is given the same documents as every other tool) |
| openapi-changes | Go CLI (pb33f), release binary | `openapi-changes report --no-logo --reproducible before.json after.json`; it accepts AsyncAPI 3.x (not 2.x), so it runs on the 3.0 fixtures; timed as a process |
| floor | structural JSON diffs | `diff(before, after)` on the JSON documents; no classification |

## 3. Expected semantics and fixtures

Consumer viewpoint: a change is breaking when an existing client that follows the before document can fail against the after document. Messages the application produces (2.x `subscribe`, 3.0 `action: send`) are read by consumers and take response semantics; messages the application consumes (2.x `publish`, 3.0 `receive`) take request semantics.

### 3.1 Fixtures

| Fixture | Family | Kind | Description | Size (before / after, JSON) | Expected changes |
| --- | --- | --- | --- | --- | --- |
| `aa2-events` | asyncapi | changeset | AsyncAPI 2.6 event API (5 channels, $ref messages/schemas), 12 scripted changes | 3 / 3 KB | 12 |
| `aa3-events` | asyncapi | changeset | the same API as AsyncAPI 3.0 (channels + operations), the same 12 changes | 3 / 3 KB | 12 |
| `aa2-identical` | asyncapi | identical | aa2-events before document compared with itself | 3 / 3 KB | 0 |
| `aa3-identical` | asyncapi | identical | aa3-events before document compared with itself | 3 / 3 KB | 0 |
| `aa2-wide-500` | asyncapi | synthetic | AsyncAPI 2.6, 500 channels with inline payloads, 25 payload type changes | 92 / 92 KB | — |
| `aa3-wide-500` | asyncapi | synthetic | AsyncAPI 3.0, 500 channels + 500 send operations, 25 payload type changes | 146 / 146 KB | — |
| `aa2-wide-2000` | asyncapi | synthetic | AsyncAPI 2.6, 2 000 channels with inline payloads, 100 payload type changes | 373 / 373 KB | — |
| `aa3-wide-2000` | asyncapi | synthetic | AsyncAPI 3.0, 2 000 channels + 2 000 send operations, 100 payload type changes | 594 / 594 KB | — |

## 4. Correctness and classification quality

Columns and verdict letters as in the [OpenAPI report](OPENAPI.md) §4.

### 4.1 Totals over the curated AsyncAPI change sets

Headline timings: min ms of the in-process call; openapi-changes: process median minus the no-op invocation; `†` = that cell's correctness check failed.

| Tool | Change-set fixtures run | Detected | Precision | Class agreement | Breaking agreement | Risky | Described | `aa2-events` (min ms) | `aa3-events` (min ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 1.0.6 | 1 | 12/12 (100%) | 94% | 3/12 (25%) | 3/12 (25%) | — | 0% | 1.12 | n/a |
| asd 2.0.0 | 2 | 24/24 (100%) | 100% | 24/24 (100%) | 24/24 (100%) | — | 100% | 0.98 | 1.21 |
| fork 4.0.1 | 1 | 12/12 (100%) | 100% | 10/12 (83%) | 10/12 (83%) | 0/0 (1 risky) | 100% | n/a | 79.6 |
| @asyncapi/diff | 2 | 24/24 (100%) | 94% | 6/24 (25%) | 6/24 (25%) | — | 0% | 0.53 | 0.49 |
| openapi-changes (CLI) | 1 | 12/12 (100%) | 100% | 10/12 (83%) | 10/12 (83%) | — | 0% | n/a | 9.09 (CLI −no-op) |
| fast-json-patch (floor) | — | no classification | — | — | — | — | — | 0.06 | 0.06 |

### 4.2 Change sets

| Fixture | Tool | Diffs | Detected (recall) | Precision | Class agreement | Breaking agreement | Risky | End-to-end | Described | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aa2-events` | asd 1.0.6 | 17 | 12/12 (100%) | 94% | 3/12 | 3/12 | — | 25% | 0% | missed breaking: A3, A5, A6, A8, A11 |
| `aa2-events` | asd 2.0.0 | 29 | 12/12 (100%) | 100% | 12/12 | 12/12 | — | 100% | 100% |  |
| `aa2-events` | fork 4.0.1 | n/a |  |  |  |  |  |  |  | AsyncAPI 2.x dropped by the fork (resolveSpec throws) |
| `aa2-events` | @asyncapi/diff | 17 | 12/12 (100%) | 94% | 3/12 | 3/12 | — | 25% | 0% | missed breaking: A3, A5, A6, A8, A11 |
| `aa2-events` | openapi-changes (CLI) | n/a |  |  |  |  |  |  |  | OpenAPI 3.x / AsyncAPI 3.x only |
| `aa3-events` | asd 1.0.6 | n/a |  |  |  |  |  |  |  | AsyncAPI 3 not supported (apiCompare would diff it as a JSON Schema |
| `aa3-events` | asd 2.0.0 | 31 | 12/12 (100%) | 100% | 12/12 | 12/12 | — | 100% | 100% |  |
| `aa3-events` | fork 4.0.1 | 44 | 12/12 (100%) | 100% | 10/12 | 10/12 | 0/0 (1 risky) | 83% | 100% (23 weak) | false breaking: A9, A10 |
| `aa3-events` | @asyncapi/diff | 19 | 12/12 (100%) | 95% | 3/12 | 3/12 | — | 25% | 0% | missed breaking: A3, A5, A6, A8, A11 |
| `aa3-events` | openapi-changes (CLI) | 39 | 12/12 (100%) | 100% | 10/12 | 10/12 | — | 83% | 0% | false breaking: A9, A10 |

Per-change verdicts, `aa2-events` (AsyncAPI 2.6):

| Id | Change | Expected | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | @asyncapi/diff | openapi-changes (CLI) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | channel audit/log removed | B | B ✓ | B ✓ | n/a | B ✓ | n/a |
| A2 | produced channel bench/added added | N | N ✓ | N ✓ | n/a | N ✓ | n/a |
| A3 | produced payload User.displayName string -> integer | B | **U ✗** | B ✓ | n/a | **U ✗** | n/a |
| A4 | produced payload gains optional property benchNickname | N | **U ✗** | N ✓ | n/a | **U ✗** | n/a |
| A5 | produced payload required property email removed | B | **U ✗** | B ✓ | n/a | **U ✗** | n/a |
| A6 | consumed payload gains required property benchCurrency | B | **U ✗** | B ✓ | n/a | **U ✗** | n/a |
| A7 | consumed payload gains optional property benchNote | N | **U ✗** | N ✓ | n/a | **U ✗** | n/a |
| A8 | consumed payload Order.giftWrap boolean -> string | B | **U ✗** | B ✓ | n/a | **U ✗** | n/a |
| A9 | produced payload (UserDeleted) gains required property benchReason | N | **U ✗** | N ✓ | n/a | **U ✗** | n/a |
| A10 | consumed payload (OrderCancelled) orderId no longer required | N | **U ✗** | N ✓ | n/a | **U ✗** | n/a |
| A11 | message header traceDepth integer -> string | B | **U ✗** | B ✓ | n/a | **U ✗** | n/a |
| A12 | channel order/created description changed | A | A ✓ | A ✓ | n/a | N ✓ | n/a |

Per-change verdicts, `aa3-events` (the same API and changes in AsyncAPI 3.0):

| Id | Change | Expected | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | @asyncapi/diff | openapi-changes (CLI) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | channel audit/log removed | B | n/a | B ✓ | B ✓ | B ✓ | B ✓ |
| A2 | produced channel bench/added added | N | n/a | N ✓ | N ✓ | N ✓ | N ✓ |
| A3 | produced payload User.displayName string -> integer | B | n/a | B ✓ | B ✓ | **U ✗** | B ✓ |
| A4 | produced payload gains optional property benchNickname | N | n/a | N ✓ | N ✓ | **U ✗** | N ✓ |
| A5 | produced payload required property email removed | B | n/a | B ✓ | B ✓ | **U ✗** | B ✓ |
| A6 | consumed payload gains required property benchCurrency | B | n/a | B ✓ | B ✓ | **U ✗** | B ✓ |
| A7 | consumed payload gains optional property benchNote | N | n/a | N ✓ | N ✓ | **U ✗** | N ✓ |
| A8 | consumed payload Order.giftWrap boolean -> string | B | n/a | B ✓ | B ✓ | **U ✗** | B ✓ |
| A9 | produced payload (UserDeleted) gains required property benchReason | N | n/a | N ✓ | **B ✗** | **U ✗** | **B ✗** |
| A10 | consumed payload (OrderCancelled) orderId no longer required | N | n/a | N ✓ | **R ✗** | **U ✗** | **B ✗** |
| A11 | message header traceDepth integer -> string | B | n/a | B ✓ | B ✓ | **U ✗** | B ✓ |
| A12 | channel order/created description changed | A | n/a | A ✓ | A ✓ | N ✓ | N ✓ |

### 4.3 Identical documents (every tool must report 0 changes)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | openapi-changes (CLI) | @asyncapi/diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aa2-identical` | 0 | 0 | n/a | n/a | 0 | 0 | 0 | 0 | 0 |
| `aa3-identical` | n/a | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### 4.4 Input mutation and merged document

| Tool | Fixtures run | Mutated an input | Merged / annotated document |
| --- | --- | --- | --- |
| asd 1.0.6 | 2 | none | yes |
| asd 2.0.0 | 4 | none | yes |
| fork 4.0.1 | 2 | none | yes |
| @asyncapi/diff | 4 | none | no |
| microdiff | 4 | none | no |
| jsondiffpatch | 4 | none | no |
| deep-diff | 4 | none | no |
| fast-json-patch | 4 | none | no |

### 4.5 Harvested compatibility corpus

The AsyncAPI cases of the repository's compatibility corpus and the AsyncAPI payload re-run of its JSON Schema cases (the payload of an AsyncAPI 2.6 publish / subscribe and a 3.0 receive / send message), scored per variant as described in the [overview](README.md) §3. Not applicable cells: asd 1.0.6 has no AsyncAPI 3 support, the fork no AsyncAPI 2, openapi-changes reads AsyncAPI 3 only.

2518 variants of 781 cases, exported 2026-11-21; run 2026-11-21. **Partial run** (tools asd-2.0.0).

| Tool | Variants run | Errors / timeouts | Detected | Classified | Breaking agreement | Risky | Described | All three | Strict D / C / A / all (asd) | Variants where it beats asd 2.0.0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 | 2518 | 0 | 2518/2518 (100%) | 2438/2438 (100%) | 2438/2438 (100%) | 101/101 (101 risky) | 2367/2367 (100%) | 2518/2518 (100%) | 100% / 100% / 100% / **100%** | — |

Per compat family:

| Family | Variants | asd 1.0.6 strict all | asd 2.0.0 strict D / C / A / all | asd 2.0.0 classified |
| --- | --- | --- | --- | --- |
| asyncapi | 728 | — | 100% / 100% / 100% / **100%** | 100% |
| asyncapi-payload | 1786 | — | 100% / 100% / 100% / **100%** | 100% |
| jsonschema | 4 | — | 100% / 100% / 100% / **100%** | n/a |

Variants where another tool does better than asd 2.0.0:

No variant where another tool beats asd 2.0.0.

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls; `n/a` = the tool does not accept that kind of document; `error` = the tool threw; `timeout` = the first call did not finish within 60 s; `†` = the correctness check of that cell failed.

### 5.1 AsyncAPI (median / min ms)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | @asyncapi/diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aa2-events` | 1.54 / 1.12 | 1.05 / 0.98 | n/a | 0.55 / 0.53 | 0.13 / 0.07 | 0.36 / 0.34 | 0.15 / 0.10 | 0.06 / 0.06 |
| `aa3-events` | n/a | 1.33 / 1.21 | 86.1 / 79.6 | 0.67 / 0.49 | 0.09 / 0.08 | 0.38 / 0.37 | 0.19 / 0.11 | 0.07 / 0.06 |
| `aa2-identical` | 1.48 / 1.17 | 0.11 / 0.10 | n/a | 0.40 / 0.37 | 0.07 / 0.06 | 0.46 / 0.33 | 0.09 / 0.08 | 0.05 / 0.04 |
| `aa3-identical` | n/a | 0.16 / 0.14 | 86.0 / 82.8 | 0.29 / 0.28 | 0.08 / 0.07 | 0.35 / 0.33 | 0.11 / 0.09 | 0.04 / 0.04 |
| `aa2-wide-500` | 547 / 525 | 2.35 / 2.32 | n/a | 1.71 / 1.66 | 0.92 / 0.89 | 5.23 / 5.04 | 2.98 / 2.59 | 1.29 / 1.18 |
| `aa3-wide-500` | n/a | 10.4 / 9.49 | 4.27 s / 3.69 s | 2.10 / 2.04 | 3.76 / 3.53 | 9.54 / 8.03 | 3.85 / 3.71 | 1.55 / 1.53 |
| `aa2-wide-2000` | 2.33 s / 2.27 s | 9.04 / 8.76 | n/a | 5.91 / 5.61 | 4.35 / 4.19 | 18.5 / 18.2 | 12.1 / 12.0 | 4.53 / 4.28 |
| `aa3-wide-2000` | n/a | 51.4 / 47.4 | 19.55 s / 13.85 s | 11.6 / 9.88 | 10.4 / 8.56 | 30.2 / 27.2 | 23.1 / 22.3 | 10.8 / 9.96 |

### 5.2 AsyncAPI 3.0, Go CLI (process wall time median / min ms)

| Fixture | write both inputs (ms) | openapi-changes 0.4.3 report |
| --- | --- | --- |
| `aa3-events` | 0.30 | 59.4 / 55.7 (−no-op 9.09; 30.4 MB RSS) |
| `aa3-identical` | 0.28 | 62.3 / 51.7 (−no-op 12.0; 28.6 MB RSS) |
| `aa3-wide-500` | 2.18 | 227 / 204 (−no-op 177; 101.6 MB RSS) |
| `aa3-wide-2000` | 8.07 | 932 / 813 (−no-op 882; 315.9 MB RSS) |

No-op invocation (minimal document compared with itself): openapi-changes 50.3 / 49.3 ms, 27.3 MB RSS.

### 5.3 Scaling

There is no controlled size series for AsyncAPI; the table compares the curated event API with the synthetic wide documents of the same version (input ratio of the JSON before + after).

| Series (min ms) | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | @asyncapi/diff | microdiff | jsondiffpatch |
| --- | --- | --- | --- | --- | --- | --- |
| `aa2-events` → `aa2-wide-500` (34× JSON input) | 1.12 → 525 (467.92×) | 0.98 → 2.32 (2.36×) | n/a → n/a (—) | 0.53 → 1.66 (3.15×) | 0.07 → 0.89 (13.15×) | 0.34 → 5.04 (14.73×) |
| `aa3-events` → `aa3-wide-500` (42× JSON input) | n/a → n/a (—) | 1.21 → 9.49 (7.82×) | 79.6 → 3.69 s (46.33×) | 0.49 → 2.04 (4.15×) | 0.08 → 3.53 (43.75×) | 0.37 → 8.03 (21.77×) |
| `aa2-wide-500` → `aa2-wide-2000` (4× JSON input) | 525 → 2.27 s (4.33×) | 2.32 → 8.76 (3.78×) | n/a → n/a (—) | 1.66 → 5.61 (3.38×) | 0.89 → 4.19 (4.70×) | 5.04 → 18.2 (3.60×) |
| `aa3-wide-500` → `aa3-wide-2000` (4× JSON input) | n/a → n/a (—) | 9.49 → 47.4 (5.00×) | 3.69 s → 13.85 s (3.76×) | 2.04 → 9.88 (4.85×) | 3.53 → 8.56 (2.42×) | 8.03 → 27.2 (3.39×) |

### 5.4 Merged-document and option cost (median / min ms)

| Fixture | asd 2.0.0 | asd 2.0.0 merged:normalized | fork 4.0.1 | fork 4.0.1 normalizedResult | fork 4.0.1 plain options |
| --- | --- | --- | --- | --- | --- |
| `aa3-events` | 1.33 / 1.21 | 1.61 / 1.48 | 86.1 / 79.6 | 75.6 / 72.2 | 54.3 / 49.3 |

### 5.5 Heap (peak / added by the call / retained MB, one call in a fresh process)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | @asyncapi/diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aa2-events` | 8.3 / 1.2 / 0.2 | 10.0 / 0.8 / 0.1 | n/a | 7.2 / 0.2 / 0.0 | 6.7 / 0.0 / 0.5 | 7.0 / 0.1 / 0.0 | 6.7 / 0.1 / 0.0 | 6.7 / 0.0 / 0.0 |
| `aa3-events` | n/a | 10.0 / 0.7 / 0.1 | 28.5 / 17.0 / 0.2 | 7.2 / 0.2 / 0.3 | 6.7 / 0.0 / 0.1 | 7.0 / 0.1 / 0.0 | 6.7 / 0.1 / 0.1 | 6.7 / 0.0 / 0.3 |
| `aa2-identical` | 8.4 / 1.3 / 0.1 | 8.6 / 0.1 / 0.0 | n/a | 7.1 / 0.1 / 0.0 | 6.7 / 0.0 / 0.0 | 7.0 / 0.1 / 0.2 | 6.7 / 0.1 / 0.0 | 6.7 / 0.0 / 0.1 |
| `aa3-identical` | n/a | 8.6 / 0.1 / 0.1 | 28.4 / 16.9 / 0.1 | 7.1 / 0.1 / 0.1 | 6.7 / 0.0 / 0.1 | 7.0 / 0.1 / 0.0 | 6.7 / 0.1 / 0.0 | 6.7 / 0.0 / 0.0 |
| `aa2-wide-500` | 25.7 / 17.2 / 0.5 | 12.2 / 1.9 / 0.6 | n/a | 9.3 / 1.1 / 0.0 | 8.5 / 0.6 / 0.1 | 10.1 / 2.0 / 0.0 | 11.4 / 3.5 / 0.3 | 8.8 / 0.9 / 0.0 |
| `aa3-wide-500` | n/a | 19.3 / 7.7 / 0.8 | 171.3 / 157.7 / 4.3 | 10.4 / 1.4 / 0.0 | 9.7 / 1.0 / 0.0 | 11.9 / 2.9 / 0.1 | 13.7 / 5.0 / 0.0 | 9.9 / 1.2 / 0.0 |
| `aa2-wide-2000` | 49.8 / 37.5 / 1.9 | 20.8 / 6.5 / 1.9 | n/a | 16.0 / 4.0 / 0.0 | 12.6 / 0.9 / 0.1 | 19.7 / 7.8 / 0.1 | 25.9 / 14.3 / 0.1 | 15.2 / 3.6 / 0.1 |
| `aa3-wide-2000` | n/a | 52.1 / 30.3 / 3.8 | 1007.6 / 986.6 / 16.9 | 24.6 / 6.7 / 0.0 | 20.1 / 2.4 / 0.3 | 30.4 / 12.5 / 0.2 | 39.1 / 21.5 / 0.1 | 23.4 / 5.8 / 0.3 |
