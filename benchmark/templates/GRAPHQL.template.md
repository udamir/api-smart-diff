# GraphQL benchmark: api-smart-diff vs the Netcracker fork vs graphql-inspector and graphql-js

Part of the api-smart-diff benchmark; the [overview](README.md) holds the shared methodology, the feature matrix, bundle sizes and the fork build validation. This report covers the GitHub public GraphQL schema with a scripted change set, the repository's schema pair and an identical schema. Run with `npm run bench:graphql` and render with `npm run report` ([README](../README.md)).

{{note_graphql}}

## 1. Environment

{{env_graphql}}

## 2. Variants and peers

| Id | What | How it is called |
| --- | --- | --- |
| asd 1.0.6 | api-smart-diff 1.0.6, the published npm package | `apiCompare(before, after)` on GraphApi 0.1.2 documents built with gqlapi 0.5.1 `buildFromSchema` |
| asd 2.0.0 | api-smart-diff, the build of this repository | `apiCompare(before, after)` on GraphApi 1.0 documents built with gqlapi 0.6.0 `buildFromSchema`; auxiliary row `merged: "normalized"` |
| fork 4.0.1 | `@netcracker/qubership-apihub-api-diff`, built from source (see the [OpenAPI report](OPENAPI.md) §2) | `apiDiff(before, after, { validate: true, liftCombiners: true, unify: true, allowNotValidSyntheticChanges: true, beforeSource, afterSource })` on documents built with the fork's graphapi `buildFromSchema` |
| graphql-inspector | `@graphql-inspector/core`, npm | `diff(oldSchema, newSchema)` on `GraphQLSchema` objects built outside the timed region (the equivalent of the already parsed input of the other tools) |
| graphql-js | `graphql`, the GraphQL reference implementation | `findBreakingChanges` and `findDangerousChanges` on `GraphQLSchema` objects built outside the timed region; breaking → breaking, dangerous → risky; non-breaking, non-dangerous changes are not reported |
| floor | structural JSON diffs | `diff(before, after)` on the GraphApi 1.0 documents; no classification |

The GraphQL fixtures are converted per variant before timing (`scripts/fixtures.js`): gqlapi 0.5.1 for 1.0.6, gqlapi 0.6.0 for 2.0.0, the fork's graphapi for the fork, SDL → `buildSchema` for graphql-inspector and graphql-js, all with the same graphql copy.

## 3. Expected semantics and fixtures

Consumer viewpoint: a change is breaking when an existing client that follows the before schema can fail against the after schema. Removing an output field, argument or root field, making an output field nullable, adding a required argument or input field, making an argument non-null and changing a field type are breaking, the opposite directions non-breaking (graphql-js and graphql-inspector agree on all of these); removing an output-only enum value is breaking, with non-breaking accepted for scope-aware tools; adding an enum value is risky, with any classified verdict accepted. An unreferenced new type is an optional change (it may legitimately produce no diff).

### 3.1 Fixtures

{{fixtures_graphql}}

## 4. Correctness and classification quality

Columns and verdict letters as in the [OpenAPI report](OPENAPI.md) §4.

### 4.1 Totals over the curated GraphQL change sets

Headline timings: min ms of the in-process call; `†` = that cell's correctness check failed.

{{summary_graphql}}

### 4.2 Change sets

{{quality_graphql}}

Per-change verdicts, `gql-github` (GitHub GraphQL schema, scripted change set):

{{matrix_gql}}

Per-change verdicts, `gql-repo-pair` (the repository's schema pair):

{{matrix_gqlrepo}}

### 4.3 Identical documents (every tool must report 0 changes)

{{identical_graphql}}

### 4.4 Input mutation and merged document

{{mutation_graphql}}

### 4.5 Harvested compatibility corpus

The GraphQL cases of the repository's compatibility corpus, scored per variant as described in the [overview](README.md) §3: asd 2.0.0 and the structural diffs read the variant's GraphApi documents, graphql-inspector and graphql-js its SDL, asd 1.0.6 and the fork the SDL converted with their own GraphApi builders. graphql-js reports breaking and dangerous changes only, so a non-breaking change is not detected by it.

{{corpus_graphql}}

Per compat family:

{{corpus_family_graphql}}

Variants where another tool does better than asd 2.0.0:

{{corpus_beats_graphql}}

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls; `n/a` = the tool does not accept that kind of document; `error` = the tool threw; `timeout` = the first call did not finish within 60 s; `†` = the correctness check of that cell failed.

### 5.1 GraphQL (median / min ms)

{{timing_graphql}}

### 5.2 Scaling

There is no controlled size series for GraphQL; the table compares the small repository pair with the GitHub schema (input ratio of the SDL before + after).

{{scaling_graphql}}

### 5.3 Merged-document and option cost (median / min ms)

{{options_graphql}}

### 5.4 Heap (peak / added by the call / retained MB, one call in a fresh process)

{{heap_graphql}}
