# OpenAPI benchmark: api-smart-diff vs the Netcracker fork vs OpenAPI and JSON Schema diff tools

Part of the api-smart-diff benchmark; the [overview](README.md) holds the shared methodology (timing, heap, quality metrics, classification vocabularies), the feature matrix, bundle sizes and the fork build validation. This report covers the OpenAPI fixtures (petstore 3.0 / 3.1 / 3.2, the GitHub REST description, synthetic scaling and direction fixtures, identical documents) and the JSON Schema fixtures (OpenAPI schemas are JSON Schema, so json-schema-diff and the stand-alone JSON Schema sets belong here). Run with `npm run bench:openapi` and render with `npm run report` ([README](../README.md)).

> **Provenance.** Full run of 2026-11-21 (Node.js 26.13, Intel Core i9-9880H, 16 GB, macOS, laptop not idle). "asd 1.0.6" is 1.0.6 built from its source (commit aaed6b3), not the published package, which is slower (GitHub REST change set 10.2 s with the package vs 6.9 s here); "asd 2.0.0" is the pre-release build of 2026-11-21, before the last performance pass of the release (re-measured with the released build on 2026-11-25, the GitHub REST change set takes 119 to 122 ms instead of the 139 ms here). See the [overview](README.md) for details.

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
| Go CLIs | oasdiff 1.38.0, openapi-changes 0.4.3 (GitHub release binaries) |
| npm peers | openapi-diff 0.24.1, json-schema-diff 1.0.0, microdiff 1.6.0, jsondiffpatch 0.7.7, deep-diff 1.0.2, fast-json-patch 3.1.1 |

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

| Fixture | Family | Kind | Description | Size (before / after, JSON) | Expected changes |
| --- | --- | --- | --- | --- | --- |
| `oas-petstore` | openapi | changeset | petstore.yaml (repo) + base patch, 24 scripted changes | 14 / 14 KB | 24 |
| `oas-petstore-identical` | openapi | identical | petstore.yaml (repo) compared with itself | 14 / 14 KB | 0 |
| `oas31-petstore` | openapi | changeset | oas-petstore with openapi: 3.1.0 on both sides | 14 / 14 KB | 24 |
| `oas32-petstore` | openapi | changeset | oas-petstore with openapi: 3.2.0 on both sides | 14 / 14 KB | 24 |
| `oas-override-identical` | openapi | identical | operation-level parameter overriding a path-level one, 4XX/5XX codes, header params; compared with itself | 1 / 1 KB | 0 |
| `oas-wide-1000` | openapi | synthetic | request body schema with 1000 properties, every 20th type string -> integer (50 changes) | 25 / 25 KB | 50 |
| `oas-wide-4000` | openapi | synthetic | request body schema with 4000 properties, every 20th type string -> integer (200 changes) | 101 / 101 KB | 200 |
| `oas-wide-10000` | openapi | synthetic | request body schema with 10000 properties, every 20th type string -> integer (500 changes) | 253 / 254 KB | 500 |
| `oas-deep-100` | openapi | synthetic | request body schema nested 100 levels, leaf type string -> integer | 4 / 4 KB | 1 |
| `oas-deep-500` | openapi | synthetic | request body schema nested 500 levels, leaf type string -> integer | 20 / 20 KB | 1 |
| `oas-refs-500` | openapi | synthetic | 500 operations whose 200 response uses one $ref component; its property code string -> integer | 66 / 66 KB | 1 |
| `oas-refs-2000` | openapi | synthetic | 2000 operations whose 200 response uses one $ref component; its property code string -> integer | 265 / 265 KB | 1 |
| `oas-dir-request-1500` | openapi | synthetic | 1 500-property schema used only in a request, first property type string -> integer | 37 / 37 KB | 1 |
| `oas-dir-response-1500` | openapi | synthetic | 1 500-property schema used only in a response, first property type string -> integer | 37 / 37 KB | 1 |
| `oas-oneof-40` | openapi | synthetic | request body oneOf with 40 branches of 40 properties, one leaf type change | 43 / 43 KB | 1 |
| `oas-github` | openapi | changeset | GitHub REST API description (7.6 MB minified, 1 281 operations, 1 015 schemas), 21 scripted changes | 7459 / 7451 KB | 21 |
| `oas-github-identical` | openapi | identical | GitHub REST API description compared with itself | 7459 / 7459 KB | 0 |
| `js-repo-pair` | jsonschema | changeset | test/resources/schema-before.yaml -> schema-after.yaml (20 changes) | 2 / 2 KB | 20 |
| `js-identical` | jsonschema | identical | test/resources/jsonschema.yaml compared with itself ($refs, nullable) | 0 / 0 KB | 0 |
| `js-repo-identical` | jsonschema | identical | test/resources/schema-before.yaml compared with itself | 2 / 2 KB | 0 |
| `js-allof-200` | jsonschema | synthetic | 200 definitions of allOf [$ref Base, $ref Mixin, own props], root refs all; Base.createdAt type and Mixin0 maxLength change | 41 / 41 KB | — |
| `js-wide-4000` | jsonschema | synthetic | plain schema with 4 000 properties, every 20th type string -> integer | 101 / 101 KB | — |

## 4. Correctness and classification quality

Columns: diffs reported; detected / expected changes (recall); precision; class agreement and breaking agreement over the detected changes; risky; end-to-end (detected and on the right side of the breaking line, over all expected); share of diffs with a description. The per-change matrices show each tool's verdict (B breaking, R risky, N non-breaking, D deprecated, A annotation, U unclassified; ✓ = expected class or accepted alternative, ~ = right side of the breaking line but another class, **✗** = wrong side or unclassified, **miss** = not detected, `– (ok)` = optional change with no diff).

### 4.1 Totals over the curated OpenAPI and JSON Schema change sets

