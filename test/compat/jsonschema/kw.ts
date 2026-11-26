// Local builders for the JSON Schema keyword cases (test/compat/jsonschema/*.cases.ts). Not a test file and not a
// case file: it only shortens the case tables. A keyword scenario is usually written once and expanded into a
// "body" case (the keyword on the schema root, oasdiff `*-body-*` rules) and a "property" case (the keyword on the
// nested property `name`, oasdiff `*-property-*` rules). oasdiff checklist ids are derived from the stems of the
// scenario and kept only when the rule exists for the placement (request / response / query parameter / header).

import type { CaseSource, ExpectedChange, ExpectedType, Placement, SchemaCase, VariantTag } from "../../helpers/compat"
import oasdiffRules from "../coverage/oasdiff-rules.json"
import jsdTests from "../coverage/json-schema-diff-tests.json"
import checkers from "./oasdiff-checkers.json"

const ruleLevel = new Map((oasdiffRules as { id: string; level: string }[]).map((r) => [r.id, r.level]))
const ruleIds = new Set(ruleLevel.keys())
const checkerFile = checkers as Record<string, string>

export const hasRule = (id: string) => ruleIds.has(id)

/** type keyed by direction */
export const rr = (request: ExpectedType, response: ExpectedType) => ({ request, response })

/** an object schema with the single property `name` */
export const P = (schema: unknown, extra: Record<string, unknown> = {}) => ({
  type: "object",
  properties: { name: schema },
  ...extra,
})

export type Level = "body" | "property"

const prefixes: Record<Level, Partial<Record<Placement, string>>> = {
  body: {
    request: "request-body-",
    response: "response-body-",
    param: "request-parameter-",
    header: "response-header-",
  },
  property: {
    request: "request-property-",
    response: "response-property-",
    param: "request-parameter-property-",
  },
}

/** oasdiff ids of the stems that exist for a placement */
export const stemIds = (level: Level, placements: Placement[], stems: string[]) =>
  placements.flatMap((p) => {
    const prefix = prefixes[level][p]
    return prefix ? stems.map((s) => `oasdiff:${prefix}${s}`).filter((id) => hasRule(id.slice(8))) : []
  })

export interface KwExpect extends Omit<ExpectedChange, "at"> {
  /** path relative to the keyword holder (the schema root for body, `properties/name` for property) */
  at: string | string[]
}

export interface KwSpec {
  id: string
  title: string
  before: string
  after: string
  rationale: string
  annotation: string
  sources: CaseSource[]
  /** the holder schema before / after (the root for body, the property `name` for property); `undefined` = absent */
  schema: [unknown, unknown]
  expect: KwExpect[] | Partial<Record<string, KwExpect[]>>
  /** oasdiff rule stems (e.g. `max-length-decreased`) */
  stems?: string[]
  covers?: string[]
  placements?: Placement[]
  /** add the query parameter / header placements when oasdiff has a rule for them (default true) */
  scalar?: boolean
  dialect?: "3.0" | "3.1"
  draft?: string
  components?: Record<string, unknown>
  issue?: VariantTag
  policy?: VariantTag
  options?: string[]
  compareOptions?: SchemaCase["compareOptions"]
}

const relocate = (e: KwExpect[], base: string): ExpectedChange[] =>
  e.map((x) => {
    const at = (Array.isArray(x.at) ? x.at : [x.at]).map((p) => (base ? (p ? `${base}/${p}` : base) : p))
    return { ...x, at: at.length === 1 ? at[0] : at }
  })

const relocateAll = (e: KwSpec["expect"], base: string): SchemaCase["expect"] =>
  Array.isArray(e)
    ? relocate(e, base)
    : Object.fromEntries(Object.entries(e).map(([k, v]) => [k, relocate(v ?? [], base)]))

const addMention = (e: SchemaCase["expect"], mention: string | RegExp): SchemaCase["expect"] => {
  const add = (list: ExpectedChange[]) => list.map((x) => ({ ...x, mentions: [mention, ...(x.mentions ?? [])] }))
  return Array.isArray(e) ? add(e) : Object.fromEntries(Object.entries(e).map(([k, v]) => [k, add(v ?? [])]))
}

