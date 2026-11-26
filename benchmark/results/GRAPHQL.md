# GraphQL benchmark: api-smart-diff vs the Netcracker fork vs graphql-inspector and graphql-js

Part of the api-smart-diff benchmark; the [overview](README.md) holds the shared methodology, the feature matrix, bundle sizes and the fork build validation. This report covers the GitHub public GraphQL schema with a scripted change set, the repository's schema pair and an identical schema. Run with `npm run bench:graphql` and render with `npm run report` ([README](../README.md)).

> **Provenance.** Full run of 2026-11-21 (Node.js 26.13, Intel Core i9-9880H, 16 GB, macOS, laptop not idle). "asd 1.0.6" is 1.0.6 built from its source (commit aaed6b3), not the published package; "asd 2.0.0" is the pre-release build of 2026-11-21 on GraphApi 1.0 input (gqlapi 0.6.0). The harvested-corpus table also contains the corpus variants in the GraphApi 0.1.2 encoding that existed at the time. See the [overview](README.md) for details.

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
| npm peers | graphql-inspector-core 8.0.3, graphql-js 16.12.0, microdiff 1.6.0, jsondiffpatch 0.7.7, deep-diff 1.0.2, fast-json-patch 3.1.1 |

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

| Fixture | Family | Kind | Description | Size (before / after, JSON) | Expected changes |
| --- | --- | --- | --- | --- | --- |
| `gql-github` | graphql | changeset | GitHub public GraphQL schema (1.1 MB SDL), 18 scripted changes | 1120 / 1120 KB SDL | 18 |
| `gql-github-identical` | graphql | identical | GitHub public GraphQL schema compared with itself | 1120 / 1120 KB SDL | 0 |
| `gql-repo-pair` | graphql | changeset | test/resources/schema-before.graphql -> schema-after.graphql (7 changes + comment edits and field reorders that are not changes) | 2 / 2 KB SDL | 7 |

## 4. Correctness and classification quality

Columns and verdict letters as in the [OpenAPI report](OPENAPI.md) §4.

### 4.1 Totals over the curated GraphQL change sets

Headline timings: min ms of the in-process call; `†` = that cell's correctness check failed.