Headline timings: min ms of the in-process call; Go CLIs: process median minus the no-op invocation; `†` = that cell's correctness check failed.

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

### 4.2 OpenAPI

| Fixture | Tool | Diffs | Detected (recall) | Precision | Class agreement | Breaking agreement | Risky | End-to-end | Described | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `oas-petstore` | asd 1.0.6 | 86 | 21/23 (91%) | 100% | 18/22 | 18/22 | — | 78% | 84% (29 weak) | missed breaking: P7, P10, P13, P15; false breaking: P6, P22 |
| `oas-petstore` | asd 2.0.0 | 87 | 23/23 (100%) | 100% | 24/24 | 24/24 | — | 100% | 100% |  |
| `oas-petstore` | fork 4.0.1 | 49 | 23/23 (100%) | 100% | 21/24 | 21/24 | — | 91% | 100% (25 weak) | missed breaking: P15; false breaking: P6, P22 |
| `oas-petstore` | oasdiff (CLI) | 48 | 20/23 (87%) | 100% | 20/20 | 20/20 | — | 87% | 100% | missed breaking: P13 |
| `oas-petstore` | openapi-changes (CLI) | 30 | 23/23 (100%) | 97% | 20/24 | 20/24 | — | 87% | 0% | missed breaking: P13, P16; false breaking: P6, P22 |
| `oas-petstore` | openapi-diff | 21 | 13/23 (57%) | 100% | 10/13 | 10/13 | — | 43% | 0% | missed breaking: P8, P10, P11, P13, P16, P19, P20; false breaking: P5, P6 |
| `oas31-petstore` | asd 1.0.6 | 86 | 21/23 (91%) | 100% | 18/22 | 18/22 | — | 78% | 84% (29 weak) | missed breaking: P7, P10, P13, P15; false breaking: P6, P22 |
| `oas31-petstore` | asd 2.0.0 | 87 | 23/23 (100%) | 100% | 24/24 | 24/24 | — | 100% | 100% |  |
| `oas31-petstore` | fork 4.0.1 | 49 | 23/23 (100%) | 100% | 21/24 | 21/24 | — | 91% | 100% (25 weak) | missed breaking: P15; false breaking: P6, P22 |
| `oas31-petstore` | oasdiff (CLI) | 48 | 20/23 (87%) | 100% | 20/20 | 20/20 | — | 87% | 100% | missed breaking: P13 |
| `oas31-petstore` | openapi-changes (CLI) | 30 | 23/23 (100%) | 97% | 20/24 | 20/24 | — | 87% | 0% | missed breaking: P13, P16; false breaking: P6, P22 |
| `oas31-petstore` | openapi-diff | n/a |  |  |  |  |  |  |  | OpenAPI 3.0 / Swagger 2 only (Swagger Parser rejects 3.1 / 3.2) |
| `oas32-petstore` | asd 1.0.6 | 86 | 21/23 (91%) | 100% | 18/22 | 18/22 | — | 78% | 84% (29 weak) | missed breaking: P7, P10, P13, P15; false breaking: P6, P22 |
| `oas32-petstore` | asd 2.0.0 | 87 | 23/23 (100%) | 100% | 24/24 | 24/24 | — | 100% | 100% |  |
| `oas32-petstore` | fork 4.0.1 | error |  |  |  |  |  |  |  | OpenApi version 3.2.0 is not supported. |
| `oas32-petstore` | oasdiff (CLI) | 48 | 20/23 (87%) | 100% | 20/20 | 20/20 | — | 87% | 100% | missed breaking: P13 |
| `oas32-petstore` | openapi-changes (CLI) | 30 | 23/23 (100%) | 97% | 20/24 | 20/24 | — | 87% | 0% | missed breaking: P13, P16; false breaking: P6, P22 |
| `oas32-petstore` | openapi-diff | n/a |  |  |  |  |  |  |  | OpenAPI 3.0 / Swagger 2 only (Swagger Parser rejects 3.1 / 3.2) |
| `oas-github` | asd 1.0.6 | 74 | 21/21 (100%) | 92% | 20/21 | 20/21 | — | 95% | 84% (30 weak) | false breaking: G15 |
| `oas-github` | asd 2.0.0 | 68 | 21/21 (100%) | 100% | 21/21 | 21/21 | — | 100% | 100% |  |
| `oas-github` | fork 4.0.1 | 33 | 21/21 (100%) | 100% | 20/21 | 20/21 | — | 95% | 100% (16 weak) | false breaking: G15 |
| `oas-github` | oasdiff (CLI) | 41 | 20/21 (95%) | 100% | 20/20 | 20/20 | 0/0 (1 risky) | 95% | 100% |  |
| `oas-github` | openapi-changes (CLI) | timeout |  |  |  |  |  |  |  | spawnSync bin/openapi-changes ETIMEDOUT |
| `oas-github` | openapi-diff | timeout |  |  |  |  |  |  |  |  |

Per-change verdicts, `oas-petstore` (the 3.1 and 3.2 copies give the same verdicts for every tool that accepts them):

