"use strict"
// Stub for `@netcracker/qubership-apihub-compatibility-suites` (GitHub Packages only, never installed). The fork's
// test/helper/matchers.ts imports three constants from it; the compatibility-suite tests themselves (which need the
// real fixture package) are not run.
module.exports = {
  TEST_SPEC_TYPE_OPEN_API: "open-api",
  TEST_SPEC_TYPE_ASYNC_API: "async-api",
  TEST_SPEC_TYPE_GRAPH_QL: "graphql",
  TEST_SPEC_TYPE_DDL_API: "ddl-api",
  getCompatibilitySuite: () => {
    throw new Error("compatibility-suites package is not available (stub)")
  },
  getCompatibilitySuiteSpecificationVersionPairs: () => [],
}
