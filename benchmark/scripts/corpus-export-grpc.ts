// Corpus export of the type `grpc`: the variants of the compat family `protoapi` (case kind `proto`,
// test/compat/protoapi/*.test.ts of the repository) with their ProtoApi documents, their
// `.proto` source trees (with the harness file of the `use` variants, for buf) and the expectations, exactly as
// test/compat/report.ts collects them (ASD_COMPAT_COLLECT=1, the repository's own helpers and protoapi build). Writes
// fixtures/cache/corpus/grpc.json in the format of scripts/corpus-export.ts. The repository is only read.
// Run with the repository's TypeScript runner (scripts/corpus.js does it when the export is missing or stale):
//   pnpm --dir .. exec vpx scripts/corpus-export-grpc.ts
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

process.env.ASD_COMPAT_COLLECT = "1"

const P = createRequire(import.meta.filename)("./paths.js")
const compatDir = path.join(P.ASD_ROOT, "test", "compat", "protoapi")
const outDir = path.join(P.CACHE, "corpus")

const git = (args: string[]) => {
  try {
    return execFileSync("git", args, { cwd: P.ASD_ROOT, encoding: "utf8" }).trim()
  } catch {
    return "n/a"
  }
}
const serializeMention = (m: string | RegExp) => (typeof m === "string" ? m : { re: m.source, flags: m.flags })
const list = <T>(x: T | T[] | undefined) => (x === undefined ? undefined : Array.isArray(x) ? x : [x])

const main = async () => {
  const helpers = path.join(P.ASD_ROOT, "test", "helpers", "compat.ts")
  const { collected, expectedType, protoSources } = await import(helpers)
  const files = fs
    .readdirSync(compatDir)
    .filter((f) => f.endsWith(".test.ts") && fs.readFileSync(path.join(compatDir, f), "utf8").includes("runCases("))
    .sort()
    .map((f) => path.join(compatDir, f))
  for (const file of files) {
    const before = collected.length
    await import(file)
    for (let i = before; i < collected.length; i++) collected[i].file = path.relative(P.ASD_ROOT, file)
  }
  const variants: any[] = []
  for (const group of collected) {
    if (group.family !== "protoapi") continue
    const caseOf = new Map(group.cases.map((c: any) => [c.id, c]))
    for (const v of group.variants) {
      const c: any = caseOf.get(v.caseId)
      variants.push({
        id: v.id,
        caseId: v.caseId,
        name: v.name,
        family: group.family,
        area: v.area,
        file: group.file,
        kind: c.kind,
        title: c.title,
        docFamily: "protoapi",
        spec: "proto",
        level: v.level,
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
        ...(v.proto?.buildProblems?.length ? { buildProblems: v.proto.buildProblems } : {}),
        sources: (c.sources ?? []).map((s: any) => ({ tool: s.tool, ...(s.ref ? { ref: s.ref } : {}), ...(s.verdict ? { verdict: s.verdict } : {}) })),
        before: v.before,
        after: v.after,
        // the `.proto` trees of both sides (harness file included), for buf
        proto: [protoSources(c.proto[0], c.use, v.direction), protoSources(c.proto[1], c.use, v.direction)],
      })
    }
  }
  fs.mkdirSync(outDir, { recursive: true })
  const head = {
    exportedAt: new Date().toISOString(),
    source: path.relative(P.BENCH, compatDir),
    git: {
      commit: git(["rev-parse", "--short", "HEAD"]),
      branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
      dirtyCompatFiles: git(["status", "--porcelain", "--", "test/compat", "test/helpers"]).split("\n").filter(Boolean).length,
    },
    files: files.length,
    type: "grpc",
    cases: new Set(variants.map((v) => v.caseId)).size,
    variants: variants.length,
  }
  const file = path.join(outDir, "grpc.json")
  fs.writeFileSync(file, `{"head":${JSON.stringify(head)},"variants":[\n${variants.map((v) => JSON.stringify(v)).join(",\n")}\n]}\n`)
  console.log(`grpc      ${String(head.cases).padStart(5)} cases ${String(variants.length).padStart(5)} variants -> ${path.relative(P.BENCH, file)} (${head.git.branch} ${head.git.commit}, ${head.git.dirtyCompatFiles} uncommitted compat files)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
