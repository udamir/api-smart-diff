"use strict"
// The Go CLIs (prebuilt release binaries in bin/, `npm run fetch`; buf from scripts/paths.js BUF): invocation and normalization of
// their JSON output. A tool may name its input `format` (default the JSON documents; buf: the `.proto` source trees),
// the exit codes that mean success (`okStatus`, default 0 and 1) and a working directory (`cwd`).
const { spawnSync } = require("node:child_process")
const path = require("node:path")
const P = require("../scripts/paths")
const { locTokens, hay, prim } = require("../adapters")

const jsonPathSegments = (p) => {
  const segs = []
  const re = /\.([^.[\]]+)|\['((?:[^'\\]|\\.)*)'\]|\[(\d+)\]/g
  let m
  while ((m = re.exec(p || ""))) segs.push(m[1] ?? m[2] ?? m[3])
  return segs
}

// oasdiff levels: 3 ERR -> breaking, 2 WARN -> risky, 1 INFO -> per rule id: deprecations -> deprecated, the rules
// that only touch documentation-like fields (tags, operationId, info.version, x-stability-level) -> annotation,
// everything else (additions, widenings, ...) -> non-breaking
const OASDIFF_ANNOTATION_RULES = new Set(["api-tag-added", "api-tag-removed", "api-operation-id-added", "api-operation-id-removed", "api-version-changed", "api-stability-increased", "request-property-stability-increased", "response-property-stability-increased"])
const oasdiffClass = (c) => {
  if (c.level === 3) return "breaking"
  if (c.level === 2) return "risky"
  const id = String(c.id || "")
  if (/-deprecated(-with-sunset)?$/.test(id)) return "deprecated"
  if (OASDIFF_ANNOTATION_RULES.has(id)) return "annotation"
  return "non-breaking"
}

const cliTools = [
  {
    id: "oasdiff",
    version: "1.38.0",
    bin: path.join(P.BIN, "oasdiff"),
    supports: (fx) => (fx.family === "openapi" ? true : "OpenAPI only"),
    // `changelog` = every check result with its level (INFO / WARN / ERR); `--open` (upload) is never used
    args: (b, a) => ["changelog", b, a, "-f", "json"],
    noop: (b) => ["changelog", b, b, "-f", "json"],
    normalize: (out) =>
      (JSON.parse(out || "[]") || []).map((c) => ({
        hay: hay(c.id, c.text, c.section, c.path ? `@path:${c.path}@` : "", c.operation && c.path ? `@op:${c.operation} ${c.path}@` : ""),
        action: c.id,
        cls: oasdiffClass(c),
        desc: c.text || "",
      })),
  },
  {
    id: "openapi-changes",
    version: "0.4.3",
    bin: path.join(P.BIN, "openapi-changes"),
    supports: (fx) => (fx.family === "openapi" || fx.spec === "aa3" ? true : "OpenAPI 3.x / AsyncAPI 3.x only"),
    args: (b, a) => ["report", "--no-logo", "--reproducible", b, a],
    noop: (b) => ["report", "--no-logo", "--reproducible", b, b],
    normalize: (out) => {
      const r = JSON.parse(out || "{}")
      const changes = []
      const walk = (n) => {
        if (!n || typeof n !== "object") return
        if (Array.isArray(n)) return n.forEach(walk)
        if (typeof n.breaking === "boolean" && "changeText" in n) changes.push(n)
        else for (const k of Object.keys(n)) walk(n[k])
      }
      walk(r.changes || [])
      return changes.map((c) => {
        const segs = jsonPathSegments(c.path)
        if (c.property) segs.push(c.property)
        return {
          hay: hay(locTokens(segs), c.changeText, c.type, prim(c.original), prim(c.new)),
          action: c.changeText,
          cls: c.breaking ? "breaking" : "non-breaking",
          // machine fields only (changeText is "modified" / "property_added" / ...), no human-readable sentence
          desc: "",
        }
      })
    },
  },
]

// buf breaking (buf 1.75.0): one call per category (FILE, PACKAGE, WIRE_JSON, WIRE = the compatibility levels of the
// same name of api-smart-diff) with an inline v2 config; the inputs are the `.proto` trees
// (fixtures/cache/<fx>/{before,after}.proto.d/, which carry the bundled imports buf cannot fetch without the BSR).
// buf reports breaking changes only (a one-tier tool, lib/vocab.js): every finding is `breaking`; exit code 100 =
// findings. It runs in the temporary directory, so that the inline config's module root ("." = the working directory)
// does not contain the input trees (buf refuses an input inside the configured module). In the harvested corpus the
// row `buf` takes each variant's level as its category (scripts/corpus.js).
const BUF_CATEGORIES = { buf: "FILE", "buf-package": "PACKAGE", "buf-wire-json": "WIRE_JSON", "buf-wire": "WIRE" }
const bufArgs = (category, b, a) => ["breaking", a, "--against", b, "--error-format", "json", "--config", JSON.stringify({ version: "v2", breaking: { use: [category] } })]
const bufNormalize = (out) =>
  String(out || "")
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => {
      const f = JSON.parse(line)
      const file = String(f.path || "").replace(/^.*\.proto\.d\//, "")
      return {
        hay: hay(f.type, f.message, file),
        action: f.type,
        cls: "breaking",
        // buf's messages are sentences naming the element ("Field \"2\" on message \"Order\" changed name ...")
        desc: f.message || "",
      }
    })
const bufTools = Object.entries(BUF_CATEGORIES).map(([id, category]) => ({
  id,
  version: "1.75.0",
  bin: P.BUF,
  format: "proto",
  level: category,
  okStatus: [0, 100],
  cwd: require("node:os").tmpdir(),
  supports: (fx) => (fx.family === "protoapi" ? true : "Protocol Buffers only"),
  args: (b, a, fx) => bufArgs(fx?.compareOptions?.compatibility || category, b, a),
  noop: (b) => bufArgs(category, b, b),
  normalize: bufNormalize,
}))
cliTools.push(...bufTools)
// the other CLIs do not read `.proto` trees
for (const t of cliTools) {
  if (t.format === "proto") continue
  const supports = t.supports
  t.supports = (fx) => (fx.family === "protoapi" ? "no Protocol Buffers support" : supports(fx))
}

// a binary that is not fetched (no pinned release asset for this platform) makes its rows n/a
for (const t of cliTools) {
  const supports = t.supports
  t.supports = (fx) => (require("node:fs").existsSync(t.bin) ? supports(fx) : `${t.id} binary not found (${path.relative(P.BENCH, t.bin)}; npm run fetch)`)
}

const runCli = (tool, args, timeoutMs = 60000) => {
  const t0 = process.hrtime.bigint()
  const r = spawnSync(tool.bin, args, { encoding: "utf8", maxBuffer: 1 << 30, timeout: timeoutMs, ...(tool.cwd ? { cwd: tool.cwd } : {}) })
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  return { ms, status: r.status, signal: r.signal, stdout: r.stdout, stderr: (r.stderr || "").slice(-400), error: r.error ? String(r.error.message) : undefined }
}

module.exports = { cliTools, runCli, jsonPathSegments, oasdiffClass, BUF_CATEGORIES }
