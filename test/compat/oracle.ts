// JSON Schema classification oracle (phase H, temp/IMPLEMENTATION_PLAN_2.0.0.md): checks the expected class of every
// schema case of test/compat against set inclusion, independently of ASD.
//
//   vpx test/compat/oracle.ts            # summary, disagreements and stale exceptions
//   vpx test/compat/oracle.ts -v         # also every agreement with its witness
//   vpx test/compat/oracle.ts --write    # store the result in test/compat/coverage/jsonschema-oracle.json
//   vpx test/compat/oracle.ts --json     # machine-readable check (test/compat/core/oracle.test.ts)
//
// For every schema case and each of its request / response / json placements, instances are generated from both
// schemas (keyword boundaries, enum / const / default / example values, every property removed / replaced / added,
// arrays of boundary lengths, tuple positions …) and validated with ajv against the before and the after schema.
// Request semantics (request, json): breaking iff some instance valid before is invalid after. Response semantics:
// breaking iff some instance valid after is invalid before. A witness proves a breaking change; the absence of a witness
// only means none was generated. Excluded: variants expecting `risky`, `unclassified` or `deprecated`, annotation-only
// variants (checked for equivalence and listed separately), the param / header placements (serialized values are not
// JSON values) and schemas whose semantics are not JSON Schema validation (readOnly / writeOnly, discriminator, xml).
// Assumptions: `format` is an assertion (OpenAPI tooling convention; the formats used by the corpus are registered
// below); OpenAPI 3.0 schemas are rewritten to 2020-12 (`nullable`, boolean exclusive bounds); draft-04 schemas to
// draft-07. Accepted disagreements (a decided policy that overrides set inclusion, or a generator limit) are listed with
// their reason in test/compat/coverage/jsonschema-oracle-exceptions.json; anything else is reported.
//
// ajv 8 is not a dependency of this package: the oracle loads `ajv/dist/2020` from node_modules when it is ajv 8, else
// from ASD_ORACLE_AJV (a directory containing ajv 8), else from the main worktree's benchmark
// (`../api-smart-diff/bench/node_modules/ajv`). Without ajv 8 it reports that it cannot run.

import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import type { CompatCase, SchemaCase, Variant } from "../helpers/compat"

const root = path.join(import.meta.dirname, "..", "..")
const compatDir = import.meta.dirname
const exceptionsFile = path.join(compatDir, "coverage", "jsonschema-oracle-exceptions.json")
const resultFile = path.join(compatDir, "coverage", "jsonschema-oracle.json")

type Schema = any
type AjvClass = new (options: Record<string, unknown>) => {
  compile: (schema: Schema) => ((data: unknown) => boolean) & { errors?: unknown }
  addFormat: (name: string, format: unknown) => void
  addMetaSchema?: (schema: Schema) => void
}

// ---------------------------------------------------------------------------------------------------------------
// ajv 8

const ajvDirs = () =>
  [
    path.join(root, "node_modules", "ajv"),
    process.env.ASD_ORACLE_AJV,
    path.join(root, "..", "api-smart-diff", "bench", "node_modules", "ajv"),
  ].filter((d): d is string => !!d)

export const findAjv = (): string | undefined =>
  ajvDirs().find((dir) => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
      return Number(String(pkg.version).split(".")[0]) >= 8 && fs.existsSync(path.join(dir, "dist", "2020.js"))
    } catch {
      return false
    }
  })

const require = createRequire(import.meta.url)

const loadAjv = (dir: string) => ({
  Ajv2020: require(path.join(dir, "dist", "2020.js")).default as AjvClass,
  Ajv2019: require(path.join(dir, "dist", "2019.js")).default as AjvClass,
  Ajv07: require(path.join(dir, "dist", "ajv.js")).default as AjvClass,
  draft06: require(path.join(dir, "dist", "refs", "json-schema-draft-06.json")),
})

const formats: Record<string, unknown> = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i,
  time: /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i,
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  uri: /^[a-z][a-z0-9+.-]*:\S*$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  hostname: /^[a-z0-9.-]+$/i,
  byte: /^[A-Za-z0-9+/]*={0,2}$/,
  binary: /^[\s\S]*$/,
  password: /^[\s\S]*$/,
  int32: { type: "number", validate: (n: number) => Number.isInteger(n) && n >= -(2 ** 31) && n <= 2 ** 31 - 1 },
  int64: { type: "number", validate: (n: number) => Number.isInteger(n) },
  float: { type: "number", validate: (n: number) => Number.isFinite(n) && Math.abs(n) <= 3.4028234663852886e38 },
  double: { type: "number", validate: (n: number) => Number.isFinite(n) },
}

