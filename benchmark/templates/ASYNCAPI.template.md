# AsyncAPI benchmark: api-smart-diff vs the Netcracker fork vs @asyncapi/diff and openapi-changes

Part of the api-smart-diff benchmark; the [overview](README.md) holds the shared methodology, the feature matrix, bundle sizes and the fork build validation. This report covers an event API in AsyncAPI 2.6 and 3.0 with a hand-written change set, synthetic wide documents of both versions and identical documents. Run with `npm run bench:asyncapi` and render with `npm run report` ([README](../README.md)).

{{note_asyncapi}}

## 1. Environment

{{env_asyncapi}}

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

{{fixtures_asyncapi}}

## 4. Correctness and classification quality

Columns and verdict letters as in the [OpenAPI report](OPENAPI.md) §4.

### 4.1 Totals over the curated AsyncAPI change sets

Headline timings: min ms of the in-process call; openapi-changes: process median minus the no-op invocation; `†` = that cell's correctness check failed.

{{summary_asyncapi}}

### 4.2 Change sets

{{quality_asyncapi}}

Per-change verdicts, `aa2-events` (AsyncAPI 2.6):

{{matrix_aa2}}

Per-change verdicts, `aa3-events` (the same API and changes in AsyncAPI 3.0):

{{matrix_aa3}}

### 4.3 Identical documents (every tool must report 0 changes)

{{identical_asyncapi}}

### 4.4 Input mutation and merged document

{{mutation_asyncapi}}

### 4.5 Harvested compatibility corpus

The AsyncAPI cases of the repository's compatibility corpus and the AsyncAPI payload re-run of its JSON Schema cases (the payload of an AsyncAPI 2.6 publish / subscribe and a 3.0 receive / send message), scored per variant as described in the [overview](README.md) §3. Not applicable cells: asd 1.0.6 has no AsyncAPI 3 support, the fork no AsyncAPI 2, openapi-changes reads AsyncAPI 3 only.

{{corpus_asyncapi}}

Per compat family:

{{corpus_family_asyncapi}}

Variants where another tool does better than asd 2.0.0:

{{corpus_beats_asyncapi}}

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls; `n/a` = the tool does not accept that kind of document; `error` = the tool threw; `timeout` = the first call did not finish within 60 s; `†` = the correctness check of that cell failed.

### 5.1 AsyncAPI (median / min ms)

{{timing_asyncapi}}

### 5.2 AsyncAPI 3.0, Go CLI (process wall time median / min ms)

{{timing_cli_asyncapi}}

### 5.3 Scaling

There is no controlled size series for AsyncAPI; the table compares the curated event API with the synthetic wide documents of the same version (input ratio of the JSON before + after).

{{scaling_asyncapi}}

### 5.4 Merged-document and option cost (median / min ms)

{{options_asyncapi}}

### 5.5 Heap (peak / added by the call / retained MB, one call in a fresh process)

{{heap_asyncapi}}