| Id | Change | Expected | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | oasdiff (CLI) | openapi-changes (CLI) | openapi-diff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | DELETE /store/order/{orderId} removed | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| P2 | GET /store/benchReport added | N | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ |
| P3 | Pet (request+response) gains required property benchTag | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| P4 | ApiResponse (response-only) resultCode integer -> string | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| P5 | ApiResponse (response-only) gains optional property traceId | N | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ | **B ✗** |
| P6 | ApiResponse (response-only) gains required property requestStamp | N | **B ✗** | N ✓ | **B ✗** | N ✓ | **B ✗** | **B ✗** |
| P7 | PUT /pet 5XX response errorCode integer -> string | B | **miss** | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |
| P8 | GET /user/login new required query parameter benchOtp | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | **miss** |
| P9 | GET /pet/findByStatus new optional query parameter benchLimit | N | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ | **miss** |
| P10 | GET /user/login query parameter loginName string -> integer | B | **N ✗** | B ✓ | B ✓ | B ✓ | B ✓ | **miss** |
| P11 | GET /pet/findByStatus status enum value 'sold' removed | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | **miss** |
| P12 | GET /store/inventory region enum value 'apac' added | N | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ | **miss** |
| P13 | GET /pet/findByTags tags explode true -> false | B | **miss** | B ✓ | B ✓ | **miss** | **N ✗** | **miss** |
| P14 | /user/{username} -> /user/{handle} (path template parameter renamed) | A (N) | N ✓ | N ✓ | A ✓ | – (ok) | N ✓ | N ✓ |
| P15 | DELETE /pet/{petId} gains a required request body | B | **N ✗** | B ✓ | **N ✗** | B ✓ | B ✓ | B ✓ |
| P16 | POST /store/order requires petstore_auth instead of the global api_key | B | B ✓ | B ✓ | B ✓ | B ✓ | **N ✗** | **miss** |
| P17 | PUT /pet summary changed | A | A ✓ | A ✓ | A ✓ | **miss** | N ✓ | **miss** |
| P18 | GET /user/login deprecated | D (N/A) | D ✓ | D ✓ | D ✓ | D ✓ | N ✓ | **miss** |
| P19 | User (request+response) phone maxLength 64 -> 32 | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | **N ✗** |
| P20 | GET /user/login 200 response media type application/xml removed | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | **miss** |
| P21 | GET /store/inventory 429 response added | N | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ |
| P22 | GET /user/login response header X-Rate-Limit -> x-rate-limit (case only) | A (N) | **B ✗** | A ✓ | **B ✗** | – (ok) | **B ✗** | – (ok) |
| P23 | Order (request+response) gains optional property giftNote | N | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ | N ✓ |
| P24 | Pet (request+response) required property photoUrls removed | B | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ | B ✓ |

Per-change verdicts, `oas-github` (GitHub REST API description, scripted change set):

| Id | Change | Expected | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | oasdiff (CLI) | openapi-changes (CLI) | openapi-diff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | DELETE /agents/repos/{owner}/{repo}/automations/{automation_id} removed | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G2 | path / removed | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G3 | GET /bench/new-endpoint added | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |
| G4 | PUT /advisories added | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |
| G5 | GET /agents/repos/{owner}/{repo}/automations/{automation_id}/revisions optional query parameter cursor renamed | B (R) | B ✓ | B ✓ | B ✓ | R ✓ | timeout | timeout |
| G6 | GET /agents/repos/{owner}/{repo}/automations/{automation_id}/tasks query parameter state becomes required | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G7 | GET /advisories/{ghsa_id} new required query parameter | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G8 | GET /agents/automations new optional query parameter | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |
| G9 | POST /agents/repos/{owner}/{repo}/automations request body gains required property | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G10 | POST /agents/repos/{owner}/{repo}/tasks request body gains optional property | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |
| G11 | POST /applications/{client_id}/token/scoped request body property access_token string -> integer | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G12 | response-only component actions-hosted-runner (6 usages) property last_active_on string -> integer | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G13 | response-only component actions-hosted-runner gains optional property | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |
| G14 | response-only component actions-hosted-runner required property image_details removed | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G15 | response-only component actions-hosted-runner gains required property | N | **B ✗** | N ✓ | **B ✗** | N ✓ | timeout | timeout |
| G16 | GET /agents/repos/{owner}/{repo}/automations/available-tools 418 response added | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |
| G17 | GET /agents/repos/{owner}/{repo}/automations/available-triggers summary changed | A | A ✓ | A ✓ | A ✓ | **miss** | timeout | timeout |
| G18 | GET /agents/repos/{owner}/{repo}/automations/{automation_id}/revisions/{revision_id} deprecated | D (N/A) | D ✓ | D ✓ | D ✓ | D ✓ | timeout | timeout |
| G19 | GET /issues query parameter filter enum value all removed | B | B ✓ | B ✓ | B ✓ | B ✓ | timeout | timeout |
| G20 | GET /agents/tasks query parameter sort enum value added | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |
| G21 | GET /agents/repos/{owner}/{repo}/pulls/{pull_number}/agent-merge 200 response header added | N | N ✓ | N ✓ | N ✓ | N ✓ | timeout | timeout |

### 4.3 JSON Schema

| Fixture | Tool | Diffs | Detected (recall) | Precision | Class agreement | Breaking agreement | Risky | End-to-end | Described | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `js-repo-pair` | asd 1.0.6 | 24 | 20/20 (100%) | 100% | 19/20 | 19/20 | 0/1 | 95% | 100% (2 weak) | missed breaking: J18 |
| `js-repo-pair` | asd 2.0.0 | 23 | 20/20 (100%) | 100% | 20/20 | 20/20 | 1/1 (1 risky) | 100% | 100% |  |
| `js-repo-pair` | fork 4.0.1 | 24 | 17/20 (85%) | 96% | 17/17 | 17/17 | 0/1 | 85% | 100% (18 weak) | missed breaking: J15, J16 |
| `js-repo-pair` | json-schema-diff | 2 | doc-level | — | verdict breaking (expected breaking) | 1/1 | — | — | — | document-level verdict only |

