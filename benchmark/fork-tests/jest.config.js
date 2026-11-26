"use strict"
// Runs a selection of the fork's OWN jest tests (read-only clone) against the bundle built into build/fork-4.0.1.
//   node scripts/fork-tests.js        (spawns jest with cwd = the fork clone, because the tests read fixtures relative
//                                       to the working directory)
// - `../src` imports of the test files are redirected to the built bundle, so the tests exercise the build;
//   deep imports (`../src/graphapi`, `../src/types`, ...) resolve to the fork's source files (constants only)
// - @netcracker/* packages are redirected to the fork sources / the stubs (never installed)
// - npm dependencies (jest-extended, fast-equals, graphql, openapi-types, ...) resolve from bench/node_modules
// - test/setup/jest-wrappers.ts is not loaded: it only registers the compatibility-suite helpers
const path = require("node:path")
const P = require("../scripts/paths")

module.exports = {
  rootDir: P.FORK,
  roots: [path.join(P.FORK, "test")],
  testMatch: (process.env.FORK_TESTS || "").split(",").filter(Boolean).map((f) => `**/test/${f}`),
  testEnvironment: "node",
  transform: { "^.+\\.tsx?$": path.join(__dirname, "esbuild-transformer.js") },
  moduleNameMapper: {
    "^(?:\\.\\./)+src$": path.join(P.BUILD, "fork-4.0.1", "index.cjs"),
    "^(?:\\.\\./)+src/(.+)$": path.join(P.FORK, "src", "$1"),
    "^@netcracker/qubership-apihub-api-unifier$": path.join(P.UNIFIER, "src", "index.ts"),
    "^@netcracker/qubership-apihub-json-crawl$": path.join(P.FORK_JSON_CRAWL, "src", "index.ts"),
    "^@netcracker/qubership-apihub-graphapi$": path.join(P.FORK_GRAPHAPI, "src", "index.ts"),
    "^@netcracker/qubership-apihub-ddlapi(?:/parser)?$": path.join(P.BENCH, "stubs", "ddlapi.js"),
    "^@netcracker/qubership-apihub-compatibility-suites$": path.join(P.BENCH, "stubs", "compatibility-suites.js"),
  },
  modulePaths: [path.join(P.BENCH, "node_modules")],
  setupFilesAfterEnv: [require.resolve("jest-extended/all")],
  cacheDirectory: path.join(P.BENCH, "build", ".jest-cache"),
  collectCoverage: false,
  testTimeout: 100000,
  watchman: false,
}
