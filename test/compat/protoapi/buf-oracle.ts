// Checker of the buf oracle of the compat family `protoapi` (PROTOAPI_DESIGN §9.3; X-ORACLE-002). Needs protoapi only:
// the findings of buf v1.75.0 are checked in (test/compat/coverage/protoapi-buf-oracle.json, `gen-buf-oracle.ts`).
//
//   vpx test/compat/protoapi/buf-oracle.ts            # summary, unexplained rows and stale exceptions
//   vpx test/compat/protoapi/buf-oracle.ts -v [mod]   # also every finding with its verdict (filter on module or rule)
//   vpx test/compat/protoapi/buf-oracle.ts --json     # machine-readable check (test/compat/core/oracle.test.ts)
//
// Every module of the corpus is built on both sides with protoapi (`imports: "user"`) and compared at the four
// compatibility levels; each buf category is checked against the level of the same name (§5.4). A finding is
// - **agree**: a record of the finding's element (R-1 makes it unique) at a path of the rule's matrix row
//   (`buf-rules.ts`) with a class at least the rule's `min`;
// - **weaker**: such a record exists, with a lower class;
// - **missed**: no such record.
// The record of an element answers a finding of that element, of its parent (buf reports a deletion at the
// declaration that contained the deleted one; the deleted name is quoted in buf's message) or of a sibling named in the
// message (a oneof renamed under its member). Every breaking record of asd that answers no finding of the module ×
// category is **extra**. Accepted differences are listed with the decision that explains them in
// test/compat/coverage/protoapi-buf-oracle-exceptions.json, keyed `<RULE>@<CATEGORY>` (weaker, missed) or
// `extra:<path pattern>@<CATEGORY>`, optionally narrowed to one module by a third `@<module>` part; an exception that
// matches no row is stale.

import fs from "node:fs"

import {
  annotation,
  breaking,
  compareProtoApi,
  type Diff,
  type DiffType,
  deprecated,
  nonBreaking,
  risky,
  unclassified,
} from "../../../src"
import { diffElement, elementOf } from "../../../src/protoapi/protoapi.utils"
import { matchPath } from "../../helpers/compat"
import {
  BUF_CATEGORIES,
  type BufCategory,
  bufModules,
  buildModule,
  ORACLE_EXCEPTIONS_FILE,
  ORACLE_FILE,
  type OracleFile,
  type OracleFinding,
} from "./buf-corpus"
import { bufRules } from "./buf-rules"

type Doc = Record<string, any>
type Verdict = "agree" | "weaker" | "missed" | "extra"

export interface OracleRow {
  module: string
  category: BufCategory
  verdict: Verdict
  /** the rule of a finding, or the path pattern of an extra record */
  rule: string
  pointer: string
  message: string
  /** class of the best matching record (agree, weaker) or of the extra record */
  type?: DiffType
  record?: string
  /** exception keys that would accept the row, most specific first */
  keys: string[]
}

const severity: Record<DiffType, number> = {
  [breaking]: 5,
  [risky]: 4,
  [nonBreaking]: 3,
  [deprecated]: 2,
  [annotation]: 1,
  [unclassified]: 0,
}

