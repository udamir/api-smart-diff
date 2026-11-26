import type { JsonPath } from "json-crawl"

import type { Diff, NodeContext } from "../types"
import { getKeyValue, isObject } from "../utils"

// Helpers of the ProtoApi engine (PROTOAPI_DESIGN §4.2): effective values, element lookup (R-1), file and oneof
// pairing shared by the mapping resolvers and the transforms, interval sets. Nothing here imports protoapi.

export type Interval = [number, number]

type Obj = Record<string, unknown>

const asObject = (value: unknown): Obj | undefined => (isObject(value) && !Array.isArray(value) ? value : undefined)

// ---- scalar positions

/** The protobuf integer scalar types. */
export const PROTO_INTEGER_TYPES: ReadonlySet<string> = new Set([
  "int32",
  "int64",
  "uint32",
  "uint64",
  "sint32",
  "sint64",
  "fixed32",
  "fixed64",
  "sfixed32",
  "sfixed64",
])

/** The protobuf floating-point scalar types. */
export const PROTO_FLOAT_TYPES: ReadonlySet<string> = new Set(["float", "double"])

/** Every protobuf scalar type. */
export const PROTO_SCALAR_TYPES: ReadonlySet<string> = new Set([
  ...PROTO_INTEGER_TYPES,
  ...PROTO_FLOAT_TYPES,
  "bool",
  "string",
  "bytes",
])

/**
 * The protobuf scalar type of a scalar position (a field, `items`, `propertyNames`, `additionalProperties`): ProtoApi
 * 0.1 writes it in `type` (`type: int64`, `type: bytes`); `undefined` for a message or enum reference, a repeated or
 * map field (`array`, `object`) and a shadow whose `type` carries a shape spelling.
 */
export const scalarTypeOf = (position: unknown): string | undefined => {
  const type = getKeyValue(position, "type")
  return typeof type === "string" && PROTO_SCALAR_TYPES.has(type) ? type : undefined
}

/** The value of a context chain's root: the (transformed) document the node belongs to. */
export const shadowRoot = (node: NodeContext): unknown => {
  let current = node
  while (current.up) {
    current = current.up
  }
  return current.value
}

// ---- JSON names (rule J, package design §3.4)

/**
 * The JSON name protoc derives from a field name (`ToJsonName`): underscores are dropped and the letter after each
 * one is upper-cased; nothing else changes (`foo_bar` → `fooBar`, `Foo` → `Foo`, `foo__bar` → `fooBar`).
 */
export const defaultJsonName = (name: string): string => {
  let result = ""
  let upper = false
  for (const char of name) {
    if (char === "_") {
      upper = true
    } else if (upper) {
      result += char.toUpperCase()
      upper = false
    } else {
      result += char
    }
  }
  return result
}

/** The effective JSON name of a field (rule J: `jsonName` is written only when it differs from the default). */
export const effectiveJsonName = (field: unknown, name: string): string => {
  const jsonName = getKeyValue(field, "jsonName")
  return typeof jsonName === "string" ? jsonName : defaultJsonName(name)
}

// ---- references

export const MESSAGE_REF_PREFIX = "#/components/messages/"
export const ENUM_REF_PREFIX = "#/components/enums/"

/** The fully qualified name a nominal `$ref` names (`#/components/messages/p.M` → `p.M`), else `undefined`. */
export const refTarget = (ref: unknown): { kind: "messages" | "enums"; name: string } | undefined => {
  if (typeof ref !== "string") {
    return
  }
  if (ref.startsWith(MESSAGE_REF_PREFIX)) {
    return { kind: "messages", name: ref.slice(MESSAGE_REF_PREFIX.length) }
  }
  if (ref.startsWith(ENUM_REF_PREFIX)) {
    return { kind: "enums", name: ref.slice(ENUM_REF_PREFIX.length) }
  }
  return
}

// ---- field shape (DG-01, `fieldShapeTransform`)

// the spelling of one scalar position (a field, `items`, `propertyNames`, `additionalProperties`): the scalar name, or
// the fully qualified name of the message or enum it references
const positionSpelling = (position: unknown): string | undefined => {
  const target = refTarget(getKeyValue(position, "$ref"))
  if (target) {
    return target.name
  }
  return scalarTypeOf(position)
}