| Id | Change | Expected | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 |
| --- | --- | --- | --- | --- | --- |
| J1 | name.examples item 'Example name' removed | A | A ✓ | A ✓ | A ✓ |
| J2 | age.type number -> string | B | B ✓ | B ✓ | B ✓ |
| J3 | age.minimum 10 -> 20 (inert: age became a string) | A (N/U/B) | U ✓ | A ✓ | N ✓ |
| J4 | age.maximum 40 -> 30 (inert: age became a string) | A (N/U/B) | U ✓ | A ✓ | N ✓ |
| J5 | age.x-param removed | A (U/N) | U ✓ | A ✓ | **miss** |
| J6 | age.enum value 50 added (30/20 reordered) | N | N ✓ | N ✓ | N ✓ |
| J7 | age.readOnly true -> false | N (A) | N ✓ | N ✓ | N ✓ |
| J8 | completed_at.format date-time -> uuid | B | B ✓ | B ✓ | B ✓ |
| J9 | completed_at.pattern changed (stricter) | B | B ✓ | B ✓ | B ✓ |
| J10 | completed_at.description changed | A | A ✓ | A ✓ | A ✓ |
| J11 | items.description changed | A | A ✓ | A ✓ | A ✓ |
| J12 | email.deprecated true -> false | D (A/N) | D ✓ | D ✓ | D ✓ |
| J13 | email.default changed | A (N/R/B) | B ✓ | B ✓ | B ✓ |
| J14 | plan.anyOf branch {type: number} removed (branches reordered) | B | B ✓ | B ✓ | B ✓ |
| J15 | plan.anyOf object bar string -> number | B | B ✓ | B ✓ | **miss** |
| J16 | plan.anyOf object baz string -> boolean | B | B ✓ | B ✓ | **miss** |
| J17 | plan.anyOf array branch description added | A | A ✓ | A ✓ | A ✓ |
| J18 | permissions.properties ids -> ids12 (also seen through $ref by `ref`); an optional property removed is risky | R (B) | **N ✗** | R ✓ | B ✓ |
| J19 | patternProperties._name$ string -> number | B | B ✓ | B ✓ | B ✓ |
| J20 | required: completed_at removed | N | N ✓ | N ✓ | N ✓ |

### 4.4 Identical documents (every tool must report 0 changes)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | oasdiff (CLI) | openapi-changes (CLI) | openapi-diff | json-schema-diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `oas-petstore-identical` | 0 | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 | 0 | 0 |
| `oas-override-identical` | **3** | 0 | 0 | 0 | 0 | 0 | n/a | 0 | 0 | 0 | 0 |
| `oas-github-identical` | **6** | 0 | 0 | 0 | 0 | timeout | n/a | 0 | 0 | 0 | 0 |
| `js-identical` | 0 | 0 | 0 | n/a | n/a | n/a | error | 0 | 0 | 0 | 0 |
| `js-repo-identical` | 0 | 0 | 0 | n/a | n/a | n/a | 0 | 0 | 0 | 0 | 0 |

### 4.5 Input mutation and merged document

| Tool | Fixtures run | Mutated an input | Merged / annotated document |
| --- | --- | --- | --- |
| asd 1.0.6 | 10 | 6: oas-petstore, oas31-petstore, oas32-petstore, oas-override-identical, oas-github, oas-github-identical | yes |
| asd 2.0.0 | 10 | none | yes |
| fork 4.0.1 | 9 | none | yes |
| openapi-diff | 3 | none | no |
| json-schema-diff | 2 | 2: js-repo-pair, js-repo-identical | no |
| microdiff | 10 | none | no |
| jsondiffpatch | 10 | none | no |
| deep-diff | 10 | none | no |
| fast-json-patch | 10 | none | no |

### 4.6 Harvested compatibility corpus

The OpenAPI and cross-cutting cases of the repository's compatibility corpus and its JSON Schema cases placed in a request body, a response, a query parameter, a response header or a plain JSON Schema document, scored per variant as described in the [overview](README.md) §3. Not applicable cells: openapi-diff accepts OpenAPI 3.0 only, json-schema-diff plain JSON Schema documents only, oasdiff and openapi-changes OpenAPI documents only.

1994 variants of 1090 cases, exported 2026-11-21; run 2026-11-21. **Partial run** (tools asd-2.0.0).

| Tool | Variants run | Errors / timeouts | Detected | Classified | Breaking agreement | Risky | Described | All three | Strict D / C / A / all (asd) | Variants where it beats asd 2.0.0 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| asd 2.0.0 | 1994 | 0 | 1994/1994 (100%) | 1944/1944 (100%) | 1944/1944 (100%) | 50/50 (52 risky) | 1845/1845 (100%) | 1994/1994 (100%) | 100% / 100% / 100% / **100%** | — |

Per compat family:

| Family | Variants | asd 1.0.6 strict all | asd 2.0.0 strict D / C / A / all | asd 2.0.0 classified |
| --- | --- | --- | --- | --- |
| core | 10 | — | 100% / 100% / 100% / **100%** | 100% |
| jsonschema | 1155 | — | 100% / 100% / 100% / **100%** | 100% |
| openapi | 829 | — | 100% / 100% / 100% / **100%** | 100% |

Variants where another tool does better than asd 2.0.0 (case level, with the dimensions it is better on):

No variant where another tool beats asd 2.0.0.

## 5. Performance

Cells are `median / min` in ms (s where marked) of the timed calls; `n/a` = the tool does not accept that kind of document; `error` = the tool threw; `timeout` = the first call did not finish within 60 s; `†` = the correctness check of that cell failed. Times include the tool's whole processing of the parsed input, including building the merged document where the tool produces one.

