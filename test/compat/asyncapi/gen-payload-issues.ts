// Regenerates payload-schemas.issues.ts from a measurement of the current build: vpx test/compat/asyncapi/gen-payload-issues.ts
process.env.ASD_COMPAT_COLLECT = "1"
import fs from "node:fs"
const { evaluateVariant, variantsOf } = await import("../../helpers/compat")
const { aaCases, schemaCases } = await import("./payload-schemas.test")
const tagOf = (tag: any, dir: string) =>
  tag === undefined ? undefined : typeof tag === "string" ? tag : (tag[dir] ?? tag["*"])
const orig = new Map(schemaCases.map((c: any) => [c.id, c]))
const out: Record<string, Record<string, string>> = {}
const unknown: string[] = []
for (const c of aaCases()) {
  const vs = variantsOf({ ...c, issue: undefined }, "asyncapi", "payload")
  const ok: Record<string, boolean> = {}
  for (const v of vs) {
    const e = evaluateVariant(v)
    ok[v.name] = e.detected && e.classified && e.annotated
  }
  const base = orig.get(c.id.replace(/-AA$/, "")) as any
  for (const v of vs) {
    if (ok[v.name] || v.policy) continue
    const dir = v.direction as string
    const twin = v.name.startsWith("aa3") ? (dir === "request" ? "aa2-pub" : "aa2-sub") : undefined
    let tag: string | undefined
    if (twin && ok[twin]) tag = "ISSUE-52"
    else
      tag = tagOf(base.issue, dir) ?? (twin ? tagOf(base.issue, dir === "request" ? "response" : "request") : undefined)
    if (!tag) {
      unknown.push(v.id)
      continue
    }
    out[base.id] = { ...out[base.id], [v.name]: tag }
  }
}
const lines = Object.entries(out).map(([id, t]) => `  "${id}": ${JSON.stringify(t)},`)
fs.writeFileSync(
  `${import.meta.dirname}/payload-schemas.issues.ts`,
  `import type { Placement } from "../../helpers/compat"\n\n// Generated from a measurement on 2.0.0 (vpx test/compat/asyncapi/gen-payload-issues.ts): failing AsyncAPI payload variants of\n// the JSON Schema cases and their root cause. ISSUE-52 where the 2.6 variant of the same direction passes.\nexport const aaIssues: Record<string, Partial<Record<Placement, string>>> = {\n${lines.join("\n")}\n}\n`,
)
console.log("tagged", Object.keys(out).length, "unknown", unknown)
