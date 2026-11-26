# api-smart-diff benchmark: overview

This benchmark compares api-smart-diff 2.0.0 (the build of this repository) with the published api-smart-diff 1.0.6, the Netcracker fork `@netcracker/qubership-apihub-api-diff` 4.0.1 and open-source API diff tools on identical inputs. Correctness and classification quality are given the same weight as speed and memory. There is one report per API type: **[OpenAPI](OPENAPI.md)** (OpenAPI 3.0 / 3.1 / 3.2 and JSON Schema), **[GraphQL](GRAPHQL.md)**, **[AsyncAPI](ASYNCAPI.md)** (2.6 and 3.0) and **[gRPC / Protocol Buffers](GRPC.md)**. This page holds what the first three share: the environment, the methodology, a summary per type, the feature matrix, bundle sizes and the validation of the fork build. Every table is rendered by `scripts/report.js` from the result files; how to run everything is in the [benchmark README](../README.md).

{{note}}

## 1. Environment

{{env}}

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

{{summary_openapi}}

json-schema-diff gives a document-level verdict only and is therefore not part of the change-level totals.

### 4.2 GraphQL: [report](GRAPHQL.md)

{{summary_graphql}}

### 4.3 AsyncAPI (2.6 and 3.0 change sets): [report](ASYNCAPI.md)

{{summary_asyncapi}}

### 4.4 All three types combined

{{quality_totals}}

Input mutation and merged document over every non-synthetic fixture:

{{mutation}}

### 4.5 Harvested compatibility corpus

{{corpus_summary}}

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

{{bundle}}

The fork cannot be installed from npmjs (its `@netcracker/*` dependencies are published on GitHub Packages only); it is built here from source clones of four repositories at pinned commits, with two stubs (`stubs/`).

## 7. Fork build validation (the fork's own tests against the bundle)

The fork's own OpenAPI / JSON Schema test files run in the OpenAPI type run and its GraphQL test file in the GraphQL type run, against the bundle built here (`scripts/fork-tests.js`); the fork has no AsyncAPI test file in the selection.

{{fork_jest}}

## 8. Threats to validity

The expected lists are hand-written and the GitHub change sets are scripted, not taken from real releases; the classification of a few changes is a convention (the AsyncAPI direction viewpoint, unreachable GraphQL types, output-only enum values, optional vs required response property removal), which the `accept` lists make explicit. Attribution of diffs to changes is token-based; a tool that reports a change at an unexpected location is counted as not detecting it. openapi-diff is credited through the operations that use a changed schema, which makes its per-change verdicts lenient where several changes share a schema. Tools are run with their default options (the fork with the options of its own test suite); oasdiff and openapi-changes are timed as processes and their in-process equivalent is an estimate. The fork is built from source with a stubbed ddlapi, which matches the published package only as far as the DDL path is not exercised; its own tests run against the bundle (§7). The machine is a laptop that was not idle; minimums are reported for that reason, and the slow cells use fewer warm-ups (recorded per cell in `results/<type>/bench.json`).