### 5.1 OpenAPI (median / min ms)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | openapi-diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `oas-petstore` | 29.0 / 23.6 † | 3.08 / 2.80 | 145 / 134 | 510 / 483 † | 0.33 / 0.25 | 0.93 / 0.84 | 0.30 / 0.27 | 0.24 / 0.21 |
| `oas-petstore-identical` | 24.0 / 21.6 | 0.33 / 0.32 | 133 / 130 | 518 / 499 | 0.22 / 0.17 | 0.95 / 0.84 | 0.34 / 0.27 | 0.19 / 0.14 |
| `oas31-petstore` | 27.6 / 24.9 † | 3.09 / 2.87 | 140 / 132 | n/a | 0.30 / 0.25 | 0.89 / 0.79 | 0.35 / 0.29 | 0.22 / 0.20 |
| `oas32-petstore` | 27.0 / 24.2 † | 3.05 / 2.98 | error | n/a | 0.31 / 0.24 | 0.86 / 0.64 | 0.32 / 0.28 | 0.23 / 0.21 |
| `oas-override-identical` | 1.79 / 1.62 † | 0.06 / 0.05 | 12.1 / 11.6 | 46.2 / 44.3 | 0.02 / 0.02 | 0.17 / 0.12 | 0.07 / 0.05 | 0.04 / 0.02 |
| `oas-wide-1000` | 54.6 / 48.3 | 2.27 / 2.22 | 474 / 457 | timeout | 0.80 / 0.71 | 2.17 / 2.01 | 1.19 / 1.16 | 0.51 / 0.47 |
| `oas-wide-4000` | 1.31 s / 1.29 s | 6.71 / 6.41 | 1.76 s / 1.73 s | timeout | 1.58 / 1.53 | 6.73 / 5.96 | 10.5 / 10.1 | 1.21 / 1.15 |
| `oas-wide-10000` | 7.82 s / 7.78 s | 19.3 / 18.6 | 4.50 s / 4.38 s | timeout | 4.66 / 4.09 | 15.1 / 13.0 | 61.2 / 56.6 | 3.30 / 3.14 |
| `oas-deep-100` | 27.2 / 26.2 | 0.81 / 0.70 | 89.8 / 87.6 | 33.2 / 31.8 | 0.15 / 0.13 | 0.48 / 0.43 | 0.24 / 0.23 | 0.07 / 0.06 |
| `oas-deep-500` | 501 / 492 | 3.48 / 3.33 | 858 / 833 | 62.8 / 60.4 | 0.75 / 0.73 | 1.94 / 1.81 | 2.83 / 2.64 | 0.23 / 0.22 |
| `oas-refs-500` | 78.1 / 65.5 | 14.7 / 13.5 | 722 / 700 | 7.77 s / 7.71 s | 2.61 / 2.46 | 4.97 / 4.36 | 2.32 / 2.19 | 1.43 / 1.40 |
| `oas-refs-2000` | 707 / 678 | 59.0 / 56.6 | 2.81 s / 2.78 s | 30.64 s / 30.38 s | 7.08 / 6.40 | 14.1 / 12.5 | 12.2 / 11.4 | 5.89 / 5.57 |
| `oas-dir-request-1500` | 220 / 208 | 1.78 / 1.72 | 674 / 648 | timeout | 0.59 / 0.54 | 2.73 / 2.59 | 2.01 / 1.96 | 0.48 / 0.46 |
| `oas-dir-response-1500` | 657 / 636 | 1.84 / 1.77 | 882 / 850 | timeout | 0.59 / 0.55 | 3.22 / 2.83 | 1.99 / 1.95 | 0.54 / 0.47 |
| `oas-oneof-40` | 283 / 277 | 0.79 / 0.75 | 859 / 843 | timeout | 0.97 / 0.92 | 2.96 / 2.74 | 1.17 / 1.08 | 0.45 / 0.41 |
| `oas-github` | 6.97 s / 6.92 s | 145 / 139 | 45.15 s / 44.90 s | timeout | 56.1 / 53.6 | 137 / 135 | 79.2 / 76.9 | 40.1 / 38.1 |
| `oas-github-identical` | 6.85 s / 6.79 s † | 84.8 / 82.2 | 45.88 s / 45.29 s | timeout | 48.9 / 47.3 | 135 / 130 | 80.2 / 75.7 | 39.8 / 37.9 |

### 5.2 OpenAPI, Go CLIs (process wall time median / min ms)

| Fixture | write both inputs (ms) | oasdiff 1.38.0 changelog | openapi-changes 0.4.3 report |
| --- | --- | --- | --- |
| `oas-petstore` | 0.71 | 33.6 / 33.3 (−no-op 12.8; 19.4 MB RSS) † | 72.0 / 69.1 (−no-op 25.4; 35.9 MB RSS) |
| `oas-petstore-identical` | 0.44 | 30.5 / 29.7 (−no-op 9.68; 18.5 MB RSS) | 53.2 / 51.2 (−no-op 6.64; 32.8 MB RSS) |
| `oas31-petstore` | 0.49 | 32.4 / 31.4 (−no-op 11.6; 19.6 MB RSS) † | 69.6 / 67.8 (−no-op 23.1; 35.8 MB RSS) |
| `oas32-petstore` | 0.42 | 32.2 / 31.6 (−no-op 11.4; 19.6 MB RSS) † | 70.5 / 68.6 (−no-op 23.9; 35.8 MB RSS) |
| `oas-override-identical` | 0.21 | 21.2 / 20.7 (−no-op 0.39; 15.1 MB RSS) | 46.5 / 45.5 (−no-op 0.00; 27.7 MB RSS) |
| `oas-wide-1000` | 0.64 | 60.8 / 58.3 (−no-op 40.0; 25.2 MB RSS) | 114 / 113 (−no-op 67.8; 49.9 MB RSS) |
| `oas-wide-4000` | 2.36 | 246 / 241 (−no-op 226; 54.2 MB RSS) | 460 / 450 (−no-op 413; 115.3 MB RSS) |
| `oas-wide-10000` | 4.97 | 1.05 s / 1.02 s (−no-op 1.03 s; 111.0 MB RSS) | 1.94 s / 1.93 s (−no-op 1.89 s; 249.2 MB RSS) |
| `oas-deep-100` | 0.42 | 29.6 / 29.2 (−no-op 8.83; 19.2 MB RSS) | 59.9 / 59.2 (−no-op 13.3; 33.4 MB RSS) |
| `oas-deep-500` | 0.99 | 69.8 / 69.0 (−no-op 49.0; 27.9 MB RSS) | 158 / 154 (−no-op 112; 69.4 MB RSS) |
| `oas-refs-500` | 1.14 | 102 / 99.8 (−no-op 80.8; 35.8 MB RSS) | 332 / 323 (−no-op 285; 66.0 MB RSS) |
| `oas-refs-2000` | 3.78 | 344 / 337 (−no-op 323; 90.2 MB RSS) | 3.16 s / 3.13 s (−no-op 3.11 s; 168.9 MB RSS) |
| `oas-dir-request-1500` | 0.96 | 79.7 / 76.3 (−no-op 58.9; 28.9 MB RSS) | 150 / 148 (−no-op 103; 58.3 MB RSS) |
| `oas-dir-response-1500` | 1.06 | 80.8 / 77.5 (−no-op 60.0; 29.1 MB RSS) | 152 / 147 (−no-op 105; 58.4 MB RSS) |
| `oas-oneof-40` | 0.94 | 97.2 / 95.3 (−no-op 76.4; 35.9 MB RSS) | 177 / 174 (−no-op 131; 62.2 MB RSS) † |
| `oas-github` | 93.2 | 3.50 s / 3.48 s (−no-op 3.48 s; 1198.1 MB RSS) † | timeout |
| `oas-github-identical` | 68.2 | 3.51 s / 3.44 s (−no-op 3.49 s; 1117.3 MB RSS) | 2.21 s / 2.17 s (−no-op 2.16 s; 1538.3 MB RSS) |