| Tool | Change-set fixtures run | Detected | Precision | Class agreement | Breaking agreement | Risky | Described | `gql-repo-pair` (min ms) | `gql-github` (min ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 1.0.6 | 1 (+1 error) | 7/7 (100%) | 84% | 6/7 (86%) | 6/7 (86%) | — | 10% | 120 | timeout |
| asd 2.0.0 | 2 | 24/24 (100%) | 100% | 25/25 (100%) | 25/25 (100%) | 1/1 (1 risky) | 100% | 0.72 | 69.5 |
| fork 4.0.1 | 2 | 24/24 (100%) | 100% | 25/25 (100%) | 25/25 (100%) | 1/1 (1 risky) | 100% | 47.7 | 8.20 s |
| graphql-inspector | 2 | 24/24 (100%) | 100% | 25/25 (100%) | 25/25 (100%) | 1/1 (1 risky) | 100% | 0.19 | 17.2 |
| graphql-js | 2 | 17/24 (71%) | 100% | 15/17 (88%) | 15/17 (88%) | 1/1 (3 risky) | 100% | 0.44 † | 24.4 † |
| fast-json-patch (floor) | — | no classification | — | — | — | — | — | 0.08 | 8.86 |

### 4.2 Change sets

| Fixture | Tool | Diffs | Detected (recall) | Precision | Class agreement | Breaking agreement | Risky | End-to-end | Described | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gql-github` | asd 1.0.6 | timeout |  |  |  |  |  |  |  |  |
| `gql-github` | asd 2.0.0 | 18 | 17/17 (100%) | 100% | 18/18 | 18/18 | 1/1 (1 risky) | 100% | 100% |  |
| `gql-github` | fork 4.0.1 | 26 | 17/17 (100%) | 100% | 18/18 | 18/18 | 1/1 (1 risky) | 100% | 100% (12 weak) |  |
| `gql-github` | graphql-inspector | 22 | 17/17 (100%) | 100% | 18/18 | 18/18 | 1/1 (1 risky) | 100% | 100% |  |
| `gql-github` | graphql-js | 12 | 12/17 (71%) | 100% | 10/12 | 10/12 | 1/1 (3 risky) | 59% | 100% | false breaking: Q4, Q16 |
| `gql-repo-pair` | asd 1.0.6 | 82 | 7/7 (100%) | 84% | 6/7 | 6/7 | — | 86% | 10% | missed breaking: R7 |
| `gql-repo-pair` | asd 2.0.0 | 7 | 7/7 (100%) | 100% | 7/7 | 7/7 | — | 100% | 100% |  |
| `gql-repo-pair` | fork 4.0.1 | 9 | 7/7 (100%) | 100% | 7/7 | 7/7 | — | 100% | 100% (7 weak) |  |
| `gql-repo-pair` | graphql-inspector | 7 | 7/7 (100%) | 100% | 7/7 | 7/7 | — | 100% | 100% |  |
| `gql-repo-pair` | graphql-js | 5 | 5/7 (71%) | 100% | 5/5 | 5/5 | — | 71% | 100% |  |

Per-change verdicts, `gql-github` (GitHub GraphQL schema, scripted change set):

| Id | Change | Expected | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | graphql-inspector | graphql-js |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q1 | ActorLocation.countryCode (output field) removed | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q2 | AddCommentPayload.benchAddedField added | N | timeout | N ✓ | N ✓ | N ✓ | **miss** |
| Q3 | AnnouncementBanner.isUserDismissible gains required argument | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q4 | App.clientId gains optional argument | N | timeout | N ✓ | N ✓ | N ✓ | **R ✗** |
| Q5 | AutoMergeDisabledEvent.reasonCode nullable -> non-null (output) | N | timeout | N ✓ | N ✓ | N ✓ | **miss** |
| Q6 | BaseRefChangedEvent.currentRefName non-null -> nullable (output) | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q7 | BranchProtectionRule.branchProtectionRuleConflicts(after) nullable -> non-null | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q8 | CheckSuite.matchingPullRequests argument states removed | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q9 | enum CommentAuthorAssociation value FIRST_TIMER removed | B (N) | timeout | N ✓ | N ✓ | B ✓ | B ✓ |
| Q10 | enum CheckAnnotationLevel value BENCH_NEW_VALUE added | R (N/B) | timeout | R ✓ | R ✓ | R ✓ | R ✓ |
| Q11 | Query.codesOfConduct (root field) removed | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q12 | Mutation.benchMutation added | N | timeout | N ✓ | N ✓ | N ✓ | **miss** |
| Q13 | AutoMergeRequest.enabledAt deprecated | D (N/A) | timeout | D ✓ | D ✓ | N ✓ | **miss** |
| Q14 | BlameRange.endingLine description changed | A | timeout | A ✓ | A ✓ | N ✓ | **miss** |
| Q15 | input AbortQueuedMigrationsInput gains required field | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q16 | input AbortRepositoryMigrationInput gains optional field | N | timeout | N ✓ | N ✓ | N ✓ | **R ✗** |
| Q17 | CVSS.vectorString String -> Int (output) | B | timeout | B ✓ | B ✓ | B ✓ | B ✓ |
| Q18 | type BenchNewType added (unreferenced) | N | timeout | N ✓ | N ✓ | N ✓ | – (ok) |

Per-change verdicts, `gql-repo-pair` (the repository's schema pair):

| Id | Change | Expected | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | graphql-inspector | graphql-js |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Query2.continents [Continent]! -> [Continent] (output) | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| R2 | Country.code ID -> String | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| R3 | Country.states description changed | A | A ✓ | A ✓ | A ✓ | N ✓ | **miss** |
| R4 | Language.code ID -> String | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| R5 | Tweet.id ID! -> ID (output) | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| R6 | Stat.responses added | N | N ✓ | N ✓ | N ✓ | N ✓ | **miss** |
| R7 | Query.NotificationsMeta removed | B | **U ✗** | B ✓ | B ✓ | B ✓ | B ✓ |

### 4.3 Identical documents (every tool must report 0 changes)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | graphql-inspector | graphql-js | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gql-github-identical` | timeout | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### 4.4 Input mutation and merged document

| Tool | Fixtures run | Mutated an input | Merged / annotated document |
| --- | --- | --- | --- |
| asd 1.0.6 | 1 | none | yes |
| asd 2.0.0 | 3 | none | yes |
| fork 4.0.1 | 3 | none | yes |
| graphql-inspector | 3 | n/a (GraphQLSchema inputs cannot be snapshotted) | no |
| graphql-js | 3 | n/a (GraphQLSchema inputs cannot be snapshotted) | no |
| microdiff | 3 | none | no |
| jsondiffpatch | 3 | none | no |
| deep-diff | 3 | none | no |
| fast-json-patch | 3 | none | no |

### 4.5 Harvested compatibility corpus

The GraphQL cases of the repository's compatibility corpus, scored per variant as described in the [overview](README.md) §3: asd 2.0.0 and the structural diffs read the variant's GraphApi documents, graphql-inspector and graphql-js its SDL, asd 1.0.6 and the fork the SDL converted with their own GraphApi builders. graphql-js reports breaking and dangerous changes only, so a non-breaking change is not detected by it.

700 variants of 350 cases, exported 2026-11-21; run 2026-11-21. **Partial run** (tools asd-2.0.0).

| Tool | Variants run | Errors / timeouts | Detected | Classified | Breaking agreement | Risky | Described | All three | Strict D / C / A / all (asd) | Variants where it beats asd 2.0.0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 | 700 | 0 | 700/700 (100%) | 700/700 (100%) | 700/700 (100%) | 58/58 (58 risky) | 668/668 (100%) | 700/700 (100%) | 100% / 100% / 100% / **100%** | — |

Per compat family:

| Family | Variants | asd 1.0.6 strict all | asd 2.0.0 strict D / C / A / all | asd 2.0.0 classified |
| --- | --- | --- | --- | --- |
| core | 2 | — | 100% / 100% / 100% / **100%** | 100% |
| graphql | 698 | — | 100% / 100% / 100% / **100%** | 100% |

Variants where another tool does better than asd 2.0.0:

No variant where another tool beats asd 2.0.0.

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls; `n/a` = the tool does not accept that kind of document; `error` = the tool threw; `timeout` = the first call did not finish within 60 s; `†` = the correctness check of that cell failed.

### 5.1 GraphQL (median / min ms)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | graphql-inspector | graphql-js | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gql-github` | timeout | 78.3 / 69.5 | 8.38 s / 8.20 s | 18.1 / 17.2 | 25.3 / 24.4 † | 21.9 / 20.9 | 39.5 / 37.7 | 23.1 / 22.3 | 9.25 / 8.86 |
| `gql-github-identical` | timeout | 31.2 / 30.1 | 8.35 s / 8.25 s | 17.7 / 17.2 | 24.5 / 23.8 | 22.9 / 21.9 | 36.1 / 35.1 | 22.5 / 21.8 | 9.04 / 8.83 |
| `gql-repo-pair` | 123 / 120 | 0.82 / 0.72 | 50.3 / 47.7 | 0.21 / 0.19 | 0.47 / 0.44 † | 0.20 / 0.16 | 0.63 / 0.60 | 0.23 / 0.18 | 0.08 / 0.08 |

### 5.2 Scaling

There is no controlled size series for GraphQL; the table compares the small repository pair with the GitHub schema (input ratio of the SDL before + after).

| Series (min ms) | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | graphql-inspector | graphql-js | microdiff | jsondiffpatch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gql-repo-pair` → `gql-github` (545× SDL input) | 120 → timeout (—) | 0.72 → 69.5 (96.28×) | 47.7 → 8.20 s (171.86×) | 0.19 → 17.2 (90.11×) | 0.44 → 24.4 (55.06×) | 0.16 → 20.9 (130.07×) | 0.60 → 37.7 (62.90×) |

### 5.3 Merged-document and option cost (median / min ms)

| Fixture | asd 2.0.0 | asd 2.0.0 merged:normalized | fork 4.0.1 | fork 4.0.1 normalizedResult | fork 4.0.1 plain options |
| --- | --- | --- | --- | --- | --- |
| `gql-github` | 78.3 / 69.5 | 154 / 150 | 8.38 s / 8.20 s | 7.12 s / 7.00 s | 4.32 s / 4.24 s |

### 5.4 Heap (peak / added by the call / retained MB, one call in a fresh process)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | graphql-inspector | graphql-js | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gql-github` | timeout | 59.8 / 34.7 / 4.5 | 521.1 / 494.8 / 17.1 | 82.3 / 32.1 / -0.1 | 81.6 / 32.0 / -0.0 | 28.2 / 6.1 / 0.0 | 40.6 / 18.3 / 0.2 | 54.3 / 32.2 / 0.0 | 29.9 / 7.8 / 0.0 |
| `gql-github-identical` | timeout | 40.4 / 16.0 / 4.7 | 437.8 / 411.6 / 17.0 | 82.2 / 32.0 / -0.1 | 80.9 / 31.5 / -0.0 | 28.1 / 6.0 / 0.0 | 40.6 / 18.2 / 0.0 | 54.2 / 32.1 / 0.0 | 29.9 / 7.8 / 0.0 |
| `gql-repo-pair` | 16.3 / 8.8 / 0.1 | 9.3 / 0.6 / 0.3 | 28.3 / 17.0 / 0.1 | 8.5 / 0.3 / 0.0 | 8.1 / 0.7 / 0.0 | 6.8 / 0.1 / 0.1 | 7.2 / 0.1 / 0.0 | 7.0 / 0.3 / 0.0 | 6.8 / 0.1 / 0.0 |
