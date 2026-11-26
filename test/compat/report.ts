// Runs every compat case outside the test runner and reports detection / classification / annotation separately.
//
//   vpx test/compat/report.ts                 # summary per family, untagged failures and stale tags
//   vpx test/compat/report.ts -v openapi/par  # also print the problems of failing variants (filter on file or id)
//   vpx test/compat/report.ts --write         # regenerate test/compat/cases.json (+ cases/<family>.json) and temp/CASES.md (internal, gitignored)
//   vpx test/compat/report.ts --coverage      # only the coverage checklists (no variant is evaluated); -v lists the gaps
//
// Not a test file (no `.test.ts` suffix); the case files register their tables through `runCases`, which only
// collects them while ASD_COMPAT_COLLECT is set.

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

process.env.ASD_COMPAT_COLLECT = "1"

const args = process.argv.slice(2)
const verbose = args.includes("-v")
const write = args.includes("--write")
const coverageOnly = args.includes("--coverage")
const filter = args.find((a) => !a.startsWith("-"))

const root = path.join(import.meta.dirname, "..", "..")
const compatDir = import.meta.dirname

const findTests = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findTests(full)
    // only case tables (files calling runCases); plain test files call describe at module level
    return entry.name.endsWith(".test.ts") && fs.readFileSync(full, "utf8").includes("runCases(") ? [full] : []
  })

