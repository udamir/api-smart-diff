"use strict"
// One adapter per in-process variant. Interface:
//   supports(fixture)        -> true | "n/a reason"
//   format(fixture)          -> input format read from fixtures/cache ("json", "sdl", "gql-0.5.1", ...)
//   setup()                  -> library handle (required once per process, outside timing)
//   prepare(lib, b, a, fx)   -> per-call input built OUTSIDE the timed region (fresh copies; strings / GraphQLSchema
//                              objects where a tool only accepts those)
//   run(lib, input, fx)      -> the timed call; returns the tool's raw result (awaited when it is a promise)
//   normalize(raw, fx)       -> [{ hay, action, cls, desc }] used by scripts/quality.js
//   merged(raw)              -> the merged / annotated document if the tool produces one
// Classes: breaking | risky | non-breaking | deprecated | annotation | unclassified (the mapping of every tool's own
// vocabulary is described in the overview report, results/README.md).
// Ids: `asd-2.0.0` is always the repository build (scripts/build.js records its actual version), `asd-1.0.6` the
// published 1.0.6 package.
const path = require("node:path")
const P = require("./scripts/paths")

const METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"])
const lib = (id) => require(path.join(P.BUILD, id, "index.cjs"))
const prim = (v) => (v === null || ["string", "number", "boolean"].includes(typeof v) ? String(v) : "")

// canonical location tokens for a document path given as an array of segments
const locTokens = (segs) => {
  if (!Array.isArray(segs) || !segs.length) return ""
  const s = segs.map(String)
  const out = [`/${s.join("/")}/`]
  if (s[0] === "paths" && s.length >= 2) {
    out.push(`@path:${s[1]}@`)
    if (s.length >= 3 && METHODS.has(s[2])) out.push(`@op:${s[2]} ${s[1]}@`)
  }
  return out.join(" ")
}
const hay = (...parts) => parts.filter(Boolean).join(" ").toLowerCase()

const CLASS = {
  breaking: "breaking",
  "non-breaking": "non-breaking",
  annotation: "annotation",
  unclassified: "unclassified",
  deprecated: "deprecated",
  risky: "risky",
}

// ---------- api-smart-diff 1.0.6 / 2.0.0 ----------
const asdNormalize = (raw) =>
  raw.diffs.map((d) => ({
    hay: hay(locTokens(d.path), d.origin ? `${locTokens(d.origin.before)} ${locTokens(d.origin.after)}` : "", d.description, d.action === "rename" ? `${d.before} ${d.after}` : `${prim(d.before)} ${prim(d.after)}`),
    action: d.action,
    cls: CLASS[d.type] || "unclassified",
    desc: d.description || "",
    // a boolean flag switched on / off may be described as added / removed (lib/vocab.js weak)
    ...(typeof d.before === "boolean" || typeof d.after === "boolean" ? { flag: true } : {}),
  }))

const asd = (id, buildId, extra = {}) => ({
  id,
  family: "asd",
  label: extra.label,
  supports: extra.supports || (() => true),
  format: extra.format || ((fx) => (fx.family === "graphql" ? "gql-1.0" : "json")),
  setup: () => lib(buildId),
  prepare: (_l, b, a) => [structuredClone(b), structuredClone(a)],
  // fx.compareOptions: per-case options of the harvested corpus (scripts/corpus.js), absent for the curated fixtures
  run: (l, [b, a], fx) => l.apiCompare(b, a, { ...(extra.options || {}), ...(fx?.compareOptions || {}) }),
  normalize: asdNormalize,
  merged: (raw) => raw.merged,
  mergedDoc: true,
  aux: !!extra.aux,
})

