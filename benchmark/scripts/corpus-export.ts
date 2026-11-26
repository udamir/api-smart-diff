// Exports the harvested compatibility corpus of the repository (test/compat/**, the case tables behind
// test/compat/cases/*.json) with the materialized documents of every variant, so that the benchmark tools can be run
// on them. test/compat/cases/<family>.json only carries one-line before / after summaries; the documents exist only
// in the case tables, so this script collects them exactly as test/compat/report.ts does (ASD_COMPAT_COLLECT=1, the
// repository's own helpers, placements and GraphApi encodings) and writes, per API type of the benchmark:
//   fixtures/cache/corpus/<type>.json = { exportedAt, source, git, variants: [...] }
// Run with the repository's TypeScript runner (the case tables are TypeScript): `pnpm --dir .. exec vpx
// scripts/corpus-export.ts`; scripts/corpus.js runs it when the export is missing or older than any case table. The
// repository is only read.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

process.env.ASD_COMPAT_COLLECT = "1"

const P = createRequire(import.meta.filename)("./paths.js")
const TYPES = ["openapi", "graphql", "asyncapi"] as const
const compatDir = path.join(P.ASD_ROOT, "test", "compat")
const outDir = path.join(P.CACHE, "corpus")

const findTests = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findTests(full)
    return entry.name.endsWith(".test.ts") && fs.readFileSync(full, "utf8").includes("runCases(") ? [full] : []
  })

const git = (args: string[]) => {
  try {
    return execFileSync("git", args, { cwd: P.ASD_ROOT, encoding: "utf8" }).trim()
  } catch {
    return "n/a"
  }
}

// API type and fixture family (bench vocabulary, lib/types.js) of a variant, from its before document
const classify = (doc: any, kind: string) => {
  if (kind === "graphql") return { type: "graphql", docFamily: "graphql", spec: "gql" }
  if (doc && typeof doc === "object" && typeof doc.asyncapi === "string") {
    return { type: "asyncapi", docFamily: "asyncapi", spec: doc.asyncapi.startsWith("2") ? "aa2" : "aa3" }
  }
  if (doc && typeof doc === "object" && typeof doc.openapi === "string") {
    return { type: "openapi", docFamily: "openapi", spec: `oas${doc.openapi.slice(0, 3).replace(".", "")}` }
  }
  return { type: "openapi", docFamily: "jsonschema", spec: "jsonschema" }
}

const serializeMention = (m: string | RegExp) => (typeof m === "string" ? m : { re: m.source, flags: m.flags })
const list = <T>(x: T | T[] | undefined) => (x === undefined ? undefined : Array.isArray(x) ? x : [x])

const main = async () => {
  const { collected, expectedType } = await import(path.join(P.ASD_ROOT, "test", "helpers", "compat.ts"))
  const files = findTests(compatDir).sort()
  for (const file of files) {
    const before = collected.length
    await import(file)
    for (let i = before; i < collected.length; i++) collected[i].file = path.relative(P.ASD_ROOT, file)
  }
  const byType: Record<string, any[]> = { openapi: [], graphql: [], asyncapi: [] }
  const cases = new Set<string>()
  for (const group of collected) {
    const caseOf = new Map(group.cases.map((c: any) => [c.id, c]))
    for (const v of group.variants) {
      const c: any = caseOf.get(v.caseId)
      const t = classify(v.before, c.kind)
      cases.add(v.caseId)
      byType[t.type].push({
        id: v.id,
        caseId: v.caseId,
        name: v.name,
        // compat family of the case table (asyncapi-payload = the AsyncAPI payload re-run of the JSON Schema cases)
        family: group.family,
        area: v.area,
        file: group.file,
        kind: c.kind,
        title: c.title,
        docFamily: t.docFamily,
        spec: t.spec,
        ...(v.direction ? { direction: v.direction } : {}),
        prefix: v.prefix.map(String),
        mentions: v.mentions.map(serializeMention),
        expect: v.expect.map((e: any) => ({
          at: list(e.at),
          ...(e.action !== undefined ? { action: list(e.action) } : {}),
          type: expectedType(e, v) ?? null,
          ...(e.optional ? { optional: true } : {}),
          ...(e.mentions ? { mentions: e.mentions.map(serializeMention) } : {}),
        })),
        ...(v.options ? { options: v.options } : {}),
        ...(v.issue ? { issue: v.issue } : {}),
        ...(v.policy ? { policy: v.policy } : {}),
        // the source tools' own verdicts where they differ from ASD's expectation (WARN, DANGEROUS, risky, ...)
        sources: (c.sources ?? []).map((s: any) => ({ tool: s.tool, ...(s.verdict ? { verdict: s.verdict } : {}) })),
        before: v.before,
        after: v.after,
        ...(c.kind === "graphql" ? { sdl: c.sdl } : {}),
      })
    }
  }
  fs.mkdirSync(outDir, { recursive: true })
  const head = {
    exportedAt: new Date().toISOString(),
    source: path.relative(P.BENCH, compatDir),
    git: { commit: git(["rev-parse", "--short", "HEAD"]), branch: git(["rev-parse", "--abbrev-ref", "HEAD"]), dirtyCompatFiles: git(["status", "--porcelain", "--", "test/compat", "test/helpers"]).split("\n").filter(Boolean).length },
    files: files.length,
  }
  for (const type of TYPES) {
    const variants = byType[type]
    const file = path.join(outDir, `${type}.json`)
    // one variant per line keeps the file greppable
    fs.writeFileSync(file, `{"head":${JSON.stringify({ ...head, type, cases: new Set(variants.map((v) => v.caseId)).size, variants: variants.length })},"variants":[\n${variants.map((v) => JSON.stringify(v)).join(",\n")}\n]}\n`)
    console.log(`${type.padEnd(9)} ${String(new Set(variants.map((v) => v.caseId)).size).padStart(5)} cases ${String(variants.length).padStart(5)} variants -> ${path.relative(P.BENCH, file)}`)
  }
  console.log(`${cases.size} cases from ${files.length} case tables (${head.git.branch} ${head.git.commit}, ${head.git.dirtyCompatFiles} uncommitted compat files)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