const autoPlacements = (level: Level, spec: KwSpec): Placement[] => {
  if (spec.placements) return spec.placements
  const placements: Placement[] = ["request", "response"]
  if (spec.scalar === false) return placements
  const stems = spec.stems ?? []
  if (stems.some((s) => hasRule(`${prefixes[level].param}${s}`))) placements.push("param")
  if (level === "body" && stems.some((s) => hasRule(`response-header-${s}`))) placements.push("header")
  return placements
}

const directionOf = (id: string) =>
  /^(response-|required-response|optional-response)/.test(id) ? "response" : "request"

const sameVerdict = (level: string | undefined, type: ExpectedType | undefined) =>
  (level === "ERR" && type === "breaking") ||
  (level === "WARN" && type === "risky") ||
  (level === "INFO" && (type === "non-breaking" || type === "annotation" || type === "deprecated"))

/** the expected type of the first expectation for a direction (to record oasdiff's verdict where it differs) */
const firstType = (e: KwSpec["expect"], direction: string): ExpectedType | undefined => {
  const list = Array.isArray(e) ? e : (e[direction] ?? e["*"] ?? Object.values(e)[0])
  const t = list?.[0]?.type
  if (t === undefined || typeof t === "string") return t
  return t[direction] ?? t["*"]
}

/** oasdiff sources for every covered oasdiff id, with oasdiff's level as verdict where it differs */
export const oasdiffSources = (covers: string[], e: KwSpec["expect"]): CaseSource[] =>
  covers
    .filter((c) => c.startsWith("oasdiff:"))
    .map((c) => {
      const id = c.slice(8)
      const level = ruleLevel.get(id)
      const verdict = sameVerdict(level, firstType(e, directionOf(id))) ? undefined : level
      return { tool: "oasdiff", ref: `checker/${checkerFile[id] ?? "?"} ${id}`, ...(verdict ? { verdict } : {}) }
    })

const toCase = (
  spec: KwSpec,
  level: Level,
  schema: [unknown, unknown],
  base: string,
  mention?: string | RegExp,
): SchemaCase => {
  const placements = autoPlacements(level, spec)
  const { stems = [], covers = [], scalar, ...rest } = spec
  const expect = relocateAll(spec.expect, base)
  const allCovers = [...new Set([...stemIds(level, placements, stems), ...covers])]
  const known = new Set(spec.sources.map((s) => s.ref))
  return {
    ...rest,
    kind: "schema",
    schema,
    placements,
    expect: mention ? addMention(expect, mention) : expect,
    covers: allCovers,
    sources: [...spec.sources, ...oasdiffSources(allCovers, spec.expect).filter((s) => !known.has(s.ref))],
  }
}

/** the keyword on the schema root */
export const body = (spec: KwSpec): SchemaCase => toCase(spec, "body", spec.schema, "")

/** the property path as ASD prints it: `name`, `name[]`, `name.x`, `name{.*}` */
export const NAME = /`name[`.[{]/

/** any classification (for incidental diffs whose type is not the point of the case) */
export const anyType = {}

/** the keyword on the nested property `name` (mentions "`name`") */
export const property = (spec: KwSpec): SchemaCase =>
  toCase(
    spec,
    "property",
    [
      spec.schema[0] === undefined ? { type: "object", properties: {} } : P(spec.schema[0]),
      spec.schema[1] === undefined ? { type: "object", properties: {} } : P(spec.schema[1]),
    ],
    "properties/name",
    NAME,
  )

/** body + property cases of one scenario: ids `<id>` and the next number; per-level overrides */
export const both = (
  spec: KwSpec,
  overrides: { body?: Partial<KwSpec>; property?: Partial<KwSpec> } = {},
): SchemaCase[] => {
  const next = nextId(spec.id)
  return [
    body({ ...spec, title: `${spec.title} (schema root)`, ...overrides.body }),
    property({ ...spec, id: next, title: `${spec.title} (property)`, ...overrides.property }),
  ]
}

/** JS-STR-001 -> JS-STR-002 */
export const nextId = (id: string) => id.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, "0"))

/** sequential ids for an area: `const id = seq("STR")`, `id()` -> JS-STR-001, `id(2)` reserves two numbers */
export const seq = (area: string) => {
  let n = 0
  return (count = 1) => {
    const id = `JS-${area}-${String(n + 1).padStart(3, "0")}`
    n += count
    return id
  }
}