// ---------------------------------------------------------------------------------------------------------------
// schema normalization

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v)

/** OpenAPI 3.0 / draft-04 → the later draft: `nullable`, boolean exclusive bounds, `id`, component references. */
const normalize = (s: Schema, mode: { oas30?: boolean; draft04?: boolean }): Schema => {
  if (Array.isArray(s)) return s.map((x) => normalize(x, mode))
  if (!isObj(s)) return s
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(s)) {
    if (k === "$ref" && typeof v === "string") out.$ref = v.replace("#/components/schemas/", "#/$defs/")
    else if (k === "properties" || k === "patternProperties" || k === "$defs" || k === "definitions") {
      out[k] = isObj(v) ? Object.fromEntries(Object.entries(v).map(([n, x]) => [n, normalize(x, mode)])) : v
    } else out[k] = normalize(v, mode)
  }
  if (mode.oas30 || mode.draft04) {
    for (const [flag, bound] of [
      ["exclusiveMinimum", "minimum"],
      ["exclusiveMaximum", "maximum"],
    ] as const) {
      if (typeof out[flag] === "boolean") {
        if (out[flag] && typeof out[bound] === "number") {
          out[flag] = out[bound]
          delete out[bound]
        } else delete out[flag]
      }
    }
  }
  if (mode.draft04 && typeof out.id === "string") {
    out.$id = out.id
    delete out.id
  }
  if (mode.oas30) {
    delete out.example
    if (out.nullable === true) {
      if (typeof out.type === "string") out.type = [out.type, "null"]
      if (Array.isArray(out.enum) && !out.enum.includes(null)) out.enum = [...out.enum, null]
    }
    delete out.nullable
  }
  return out
}

// readOnly / writeOnly: request / response visibility; discriminator, xml: OpenAPI-only; content*: annotations in 2020-12
// (the decoded content is a contract ajv does not assert)
const OAS_ONLY = new Set([
  "readOnly",
  "writeOnly",
  "discriminator",
  "xml",
  "contentMediaType",
  "contentEncoding",
  "contentSchema",
])

const usesKeywords = (s: Schema, keys: Set<string>): string[] => {
  const found = new Set<string>()
  const walk = (x: unknown, parentKey?: string) => {
    if (Array.isArray(x)) return x.forEach((y) => walk(y))
    if (!isObj(x)) return
    for (const [k, v] of Object.entries(x)) {
      // names under `properties` are property names, not keywords
      if (parentKey !== "properties" && parentKey !== "$defs" && keys.has(k)) found.add(k)
      walk(v, k)
    }
  }
  walk(s)
  return [...found]
}

/**
 * Property names a schema declares anywhere (`properties`, `required`, `dependentRequired`). The oracle assumes that a
 * client sends, and a server returns, no property the other contract version declares and its own does not: a client
 * of the before contract does not send a property that only the after contract introduces. Without this, adding an
 * optional request property would "break" the open object that accepted any value under that name, which no API diff
 * tool and no case of the corpus considers a break; other undeclared properties stay possible (open objects), so
 * `additionalProperties: false` added still narrows.
 */
const declaredNames = (doc: Schema): Set<string> => {
  const names = new Set<string>()
  const walk = (x: unknown, parentKey?: string) => {
    if (Array.isArray(x)) return x.forEach((y) => walk(y, parentKey === "required" ? "required" : undefined))
    if (!isObj(x)) return
    for (const [k, v] of Object.entries(x)) {
      if (parentKey === "properties") names.add(k)
      if (k === "required" && Array.isArray(v)) v.forEach((n) => names.add(String(n)))
      if (k === "dependentRequired" && isObj(v)) {
        for (const [d, list] of Object.entries(v)) {
          names.add(d)
          if (Array.isArray(list)) list.forEach((n) => names.add(String(n)))
        }
      }
      walk(v, parentKey === "properties" ? undefined : k)
    }
  }
  walk(doc)
  return names
}

const usesNames = (x: unknown, names: Set<string>): boolean =>
  Array.isArray(x)
    ? x.some((y) => usesNames(y, names))
    : isObj(x)
      ? Object.entries(x).some(([k, v]) => names.has(k) || usesNames(v, names))
      : false