No-op invocation (minimal document compared with itself): oasdiff 19.3 / 19.1 ms, 14.6 MB RSS; openapi-changes 45.4 / 43.2 ms, 26.5 MB RSS.

### 5.3 JSON Schema (median / min ms)

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | json-schema-diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `js-repo-pair` | 3.74 / 3.55 | 1.12 / 1.06 | 27.1 / 25.6 † | 15.5 / 13.9 | 0.05 / 0.05 | 0.28 / 0.26 | 0.10 / 0.09 | 0.04 / 0.03 |
| `js-identical` | 1.06 / 0.91 | 0.08 / 0.06 | 9.77 / 9.23 | error | 0.03 / 0.02 | 0.14 / 0.06 | 0.06 / 0.03 | 0.02 / 0.01 |
| `js-repo-identical` | 2.12 / 1.86 | 0.07 / 0.06 | 25.0 / 24.1 | 16.7 / 14.7 | 0.03 / 0.03 | 0.22 / 0.19 | 0.06 / 0.06 | 0.02 / 0.02 |
| `js-allof-200` | 112 / 108 | 32.7 / 29.1 | 757 / 731 | timeout | 0.98 / 0.96 | 2.82 / 2.57 | 0.92 / 0.88 | 0.43 / 0.40 |
| `js-wide-4000` | 1.27 s / 1.25 s | 6.12 / 5.82 | 2.02 s / 2.00 s | timeout | 1.51 / 1.47 | 7.08 / 6.48 | 10.0 / 9.66 | 1.20 / 1.16 |

### 5.4 Scaling

| Series (min ms) | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | openapi-diff | microdiff | jsondiffpatch |
| --- | --- | --- | --- | --- | --- | --- |
| wide 1 000 → 4 000 (4× input) | 48.3 → 1.29 s (26.78×) | 2.22 → 6.41 (2.88×) | 457 → 1.73 s (3.78×) | — → — (—) | 0.71 → 1.53 (2.17×) | 2.01 → 5.96 (2.97×) |
| wide 4 000 → 10 000 (2.5× input) | 1.29 s → 7.78 s (6.01×) | 6.41 → 18.6 (2.91×) | 1.73 s → 4.38 s (2.54×) | — → — (—) | 1.53 → 4.09 (2.67×) | 5.96 → 13.0 (2.18×) |
| deep 100 → 500 (5× input) | 26.2 → 492 (18.76×) | 0.70 → 3.33 (4.77×) | 87.6 → 833 (9.51×) | 31.8 → 60.4 (1.90×) | 0.13 → 0.73 (5.44×) | 0.43 → 1.81 (4.19×) |
| 500 → 2 000 usages of one $ref (4× input) | 65.5 → 678 (10.36×) | 13.5 → 56.6 (4.19×) | 700 → 2.78 s (3.97×) | 7.71 s → 30.38 s (3.94×) | 2.46 → 6.40 (2.60×) | 4.36 → 12.5 (2.86×) |
| 1 500 properties: request → response | 208 → 636 (3.06×) | 1.72 → 1.77 (1.03×) | 648 → 850 (1.31×) | — → — (—) | 0.54 → 0.55 (1.01×) | 2.59 → 2.83 (1.09×) |

Go CLIs (median minus the no-op invocation):

| Series (median − no-op, ms) | oasdiff | openapi-changes |
| --- | --- | --- |
| wide 1 000 → 4 000 (4× input) | 40.0 → 226 (5.64×) | 67.8 → 413 (6.10×) |
| wide 4 000 → 10 000 (2.5× input) | 226 → 1.03 s (4.57×) | 413 → 1.89 s (4.58×) |
| deep 100 → 500 (5× input) | 8.83 → 49.0 (5.55×) | 13.3 → 112 (8.40×) |
| 500 → 2 000 usages of one $ref (4× input) | 80.8 → 323 (4.00×) | 285 → 3.11 s (10.90×) |
| 1 500 properties: request → response | 58.9 → 60.0 (1.02×) | 103 → 105 (1.02×) |