// ---------- Netcracker fork ----------
// options of the fork's own OpenAPI / compatibility-suite tests (TEST_NORMALIZE_OPTIONS minus the test-only symbols)
const FORK_OPTIONS = { validate: true, liftCombiners: true, unify: true, allowNotValidSyntheticChanges: true }
const forkNormalize = (raw) =>
  raw.diffs.map((d) => {
    const decl = [...(d.beforeDeclarationPaths || []), ...(d.afterDeclarationPaths || [])]
    return {
      hay: hay(decl.map(locTokens).join(" "), d.description, d.action === "rename" ? `${d.beforeKey} ${d.afterKey}` : `${prim(d.beforeValue)} ${prim(d.afterValue)}`, d.scope),
      action: d.action,
      cls: CLASS[d.type] || "unclassified",
      desc: d.description || "",
    }
  })
const fork = (id, options, label) => ({
  id,
  family: "fork",
  label,
  supports: (fx) => (fx.spec === "aa2" ? "AsyncAPI 2.x dropped by the fork (resolveSpec throws)" : true),
  format: (fx) => (fx.family === "graphql" ? "gql-fork" : "json"),
  setup: () => lib("fork-4.0.1"),
  prepare: (_l, b, a) => [structuredClone(b), structuredClone(a)],
  run: (l, [b, a]) => l.apiDiff(b, a, { ...options, beforeSource: b, afterSource: a }),
  normalize: forkNormalize,
  merged: (raw) => raw.merged,
  mergedDoc: true,
})

// ---------- npm peers ----------
const openapiDiffLoc = (loc) => {
  const m = /^paths\.(\/.*?)(?:\.(get|put|post|delete|options|head|patch|trace)(?:\.|$)|$)/.exec(loc || "")
  if (!m) return String(loc || "")
  return `${loc} @path:${m[1]}@${m[2] ? ` @op:${m[2]} ${m[1]}@` : ""}`
}
const openapiDiff = {
  id: "openapi-diff",
  family: "peer",
  // its Swagger Parser rejects OpenAPI 3.1 / 3.2 ("Unsupported OpenAPI version")
  supports: (fx) => (fx.family !== "openapi" ? "OpenAPI / Swagger 2 only" : fx.spec === "oas31" || fx.spec === "oas32" ? "OpenAPI 3.0 / Swagger 2 only (Swagger Parser rejects 3.1 / 3.2)" : true),
  format: () => "json",
  setup: () => require("openapi-diff"),
  // the library takes the document text and parses it itself (JSON.parse of the already serialized input is the
  // tool's own parsing and is timed; serialization happens here, outside the timed region)
  prepare: (_l, b, a) => [JSON.stringify(b), JSON.stringify(a)],
  run: (l, [b, a]) =>
    l.diffSpecs({ sourceSpec: { content: b, location: "before.json", format: "openapi3" }, destinationSpec: { content: a, location: "after.json", format: "openapi3" } }),
  normalize: (raw) =>
    [...(raw.breakingDifferences || []), ...(raw.nonBreakingDifferences || []), ...(raw.unclassifiedDifferences || [])].map((d) => {
      const locs = [...(d.sourceSpecEntityDetails || []), ...(d.destinationSpecEntityDetails || [])]
      return {
        hay: hay(d.code, d.entity, locs.map((x) => `${openapiDiffLoc(x.location)} ${prim(x.value)} ${x.value && typeof x.value === "object" && typeof x.value.name === "string" ? x.value.name : ""}`).join(" ")),
        action: d.action,
        cls: d.type === "breaking" ? "breaking" : d.type === "non-breaking" ? "non-breaking" : "unclassified",
        // the library emits machine codes only (e.g. "request.body.scope.remove"), no human-readable text
        desc: "",
      }
    }),
  coarse: "schema-granular: one difference per changed request/response schema (it delegates schemas to json-schema-diff)",
}

