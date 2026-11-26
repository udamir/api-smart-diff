"use strict"
// Runs the selected fork test files against build/fork-4.0.1 (see fork-tests/jest.config.js), one jest run per API
// type, and writes the jest JSON report to results/<type>/fork-jest.json. The fork has no AsyncAPI test file in the
// selection, so the AsyncAPI type is skipped.
//   node scripts/fork-tests.js [--type=openapi|graphql|asyncapi|grpc] [--dry-run]
const { spawnSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const TY = require("../lib/types")

const FILES = {
  openapi: [
    "openapi.diff.test.ts",
    "openapi.classification.test.ts",
    "openapi.add-required-fields.test.ts",
    "openapi.default.test.ts",
    "openapi.exclusive-bounds.test.ts",
    "openapi.contentMediaTypeMapping.test.ts",
    "openapi.pathAndMethodMapping.test.ts",
    "oas-30-to-31.test.ts",
    "json-schema.diff.test.ts",
  ],
  graphql: ["graphapi.diff.test.ts"],
  asyncapi: [],
  // the fork has no Protocol Buffers support
  grpc: [],
}

for (const type of TY.parseTypes()) {
  if (!FILES[type].length) {
    console.log(`== ${type}: no fork test files selected, skipped`)
    continue
  }
  const out = TY.resultFile(type, "fork-jest.json")
  if (TY.isDryRun()) {
    TY.dry(type, `jest on ${FILES[type].join(", ")} -> ${path.relative(P.BENCH, out)}`)
    continue
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  console.log(`== ${type}: ${FILES[type].length} test files -> ${path.relative(P.BENCH, out)}`)
  const r = spawnSync(process.execPath, [path.join(P.BENCH, "node_modules", "jest", "bin", "jest.js"), "-c", path.join(P.BENCH, "fork-tests", "jest.config.js"), "--json", "--outputFile", out, "--ci"], {
    cwd: P.FORK,
    env: { ...process.env, FORK_TESTS: FILES[type].join(",") },
    encoding: "utf8",
    maxBuffer: 1 << 28,
  })
  process.stdout.write(`${(r.stderr || "").split("\n").filter((l) => /PASS|FAIL|Tests:|Suites:|●/.test(l)).slice(0, 80).join("\n")}\n`)
  if (fs.existsSync(out)) {
    const j = JSON.parse(fs.readFileSync(out, "utf8"))
    console.log(`suites ${j.numPassedTestSuites}/${j.numTotalTestSuites}, tests passed ${j.numPassedTests}, failed ${j.numFailedTests}, pending ${j.numPendingTests}, total ${j.numTotalTests}`)
  }
}
