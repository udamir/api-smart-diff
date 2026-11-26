// Compatibility-case harness (test/compat): one case = one change scenario harvested from another API diff tool,
// re-authored as the smallest before/after pair. Every variant of a case checks the three requirements of
// temp/TASK_2.0.0_COMPLETENESS.md separately: detection (exactly the expected changes, no spurious diff, 0 diffs on
// identical documents, inputs not mutated), classification (the expected `type` for the scope of the variant) and
// annotation (a strong description that names the changed entity and its location context).

import { buildFromSchema } from "gqlapi"
import { buildSchema } from "graphql"
import { type BuildIssueCode, buildFromProto } from "protoapi"

import {
  apiCompare,
  type CompareOptions,
  type CompareResult,
  type Diff,
  type DiffType,
  type ProtoApiCompatibility,
} from "../../src"
import { recordsByElement } from "../../src/protoapi/protoapi.merge"
import { protoWordingIssues } from "./proto-wording"

export type Action = "add" | "remove" | "replace" | "rename"
export type Direction = "request" | "response"

/**
 * Expected classification: a `DiffType`, `risky` included (decision §11.14, POLICY-03 / POLICY-05; ISSUE-130 (fixed):
 * P1 added the `risky` DiffType to `src`, the former test-side constant is the `src` export).
 */
export type ExpectedType = DiffType
export { risky } from "../../src"

/** Path pattern: JSON-pointer-like segments separated by `/` (`~1` = `/`, `~0` = `~`), `*` = one segment, `**` = any. */
export type PathPattern = string

export interface ExpectedChange {
  /** where the diff is reported: relative to the placement root for schema cases, to the document root otherwise */
  at: PathPattern | PathPattern[]
  action?: Action | Action[]
  /** expected classification; a record keyed by direction (`request` / `response`) or by variant name */
  type: ExpectedType | Partial<Record<string, ExpectedType>>
  /** strings (case-insensitive) or patterns the description must contain, in addition to the placement's own */
  mentions?: (string | RegExp)[]
  /** the change may legitimately produce no diff (e.g. a case-only rename); when it does, it is checked as usual */
  optional?: boolean
  /** exact number of diffs attributed to this expectation (diff-volume cases: one per declaration / usage location) */
  count?: number
}

export interface CaseSource {
  /** tool / corpus: oasdiff, libopenapi, openapi-changes, openapi-diff (OpenAPITools), atlassian-openapi-diff,
   * json-schema-diff, asyncapi-diff, graphql-inspector, fork, compat-suites, asd, bench */
  tool: string
  /** file (and test / rule id) inside that source */
  ref: string
  /** the tool's own verdict where it differs from ASD's expectation (e.g. "WARN", "DANGEROUS", "risky") */
  verdict?: string
}

export type VariantTag = string | Partial<Record<string, string>>

interface CaseBase {
  id: string
  title: string
  /** short before / after summary for the catalogue */
  before: string
  after: string
  /** one line grounded in the spec and the consumer viewpoint */
  rationale: string
  /** what the description must state */
  annotation: string
  sources: CaseSource[]
  /** checklist ids this case covers: `oasdiff:<rule-id>`, `gi:<ChangeType>` */
  covers?: string[]
  expect: ExpectedChange[] | Partial<Record<string, ExpectedChange[]>>
  /** known defect on 2.0.0: the variant is `it.fails` (one id per root cause) */
  issue?: VariantTag
  /** undecided ASD policy: the variant is `it.skip`; the expectation encodes the proposed option */
  policy?: VariantTag
  /** policy options for the catalogue when `policy` is set */
  options?: string[]
  compareOptions?: CompareOptions
  /** area override (defaults to the area given to `runCases`) */
  area?: string
}

export interface DocCase extends CaseBase {
  kind: "doc"
  /** a single pair (variant `doc`) or named variants */
  docs: [unknown, unknown] | Record<string, [unknown, unknown]>
}

export type Placement =
  | "request"
  | "response"
  | "param"
  | "header"
  | "json"
  | "aa2-pub"
  | "aa2-sub"
  | "aa3-send"
  | "aa3-receive"

