# api-smart-diff benchmark: overview

This benchmark compares api-smart-diff 2.0.0 (the build of this repository) with the published api-smart-diff 1.0.6, the Netcracker fork `@netcracker/qubership-apihub-api-diff` 4.0.1 and open-source API diff tools on identical inputs. Correctness and classification quality are given the same weight as speed and memory. There is one report per API type: **[OpenAPI](OPENAPI.md)** (OpenAPI 3.0 / 3.1 / 3.2 and JSON Schema), **[GraphQL](GRAPHQL.md)**, **[AsyncAPI](ASYNCAPI.md)** (2.6 and 3.0) and **[gRPC / Protocol Buffers](GRPC.md)**. This page holds what the first three share: the environment, the methodology, a summary per type, the feature matrix, bundle sizes and the validation of the fork build. Every table is rendered by `scripts/report.js` from the result files; how to run everything is in the [benchmark README](../README.md).

> **Provenance of these reports.** The OpenAPI, GraphQL and AsyncAPI reports are rendered from the full run of 2026-11-21 (Node.js 26.13, Intel Core i9-9880H, 16 GB, macOS; the laptop was not idle: an IDE and other sessions ran during the run), the gRPC report from the run of 2026-11-25/26. In the 2026-11-21 run the **"asd 1.0.6" column is api-smart-diff 1.0.6 built from its source** (commit aaed6b3 with allof-merge 0.6.6 and json-crawl 0.5.3), **not the published npm package**, and "asd 2.0.0" is the pre-release build of that day; the harness now measures the published `api-smart-diff@1.0.6` and the repository build instead. The published 1.0.6 package is slower than that source build (for example the GitHub REST change set takes 10.2 s with the package against 6.9 s with the source build), so the 1.0.6 numbers of the Performance section of the documentation and of the CHANGELOG, which were re-measured against the published package, differ from the 1.0.6 column here; [HEADLINE.md](HEADLINE.md) repeats that re-measure with this harness. The GraphQL rows of "asd 2.0.0" are its GraphApi 1.0 runs (the run also measured GraphApi 0.1.2 input, which is not shown). The bundle-size table is computed from the current builds (the published 1.0.6 package and the repository's 2.0.0 build).

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
| GraphQL converters | gqlapi 0.5.1 (GraphApi 0.1.2, for 1.0.6; graphql 16.9.0); gqlapi 0.6.0 (GraphApi 1.0, for 2.0.0); fork graphapi 1.0.14 (graphql 16.12.0) |
| Go CLIs | oasdiff 1.38.0, openapi-changes 0.4.3 (GitHub release binaries) |
| npm peers | openapi-diff 0.24.1, json-schema-diff 1.0.0, asyncapi-diff 0.6.1, graphql-inspector-core 8.0.3, graphql-js 16.12.0, microdiff 1.6.0, jsondiffpatch 0.7.7, deep-diff 1.0.2, fast-json-patch 3.1.1 |

Every timing cell runs in its own process and `min` is the headline number because it is the most robust against other load on the machine; medians are reported next to it. Each type report repeats the environment of its own run, because the types can be run separately.

## 2. Reports and what they cover

| Report | Fixtures | api-smart-diff variants | Other tools |
| --- | --- | --- | --- |
| [OpenAPI](OPENAPI.md) | petstore 3.0 / 3.1 / 3.2, GitHub REST, synthetic scaling, identical documents, JSON Schema sets | asd 1.0.6, asd 2.0.0 (+ `merged: "normalized"`), fork 4.0.1 (+ plain options, `normalizedResult`) | oasdiff, openapi-changes (Go CLIs), openapi-diff, json-schema-diff, structural diffs |
| [GraphQL](GRAPHQL.md) | GitHub GraphQL schema, repository pair, identical schema | asd 1.0.6 (GraphApi 0.1.2 input), asd 2.0.0 (GraphApi 1.0 input), fork 4.0.1 (fork graphapi input) | graphql-inspector, graphql-js, structural diffs |
| [AsyncAPI](ASYNCAPI.md) | event API in 2.6 and 3.0, synthetic wide documents, identical documents | asd 1.0.6, asd 2.0.0, fork 4.0.1 | @asyncapi/diff, openapi-changes (AsyncAPI 3.0 only), structural diffs |
| [gRPC / Protocol Buffers](GRPC.md) | hand-written order service, synthetic 170 / 1 700 / 10 200 messages, identical tree | asd 2.0.0 per compatibility level, and end to end from `.proto` sources | buf breaking (per category), structural diffs |

The structural JSON diffs are `microdiff`, `jsondiffpatch`, `deep-diff` and `fast-json-patch` (`compare`): no classification and no API semantics, the lower bound of "find what changed".

## 3. Methodology

**Inputs.** Every fixture is generated deterministically (`fixtures/*.js`) and written to `fixtures/cache/` in each input format; a worker reads it once, and every call gets fresh copies (`structuredClone`) built before the clock starts, because api-smart-diff 1.0.6 mutates its inputs. YAML parsing and format conversion are never timed; each tool's own processing of the already parsed input is (normalization, `$ref` resolution, allOf merging, building the merged document, descriptions). openapi-diff only accepts document text, so its own `JSON.parse` is inside the timed region; graphql-inspector and graphql-js receive `GraphQLSchema` objects.

**Timing (in-process).** One child process per (fixture, tool) cell (`scripts/run-case.js`, `node --expose-gc --max-old-space-size=8192 --stack-size=4000`). The first call is the probe and must finish within 60 s, otherwise the cell is `timeout`; then 20 warm-up calls (fewer only when 20 would exceed a 60 s warm-up budget, at least 2), then 11 timed calls when the probe is below 100 ms and 7 otherwise, each preceded by `gc()`. Median and min are reported; min is the headline.

**Timing (Go CLIs).** Each run is one process on the cached JSON files (`scripts/cli.js`): probe (60 s timeout), up to 20 warm-up runs within 60 s, 7 timed runs, median and min of the wall time. A no-op invocation (a minimal document compared with itself) is measured the same way and subtracted from the median to give an "in-process equivalent"; the cost of serializing and writing both inputs, which a JavaScript caller would pay to use a CLI, is reported per fixture. Peak RSS comes from one extra run under `/usr/bin/time`.

**Heap.** A separate fresh process per cell (`scripts/heap.js`): 3 warm-ups, then one call with `--trace-gc` switched on around it. Peak = the maximum heap used before each GC during the call and right after it; added = peak minus the heap right before the call (inputs built, warm-ups done), the heap the call itself adds; retained = the heap after the call with the inputs dropped and the output (diffs and merged document) kept alive, minus the baseline before the inputs were built.

**Correctness and quality.** Every tool runs once per fixture in its own process (`scripts/quality.js`). Its diffs are normalized to `{ hay, class, description }`, where `hay` is a lower-cased string of every location the tool reports (api-smart-diff: `diff.path` and the `origin` declaration paths; fork: the declaration paths; oasdiff: `id`, `operation`, `path`, `text`; openapi-changes: the JSONPath and `property`; openapi-diff: the entity locations and `code`; graphql-inspector: `path`, `type`, `message`; @asyncapi/diff: the JSON pointer) plus primitive before / after values and the description, with canonical operation keys `@op:METHOD /path@` added wherever an OpenAPI location is recognizable. Each change-set fixture carries a hand-written list of expected changes with the expected classification, debatable alternatives (`accept`) and the location tokens that identify the change (the generators assert that they are unique in the document). A diff is attributed to every change whose tokens it contains; a change is *detected* when at least one diff is attributed to it, and its *verdict* is the most severe class among those diffs (breaking > risky > deprecated > non-breaking > annotation > unclassified), so a tool that reports a change once per usage is judged by its strictest usage.

Metrics per (fixture, tool): **recall** = detected / expected (optional changes, which may legitimately produce no diff, are left out of the denominator); **precision** = diffs attributed to some expected change / all diffs; **class agreement** = detected changes whose verdict is the expected class or an accepted alternative; **breaking agreement** = detected changes on the right side of the breaking line (breaking or risky vs the rest; `unclassified` never agrees); **end-to-end** = changes that are both detected and on the right side, over all expected changes; **described** = diffs with a human-readable description (`weak` = a description that is empty, shorter than two words, contains `undefined` / `[object` / `NaN`, or names the wrong action; `lib/corpus-score.js`); **risky** = changes expected `risky` that the tool calls risky. Identical-document fixtures must give 0 diffs, and input mutation is checked by deep-comparing the inputs with a snapshot after the call. A `†` after a time marks a cell whose correctness check failed (an identical compare that reported diffs, or a change set not fully detected), so the time is for an incomplete result.

**Classification vocabularies.** api-smart-diff: `breaking`, `non-breaking`, `deprecated`, `annotation`, `unclassified`, used as is. Fork: the same plus `risky`, counted on the breaking side; the fork reports one diff per declaration and scope instead of one per usage. oasdiff: ERR → breaking, WARN → risky, INFO → deprecated for the deprecation rules, annotation for the rules that only touch tags, `operationId`, `info.version` or stability levels, non-breaking otherwise. openapi-changes: `breaking: true` → breaking, otherwise non-breaking. openapi-diff and @asyncapi/diff: `breaking` / `non-breaking` / `unclassified`. graphql-inspector: BREAKING → breaking, DANGEROUS → risky, NON_BREAKING → non-breaking. graphql-js: `findBreakingChanges` → breaking, `findDangerousChanges` → risky (other changes are not reported). json-schema-diff: a document-level verdict only. Tools without an annotation or deprecation tier are credited with class agreement when they call an expected annotation or deprecation non-breaking. Structural diffs appear only in the identical-document and timing tables.

**Harvested corpus.** Besides the curated change sets, every variant of the repository's compatibility corpus (`test/compat/**`, minimal before / after pairs harvested from the test suites of the tools compared here and from the specifications) runs through every tool of its type (`scripts/corpus.js`, one worker per tool, 10 s per call) and is scored per variant: detected, classified (most severe verdict = most severe expected class), breaking side, risky and described. For api-smart-diff the strict attribution of `test/compat/report.ts` (every diff at the expected path with the expected action and type, no spurious diff) is reported as well.

**Expected semantics.** Consumer viewpoint throughout: a change is breaking when an existing client that follows the before document can fail against the after document. The rules per API type (request vs response direction in OpenAPI, produced vs consumed messages in AsyncAPI, input vs output positions in GraphQL) are stated in each report.

## 4. Summary per type

Totals over the curated change sets of the type (synthetic scaling fixtures excluded), then the headline timings: min ms of the in-process call, for the Go CLIs the process median minus the no-op invocation; `†` = that cell's correctness check failed. The full tables and per-change matrices are in the type reports.

### 4.1 OpenAPI (OpenAPI and JSON Schema change sets): [report](OPENAPI.md)

| Tool | Change-set fixtures run | Detected | Precision | Class agreement | Breaking agreement | Risky | Described | `oas-petstore` (min ms) | `oas-github` (min ms) | `js-repo-pair` (min ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 1.0.6 | 5 | 104/110 (95%) | 98% | 93/107 (87%) | 93/107 (87%) | 0/1 | 85% | 23.6 † | 6.92 s | 3.55 |
| asd 2.0.0 | 5 | 110/110 (100%) | 100% | 113/113 (100%) | 113/113 (100%) | 1/1 (1 risky) | 100% | 2.80 | 139 | 1.06 |
| fork 4.0.1 | 4 (+1 error) | 84/87 (97%) | 99% | 79/86 (92%) | 79/86 (92%) | 0/1 | 100% | 134 | 44.90 s | 25.6 † |
| oasdiff (CLI) | 4 | 80/90 (89%) | 100% | 80/80 (100%) | 80/80 (100%) | 0/0 (1 risky) | 100% | 12.8 (CLI −no-op) † | 3.48 s (CLI −no-op) † | n/a |
| openapi-changes (CLI) | 3 (+1 error) | 69/69 (100%) | 97% | 60/72 (83%) | 60/72 (83%) | — | 0% | 25.4 (CLI −no-op) | timeout | n/a |
| openapi-diff | 1 (+1 error) | 13/23 (57%) | 100% | 10/13 (77%) | 10/13 (77%) | — | 0% | 483 † | timeout | n/a |
| json-schema-diff | 0 | document level only: 1/1 verdicts agree | — | — | — | — | — | n/a | n/a | 13.9 |
| fast-json-patch (floor) | — | no classification | — | — | — | — | — | 0.21 | 38.1 | 0.03 |

json-schema-diff gives a document-level verdict only and is therefore not part of the change-level totals.

### 4.2 GraphQL: [report](GRAPHQL.md)

| Tool | Change-set fixtures run | Detected | Precision | Class agreement | Breaking agreement | Risky | Described | `gql-repo-pair` (min ms) | `gql-github` (min ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 1.0.6 | 1 (+1 error) | 7/7 (100%) | 84% | 6/7 (86%) | 6/7 (86%) | — | 10% | 120 | timeout |
| asd 2.0.0 | 2 | 24/24 (100%) | 100% | 25/25 (100%) | 25/25 (100%) | 1/1 (1 risky) | 100% | 0.72 | 69.5 |
| fork 4.0.1 | 2 | 24/24 (100%) | 100% | 25/25 (100%) | 25/25 (100%) | 1/1 (1 risky) | 100% | 47.7 | 8.20 s |
| graphql-inspector | 2 | 24/24 (100%) | 100% | 25/25 (100%) | 25/25 (100%) | 1/1 (1 risky) | 100% | 0.19 | 17.2 |
| graphql-js | 2 | 17/24 (71%) | 100% | 15/17 (88%) | 15/17 (88%) | 1/1 (3 risky) | 100% | 0.44 † | 24.4 † |
| fast-json-patch (floor) | — | no classification | — | — | — | — | — | 0.08 | 8.86 |

### 4.3 AsyncAPI (2.6 and 3.0 change sets): [report](ASYNCAPI.md)

| Tool | Change-set fixtures run | Detected | Precision | Class agreement | Breaking agreement | Risky | Described | `aa2-events` (min ms) | `aa3-events` (min ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 1.0.6 | 1 | 12/12 (100%) | 94% | 3/12 (25%) | 3/12 (25%) | — | 0% | 1.12 | n/a |
| asd 2.0.0 | 2 | 24/24 (100%) | 100% | 24/24 (100%) | 24/24 (100%) | — | 100% | 0.98 | 1.21 |
| fork 4.0.1 | 1 | 12/12 (100%) | 100% | 10/12 (83%) | 10/12 (83%) | 0/0 (1 risky) | 100% | n/a | 79.6 |
| @asyncapi/diff | 2 | 24/24 (100%) | 94% | 6/24 (25%) | 6/24 (25%) | — | 0% | 0.53 | 0.49 |
| openapi-changes (CLI) | 1 | 12/12 (100%) | 100% | 10/12 (83%) | 10/12 (83%) | — | 0% | n/a | 9.09 (CLI −no-op) |
| fast-json-patch (floor) | — | no classification | — | — | — | — | — | 0.06 | 0.06 |

### 4.4 All three types combined

| Tool | Change-set fixtures run | Detected | Precision | Class agreement | Breaking agreement | Risky | Described |
| --- | --- | --- | --- | --- | --- | --- | --- |
| asd 1.0.6 | 7 (+1 error) | 123/129 (95%) | 96% | 102/126 (81%) | 102/126 (81%) | 0/1 | 68% |
| asd 2.0.0 | 9 | 158/158 (100%) | 100% | 162/162 (100%) | 162/162 (100%) | 2/2 (2 risky) | 100% |
| fork 4.0.1 | 7 (+1 error) | 120/123 (98%) | 100% | 114/123 (93%) | 114/123 (93%) | 1/2 (2 risky) | 100% |
| oasdiff (CLI) | 4 | 80/90 (89%) | 100% | 80/80 (100%) | 80/80 (100%) | 0/0 (1 risky) | 100% |
| openapi-changes (CLI) | 4 (+1 error) | 81/81 (100%) | 98% | 70/84 (83%) | 70/84 (83%) | — | 0% |
| openapi-diff | 1 (+1 error) | 13/23 (57%) | 100% | 10/13 (77%) | 10/13 (77%) | — | 0% |
| @asyncapi/diff | 2 | 24/24 (100%) | 94% | 6/24 (25%) | 6/24 (25%) | — | 0% |
| graphql-inspector | 2 | 24/24 (100%) | 100% | 25/25 (100%) | 25/25 (100%) | 1/1 (1 risky) | 100% |
| graphql-js | 2 | 17/24 (71%) | 100% | 15/17 (88%) | 15/17 (88%) | 1/1 (3 risky) | 100% |

Input mutation and merged document over every non-synthetic fixture:

| Tool | Fixtures run | Mutated an input | Merged / annotated document |
| --- | --- | --- | --- |
| asd 1.0.6 | 13 | 6: oas-petstore, oas31-petstore, oas32-petstore, oas-override-identical, oas-github, oas-github-identical | yes |
| asd 2.0.0 | 17 | none | yes |
| fork 4.0.1 | 14 | none | yes |
| openapi-diff | 3 | none | no |
| json-schema-diff | 2 | 2: js-repo-pair, js-repo-identical | no |
| @asyncapi/diff | 4 | none | no |
| graphql-inspector | 3 | n/a (GraphQLSchema inputs cannot be snapshotted) | no |
| graphql-js | 3 | n/a (GraphQLSchema inputs cannot be snapshotted) | no |
| microdiff | 17 | none | no |
| jsondiffpatch | 17 | none | no |
| deep-diff | 17 | none | no |
| fast-json-patch | 17 | none | no |

### 4.5 Harvested compatibility corpus

| Type | Variants | asd 1.0.6 strict all | asd 2.0.0 strict D / C / A / all | Classified (case level): asd 2.0.0 / fork / peers | Variants where a classifying tool beats asd 2.0.0 |
| --- | --- | --- | --- | --- | --- |
| openapi | 1994 (partial) | — | 100% / 100% / 100% / **100%** | asd 2.0.0 100% | 0 |
| graphql | 700 (partial) | — | 100% / 100% / 100% / **100%** | asd 2.0.0 100% | 0 |
| asyncapi | 2518 (partial) | — | 100% / 100% / 100% / **100%** | asd 2.0.0 100% | 0 |

## 5. Feature matrix

| | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | oasdiff 1.38 | openapi-changes 0.4.3 | openapi-diff 0.24 | json-schema-diff 1.0 | @asyncapi/diff 0.6 | graphql-inspector 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAPI 3.0 / 3.1 / 3.2 | ✓ / ✓ / runs | ✓ / ✓ / ✓ | ✓ / ✓ / error | ✓ / ✓ / accepted | ✓ / ✓ / accepted | ✓ / error / error | — | — | — |
| Swagger 2 | compared as JSON Schema | `UnsupportedSpecError` | compared, one `unclassified` diff | ✓ (converted) | error | ✓ | — | — | — |
| AsyncAPI 2.x / 3.x | ✓ / ✗ (compared as JSON Schema) | ✓ / ✓ | ✗ (throws) / ✓ | — | ✗ / ✓ | — | — | ✓ / ✓ (expects dereferenced input) | — |
| JSON Schema | ✓ (draft-04 rules) | ✓ (draft detected) | ✓ (04 / 06 / 07) | — | — | via schemas | ✓ (draft-06 / 07) | — | — |
| GraphQL | GraphApi 0.1.2 (gqlapi ≤ 0.5) | GraphApi 1.0 (gqlapi 0.6) | fork graphapi format | — | — | — | — | — | SDL / `GraphQLSchema` |
| Protocol Buffers | — | ProtoApi (protoapi) | — | — | — | — | — | — | — |
| Classification tiers | breaking / non-breaking / deprecated / annotation / unclassified | same + `risky`, `scope` per diff | same + risky, `scope` | ERR / WARN / INFO + rule id | breaking flag | breaking / non-breaking / unclassified | removals / additions (document) | breaking / non-breaking / unclassified | BREAKING / DANGEROUS / NON_BREAKING |
| Diff location | path in the merged document (usage) | usage path + `origin` declaration paths | declaration paths | operation + path + text | JSONPath at the declaration | schema-level location | none | JSON pointer | `Type.field.arg` |
| Human-readable description | most diffs (none for AsyncAPI) | every diff | every diff | every change (localized) | no | no (codes) | no | no | every change |
| Merged / annotated document | ✓ (normalized, aliases inputs) | ✓ (original values, copy-on-write) | ✓ (dereferenced and allOf-merged) | ✗ | ✗ (HTML report) | ✗ | ✗ | ✗ | ✗ |
| Custom rules | rule trees, annotate hook | rule trees, annotate hook, `onError`, `engine` | reclassification rules, custom scopes | severity / ignore files | rules config file | ✗ | ✗ | `override` table | rule functions |
| Mutates inputs | yes | no | no | n/a (process) | n/a | no | **yes** | no | no |
| Browser | ✓ (IIFE global) | ✓ (IIFE global) | bundleable | ✗ (Go) | ✗ (Go) | ✗ (Node only) | Node | ✓ | ✓ |
| Runtime dependencies | allof-merge, json-crawl | allof-merge, json-crawl | api-unifier, json-crawl fork, graphapi fork, ddlapi (GitHub Packages only) + fast-equals, flatted, object-hash | static binary | static binary | 9 (axios, swagger-parser, json-schema-diff, lodash, …) | 7 (ajv, json-schema-ref-parser, lodash, …) | 3 | 3 + graphql peer |
| Installable from npmjs | ✓ | ✓ | ✗ (GitHub Packages) | binary releases | binary releases / npm wrapper | ✓ | ✓ | ✓ | ✓ |

## 6. Bundle size and dependencies (minified IIFE, gzip level 9, kB = 1 000 bytes)

The api-smart-diff rows are the packages' own browser builds (`dist/api-smart-diff.min.js`) where the build manifest says so; the other rows are bundled with esbuild (`scripts/build.js`).

| Variant | Version | min (kB) | min+gzip (kB) | Notes |
| --- | --- | --- | --- | --- |
| asd-1.0.6 | 1.0.6 | 62.9 | 18.1 | allof-merge + json-crawl bundled; the package's own browser build (dist/api-smart-diff.min.js) |
| asd-2.0.0 | 2.0.0 | 380.7 | 116.2 | allof-merge + json-crawl bundled; the package's own browser build (dist/api-smart-diff.min.js) |
| fork-4.0.1 | 4.0.1 | 256.1 | 76.4 | graphql external; api-unifier, fork json-crawl, fork graphapi, fast-equals, flatted, object-hash bundled; ddlapi stubbed |
| openapi-diff | 0.24.1 | 915.6 | 262.2 |  |
| json-schema-diff | 1.0.0 | 347.5 | 111.4 |  |
| asyncapi-diff | 0.6.1 | 90.8 | 23.5 |  |
| graphql-inspector-core | 8.0.3 | 156.6 | 33.3 | graphql external |
| graphql-js | 16.12.0 | 256.5 | 57.4 |  |
| microdiff | 1.6.0 | 1.1 | 0.6 |  |
| jsondiffpatch | 0.7.7 | 18.0 | 5.7 |  |
| deep-diff | 1.0.2 | 6.0 | 2.0 |  |
| fast-json-patch | 3.1.1 | 11.9 | 4.0 |  |

The fork cannot be installed from npmjs (its `@netcracker/*` dependencies are published on GitHub Packages only); it is built here from source clones of four repositories at pinned commits, with two stubs (`stubs/`).

## 7. Fork build validation (the fork's own tests against the bundle)

The fork's own OpenAPI / JSON Schema test files run in the OpenAPI type run and its GraphQL test file in the GraphQL type run, against the bundle built here (`scripts/fork-tests.js`); the fork has no AsyncAPI test file in the selection.

| Test file | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| openapi.contentMediaTypeMapping.test.ts | 22 | 0 | 0 |
| openapi.pathAndMethodMapping.test.ts | 6 | 0 | 1 |
| openapi.default.test.ts | 1 | 0 | 0 |
| graphapi.diff.test.ts | 1 | 0 | 1 |
| openapi.diff.test.ts | 11 | 0 | 0 |
| json-schema.diff.test.ts | 14 | 0 | 0 |
| openapi.classification.test.ts | 14 | 0 | 0 |
| openapi.add-required-fields.test.ts | 20 | 0 | 0 |
| oas-30-to-31.test.ts | 14 | 0 | 0 |
| openapi.exclusive-bounds.test.ts | 28 | 0 | 0 |

Total: 131 passed, 0 failed, 2 skipped (skips are `it.skip` in the fork's own sources).

## 8. Threats to validity

The expected lists are hand-written and the GitHub change sets are scripted, not taken from real releases; the classification of a few changes is a convention (the AsyncAPI direction viewpoint, unreachable GraphQL types, output-only enum values, optional vs required response property removal), which the `accept` lists make explicit. Attribution of diffs to changes is token-based; a tool that reports a change at an unexpected location is counted as not detecting it. openapi-diff is credited through the operations that use a changed schema, which makes its per-change verdicts lenient where several changes share a schema. Tools are run with their default options (the fork with the options of its own test suite); oasdiff and openapi-changes are timed as processes and their in-process equivalent is an estimate. The fork is built from source with a stubbed ddlapi, which matches the published package only as far as the DDL path is not exercised; its own tests run against the bundle (§7). The machine is a laptop that was not idle; minimums are reported for that reason, and the slow cells use fewer warm-ups (recorded per cell in `results/<type>/bench.json`).