### 5.5 Merged-document and option cost (median / min ms)

| Fixture | asd 2.0.0 | asd 2.0.0 merged:normalized | fork 4.0.1 | fork 4.0.1 normalizedResult | fork 4.0.1 plain options |
| --- | --- | --- | --- | --- | --- |
| `oas-petstore` | 3.08 / 2.80 | 3.96 / 3.23 | 145 / 134 | 121 / 115 | 79.7 / 77.8 |
| `oas-refs-2000` | 59.0 / 56.6 | 51.5 / 46.7 | 2.81 s / 2.78 s | 2.51 s / 2.49 s | 1.52 s / 1.49 s |
| `oas-wide-10000` | 19.3 / 18.6 | 31.4 / 29.3 | 4.50 s / 4.38 s | 4.04 s / 3.88 s | 1.86 s / 1.82 s |
| `oas-github` | 145 / 139 | 572 / 542 | 45.15 s / 44.90 s | 40.60 s / 40.32 s | 25.43 s / 25.18 s |
| `oas-github-identical` | 84.8 / 82.2 | 511 / 492 | 45.88 s / 45.29 s | 40.68 s / 40.52 s | 25.80 s / 25.51 s |

### 5.6 Heap (peak / added by the call / retained MB, one call in a fresh process)

OpenAPI:

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | openapi-diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `oas-petstore` | 16.1 / 8.3 / 0.2 | 11.7 / 1.9 / 0.4 | 47.0 / 35.0 / 0.4 | 53.7 / 34.3 / 0.1 | 7.2 / 0.2 / 0.2 | 7.6 / 0.3 / 0.1 | 7.4 / 0.4 / 0.1 | 7.2 / 0.2 / 0.1 |
| `oas-petstore-identical` | 16.0 / 8.3 / 0.1 | 9.2 / 0.4 / 0.2 | 46.5 / 34.7 / 0.3 | 53.4 / 34.1 / 0.0 | 7.2 / 0.2 / 0.2 | 7.6 / 0.4 / 0.0 | 7.4 / 0.5 / 0.0 | 7.2 / 0.2 / 0.0 |
| `oas31-petstore` | 16.2 / 8.4 / 0.2 | 11.7 / 1.9 / 0.2 | 46.6 / 34.6 / 0.3 | error | 7.2 / 0.2 / 0.1 | 7.6 / 0.3 / 0.1 | 7.4 / 0.4 / 0.1 | 7.2 / 0.2 / 0.1 |
| `oas32-petstore` | 16.2 / 8.4 / 0.2 | 11.7 / 1.9 / 0.2 | error | error | 7.2 / 0.2 / 0.1 | 7.6 / 0.3 / 0.1 | 7.4 / 0.4 / 0.4 | 7.2 / 0.2 / 0.4 |
| `oas-override-identical` | 9.0 / 1.7 / 0.0 | 8.5 / 0.0 / 0.0 | 19.5 / 8.2 / 0.1 | 27.0 / 8.5 / -0.0 | 6.7 / 0.0 / 0.0 | 6.9 / 0.0 / 0.0 | 6.6 / 0.0 / 0.4 | 6.7 / 0.0 / 0.0 |
| `oas-wide-1000` | 16.4 / 8.7 / 0.2 | 11.6 / 2.2 / 0.3 | 65.5 / 53.6 / 0.6 | timeout | 7.3 / 0.2 / 0.0 | 7.9 / 0.5 / 0.1 | 8.2 / 1.1 / 0.4 | 7.3 / 0.2 / 0.2 |
| `oas-wide-4000` | 28.6 / 19.6 / 0.6 | 14.7 / 3.7 / 0.6 | 122.4 / 109.2 / 2.3 | timeout | 9.1 / 0.8 / 0.1 | 10.5 / 1.9 / 0.1 | 12.8 / 4.5 / 0.1 | 9.2 / 0.8 / 0.1 |
| `oas-wide-10000` | 51.7 / 40.6 / 1.6 | 22.9 / 9.9 / 1.5 | 199.0 / 183.6 / 4.2 | timeout | 11.5 / 1.0 / 0.2 | 15.6 / 4.8 / 0.1 | 21.7 / 11.2 / 0.2 | 12.6 / 2.1 / 0.1 |
| `oas-deep-100` | 15.6 / 8.3 / 0.0 | 10.4 / 1.5 / 0.1 | 44.7 / 33.3 / 0.4 | 27.1 / 8.4 / 0.0 | 6.8 / 0.1 / 0.0 | 7.1 / 0.1 / 0.3 | 7.5 / 0.8 / 0.0 | 6.8 / 0.1 / 0.0 |
| `oas-deep-500` | 79.9 / 72.3 / 0.1 | 23.1 / 13.8 / 0.2 | 200.4 / 188.6 / -0.8 | 51.4 / 32.5 / 0.2 | 7.4 / 0.4 / 0.0 | 7.8 / 0.5 / 0.4 | 22.4 / 15.5 / 0.0 | 7.2 / 0.2 / 0.1 |
| `oas-refs-500` | 43.0 / 32.2 / 1.7 | 35.4 / 22.8 / 1.9 | 105.4 / 90.4 / 2.3 | 75.2 / 55.0 / 0.8 | 13.0 / 2.9 / 0.0 | 14.0 / 3.7 / 0.0 | 15.0 / 5.0 / 0.0 | 13.3 / 3.2 / 0.0 |
| `oas-refs-2000` | 60.6 / 39.6 / 7.0 | 56.8 / 33.9 / 7.3 | 252.5 / 227.3 / 7.6 | 163.7 / 140.8 / 3.3 | 31.7 / 11.5 / 0.0 | 35.1 / 14.6 / 0.1 | 40.0 / 19.8 / 0.0 | 33.1 / 12.9 / 0.0 |
| `oas-dir-request-1500` | 25.4 / 17.4 / 0.2 | 10.7 / 1.2 / 0.5 | 86.4 / 74.3 / 0.8 | timeout | 7.6 / 0.2 / 0.0 | 8.4 / 0.7 / 0.0 | 9.0 / 1.7 / 0.3 | 7.7 / 0.3 / 0.0 |
| `oas-dir-response-1500` | 26.0 / 18.0 / 0.2 | 10.7 / 1.2 / 0.2 | 84.4 / 72.3 / 0.8 | timeout | 7.6 / 0.2 / 0.0 | 8.4 / 0.8 / 0.0 | 9.1 / 1.7 / 0.0 | 7.7 / 0.3 / 0.0 |
| `oas-oneof-40` | 44.8 / 36.7 / 0.3 | 10.9 / 1.3 / 0.4 | 82.2 / 69.9 / 1.0 | timeout | 7.7 / 0.3 / 0.0 | 8.5 / 0.8 / 0.2 | 9.4 / 2.0 / 0.0 | 7.7 / 0.3 / 0.0 |
| `oas-github` | 151.1 / 77.1 / 22.4 | 116.8 / 40.1 / 21.0 | 1703.5 / 1625.2 / 53.3 | timeout | 94.5 / 21.6 / 0.1 | 126.2 / 53.0 / 0.1 | 105.3 / 32.4 / 0.3 | 105.0 / 32.1 / 0.0 |
| `oas-github-identical` | 150.7 / 76.9 / 22.4 | 108.0 / 32.7 / 21.1 | 1352.0 / 1273.9 / 53.2 | timeout | 89.4 / 16.6 / 0.0 | 125.6 / 52.5 / 0.0 | 105.2 / 32.4 / 0.0 | 104.9 / 32.1 / 0.3 |

