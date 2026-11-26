"use strict"
// Renders the markdown tables from results/<type>/*.json and fills the templates in templates/ ({{name}} placeholders):
//   templates/BENCHMARK.template.md -> results/README.md      (overview: environment, shared methodology, summaries)
//   templates/OPENAPI.template.md   -> results/OPENAPI.md     (OpenAPI + JSON Schema)
//   templates/GRAPHQL.template.md   -> results/GRAPHQL.md
//   templates/ASYNCAPI.template.md  -> results/ASYNCAPI.md
//   templates/GRPC.template.md      -> results/GRPC.md        (Protocol Buffers; tables in scripts/report-grpc.js)
// (BENCH_DOCS redirects the reports, BENCH_RESULTS the result files they are rendered from.) It also writes
// results/<type>/tables.md with the tables of each type report. Fixture names are unique across types, so the per-type
// result files are merged into one lookup per kind (quality, bench, heap, cli) for the cell lookups; the per-type files
// are kept for what is per run (environment, CLI no-op baseline). Cells of fixtures this checkout does not define are
// ignored.
//   node scripts/report.js [--only index,openapi,graphql,asyncapi,grpc]
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const FX = require("../fixtures")
const TY = require("../lib/types")
// the tables of this file cover the OpenAPI, GraphQL and AsyncAPI types; the type grpc (Protocol Buffers) has its own
// tables in scripts/report-grpc.js and only its report, GRPC.md
const LEGACY_TYPES = TY.TYPES.filter((t) => t !== "grpc")
const F = { ...FX, all: FX.all.filter((f) => f.family !== "protoapi") }
const KNOWN = new Set(FX.all.map((f) => f.name))
const ofType = (type) => F.all.filter((f) => TY.typeOf(f) === type)

const readT = (type, f, d) => {
  const p = TY.resultFile(type, f)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d
}
const perType = (f, d) => Object.fromEntries(LEGACY_TYPES.map((t) => [t, readT(t, f, d())]))
const R = {
  bench: perType("bench.json", () => ({ cells: {} })),
  heap: perType("heap.json", () => ({ cells: {} })),
  quality: perType("quality.json", () => ({ cells: {} })),
  cli: perType("cli.json", () => ({ noop: {}, write: {}, cells: {} })),
  clone: perType("clone.json", () => ({})),
  forkJest: perType("fork-jest.json", () => null),
}
const known = (cells) => Object.fromEntries(Object.entries(cells || {}).filter(([k]) => KNOWN.has(k.split("|")[0])))
const mergeCells = (byType) => ({ cells: Object.assign({}, ...LEGACY_TYPES.map((t) => known(byType[t].cells))) })
const bench = mergeCells(R.bench)
const heap = mergeCells(R.heap)
const quality = mergeCells(R.quality)
const cli = { ...mergeCells(R.cli), write: Object.assign({}, ...LEGACY_TYPES.map((t) => R.cli[t].write || {})), noop: Object.assign({}, R.cli.asyncapi.noop, R.cli.graphql.noop, R.cli.openapi.noop) }
const clone = Object.assign({}, ...LEGACY_TYPES.map((t) => R.clone[t]))
const manifest = fs.existsSync(path.join(P.BUILD, "manifest.json")) ? JSON.parse(fs.readFileSync(path.join(P.BUILD, "manifest.json"), "utf8")) : { variants: {} }
R.corpus = perType("corpus.json", () => null)

const withGate = (list) => list
const LABEL = {
  "asd-1.0.6": "asd 1.0.6",
  "asd-2.0.0": "asd 2.0.0",
  "asd-2.0.0-normalized": "asd 2.0.0 merged:normalized",
  "fork-4.0.1": "fork 4.0.1",
  "fork-4.0.1-plain": "fork 4.0.1 plain options",
  "fork-4.0.1-normalized": "fork 4.0.1 normalizedResult",
  "openapi-diff": "openapi-diff",
  "json-schema-diff": "json-schema-diff",
  "asyncapi-diff": "@asyncapi/diff",
  "graphql-inspector": "graphql-inspector",
  microdiff: "microdiff",
  jsondiffpatch: "jsondiffpatch",
  "deep-diff": "deep-diff",
  "fast-json-patch": "fast-json-patch",
  oasdiff: "oasdiff (CLI)",
  "openapi-changes": "openapi-changes (CLI)",
  "graphql-js": "graphql-js",
}
const mapValues = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]))
const FAMILY_TOOLS = mapValues(
  {
    openapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "openapi-diff", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"],
    jsonschema: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "json-schema-diff", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"],
    asyncapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "asyncapi-diff", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"],
    graphql: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"],
  },
  withGate,
)
const QUALITY_TOOLS = mapValues(
  {
    openapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "oasdiff", "openapi-changes", "openapi-diff"],
    jsonschema: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "json-schema-diff"],
    asyncapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "asyncapi-diff", "openapi-changes"],
    graphql: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js"],
  },
  withGate,
)
const FLOORS = ["microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"]
// per type: classifying tools (quality), tools of the identical-document and mutation tables, CLIs, headline fixtures
const TYPE_TOOLS = {
  openapi: {
    quality: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "oasdiff", "openapi-changes", "openapi-diff", "json-schema-diff"],
    identical: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "oasdiff", "openapi-changes", "openapi-diff", "json-schema-diff", ...FLOORS],
    mutation: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "openapi-diff", "json-schema-diff", ...FLOORS],
    cli: ["oasdiff", "openapi-changes"],
    key: ["oas-petstore", "oas-github", "js-repo-pair"],
    npm: ["openapi-diff", "json-schema-diff", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"],
  },
  graphql: {
    quality: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js"],
    identical: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js", ...FLOORS],
    mutation: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js", ...FLOORS],
    cli: [],
    key: ["gql-repo-pair", "gql-github"],
    npm: ["graphql-inspector-core", "graphql-js", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"],
  },
  asyncapi: {
    quality: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "asyncapi-diff", "openapi-changes"],
    identical: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "openapi-changes", "asyncapi-diff", ...FLOORS],
    mutation: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "asyncapi-diff", ...FLOORS],
    cli: ["openapi-changes"],
    key: ["aa2-events", "aa3-events"],
    npm: ["asyncapi-diff", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"],
  },
}
for (const t of Object.values(TYPE_TOOLS)) for (const k of ["quality", "identical", "mutation"]) t[k] = withGate(t[k])

