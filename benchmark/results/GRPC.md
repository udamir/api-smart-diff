# gRPC / Protocol Buffers benchmark: api-smart-diff (ProtoApi) vs buf breaking

Part of the api-smart-diff benchmark ([overview](README.md)). api-smart-diff compares Protocol Buffers APIs as ProtoApi documents, built from `.proto` source trees with [protoapi](https://github.com/udamir/protoapi); `buf breaking` compares the source trees directly. This report covers a hand-written order service with 17 scripted changes, synthetic APIs of 170, 1 700 and 10 200 messages, an identical tree and the `protoapi` family of the repository's compatibility corpus. Run with `npm run bench:grpc` and render with `npm run report -- --only grpc` ([README](../README.md)).

> **Provenance.** Run of 2026-11-25/26 (Node.js 26.13, Intel Core i9-9880H, 16 GB, macOS) with the ProtoApi engine as released in 2.0.0, protoapi 0.1.0 and buf 1.75.0; the 10 200-message rows were re-measured with full warm-ups in the same session. The machine was loaded by other jobs during the run (load average 6 to 42 during the in-process timing, 5 to 12 during the buf timing), so minimums are the meaningful numbers. These are the numbers quoted in the Performance section of the documentation and in the CHANGELOG.

## 1. Environment

|  |  |
| --- | --- |
| Date | 2026-11-25 |
| Node | v26.13.0, run as `node --expose-gc --max-old-space-size=8192 --stack-size=4000` |
| CPU / RAM | Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz, 16 logical cores, 16 GB |
| OS | Darwin 24.6.0 x64 |
| Builder | esbuild 0.28.2 (`scripts/build.js`) |
| asd 2.0.0 (ProtoApi engine) | api-smart-diff 2.0.0 with the ProtoApi engine, build of 2026-11-25 (the sources released as 2.0.0); version 2.0.0; allof-merge 1.0.1, json-crawl 1.2.0 |
| protoapi | 0.1.0 (protoapi 0.1.0 build): builds the fixture documents and the end-to-end row |
| buf | 1.75.0, GitHub release binary, `buf breaking --error-format json --config '{"version":"v2","breaking":{"use":["<CATEGORY>"]}}'` |
| npm floors | microdiff 1.6.0, jsondiffpatch 0.7.7, deep-diff 1.0.2, fast-json-patch 3.1.1 |

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

| Fixture | Kind | What | .proto before / after | ProtoApi JSON before / after | Expected changes |
| --- | --- | --- | --- | --- | --- |
| `grpc-shop` | changeset | order service (5 rpcs, 9 messages, an enum, protovalidate rules), 17 scripted changes, classes per compatibility level | 2 KB / 2 KB | 9 KB / 9 KB | 17 |
| `grpc-shop-identical` | identical | grpc-shop before tree compared with itself | 2 KB / 2 KB | 9 KB / 9 KB | 0 |
| `grpc-poc-170` | synthetic | proof-of-concept generator, 170 messages (≈ 160 KB), 2 edited messages × 7 changes | 162 KB / 162 KB | 296 KB / 297 KB | 14 |
| `grpc-poc-1700` | synthetic | proof-of-concept generator, 1,700 messages (≈ 1.6 MB), 17 edited messages × 7 changes | 1.6 MB / 1.6 MB | 2.9 MB / 2.9 MB | 119 |
| `grpc-poc-10200` | synthetic | proof-of-concept generator, 10,200 messages (≈ 9.7 MB), 102 edited messages × 7 changes | 9.7 MB / 9.7 MB | 17.3 MB / 17.3 MB | 714 |

## 4. Correctness and classification quality

### 4.1 Change sets

`grpc-shop`:

| Tool | Diffs | Detected (breaking side only for buf) | Precision | Class agreement | Breaking agreement | Missed breaking | Described |
| --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 FILE | 20 | 17/17 (100%) | 100% | 17/17 (100%) | 17/17 (100%) | 0 | 100% |
| buf FILE | 10 | 9/12 (75%) | 100% | 8/9 (89%) | 9/9 (100%) | 3 | 100% |
| asd 2.0.0 PACKAGE | 20 | 17/17 (100%) | 100% | 17/17 (100%) | 17/17 (100%) | 0 | 100% |
| buf PACKAGE | 10 | 9/12 (75%) | 100% | 8/9 (89%) | 9/9 (100%) | 3 | 100% |
| asd 2.0.0 WIRE_JSON | 20 | 17/17 (100%) | 100% | 17/17 (100%) | 17/17 (100%) | 0 | 100% |
| buf WIRE_JSON | 11 | 7/11 (64%) | 100% | 7/7 (100%) | 7/7 (100%) | 4 | 100% |
| asd 2.0.0 WIRE | 20 | 17/17 (100%) | 100% | 17/17 (100%) | 17/17 (100%) | 0 | 100% |
| buf WIRE | 4 | 4/9 (44%) | 100% | 4/4 (100%) | 4/4 (100%) | 5 | 100% |
| asd 2.0.0 from .proto (FILE) | 20 | 17/17 (100%) | 100% | 17/17 (100%) | 17/17 (100%) | 0 | 100% |

`grpc-poc-170`:

| Tool | Diffs | Detected (breaking side only for buf) | Precision | Class agreement | Breaking agreement | Missed breaking | Described |
| --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 FILE | 14 | 14/14 (100%) | 100% | 14/14 (100%) | 14/14 (100%) | 0 | 100% |
| buf FILE | 2 | 2/10 (20%) | 100% | 2/2 (100%) | 2/2 (100%) | 8 | 100% |
| asd 2.0.0 PACKAGE | 14 | 14/14 (100%) | 100% | 14/14 (100%) | 14/14 (100%) | 0 | 100% |
| buf PACKAGE | 2 | 2/10 (20%) | 100% | 2/2 (100%) | 2/2 (100%) | 8 | 100% |
| asd 2.0.0 WIRE_JSON | 14 | 14/14 (100%) | 100% | 14/14 (100%) | 14/14 (100%) | 0 | 100% |
| buf WIRE_JSON | 2 | 2/10 (20%) | 100% | 2/2 (100%) | 2/2 (100%) | 8 | 100% |
| asd 2.0.0 WIRE | 14 | 14/14 (100%) | 100% | 14/14 (100%) | 14/14 (100%) | 0 | 100% |
| buf WIRE | 0 | 0/10 (0%) | — | — | — | 10 | — |
| asd 2.0.0 from .proto (FILE) | 14 | 14/14 (100%) | 100% | 14/14 (100%) | 14/14 (100%) | 0 | 100% |

`grpc-poc-1700`:

| Tool | Diffs | Detected (breaking side only for buf) | Precision | Class agreement | Breaking agreement | Missed breaking | Described |
| --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 FILE | 119 | 119/119 (100%) | 100% | 119/119 (100%) | 119/119 (100%) | 0 | 100% |
| buf FILE | 17 | 17/85 (20%) | 100% | 17/17 (100%) | 17/17 (100%) | 68 | 100% |
| asd 2.0.0 PACKAGE | 119 | 119/119 (100%) | 100% | 119/119 (100%) | 119/119 (100%) | 0 | 100% |
| buf PACKAGE | 17 | 17/85 (20%) | 100% | 17/17 (100%) | 17/17 (100%) | 68 | 100% |
| asd 2.0.0 WIRE_JSON | 119 | 119/119 (100%) | 100% | 119/119 (100%) | 119/119 (100%) | 0 | 100% |
| buf WIRE_JSON | 17 | 17/85 (20%) | 100% | 17/17 (100%) | 17/17 (100%) | 68 | 100% |
| asd 2.0.0 WIRE | 119 | 119/119 (100%) | 100% | 119/119 (100%) | 119/119 (100%) | 0 | 100% |
| buf WIRE | 0 | 0/85 (0%) | — | — | — | 85 | — |
| asd 2.0.0 from .proto (FILE) | 119 | 119/119 (100%) | 100% | 119/119 (100%) | 119/119 (100%) | 0 | 100% |

`grpc-poc-10200`:

| Tool | Diffs | Detected (breaking side only for buf) | Precision | Class agreement | Breaking agreement | Missed breaking | Described |
| --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 FILE | 714 | 714/714 (100%) | 100% | 714/714 (100%) | 714/714 (100%) | 0 | 100% |
| buf FILE | 102 | 102/510 (20%) | 100% | 102/102 (100%) | 102/102 (100%) | 408 | 100% |
| asd 2.0.0 PACKAGE | 714 | 714/714 (100%) | 100% | 714/714 (100%) | 714/714 (100%) | 0 | 100% |
| buf PACKAGE | 102 | 102/510 (20%) | 100% | 102/102 (100%) | 102/102 (100%) | 408 | 100% |
| asd 2.0.0 WIRE_JSON | 714 | 714/714 (100%) | 100% | 714/714 (100%) | 714/714 (100%) | 0 | 100% |
| buf WIRE_JSON | 102 | 102/510 (20%) | 100% | 102/102 (100%) | 102/102 (100%) | 408 | 100% |
| asd 2.0.0 WIRE | 714 | 714/714 (100%) | 100% | 714/714 (100%) | 714/714 (100%) | 0 | 100% |
| buf WIRE | 0 | 0/510 (0%) | — | — | — | 510 | — |
| asd 2.0.0 from .proto (FILE) | 714 | 714/714 (100%) | 100% | 714/714 (100%) | 714/714 (100%) | 0 | 100% |

### 4.2 `grpc-shop` per change and level

Expected class / asd verdict / buf verdict per level (B breaking, R risky, N non-breaking, D deprecated, A annotation, – not reported).

| Change | What | FILE exp / asd / buf | PACKAGE exp / asd / buf | WIRE_JSON exp / asd / buf | WIRE exp / asd / buf | Rule |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | rpc CancelOrder removed | B / B / B | B / B / B | B / B / – | B / B / – | rpc removed |
| G2 | rpc RefundOrder added (with its request message) | N / N / – | N / N / – | N / N / – | N / N / – | rpc and message added |
| G3 | response field Order.priority int32 -> int64 | B / B / B | B / B / B | B / B / B | R / R / – | int32 and int64 share the varint wire type (WIRE: risky), but ProtoJSON writes int64 as a string |
| G4 | response field Order.note renumbered 7 -> 9 | B / B / B | B / B / B | B / B / B | B / B / B | renumbered = removed + added |
| G5 | response field Order.customer_id renamed buyer_id (same number) | B / B / B | B / B / B | B / B / B | N / N / – | renamed: the JSON name changes, the wire number does not |
| G6 | enum value ORDER_STATUS_LEGACY (4) removed, number not reserved | B / B / B | B / B / B | B / B / B | B / B / B | removed, number and name not reserved |
| G7 | enum value ORDER_STATUS_REFUNDED (5) added to an enum read in responses | R / R / – | R / R / – | R / R / – | R / R / – | added: non-breaking in requests, risky in responses |
| G8 | request field CreateOrderRequest.channel added | N / N / – | N / N / – | N / N / – | N / N / – | field added |
| G9 | request field ListOrdersRequest.page_size gains protovalidate bounds 1 … 100 | B / B / – | B / B / – | B / B / – | B / B / – | protovalidate bounds added in a request |
| G10 | LineItem.sku min_len 1 -> 3 (LineItem used in a request and a response) | B / B / – | B / B / – | B / B / – | B / B / – | min_len raised: breaking in the request use |
| G11 | rpc WatchOrders no longer server streaming | B / B / B | B / B / B | B / B / B | B / B / B | server streaming toggled |
| G12 | field Order.created_at deprecated | D / D / – | D / D / – | D / D / – | D / D / – | deprecation |
| G13 | comment of rpc GetOrder changed | A / A / – | A / A / – | A / A / – | A / A / – | description |
| G14 | file option go_package changed | R / R / B | R / R / B | A / A / – | A / A / – | language option: affects generated code only |
| G15 | Money.nanos json_name set to nano | B / B / B | B / B / B | B / B / B | A / A / – | effective JSON name changed |
| G16 | response field Order.tracking_number added | N / N / – | N / N / – | N / N / – | N / N / – | field added (tolerant readers) |
| G17 | response field ListOrdersResponse.next_page_token removed (number not reserved) | B / B / B | B / B / B | B / B / B | B / B / B | removed, number and name not reserved |

### 4.3 Identical documents (every tool must report 0 changes)

| Tool | Diffs on `grpc-shop-identical` |
| --- | --- |
| asd 2.0.0 FILE | 0 |
| asd 2.0.0 PACKAGE | 0 |
| asd 2.0.0 WIRE_JSON | 0 |
| asd 2.0.0 WIRE | 0 |
| asd 2.0.0 from .proto (FILE) | 0 |
| buf FILE | 0 |
| buf PACKAGE | 0 |
| buf WIRE_JSON | 0 |
| buf WIRE | 0 |
| microdiff | 0 |
| jsondiffpatch | 0 |
| deep-diff | 0 |
| fast-json-patch | 0 |

### 4.4 Input mutation and merged document

| Tool | `grpc-shop` | `grpc-shop-identical` | `grpc-poc-1700` |
| --- | --- | --- | --- |
| asd 2.0.0 FILE | no mutation, merged document | no mutation, merged document | no mutation, merged document |
| asd 2.0.0 PACKAGE | no mutation, merged document | no mutation, merged document | no mutation, merged document |
| asd 2.0.0 WIRE_JSON | no mutation, merged document | no mutation, merged document | no mutation, merged document |
| asd 2.0.0 WIRE | no mutation, merged document | no mutation, merged document | no mutation, merged document |
| microdiff | no mutation | no mutation | no mutation |
| jsondiffpatch | no mutation | no mutation | no mutation |
| deep-diff | no mutation | no mutation | no mutation |
| fast-json-patch | no mutation | no mutation | no mutation |

### 4.5 Harvested compatibility corpus (compat family `protoapi`)

Every variant of the compat family `protoapi` of the repository (`test/compat/protoapi/`): change scenarios, partly re-authored from buf's own test data (area `buf corpus`), each at the four levels, exported with their ProtoApi documents and `.proto` trees by `scripts/corpus-export-grpc.ts`. asd compares each variant at its level, buf runs the category of the same name on the variant's trees. Case-level scoring as for the other types ([overview](README.md) §3).

416 variants of 101 cases (compat family `protoapi`), exported 2026-11-25; run 2026-11-25. Every variant is compared at its own level (asd `compatibility`, buf category).

| Tool | Variants run | Detected | Classified | Breaking side | Described | Risky | Strict D / C / A / all |
| --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 (each variant at its level) | 416 | 416/416 (100%) | 416/416 (100%) | 416/416 (100%) | 416/416 (100%) | 134/134 | 100% / 100% / 100% / **100%** |
| buf (each variant's level as category) | 416 | 370/416 (89%) | 125/293 (43%) | 229/293 (78%) | 247/293 (84%) | 0/134 | — |
| microdiff | 416 | 412/416 (99%) | — | — | — | 0/134 | — |
| jsondiffpatch | 416 | 412/416 (99%) | — | — | — | 0/134 | — |
| deep-diff | 416 | 412/416 (99%) | — | — | — | 0/134 | — |
| fast-json-patch | 416 | 412/416 (99%) | — | — | — | 0/134 | — |

Per level: where asd and buf land on the same side of the breaking line, and how often each matches the corpus expectation:

| Level | Variants | asd and buf on the same side of the breaking line | asd breaking-side only | buf breaking only | Expected breaking-side | asd matches the expectation | buf matches the expectation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FILE | 104 | 95/104 (91%) | 7 | 2 | 89 | 104/104 (100%) | 95/104 (91%) |
| PACKAGE | 104 | 93/104 (89%) | 9 | 2 | 87 | 104/104 (100%) | 93/104 (89%) |
| WIRE_JSON | 104 | 84/104 (81%) | 12 | 8 | 53 | 104/104 (100%) | 84/104 (81%) |
| WIRE | 104 | 80/104 (77%) | 18 | 6 | 46 | 104/104 (100%) | 80/104 (77%) |

Per area (same side of the breaking line / variants):

| Area | FILE: same side / variants | PACKAGE: same side / variants | WIRE_JSON: same side / variants | WIRE: same side / variants |
| --- | --- | --- | --- | --- |
| annotations | 4/6 (asd only 2) | 4/6 (asd only 2) | 4/6 (asd only 2) | 4/6 (asd only 2) |
| buf corpus | 3/3 | 3/3 | 3/3 | 2/3 (buf only 1) |
| edge cases | 4/4 | 4/4 | 3/4 (buf only 1) | 1/4 (buf only 1) (asd only 2) |
| enums | 12/14 (buf only 1) (asd only 1) | 11/14 (buf only 1) (asd only 2) | 10/14 (buf only 1) (asd only 3) | 10/14 (asd only 4) |
| extensions | 3/3 | 2/3 (asd only 1) | 2/3 (asd only 1) | 2/3 (asd only 1) |
| fields | 26/26 | 26/26 | 23/26 (buf only 2) (asd only 1) | 21/26 (buf only 1) (asd only 4) |
| files | 5/5 | 5/5 | 3/5 (buf only 1) (asd only 1) | 4/5 (asd only 1) |
| messages | 11/13 (asd only 2) | 11/13 (asd only 2) | 9/13 (buf only 2) (asd only 2) | 9/13 (buf only 2) (asd only 2) |
| options | 19/21 (asd only 2) | 19/21 (asd only 2) | 21/21 | 21/21 |
| services | 8/9 (buf only 1) | 8/9 (buf only 1) | 6/9 (buf only 1) (asd only 2) | 6/9 (buf only 1) (asd only 2) |

Variants at `FILE` where asd and buf disagree on the breaking line:

| Variant | Area | Change | Expected | asd verdict / diffs | buf verdict / findings | buf verdict recorded by the case |
| --- | --- | --- | --- | --- | --- | --- |
| `PB-ANN-003@FILE.request` | annotations | kept field marked `REQUIRED` by `google.api.field_behavior` | B | B/1 | –/0 | — |
| `PB-ANN-004@FILE.request` | annotations | maximum length added by protovalidate | B | B/1 | –/0 | — |
| `PB-ENUM-009@FILE` | enums | closed enum made open (edition 2023) | N | N/1 | B/1 | ENUM_SAME_TYPE F P |
| `PB-ENUM-012@FILE.response` | enums | enum value added: non-breaking in a request, risky in a response | R | R/1 | –/0 | — |
| `PB-MSG-012@FILE` | messages | `message_set_wire_format` removed (proto2) | B | B/1 | –/0 | MESSAGE_SAME_MESSAGE_SET_WIRE_FORMAT (opt-in) |
| `PB-MSG-013@FILE` | messages | message visibility `export` → `local` (edition 2024) | R | R/1 | –/0 | none |
| `PB-OPT-017@FILE` | options | `java_string_check_utf8` changed: one record at the file, none at its fields (R-G) | R | R/1 | –/0 | FIELD_SAME_JAVA_UTF8_VALIDATION F P |
| `PB-OPT-020@FILE` | options | `ctype = CORD` replaced by `features.(pb.cpp).string_type = CORD`: two options, two records (R-G) | R | R/3 | –/0 | none |
| `PB-SVC-009@FILE` | services | idempotency level added | N | N/1 | B/1 | RPC_SAME_IDEMPOTENCY_LEVEL F P J W |

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls, one case per fresh process (20 warm-ups or a 60 s warm-up budget, 7 or 11 timed runs); buf: process wall time of `buf breaking` on the cached trees (warm-up, 7 runs).

### 5.1 In-process (median / min ms)

| Tool | `grpc-shop` | `grpc-shop-identical` | `grpc-poc-170` | `grpc-poc-1700` | `grpc-poc-10200` |
| --- | --- | --- | --- | --- | --- |
| asd 2.0.0 FILE | 1.54 / 1.44 | 0.24 / 0.20 | 19.8 / 18.6 | 183 / 176 | 1.22 s / 1.20 s |
| asd 2.0.0 PACKAGE | 2.32 / 1.70 | 0.28 / 0.21 | 21.2 / 18.7 | 187 / 173 | 1.24 s / 1.21 s |
| asd 2.0.0 WIRE_JSON | 1.61 / 1.43 | 0.23 / 0.19 | 19.8 / 17.5 | 202 / 193 | 1.22 s / 1.20 s |
| asd 2.0.0 WIRE | 1.56 / 1.45 | 0.26 / 0.19 | 20.2 / 17.3 | 164 / 162 | 1.23 s / 1.23 s |
| asd 2.0.0 from .proto (FILE) | 9.07 / 8.11 | 7.03 / 6.17 | 302 / 242 | 2.24 s / 2.11 s | 12.81 s / 12.46 s |
| protoapi build only | 7.17 / 5.84 | 6.43 / 5.82 | 272 / 224 | 2.04 s / 1.94 s | 10.88 s / 10.67 s |
| microdiff | 0.09 / 0.09 | 0.10 / 0.08 | 4.58 / 4.53 | 47.6 / 43.3 | timeout-budget |
| jsondiffpatch | 0.44 / 0.39 | 0.52 / 0.40 | 12.4 / 10.6 | 108 / 103 | 547 / 540 |
| deep-diff | 0.14 / 0.13 | 0.12 / 0.10 | 4.72 / 4.48 | 50.9 / 50.5 | 473 / 464 |
| fast-json-patch | 0.07 / 0.07 | 0.07 / 0.06 | 1.86 / 1.75 | 19.8 / 17.9 | 108 / 102 |

### 5.2 buf breaking (process wall time, median / min ms)

| buf breaking (process) | `grpc-shop` | `grpc-shop-identical` | `grpc-poc-170` | `grpc-poc-1700` | `grpc-poc-10200` |
| --- | --- | --- | --- | --- | --- |
| buf FILE median / min | 124 / 120 | 124 / 119 | 411 / 402 | 3.70 s / 3.63 s | 25.34 s / 24.19 s |
| buf PACKAGE median / min | 123 / 120 | 120 / 119 | 404 / 402 | 3.75 s / 3.66 s | 24.66 s / 23.83 s |
| buf WIRE_JSON median / min | 123 / 122 | 125 / 121 | 407 / 397 | 3.73 s / 3.70 s | 23.99 s / 23.59 s |
| buf WIRE median / min | 123 / 121 | 123 / 120 | 391 / 384 | 3.29 s / 3.26 s | 20.49 s / 20.02 s |
| no-op (one-message tree vs itself) | 63.5 / 60.4 | 63.5 / 60.4 | 63.5 / 60.4 | 63.5 / 60.4 | 63.5 / 60.4 |
| peak RSS FILE (MB) | 61.9 | 60.9 | 155.3 | 965.7 | 5884.6 |

### 5.3 asd vs buf on the same pair (min ms)

The comparison alone starts from built documents; the end-to-end row parses and builds both trees as buf does.

| Fixture | asd compare (min ms) | asd from .proto: protoapi build + compare (min ms) | buf breaking FILE (process, min ms) | compare / buf | end to end / buf |
| --- | --- | --- | --- | --- | --- |
| `grpc-shop` | 1.44 | 8.11 | 120 | 0.01× | 0.07× |
| `grpc-poc-170` | 18.6 | 242 | 402 | 0.05× | 0.60× |
| `grpc-poc-1700` | 176 | 2.11 s | 3.63 s | 0.05× | 0.58× |
| `grpc-poc-10200` | 1.20 s | 12.46 s | 24.19 s | 0.05× | 0.52× |

### 5.4 Scaling (170 → 1 700 → 10 200 messages)

| Tool (min ms) | `grpc-poc-170` | `grpc-poc-1700` | `grpc-poc-10200` | 170 → 1,700 (10× input) | 1,700 → 10,200 (6× input) |
| --- | --- | --- | --- | --- | --- |
| asd 2.0.0 FILE | 18.6 | 176 | 1.20 s | 9.45× | 6.82× |
| asd 2.0.0 PACKAGE | 18.7 | 173 | 1.21 s | 9.25× | 6.99× |
| asd 2.0.0 WIRE_JSON | 17.5 | 193 | 1.20 s | 11.06× | 6.24× |
| asd 2.0.0 WIRE | 17.3 | 162 | 1.23 s | 9.37× | 7.58× |
| asd 2.0.0 from .proto (FILE) | 242 | 2.11 s | 12.46 s | 8.73× | 5.90× |
| protoapi build only | 224 | 1.94 s | 10.67 s | 8.67× | 5.50× |
| buf FILE (process) | 402 | 3.63 s | 24.19 s | 9.04× | 6.66× |
| fast-json-patch | 1.75 | 17.9 | 102 | 10.22× | 5.73× |

### 5.5 Heap (peak / added by the call / retained MB, one call in a fresh process)

| Tool | `grpc-shop` | `grpc-shop-identical` | `grpc-poc-170` | `grpc-poc-1700` | `grpc-poc-10200` |
| --- | --- | --- | --- | --- | --- |
| asd 2.0.0 FILE | 11.1 / 1.1 / 0.3 | 9.4 / 0.1 / 0.2 | 28.8 / 16.4 / 0.7 | 74.2 / 42.4 / 6.2 | 290.6 / 154.6 / 35.6 |
| asd 2.0.0 PACKAGE | 10.9 / 0.8 / 0.3 | 9.4 / 0.1 / 0.1 | 28.8 / 16.4 / 0.7 | 74.1 / 42.3 / 6.1 | 290.9 / 154.8 / 35.6 |
| asd 2.0.0 WIRE_JSON | 10.9 / 0.8 / 0.1 | 9.4 / 0.1 / 0.1 | 28.8 / 16.4 / 0.7 | 74.1 / 42.3 / 6.1 | 290.8 / 154.7 / 35.6 |
| asd 2.0.0 WIRE | 11.1 / 1.1 / 0.2 | 9.4 / 0.1 / 0.1 | 28.8 / 16.4 / 0.7 | 74.1 / 42.3 / 6.4 | 291.2 / 155.1 / 35.6 |
| asd 2.0.0 from .proto (FILE) | 22.2 / 5.6 / 0.1 | 20.6 / 4.7 / 0.0 | 64.1 / 46.3 / 0.2 | 343.5 / 325.0 / 6.3 | 2138.2 / 2118.4 / 42.5 |
| protoapi build only | 18.0 / 4.8 / 0.1 | 17.8 / 4.6 / 0.1 | 59.8 / 45.8 / 6.0 | 330.2 / 316.5 / 60.7 | 1285.6 / 1271.8 / 380.6 |
| microdiff | 6.8 / 0.0 / 0.1 | 6.8 / 0.0 / 0.0 | 9.7 / 0.9 / 0.1 | 36.0 / 8.7 / 0.1 | 163.0 / 33.9 / 0.7 |
| jsondiffpatch | 7.1 / 0.1 / 0.1 | 7.1 / 0.1 / 0.1 | 12.8 / 3.8 / 0.0 | 62.5 / 34.9 / 0.2 | 336.0 / 206.7 / 0.2 |
| deep-diff | 6.8 / 0.1 / 0.0 | 6.8 / 0.1 / 0.0 | 15.9 / 7.1 / 0.0 | 59.3 / 32.0 / 0.1 | 161.6 / 32.6 / 0.4 |
| fast-json-patch | 6.7 / 0.0 / 0.2 | 6.7 / 0.0 / 0.0 | 10.0 / 1.2 / 0.0 | 39.4 / 12.1 / 0.1 | 161.8 / 32.8 / 0.2 |

### 5.6 structuredClone baseline

| Fixture | structuredClone(before) + structuredClone(after), median / min ms | asd FILE min ms | asd / clone |
| --- | --- | --- | --- |
| `grpc-poc-1700` | 107 / 105 | 176 | 1.67× |
| `grpc-poc-10200` | 664 / 629 | 1.20 s | 1.90× |