export interface SchemaCase extends CaseBase {
  kind: "schema"
  schema: [unknown, unknown]
  /** default: request + response */
  placements?: Placement[]
  /** OpenAPI dialect of the host document (default 3.1, i.e. JSON Schema 2020-12); `json` uses `$schema` below */
  dialect?: "3.0" | "3.1"
  /** `$schema` for the `json` placement (default: none, i.e. the engine's default draft) */
  draft?: string
  /** extra components for the host document (`$ref` targets), keyed like `components.schemas` */
  components?: Record<string, unknown>
}

export interface GraphqlCase extends CaseBase {
  kind: "graphql"
  /** both sides as GraphQL SDL, compared in their GraphApi 1.0 encoding (gqlapi 0.6); one variant, `1.0` */
  sdl: [string, string]
}

/** `.proto` input of a ProtoApi case: one file (`a.proto`) or a map of import paths to file texts. */
export type ProtoInput = string | Record<string, string>

export interface ProtoCase extends CaseBase {
  kind: "proto"
  /** both sides as `.proto` text, built with protoapi's defaults (`imports: "user"`) */
  proto: [ProtoInput, ProtoInput]
  /** compatibility levels, one variant each (default: all four, PROTOAPI_DESIGN §5.1) */
  compatibility?: ProtoApiCompatibility[]
  /**
   * the scope of a message (§4.4): the harness adds `harness.proto` with an rpc that takes the message as request or
   * returns it as response; one variant per level and direction (`FILE.request`, `WIRE.response`)
   */
  use?: { message: string; directions: Direction[] }
  /** build issue codes the case expects; any other `syntax`, `missing-import` or `unresolved-type` issue fails (C8) */
  issues?: BuildIssueCode[]
  /** R-1: at most one record per element (`recordsByElement`) */
  single?: boolean
}

export type CompatCase = DocCase | SchemaCase | GraphqlCase | ProtoCase

export interface Variant {
  caseId: string
  name: string
  id: string
  family: string
  area: string
  before: unknown
  after: unknown
  /** direction used to resolve direction-keyed types */
  direction?: Direction
  prefix: (string | number)[]
  mentions: (string | RegExp)[]
  expect: ExpectedChange[]
  options?: CompareOptions
  issue?: string
  policy?: string
  /** compatibility level of a ProtoApi variant (resolves level-keyed types, C2) */
  level?: string
  /** ProtoApi variant: the R-D lint runs on every description, and `single` asserts R-1 */
  proto?: { single?: boolean; buildProblems: string[] }
}

export interface Evaluation {
  detected: boolean
  classified: boolean
  annotated: boolean
  problems: string[]
  diffs: Diff[]
}

// ---------------------------------------------------------------------------------------------------------------
// placements of a schema case

const PROP = "p"
const CHANNEL = "user/events"
const AA3_CHANNEL = "userEvents"

const oasInfo = { title: "compat", version: "1.0.0" }

export const placementDirection: Record<Placement, Direction> = {
  request: "request",
  response: "response",
  param: "request",
  header: "response",
  json: "request",
  // messages the application consumes are written by clients (request semantics), messages it produces are read by
  // clients (response semantics): AsyncAPI 2.6 publish / subscribe, 3.0 receive / send (docs/BENCHMARK.md §3)
  "aa2-pub": "request",
  "aa2-sub": "response",
  "aa3-receive": "request",
  "aa3-send": "response",
}

const openapiVersion = (dialect?: "3.0" | "3.1") => (dialect === "3.0" ? "3.0.3" : "3.1.0")