/**
 * The canonical spelling of a field's shape: `int64`, `pkg.M`, `pkg.E`, `repeated <item>`, `map<K, V>`; `undefined`
 * when the value is not a field of a ProtoApi document (no scalar type and no reference).
 */
export const fieldShape = (field: unknown): string | undefined => {
  const value = asObject(field)
  if (!value) {
    return
  }
  if (value.type === "array" && isObject(value.items)) {
    const item = positionSpelling(value.items)
    return item === undefined ? undefined : `repeated ${item}`
  }
  if (value.type === "object" && isObject(value.additionalProperties) && isObject(value.propertyNames)) {
    const key = positionSpelling(value.propertyNames)
    const item = positionSpelling(value.additionalProperties)
    return key === undefined || item === undefined ? undefined : `map<${key}, ${item}>`
  }
  return positionSpelling(value)
}

/** Whether a field is a singular message or enum field (its shape is a reference). */
export const isSingularReference = (field: unknown): boolean => refTarget(getKeyValue(field, "$ref")) !== undefined

// ---- fields

/** Field entries of a message's `properties` by number, the first declaration of a number winning (IN-11). */
export const fieldsByNumber = (properties: unknown): Map<number, string> => {
  const result = new Map<number, string>()
  const value = asObject(properties)
  if (!value) {
    return result
  }
  for (const key of Object.keys(value)) {
    const number = getKeyValue(value[key], "number")
    if (typeof number === "number" && !result.has(number)) {
      result.set(number, key)
    }
  }
  return result
}

/** Pairs the fields of two `properties` objects by number: before key → after key (first declaration wins). */
export const pairFields = (before: unknown, after: unknown): Map<string, string> => {
  const result = new Map<string, string>()
  const aByNumber = fieldsByNumber(after)
  for (const [number, bKey] of fieldsByNumber(before)) {
    const aKey = aByNumber.get(number)
    if (aKey !== undefined) {
      result.set(bKey, aKey)
    }
  }
  return result
}

// ---- extensions (A3)

/**
 * Pairs the extensions of two documents (A3): by key, then a remaining before extension with a remaining after
 * extension of the same `extendee` and `number`. Returns before key → after key.
 */
export const pairExtensions = (before: unknown, after: unknown): Map<string, string> => {
  const result = new Map<string, string>()
  const bEntries = asObject(before) ?? {}
  const aEntries = asObject(after) ?? {}
  const aRemaining = new Set(Object.keys(aEntries).filter((key) => !(key in bEntries)))
  for (const key of Object.keys(bEntries)) {
    if (key in aEntries) {
      result.set(key, key)
      continue
    }
    const number = getKeyValue(bEntries[key], "number")
    const extendee = getKeyValue(bEntries[key], "extendee")
    if (number === undefined) {
      continue
    }
    for (const candidate of aRemaining) {
      if (
        getKeyValue(aEntries[candidate], "number") === number &&
        getKeyValue(aEntries[candidate], "extendee") === extendee
      ) {
        result.set(key, candidate)
        aRemaining.delete(candidate)
        break
      }
    }
  }
  return result
}

// ---- oneofs (G3)

/** Member numbers of every oneof of a message (`oneof` keyword of its fields). */
const oneofMembers = (message: unknown): Map<string, Set<number>> => {
  const result = new Map<string, Set<number>>()
  const properties = asObject(getKeyValue(message, "properties"))
  if (!properties) {
    return result
  }
  for (const key of Object.keys(properties)) {
    const field = properties[key]
    const oneof = getKeyValue(field, "oneof")
    const number = getKeyValue(field, "number")
    if (typeof oneof !== "string" || typeof number !== "number") {
      continue
    }
    let set = result.get(oneof)
    if (!set) {
      set = new Set()
      result.set(oneof, set)
    }
    set.add(number)
  }
  return result
}

const sameSet = (a: Set<number> | undefined, b: Set<number> | undefined): boolean => {
  if (!a || !b || a.size !== b.size || !a.size) {
    return false
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false
    }
  }
  return true
}

/**
 * Pairs the oneofs of two messages (G3): equal names first, then a remaining before oneof with the remaining after
 * oneof whose (non-empty) member number set is equal. Returns before name → after name.
 */