const fmtMs = (v) => (v === undefined || v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2))
const fmtMB = (b) => (b === undefined || b === null ? "—" : `${(b / 2 ** 20).toFixed(1)}`)
const pct = (v) => (v === undefined || v === null ? "—" : `${Math.round(v * 100)}%`)
const table = (head, rows) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n")
const meta = (name) => {
  try {
    return F.readMeta(name)
  } catch {
    return {}
  }
}

// a cell whose correctness check failed: identical compare with diffs, or an incomplete result (recall < 100 %)
const dagger = (fx, tool) => {
  const q = quality.cells[`${fx}|${tool}`]
  if (!q || q.status !== "ok") return ""
  if (q.spurious !== undefined && F.get(fx).kind === "identical" && q.diffs > 0) return " †"
  if (q.recall !== undefined && q.recall !== null && q.recall < 1 && !FLOORS.includes(tool)) return " †"
  return ""
}
const statusText = (c) => (c.status === "n/a" ? "n/a" : c.status === "error" ? "error" : c.status === "timeout" || c.status === "timeout-budget" ? "timeout" : c.status)

const timingCell = (fx, tool) => {
  const c = bench.cells[`${fx}|${tool}`]
  if (!c) return "—"
  if (c.status !== "ok") return statusText(c)
  return `${fmtMs(c.medianMs)} / ${fmtMs(c.minMs)}${dagger(fx, tool)}`
}
const T = {}