// ---------------------------------------------------------------------------------------------------------------
// instance generation

interface Entry {
  s: Schema
  /** the wrapper document the schema lives in (for `$ref` resolution and sub-validators) */
  doc: Schema
  /** before or after document */
  side: "b" | "a"
}

const pointer = (doc: Schema, ref: string): Schema | undefined => {
  if (!ref.startsWith("#")) return undefined
  const parts = ref
    .slice(1)
    .split("/")
    .filter(Boolean)
    .map((p) => decodeURIComponent(p).replace(/~1/g, "/").replace(/~0/g, "~"))
  let cur = doc
  for (const p of parts) {
    if (cur === undefined || cur === null) return undefined
    cur = cur[p]
  }
  return cur
}

/** the entries plus every subschema that constrains the same instance ($ref targets, combinators, conditionals) */
const expand = (entries: Entry[]): Entry[] => {
  const out: Entry[] = []
  const seen = new Set<Schema>()
  const queue = [...entries]
  while (queue.length) {
    const e = queue.shift() as Entry
    if (!isObj(e.s) || seen.has(e.s)) continue
    seen.add(e.s)
    out.push(e)
    const push = (s: Schema) => queue.push({ ...e, s })
    for (const k of ["$ref", "$dynamicRef"]) {
      if (typeof e.s[k] === "string") {
        const target = pointer(e.doc, e.s[k])
        if (target !== undefined) push(target)
      }
    }
    for (const k of ["allOf", "anyOf", "oneOf"]) if (Array.isArray(e.s[k])) e.s[k].forEach(push)
    for (const k of ["not", "if", "then", "else"]) if (e.s[k] !== undefined) push(e.s[k])
    if (isObj(e.s.dependentSchemas)) Object.values(e.s.dependentSchemas).forEach(push)
    if (isObj(e.s.dependencies)) Object.values(e.s.dependencies).forEach((d) => !Array.isArray(d) && push(d))
  }
  return out
}

const TYPES = ["null", "boolean", "integer", "number", "string", "array", "object"]

const typesOf = (all: Entry[]): Set<string> => {
  const types = new Set<string>()
  for (const { s } of all) {
    if (typeof s.type === "string") types.add(s.type)
    if (Array.isArray(s.type)) s.type.forEach((t: string) => types.add(t))
    if (
      ["properties", "required", "additionalProperties", "patternProperties", "minProperties", "maxProperties"].some(
        (k) => k in s,
      ) ||
      ["dependentRequired", "propertyNames", "unevaluatedProperties"].some((k) => k in s)
    )
      types.add("object")
    if (
      ["items", "prefixItems", "minItems", "maxItems", "uniqueItems", "contains", "additionalItems"].some(
        (k) => k in s,
      ) ||
      "unevaluatedItems" in s
    )
      types.add("array")
    if (["minLength", "maxLength", "pattern", "format", "contentMediaType"].some((k) => k in s)) types.add("string")
    if (["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"].some((k) => k in s))
      types.add("number")
    for (const k of ["enum", "const", "default"]) {
      const vals = k === "enum" ? (Array.isArray(s.enum) ? s.enum : []) : k in s ? [s[k]] : []
      for (const v of vals) types.add(v === null ? "null" : Array.isArray(v) ? "array" : typeof v)
    }
  }
  if (types.has("number")) types.add("integer")
  if (!types.size) TYPES.forEach((t) => types.add(t))
  return types
}

/** a side whose entries carry no type information (`true`, `{}`, `{ maxLength }`) accepts values of every type */
const typesOfSides = (all: Entry[]): Set<string> => {
  const types = typesOf(all)
  for (const side of ["b", "a"]) {
    const own = all.filter((e) => e.side === side)
    const typed = own.some((e) => e.s.type !== undefined || "const" in e.s || "enum" in e.s)
    if (!typed) TYPES.forEach((t) => types.add(t))
  }
  return types
}

const nums = (all: Entry[], keys: string[]) =>
  all.flatMap(({ s }) => keys.map((k) => s[k]).filter((v): v is number => typeof v === "number"))