const unescape = (segment: string) => segment.replace(/~1/g, "/").replace(/~0/g, "~")
const parsePointer = (pointer: string): string[] =>
  pointer === "#" ? [] : pointer.replace(/^#\//, "").split("/").map(unescape)
const escape = (segment: string) => segment.replace(/~/g, "~0").replace(/\//g, "~1")
const toPointer = (path: (string | number)[]) =>
  path.length ? `#/${path.map((s) => escape(String(s))).join("/")}` : "#"

/** The protobuf parent of an element: the declaration that contains it (a nested message's message, a file). */
const parentOf = (element: string, doc: Doc): string | undefined => {
  const [s0, s1, s2, s3] = parsePointer(element)
  if (s0 === "files") return "#"
  if (s0 === "services") {
    if (s2 === "methods") return toPointer(["services", s1])
    const file = doc.services?.[s1]?.file
    return file ? toPointer(["files", file]) : "#"
  }
  if (s0 !== "components") return undefined
  if (s3 !== undefined) return toPointer(["components", s1, s2])
  const declaration = doc.components?.[s1]?.[s2]
  const enclosing = s2.includes(".") ? s2.slice(0, s2.lastIndexOf(".")) : undefined
  if (enclosing && doc.components?.messages?.[enclosing]) return toPointer(["components", "messages", enclosing])
  return declaration?.file ? toPointer(["files", declaration.file]) : undefined
}

/** The declarations that contain an element, innermost first (the before document's nesting, else the after one's). */
const ancestorsOf = (element: string, context: { before: Doc; after: Doc }): string[] => {
  const list: string[] = []
  let current: string | undefined = element
  while (current && current !== "#") {
    current = parentOf(current, context.before) ?? parentOf(current, context.after)
    if (current) list.push(current)
  }
  return list
}

/**
 * The element of a field or enum value in the other document: the same number in the same declaration (R4); of an
 * extension: the same extendee and number (A3).
 */
const byNumber = (element: string, from: Doc, to: Doc): string | undefined => {
  const [s0, s1, s2, s3, s4] = parsePointer(element)
  if (s0 === "components" && s1 === "extensions" && s2 !== undefined && s3 === undefined) {
    const extension = from.components?.extensions?.[s2]
    if (!extension) return undefined
    const found = Object.entries<any>(to.components?.extensions ?? {}).find(
      ([, other]) => other?.number === extension.number && other?.extendee === extension.extendee,
    )
    return found ? toPointer(["components", "extensions", found[0]]) : undefined
  }
  if (s0 !== "components" || s4 === undefined || (s3 !== "properties" && s3 !== "values")) return undefined
  const number = from.components?.[s1]?.[s2]?.[s3]?.[s4]?.number
  if (number === undefined) return undefined
  const entries = Object.entries<any>(to.components?.[s1]?.[s2]?.[s3] ?? {})
  const found = entries.find(([, value]) => value?.number === number)
  return found ? toPointer([s0, s1, s2, s3, found[0]]) : undefined
}

interface Context {
  before: Doc
  after: Doc
}

/** Elements a record belongs to: its element (R-1) and, for a rename, the element under its new key. */
const elementsOf = (diff: Diff): string[] =>
  diff.action === "rename" ? [diffElement(diff), elementOf([...diff.path, diff.after as string])] : [diffElement(diff)]

/** Names a record stands for: the short and qualified names of its elements and the string values it changes. */
const namesOf = (diff: Diff, context: Context): Set<string> => {
  const names = new Set<string>()
  for (const element of elementsOf(diff)) {
    const segments = parsePointer(element)
    const last = segments[segments.length - 1]
    if (last === undefined) continue
    // buf names fields and enum values by number too
    for (const doc of [context.before, context.after]) {
      const number = segments.reduce<any>((node, key) => node?.[key], doc)?.number
      if (number !== undefined) names.add(String(number))
    }
    const parts = last.split(".")
    for (let i = 0; i < parts.length; i++) names.add(parts.slice(i).join("."))
  }
  // the old and new name of a rename, the oneof a field leaves or joins
  const named = diff.action === "rename" || diff.path[diff.path.length - 1] === "oneof"
  for (const value of [diff.before, diff.after]) {
    if (typeof value === "string" && named) names.add(value)
  }
  return names
}

const quoted = (message: string): string[] => [...message.matchAll(/"([^"]*)"/g)].map((m) => m[1])

/** A path pattern for an extra record: the names of declarations and the indexes of lists replaced by `*`. */
const NAMED = new Set([
  "files",
  "services",
  "methods",
  "messages",
  "enums",
  "extensions",
  "properties",
  "values",
  "oneofs",
  "imports",
  "importFlags",
  "additionalBindings",
  "extensionOptions",
  "extension_declarations",
])
export const pathPattern = (path: (string | number)[]): string =>
  path
    .map((segment, i) =>
      typeof segment === "number" || /^\d+$/.test(String(segment)) || (i > 0 && NAMED.has(String(path[i - 1])))
        ? "*"
        : escape(String(segment)),
    )
    .join("/")

const recordKey = (diff: Diff) =>
  `${diff.action} ${diff.path.join("/")}${diff.action === "rename" ? ` ${String(diff.before)}->${String(diff.after)}` : ""}`

/** Whether a record answers a finding (see the header). */
const answers = (diff: Diff, finding: OracleFinding, context: Context): boolean => {
  const mapping = bufRules[finding.rule]
  if (!mapping) return false
  const merged =
    mapping.merged?.at.some((pattern) => matchPath(pattern, diff.path)) &&
    mapping.merged.mentions.test(diff.description ?? "")
  if (!merged && !mapping.at.some((pattern) => matchPath(pattern, diff.path))) return false
  const own = finding.side === "after" ? context.after : context.before
  const other = finding.side === "after" ? context.before : context.after
  const findingElement = elementOf(parsePointer(finding.pointer))
  const targets = new Set([findingElement])
  const paired = byNumber(findingElement, own, other)
  if (paired) targets.add(paired)
  const elements = elementsOf(diff)
  if (elements.some((element) => targets.has(element))) return true
  const names = namesOf(diff, context)
  const named = quoted(finding.message).some((name) => names.has(name))
  const parents = elements.map((element) => parentOf(element, context.before) ?? parentOf(element, context.after))
  // a deletion (or an addition) reported at the declaration that contains it, or at the nearest one that still exists
  // (a message deleted with its enclosing message is reported at the file)
  const ancestors = elements.flatMap((element) => ancestorsOf(element, context))
  if (ancestors.some((ancestor) => targets.has(ancestor)) && (named || mapping.named === false)) return true
  // a change reported at a sibling: a oneof renamed or removed, reported at its member field
  const findingParent = parentOf(findingElement, own)
  return named && findingParent !== undefined && parents.includes(findingParent)
}

const readExceptions = (): Record<string, string> =>
  fs.existsSync(ORACLE_EXCEPTIONS_FILE) ? JSON.parse(fs.readFileSync(ORACLE_EXCEPTIONS_FILE, "utf8")) : {}

/** Runs the oracle over the corpus; returns every finding and extra record with its verdict. */
export const runOracle = (oracle: OracleFile = JSON.parse(fs.readFileSync(ORACLE_FILE, "utf8"))) => {
  const rows: OracleRow[] = []
  const problems: string[] = []
  const modules = bufModules()
  for (const module of Object.keys(oracle.modules)) {
    if (!modules.includes(module)) problems.push(`oracle module ${module} is not in the corpus`)
  }
  for (const module of modules) {
    const findingsOf = oracle.modules[module]
    if (!findingsOf) {
      problems.push(`module ${module} has no oracle entry (regenerate with gen-buf-oracle.ts)`)
      continue
    }
    const previous = buildModule("previous", module)
    const current = buildModule("current", module)
    for (const [side, build] of [
      ["previous", previous],
      ["current", current],
    ] as const) {
      const fatal = build.issues.filter((i) => ["syntax", "missing-import", "unresolved-type"].includes(i.code))
      if (fatal.length) problems.push(`${module} ${side}: ${fatal.map((i) => `${i.code}: ${i.message}`).join("; ")}`)
    }
    const context: Context = { before: previous.document as Doc, after: current.document as Doc }
    for (const category of BUF_CATEGORIES) {
      const { diffs } = compareProtoApi(previous.document, current.document, { compatibility: category })
      const answered = new Set<Diff>()
      for (const finding of findingsOf[category] ?? []) {
        const mapping = bufRules[finding.rule]
        if (!mapping) problems.push(`${module} ${category}: rule ${finding.rule} has no mapping in buf-rules.ts`)
        const matching = diffs.filter((diff) => answers(diff, finding, context))
        for (const diff of matching) answered.add(diff)
        const best = matching.reduce<Diff | undefined>(
          (a, b) => (a && severity[a.type] >= severity[b.type] ? a : b),
          undefined,
        )
        const verdict: Verdict = !best
          ? "missed"
          : severity[best.type] >= severity[mapping?.min ?? breaking]
            ? "agree"
            : "weaker"
        rows.push({
          module,
          category,
          verdict,
          rule: finding.rule,
          pointer: finding.pointer,
          message: finding.message,
          ...(best ? { type: best.type, record: recordKey(best) } : {}),
          keys: [
            `${finding.rule}@${category}@${module}`,
            `${finding.rule}@*@${module}`,
            `${finding.rule}@${category}`,
            `${finding.rule}@*`,
          ],
        })
      }
      for (const diff of diffs) {
        if (diff.type !== breaking || answered.has(diff)) continue
        const pattern = pathPattern(diff.path)
        rows.push({
          module,
          category,
          verdict: "extra",
          rule: pattern,
          pointer: toPointer(diff.path),
          message: diff.description ?? "",
          type: diff.type,
          record: recordKey(diff),
          keys: [
            `extra:${pattern}@${category}@${module}`,
            `extra:${pattern}@*@${module}`,
            `extra:${pattern}@${category}`,
            `extra:${pattern}@*`,
          ],
        })
      }
    }
  }
  return { rows, problems }
}

/** Rows that need an exception, the ones without one, and the exceptions that match no row. */
export const checkOracle = (rows: OracleRow[], exceptions = readExceptions()) => {
  const needs = rows.filter((row) => row.verdict !== "agree")
  const unexplained = needs.filter((row) => !row.keys.some((key) => exceptions[key]))
  const used = new Set(needs.flatMap((row) => row.keys.filter((key) => exceptions[key])))
  const stale = Object.keys(exceptions).filter((key) => !used.has(key))
  return { needs, unexplained, stale }
}

const summarize = (rows: OracleRow[]) => {
  const summary: Record<string, Record<Verdict, number>> = {}
  for (const row of rows) {
    summary[row.category] ??= { agree: 0, weaker: 0, missed: 0, extra: 0 }
    summary[row.category][row.verdict]++
  }
  return summary
}

const show = (row: OracleRow, exceptions: Record<string, string>) => {
  const key = row.keys.find((k) => exceptions[k])
  return `- ${row.verdict} ${row.module} ${row.category} ${row.rule} @ ${row.pointer}${row.record ? ` → ${row.type} ${row.record}` : ""} | ${row.message}${key ? `  [${key}: ${exceptions[key]}]` : ""}`
}

const main = () => {
  const args = process.argv.slice(2)
  const verbose = args.includes("-v")
  const filter = args.find((a) => !a.startsWith("-"))
  const { rows, problems } = runOracle()
  const exceptions = readExceptions()
  const { needs, unexplained, stale } = checkOracle(rows, exceptions)
  const summary = summarize(rows)
  if (args.includes("--json")) {
    console.log(
      JSON.stringify({
        summary,
        problems,
        accepted: needs.length - unexplained.length,
        unexplained: unexplained.map((r) => `${r.keys[2]} ${r.module} ${r.pointer} ${r.record ?? ""}`.trim()),
        stale,
      }),
    )
    return
  }
  console.log("| Category | Findings | Agree | Weaker | Missed | Extra (asd breaking, buf silent) |")
  console.log("| --- | --- | --- | --- | --- | --- |")
  for (const category of BUF_CATEGORIES) {
    const s = summary[category] ?? { agree: 0, weaker: 0, missed: 0, extra: 0 }
    console.log(
      `| ${category} | ${s.agree + s.weaker + s.missed} | ${s.agree} | ${s.weaker} | ${s.missed} | ${s.extra} |`,
    )
  }
  const shown = (row: OracleRow) => !filter || row.module.includes(filter) || row.rule.includes(filter)
  if (verbose) {
    console.log("\nROWS")
    for (const row of rows.filter(shown)) console.log(show(row, exceptions))
  }
  console.log(`\naccepted (listed in protoapi-buf-oracle-exceptions.json): ${needs.length - unexplained.length}`)
  if (unexplained.length) {
    console.log(`\nUNEXPLAINED: ${unexplained.length}`)
    for (const row of unexplained.filter(shown)) console.log(show(row, exceptions))
  }
  if (stale.length) console.log(`\nSTALE EXCEPTIONS: ${stale.join(", ")}`)
  if (problems.length) console.log(`\nPROBLEMS: ${problems.length}\n- ${problems.join("\n- ")}`)
}

if (process.argv[1] && import.meta.filename === fs.realpathSync(process.argv[1])) main()
