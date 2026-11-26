"use strict"
// Builds every in-process variant into build/<variant>/:
//   index.cjs       - CommonJS bundle used by the benchmark (node)
//   bundle.min.js   - minified IIFE bundle (browser platform) used only for the bundle-size table
// and records versions, commits and sizes in build/manifest.json. Nothing is written outside benchmark/.
//
// - asd-2.0.0: the api-smart-diff build of the repository (`pnpm build` in the root writes dist/; ASD_ROOT points at
//   another checkout). dist/index.cjs is bundled together with the json-crawl and allof-merge copies of that checkout,
//   so later rebuilds of the root do not change a running benchmark; the size row is the package's own browser build
//   dist/api-smart-diff.min.js. The id stays `asd-2.0.0` whatever the version in package.json is (the manifest records
//   it).
// - asd-1.0.6: the published npm package api-smart-diff@1.0.6 (npm alias `api-smart-diff-1.0.6`); its dist/index.cjs is
//   self-contained (allof-merge and json-crawl bundled), the size row is its dist/api-smart-diff.min.js
// - fork-4.0.1: @netcracker/qubership-apihub-api-diff from its source clone (sources/, `npm run fetch`); the three fork
//   packages it needs (api-unifier, json-crawl, graphapi) are aliased to their source clones and ddlapi to
//   stubs/ddlapi.js; public npm dependencies (fast-equals, flatted, object-hash) resolve from node_modules
// - converters used only to prepare fixtures (never timed, except in the end-to-end rows): gqlapi 0.5.1 (GraphApi
//   0.1.2, the input of 1.0.6), gqlapi 0.6.0 (GraphApi 1.0, the input of 2.0.0), the fork's graphapi (source),
//   protoapi (ProtoApi documents from .proto trees)
// - npm peers: size-only minified bundles
const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")
const { execFileSync } = require("node:child_process")
const esbuild = require("esbuild")
const P = require("./paths")

const FORK_ALIASES = {
  "@netcracker/qubership-apihub-api-unifier": path.join(P.UNIFIER, "src", "index.ts"),
  "@netcracker/qubership-apihub-json-crawl": path.join(P.FORK_JSON_CRAWL, "src", "index.ts"),
  "@netcracker/qubership-apihub-graphapi": path.join(P.FORK_GRAPHAPI, "src", "index.ts"),
  "@netcracker/qubership-apihub-ddlapi": path.join(P.BENCH, "stubs", "ddlapi.js"),
}

const git = (dir, args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
const gitInfo = (dir, scope = "src") => {
  try {
    return {
      commit: git(dir, ["rev-parse", "--short", "HEAD"]),
      branch: git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]),
      dirtySrcFiles: git(dir, ["status", "--porcelain", "--", scope]).split("\n").filter(Boolean).length,
    }
  } catch {
    return { commit: "n/a", branch: "n/a" }
  }
}
const pkgVersion = (dir) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version
  } catch {
    return "n/a"
  }
}
const NM = path.join(P.BENCH, "node_modules")
const npmVersion = (name) => pkgVersion(path.join(NM, name))
const fileSize = (file) => {
  const buf = fs.readFileSync(file)
  return { min: file, minBytes: buf.length, minGzipBytes: zlib.gzipSync(buf, { level: 9 }).length, minSource: "package build" }
}

// writes a tiny entry file into build/_entries (so that bare imports resolve from benchmark/node_modules)
const entryFile = (id, code) => {
  const dir = path.join(P.BUILD, "_entries")
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, `${id}.js`)
  fs.writeFileSync(f, code)
  return f
}
const req = (name) => JSON.stringify(path.join(NM, name))