const jsonSchemaDiff = {
  id: "json-schema-diff",
  family: "peer",
  supports: (fx) => (fx.family === "jsonschema" ? true : "JSON Schema only"),
  format: () => "json",
  setup: () => require("json-schema-diff"),
  prepare: (_l, b, a) => [structuredClone(b), structuredClone(a)],
  run: (l, [b, a]) => l.diffSchemas({ sourceSchema: b, destinationSchema: a }),
  // document-level verdict only: "removals" = instances valid before and invalid after (narrowing)
  normalize: (raw) => {
    const out = []
    if (raw.removalsFound) out.push({ hay: "*document*", action: "remove", cls: "breaking", desc: "" })
    if (raw.additionsFound) out.push({ hay: "*document*", action: "add", cls: "non-breaking", desc: "" })
    return out
  },
  docLevel: true,
}

const asyncapiDiff = {
  id: "asyncapi-diff",
  family: "peer",
  supports: (fx) => (fx.family === "asyncapi" ? true : "AsyncAPI only"),
  format: () => "json",
  setup: () => require("@asyncapi/diff"),
  prepare: (_l, b, a) => [structuredClone(b), structuredClone(a)],
  run: (l, [b, a]) => l.diff(b, a, { outputType: "json" }),
  normalize: (raw) => {
    const out = raw.getOutput()
    return (out.changes || []).map((c) => ({
      hay: hay(`${String(c.path).replace(/~1/g, "/").replace(/~0/g, "~")}/`, prim(c.before), prim(c.after)),
      action: c.action,
      cls: c.type === "breaking" ? "breaking" : c.type === "non-breaking" ? "non-breaking" : "unclassified",
      desc: "",
    }))
  },
}

const inspector = {
  id: "graphql-inspector",
  family: "peer",
  supports: (fx) => (fx.family === "graphql" ? true : "GraphQL only"),
  format: () => "sdl",
  setup: () => ({ core: require("@graphql-inspector/core"), graphql: require("graphql") }),
  // the GraphQLSchema objects are the parsed input (the equivalent of the already-parsed JSON for the other tools)
  prepare: (l, b, a) => [l.graphql.buildSchema(b), l.graphql.buildSchema(a)],
  run: (l, [b, a]) => l.core.diff(b, a),
  normalize: (raw) =>
    raw.map((c) => ({
      hay: hay(c.path, c.type, c.message),
      action: c.type,
      cls: c.criticality.level === "BREAKING" ? "breaking" : c.criticality.level === "DANGEROUS" ? "risky" : "non-breaking",
      desc: c.message || "",
    })),
}

// graphql-js (bench/node_modules/graphql): findBreakingChanges / findDangerousChanges, the reference classification of
// the GraphQL reference implementation. Non-breaking, non-dangerous changes are not reported at all.
const graphqlJs = {
  id: "graphql-js",
  family: "peer",
  supports: (fx) => (fx.family === "graphql" ? true : "GraphQL only"),
  format: () => "sdl",
  setup: () => require("graphql"),
  prepare: (l, b, a) => [l.buildSchema(b), l.buildSchema(a)],
  run: (l, [b, a]) => ({ breaking: l.findBreakingChanges(b, a), dangerous: l.findDangerousChanges(b, a) }),
  normalize: (raw) =>
    [...raw.breaking.map((c) => ({ c, cls: "breaking" })), ...raw.dangerous.map((c) => ({ c, cls: "risky" }))].map(({ c, cls }) => ({
      // descriptions name the schema coordinate ("Query.foo was removed.", "ENUM_VALUE_ADDED")
      hay: hay(c.type, c.description, (c.description || "").replace(/[.,:]/g, " ")),
      action: c.type,
      cls,
      desc: c.description || "",
    })),
}

