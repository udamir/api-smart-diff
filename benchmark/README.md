# api-smart-diff benchmark

A self-contained project that compares api-smart-diff with other API diff tools on identical inputs, for five kinds of documents: OpenAPI 3.0 / 3.1 / 3.2, JSON Schema, AsyncAPI 2.6 / 3.0, GraphQL and Protocol Buffers (gRPC). It measures, with equal weight:

- **quality**: which scripted changes every tool detects, how it classifies them (breaking, risky, non-breaking, deprecated, annotation) against hand-written expected lists, whether every diff has a readable description, whether identical documents give no diff and whether the inputs are left untouched; plus a per-variant score on the repository's harvested compatibility corpus (`test/compat/`);
- **speed**: in-process time per call (fresh process per cell, warm-ups, minimum and median of 7 to 11 timed calls), and process time of the Go CLIs with their start-up cost subtracted;
- **memory**: peak, added and retained heap of one call;
- **bundle size** of the browser builds.

The tools: api-smart-diff (the build of this repository, reported as `asd 2.0.0`), the published api-smart-diff 1.0.6 (`asd 1.0.6`), the Netcracker fork `@netcracker/qubership-apihub-api-diff` 4.0.1 (built from source), [oasdiff](https://github.com/oasdiff/oasdiff) and [openapi-changes](https://github.com/pb33f/openapi-changes) (Go CLIs), [openapi-diff](https://www.npmjs.com/package/openapi-diff), [json-schema-diff](https://www.npmjs.com/package/json-schema-diff), [@asyncapi/diff](https://www.npmjs.com/package/@asyncapi/diff), [@graphql-inspector/core](https://www.npmjs.com/package/@graphql-inspector/core), graphql-js `findBreakingChanges` / `findDangerousChanges`, [buf breaking](https://buf.build/docs/breaking/) and four structural JSON diffs (microdiff, jsondiffpatch, deep-diff, fast-json-patch) as a speed floor.

The reports are in [`results/`](results/): the [overview](results/README.md) (environment, methodology, summaries, feature matrix, bundle sizes) and one report per type: [OpenAPI](results/OPENAPI.md), [GraphQL](results/GRAPHQL.md), [AsyncAPI](results/ASYNCAPI.md), [gRPC / Protocol Buffers](results/GRPC.md), plus the [1.0.6 vs 2.0.0 headline](results/HEADLINE.md), the table of the documentation's Performance section measured against the published 1.0.6 package.

## Requirements

- Node.js 22 or later (the published results were measured with Node.js 26.13) and npm
- pnpm (the version in the root `package.json`), to build the repository and to export the compatibility corpus with the repository's TypeScript runner
- git, curl and tar, on macOS or Linux, x64 or arm64; `/usr/bin/time` for the peak RSS of the Go CLIs
- network access for the first setup (npm registry, github.com, raw.githubusercontent.com), about 450 MB of disk space

This project is independent of the root package: it has its own `package.json` and `package-lock.json`, is not part of the root pnpm workspace, and is excluded from the root lint, format, type check, tests and the published package. Its dependencies never become dependencies of api-smart-diff.

## Run

```sh
# in the repository root: install and build api-smart-diff (writes dist/, which the benchmark measures)
pnpm install && pnpm build

cd benchmark
npm ci               # the competitor libraries, api-smart-diff@1.0.6, gqlapi 0.5.1 / 0.6.0, protoapi, esbuild, jest
npm run setup        # = fetch + build + fixtures, about a minute
npm run quick        # smoke run of every step of every type, a few minutes, written to .work/quick/
```

`npm run setup` runs three steps that can also be run on their own:

| Step | What it does |
| --- | --- |
| `npm run fetch` | downloads the release binaries of oasdiff 1.38.0, openapi-changes 0.4.3 and buf 1.75.0 into `bin/`, the GitHub REST API description and the GitHub GraphQL schema into `fixtures/vendor/`, and clones the Netcracker fork and the three fork packages it needs into `sources/`, all pinned by URL, commit and sha256 in [`fixtures/vendor/sources.json`](fixtures/vendor/sources.json) (`--only bin,docs,sources` selects a part) |
| `npm run build` | bundles every in-process variant into `build/` with esbuild and records versions, commits and sizes in `build/manifest.json`: the repository build (`../dist`, or `ASD_ROOT=<checkout>`), the published 1.0.6 from `node_modules`, the fork from `sources/`, the GraphQL and ProtoApi converters, size-only bundles of the npm peers |
| `npm run fixtures` | generates every fixture deterministically into `fixtures/cache/<name>/` in each input format, with the expected change lists |

Full runs, one per type (each runs quality, the harvested corpus, timing, heap, the CLIs and the baselines of its type), then the reports:

```sh
npm run bench:openapi    # several hours, most of it the slow tools on the GitHub REST description
npm run bench:graphql    # about half an hour
npm run bench:asyncapi   # about 15 minutes
npm run bench:grpc       # about an hour, most of it buf and the 10 200-message fixture
npm run report           # results/README.md and results/{OPENAPI,GRAPHQL,ASYNCAPI,GRPC}.md
npm run headline         # the 1.0.6-vs-2.0.0 table of the documentation, about 5 minutes, .work/headline/HEADLINE.md
                         # (npm run headline -- --publish also writes results/HEADLINE.md)
npm run all              # setup, the four types and the report
```

Every runner takes `--type=openapi|graphql|asyncapi|grpc` and subsets, and partial runs update the existing result files (every cell carries `measuredAt`; `env.date` is set only by a full run):

```sh
node scripts/quality.js --type=openapi --fixtures oas-petstore --tools asd-2.0.0,oasdiff
node scripts/bench.js --type=graphql --fixtures gql-github --adapters asd-2.0.0,graphql-inspector --quick   # --quick = 2 warm-ups
node scripts/heap.js --type=asyncapi --fixtures aa3-wide-2000
node scripts/cli.js --type=openapi --fixtures oas-petstore --tools oasdiff
node scripts/corpus.js --type=graphql --tools asd-2.0.0,graphql-inspector --limit 10                       # --limit = first n variants per family
node scripts/fork-tests.js --type=openapi                                                                  # the fork's own tests against its bundle
node scripts/report.js --only grpc
```

Any runner prints what it would do with `--dry-run`. `BENCH_RESULTS=<dir>` and `BENCH_DOCS=<dir>` redirect the raw results and the rendered reports (the quick mode uses them), `ASD_ROOT=<dir>` measures another api-smart-diff checkout, `BUF=<path>` another buf binary, `BENCH_WARMUP` / `BENCH_WARMUP_BUDGET_MS` override the warm-up count (20) and budget (60 s), and `BENCH_RUN_DATE=<ISO date>` makes the chunks of a full run that is executed in parts count as one run.

The rendered reports can carry a provenance note: `<results>/note.md` is inserted into the overview and `<results>/<type>/note.md` into the type report.

## Layout

Committed: the scripts, the adapters, the fixture generators with their expected change lists, the report templates, the stubs, the pinned source list and the rendered reports. Everything else is installed, downloaded or generated and is gitignored.

| Path | Content | |
| --- | --- | --- |
| `package.json`, `package-lock.json` | the benchmark's own dependencies (competitor libraries, api-smart-diff 1.0.6 as the npm alias `api-smart-diff-1.0.6`, gqlapi 0.5.1 as `gqlapi-0.5.1`, gqlapi 0.6.0, protoapi, esbuild, jest) | committed |
| `adapters.js` | one adapter per in-process variant: input format, per-call input preparation outside the timed region, the timed call, normalization of the tool's diffs to `{ hay, class, description }` | committed |
| `lib/` | the CLI invocations and output normalization (`cli.js`), the worker spawner (`runner.js`), result-file merging (`results.js`), API types (`types.js`), class vocabulary (`vocab.js`), corpus scoring (`corpus-score.js`) | committed |
| `scripts/` | `fetch`, `build`, `fixtures`, `quality`, `corpus` (+ `corpus-worker`, `corpus-export*.ts`), `bench`, `heap`, `cli`, `clone-baseline`, `fork-tests`, `run-case` (the worker), `report` (+ `report-grpc`), `quick`, `headline`, `paths` (every path and its environment override) | committed |
| `fixtures/*.js` | deterministic fixture generators with hand-written expected change lists (classification, accepted alternatives, location tokens) | committed |
| `fixtures/vendor/sources.json` | pinned URLs, commits and sha256 of every download | committed |
| `templates/` | the report templates (`{{placeholder}}` = a generated table) | committed |
| `stubs/` | stand-ins for the two fork dependencies that are not public (`ddlapi`, `compatibility-suites`) | committed |
| `fork-tests/` | jest configuration and esbuild transformer that run the fork's own tests against its bundle | committed |
| `results/*.md` | the rendered reports | committed |
| `node_modules/` | `npm ci` | installed |
| `bin/` | oasdiff, openapi-changes, buf release binaries | fetched |
| `sources/` | the fork and its packages at pinned commits | fetched |
| `fixtures/vendor/*.json`, `*.graphql` | GitHub REST description (14 MB), GitHub GraphQL schema (1.1 MB) | fetched |
| `build/` | bundles and `manifest.json` | generated |
| `fixtures/cache/` | generated fixtures (about 160 MB) and the corpus export | generated |
| `results/<type>/` | raw results (`quality.json`, `bench.json`, `heap.json`, `cli.json`, `corpus.json`, `clone.json`, `fork-jest.json`), normalized diffs in `raw/`, the generated tables in `tables.md` | generated |
| `.work/` | quick and headline runs, scratch | generated |

## Which report is from which run

The committed reports were rendered from the last complete runs on the maintainer's laptop (Intel Core i9-9880H, 16 logical cores, 16 GB, macOS 15, Node.js 26.13), which was not idle during the runs:

| Report | Run | api-smart-diff 1.0.6 | api-smart-diff 2.0.0 |
| --- | --- | --- | --- |
| [OpenAPI](results/OPENAPI.md), [GraphQL](results/GRAPHQL.md), [AsyncAPI](results/ASYNCAPI.md), overview | full run of 2026-11-21 | **built from its source** (commit aaed6b3 with allof-merge 0.6.6 and json-crawl 0.5.3), not the published package | the pre-release build of that day |
| [gRPC / Protocol Buffers](results/GRPC.md) | run of 2026-11-25/26, load average 6 to 42 during the in-process timing | not applicable | the ProtoApi engine as released |
| [Headline](results/HEADLINE.md) | `npm run headline` of 2026-11-26, load average 5 to 8 | the published npm package | the repository build (2.0.0 release) |

Known caveat of the first three reports: their "asd 1.0.6" column is a source build of 1.0.6, which is faster than the published npm package (the GitHub REST change set takes 6.9 s there, 10.2 s with the published package). The harness now measures the published package (`api-smart-diff@1.0.6` from npm), so a new run gives package numbers; the reports say so in their provenance note. Their GraphQL rows of 2.0.0 are the GraphApi 1.0 runs (the run also measured GraphApi 0.1.2 input, which is not shown), and the bundle-size table is computed from the current builds.

The published 1.0.6-vs-2.0.0 numbers come from a re-measure against the published package made before the release, whose raw results were not kept. [HEADLINE.md](results/HEADLINE.md) repeats it with this harness: it reproduces the published 1.0.6 numbers for the GitHub REST description (10.0 s vs 10.2 s published), the petstore (34 ms) and the 1 500-property response (620 ms); the 1 500-property request (110 vs 131 ms) and above all the 10 000-property schema (0.71 s vs 2.7 s published) are faster with the package in this run, and the 2.0.0 numbers are 10 to 30 % lower than the published ones (lighter machine load).

How the published numbers map to the benchmark:

| Published number (documentation Performance section, CHANGELOG) | Fixture / row | Source |
| --- | --- | --- |
| GitHub REST description, 21 changes: 10.2 s (1.0.6) → 0.14 s (2.0.0) | `oas-github`, `asd-1.0.6` / `asd-2.0.0`, min | [HEADLINE.md](results/HEADLINE.md), `npm run headline` |
| GitHub GraphQL schema, 18 changes: not finished after 90 s → 0.15 s (GraphApi 0.1.2) / 0.07 s (GraphApi 1.0) | `gql-github` | [HEADLINE.md](results/HEADLINE.md) (the harness stops 1.0.6 after 60 s and runs 2.0.0 on GraphApi 1.0 input only) |
| petstore 34 ms → 2.6 ms; 10 000 properties 2.7 s → 21 ms; 1 500 properties request / response 131 / 620 ms → 2.7 / 2.7 ms; AsyncAPI 2.6 event API 1.2 → 1.3 ms | `oas-petstore`, `oas-wide-10000`, `oas-dir-request-1500` / `oas-dir-response-1500`, `aa2-events` | [HEADLINE.md](results/HEADLINE.md) |
| Protocol Buffers: 1 700 messages 0.17 s from built documents, 2.1 s end to end, buf 3.6 s; 10 200 messages 1.2 s / 12.5 s, buf 20 to 24 s | `grpc-poc-1700`, `grpc-poc-10200`: `asd-2.0.0-proto`, `asd-2.0.0-proto-e2e`, `buf*` | [GRPC.md](results/GRPC.md) §5 |
| googleapis Compute Engine API, 180 changes: 0.1 s compare, protoapi build under a second per side | — | measured outside this benchmark (not reproducible here) |
| Browser build: 381 kB / 116 kB gzip (1.0.6: 63 kB / 18 kB) | `asd-2.0.0` / `asd-1.0.6` bundle rows | `npm run build` (`build/manifest.json`), overview §6 |

`npm run headline` reproduces the first table of the Performance section with the method of the reports (fresh process per cell, warm-ups, minimum of the timed calls) and records the load average before and after the run; on a loaded machine its numbers are higher, and the published table was measured under load as well.

## What cannot be made fully reproducible

- **Machine load.** The timings are minimums because the published runs shared the machine with other work; a quiet machine gives lower numbers, the ratios between tools are the stable part.
- **The fork** is not installable from npmjs (its `@netcracker/*` dependencies are on GitHub Packages only); it is built from source clones at pinned commits with two stubs (`stubs/`), and its own tests run against that bundle as a check (`npm run fork-tests`).
- **The GitHub GraphQL schema** is downloaded from octokit/graphql-schema at a pinned commit and normalized with graphql 16.12; it differs from the copy used for the committed reports in the order of keys inside a few default values and one duplicated field description (the scripted change set and its expected list are the same).
- **The harvested corpus** is exported from the repository's own `test/compat/` case tables at the time of the run, so it grows with the test suite.
- **Release binaries** are pinned for darwin and linux on x64 and arm64; on another platform the CLI rows are reported as `n/a`.
- **The googleapis row** of the documentation was measured outside this benchmark.