const variants = [
  {
    id: "asd-1.0.6",
    label: "api-smart-diff 1.0.6 (published npm package)",
    entry: () => {
      if (!fs.existsSync(path.join(P.ASD_106, "dist", "index.cjs"))) throw new Error("node_modules/api-smart-diff-1.0.6 is missing: run npm install in benchmark/")
      return path.join(P.ASD_106, "dist", "index.cjs")
    },
    size: () => fileSize(path.join(P.ASD_106, "dist", "api-smart-diff.min.js")),
    meta: () => ({ version: pkgVersion(P.ASD_106), source: "npm api-smart-diff@1.0.6 (dist/index.cjs, dependencies bundled)" }),
  },
  {
    id: "asd-2.0.0",
    label: "api-smart-diff (repository build)",
    entry: () => {
      const f = path.join(P.ASD_DIST, "index.cjs")
      if (!fs.existsSync(f)) throw new Error(`${f} is missing: run \`pnpm install && pnpm build\` in ${P.ASD_ROOT} (or npm run build:asd)`)
      return f
    },
    size: () => fileSize(path.join(P.ASD_DIST, "api-smart-diff.min.js")),
    meta: () => ({
      version: pkgVersion(P.ASD_ROOT),
      source: `repository build (${path.relative(P.BENCH, P.ASD_DIST) || P.ASD_DIST})`,
      git: gitInfo(P.ASD_ROOT),
      deps: {
        "allof-merge": pkgVersion(path.join(P.ASD_ROOT, "node_modules", "allof-merge")),
        "json-crawl": pkgVersion(path.join(P.ASD_ROOT, "node_modules", "json-crawl")),
      },
    }),
  },
  {
    id: "fork-4.0.1",
    label: "@netcracker/qubership-apihub-api-diff 4.0.1 (built from source)",
    entry: () => {
      const f = path.join(P.FORK, "src", "index.ts")
      if (!fs.existsSync(f)) throw new Error(`${f} is missing: run npm run fetch`)
      return f
    },
    alias: FORK_ALIASES,
    // graphql is a peer dependency of the graphapi fork (only its SDL builder needs it, the diff engine does not)
    external: ["graphql", "graphql/*"],
    // object-hash (unifier) needs node:crypto on its main field; its browser field ships a self-contained build
    minPlatform: "browser",
    meta: () => ({
      version: pkgVersion(P.FORK),
      git: gitInfo(P.FORK),
      deps: {
        "@netcracker/qubership-apihub-api-unifier": `${pkgVersion(P.UNIFIER)} (source ${gitInfo(P.UNIFIER).commit})`,
        "@netcracker/qubership-apihub-json-crawl": `${pkgVersion(P.FORK_JSON_CRAWL)} (source ${gitInfo(P.FORK_JSON_CRAWL).commit})`,
        "@netcracker/qubership-apihub-graphapi": `${pkgVersion(P.FORK_GRAPHAPI)} (source ${gitInfo(P.FORK_GRAPHAPI).commit})`,
        "@netcracker/qubership-apihub-ddlapi": "stubbed (stubs/ddlapi.js)",
        "fast-equals": npmVersion("fast-equals"),
        "object-hash": npmVersion("object-hash"),
        flatted: npmVersion("flatted"),
      },
    }),
  },
  // ---- fixture converters (not timed, except in the end-to-end rows) ----
  {
    id: "conv-gqlapi-0.5.1",
    converter: true,
    entry: () => entryFile("conv-gqlapi-0.5.1", `const g = require(${req("graphql")});\nconst q = require(${req("gqlapi-0.5.1")});\nmodule.exports = { fromSDL: (sdl) => q.buildFromSchema(g.buildSchema(sdl, { noLocation: true })) }\n`),
    meta: () => ({ version: npmVersion("gqlapi-0.5.1"), format: "GraphApi 0.1.2", graphql: npmVersion("graphql") }),
  },
  {
    id: "conv-gqlapi-0.6.0",
    converter: true,
    entry: () => entryFile("conv-gqlapi-0.6.0", `const g = require(${req("graphql")});\nconst q = require(${req("gqlapi")});\nmodule.exports = { fromSDL: (sdl) => q.buildFromSchema(g.buildSchema(sdl, { noLocation: true })) }\n`),
    meta: () => ({ version: npmVersion("gqlapi"), format: "GraphApi 1.0", graphql: npmVersion("graphql") }),
  },
  // timed SDL front end of asd 2.0.0 (end-to-end GraphQL rows): gqlapi 0.6.0 with the graphql copy graphql-inspector
  // and graphql-js run on, so `buildSchema` is the same code for every tool
  {
    id: "sdl-gqlapi-0.6.0",
    converter: true,
    entry: () => entryFile("sdl-gqlapi-0.6.0", `const g = require(${req("graphql")});\nconst q = require(${req("gqlapi")});\nmodule.exports = { buildSchema: g.buildSchema, buildFromSchema: q.buildFromSchema, graphqlVersion: g.version }\n`),
    meta: () => ({ version: npmVersion("gqlapi"), graphql: npmVersion("graphql") }),
  },
  // ProtoApi documents from `.proto` sources (fixtures; timed in the end-to-end grpc row): the published protoapi
  {
    id: "conv-protoapi",
    converter: true,
    entry: () => entryFile("conv-protoapi", `const p = require(${req("protoapi")});\nmodule.exports = { buildFromProto: p.buildFromProto, bundledFiles: p.bundledFiles, locateDiff: p.locateDiff, version: ${JSON.stringify(npmVersion("protoapi"))} }\n`),
    meta: () => ({ version: npmVersion("protoapi"), source: "npm" }),
  },
  {
    id: "conv-fork-graphapi",
    converter: true,
    entry: () => entryFile("conv-fork-graphapi", `const g = require(${req("graphql")});\nconst q = require(${JSON.stringify(path.join(P.FORK_GRAPHAPI, "src", "index.ts"))});\nmodule.exports = { fromSDL: (sdl) => q.buildFromSchema(g.buildSchema(sdl, { noLocation: true })) }\n`),
    meta: () => ({ version: pkgVersion(P.FORK_GRAPHAPI), git: gitInfo(P.FORK_GRAPHAPI), graphql: npmVersion("graphql") }),
  },
  // ---- npm peers: size-only ----
  { id: "openapi-diff", npm: "openapi-diff", minPlatform: "node" },
  { id: "json-schema-diff", npm: "json-schema-diff", minPlatform: "node" },
  { id: "asyncapi-diff", npm: "@asyncapi/diff", minPlatform: "browser" },
  { id: "graphql-inspector-core", npm: "@graphql-inspector/core", minPlatform: "browser", external: ["graphql"] },
  // graphql-js findBreakingChanges / findDangerousChanges (the whole graphql package is the dependency)
  { id: "graphql-js", npm: "graphql", minPlatform: "neutral" },
  { id: "microdiff", npm: "microdiff", minPlatform: "neutral" },
  { id: "jsondiffpatch", npm: "jsondiffpatch", minPlatform: "browser" },
  { id: "deep-diff", npm: "deep-diff", minPlatform: "neutral" },
  { id: "fast-json-patch", npm: "fast-json-patch", minPlatform: "neutral" },
]