// ---------- end-to-end GraphQL rows: SDL text in, every build step timed ----------
// The prebuilt rows above give each tool its own parsed input (GraphQLSchema objects for graphql-inspector / graphql-js,
// GraphApi documents for asd, fork graphapi documents for the fork), built outside the timed region. These rows time
// the whole path from the two SDL strings: buildSchema (the same graphql copy for every tool, `noLocation: true`), the
// GraphApi conversion where the tool needs one, and the comparison.
const sdlFront = () => require(path.join(P.BUILD, "sdl-gqlapi-0.6.0", "index.cjs"))
const SDL_OPTIONS = { noLocation: true }
const gqlOnly = (fx) => (fx.family === "graphql" ? true : "GraphQL only")
const asdSdl = (id, buildId, label, options = {}) => ({
  id,
  family: "asd",
  label,
  supports: gqlOnly,
  format: () => "sdl",
  setup: () => ({ asd: lib(buildId), sdl: sdlFront() }),
  prepare: (_l, b, a) => [b, a],
  run: (l, [b, a]) =>
    l.asd.apiCompare(l.sdl.buildFromSchema(l.sdl.buildSchema(b, SDL_OPTIONS)), l.sdl.buildFromSchema(l.sdl.buildSchema(a, SDL_OPTIONS)), options),
  normalize: asdNormalize,
  merged: (raw) => raw.merged,
  mergedDoc: true,
  aux: false,
})
const sdlRows = [
  asdSdl("asd-2.0.0-sdl", "asd-2.0.0", "api-smart-diff 2.0.0 from SDL (buildSchema + gqlapi 0.6.0 GraphApi 1.0 + compare)"),
  // 1.0.6 from SDL: its own front end (gqlapi 0.5.1, bundled in conv-gqlapi-0.5.1)
  {
    id: "asd-1.0.6-sdl",
    family: "asd",
    label: "api-smart-diff 1.0.6 from SDL (gqlapi 0.5.1 + compare)",
    supports: gqlOnly,
    format: () => "sdl",
    setup: () => ({ asd: lib("asd-1.0.6"), conv: require(path.join(P.BUILD, "conv-gqlapi-0.5.1", "index.cjs")) }),
    prepare: (_l, b, a) => [b, a],
    run: (l, [b, a]) => l.asd.apiCompare(l.conv.fromSDL(b), l.conv.fromSDL(a)),
    normalize: asdNormalize,
    merged: (raw) => raw.merged,
    mergedDoc: true,
    aux: false,
  },
  {
    ...inspector,
    id: "graphql-inspector-sdl",
    label: "graphql-inspector from SDL (buildSchema + diff)",
    setup: () => ({ core: require("@graphql-inspector/core"), graphql: require("graphql") }),
    prepare: (_l, b, a) => [b, a],
    run: (l, [b, a]) => l.core.diff(l.graphql.buildSchema(b, SDL_OPTIONS), l.graphql.buildSchema(a, SDL_OPTIONS)),
  },
  {
    ...graphqlJs,
    id: "graphql-js-sdl",
    label: "graphql-js from SDL (buildSchema + findBreakingChanges / findDangerousChanges)",
    prepare: (_l, b, a) => [b, a],
    run: (l, [b, a]) => {
      const sb = l.buildSchema(b, SDL_OPTIONS)
      const sa = l.buildSchema(a, SDL_OPTIONS)
      return { breaking: l.findBreakingChanges(sb, sa), dangerous: l.findDangerousChanges(sb, sa) }
    },
  },
  {
    ...fork("fork-4.0.1-sdl", FORK_OPTIONS, "fork 4.0.1 from SDL (its graphapi conversion + apiDiff)"),
    supports: gqlOnly,
    format: () => "sdl",
    setup: () => ({ fork: lib("fork-4.0.1"), conv: require(path.join(P.BUILD, "conv-fork-graphapi", "index.cjs")) }),
    prepare: (_l, b, a) => [b, a],
    run: (l, [b, a]) => {
      const db = l.conv.fromSDL(b)
      const da = l.conv.fromSDL(a)
      return l.fork.apiDiff(db, da, { ...FORK_OPTIONS, beforeSource: db, afterSource: da })
    },
    aux: false,
  },
  // the conversion steps alone (no comparison): the parse every tool pays, and the parse plus the GraphApi build asd pays
  {
    id: "sdl-buildSchema",
    family: "floor",
    label: "graphql buildSchema of both SDL documents (no comparison)",
    supports: gqlOnly,
    format: () => "sdl",
    setup: () => require("graphql"),
    prepare: (_l, b, a) => [b, a],
    run: (l, [b, a]) => [l.buildSchema(b, SDL_OPTIONS), l.buildSchema(a, SDL_OPTIONS)],
    normalize: () => [],
    floor: true,
    aux: false,
  },
  {
    id: "sdl-gqlapi-build",
    family: "floor",
    label: "buildSchema + gqlapi 0.6.0 buildFromSchema of both SDL documents (no comparison)",
    supports: gqlOnly,
    format: () => "sdl",
    setup: sdlFront,
    prepare: (_l, b, a) => [b, a],
    run: (l, [b, a]) => [l.buildFromSchema(l.buildSchema(b, SDL_OPTIONS)), l.buildFromSchema(l.buildSchema(a, SDL_OPTIONS))],
    normalize: () => [],
    floor: true,
    aux: false,
  },
]