JSON Schema:

| Fixture | asd 1.0.6 | asd 2.0.0 | fork 4.0.1 | json-schema-diff | microdiff | jsondiffpatch | deep-diff | fast-json-patch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `js-repo-pair` | 9.7 / 2.4 / 0.0 | 10.4 / 1.5 / 0.2 | 19.8 / 8.3 / 0.1 | 18.8 / 6.9 / 0.0 | 6.7 / 0.0 / 0.0 | 7.0 / 0.1 / 0.2 | 6.7 / 0.0 / 0.0 | 6.7 / 0.0 / 0.3 |
| `js-identical` | 7.8 / 0.6 / 0.0 | 8.3 / 0.0 / 0.0 | 15.4 / 4.1 / 0.1 | error | 6.6 / 0.0 / 0.0 | 6.9 / 0.0 / 0.0 | 6.6 / 0.0 / 0.0 | 6.6 / 0.0 / 0.0 |
| `js-repo-identical` | 8.8 / 1.6 / 0.0 | 8.4 / 0.0 / 0.0 | 19.7 / 8.3 / 0.1 | 19.2 / 7.4 / 0.0 | 6.7 / 0.0 / 0.2 | 7.0 / 0.0 / 0.0 | 6.7 / 0.0 / 0.0 | 6.7 / 0.0 / 0.0 |
| `js-allof-200` | 25.3 / 17.3 / 0.6 | 26.7 / 16.3 / 0.8 | 63.9 / 51.6 / 0.5 | timeout | 7.6 / 0.3 / 0.0 | 8.4 / 0.8 / 0.0 | 8.7 / 1.4 / 0.0 | 7.7 / 0.4 / 0.0 |
| `js-wide-4000` | 28.0 / 19.1 / 0.6 | 14.2 / 3.5 / 0.6 | 102.2 / 89.1 / 2.3 | timeout | 9.0 / 0.7 / 0.1 | 10.5 / 1.9 / 0.1 | 11.7 / 3.4 / 0.1 | 9.2 / 0.8 / 0.1 |

### 5.7 Performance targets of api-smart-diff 2.0.0

The targets set for the 2.0.0 engine, evaluated on the fixtures above (the real-world target compares with a `structuredClone` of both documents, `scripts/clone-baseline.js`).

| Scenario | 1.0.6 / 2.0.0 (min ms) | Target | 2.0.0 measured | Status |
| --- | --- | --- | --- | --- |
| 1 000 / 4 000 / 10 000 properties (request) | 48.3 / 2.22; 1.29 s / 6.41; 7.78 s / 18.6 | linear (≤ 2.2× per doubling), 4 000 ≤ 450 ms | 2.88× for 4× input, 2.91× for 2.5×; 4 000 = 6.41 ms | met |
| 1 500-property response vs request | 636 vs 208 / 1.77 vs 1.72 | ≤ 1.2× request | 1.03× | met |
| nesting (proxy: plain properties, 100 / 500 levels; target was 150 allOf levels) | 26.2 / 0.70; 492 / 3.33 | O(n), ≤ 15 ms at 150 levels | 0.70 ms at 100, 3.33 ms at 500 | met |
| 500 usages of one $ref | 65.5 / 13.5 | O(k), ≤ 25 ms | 13.5 ms; 2 000 usages 56.6 ms | met |
| 40 × 40 combinator branches (here: 40 branches of 40 properties each, heavier than the 40 × 1 of test/performance.test.ts) | 277 / 0.75 | ≤ 8 ms | 0.75 ms | met |
| real-world OpenAPI (GitHub REST, 7.6 MB, change set) | 6.92 s / 139 | ≤ 1.5× structuredClone of both documents | 139 = 0.7× the clone (197 ms) | met |
| memory (GitHub change set) | — | merged independent of inputs; heap added by the call (peak minus the heap before the call) ≤ 2.5× input | added 40.1 MB = 1.0× the input heap (39.8 MB); informational: absolute peak 116.8 MB = 2.9×, retained 21.0 MB | met |
