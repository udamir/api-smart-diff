"use strict"
// Generates fixtures/cache/<name>/{before,after}.<format>.<ext>, expected.json and meta.json for every fixture
// (or `--only a,b`). GraphQL SDL is converted with the converter bundles from scripts/build.js. ProtoApi (type grpc):
// the source tree goes to {before,after}.proto.d/ (+ buf.yaml and the bundled imports buf cannot resolve itself, the
// list of the tree's own files in {before,after}.sources.json) and the document built with the conv-protoapi bundle
// (`imports: "user"`) to {before,after}.protoapi.json; a fatal build issue fails the fixture.
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const F = require("../fixtures")

const conv = (id) => require(path.join(P.BUILD, id, "index.cjs"))
const converters = () => ({
  "gql-0.5.1": (sdl) => conv("conv-gqlapi-0.5.1").fromSDL(sdl),
  "gql-1.0": (sdl) => conv("conv-gqlapi-0.6.0").fromSDL(sdl),
  "gql-fork": (sdl) => conv("conv-fork-graphapi").fromSDL(sdl),
})

// ProtoApi documents and buf module directories
let protoapi
const proto = () => (protoapi = protoapi || conv("conv-protoapi"))
const FATAL = new Set(["syntax", "missing-import", "unresolved-type"])
const buildProto = (sources) => {
  const r = proto().buildFromProto(sources, { imports: "user" })
  const fatal = r.issues.filter((i) => FATAL.has(i.code))
  if (fatal.length) throw new Error(`ProtoApi build: ${fatal.map((i) => `${i.code}: ${i.message}`).join("; ")}`)
  return r.document
}
// the bundled files a source tree imports (transitively), except google/protobuf/*, which buf provides itself
const bufImports = (sources) => {
  const bundle = proto().bundledFiles
  const out = {}
  const queue = Object.values(sources)
  while (queue.length) {
    for (const m of queue.pop().matchAll(/^\s*import\s+(?:public\s+|weak\s+)?"([^"]+)"\s*;/gm)) {
      const f = m[1]
      if (sources[f] || out[f] || f.startsWith("google/protobuf/") || !bundle[f]) continue
      out[f] = bundle[f]
      queue.push(bundle[f])
    }
  }
  return out
}
const writeProtoTree = (dir, sources) => {
  fs.rmSync(dir, { recursive: true, force: true })
  const all = { ...sources, ...bufImports(sources) }
  for (const [f, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true })
    fs.writeFileSync(path.join(dir, f), text)
  }
  fs.writeFileSync(path.join(dir, "buf.yaml"), "version: v2\n")
  return Object.values(sources).reduce((n, t) => n + Buffer.byteLength(t), 0)
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null
const C = converters()
for (const f of F.all) {
  if (only && !only.includes(f.name)) continue
  const t0 = Date.now()
  const g = f.generate()
  const dir = path.join(P.CACHE, f.name)
  fs.mkdirSync(dir, { recursive: true })
  const meta = { name: f.name, family: f.family, spec: f.spec, kind: f.kind, desc: f.desc, group: f.group, size: f.size, formats: {} }
  for (const format of F.formatsOf(f)) {
    for (const side of ["before", "after"]) {
      let text
      if (format === "proto") {
        const bytes = writeProtoTree(F.file(f.name, side, format), g.sources[side])
        fs.writeFileSync(path.join(dir, `${side}.sources.json`), JSON.stringify(Object.keys(g.sources[side])))
        meta.formats[format] = meta.formats[format] || {}
        meta.formats[format][`${side}Bytes`] = bytes
        continue
      }
      if (format === "protoapi") text = JSON.stringify(buildProto(g.sources[side]))
      else if (format === "json") text = JSON.stringify(g[side])
      else if (format === "sdl") text = side === "before" ? g.sdlBefore : g.sdlAfter
      else text = JSON.stringify(C[format](side === "before" ? g.sdlBefore : g.sdlAfter))
      fs.writeFileSync(F.file(f.name, side, format), text)
      meta.formats[format] = meta.formats[format] || {}
      meta.formats[format][`${side}Bytes`] = Buffer.byteLength(text)
    }
  }
  if (g.expected) fs.writeFileSync(path.join(dir, "expected.json"), JSON.stringify(g.expected, null, 1))
  meta.expectedChanges = g.expected ? g.expected.length : f.kind === "identical" ? 0 : undefined
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 1))
  const fmt = Object.entries(meta.formats).map(([k, v]) => `${k} ${(v.beforeBytes / 1024).toFixed(0)}/${(v.afterBytes / 1024).toFixed(0)} KB`).join(", ")
  console.log(`${f.name.padEnd(24)} ${String(meta.expectedChanges ?? "-").padStart(4)} changes  ${fmt}  (${Date.now() - t0} ms)`)
}
