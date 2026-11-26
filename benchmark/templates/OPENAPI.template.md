# OpenAPI benchmark: api-smart-diff vs the Netcracker fork vs OpenAPI and JSON Schema diff tools

Part of the api-smart-diff benchmark; the [overview](README.md) holds the shared methodology (timing, heap, quality metrics, classification vocabularies), the feature matrix, bundle sizes and the fork build validation. This report covers the OpenAPI fixtures (petstore 3.0 / 3.1 / 3.2, the GitHub REST description, synthetic scaling and direction fixtures, identical documents) and the JSON Schema fixtures (OpenAPI schemas are JSON Schema, so json-schema-diff and the stand-alone JSON Schema sets belong here). Run with `npm run bench:openapi` and render with `npm run report` ([README](../README.md)).

{{note_openapi}}

## 1. Environment

{{env_openapi}}

## 2. Variants and peers

| Id | What | How it is called |
| --- | --- | --- |
| asd 1.0.6 | api-smart-diff 1.0.6, the published npm package (its `dist/index.cjs`, dependencies bundled) | `apiCompare(before, after)` |
| asd 2.0.0 | api-smart-diff, the build of this repository (`dist/index.cjs`, bundled with the repository's json-crawl and allof-merge) | `apiCompare(before, after)` (default `merged: "original"`); auxiliary row `merged: "normalized"` |
| fork 4.0.1 | `@netcracker/qubership-apihub-api-diff`, built from its source with esbuild; `@netcracker/qubership-apihub-api-unifier`, `-json-crawl` and `-graphapi` from their sources, `-ddlapi` replaced by `stubs/ddlapi.js` (the DDL path is never exercised), `graphql` external | `apiDiff(before, after, { validate: true, liftCombiners: true, unify: true, allowNotValidSyntheticChanges: true, beforeSource: before, afterSource: after })`, the options of the fork's own OpenAPI tests; auxiliary rows: only `beforeSource` / `afterSource` ("plain options") and `normalizedResult: true` (skips the denormalize pass) |
| oasdiff | Go CLI (oasdiff), release binary | `oasdiff changelog before.json after.json -f json` (every check result with its level INFO / WARN / ERR); timed as a process |
| openapi-changes | Go CLI (pb33f), release binary | `openapi-changes report --no-logo --reproducible before.json after.json` (JSON report with a `breaking` flag per change) |
| openapi-diff | Atlassian, npm | `diffSpecs({ sourceSpec: { content, format: "openapi3" }, destinationSpec })`; takes document text, so its `JSON.parse` is timed and the `JSON.stringify` is not |
| json-schema-diff | Atlassian, npm | `diffSchemas({ sourceSchema, destinationSchema })`, a set-based semantic diff with a document-level verdict |
| floor | structural JSON diffs `microdiff`, `jsondiffpatch`, `deep-diff`, `fast-json-patch` (`compare`) | `diff(before, after)` on the JSON documents; no classification |

The versions of every tool are in the environment table above.

## 3. Expected semantics and fixtures

Consumer viewpoint: a change is breaking when an existing client that follows the before document can fail against the after document. Request schemas that narrow are breaking and widen non-breaking, responses the opposite; a type, format or pattern change is breaking in both directions; removing a *required* response property is breaking; a component used in requests and responses takes its strictest usage, a component used only in responses takes response semantics; path-template parameter renames and case-only header renames are not changes. Stand-alone JSON Schema documents use request semantics (the default of every tool here). For the schema-granular openapi-diff, changes inside a shared schema are also matched through the request body or response of the operations that use it.

### 3.1 Fixtures

{{fixtures_openapi}}

## 4. Correctness and classification quality

Columns: diffs reported; detected / expected changes (recall); precision; class agreement and breaking agreement over the detected changes; risky; end-to-end (detected and on the right side of the breaking line, over all expected); share of diffs with a description. The per-change matrices show each tool's verdict (B breaking, R risky, N non-breaking, D deprecated, A annotation, U unclassified; ✓ = expected class or accepted alternative, ~ = right side of the breaking line but another class, **✗** = wrong side or unclassified, **miss** = not detected, `– (ok)` = optional change with no diff).

### 4.1 Totals over the curated OpenAPI and JSON Schema change sets

Headline timings: min ms of the in-process call; Go CLIs: process median minus the no-op invocation; `†` = that cell's correctness check failed.

{{summary_openapi}}

### 4.2 OpenAPI

{{quality_openapi}}

Per-change verdicts, `oas-petstore` (the 3.1 and 3.2 copies give the same verdicts for every tool that accepts them):

{{matrix_petstore}}

Per-change verdicts, `oas-github` (GitHub REST API description, scripted change set):

{{matrix_github}}

### 4.3 JSON Schema

{{quality_jsonschema}}

{{matrix_js}}

### 4.4 Identical documents (every tool must report 0 changes)

{{identical_openapi}}

### 4.5 Input mutation and merged document

{{mutation_openapi}}

### 4.6 Harvested compatibility corpus

The OpenAPI and cross-cutting cases of the repository's compatibility corpus and its JSON Schema cases placed in a request body, a response, a query parameter, a response header or a plain JSON Schema document, scored per variant as described in the [overview](README.md) §3. Not applicable cells: openapi-diff accepts OpenAPI 3.0 only, json-schema-diff plain JSON Schema documents only, oasdiff and openapi-changes OpenAPI documents only.

{{corpus_openapi}}

Per compat family:

{{corpus_family_openapi}}

Variants where another tool does better than asd 2.0.0 (case level, with the dimensions it is better on):

{{corpus_beats_openapi}}

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls; `n/a` = the tool does not accept that kind of document; `error` = the tool threw; `timeout` = the first call did not finish within 60 s; `†` = the correctness check of that cell failed. Times include the tool's whole processing of the parsed input, including building the merged document where the tool produces one.

### 5.1 OpenAPI (median / min ms)

{{timing_openapi}}

### 5.2 OpenAPI, Go CLIs (process wall time median / min ms)

{{timing_cli_openapi}}

### 5.3 JSON Schema (median / min ms)

{{timing_jsonschema}}

### 5.4 Scaling

{{scaling}}

Go CLIs (median minus the no-op invocation):

{{scaling_cli}}

### 5.5 Merged-document and option cost (median / min ms)

{{options_openapi}}

### 5.6 Heap (peak / added by the call / retained MB, one call in a fresh process)

OpenAPI:

{{heap_openapi}}

JSON Schema:

{{heap_jsonschema}}

### 5.7 Performance targets of api-smart-diff 2.0.0

The targets set for the 2.0.0 engine, evaluated on the fixtures above (the real-world target compares with a `structuredClone` of both documents, `scripts/clone-baseline.js`).

{{targets}}