export const pairOneofs = (before: unknown, after: unknown): Map<string, string> => {
  const result = new Map<string, string>()
  const bOneofs = Object.keys(asObject(getKeyValue(before, "oneofs")) ?? {})
  const aOneofs = Object.keys(asObject(getKeyValue(after, "oneofs")) ?? {})
  const aRemaining = new Set(aOneofs)
  const bRemaining: string[] = []
  for (const name of bOneofs) {
    if (aRemaining.has(name)) {
      result.set(name, name)
      aRemaining.delete(name)
    } else {
      bRemaining.push(name)
    }
  }
  if (!bRemaining.length || !aRemaining.size) {
    return result
  }
  const bMembers = oneofMembers(before)
  const aMembers = oneofMembers(after)
  for (const name of bRemaining) {
    for (const candidate of aRemaining) {
      if (sameSet(bMembers.get(name), aMembers.get(candidate))) {
        result.set(name, candidate)
        aRemaining.delete(candidate)
        break
      }
    }
  }
  return result
}

// ---- files (U3, A5)

/** Whether a file entry of `files` is a bundled file that is not an entry file (U3). */
export const isBundledFile = (entry: unknown): boolean => getKeyValue(entry, "bundled") === true

/** Whether the declaration's file is marked `bundled` in the document (U3). */
export const isBundled = (document: unknown, declaration: unknown): boolean => {
  const file = getKeyValue(declaration, "file")
  return typeof file === "string" && isBundledFile(getKeyValue(document, "files", file))
}

/** Declaration sections of a document: services on top, messages, enums and extensions under `components`. */
export const declarationSections: readonly JsonPath[] = [
  ["services"],
  ["components", "messages"],
  ["components", "enums"],
  ["components", "extensions"],
]

/** The declared element set of every file: `<section>/<key>` of the services and components whose `file` is it. */
export const declaredElements = (document: unknown): Map<string, Set<string>> => {
  const result = new Map<string, Set<string>>()
  for (const section of declarationSections) {
    const entries = asObject(getKeyValue(document, ...section))
    if (!entries) {
      continue
    }
    const name = section[section.length - 1]
    for (const key of Object.keys(entries)) {
      const file = getKeyValue(entries[key], "file")
      if (typeof file !== "string") {
        continue
      }
      let set = result.get(file)
      if (!set) {
        set = new Set()
        result.set(file, set)
      }
      set.add(`${name}/${key}`)
    }
  }
  return result
}

const equalStringSets = (a: Set<string> | undefined, b: Set<string> | undefined): boolean => {
  if (!a || !b || !a.size || a.size !== b.size) {
    return false
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false
    }
  }
  return true
}

/**
 * Renamed files (A5): a file path present only in the before document pairs with a path present only in the after
 * document whose declared element set is identical and not empty. Returns before path → after path.
 */
export const pairFiles = (before: unknown, after: unknown): Map<string, string> => {
  const result = new Map<string, string>()
  const bFiles = asObject(getKeyValue(before, "files"))
  const aFiles = asObject(getKeyValue(after, "files"))
  if (!bFiles || !aFiles) {
    return result
  }
  const bOnly = Object.keys(bFiles).filter((key) => !(key in aFiles))
  const aOnly = new Set(Object.keys(aFiles).filter((key) => !(key in bFiles)))
  if (!bOnly.length || !aOnly.size) {
    return result
  }
  const bDeclared = declaredElements(before)
  const aDeclared = declaredElements(after)
  for (const path of bOnly) {
    for (const candidate of aOnly) {
      if (equalStringSets(bDeclared.get(path), aDeclared.get(candidate))) {
        result.set(path, candidate)
        aOnly.delete(candidate)
        break
      }
    }
  }
  return result
}

// ---- interval sets (Q12)

/** Whether a value is an inclusive interval `[lo, hi]`. */
export const isInterval = (value: unknown): value is Interval =>
  Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number"

/** Sorted, merged interval set of a list of intervals (adjacent and overlapping intervals join). */
export const mergeIntervals = (list: unknown): Interval[] => {
  const items = (Array.isArray(list) ? list : []).filter(isInterval).map(([lo, hi]): Interval => [lo, hi])
  items.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const result: Interval[] = []
  for (const [lo, hi] of items) {
    const last = result[result.length - 1]
    if (last && lo <= last[1] + 1) {
      last[1] = Math.max(last[1], hi)
    } else {
      result.push([lo, hi])
    }
  }
  return result
}

