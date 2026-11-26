"use strict"
// API types of the benchmark: every fixture family belongs to exactly one type, and every runner keeps the results of a
// type in results/<type>/ (raw normalized diffs in results/<type>/raw/<fixture>/<tool>.json). OpenAPI schemas are JSON
// Schema, so the jsonschema family (and json-schema-diff) is part of the OpenAPI benchmark. The type `grpc` (Protocol Buffers APIs as ProtoApi documents) is the family `protoapi`.
//   --type=openapi|graphql|asyncapi|grpc (or --type openapi, comma lists allowed); default: all types
//   --dry-run: every runner lists the cases it would run and the result file it would write, runs nothing, writes nothing
const path = require("node:path")
const P = require("../scripts/paths")

const TYPES = ["openapi", "graphql", "asyncapi", "grpc"]
const FAMILY_TYPE = { openapi: "openapi", jsonschema: "openapi", graphql: "graphql", asyncapi: "asyncapi", protoapi: "grpc" }
const TYPE_FAMILIES = { openapi: ["openapi", "jsonschema"], graphql: ["graphql"], asyncapi: ["asyncapi"], grpc: ["protoapi"] }

const typeOf = (fx) => {
  const t = FAMILY_TYPE[fx.family]
  if (!t) throw new Error(`fixture ${fx.name}: no API type for family ${fx.family}`)
  return t
}

const parseTypes = (argv = process.argv.slice(2)) => {
  let v
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--type=")) v = argv[i].slice(7)
    else if (argv[i] === "--type") v = argv[i + 1]
  }
  if (!v || v === "all") return [...TYPES]
  const out = v.split(",").map((x) => x.trim().toLowerCase())
  for (const t of out) {
    if (TYPES.includes(t)) continue
    console.error(`unknown --type ${t} (expected ${TYPES.join(", ")} or all)`)
    process.exit(2)
  }
  return TYPES.filter((t) => out.includes(t))
}

const isDryRun = (argv = process.argv.slice(2)) => argv.includes("--dry-run")
const dry = (...parts) => console.log(`[dry-run] ${parts.join("  ")}`)

const resultsDir = (type) => path.join(P.RESULTS, type)
const resultFile = (type, file) => path.join(resultsDir(type), file)
const rawDir = (type) => path.join(resultsDir(type), "raw")

module.exports = { TYPES, FAMILY_TYPE, TYPE_FAMILIES, typeOf, parseTypes, isDryRun, dry, resultsDir, resultFile, rawDir }