const main = async () => {
  const { collected, evaluateVariant, expectedType } = await import("../helpers/compat")
  const files = findTests(compatDir).sort()
  for (const file of files) {
    const before = collected.length
    await import(file)
    for (let i = before; i < collected.length; i++) collected[i].file = path.relative(root, file)
  }

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—")

  // ---- coverage checklists ------------------------------------------------------------------------------------
  // A checklist is a file in test/compat/coverage listing the ids of another tool (rule ids, change types, table rows,
  // test ids). A row is covered when a case lists `<key>:<id>` in `covers`, when the row itself lists existing case ids
  // in `cases`, or (for @asyncapi/diff) when a case cites the row in `sources` (`src/standards/v2.ts <pattern>`); it is
  // not applicable when a `not-applicable.*.json` file gives a reason for `<key>:<id>`.
  const coverageDir = path.join(compatDir, "coverage")
  const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(coverageDir, file), "utf8"))
  const checklists = [
    { key: "oasdiff", file: "oasdiff-rules.json", title: "oasdiff rule ids (`checker/rules.go`)" },
    {
      key: "gi",
      file: "graphql-inspector-change-types.json",
      title: "graphql-inspector ChangeTypes (`packages/core/src/diff/changes/change.ts`)",
    },
    {
      key: "gjs",
      file: "graphql-js-change-types.json",
      title:
        "graphql-js BreakingChangeType / DangerousChangeType / SafeChangeType (`src/utilities/findSchemaChanges.ts`)",
    },
    {
      key: "aad",
      file: "asyncapi-diff-standard.json",
      title: "@asyncapi/diff standard classification (`src/standards/v2.ts`, `v3.ts`)",
    },
    {
      key: "laa",
      file: "libasyncapi-breaking-rules.json",
      title: "pb33f libasyncapi breaking rules (`what-changed/model/breaking_rules.go`)",
    },
    {
      key: "lo",
      file: "libopenapi-breaking-rules.json",
      title: "pb33f libopenapi breaking rules (`what-changed/model/breaking_rules.go`)",
    },
    {
      key: "oatd",
      file: "openapitools-change-kinds.json",
      title: "OpenAPITools openapi-diff change kinds (`BackwardIncompatibleProp`)",
    },
    {
      key: "aod",
      file: "atlassian-openapi-diff-change-kinds.json",
      title: "Atlassian openapi-diff change kinds (`DiffResultCode` x action)",
    },
    { key: "jsd", file: "json-schema-diff-tests.json", title: "Atlassian json-schema-diff test cases (`test/unit`)" },
    { key: "optic", file: "optic-breaking-changes-tests.json", title: "Optic breaking-changes ruleset tests" },
    { key: "fork", file: "fork-tests.json", title: "Netcracker fork tests (`qubership-apihub-api-diff/test`)" },
    {
      key: "suites",
      file: "compat-suites-cases.json",
      title: "Netcracker compatibility-suite case ids (`qubership-apihub-compatibility-suites`, DDL excluded)",
    },
    {
      key: "buf",
      file: "buf-breaking-rules.json",
      title:
        "buf v1.75 breaking rules (`private/bufpkg/bufcheck`: the 65 rules of the v2 config and the four ids of the v1 config only)",
    },
  ].filter((c) => fs.existsSync(path.join(coverageDir, c.file)))
  const notApplicable: Record<string, string> = {}
  for (const file of fs.readdirSync(coverageDir).filter((f) => f.startsWith("not-applicable"))) {
    Object.assign(notApplicable, readJson(file))
  }
  const caseIds = new Set(collected.flatMap((g) => g.cases.map((c) => c.id)))
  const covered = new Map<string, string[]>()
  const addCover = (key: string, id: string) => {
    const list = covered.get(key) ?? []
    if (!list.includes(id)) list.push(id)
    covered.set(key, list)
  }
  for (const group of collected) {
    for (const c of group.cases) {
      for (const cover of c.covers ?? []) addCover(cover, c.id)
      for (const s of c.sources) {
        const m = s.tool === "asyncapi-diff" ? s.ref.match(/^src\/standards\/(v[23])\.ts (\/\S*)/) : null
        if (m) addCover(`aad:${m[1]}:${m[2]}`, c.id)
      }
    }
  }
  const coverageProblems: string[] = []
  const coverage = (key: string, file: string) => {
    const list: { id?: string; type?: string; cases?: string[] }[] = readJson(file)
    const rows = list.map((row) => {
      const id = String(row.id ?? row.type)
      const ck = `${key}:${id}`
      for (const caseId of row.cases ?? []) {
        if (caseIds.has(caseId)) addCover(ck, caseId)
        else coverageProblems.push(`${file}: ${id} lists unknown case ${caseId}`)
      }
      return { id, cases: covered.get(ck), na: notApplicable[ck] }
    })
    return {
      total: rows.length,
      covered: rows.filter((r) => r.cases).length,
      na: rows.filter((r) => !r.cases && r.na).length,
      rows,
      ids: new Set(rows.map((r) => r.id)),
    }
  }
  const covs = checklists.map((c) => ({ ...c, cov: coverage(c.key, c.file) }))
  const known = new Map(covs.map((c) => [c.key, c.cov.ids]))
  for (const [cover, cases] of covered) {
    const [key, ...rest] = cover.split(":")
    const ids = known.get(key)
    // @asyncapi/diff refs are derived from every cited pattern, not only the rows of the table
    if (key === "aad") continue
    if (!ids) coverageProblems.push(`unknown checklist in covers ${cover} (${cases.join(", ")})`)
    else if (!ids.has(rest.join(":"))) coverageProblems.push(`unknown id in covers ${cover} (${cases.join(", ")})`)
  }
  const printCoverage = () => {
    console.log("\n| Checklist | Rows | Covered | Not applicable | Not covered | Covered or n/a |")
    console.log("| --- | --- | --- | --- | --- | --- |")
    for (const { key, cov } of covs) {
      const missing = cov.total - cov.covered - cov.na
      console.log(
        `| ${key} | ${cov.total} | ${cov.covered} (${pct(cov.covered, cov.total)}) | ${cov.na} | ${missing} | ${pct(cov.covered + cov.na, cov.total)} |`,
      )
    }
    for (const { key, cov } of covs) {
      const gaps = cov.rows.filter((r) => !r.cases && !r.na)
      if (gaps.length && verbose) console.log(`\nNOT COVERED ${key}: ${gaps.map((r) => r.id).join(", ")}`)
    }
    if (coverageProblems.length) {
      console.log(`\nCOVERAGE PROBLEMS: ${coverageProblems.length}\n- ${coverageProblems.join("\n- ")}`)
    }
  }
  if (coverageOnly) {
    printCoverage()
    return
  }

  type Row = {
    id: string
    detected: boolean
    classified: boolean
    annotated: boolean
    problems: string[]
    issue?: string
    policy?: string
  }
  const results = new Map<string, Row>()
  const families = new Map<
    string,
    { variants: number; d: number; c: number; a: number; all: number; cases: Set<string> }
  >()
  const untagged: Row[] = []
  const stale: Row[] = []

  for (const group of collected) {
    for (const v of group.variants) {
      const ev = evaluateVariant(v)
      const row: Row = { id: v.id, ...ev, issue: v.issue, policy: v.policy }
      results.set(v.id, row)
      const f = families.get(group.family) ?? { variants: 0, d: 0, c: 0, a: 0, all: 0, cases: new Set<string>() }
      f.variants++
      f.cases.add(v.caseId)
      if (ev.detected) f.d++
      if (ev.classified) f.c++
      if (ev.annotated) f.a++
      const ok = ev.detected && ev.classified && ev.annotated
      if (ok) f.all++
      families.set(group.family, f)
      if (!ok && !v.issue && !v.policy) untagged.push(row)
      if (ok && v.issue) stale.push(row)
    }
  }

  console.log("| Family | Cases | Variants | Detected | Classified | Annotated | All three |")
  console.log("| --- | --- | --- | --- | --- | --- | --- |")
  for (const [name, f] of [...families].sort()) {
    console.log(
      `| ${name} | ${f.cases.size} | ${f.variants} | ${f.d} (${pct(f.d, f.variants)}) | ${f.c} (${pct(f.c, f.variants)}) | ${f.a} (${pct(f.a, f.variants)}) | ${f.all} (${pct(f.all, f.variants)}) |`,
    )
  }
  const show = (rows: Row[], label: string) => {
    const shown = rows.filter(
      (r) =>
        !filter ||
        r.id.includes(filter) ||
        collected.some((g) => g.file.includes(filter) && g.variants.some((v) => v.id === r.id)),
    )
    if (!shown.length) return
    console.log(`\n${label}: ${shown.length}`)
    for (const r of shown) {
      console.log(
        `- ${r.id} D${+r.detected} C${+r.classified} A${+r.annotated}${r.issue ? ` ${r.issue}` : ""}${r.policy ? ` ${r.policy}` : ""}`,
      )
      if (verbose) console.log(r.problems.map((p) => `    ${p.replace(/\n/g, "\n    ")}`).join("\n"))
    }
  }
  show(untagged, "FAILING WITHOUT ISSUE/POLICY TAG")
  show(stale, "PASSING BUT TAGGED WITH AN ISSUE (promote to it)")
  if (verbose && filter) {
    show(
      [...results.values()].filter((r) => (r.issue || r.policy) && !(r.detected && r.classified && r.annotated)),
      "TAGGED FAILURES",
    )
  }

  printCoverage()

  if (!write) return

  // ---- catalogue -------------------------------------------------------------------------------------------
  const caseRecords: unknown[] = []
  for (const group of collected) {
    for (const c of group.cases) {
      const variants = group.variants.filter((v) => v.caseId === c.id)
      caseRecords.push({
        id: c.id,
        family: group.family,
        area: c.area ?? group.area,
        file: group.file,
        kind: c.kind,
        title: c.title,
        before: c.before,
        after: c.after,
        rationale: c.rationale,
        annotation: c.annotation,
        sources: c.sources,
        covers: c.covers ?? [],
        policy: c.policy,
        options: c.options,
        issue: c.issue,
        variants: variants.map((v) => {
          const r = results.get(v.id) as Row
          return {
            name: v.name,
            ...(v.direction ? { direction: v.direction } : {}),
            expected: v.expect.map((e) => ({
              at: e.at,
              ...(e.action ? { action: e.action } : {}),
              type: expectedType(e, v),
              ...(e.optional ? { optional: true } : {}),
            })),
            ...(v.issue ? { issue: v.issue } : {}),
            ...(v.policy ? { policy: v.policy } : {}),
            asd200: `${r.detected ? "D" : "-"}${r.classified ? "C" : "-"}${r.annotated ? "A" : "-"}`,
          }
        }),
      })
    }
  }

  // re-runs of a case in other placements (`<id>-AA`, test/compat/asyncapi/payload-schemas.test.ts) are variants of the
  // same scenario: fold them into the original row
  const byId = new Map((caseRecords as any[]).map((r) => [r.id, r]))
  for (const rec of [...(caseRecords as any[])]) {
    const base = rec.id.endsWith("-AA") ? byId.get(rec.id.slice(0, -3)) : undefined
    if (!base) continue
    base.variants.push(...rec.variants)
    base.rerun = rec.file
    caseRecords.splice(caseRecords.indexOf(rec), 1)
  }

  // machine-readable catalogue: an index (`cases.json`) plus one file per family (`cases/<family>.json`, each below the
  // 1 MiB limit of biome); expectations are stored once per case with the expected class per variant
  const letter: Record<string, string> = {
    breaking: "B",
    "non-breaking": "N",
    deprecated: "D",
    annotation: "A",
    unclassified: "U",
    risky: "R",
  }
  const compact = (rec: any) => {
    const expected = new Map<string, any>()
    for (const v of rec.variants) {
      for (const e of v.expected) {
        const key = JSON.stringify([e.at, e.action, e.optional])
        const item = expected.get(key) ?? { at: e.at, action: e.action, optional: e.optional, type: {} }
        item.type[v.name] = letter[e.type] ?? "?"
        expected.set(key, item)
      }
    }
    return {
      ...rec,
      expected: [...expected.values()],
      variants: rec.variants.map((v: any) => [v.name, v.asd200, v.issue ?? v.policy ?? ""].join(" ").trim()),
    }
  }
  const casesDir = path.join(compatDir, "cases")
  fs.mkdirSync(casesDir, { recursive: true })
  const familyFiles: Record<string, string> = {}
  for (const family of [...new Set((caseRecords as any[]).map((r) => r.family))].sort()) {
    const file = `cases/${family}.json`
    familyFiles[family] = file
    const records = (caseRecords as any[]).filter((r) => r.family === family).map(compact)
    fs.writeFileSync(path.join(compatDir, file), `[\n${records.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`)
  }
  fs.writeFileSync(
    path.join(compatDir, "cases.json"),
    `${JSON.stringify(
      {
        generated: "vpx test/compat/report.ts --write",
        format:
          "cases/<family>.json: one record per case; expected[].type maps variant -> B/N/R/D/A/U; variants[] = '<name> <D|-><C|-><A|-> [ISSUE-NN|POLICY-NN]' (2.0.0 detection / classification / annotation)",
        families: Object.fromEntries(
          [...families].map(([k, f]) => [
            k,
            {
              cases: f.cases.size,
              variants: f.variants,
              detected: f.d,
              classified: f.c,
              annotated: f.a,
              passing: f.all,
            },
          ]),
        ),
        files: familyFiles,
        coverage: Object.fromEntries(
          covs.map(({ key, file, cov }) => [
            key,
            { file: `coverage/${file}`, total: cov.total, covered: cov.covered, notApplicable: cov.na },
          ]),
        ),
      },
      null,
      1,
    )}\n`,
  )

  // ---- CASES.md -------------------------------------------------------------------------------------------------
  const esc = (s: unknown) =>
    String(s ?? "")
      .replace(/\|/g, "\\|")
      .replace(/\n/g, " ")
  const short: Record<string, string> = {
    breaking: "B",
    "non-breaking": "N",
    deprecated: "D",
    annotation: "A",
    unclassified: "U",
    risky: "R",
  }
  const out: string[] = []
  out.push("# api-smart-diff 2.0.0 — compatibility case catalogue")
  out.push("")
  out.push(
    "Generated by `vpx test/compat/report.ts --write` from the case tables in `test/compat/**` (machine-readable copy: `test/compat/cases.json` (index) and `test/compat/cases/<family>.json`); edit the case tables, not this file. Every row is a scenario harvested from another API diff tool or corpus, deduplicated and re-authored as the smallest before/after pair (no fixture is copied; provenance in the Sources column). Expected classification letters: B breaking, N non-breaking, R risky, D deprecated, A annotation, U unclassified; per variant (`request` / `response` = schema placed in a request body / 200 response, `param` / `header` = query parameter / response header schema, `aa2-pub` / `aa2-sub` / `aa3-receive` / `aa3-send` = AsyncAPI message payload, `0.1.2` / `1.0` = GraphApi encoding, `doc` = one document pair). The 2.0.0 column gives detection / classification / annotation per variant (✓ / ✗) and the status tag: `ISSUE-NN` = `it.fails` (known defect), `POLICY-NN` = `it.skip` (open policy question, the expectation encodes the proposed option); decided policies are recorded in `temp/DESIGN_PROPOSALS.md` §11 and their variants run as `it` / `it.fails`.",
  )
  out.push("")
  out.push("Policy and severity discussion: `temp/TASK_2.0.0_COMPLETENESS.md`. Issue entries: `temp/ANALYSIS.md`.")
  out.push("")
  out.push("## Summary on 2.0.0")
  out.push("")
  out.push("| Family | Cases | Variants | Detected | Classified | Annotated | All three |")
  out.push("| --- | --- | --- | --- | --- | --- | --- |")
  for (const [name, f] of [...families].sort()) {
    out.push(
      `| ${name} | ${f.cases.size} | ${f.variants} | ${f.d} (${pct(f.d, f.variants)}) | ${f.c} (${pct(f.c, f.variants)}) | ${f.a} (${pct(f.a, f.variants)}) | ${f.all} (${pct(f.all, f.variants)}) |`,
    )
  }
  out.push("")
  const byFamily = new Map<string, Map<string, any[]>>()
  for (const rec of caseRecords as any[]) {
    const areas = byFamily.get(rec.family) ?? new Map<string, any[]>()
    areas.set(rec.area, [...(areas.get(rec.area) ?? []), rec])
    byFamily.set(rec.family, areas)
  }
  // variant legend of a family whose variant names the general legend above does not cover
  const familyNotes: Record<string, string> = {
    protoapi:
      "ProtoApi cases (`kind: proto`, PROTOAPI_DESIGN §9.2) run once per compatibility level: variants `FILE` / `PACKAGE` / `WIRE_JSON` / `WIRE`, and `<level>.request` / `<level>.response` for a message used only as an rpc request or response (`harness.proto`). Every description of the family passes the R-D wording lint, and cases marked single have at most one record per element (R-1). The buf v1.75 oracle (`test/compat/protoapi/buf-oracle.ts`, X-ORACLE-002) checks the engine against `buf breaking` on buf's own test corpus.",
  }
  for (const [family, areas] of [...byFamily].sort()) {
    out.push(`## ${family}`)
    out.push("")
    if (familyNotes[family]) {
      out.push(familyNotes[family])
      out.push("")
    }
    for (const [area, recs] of [...areas].sort()) {
      out.push(`### ${family} / ${area}`)
      out.push("")
      out.push(
        "| Case | Scenario | Before → after | Expected | Rationale | Annotation must state | Sources (own verdict) | 2.0.0 (D C A) |",
      )
      out.push("| --- | --- | --- | --- | --- | --- | --- | --- |")
      for (const rec of recs) {
        const expected = rec.variants
          .map(
            (v: any) =>
              `${v.name}: ${v.expected.map((e: any) => `${short[e.type] ?? "?"}${e.optional ? "?" : ""}`).join("+")}`,
          )
          .join("; ")
        const sources = rec.sources
          .map((s: any) => `${s.tool} \`${s.ref}\`${s.verdict ? ` (${s.verdict})` : ""}`)
          .join("; ")
        const status = rec.variants
          .map((v: any) => {
            const r: string = v.asd200
            const marks = [...r].map((c) => (c === "-" ? "✗" : "✓")).join("")
            const tag = v.policy ?? v.issue
            return `${v.name} ${marks}${tag ? ` ${tag}` : ""}`
          })
          .join("; ")
        const policy = rec.policy ? ` **policy: open** (${(rec.options ?? []).join(" / ")})` : ""
        out.push(
          `| ${rec.id} | ${esc(rec.title)} | ${esc(rec.before)} → ${esc(rec.after)} | ${esc(expected)} | ${esc(rec.rationale)}${esc(policy)} | ${esc(rec.annotation)} | ${esc(sources)} | ${esc(status)} |`,
        )
      }
      out.push("")
    }
  }
  const covTable = (title: string, cov: (typeof covs)[number]["cov"]) => {
    out.push(`## Coverage checklist: ${title}`)
    out.push("")
    out.push(
      `${cov.covered} of ${cov.total} covered by at least one case (${pct(cov.covered, cov.total)}), ${cov.na} not applicable to ASD (${pct(cov.na, cov.total)}), ${cov.total - cov.covered - cov.na} not covered. Covered + not applicable: ${pct(cov.covered + cov.na, cov.total)}.`,
    )
    out.push("")
    out.push("| Id | Cases | Not applicable because |")
    out.push("| --- | --- | --- |")
    for (const r of cov.rows)
      out.push(`| ${r.id} | ${(r.cases ?? []).join(", ")} | ${esc(r.cases ? "" : (r.na ?? "**not covered**"))} |`)
    out.push("")
  }
  for (const { title, cov } of covs) covTable(title, cov)
  fs.mkdirSync(path.join(root, "temp"), { recursive: true })
  fs.writeFileSync(path.join(root, "temp", "CASES.md"), `${out.join("\n")}\n`)
  // the JSON files are written compact and formatted by the project formatter (Oxfmt), so `vp check` stays clean
  spawnSync(path.join(root, "node_modules", ".bin", "vp"), ["fmt", path.join(compatDir, "cases.json"), casesDir], {
    cwd: root,
  })
  console.log(`\nwrote test/compat/cases.json and temp/CASES.md (${caseRecords.length} cases)`)
  console.log(covs.map(({ key, cov }) => `${key} ${cov.covered}/${cov.total} covered, ${cov.na} n/a`).join("; "))
}

main()