export const placeSchema = (
  placement: Placement,
  schema: unknown,
  c: Pick<SchemaCase, "dialect" | "draft" | "components">,
): { doc: unknown; prefix: (string | number)[]; mentions: (string | RegExp)[] } => {
  const components = c.components ? { components: { schemas: c.components } } : {}
  const absent = schema === undefined
  switch (placement) {
    case "request":
      return {
        doc: {
          openapi: openapiVersion(c.dialect),
          info: oasInfo,
          paths: {
            "/items": {
              post: {
                requestBody: { content: { "application/json": absent ? {} : { schema } } },
                responses: { 200: { description: "ok" } },
              },
            },
          },
          ...components,
        },
        prefix: ["paths", "/items", "post", "requestBody", "content", "application/json", "schema"],
        mentions: ["Request Body", "application/json"],
      }
    case "response":
      return {
        doc: {
          openapi: openapiVersion(c.dialect),
          info: oasInfo,
          paths: {
            "/items": {
              get: {
                responses: { 200: { description: "ok", content: { "application/json": absent ? {} : { schema } } } },
              },
            },
          },
          ...components,
        },
        prefix: ["paths", "/items", "get", "responses", "200", "content", "application/json", "schema"],
        mentions: ["Response 200", "application/json"],
      }
    case "param":
      return {
        doc: {
          openapi: openapiVersion(c.dialect),
          info: oasInfo,
          paths: {
            "/items": {
              get: {
                parameters: [{ name: PROP, in: "query", ...(absent ? {} : { schema }) }],
                responses: { 200: { description: "ok" } },
              },
            },
          },
          ...components,
        },
        prefix: ["paths", "/items", "get", "parameters", 0, "schema"],
        mentions: [`query parameter \`${PROP}\``],
      }
    case "header":
      return {
        doc: {
          openapi: openapiVersion(c.dialect),
          info: oasInfo,
          paths: {
            "/items": {
              get: {
                responses: { 200: { description: "ok", headers: { "X-Rate": absent ? {} : { schema } } } },
              },
            },
          },
          ...components,
        },
        prefix: ["paths", "/items", "get", "responses", "200", "headers", "X-Rate", "schema"],
        mentions: ["header `X-Rate`", "200"],
      }
    case "json":
      return {
        doc: {
          ...(c.draft ? { $schema: c.draft } : {}),
          ...(c.components ? { $defs: c.components } : {}),
          ...(schema as object),
        },
        prefix: [],
        mentions: [],
      }
    case "aa2-pub":
    case "aa2-sub":
      return {
        doc: {
          asyncapi: "2.6.0",
          info: oasInfo,
          channels: {
            [CHANNEL]: { [placement === "aa2-pub" ? "publish" : "subscribe"]: { message: { payload: schema } } },
          },
          ...components,
        },
        prefix: ["channels", CHANNEL, placement === "aa2-pub" ? "publish" : "subscribe", "message", "payload"],
        mentions: [`\`${CHANNEL}\``, placement === "aa2-pub" ? "publish" : "subscribe"],
      }
    case "aa3-send":
    case "aa3-receive":
      return {
        doc: {
          asyncapi: "3.0.0",
          info: oasInfo,
          channels: { [AA3_CHANNEL]: { address: CHANNEL, messages: { event: { payload: schema } } } },
          operations: {
            onEvent: {
              action: placement === "aa3-send" ? "send" : "receive",
              channel: { $ref: `#/channels/${AA3_CHANNEL}` },
              messages: [{ $ref: `#/channels/${AA3_CHANNEL}/messages/event` }],
            },
          },
          ...components,
        },
        prefix: ["channels", AA3_CHANNEL, "messages", "event", "payload"],
        mentions: [`\`${AA3_CHANNEL}\``],
      }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// variants

const tagFor = (
  tag: VariantTag | undefined,
  variant: string,
  direction?: Direction,
  level?: string,
): string | undefined => {
  if (tag === undefined || typeof tag === "string") return tag
  return tag[variant] ?? (level ? tag[level] : undefined) ?? (direction ? tag[direction] : undefined) ?? tag["*"]
}

const expectFor = (c: CaseBase, variant: string, direction?: Direction, level?: string): ExpectedChange[] => {
  if (Array.isArray(c.expect)) return c.expect
  const found =
    c.expect[variant] ??
    (level ? c.expect[level] : undefined) ??
    (direction ? c.expect[direction] : undefined) ??
    c.expect["*"]
  if (!found) throw new Error(`${c.id}: no expectation for variant ${variant}`)
  return found
}

/** The GraphApi 1.0 document (gqlapi 0.6) of a GraphQL SDL. */
export const gqlDocs = (sdl: string) => buildFromSchema(buildSchema(sdl, { noLocation: true }))

// ---- ProtoApi cases (PROTOAPI_DESIGN §9.2)

const PROTO_LEVELS: ProtoApiCompatibility[] = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]
// build issues that make a document unfit for a comparison (C8)
const FATAL_PROTO_ISSUES: BuildIssueCode[] = ["syntax", "missing-import", "unresolved-type"]

/** The sources of one side of a ProtoApi case, with `harness.proto` using `use.message` in `direction`. */
export const protoSources = (input: ProtoInput, use?: { message: string }, direction?: Direction) => {
  const sources: Record<string, string> = typeof input === "string" ? { "a.proto": input } : { ...input }
  if (use && direction) {
    const imports = Object.keys(sources)
      .map((file) => `import "${file}";`)
      .join("\n")
    const rpc =
      direction === "request"
        ? `rpc Call(${use.message}) returns (google.protobuf.Empty);`
        : `rpc Call(google.protobuf.Empty) returns (${use.message});`
    sources["harness.proto"] =
      `syntax = "proto3";\npackage harness;\nimport "google/protobuf/empty.proto";\n${imports}\nservice Harness {\n  ${rpc}\n}\n`
  }
  return sources
}

/** Builds one side of a ProtoApi case; build issues the case does not expect are returned as problems (C8). */
export const buildProtoSide = (sources: Record<string, string>, expected: BuildIssueCode[] = []) => {
  const { document, issues } = buildFromProto(sources, { imports: "user" })
  const problems = issues
    .filter((issue) => FATAL_PROTO_ISSUES.includes(issue.code) && !expected.includes(issue.code))
    .map((issue) => `build: ${issue.code}: ${issue.message}`)
  return { document, problems }
}

type VariantBase = Pick<
  Variant,
  "caseId" | "name" | "id" | "family" | "area" | "direction" | "expect" | "options" | "issue" | "policy"
>

const protoVariants = (
  c: ProtoCase,
  base: (name: string, direction?: Direction, level?: string) => VariantBase,
): Variant[] => {
  const levels = c.compatibility ?? PROTO_LEVELS
  const directions: (Direction | undefined)[] = c.use ? c.use.directions : [undefined]
  return levels.flatMap((level) =>
    directions.map((direction) => {
      const name = direction ? `${level}.${direction}` : level
      const before = buildProtoSide(protoSources(c.proto[0], c.use, direction), c.issues)
      const after = buildProtoSide(protoSources(c.proto[1], c.use, direction), c.issues)
      return {
        ...base(name, direction, level),
        level,
        before: before.document,
        after: after.document,
        options: { ...c.compareOptions, compatibility: level } as CompareOptions,
        prefix: [],
        mentions: [],
        proto: { single: c.single, buildProblems: [...before.problems, ...after.problems] },
      }
    }),
  )
}

export const variantsOf = (c: CompatCase, family: string, area: string): Variant[] => {
  const base = (name: string, direction?: Direction, level?: string): VariantBase => ({
    caseId: c.id,
    name,
    id: `${c.id}@${name}`,
    family,
    area: c.area ?? area,
    direction,
    expect: expectFor(c, name, direction, level),
    options: c.compareOptions,
    issue: tagFor(c.issue, name, direction, level),
    policy: tagFor(c.policy, name, direction, level),
  })
  if (c.kind === "proto") {
    return protoVariants(c, base)
  }
  if (c.kind === "doc") {
    const pairs: Record<string, [unknown, unknown]> = Array.isArray(c.docs) ? { doc: c.docs } : c.docs
    return Object.entries(pairs).map(([name, [before, after]]) => ({
      ...base(name, name === "request" || name === "response" ? name : undefined),
      before,
      after,
      prefix: [],
      mentions: [],
    }))
  }
  if (c.kind === "graphql") {
    return [
      {
        ...base("1.0"),
        before: gqlDocs(c.sdl[0]),
        after: gqlDocs(c.sdl[1]),
        prefix: [],
        mentions: [],
      },
    ]
  }
  return (c.placements ?? ["request", "response"]).map((placement) => {
    const direction = placementDirection[placement]
    const before = placeSchema(placement, c.schema[0], c)
    const after = placeSchema(placement, c.schema[1], c)
    return {
      ...base(placement, direction),
      before: before.doc,
      after: after.doc,
      prefix: before.prefix,
      mentions: before.mentions,
    }
  })
}

// ---------------------------------------------------------------------------------------------------------------
// matching

const parsePattern = (pattern: PathPattern): string[] =>
  pattern === "" ? [] : pattern.split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))