const minify = async (v, entry, outDir) => {
  const platform = v.minPlatform || "browser"
  const res = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    alias: v.alias,
    external: v.external || [],
    nodePaths: [NM],
    platform,
    mainFields: platform === "browser" ? ["browser", "module", "main"] : ["module", "main"],
    format: "iife",
    globalName: "Lib",
    minify: true,
    target: "es2020",
    outfile: path.join(outDir, "bundle.min.js"),
    metafile: true,
    logLevel: "silent",
    legalComments: "none",
  })
  const min = path.join(outDir, "bundle.min.js")
  const buf = fs.readFileSync(min)
  return { min, minBytes: buf.length, minGzipBytes: zlib.gzipSync(buf, { level: 9 }).length, minWarnings: res.warnings.length }
}

const build = async () => {
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null
  fs.mkdirSync(P.BUILD, { recursive: true })
  const manifestPath = path.join(P.BUILD, "manifest.json")
  const manifest = fs.existsSync(manifestPath) && only ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { variants: {} }
  Object.assign(manifest, { builtAt: new Date().toISOString(), node: process.version, esbuild: npmVersion("esbuild") })
  const rel = (f) => path.relative(P.BENCH, f)
  let failed = 0
  for (const v of variants) {
    if (only && !only.includes(v.id)) continue
    const outDir = path.join(P.BUILD, v.id)
    fs.mkdirSync(outDir, { recursive: true })
    let entry
    if (v.npm) {
      const ep = require.resolve(v.npm, { paths: [P.BENCH] })
      entry = { version: npmVersion(v.npm), source: "npm (benchmark/node_modules)", entry: rel(ep) }
      try {
        Object.assign(entry, await minify(v, ep, outDir))
      } catch (e) {
        entry.minError = String(e.message || e).split("\n")[0].slice(0, 200)
      }
    } else {
      try {
        const ep = v.entry()
        entry = { label: v.label, ...v.meta(), entry: rel(ep) }
        await esbuild.build({
          entryPoints: [ep],
          bundle: true,
          alias: v.alias,
          external: v.external || [],
          nodePaths: [NM],
          platform: "node",
          format: "cjs",
          target: "node20",
          outfile: path.join(outDir, "index.cjs"),
          logLevel: "silent",
          legalComments: "none",
        })
        entry.cjs = rel(path.join(outDir, "index.cjs"))
        if (v.size) Object.assign(entry, v.size())
        else if (!v.converter) Object.assign(entry, await minify(v, ep, outDir))
      } catch (e) {
        entry = { ...(entry || { label: v.label }), buildError: String(e.message || e).split("\n").slice(0, 6).join(" | ").slice(0, 800) }
        failed++
      }
    }
    if (entry.min) entry.min = rel(entry.min)
    manifest.variants[v.id] = entry
    console.log(
      `${v.id}: ${entry.buildError ? `FAILED ${entry.buildError}` : `${entry.cjs ? "cjs ok" : "size-only"}${entry.minBytes ? ` min ${entry.minBytes} B / gzip ${entry.minGzipBytes} B` : entry.minError ? ` min FAILED: ${entry.minError}` : ""}`}`,
    )
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  if (failed) process.exitCode = 1
}

build().catch((e) => {
  console.error(e)
  process.exit(1)
})