const STRINGS = [
  "",
  "a",
  "ab",
  "abc",
  "abcd",
  "A",
  "1",
  "12",
  "123",
  "1234",
  "a1",
  "x-a",
  "a_name",
  "hello world",
  "2020-01-01",
  "2020-01-01T00:00:00Z",
  "12:00:00Z",
  "a@example.com",
  "https://example.com",
  "123e4567-e89b-12d3-a456-426614174000",
  "127.0.0.1",
  "YWJj",
  "{}",
]

const GENERIC = [null, true, 0, 1, 1.5, "a", "", [], {}]

const LIMIT = 150

const typeOf = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v)

/** literal values first, then the type buckets interleaved, so that a short prefix of the list holds every type */
const interleave = (literals: unknown[], buckets: unknown[][]) => {
  const out = [...literals]
  for (let i = 0; buckets.some((b) => i < b.length); i++) for (const b of buckets) if (i < b.length) out.push(b[i])
  const seen = new Set<string>()
  return out.filter((v) => {
    const k = JSON.stringify(v)
    if (k === undefined || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

class Generator {
  private readonly validators = new Map<string, (v: unknown) => boolean>()

  constructor(private readonly compileSub: (s: Schema, doc: Schema) => (v: unknown) => boolean) {}

  /** does `v` satisfy every entry (each entry compiled within its own document) */
  private satisfies(entries: Entry[], v: unknown) {
    return entries.every((e) => {
      const key = JSON.stringify([e.s, e.doc.$defs ?? e.doc.definitions ?? null])
      let fn = this.validators.get(key)
      if (!fn) {
        try {
          fn = this.compileSub(e.s, e.doc)
        } catch {
          fn = () => true
        }
        this.validators.set(key, fn)
      }
      return fn(v)
    })
  }

  /** representative values: one satisfying the before entries, one the after entries, one both (when they exist) */
  private bases(entries: Entry[], values: unknown[]) {
    const pick = (es: Entry[]) => values.find((v) => this.satisfies(es, v))
    const b = entries.filter((e) => e.side === "b")
    const a = entries.filter((e) => e.side === "a")
    const found = [pick(entries), pick(b), pick(a)].filter((v) => v !== undefined)
    return found.length ? [...new Set(found)] : values.slice(0, 1)
  }

  values(entries: Entry[], depth = 0): unknown[] {
    const all = expand(entries)
    const literals: unknown[] = []
    for (const { s } of all) {
      if ("const" in s) literals.push(s.const)
      if (Array.isArray(s.enum)) literals.push(...s.enum)
      if ("default" in s) literals.push(s.default)
      if ("example" in s) literals.push(s.example)
      if (Array.isArray(s.examples)) literals.push(...s.examples)
    }
    const types = typesOfSides(all)
    const buckets: unknown[][] = []
    if (types.has("null")) buckets.push([null])
    if (types.has("boolean")) buckets.push([true, false])
    if (types.has("integer") || types.has("number")) {
      const n: number[] = []
      for (const b of nums(all, ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"])) {
        for (const d of [0, -1, 1, -0.5, 0.5, -0.01, 0.01]) n.push(Number((b + d).toFixed(6)))
      }
      for (const m of nums(all, ["multipleOf"])) {
        for (const k of [1, 2, 3, 5, 6, 7, 10, 0.5]) n.push(Number((m * k).toFixed(10)))
      }
      n.push(0, 1, 1.5, -1, 2, 0.5, 3, 5, 10, 100, 1000, -2.5, 0.1, 0.3, 2 ** 31, 2 ** 31 - 1, -(2 ** 31) - 1)
      n.push(2 ** 53, 1e39, -1e39, 1e300)
      buckets.push(n)
    }
    if (types.has("string")) {
      const s: string[] = []
      for (const L of nums(all, ["minLength", "maxLength"])) {
        for (const n of [L, L - 1, L + 1]) if (n >= 0) s.push("a".repeat(n), "1".repeat(n))
      }
      for (const { s: sc } of all) {
        for (const v of [...(Array.isArray(sc.enum) ? sc.enum : []), ...("const" in sc ? [sc.const] : [])]) {
          if (typeof v === "string") s.push(`${v}x`, v.toUpperCase())
        }
      }
      s.push(...STRINGS)
      buckets.push(s)
    }
    if (types.has("array")) buckets.push(depth < 4 ? this.arrays(all, depth) : [[]])
    if (types.has("object")) buckets.push(depth < 4 ? this.objects(all, depth) : [{}])
    return interleave(literals, buckets)
  }

  private arrays(all: Entry[], depth: number): unknown[] {
    const itemEntries: Entry[] = []
    const plainItems: Entry[] = []
    const prefix: Entry[][] = []
    for (const e of all) {
      const tuple = Array.isArray(e.s.prefixItems) ? e.s.prefixItems : Array.isArray(e.s.items) ? e.s.items : undefined
      tuple?.forEach((s: Schema, i: number) => {
        prefix[i] = [...(prefix[i] ?? []), { ...e, s }]
      })
      for (const k of ["items", "additionalItems", "contains", "unevaluatedItems"]) {
        if (isObj(e.s[k])) itemEntries.push({ ...e, s: e.s[k] })
      }
      if (isObj(e.s.items)) plainItems.push({ ...e, s: e.s.items })
    }
    const items = interleave(
      [],
      [itemEntries.length ? this.values(itemEntries, depth + 1).slice(0, LIMIT) : [], GENERIC],
    )
    const good = this.bases(plainItems, items)
    const out: unknown[] = [[]]
    for (const g of good) out.push([g], [g, g])
    for (const c of items.slice(0, 30)) out.push([c])
    for (let i = 0; i + 1 < Math.min(items.length, 8); i++) out.push([items[i], items[i + 1]])
    for (const L of nums(all, ["minItems", "maxItems", "minContains", "maxContains"])) {
      for (const n of [L - 1, L, L + 1]) {
        if (n < 0 || n > 50) continue
        for (const g of good) out.push(Array.from({ length: n }, () => g))
        out.push(Array.from({ length: n }, (_, i) => items[i % items.length]))
        if (items.length > 1) out.push(Array.from({ length: n }, (_, i) => (i === 0 ? good[0] : items[1])))
      }
    }
    if (prefix.length) {
      const per = prefix.map((entries) => this.values(entries, depth + 1).slice(0, 20))
      const tuples = [0, 1, 2].map((k) =>
        prefix.map((entries, i) => {
          const sideEntries = k === 0 ? entries : entries.filter((e) => e.side === (k === 1 ? "b" : "a"))
          return per[i].find((v) => this.satisfies(sideEntries, v)) ?? per[i][0]
        }),
      )
      for (const tuple of tuples) {
        out.push(tuple, tuple.slice(0, -1), [...tuple, "extra"], [...tuple, 1])
        for (const g of good) out.push([...tuple, g])
        per.forEach((cands, i) => {
          for (const c of cands) out.push(tuple.map((t, j) => (i === j ? c : t)))
        })
      }
    }
    return out
  }

  private objects(all: Entry[], depth: number): unknown[] {
    const names = new Set<string>()
    const propEntries = new Map<string, Entry[]>()
    for (const e of all) {
      if (isObj(e.s.properties)) {
        for (const [n, s] of Object.entries(e.s.properties)) {
          names.add(n)
          propEntries.set(n, [...(propEntries.get(n) ?? []), { ...e, s }])
        }
      }
      if (Array.isArray(e.s.required)) e.s.required.forEach((n: string) => names.add(n))
      if (isObj(e.s.dependentRequired)) {
        for (const [k, v] of Object.entries(e.s.dependentRequired)) {
          names.add(k)
          if (Array.isArray(v)) v.forEach((n) => names.add(String(n)))
        }
      }
      if (isObj(e.s.dependencies)) Object.keys(e.s.dependencies).forEach((n) => names.add(n))
    }
    const extras = ["zz", "x-a", "a_name"]
    const patternEntries = (n: string) =>
      all.flatMap((e) =>
        isObj(e.s.patternProperties)
          ? Object.entries(e.s.patternProperties)
              .filter(([p]) => {
                try {
                  return new RegExp(p, "u").test(n)
                } catch {
                  return false
                }
              })
              .map(([, s]) => ({ ...e, s }))
          : [],
      )
    const additional = all.flatMap((e) =>
      ["additionalProperties", "unevaluatedProperties"].filter((k) => isObj(e.s[k])).map((k) => ({ ...e, s: e.s[k] })),
    )
    const candidates = new Map<string, unknown[]>()
    const good = new Map<string, unknown[]>()
    for (const n of [...names, ...extras]) {
      const own = [...(propEntries.get(n) ?? []), ...patternEntries(n)]
      const entries = [...own, ...(names.has(n) ? [] : additional)]
      const values = interleave([], [entries.length ? this.values(entries, depth + 1).slice(0, LIMIT) : [], GENERIC])
      candidates.set(n, values)
      good.set(n, this.bases(own, values))
    }
    const known = [...names]
    // bases: every known property with a value valid on both sides, on the before side, on the after side
    const bases = [0, 1, 2].map((k) =>
      Object.fromEntries(
        known.map((n) => {
          const own = propEntries.get(n) ?? []
          const side = k === 0 ? own : own.filter((e) => e.side === (k === 1 ? "b" : "a"))
          const v = (candidates.get(n) as unknown[]).find((c) => this.satisfies(side, c))
          return [n, v ?? (good.get(n) as unknown[])[0]]
        }),
      ),
    )
    // structural variants first (a nested object is cut to a prefix of this list by its parent)
    const out: unknown[] = [{}, ...bases]
    for (const base of bases) {
      for (const n of known) {
        const { [n]: _, ...without } = base
        out.push(without, { [n]: base[n] })
      }
    }
    const few = (n: string, k: number) => (candidates.get(n) as unknown[]).slice(0, k)
    for (const base of bases) {
      for (const n of known) for (const c of few(n, 4)) out.push({ ...base, [n]: c })
      if (known.length <= 6) {
        // one property removed while another changes (conditionals, dependencies)
        for (const n of known) {
          const { [n]: _, ...without } = base
          for (const m of known) if (m !== n) for (const c of few(m, 4)) out.push({ ...without, [m]: c })
        }
      }
      for (const n of extras) for (const c of few(n, 8)) out.push({ ...base, [n]: c }, { [n]: c })
      for (const L of nums(all, ["minProperties", "maxProperties"])) {
        for (const n of [L - 1, L, L + 1]) {
          if (n < 0 || n > 20) continue
          const pool = [...known, ...Array.from({ length: n }, (_, i) => `k${i}`)]
          out.push(Object.fromEntries(pool.slice(0, n).map((k) => [k, base[k] ?? 1])))
        }
      }
    }
    for (const base of bases) {
      for (const n of known) for (const c of candidates.get(n) as unknown[]) out.push({ ...base, [n]: c })
      if (known.length <= 6) {
        for (const n of known) {
          const { [n]: _, ...without } = base
          for (const m of known) if (m !== n) for (const c of few(m, 12)) out.push({ ...without, [m]: c })
        }
      }
    }
    return out
  }
}

// ---------------------------------------------------------------------------------------------------------------
// cases

const findCaseFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findCaseFiles(full)
    return entry.name.endsWith(".test.ts") && fs.readFileSync(full, "utf8").includes("runCases(") ? [full] : []
  })

export type Verdict =
  | "agree"
  | "disagree" // the expectation is not breaking, a witness proves it is
  | "no-witness" // the expectation is breaking, no generated instance shows it
  | "annotation-equivalent"
  | "annotation-not-equivalent"
  | "excluded"

export interface OracleRow {
  id: string
  caseId: string
  placement: string
  direction: string
  expected: string
  verdict: Verdict
  witness?: unknown
  reason?: string
  file: string
}

export const runOracle = async (filter?: string): Promise<{ rows: OracleRow[]; ajv: string }> => {
  const ajvDir = findAjv()
  if (!ajvDir) throw new Error(`ajv 8 not found (looked in ${ajvDirs().join(", ")}); set ASD_ORACLE_AJV`)
  const { Ajv2020, Ajv2019, Ajv07, draft06 } = loadAjv(ajvDir)
  const make = (C: AjvClass) => {
    const ajv = new C({ strict: false, allErrors: false, validateFormats: true, validateSchema: false })
    for (const [name, f] of Object.entries(formats)) ajv.addFormat(name, f)
    return ajv
  }
  const ajvs = { 2020: make(Ajv2020), 2019: make(Ajv2019), 7: make(Ajv07) }
  ajvs[7].addMetaSchema?.(draft06)
  const pickAjv = (draft?: string) =>
    !draft || draft.includes("2020-12") ? ajvs[2020] : draft.includes("2019-09") ? ajvs[2019] : ajvs[7]

  process.env.ASD_COMPAT_COLLECT = "1"
  const { collected, variantsOf, expectedType } = await import("../helpers/compat")
  for (const file of findCaseFiles(compatDir).sort()) {
    const before = collected.length
    try {
      await import(file)
    } catch (error) {
      console.error(`cannot load ${path.relative(root, file)}: ${error}`)
      process.exitCode = 1
    }
    for (let i = before; i < collected.length; i++) collected[i].file = path.relative(root, file)
  }

  const rows: OracleRow[] = []
  for (const group of collected) {
    if (group.family === "asyncapi-payload") continue
    for (const c of group.cases as CompatCase[]) {
      if (c.kind !== "schema" || (filter && !c.id.includes(filter))) continue
      const sc = c as SchemaCase
      const oasOnly = usesKeywords([sc.schema, sc.components], OAS_ONLY)
      const draft04 = !!sc.draft?.includes("draft-04")
      const oas30 = sc.dialect === "3.0"
      const docOf = (s: Schema, placement: string) => {
        const n = normalize(s, { oas30, draft04 })
        const defs = sc.components ? normalize(sc.components, { oas30, draft04 }) : undefined
        if (typeof n === "boolean") return defs ? { $defs: defs, allOf: [n] } : n
        if (n === undefined) return true
        const doc = { ...(defs ? { $defs: defs } : {}), ...n }
        if (placement === "json" && sc.draft && !draft04) doc.$schema = sc.draft
        if (placement === "json" && draft04) doc.$schema = "http://json-schema.org/draft-07/schema#"
        return doc
      }
      for (const v of variantsOf(c, group.family, group.area) as Variant[]) {
        if (!["request", "response", "json"].includes(v.name)) continue
        const row: OracleRow = {
          id: v.id,
          caseId: c.id,
          placement: v.name,
          direction: v.direction ?? "request",
          expected: "",
          verdict: "excluded",
          file: group.file,
        }
        rows.push(row)
        const types = v.expect.map((e) => expectedType(e, v) ?? "?")
        row.expected = types.join("+")
        if (!types.length) {
          row.reason = "no expected change"
          continue
        }
        if (oasOnly.length) {
          row.reason = `semantics beyond JSON Schema validation (${oasOnly.join(", ")})`
          continue
        }
        const other = types.filter((t) => !["breaking", "non-breaking", "annotation"].includes(t))
        if (other.length) {
          row.reason = `expects ${[...new Set(other)].join(", ")}`
          continue
        }
        const draft = v.name === "json" ? (draft04 ? "http://json-schema.org/draft-07/schema#" : sc.draft) : undefined
        const ajv = pickAjv(draft)
        const bDoc = docOf(sc.schema[0], v.name)
        const aDoc = docOf(sc.schema[1], v.name)
        let vB: (x: unknown) => boolean
        let vA: (x: unknown) => boolean
        try {
          vB = ajv.compile(bDoc)
          vA = ajv.compile(aDoc)
        } catch (error) {
          row.reason = `ajv: ${String(error).slice(0, 120)}`
          continue
        }
        const gen = new Generator((s, doc) => {
          if (typeof s === "boolean") return () => s
          const defs = isObj(doc) ? { $defs: doc.$defs, definitions: doc.definitions } : {}
          return ajv.compile({ ...(draft ? { $schema: draft } : {}), ...defs, ...s })
        })
        const entries: Entry[] = [
          { s: bDoc, doc: bDoc, side: "b" as const },
          { s: aDoc, doc: aDoc, side: "a" as const },
        ].filter((e) => isObj(e.s))
        // a client of the before contract never sends a property only the after contract declares (and vice versa)
        const namesB = declaredNames(bDoc)
        const namesA = declaredNames(aDoc)
        const onlyA = new Set([...namesA].filter((n) => !namesB.has(n)))
        const onlyB = new Set([...namesB].filter((n) => !namesA.has(n)))
        let narrowed: unknown
        let widened: unknown
        try {
          const instances = entries.length ? gen.values(entries) : GENERIC
          narrowed = instances.find((x) => vB(x) && !vA(x) && !usesNames(x, onlyA)) // valid before, invalid after
          widened = instances.find((x) => vA(x) && !vB(x) && !usesNames(x, onlyB)) // valid after, invalid before
        } catch (error) {
          // e.g. ajv overflowing its stack on a dynamic-scope cycle
          row.reason = `generator / validator failed: ${String(error).slice(0, 120)}`
          continue
        }
        const witness = row.direction === "response" ? widened : narrowed
        const breakingExpected = types.includes("breaking")
        if (types.every((t) => t === "annotation")) {
          const w = narrowed !== undefined ? narrowed : widened
          row.verdict = w === undefined ? "annotation-equivalent" : "annotation-not-equivalent"
          if (w !== undefined) row.witness = w
          continue
        }
        if (breakingExpected) {
          row.verdict = witness !== undefined ? "agree" : "no-witness"
        } else {
          row.verdict = witness === undefined ? "agree" : "disagree"
        }
        if (witness !== undefined) row.witness = witness
      }
    }
  }
  return { rows, ajv: path.relative(root, ajvDir) || ajvDir }
}

export const readExceptions = (): Record<string, string> =>
  fs.existsSync(exceptionsFile) ? JSON.parse(fs.readFileSync(exceptionsFile, "utf8")) : {}

/** rows whose verdict needs a listed reason, and listed reasons that no longer apply */
export const checkOracle = (rows: OracleRow[], exceptions = readExceptions()) => {
  const needs = rows.filter((r) => ["disagree", "no-witness", "annotation-not-equivalent"].includes(r.verdict))
  const unexplained = needs.filter((r) => !exceptions[r.id])
  const ids = new Set(needs.map((r) => r.id))
  const stale = Object.keys(exceptions).filter((id) => !ids.has(id))
  return { needs, unexplained, stale }
}

const main = async () => {
  const args = process.argv.slice(2)
  const verbose = args.includes("-v")
  const filter = args.find((a) => !a.startsWith("-"))
  const { rows, ajv } = await runOracle(filter)
  const count = (v: Verdict) => rows.filter((r) => r.verdict === v).length
  if (args.includes("--json")) {
    const { unexplained, stale } = checkOracle(rows)
    const verdicts: Verdict[] = [
      "agree",
      "disagree",
      "no-witness",
      "annotation-equivalent",
      "annotation-not-equivalent",
    ]
    const summary = Object.fromEntries([...verdicts, "excluded" as Verdict].map((v) => [v, count(v)]))
    console.log(JSON.stringify({ summary, unexplained: unexplained.map((r) => r.id), stale }))
    return
  }
  console.log(`JSON Schema oracle (ajv: ${ajv}): ${rows.length} schema-case variants`)
  for (const v of [
    "agree",
    "disagree",
    "no-witness",
    "annotation-equivalent",
    "annotation-not-equivalent",
    "excluded",
  ] as Verdict[]) {
    console.log(`  ${v}: ${count(v)}`)
  }
  const exceptions = readExceptions()
  const { unexplained, stale, needs } = checkOracle(rows, exceptions)
  const show = (r: OracleRow) =>
    `- ${r.id} expected ${r.expected} → ${r.verdict}${r.witness !== undefined ? ` witness ${JSON.stringify(r.witness)}` : ""}${exceptions[r.id] ? `  [${exceptions[r.id]}]` : ""}`
  console.log(`\naccepted (listed in jsonschema-oracle-exceptions.json): ${needs.length - unexplained.length}`)
  if (verbose) needs.filter((r) => exceptions[r.id]).forEach((r) => console.log(show(r)))
  if (unexplained.length) {
    console.log(`\nUNEXPLAINED: ${unexplained.length}`)
    unexplained.forEach((r) => console.log(show(r)))
  }
  if (stale.length && !filter) console.log(`\nSTALE EXCEPTIONS: ${stale.join(", ")}`)
  if (verbose) {
    const excluded = new Map<string, number>()
    for (const r of rows.filter((x) => x.verdict === "excluded"))
      excluded.set(r.reason ?? "", (excluded.get(r.reason ?? "") ?? 0) + 1)
    console.log("\nexcluded by reason:")
    for (const [k, n] of [...excluded].sort((a, b) => b[1] - a[1])) console.log(`  ${n} ${k}`)
  }
  if (args.includes("--write") && !filter) {
    const summary = Object.fromEntries(
      (
        [
          "agree",
          "disagree",
          "no-witness",
          "annotation-equivalent",
          "annotation-not-equivalent",
          "excluded",
        ] as Verdict[]
      ).map((v) => [v, count(v)]),
    )
    fs.writeFileSync(
      resultFile,
      `${JSON.stringify(
        {
          generated: "vpx test/compat/oracle.ts --write",
          ajv,
          summary,
          rows: rows.map(({ file: _file, ...r }) => r),
        },
        null,
        1,
      )}\n`,
    )
    console.log(`\nwrote ${path.relative(root, resultFile)}`)
  }
}

if (import.meta.main) main()