// ---------- structural JSON diff floor ----------
const floorFormat = (fx) => (fx.family === "graphql" ? "gql-1.0" : fx.family === "protoapi" ? "protoapi" : "json")
const ptrHay = (segs) => hay(locTokens(segs))
const floor = (id, setup, run, normalize) => ({
  id,
  family: "floor",
  supports: () => true,
  format: floorFormat,
  setup,
  prepare: (_l, b, a) => [structuredClone(b), structuredClone(a)],
  run,
  normalize: (raw) => normalize(raw).map((h) => ({ hay: h, action: "change", cls: "unclassified", desc: "" })),
  floor: true,
})
const jdpLeaves = (delta, prefix = [], out = []) => {
  if (!delta || typeof delta !== "object") return out
  if (Array.isArray(delta)) {
    out.push(ptrHay(prefix))
    return out
  }
  for (const k of Object.keys(delta)) {
    if (k === "_t") continue
    jdpLeaves(delta[k], [...prefix, k.replace(/^_/, "")], out)
  }
  return out
}
const floors = [
  floor("microdiff", () => require("microdiff").default || require("microdiff"), (l, [b, a]) => l(b, a), (raw) => raw.map((d) => ptrHay(d.path))),
  floor("jsondiffpatch", () => require("jsondiffpatch").create(), (l, [b, a]) => l.diff(b, a) || {}, (raw) => jdpLeaves(raw)),
  floor("deep-diff", () => require("deep-diff"), (l, [b, a]) => l.diff(b, a) || [], (raw) => raw.map((d) => ptrHay(d.path))),
  floor(
    "fast-json-patch",
    () => require("fast-json-patch"),
    (l, [b, a]) => l.compare(b, a),
    (raw) => raw.map((o) => ptrHay(o.path.split("/").slice(1).map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~")))),
  ),
]

// ---------- gRPC / ProtoApi (type grpc) ----------
// api-smart-diff 2.0.0 with its ProtoApi engine on the ProtoApi documents built from the `.proto` trees; one row per
// compatibility level. In the harvested corpus the row `asd-2.0.0-proto` takes each variant's own level from its
// compare options.
const protoOnly = (fx) => (fx.family === "protoapi" ? true : "ProtoApi only")
const PROTO_LEVELS = { "asd-2.0.0-proto": "FILE", "asd-2.0.0-proto-package": "PACKAGE", "asd-2.0.0-proto-wire-json": "WIRE_JSON", "asd-2.0.0-proto-wire": "WIRE" }
// normalized with the last path key (the ProtoApi description labels of lib/corpus-score.js depend on it)
const protoNormalize = (raw) => asdNormalize(raw).map((n, i) => ({ ...n, proto: true, key: String(raw.diffs[i].path[raw.diffs[i].path.length - 1]) }))
const protoRows = Object.entries(PROTO_LEVELS).map(([id, level]) => ({
  ...asd(id, "asd-2.0.0", { label: `api-smart-diff 2.0.0 ProtoApi, compatibility ${level}`, options: { compatibility: level }, format: () => "protoapi", supports: protoOnly }),
  normalize: protoNormalize,
  level,
  grpc: true,
}))
// end to end from the `.proto` trees: protoapi buildFromProto of both trees (imports: "user") + compare, the path a
// user takes from source files (the counterpart of buf breaking, which also parses and builds both trees)
const protoE2e = {
  ...asd("asd-2.0.0-proto-e2e", "asd-2.0.0", { label: "api-smart-diff 2.0.0 ProtoApi from .proto (protoapi build + compare, FILE)", supports: protoOnly }),
  format: () => "proto",
  setup: () => ({ asd: lib("asd-2.0.0"), proto: lib("conv-protoapi") }),
  prepare: (_l, b, a) => [b, a],
  run: (l, [b, a], fx) =>
    l.asd.apiCompare(l.proto.buildFromProto(b, { imports: "user" }).document, l.proto.buildFromProto(a, { imports: "user" }).document, { compatibility: "FILE", ...(fx?.compareOptions || {}) }),
  normalize: protoNormalize,
  level: "FILE",
  grpc: true,
}
// the build alone (no comparison): what the end-to-end row pays before comparing
const protoBuild = {
  id: "protoapi-build",
  family: "floor",
  label: "protoapi buildFromProto of both trees (no comparison)",
  supports: protoOnly,
  format: () => "proto",
  setup: () => lib("conv-protoapi"),
  prepare: (_l, b, a) => [b, a],
  run: (l, [b, a]) => [l.buildFromProto(b, { imports: "user" }), l.buildFromProto(a, { imports: "user" })],
  normalize: () => [],
  floor: true,
  aux: false,
  grpc: true,
}

const all = [
  asd("asd-1.0.6", "asd-1.0.6", {
    label: "api-smart-diff 1.0.6",
    format: (fx) => (fx.family === "graphql" ? "gql-0.5.1" : "json"),
    supports: (fx) => (fx.spec === "aa3" ? "AsyncAPI 3 not supported (apiCompare would diff it as a JSON Schema)" : true),
  }),
  // GraphQL input: GraphApi 1.0 documents built with gqlapi 0.6.0
  asd("asd-2.0.0", "asd-2.0.0", { label: "api-smart-diff 2.0.0" }),
  fork("fork-4.0.1", FORK_OPTIONS, "qubership-apihub-api-diff 4.0.1"),
  openapiDiff,
  jsonSchemaDiff,
  asyncapiDiff,
  inspector,
  graphqlJs,
  ...floors,
  ...sdlRows,
  // option-sensitivity variants (timing only, selected fixtures)
  asd("asd-2.0.0-normalized", "asd-2.0.0", { label: "api-smart-diff 2.0.0, merged: \"normalized\"", options: { merged: "normalized" }, aux: true }),
  { ...fork("fork-4.0.1-plain", {}, "fork 4.0.1, only beforeSource/afterSource"), aux: true },
  { ...fork("fork-4.0.1-normalized", { ...FORK_OPTIONS, normalizedResult: true }, "fork 4.0.1, normalizedResult: true (no denormalize pass)"), aux: true },
]
for (const a of all) if (a.aux === undefined) a.aux = false
all.push(...protoRows, protoE2e, protoBuild)
// the other in-process tools have no ProtoApi support (api-smart-diff 1.0.6 would compare a ProtoApi document as a
// JSON Schema, and the plain asd-2.0.0 row is replaced by the per-level rows); the structural floors diff the ProtoApi
// documents
for (const a of all) {
  if (a.grpc || a.family === "floor") continue
  const supports = a.supports
  a.supports = (fx) => (fx.family === "protoapi" ? "no ProtoApi support" : supports(fx))
}

const get = (id) => {
  const a = all.find((x) => x.id === id)
  if (!a) throw new Error(`unknown adapter ${id}`)
  return a
}

module.exports = { all, get, FORK_OPTIONS, locTokens, hay, prim }
