"use strict"
// Fixture registry. `generate()` builds the raw pair; scripts/fixtures.js writes it into fixtures/cache/<name>/ in
// every input format the variants need (JSON documents, or for GraphQL the SDL plus three GraphApi encodings) together
// with expected.json. Workers only read the cache (JSON.parse once per process, structuredClone per call outside the
// timed region), so fixture generation and format conversion are never timed.
const fs = require("node:fs")
const path = require("node:path")
const P = require("../scripts/paths")

const all = [
  ...require("./openapi").fixtures,
  ...require("./asyncapi").fixtures,
  ...require("./jsonschema").fixtures,
  ...require("./graphql").fixtures,
  ...require("./grpc").fixtures,
]

// gql-0.5.1 = GraphApi 0.1.2 (gqlapi 0.5.1, input of 1.0.6), gql-1.0 = GraphApi 1.0 (gqlapi 0.6.0, input of 2.0.0),
// gql-fork = the fork's graphapi format
const GRAPHQL_FORMATS = ["sdl", "gql-0.5.1", "gql-1.0", "gql-fork"]
// ProtoApi (type grpc): the `.proto` source tree (a directory, for buf and the end-to-end row) and the document built
// from it with protoapi
const PROTO_FORMATS = ["proto", "protoapi"]
const formatsOf = (f) => (f.family === "graphql" ? GRAPHQL_FORMATS : f.family === "protoapi" ? PROTO_FORMATS : ["json"])
// `proto` is a directory {before,after}.proto.d/ with the source tree, a buf.yaml and the bundled imports buf needs
const ext = (format) => (format === "sdl" ? "graphql" : format === "proto" ? "d" : "json")
const cacheDir = () => P.CACHE
const file = (name, side, format) => path.join(cacheDir(name), name, `${side}.${format}.${ext(format)}`)

// the files of a source tree written by scripts/fixtures.js (import path -> text), without buf.yaml and the bundled
// imports added for buf (listed in sources.json)
const readProto = (dir) => {
  const list = JSON.parse(fs.readFileSync(path.join(dir, "..", `${path.basename(dir).split(".")[0]}.sources.json`), "utf8"))
  return Object.fromEntries(list.map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]))
}

const get = (name) => {
  const f = all.find((x) => x.name === name)
  if (!f) throw new Error(`unknown fixture ${name}`)
  return f
}

const readInput = (name, side, format) => {
  if (format === "proto") return readProto(file(name, side, format))
  const raw = fs.readFileSync(file(name, side, format), "utf8")
  return format === "sdl" ? raw : JSON.parse(raw)
}
const readExpected = (name) => {
  const f = path.join(cacheDir(name), name, "expected.json")
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : undefined
}
const readMeta = (name) => JSON.parse(fs.readFileSync(path.join(cacheDir(name), name, "meta.json"), "utf8"))

module.exports = { all, get, formatsOf, file, readInput, readExpected, readMeta, GRAPHQL_FORMATS, PROTO_FORMATS }