const matchSegments = (pattern: string[], path: string[]): boolean => {
  if (!pattern.length) return !path.length
  const [head, ...rest] = pattern
  if (head === "**") {
    for (let i = 0; i <= path.length; i++) {
      if (matchSegments(rest, path.slice(i))) return true
    }
    return false
  }
  if (!path.length) return false
  return (head === "*" || head === path[0]) && matchSegments(rest, path.slice(1))
}

/** Matches a diff path against the literal prefix (the placement root) followed by the pattern segments. */
export const matchPath = (pattern: PathPattern, path: (string | number)[], prefix: (string | number)[] = []): boolean =>
  matchSegments([...prefix.map(String), ...parsePattern(pattern)], path.map(String))

const matches = (e: ExpectedChange, diff: Diff, prefix: (string | number)[]) => {
  const patterns = Array.isArray(e.at) ? e.at : [e.at]
  const actions = e.action === undefined ? undefined : Array.isArray(e.action) ? e.action : [e.action]
  return (!actions || actions.includes(diff.action as Action)) && patterns.some((p) => matchPath(p, diff.path, prefix))
}

export const expectedType = (
  e: ExpectedChange,
  v: Pick<Variant, "name" | "direction" | "level">,
): ExpectedType | undefined => {
  if (typeof e.type === "string") return e.type
  return (
    e.type[v.name] ??
    (v.level ? e.type[v.level] : undefined) ??
    (v.direction ? e.type[v.direction] : undefined) ??
    e.type["*"]
  )
}