/** a keyword mention that accepts camelCase or spaced words: `kwRe("minLength")` matches "minLength" and "min length" */
export const kwRe = (keyword: string) => new RegExp(keyword.replace(/([a-z])([A-Z])/g, "$1 ?$2"), "i")

// ---------------------------------------------------------------------------------------------------------------
// Atlassian json-schema-diff test cases (checklist `jsd`, test/compat/coverage/json-schema-diff-tests.json). A row is
// one `registerDiffTestCases` entry `<spec file stem>::<description>`; `removed` = some instance valid before is
// invalid after (breaking in a request), `added` = some instance valid after was invalid before (breaking in a
// response). The tool's verdict is recorded on the source where it differs from the case's expectation.

const jsdRows = new Map(
  (jsdTests as { id: string; file: string; added?: boolean; removed?: boolean }[]).map((r) => [r.id, r] as const),
)

/** a json-schema-diff test case `[spec file stem, description]` (or plain `it` title), with an optional verdict that
 * replaces the derived one (plain `it` rows have no added / removed schemas); `null` = the tool agrees, for a case
 * re-authored from what the test asserts rather than from its input pair (a `X -> false` test asserting that the
 * removed schema is the simplified X becomes the case `X -> simplified X`) */
export type JsdRow = [stem: string, description: string, verdict?: string | null]

const rank = (t: ExpectedType | undefined) => (t === "breaking" ? 2 : t === "risky" ? 1 : 0)
const label = ["non-breaking", "risky", "breaking"]

/** the worst expected class of a direction over every expectation of a case (placement-keyed records included) */
const worst = (c: Pick<SchemaCase, "expect">, direction: "request" | "response"): number => {
  const lists = Array.isArray(c.expect)
    ? [c.expect]
    : [c.expect[direction] ?? c.expect["*"] ?? Object.values(c.expect)[0] ?? []]
  let w = 0
  for (const e of lists.flat()) {
    const t = typeof e.type === "string" ? e.type : (e.type[direction] ?? e.type["*"])
    w = Math.max(w, rank(t as ExpectedType | undefined))
  }
  return w
}

/** the source entry of a row, with the tool's verdict where it differs from the case's expectation */
export const jsdSource = (row: JsdRow, c: Pick<SchemaCase, "expect">): CaseSource => {
  const [stem, description, given] = row
  const found = jsdRows.get(`${stem}::${description}`)
  if (!found) throw new Error(`unknown json-schema-diff test case ${stem}::${description}`)
  const ref = `${found.file} ${description}`
  if (found.added === undefined || given === null) {
    return { tool: "json-schema-diff", ref, ...(given ? { verdict: given } : {}) }
  }
  const tool = { request: found.removed ? 2 : 0, response: found.added ? 2 : 0 }
  const req = worst(c, "request")
  const res = worst(c, "response")
  const verdict =
    given ??
    (tool.request === req && tool.response === res
      ? undefined
      : `added ${found.added ? "≠" : "="} false, removed ${found.removed ? "≠" : "="} false: request ${label[tool.request]}, response ${label[tool.response]}`)
  return { tool: "json-schema-diff", ref, ...(verdict ? { verdict } : {}) }
}

/** adds json-schema-diff rows to a case: `covers` (`jsd:<stem>::<description>`) and one source per row */
export const withJsdRows = (c: SchemaCase, rows: JsdRow[]): SchemaCase => {
  const sources = rows.map((r) => jsdSource(r, c))
  return {
    ...c,
    covers: [...new Set([...(c.covers ?? []), ...rows.map(([stem, d]) => `jsd:${stem}::${d}`)])],
    // a row already cited by the case is replaced by the entry with the verdict
    sources: [...c.sources.filter((s) => !sources.some((n) => n.ref === s.ref)), ...sources],
  }
}

/** adds json-schema-diff rows to existing cases by case id (every id must exist) */
export const withJsd = (cases: SchemaCase[], rows: Record<string, JsdRow[]>): SchemaCase[] => {
  const ids = new Set(cases.map((c) => c.id))
  for (const id of Object.keys(rows)) if (!ids.has(id)) throw new Error(`withJsd: unknown case ${id}`)
  return cases.map((c) => (rows[c.id] ? withJsdRows(c, rows[c.id]) : c))
}
