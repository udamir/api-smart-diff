"use strict"
// Worker of scripts/corpus.js: runs ONE in-process tool over a list of harvested-corpus variants and reports one JSON
// line per variant on stdout ({"phase":"start","i"} before the call, {"phase":"done","i",...} after it), so the parent
// can enforce the 60 s per-call timeout and resume after a hang or a crash with the next variant.
//   node scripts/corpus-worker.js --type <type> --tool <adapter id> --ids <json file with variant ids> --from <index>
// Inputs: the variant's own documents (JSON; for GraphQL the variant's GraphApi encoding for api-smart-diff 2.0.0 and
// the structural diffs), its SDL for graphql-inspector / graphql-js, and the SDL converted with the bench's converter
// bundles for api-smart-diff 1.0.6 (gqlapi 0.5.1) and the fork (fork graphapi). Outputs that depend only on the SDL
// are computed once per case and reused for both encodings.
const fs = require("node:fs")
const path = require("node:path")
const P = require("./paths")
const A = require("../adapters")
const { compactDiff } = require("../lib/corpus-score")

const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1]
const emit = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`)
const errorInfo = (e) => ({ name: e?.constructor ? e.constructor.name : "Error", message: String(e?.message ? e.message : e).split("\n")[0].slice(0, 300) })

const corpus = JSON.parse(fs.readFileSync(path.join(P.CACHE, "corpus", `${args.type}.json`), "utf8"))
const byId = new Map(corpus.variants.map((v) => [v.id, v]))
const ids = JSON.parse(fs.readFileSync(args.ids, "utf8"))
const adapter = A.get(args.tool)
const conv = {}
const converter = (id) => {
  if (!conv[id]) conv[id] = require(path.join(P.BUILD, id, "index.cjs"))
  return conv[id]
}
const CONVERT = {
  "gql-0.5.1": (sdl) => converter("conv-gqlapi-0.5.1").fromSDL(sdl),
  "gql-fork": (sdl) => converter("conv-fork-graphapi").fromSDL(sdl),
}
const memo = new Map()

const fixtureOf = (v) => ({ name: v.id, family: v.docFamily, spec: v.spec, kind: "changeset", compareOptions: v.options })
// input documents for a format; `shared` = the input does not depend on the variant's own encoding
const inputs = (v, format) => {
  if (format === "sdl") return { shared: true, b: v.sdl[0], a: v.sdl[1] }
  if (CONVERT[format]) return { shared: true, b: CONVERT[format](v.sdl[0]), a: CONVERT[format](v.sdl[1]) }
  return { shared: false, b: v.before, a: v.after }
}

const main = async () => {
  const lib = adapter.setup()
  for (let i = Number(args.from || 0); i < ids.length; i++) {
    const v = byId.get(ids[i])
    emit({ phase: "start", i })
    const fx = fixtureOf(v)
    const format = adapter.format(fx)
    const out = { phase: "done", i, id: v.id }
    try {
      const key = v.kind === "graphql" && format !== "gql-0.6.0" && format !== "gql-1.0" ? `${v.caseId}|${format}` : null
      let hit = key && memo.get(key)
      if (!hit) {
        const inp = inputs(v, format)
        const input = adapter.prepare(lib, inp.b, inp.a, fx)
        const t0 = process.hrtime.bigint()
        let raw = adapter.run(lib, input, fx)
        if (raw && typeof raw.then === "function") raw = await raw
        hit = { ms: Number(process.hrtime.bigint() - t0) / 1e6, raw }
        if (key) memo.set(key, hit)
      } else out.reused = true
      Object.assign(out, { status: "ok", ms: hit.ms, diffs: adapter.normalize(hit.raw, fx) })
      // api-smart-diff: the fields the strict attribution needs, so that a rescore against a newer export of the case
      // tables recomputes it (p path, a action, t type, d description, f boolean before / after)
      if (adapter.family === "asd") out.adiffs = hit.raw.diffs.map(compactDiff)
    } catch (e) {
      Object.assign(out, { status: "error", error: errorInfo(e) })
    }
    emit(out)
  }
  emit({ phase: "end" })
}

main().catch((e) => {
  emit({ phase: "fatal", error: errorInfo(e) })
  process.exit(1)
})