// ---------------------------------------------------------------------------------------------------------------
// description quality

const actionTag: Record<string, string> = {
  add: "[Added]",
  remove: "[Removed]",
  replace: "[Replaced]",
  rename: "[Renamed]",
}

/**
 * POLICY-90: the description names the changed item as its own container — a backticked name directly followed by a
 * preposition and the same name (`` `X` to `X` ``, `` `X` from `X` ``, `` `X` of `X` ``) or by "Argument" and the same
 * name (`` `X` to Argument `X` ``, `` `X` Argument `X` ``). A repeat inside a "from … to …" value pair is not one
 * (`` channel `user` from `user` to `user/{id}` ``, `` from `Status` to `Status` ``). The benchmark's corpus scorer
 * (`bench/lib/corpus-score.js` `ownContainer`) implements the same rule.
 */
export const namesItselfAsContainer = (description: string): boolean => {
  for (const m of description.matchAll(/`([^`]+)` (?:(to|from|of) )?([Aa]rgument )?`\1`/g)) {
    const [whole, , preposition, argument] = m
    if (!preposition && !argument) continue
    if (!argument && preposition === "from" && description.startsWith(" to `", m.index + whole.length)) continue
    if (!argument && preposition === "to" && /\bfrom $/.test(description.slice(0, m.index))) continue
    return true
  }
  return false
}

// ProtoApi keywords whose absence is a state (R-D, §7.2): a key added or removed reads as the state it changes (W-34:
// `closed` added is "[Replaced] enum type … from `open` to `closed`", `utf8Validation: false` added is "[Removed]
// UTF-8 validation", explicit → required presence is "[Added] required label")
const PROTOAPI_STATE_KEYS = new Set([
  "closed",
  "jsonFormat",
  "utf8Validation",
  "packed",
  "presence",
  "syntax",
  "visibility",
])

// the labels ProtoApi descriptions take besides the action word: `[Deprecated]` for deprecation records (PD-23), the
// state of a keyword whose absence has a meaning, an implicit default replaced (C6), a merged record of mixed effects
// (A4, ISSUE-374)
const protoApiLabel = (diff: Diff, tag: string): boolean => {
  if (tag === "[Deprecated]") {
    return diff.type === "deprecated"
  }
  const key = String(diff.path[diff.path.length - 1])
  return (
    // a merged record with mixed effects keeps the representative's action (PD-25)
    /^\[Replaced\] (resolved features|field behavior) of /.test(diff.description ?? "") ||
    (PROTOAPI_STATE_KEYS.has(key) && /^\[(Added|Removed|Replaced)\]$/.test(tag)) ||
    (key === "default" && tag === "[Replaced]" && (diff.description ?? "").includes("(implicit)"))
  )
}

