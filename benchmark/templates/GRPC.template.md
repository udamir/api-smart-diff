# gRPC / Protocol Buffers benchmark: api-smart-diff (ProtoApi) vs buf breaking

Part of the api-smart-diff benchmark ([overview](README.md)). api-smart-diff compares Protocol Buffers APIs as ProtoApi documents, built from `.proto` source trees with [protoapi](https://github.com/udamir/protoapi); `buf breaking` compares the source trees directly. This report covers a hand-written order service with 17 scripted changes, synthetic APIs of 170, 1 700 and 10 200 messages, an identical tree and the `protoapi` family of the repository's compatibility corpus. Run with `npm run bench:grpc` and render with `npm run report -- --only grpc` ([README](../README.md)).

{{note_grpc}}

## 1. Environment

{{env_grpc}}

## 2. Variants and peers

| Id | What | How it is called |
| --- | --- | --- |
| asd 2.0.0 `<LEVEL>` | api-smart-diff, the build of this repository | `apiCompare(before, after, { compatibility: "<LEVEL>" })` on the ProtoApi documents built from both `.proto` trees with protoapi (`imports: "user"`) outside the timed region; one row per compatibility level |
| asd 2.0.0 from .proto | the same, end to end | `buildFromProto` of both trees + `apiCompare` at `FILE`, everything timed: the path a user takes from source files, and the counterpart of buf, which also parses and builds both trees |
| protoapi build only | protoapi, npm | `buildFromProto` of both trees, no comparison: what the end-to-end row pays before comparing |
| buf `<CATEGORY>` | `buf breaking`, release binary | `buf breaking <after tree> --against <before tree> --error-format json --config '{"version":"v2","breaking":{"use":["<CATEGORY>"]}}'`, one process per category; the trees carry the bundled imports (protovalidate, googleapis) that buf cannot fetch without the Buf Schema Registry; timed as a process (wall time, with a no-op baseline) |
| floor | `microdiff`, `jsondiffpatch`, `deep-diff`, `fast-json-patch` | structural diff of the ProtoApi documents: no classification, no protobuf semantics |

buf reports breaking changes only: it is scored on the expected changes on the breaking side of the line (breaking or risky), an expected change below the line is optional for it, and a finding on such a change counts as a false breaking verdict. A risky expectation counts as breaking-side, so buf's silence on it is a miss.

## 3. Expected semantics and fixtures

Consumer viewpoint per compatibility level: a change is **breaking** when it breaks the runtime clients the level covers (`FILE` / `PACKAGE` / `WIRE_JSON`: binary and ProtoJSON; `WIRE`: binary only), **risky** when it may break some clients or only generated code (`FILE` / `PACKAGE` cover generated code, `WIRE_JSON` / `WIRE` do not: there such a change is an annotation), **non-breaking** when existing clients keep working (additions; ProtoJSON readers are assumed to ignore unknown fields). The rule behind every expected class of `grpc-shop` is in the table of §4.2.

### 3.1 Fixtures

{{fixtures_grpc}}

## 4. Correctness and classification quality

### 4.1 Change sets

{{quality_grpc}}

### 4.2 `grpc-shop` per change and level

Expected class / asd verdict / buf verdict per level (B breaking, R risky, N non-breaking, D deprecated, A annotation, – not reported).

{{matrix_grpc_shop}}

### 4.3 Identical documents (every tool must report 0 changes)

{{identical_grpc}}

### 4.4 Input mutation and merged document

{{mutation_grpc}}

### 4.5 Harvested compatibility corpus (compat family `protoapi`)

Every variant of the compat family `protoapi` of the repository (`test/compat/protoapi/`): change scenarios, partly re-authored from buf's own test data (area `buf corpus`), each at the four levels, exported with their ProtoApi documents and `.proto` trees by `scripts/corpus-export-grpc.ts`. asd compares each variant at its level, buf runs the category of the same name on the variant's trees. Case-level scoring as for the other types ([overview](README.md) §3).

{{corpus_grpc}}

Per level: where asd and buf land on the same side of the breaking line, and how often each matches the corpus expectation:

{{corpus_levels_grpc}}

Per area (same side of the breaking line / variants):

{{corpus_areas_grpc}}

Variants at `FILE` where asd and buf disagree on the breaking line:

{{corpus_disagree_grpc}}

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls, one case per fresh process (20 warm-ups or a 60 s warm-up budget, 7 or 11 timed runs); buf: process wall time of `buf breaking` on the cached trees (warm-up, 7 runs).

### 5.1 In-process (median / min ms)

{{timing_grpc}}

### 5.2 buf breaking (process wall time, median / min ms)

{{timing_cli_grpc}}

### 5.3 asd vs buf on the same pair (min ms)

The comparison alone starts from built documents; the end-to-end row parses and builds both trees as buf does.

{{ratio_grpc}}

### 5.4 Scaling (170 → 1 700 → 10 200 messages)

{{scaling_grpc}}

### 5.5 Heap (peak / added by the call / retained MB, one call in a fresh process)

{{heap_grpc}}

### 5.6 structuredClone baseline

{{clone_grpc}}