/** The part of the interval `[lo, hi]` not covered by the merged set `set`. */
export const subtractInterval = ([lo, hi]: Interval, set: Interval[]): Interval[] => {
  const result: Interval[] = []
  let start = lo
  for (const [slo, shi] of set) {
    if (shi < start) {
      continue
    }
    if (slo > hi) {
      break
    }
    if (slo > start) {
      result.push([start, slo - 1])
    }
    start = Math.max(start, shi + 1)
    if (start > hi) {
      return result
    }
  }
  if (start <= hi) {
    result.push([start, hi])
  }
  return result
}

/** Whether a number lies in a merged interval set. */
export const inIntervals = (value: number, set: Interval[]): boolean =>
  set.some(([lo, hi]) => lo <= value && value <= hi)

/** Whether two intervals share a number. */
export const overlaps = (a: Interval, b: Interval): boolean => a[0] <= b[1] && b[0] <= a[1]

/** An extension range key of `extension_declarations` (`"100-199"`) as an interval. */
export const parseRangeKey = (key: string): Interval | undefined => {
  const match = /^(\d+)-(\d+)$/.exec(key)
  return match ? [Number(match[1]), Number(match[2])] : undefined
}

// ---- elements (R-1, §4.9)

const pointerStep = (step: string | number): string => String(step).replace(/~/g, "~0").replace(/\//g, "~1")

const pointer = (path: JsonPath): string => (path.length ? `#/${path.map(pointerStep).join("/")}` : "#")

/**
 * The pointer of the innermost element a path lies in (R-1): a file, service, rpc, message, field (with its `items`,
 * `propertyNames`, `additionalProperties`), oneof, extension range (an entry of `extensions`, `extensionOptions` or
 * `options.extension_declarations`), enum, enum value or extension; `#` for the document itself and its containers.
 */
export const elementOf = (path: JsonPath): string => {
  const [s0, s1, s2, s3, s4, s5] = path
  if (s0 === "files") {
    return s1 === undefined ? "#" : pointer(["files", s1])
  }
  if (s0 === "services") {
    if (s1 === undefined) {
      return "#"
    }
    return s2 === "methods" && s3 !== undefined ? pointer(["services", s1, "methods", s3]) : pointer(["services", s1])
  }
  if (s0 !== "components" || s1 === undefined || s2 === undefined) {
    return "#"
  }
  const base: JsonPath = ["components", s1, s2]
  if (s1 === "messages") {
    if (
      (s3 === "properties" || s3 === "oneofs" || s3 === "extensions" || s3 === "extensionOptions") &&
      s4 !== undefined
    ) {
      return pointer([...base, s3, s4])
    }
    if (s3 === "options" && s4 === "extension_declarations" && s5 !== undefined) {
      return pointer([...base, s3, s4, s5])
    }
    return pointer(base)
  }
  if (s1 === "enums") {
    return s3 === "values" && s4 !== undefined ? pointer([...base, s3, s4]) : pointer(base)
  }
  return pointer(base)
}

/**
 * The element of a record (R-1): `elementOf(diff.path)`, except that a rename diff, reported at the container of the
 * renamed entry, belongs to the entry (its before key).
 */
export const diffElement = (diff: Diff): string =>
  diff.action === "rename" ? elementOf([...diff.path, diff.before as string | number]) : elementOf(diff.path)

const BASE64 = /^[A-Za-z0-9+/_-]*={0,2}$/

/** The bytes of a `bytes` value (base64 or base64url in the document), `undefined` when it is not base64. */
export const decodeProtoBytes = (value: string): number[] | undefined => {
  if (!BASE64.test(value)) {
    return
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of value.replace(/=+$/, "")) {
    const index = alphabet.indexOf(char === "-" ? "+" : char === "_" ? "/" : char)
    if (index < 0) {
      return
    }
    buffer = (buffer << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return bytes
}

/** The UTF-8 bytes of a `string` value. */
export const utf8Bytes = (value: string): number[] => [...new TextEncoder().encode(value)]