/** Reasons why a description is weak (empty list = strong). */
export const weakDescription = (diff: Diff): string[] => {
  const d = diff.description
  if (typeof d !== "string" || !d.trim()) return ["no description"]
  const reasons: string[] = []
  if (/undefined|\{\{|\}\}|\[object|NaN/.test(d)) reasons.push("leaks undefined / {{ / [object / NaN")
  const text = d.replace(/^\[[A-Za-z]+\]\s*/, "")
  if (text.length < 8 || text.split(/\s+/).filter(Boolean).length < 2) reasons.push("too short to name an entity")
  const tag = d.match(/^\[[A-Za-z]+\]/)?.[0]
  // a boolean flag switched on / off (`readOnly: true -> false`) may be described as added / removed
  const flag = diff.action === "replace" && (typeof diff.before === "boolean" || typeof diff.after === "boolean")
  if (
    tag &&
    actionTag[diff.action] &&
    tag !== actionTag[diff.action] &&
    !(flag && /^\[(Added|Removed)\]$/.test(tag)) &&
    !protoApiLabel(diff, tag)
  ) {
    reasons.push(`action tag ${tag} does not match action ${diff.action}`)
  }
  if (diff.type !== "annotation" && /\bannotation \(/.test(d))
    reasons.push("a non-annotation change described as an annotation")
  if (namesItselfAsContainer(d)) reasons.push("names the changed item as its own container")
  return reasons
}

const mentionMissing = (description: string, mention: string | RegExp) =>
  typeof mention === "string" ? !description.toLowerCase().includes(mention.toLowerCase()) : !mention.test(description)

// ---------------------------------------------------------------------------------------------------------------
// evaluation

const snapshot = (value: unknown) => JSON.stringify(value)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const formatDiffs = (diffs: Diff[]) =>
  diffs.map((d) => `    ${d.type} ${d.action} ${d.path.map(String).join("/")} | ${d.description}`).join("\n")

export const compareVariant = (v: Pick<Variant, "before" | "after" | "options">): CompareResult =>
  apiCompare(v.before, v.after, { metaKey: Symbol("diff"), ...v.options })

type Context = Pick<Variant, "name" | "direction" | "prefix" | "mentions" | "expect" | "level" | "proto">

/** Attribution of diffs to expected changes: detection, classification and annotation of a result. */
export const checkDiffs = (v: Context, diffs: Diff[]): Evaluation => {
  const problems: string[] = []
  let detected = true
  let classified = true
  let annotated = true
  const attributed = new Map<ExpectedChange, Diff[]>()
  const spurious: Diff[] = []
  for (const diff of diffs) {
    const e = v.expect.find((x) => matches(x, diff, v.prefix))
    if (!e) {
      spurious.push(diff)
    } else {
      attributed.set(e, [...(attributed.get(e) ?? []), diff])
    }
  }
  if (spurious.length) {
    detected = false
    problems.push(`detection: ${spurious.length} unexpected diff(s)\n${formatDiffs(spurious)}`)
  }
  for (const e of v.expect) {
    const found = attributed.get(e) ?? []
    if (!found.length && !e.optional) {
      detected = false
      problems.push(`detection: no diff at ${JSON.stringify(e.at)} (${e.action ?? "any action"})`)
    }
    if (e.count !== undefined && found.length !== e.count && (found.length || !e.optional)) {
      detected = false
      problems.push(`detection: ${found.length} diff(s) at ${JSON.stringify(e.at)}, expected exactly ${e.count}`)
    }
    const type = expectedType(e, v)
    for (const diff of found) {
      if (type !== undefined && diff.type !== type) {
        classified = false
        problems.push(`classification: ${diff.path.map(String).join("/")} is ${diff.type}, expected ${type}`)
      }
      const weak = weakDescription(diff)
      const missing = [...v.mentions, ...(e.mentions ?? [])].filter((m) => mentionMissing(diff.description ?? "", m))
      if (weak.length || missing.length) {
        annotated = false
        problems.push(
          `annotation: "${diff.description}"${weak.length ? ` is weak (${weak.join(", ")})` : ""}${
            missing.length ? ` does not mention ${missing.map(String).join(", ")}` : ""
          }`,
        )
      }
    }
  }
  if (v.proto) {
    // R-D (J16): every description of the family reads in protobuf terms with `.proto` literals
    const wording = diffs.flatMap(protoWordingIssues)
    if (wording.length) {
      annotated = false
      problems.push(...wording.map((issue) => `annotation: R-D ${issue}`))
    }
    // R-1: at most one record per element
    if (v.proto.single) {
      const several = [...recordsByElement(diffs)].filter(([, count]) => count > 1)
      if (several.length) {
        detected = false
        problems.push(
          `detection: R-1 several records at ${several.map(([element, n]) => `${element} (${n})`).join(", ")}`,
        )
      }
    }
  }
  return { detected, classified, annotated, problems, diffs }
}

/** Checks one variant against the three requirements without throwing. */
export const evaluateVariant = (v: Variant): Evaluation => {
  const problems: string[] = [...(v.proto?.buildProblems ?? [])]
  let identicalOk = !problems.length
  const snapBefore = snapshot(v.before)
  const snapAfter = snapshot(v.after)
  let result: CompareResult
  try {
    result = compareVariant(v)
  } catch (error) {
    return { detected: false, classified: false, annotated: false, problems: [`compare threw: ${error}`], diffs: [] }
  }
  if (snapshot(v.before) !== snapBefore || snapshot(v.after) !== snapAfter) {
    identicalOk = false
    problems.push("detection: an input document was mutated")
  }
  for (const [side, doc] of [
    ["before", v.before],
    ["after", v.after],
  ] as const) {
    try {
      const same = apiCompare(doc, clone(doc), { metaKey: Symbol("diff"), ...v.options }).diffs
      if (same.length) {
        identicalOk = false
        problems.push(
          `detection: ${same.length} diff(s) when the ${side} document is compared with itself\n${formatDiffs(same)}`,
        )
      }
    } catch (error) {
      identicalOk = false
      problems.push(`detection: identical ${side} compare threw: ${error}`)
    }
  }
  const checked = checkDiffs(v, result.diffs)
  const all = [...problems, ...checked.problems]
  if (all.length && result.diffs.length) {
    all.push(`all diffs:\n${formatDiffs(result.diffs)}`)
  }
  return { ...checked, detected: checked.detected && identicalOk, problems: all }
}

/**
 * Asserts the three requirements on a compare result:
 * `expectChange(apiCompare(b, a), [{ at: "paths/~1a/get", action: "remove", type: breaking, mentions: ["GET /a"] }])`.
 * Pass `{ before, after }` instead of a result to also run the identical-document and mutation checks.
 */
export const expectChange = (
  result: CompareResult | { before: unknown; after: unknown; options?: CompareOptions },
  expected: ExpectedChange | ExpectedChange[],
  context: { prefix?: (string | number)[]; mentions?: (string | RegExp)[]; direction?: Direction; name?: string } = {},
) => {
  const ctx = {
    name: context.name ?? "inline",
    direction: context.direction,
    prefix: context.prefix ?? [],
    mentions: context.mentions ?? [],
    expect: Array.isArray(expected) ? expected : [expected],
  }
  const evaluation =
    "diffs" in result
      ? checkDiffs(ctx, result.diffs)
      : evaluateVariant({ ...ctx, caseId: "inline", id: "inline", family: "inline", area: "inline", ...result })
  expect(evaluation.problems.join("\n")).toBe("")
}

// ---------------------------------------------------------------------------------------------------------------
// registration

export interface RegisteredCases {
  family: string
  area: string
  file: string
  cases: CompatCase[]
  variants: Variant[]
}

/** Filled instead of registering tests when `ASD_COMPAT_COLLECT` is set (test/compat/report.ts). */
export const collected: RegisteredCases[] = []

export const isCollecting = () => !!process.env.ASD_COMPAT_COLLECT

const title = (c: CompatCase, v: Variant) => `${v.id} ${c.title}`

/**
 * Registers one test per variant: plain `it` when 2.0.0 passes, `it.fails` for a variant tagged with an ISSUE,
 * `it.skip` for a variant tagged with an open POLICY. Call it as `runCases(family, area, cases, import.meta.filename)`.
 */
export const runCases = (family: string, area: string, cases: CompatCase[], file: string) => {
  const ids = new Set<string>()
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`duplicate case id ${c.id}`)
    ids.add(c.id)
  }
  const variants = cases.flatMap((c) => variantsOf(c, family, area))
  if (isCollecting()) {
    collected.push({ family, area, file, cases, variants })
    return
  }
  describe(`compat ${family} / ${area}`, () => {
    for (const c of cases) {
      for (const v of variantsOf(c, family, area)) {
        const run = () => {
          const evaluation = evaluateVariant(v)
          expect(evaluation.problems.join("\n")).toBe("")
        }
        if (v.policy) {
          it.skip(`${title(c, v)} [${v.policy}]`, run)
        } else if (v.issue) {
          it.fails(`${title(c, v)} [${v.issue}]`, run)
        } else {
          it(title(c, v), run)
        }
      }
    }
  })
}