// ---- environment (index: all types; type reports: that type's run) ----
// an api-smart-diff build: the published package, or a source / repository build with its commit
const asdEnv = (b) => {
  if (!b) return "?"
  const parts = [b.source || b.label || "", b.version && !String(b.source || "").includes(b.version) ? `version ${b.version}` : ""]
  if (b.git?.commit) parts.push(`${b.git.branch || "?"} at ${b.git.commit}${b.git.dirtySrcFiles ? ` with ${b.git.dirtySrcFiles} uncommitted src files` : ""}`)
  if (b.deps) parts.push(Object.entries(b.deps).map(([k, x]) => `${k} ${x}`).join(", "))
  return parts.filter(Boolean).join("; ")
}
const envTable = (types) => {
  const v = manifest.variants
  const envs = types.map((t) => [t, R.bench[t].env]).filter(([, e]) => e)
  // one value when every selected type was measured in the same environment, otherwise one value per type
  const field = (f, dflt = "?") => {
    const vals = envs.map(([t, e]) => [t, f(e)])
    const uniq = [...new Set(vals.map(([, x]) => x))]
    if (uniq.length <= 1) return uniq[0] ?? dflt
    return vals.map(([t, x]) => `${t}: ${x}`).join("; ")
  }
  const cliT = [...new Set(types.flatMap((t) => TYPE_TOOLS[t].cli))]
  const npm = [...new Set(types.flatMap((t) => TYPE_TOOLS[t].npm))]
  const ALL_NPM = ["openapi-diff", "json-schema-diff", "asyncapi-diff", "graphql-inspector-core", "graphql-js", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"]
  const noopOf = (id) => types.map((t) => R.cli[t].noop?.[id]).find(Boolean)
  const rows = [
    ["Date", field((e) => (e.date || "").slice(0, 10), "")],
    ["Node", `${field((e) => e.node, process.version)}, run as \`node --expose-gc --max-old-space-size=8192 --stack-size=4000\``],
    ["CPU / RAM", field((e) => `${e.cpu || "?"}, ${e.cores || "?"} logical cores, ${e.memGB || "?"} GB`, "?, ? logical cores, ? GB")],
    ["OS", field((e) => e.platform || "?")],
    ["Builder", `esbuild ${manifest.esbuild || "?"} (\`scripts/build.js\`)`],
    ["asd 1.0.6", asdEnv(v["asd-1.0.6"])],
    ["asd 2.0.0", asdEnv(v["asd-2.0.0"])],
    ["fork", `${v["fork-4.0.1"]?.version} at ${v["fork-4.0.1"]?.git?.commit} (${v["fork-4.0.1"]?.git?.branch}); ${Object.entries(v["fork-4.0.1"]?.deps || {}).map(([k, x]) => `${k.replace("@netcracker/qubership-apihub-", "")} ${x}`).join(", ")}`],
  ]
  if (types.includes("graphql")) rows.push(["GraphQL converters", `gqlapi ${v["conv-gqlapi-0.5.1"]?.version} (GraphApi 0.1.2, for 1.0.6; graphql ${v["conv-gqlapi-0.5.1"]?.graphql}); gqlapi ${v["conv-gqlapi-0.6.0"]?.version} (GraphApi 1.0, for 2.0.0); fork graphapi ${v["conv-fork-graphapi"]?.version} (graphql ${v["conv-fork-graphapi"]?.graphql})`])
  if (cliT.length === 2) rows.push(["Go CLIs", `oasdiff ${noopOf("oasdiff")?.version || "1.38.0"}, openapi-changes ${noopOf("openapi-changes")?.version || "0.4.3"} (GitHub release binaries)`])
  else if (cliT.includes("openapi-changes")) rows.push(["Go CLI", `openapi-changes ${noopOf("openapi-changes")?.version || "0.4.3"} (GitHub release binary)`])
  rows.push(["npm peers", ALL_NPM.filter((k) => npm.includes(k)).map((k) => `${k} ${v[k]?.version || (k === "graphql-js" ? require("graphql/package.json").version : "?")}`).join(", ")])
  return table(["", ""], rows)
}
T.env = envTable(LEGACY_TYPES)
for (const t of LEGACY_TYPES) T[`env_${t}`] = envTable([t])

// ---- fixtures ----
const fixturesTable = (fxs) =>
  table(
    ["Fixture", "Family", "Kind", "Description", "Size (before / after, JSON)", "Expected changes"],
    fxs.map((f) => {
      const m = meta(f.name)
      const fm = m.formats ? m.formats.json || m.formats.sdl : undefined
      const size = fm ? `${(fm.beforeBytes / 1024).toFixed(0)} / ${(fm.afterBytes / 1024).toFixed(0)} KB${m.formats.sdl ? " SDL" : ""}` : "—"
      return [`\`${f.name}\``, f.family, f.kind, f.desc, size, m.expectedChanges ?? "—"]
    }),
  )
for (const t of LEGACY_TYPES) T[`fixtures_${t}`] = fixturesTable(ofType(t))

// ---- timing per family ----
for (const fam of Object.keys(FAMILY_TOOLS)) {
  const tools = FAMILY_TOOLS[fam].filter((t) => F.all.some((f) => f.family === fam && bench.cells[`${f.name}|${t}`]))
  T[`timing_${fam}`] = table(
    ["Fixture", ...tools.map((t) => LABEL[t])],
    F.all.filter((f) => f.family === fam).map((f) => [`\`${f.name}\``, ...tools.map((t) => timingCell(f.name, t))]),
  )
}
// ---- CLI timing (per type, with that type's own no-op baseline) ----
const CLI_HEAD = { oasdiff: "oasdiff 1.38.0 changelog", "openapi-changes": "openapi-changes 0.4.3 report" }
for (const type of LEGACY_TYPES) {
  const tools = TYPE_TOOLS[type].cli
  if (!tools.length) continue
  const c0 = R.cli[type]
  const fx = ofType(type).filter((f) => Object.keys(c0.cells).some((k) => k.startsWith(`${f.name}|`)))
  const rows = fx.map((f) => {
    const cell = (t) => {
      const c = c0.cells[`${f.name}|${t}`]
      if (!c) return "—"
      if (c.status !== "ok") return statusText(c)
      return `${fmtMs(c.medianMs)} / ${fmtMs(c.minMs)} (−no-op ${fmtMs(c.inProcessEquivMs)}; ${fmtMB(c.peakRssBytes)} MB RSS)${dagger(f.name, t)}`
    }
    const w = c0.write[f.name]
    return [`\`${f.name}\``, w ? `${fmtMs(w.medianMs)}` : "—", ...tools.map(cell)]
  })
  const noop = (t) => (c0.noop[t] ? `${fmtMs(c0.noop[t].medianMs)} / ${fmtMs(c0.noop[t].minMs)} ms, ${fmtMB(c0.noop[t].peakRssBytes)} MB RSS` : "—")
  T[`timing_cli_${type}`] = `${table(["Fixture", "write both inputs (ms)", ...tools.map((t) => CLI_HEAD[t])], rows)}\n\nNo-op invocation (minimal document compared with itself): ${tools.map((t) => `${t} ${noop(t)}`).join("; ")}.`
}

// ---- heap ----
// heap the call adds (the memory target is measured on it) = peak minus heapUsed right before the call (inputs built,
// warm-ups done); the absolute peak stays as an informational number
const addedHeap = (c) => (c?.peakHeapBytes && c?.heapBeforeCallBytes ? Math.max(0, c.peakHeapBytes - c.heapBeforeCallBytes) : undefined)
for (const fam of Object.keys(FAMILY_TOOLS)) {
  const tools = FAMILY_TOOLS[fam].filter((t) => F.all.some((f) => f.family === fam && heap.cells[`${f.name}|${t}`]))
  T[`heap_${fam}`] = table(
    ["Fixture", ...tools.map((t) => LABEL[t])],
    F.all
      .filter((f) => f.family === fam)
      .map((f) => [
        `\`${f.name}\``,
        ...tools.map((t) => {
          const c = heap.cells[`${f.name}|${t}`]
          if (!c) return bench.cells[`${f.name}|${t}`]?.status === "n/a" ? "n/a" : "—"
          if (c.status !== "ok") return statusText(c)
          return `${fmtMB(c.peakHeapBytes)} / ${fmtMB(addedHeap(c))} / ${fmtMB(c.heapRetainedBytes)}`
        }),
      ]),
  )
}

// ---- scaling ----
const ms = (fx, t, k = "medianMs") => bench.cells[`${fx}|${t}`]?.[k]
const ratio = (a, b) => (a && b ? `${(b / a).toFixed(2)}×` : "—")
// withStatus: a cell that did not produce a time shows its status (timeout, error, n/a) instead of "—"
const scalingTable = (series, tools, withStatus = false) => {
  const v = (fx, t) => {
    const x = fmtMs(ms(fx, t, "minMs"))
    const c = bench.cells[`${fx}|${t}`]
    return withStatus && x === "—" && c && c.status !== "ok" ? statusText(c) : x
  }
  return table(
    ["Series (min ms)", ...tools.map((t) => LABEL[t])],
    series.map(([label, a, b]) => [label, ...tools.map((t) => `${v(a, t)} → ${v(b, t)} (${ratio(ms(a, t, "minMs"), ms(b, t, "minMs"))})`)]),
  )
}
{
  const tools = withGate(["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "openapi-diff", "microdiff", "jsondiffpatch"])
  const series = [
    ["wide 1 000 → 4 000 (4× input)", "oas-wide-1000", "oas-wide-4000"],
    ["wide 4 000 → 10 000 (2.5× input)", "oas-wide-4000", "oas-wide-10000"],
    ["deep 100 → 500 (5× input)", "oas-deep-100", "oas-deep-500"],
    ["500 → 2 000 usages of one $ref (4× input)", "oas-refs-500", "oas-refs-2000"],
    ["1 500 properties: request → response", "oas-dir-request-1500", "oas-dir-response-1500"],
  ]
  T.scaling = scalingTable(series, tools)
  const cliRows = series.map(([label, a, b]) => [
    label,
    ...["oasdiff", "openapi-changes"].map((t) => {
      const x = cli.cells[`${a}|${t}`]?.inProcessEquivMs
      const y = cli.cells[`${b}|${t}`]?.inProcessEquivMs
      return `${fmtMs(x)} → ${fmtMs(y)} (${ratio(x, y)})`
    }),
  ])
  T.scaling_cli = table(["Series (median − no-op, ms)", "oasdiff", "openapi-changes"], cliRows)
  // GraphQL and AsyncAPI have no controlled size series: small curated pair -> large / synthetic document of the same
  // kind, labelled with the input size ratio (before + after bytes of the format named)
  const sizeOf = (n, fmt) => {
    const f = meta(n).formats?.[fmt]
    return f ? f.beforeBytes + f.afterBytes : undefined
  }
  const sized = (label, a, b, fmt) => {
    const x = sizeOf(a, fmt)
    const y = sizeOf(b, fmt)
    return [`${label} (${x && y ? `${Math.round(y / x)}× ${fmt === "sdl" ? "SDL" : "JSON"} input` : "size n/a"})`, a, b]
  }
  T.scaling_graphql = scalingTable([sized("`gql-repo-pair` → `gql-github`", "gql-repo-pair", "gql-github", "sdl")], withGate(["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js", "microdiff", "jsondiffpatch"]), true)
  T.scaling_asyncapi = scalingTable(
    [
      sized("`aa2-events` → `aa2-wide-500`", "aa2-events", "aa2-wide-500", "json"),
      sized("`aa3-events` → `aa3-wide-500`", "aa3-events", "aa3-wide-500", "json"),
      sized("`aa2-wide-500` → `aa2-wide-2000`", "aa2-wide-500", "aa2-wide-2000", "json"),
      sized("`aa3-wide-500` → `aa3-wide-2000`", "aa3-wide-500", "aa3-wide-2000", "json"),
    ],
    withGate(["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "asyncapi-diff", "microdiff", "jsondiffpatch"]),
    true,
  )
}

// ---- performance targets of api-smart-diff 2.0.0 ----
{
  const m = (fx, t, k = "minMs") => bench.cells[`${fx}|${t}`]?.[k]
  const h = (fx, t) => heap.cells[`${fx}|${t}`]
  const both = (fx) => [m(fx, "asd-1.0.6"), m(fx, "asd-2.0.0")].map(fmtMs).join(" / ")
  const ok = (c) => (c === undefined ? "—" : c ? "met" : "**missed**")
  const r1 = m("oas-wide-1000", "asd-2.0.0")
  const r4 = m("oas-wide-4000", "asd-2.0.0")
  const r10 = m("oas-wide-10000", "asd-2.0.0")
  const req = m("oas-dir-request-1500", "asd-2.0.0")
  const res = m("oas-dir-response-1500", "asd-2.0.0")
  const gh = m("oas-github", "asd-2.0.0")
  const ghc = clone["oas-github"]?.minMs
  const hp = h("oas-github", "asd-2.0.0")
  const rows = [
    ["1 000 / 4 000 / 10 000 properties (request)", `${both("oas-wide-1000")}; ${both("oas-wide-4000")}; ${both("oas-wide-10000")}`, "linear (≤ 2.2× per doubling), 4 000 ≤ 450 ms", r1 && r4 ? `${(r4 / r1).toFixed(2)}× for 4× input, ${r10 && r4 ? (r10 / r4).toFixed(2) : "—"}× for 2.5×; 4 000 = ${fmtMs(r4)} ms` : "—", ok(r1 && r4 ? r4 <= 450 && r4 / r1 <= 2.2 * 2.2 : undefined)],
    ["1 500-property response vs request", `${fmtMs(m("oas-dir-response-1500", "asd-1.0.6"))} vs ${fmtMs(m("oas-dir-request-1500", "asd-1.0.6"))} / ${fmtMs(res)} vs ${fmtMs(req)}`, "≤ 1.2× request", req && res ? `${(res / req).toFixed(2)}×` : "—", ok(req && res ? res / req <= 1.2 : undefined)],
    ["nesting (proxy: plain properties, 100 / 500 levels; target was 150 allOf levels)", `${both("oas-deep-100")}; ${both("oas-deep-500")}`, "O(n), ≤ 15 ms at 150 levels", `${fmtMs(m("oas-deep-100", "asd-2.0.0"))} ms at 100, ${fmtMs(m("oas-deep-500", "asd-2.0.0"))} ms at 500`, ok(m("oas-deep-100", "asd-2.0.0") !== undefined ? m("oas-deep-100", "asd-2.0.0") <= 15 : undefined)],
    ["500 usages of one $ref", both("oas-refs-500"), "O(k), ≤ 25 ms", `${fmtMs(m("oas-refs-500", "asd-2.0.0"))} ms; 2 000 usages ${fmtMs(m("oas-refs-2000", "asd-2.0.0"))} ms`, ok(m("oas-refs-500", "asd-2.0.0") !== undefined ? m("oas-refs-500", "asd-2.0.0") <= 25 : undefined)],
    ["40 × 40 combinator branches (here: 40 branches of 40 properties each, heavier than the 40 × 1 of test/performance.test.ts)", both("oas-oneof-40"), "≤ 8 ms", `${fmtMs(m("oas-oneof-40", "asd-2.0.0"))} ms`, ok(m("oas-oneof-40", "asd-2.0.0") !== undefined ? m("oas-oneof-40", "asd-2.0.0") <= 8 : undefined)],
    ["real-world OpenAPI (GitHub REST, 7.6 MB, change set)", both("oas-github"), "≤ 1.5× structuredClone of both documents", gh && ghc ? `${fmtMs(gh)} = ${(gh / ghc).toFixed(1)}× the clone (${fmtMs(ghc)} ms)` : "—", ok(gh && ghc ? gh / ghc <= 1.5 : undefined)],
    ["memory (GitHub change set)", "—", "merged independent of inputs; heap added by the call (peak minus the heap before the call) ≤ 2.5× input", hp?.peakHeapBytes ? `added ${fmtMB(addedHeap(hp))} MB = ${(addedHeap(hp) / hp.inputHeapBytes).toFixed(1)}× the input heap (${fmtMB(hp.inputHeapBytes)} MB); informational: absolute peak ${fmtMB(hp.peakHeapBytes)} MB = ${(hp.peakHeapBytes / hp.inputHeapBytes).toFixed(1)}×, retained ${fmtMB(hp.heapRetainedBytes)} MB` : "—", ok(hp?.peakHeapBytes ? addedHeap(hp) / hp.inputHeapBytes <= 2.5 : undefined)],
  ]
  T.targets = table(["Scenario", "1.0.6 / 2.0.0 (min ms)", "Target", "2.0.0 measured", "Status"], rows)
}

// ---- option sensitivity / merged document cost (aux variants run only on these fixtures) ----
{
  const OPTION_FIXTURES = { openapi: ["oas-petstore", "oas-refs-2000", "oas-wide-10000", "oas-github", "oas-github-identical"], asyncapi: ["aa3-events"], graphql: ["gql-github"] }
  const tools = withGate(["asd-2.0.0", "asd-2.0.0-normalized"]).concat(["fork-4.0.1", "fork-4.0.1-normalized", "fork-4.0.1-plain"])
  for (const type of LEGACY_TYPES) T[`options_${type}`] = table(["Fixture", ...tools.map((t) => LABEL[t])], OPTION_FIXTURES[type].map((f) => [`\`${f}\``, ...tools.map((t) => timingCell(f, t))]))
}

// ---- quality ----
const qcell = (fx, t) => quality.cells[`${fx}|${t}`]
// risky, scored on its own (computed from the per-change verdicts, so cells scored before the column existed work too):
// expected-risky changes found as risky / expected-risky changes, and risky verdicts over all detected changes. A risky
// verdict also counts on the breaking side of the breaking-agreement column.
const riskyOf = (q) => {
  const ch = q.changes || []
  const exp = ch.filter((c) => !c.optional && c.expected === "risky")
  return { exp: exp.length, agree: exp.filter((c) => c.verdict === "risky").length, verdicts: ch.filter((c) => c.detected && c.verdict === "risky").length }
}
const riskyText = (r) => (r.exp || r.verdicts ? `${r.agree}/${r.exp}${r.verdicts ? ` (${r.verdicts} risky)` : ""}` : "—")
const changeFixtures = (fam) => F.all.filter((f) => f.family === fam && f.kind === "changeset")
for (const fam of Object.keys(QUALITY_TOOLS)) {
  const rows = []
  for (const f of changeFixtures(fam)) {
    for (const t of QUALITY_TOOLS[fam]) {
      const q = qcell(f.name, t)
      if (!q) continue
      if (q.status !== "ok") {
        rows.push([`\`${f.name}\``, LABEL[t], statusText(q), "", "", "", "", "", "", "", (q.reason || q.run?.error?.message || "").slice(0, 90)])
        continue
      }
      if (q.docLevel) {
        rows.push([`\`${f.name}\``, LABEL[t], `${q.diffs}`, "doc-level", "—", `verdict ${q.docVerdict} (expected ${q.docExpected})`, q.docAgree ? "1/1" : "0/1", "—", "—", "—", "document-level verdict only"])
        continue
      }
      rows.push([
        `\`${f.name}\``,
        LABEL[t],
        `${q.diffs}`,
        `${q.detected}/${q.expected} (${pct(q.recall)})`,
        pct(q.precision),
        `${q.classAgree}/${q.detectedAll}`,
        `${q.breakingAgree}/${q.detectedAll}`,
        riskyText(riskyOf(q)),
        pct(q.endToEnd),
        q.diffs ? `${pct(q.described / q.diffs)}${q.weakDescriptions ? ` (${q.weakDescriptions} weak)` : ""}` : "—",
        [q.missedBreaking.length ? `missed breaking: ${q.missedBreaking.join(", ")}` : "", q.falseBreaking.length ? `false breaking: ${q.falseBreaking.join(", ")}` : ""].filter(Boolean).join("; "),
      ])
    }
  }
  T[`quality_${fam}`] = table(["Fixture", "Tool", "Diffs", "Detected (recall)", "Precision", "Class agreement", "Breaking agreement", "Risky", "End-to-end", "Described"].concat("Notes"), rows)
}
// totals over the curated change sets (synthetic scaling fixtures excluded)
const totals = (t, curated) => {
  const s = { exp: 0, det: 0, cls: 0, brk: 0, detAll: 0, diffs: 0, matched: 0, described: 0, runs: 0, fails: 0, doc: 0, docAgree: 0, risky: { exp: 0, agree: 0, verdicts: 0 } }
  for (const f of curated) {
    const q = qcell(f.name, t)
    if (!q || q.status === "n/a") continue
    if (q.docLevel) {
      s.doc++
      if (q.docAgree) s.docAgree++
      continue
    }
    if (q.status !== "ok") {
      s.fails++
      continue
    }
    s.runs++
    s.exp += q.expected
    s.det += q.detected
    s.cls += q.classAgree
    s.brk += q.breakingAgree
    s.detAll += q.detectedAll
    s.diffs += q.diffs
    s.matched += q.matchedDiffs
    s.described += q.described
    const r = riskyOf(q)
    for (const k of ["exp", "agree", "verdicts"]) s.risky[k] += r[k]
  }
  return s
}
const totalsRow = (s) => [`${s.runs}${s.fails ? ` (+${s.fails} error)` : ""}`, `${s.det}/${s.exp} (${pct(s.exp ? s.det / s.exp : null)})`, pct(s.diffs ? s.matched / s.diffs : null), `${s.cls}/${s.detAll} (${pct(s.detAll ? s.cls / s.detAll : null)})`, `${s.brk}/${s.detAll} (${pct(s.detAll ? s.brk / s.detAll : null)})`, riskyText(s.risky), pct(s.diffs ? s.described / s.diffs : null)]
const TOTALS_HEAD = ["Tool", "Change-set fixtures run", "Detected", "Precision", "Class agreement", "Breaking agreement", "Risky", "Described"]
{
  const curated = F.all.filter((f) => f.kind === "changeset")
  const tools = withGate(["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "oasdiff", "openapi-changes", "openapi-diff", "asyncapi-diff", "graphql-inspector", "graphql-js"])
  T.quality_totals = table(TOTALS_HEAD, tools.map((t) => [LABEL[t], ...totalsRow(totals(t, curated))]))
}
// per-type summary: totals over the type's curated change sets + headline timings (min ms; Go CLIs: median − no-op)
for (const type of LEGACY_TYPES) {
  const curated = ofType(type).filter((f) => f.kind === "changeset")
  const keys = TYPE_TOOLS[type].key
  const keyCell = (fx, t) => {
    if (TYPE_TOOLS[type].cli.includes(t)) {
      const c = R.cli[type].cells[`${fx}|${t}`]
      if (!c) return qcell(fx, t)?.status === "n/a" ? "n/a" : "—"
      if (c.status !== "ok") return statusText(c)
      return `${fmtMs(c.inProcessEquivMs)} (CLI −no-op)${dagger(fx, t)}`
    }
    const c = bench.cells[`${fx}|${t}`]
    if (!c) return "—"
    if (c.status !== "ok") return statusText(c)
    return `${fmtMs(c.minMs)}${dagger(fx, t)}`
  }
  const rows = TYPE_TOOLS[type].quality.map((t) => {
    const s = totals(t, curated)
    const q = s.runs || s.fails ? totalsRow(s) : s.doc ? ["0", `document level only: ${s.docAgree}/${s.doc} verdicts agree`, "—", "—", "—", "—", "—"] : ["0", "—", "—", "—", "—", "—", "—"]
    return [LABEL[t], ...q, ...keys.map((k) => keyCell(k, t))]
  })
  rows.push([`${LABEL["fast-json-patch"]} (floor)`, "—", "no classification", "—", "—", "—", "—", "—", ...keys.map((k) => keyCell(k, "fast-json-patch"))])
  T[`summary_${type}`] = table([...TOTALS_HEAD, ...keys.map((k) => `\`${k}\` (min ms)`)], rows)
}
// per-change verdict matrices
const ABBR = { breaking: "B", risky: "R", "non-breaking": "N", deprecated: "D", annotation: "A", unclassified: "U" }
const verdictMatrix = (fx, tools) => {
  const exp = F.readExpected(fx) || []
  const rows = exp.map((e) => {
    const cells = tools.map((t) => {
      const q = qcell(fx, t)
      if (!q || q.status !== "ok" || !q.changes) return q?.status === "n/a" ? "n/a" : q ? statusText(q) : "—"
      const c = q.changes.find((x) => x.id === e.id)
      if (!c.detected) return e.optional ? "– (ok)" : "**miss**"
      return c.classAgree ? `${ABBR[c.verdict]} ✓` : c.breakingAgree ? `${ABBR[c.verdict]} ~` : `**${ABBR[c.verdict]} ✗**`
    })
    return [e.id, e.what.replace(/\|/g, "\\|"), `${ABBR[e.class]}${e.accept ? ` (${e.accept.map((a) => ABBR[a]).join("/")})` : ""}`, ...cells]
  })
  return table(["Id", "Change", "Expected", ...tools.map((t) => LABEL[t])], rows)
}
T.matrix_petstore = verdictMatrix("oas-petstore", QUALITY_TOOLS.openapi)
T.matrix_github = verdictMatrix("oas-github", QUALITY_TOOLS.openapi)
T.matrix_aa2 = verdictMatrix("aa2-events", QUALITY_TOOLS.asyncapi)
T.matrix_aa3 = verdictMatrix("aa3-events", QUALITY_TOOLS.asyncapi)
T.matrix_js = verdictMatrix("js-repo-pair", QUALITY_TOOLS.jsonschema.filter((t) => t !== "json-schema-diff"))
T.matrix_gql = verdictMatrix("gql-github", QUALITY_TOOLS.graphql)
T.matrix_gqlrepo = verdictMatrix("gql-repo-pair", QUALITY_TOOLS.graphql)

// identical documents
for (const type of LEGACY_TYPES) {
  const tools = TYPE_TOOLS[type].identical
  T[`identical_${type}`] = table(
    ["Fixture", ...tools.map((t) => LABEL[t])],
    ofType(type)
      .filter((f) => f.kind === "identical")
      .map((f) => [
        `\`${f.name}\``,
        ...tools.map((t) => {
          const q = qcell(f.name, t)
          if (!q) return "—"
          if (q.status === "n/a") return "n/a"
          if (q.status !== "ok") return statusText(q)
          return q.diffs ? `**${q.diffs}**` : "0"
        }),
      ]),
  )
}
// input mutation / merged document (index: every public non-synthetic fixture; type reports: that type's fixtures)
const mutationTable = (tools, fxs) =>
  table(
    ["Tool", "Fixtures run", "Mutated an input", "Merged / annotated document"],
    tools.map((t) => {
      const cs = fxs.map((f) => qcell(f.name, t)).filter((q) => q && q.status === "ok")
      const mut = cs.filter((q) => q.run?.mutatedInput === true).map((q) => q.fixture)
      const na = cs.length && cs.every((q) => q.run?.mutatedInput === "n/a")
      return [LABEL[t], `${cs.length}`, na ? "n/a (GraphQLSchema inputs cannot be snapshotted)" : mut.length ? `${mut.length}: ${mut.join(", ")}` : "none", cs.some((q) => q.run?.mergedDocument) ? "yes" : "no"]
    }),
  )
T.mutation = mutationTable(withGate(["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "openapi-diff", "json-schema-diff", "asyncapi-diff", "graphql-inspector", "graphql-js", ...FLOORS]), F.all.filter((f) => f.kind !== "synthetic"))
for (const type of LEGACY_TYPES) T[`mutation_${type}`] = mutationTable(TYPE_TOOLS[type].mutation, ofType(type).filter((f) => f.kind !== "synthetic"))

// bundle sizes
{
  const ids = ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "openapi-diff", "json-schema-diff", "asyncapi-diff", "graphql-inspector-core", "graphql-js", "microdiff", "jsondiffpatch", "deep-diff", "fast-json-patch"]
  T.bundle = table(
    ["Variant", "Version", "min (kB)", "min+gzip (kB)", "Notes"],
    ids
      .filter((id) => manifest.variants[id])
      .map((id) => {
        const v = manifest.variants[id]
        const own = v.minSource === "package build"
        const note = id === "fork-4.0.1" ? "graphql external; api-unifier, fork json-crawl, fork graphapi, fast-equals, flatted, object-hash bundled; ddlapi stubbed" : id === "graphql-inspector-core" ? "graphql external" : id.startsWith("asd") ? `allof-merge + json-crawl bundled${own ? "; the package's own browser build (dist/api-smart-diff.min.js)" : " (esbuild)"}` : ""
        return [id, String(v.version || "").replace(/ \(.*/, ""), v.minBytes ? (v.minBytes / 1000).toFixed(1) : "—", v.minGzipBytes ? (v.minGzipBytes / 1000).toFixed(1) : "—", note]
      }),
  )
}

// fork jest: the per-type runs merged in completion order
{
  const runs = LEGACY_TYPES.map((t) => R.forkJest[t]).filter(Boolean)
  const results = runs.flatMap((j) => j.testResults).sort((a, b) => (a.endTime || 0) - (b.endTime || 0))
  const sum = (k) => runs.reduce((a, j) => a + (j[k] || 0), 0)
  T.fork_jest = runs.length
    ? `${table(
        ["Test file", "Passed", "Failed", "Skipped"],
        results.map((r) => [path.basename(r.name), r.assertionResults.filter((a) => a.status === "passed").length, r.assertionResults.filter((a) => a.status === "failed").length, r.assertionResults.filter((a) => a.status === "pending" || a.status === "skipped").length]),
      )}\n\nTotal: ${sum("numPassedTests")} passed, ${sum("numFailedTests")} failed, ${sum("numPendingTests")} skipped (skips are \`it.skip\` in the fork's own sources).`
    : "not run"
}

// ---- harvested corpus (scripts/corpus.js -> results/<type>/corpus.json) ----
const cpct = (a, b) => (b ? `${a}/${b} (${pct(a / b)})` : "—")
const CORPUS_CLASSIFIERS = {
  openapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "oasdiff", "openapi-changes", "openapi-diff", "json-schema-diff"],
  graphql: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "graphql-inspector", "graphql-js"],
  asyncapi: ["asd-1.0.6", "asd-2.0.0", "fork-4.0.1", "asyncapi-diff", "openapi-changes"],
}
const strictText = (st) => (st ? `${pct(st.D / st.of)} / ${pct(st.C / st.of)} / ${pct(st.A / st.of)} / **${pct(st.all / st.of)}**` : "—")
const corpusRun = (c) => `${c.export?.variants ?? "?"} variants of ${c.export?.cases ?? "?"} cases, exported ${String(c.export?.exportedAt || "").slice(0, 10)}; run ${String(c.generatedAt).slice(0, 10)}${c.selection ? `. **Partial run** (${Object.entries(c.selection).filter(([, x]) => x).map(([k, x]) => `${k} ${x}`).join(", ")})` : ""}.`
for (const type of LEGACY_TYPES) {
  const c = R.corpus[type]
  const notRun = `not run (\`node scripts/corpus.js --type=${type}\`)`
  if (!c) {
    for (const k of ["corpus", "corpus_family", "corpus_beats"]) T[`${k}_${type}`] = notRun
    continue
  }
  const sumOf = (t) => c.summary[t]
  const tools = c.tools
  const rows = tools.map((t) => {
    const x = sumOf(t)
    const floor = FLOORS.includes(t)
    const run = x.variants - x.na
    const beats = c.beats.counts[t]
    return [
      LABEL[t] || t,
      `${run}${x.na ? ` (${x.na} n/a)` : ""}`,
      x.errors || x.timeouts ? `${x.errors} / ${x.timeouts}` : "0",
      cpct(x.detected, run),
      floor ? "—" : cpct(...x.classified),
      floor ? "—" : cpct(...x.breaking),
      floor ? "—" : x.risky.expected || x.risky.verdicts ? `${x.risky.agree}/${x.risky.expected}${x.risky.verdicts ? ` (${x.risky.verdicts} risky)` : ""}` : "—",
      floor ? "—" : cpct(...x.described),
      floor ? "—" : cpct(x.all, run),
      strictText(x.strict),
      t === "asd-2.0.0" ? "—" : beats ? `${beats.variants}` : "0",
    ]
  })
  T[`corpus_${type}`] = `${corpusRun(c)}\n\n${table(["Tool", "Variants run", "Errors / timeouts", "Detected", "Classified", "Breaking agreement", "Risky", "Described", "All three", "Strict D / C / A / all (asd)", "Variants where it beats asd 2.0.0"], rows)}`
  // per compat family: strict all-three of the asd versions, case-level classification of every classifier
  const fams = Object.keys(c.byFamily)
  const cls = CORPUS_CLASSIFIERS[type].filter((t) => c.tools.includes(t))
  T[`corpus_family_${type}`] = table(
    ["Family", "Variants", "asd 1.0.6 strict all", "asd 2.0.0 strict D / C / A / all", ...cls.map((t) => `${LABEL[t] || t} classified`)],
    fams.map((f) => {
      const x = c.byFamily[f]
      const sa = (st) => (st ? pct(st.all / st.of) : "—")
      return [f, `${x["asd-2.0.0"]?.variants ?? "—"}`, sa(x["asd-1.0.6"]?.strict), strictText(x["asd-2.0.0"]?.strict), ...cls.map((t) => (x[t] && x[t].classified[1] ? pct(x[t].classified[0] / x[t].classified[1]) : "n/a"))]
    }),
  )
  // where a tool beats asd 2.0.0 (case level), capped list; the full list is in corpus.json
  const counts = Object.entries(c.beats.counts).sort((a, b) => b[1].variants - a[1].variants)
  const CAP = 60
  const list = c.beats.list.filter((b) => !FLOORS.includes(b.tool))
  T[`corpus_beats_${type}`] = counts.length
    ? `${table(["Tool", "Variants", "detected", "classified", "breaking side", "described"], counts.map(([t, k]) => [LABEL[t] || t, k.variants, k.detected, k.classified, k.breaking, k.described]))}\n\n${list.length ? `${list.length > CAP ? `First ${CAP} of ${list.length} entries of classifying tools (all in \`results/${type}/corpus.json\` → \`beats.list\`):` : "Entries of classifying tools:"}\n\n${table(
        ["Variant", "Tool", "Better on", "Expected", "asd 2.0.0 verdict / diffs", "Tool verdict / diffs"],
        list.slice(0, CAP).map((b) => [`\`${b.id}\``, LABEL[b.tool] || b.tool, b.dims.join(", "), b.expected || "—", b.ref, b.peer]),
      )}` : ""}`
    : "No variant where another tool beats asd 2.0.0."
}
// index: one line per type
T.corpus_summary = table(
  ["Type", "Variants", "asd 1.0.6 strict all", "asd 2.0.0 strict D / C / A / all", "Classified (case level): asd 2.0.0 / fork / peers", "Variants where a classifying tool beats asd 2.0.0"],
  LEGACY_TYPES.map((type) => {
    const c = R.corpus[type]
    if (!c) return [type, "not run", "", "", "", ""]
    const cl = (t) => (c.summary[t]?.classified[1] ? `${LABEL[t] || t} ${pct(c.summary[t].classified[0] / c.summary[t].classified[1])}` : null)
    const beatV = new Set(c.beats.list.filter((b) => !FLOORS.includes(b.tool)).map((b) => b.id)).size
    return [type, `${c.summary["asd-2.0.0"]?.variants ?? "—"}${c.selection ? " (partial)" : ""}`, c.summary["asd-1.0.6"]?.strict ? pct(c.summary["asd-1.0.6"].strict.all / c.summary["asd-1.0.6"].strict.of) : "—", strictText(c.summary["asd-2.0.0"]?.strict), CORPUS_CLASSIFIERS[type].filter((t) => t !== "asd-1.0.6").map(cl).filter(Boolean).join(", "), `${beatV}`]
  }),
)

// ---- notes: optional provenance text of a run, <results>/note.md (overview) and <results>/<type>/note.md ----
const readNote = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim() : "")
T.note = readNote(path.join(P.RESULTS, "note.md"))
for (const t of TY.TYPES) T[`note_${t}`] = readNote(TY.resultFile(t, "note.md"))

// ---- grpc (scripts/report-grpc.js) ----
Object.assign(T, require("./report-grpc").placeholders())

// ---- render ----
// `--only grpc,index` renders a subset of the documents (e.g. after a `bench:grpc` run, without re-rendering the
// reports of the other types from their results)
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null
const DOCS = [
  { id: "index", template: "BENCHMARK.template.md", out: path.join(P.DOCS, "README.md") },
  { id: "openapi", template: "OPENAPI.template.md", out: path.join(P.DOCS, "OPENAPI.md") },
  { id: "graphql", template: "GRAPHQL.template.md", out: path.join(P.DOCS, "GRAPHQL.md") },
  { id: "asyncapi", template: "ASYNCAPI.template.md", out: path.join(P.DOCS, "ASYNCAPI.md") },
  { id: "grpc", template: "GRPC.template.md", out: path.join(P.DOCS, "GRPC.md") },
]
let missing = 0
for (const d of DOCS) {
  if (ONLY && !ONLY.includes(d.id)) continue
  const tpl = path.join(P.TEMPLATES, d.template)
  if (!fs.existsSync(tpl)) {
    console.error(`missing template ${path.relative(P.BENCH, tpl)}`)
    missing++
    continue
  }
  const src = fs.readFileSync(tpl, "utf8")
  const used = []
  const out = src.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (T[k] === undefined) {
      console.error(`${d.template}: unknown placeholder ${m}`)
      missing++
      return m
    }
    used.push(k)
    return T[k]
  })
  fs.mkdirSync(path.dirname(d.out), { recursive: true })
  // an empty placeholder (e.g. no note) leaves no extra blank lines
  fs.writeFileSync(d.out, out.replace(/\n{3,}/g, "\n\n"))
  console.log(`wrote ${path.relative(P.BENCH, d.out)}`)
  if (d.id !== "index") {
    const md = used.map((k) => `## ${k}\n\n${T[k]}\n`).join("\n")
    fs.mkdirSync(TY.resultsDir(d.id), { recursive: true })
    fs.writeFileSync(TY.resultFile(d.id, "tables.md"), `# Generated tables, ${d.id} (scripts/report.js)\n\n${md}`)
    console.log(`wrote ${path.relative(P.BENCH, TY.resultFile(d.id, "tables.md"))} (${used.length} tables)`)
  }
}
if (missing) process.exit(1)
