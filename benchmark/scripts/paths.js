"use strict"
// Central place for every path of the benchmark. Everything generated (bundles, binaries, source clones, downloaded
// and generated fixtures, raw results) lives inside benchmark/ and is gitignored; only the rendered reports in
// results/*.md are committed. Environment variables override the defaults:
//   ASD_ROOT       the api-smart-diff checkout whose build is measured (default: the repository root, `..`)
//   BENCH_RESULTS  raw results root (default results/), e.g. for smoke runs that must not touch the committed reports
//   BENCH_DOCS     where the rendered reports go (default results/)
//   BENCH_BUILD    bundles and build/manifest.json (default build/)
//   BUF            the buf binary (default bin/buf, fetched by `npm run fetch`)
//   FORK_SRC, UNIFIER_SRC, FORK_JSON_CRAWL_SRC, FORK_GRAPHAPI_SRC   source trees of the Netcracker fork (default
//                  sources/<repo>, cloned at pinned commits by `npm run fetch`)
const path = require("node:path")

const BENCH = path.resolve(__dirname, "..")
const ROOT = process.env.ASD_ROOT ? path.resolve(process.env.ASD_ROOT) : path.resolve(BENCH, "..")
const SOURCES = path.join(BENCH, "sources")
const BUILD = process.env.BENCH_BUILD ? path.resolve(process.env.BENCH_BUILD) : path.join(BENCH, "build")

module.exports = {
  BENCH,
  BUILD,
  BIN: path.join(BENCH, "bin"),
  // raw results root: results/<type>/ per API type (lib/types.js)
  RESULTS: process.env.BENCH_RESULTS ? path.resolve(process.env.BENCH_RESULTS) : path.join(BENCH, "results"),
  // rendered reports: <DOCS>/README.md (overview) and <DOCS>/{OPENAPI,GRAPHQL,ASYNCAPI,GRPC}.md
  DOCS: process.env.BENCH_DOCS ? path.resolve(process.env.BENCH_DOCS) : path.join(BENCH, "results"),
  TEMPLATES: path.join(BENCH, "templates"),
  FIXTURES: path.join(BENCH, "fixtures"),
  CACHE: path.join(BENCH, "fixtures", "cache"),
  VENDOR: path.join(BENCH, "fixtures", "vendor"),
  SOURCES,
  // api-smart-diff under test: the repository build (`pnpm build` in the root writes dist/); its test/compat case
  // tables are the harvested corpus and its test/resources the repository fixtures
  ASD_ROOT: ROOT,
  ASD_DIST: path.join(ROOT, "dist"),
  ASD_RESOURCES: path.join(ROOT, "test", "resources"),
  // api-smart-diff 1.0.6: the published npm package (npm alias in package.json)
  ASD_106: path.join(BENCH, "node_modules", "api-smart-diff-1.0.6"),
  // buf CLI (the native binary from the GitHub release, not the npm wrapper)
  BUF: process.env.BUF || path.join(BENCH, "bin", "buf"),
  // Netcracker fork sources (git clones at the commits pinned in fixtures/vendor/sources.json)
  FORK: process.env.FORK_SRC || path.join(SOURCES, "qubership-apihub-api-diff"),
  UNIFIER: process.env.UNIFIER_SRC || path.join(SOURCES, "qubership-apihub-api-unifier"),
  FORK_JSON_CRAWL: process.env.FORK_JSON_CRAWL_SRC || path.join(SOURCES, "qubership-apihub-json-crawl"),
  FORK_GRAPHAPI: process.env.FORK_GRAPHAPI_SRC || path.join(SOURCES, "qubership-apihub-graphapi"),
  // downloaded third-party documents (fixtures/vendor/sources.json)
  GITHUB_REST: path.join(BENCH, "fixtures", "vendor", "github-api.json"),
  GITHUB_GRAPHQL: path.join(BENCH, "fixtures", "vendor", "github.graphql"),
}
