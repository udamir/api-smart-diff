import type { JsonPath } from "json-crawl"

import { createAnnotation, formatText, MAX_STRING_LENGTH, ruleView } from "../core"
import type { AnnotateHook, CompareContext, Diff, NodeContext } from "../types"
import { getKeyValue, isObject } from "../utils"
import { effectiveVisibility } from "./protoapi.classify"
import { protoApiLanguageFeatures, protoApiResolvedFeatures } from "./protoapi.const"
import type { ProtoApiMergeCause, ProtoApiMergeDescriber } from "./protoapi.merge"
import { methodSideSpelling } from "./protoapi.resolver"
import { effectiveEnumDefault } from "./protoapi.transform"
import {
  type Interval,
  decodeProtoBytes,
  effectiveJsonName,
  isInterval,
  mergeIntervals,
  PROTO_INTEGER_TYPES,
  refTarget,
  scalarTypeOf,
  shadowRoot,
} from "./protoapi.utils"

// Descriptions of ProtoApi records (PROTOAPI_DESIGN §4.11, §7.2, R-D): generic and valid for the original `.proto`
// files. Elements and properties are named by protobuf terms (the dictionary of §7.2), never by ProtoApi or JSON
// Schema keys; values are written as `.proto` literals (`formatProtoValue`, the value table of §7.2). The describer
// reads the diff's path and values and the documents of the comparison; it does not use the core templates, whose
// generated fallback names document keys.

type Obj = Record<string, unknown>

const asObject = (value: unknown): Obj | undefined => (isObject(value) && !Array.isArray(value) ? value : undefined)

// a scalar as text; an object or a list as JSON (never `[object Object]`)
const plain = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "object" && value !== null
      ? (JSON.stringify(value) ?? "")
      : String(value)

/** The documents a description reads: the walk shadows (keys as compared) and the inputs (original values). */
export type ProtoApiDescribeDocuments = {
  before: unknown
  after: unknown
  originalBefore?: unknown
  originalAfter?: unknown
}

// ---- values (§7.2 value table)

const INTEGER_TYPES = PROTO_INTEGER_TYPES

/** The `.proto` type of a value position: a scalar type name, `enum`, `message`, or `undefined` (read from the JSON). */
export type ProtoValueType = string | undefined

const ENUM_LIKE = /^[A-Z][A-Z0-9_]*$/
const DIGITS = /^-?\d+$/

/** A string as a `.proto` string literal: double-quoted with C escapes. */
export const protoStringLiteral = (value: string): string => {
  let result = '"'
  for (const char of value) {
    const code = char.codePointAt(0) as number
    if (char === '"') {
      result += '\\"'
    } else if (char === "\\") {
      result += "\\\\"
    } else if (char === "\n") {
      result += "\\n"
    } else if (char === "\r") {
      result += "\\r"
    } else if (char === "\t") {
      result += "\\t"
    } else if (code < 0x20 || code === 0x7f) {
      result += `\\x${code.toString(16).padStart(2, "0")}`
    } else {
      result += char
    }
  }
  return `${result}"`
}

/** Bytes (base64 in the document) as a `.proto` string literal: printable ASCII kept, `\xHH` otherwise. */
export const protoBytesLiteral = (value: string): string => {
  const bytes = decodeProtoBytes(value)
  if (!bytes) {
    return protoStringLiteral(value)
  }
  let result = '"'
  for (const byte of bytes) {
    if (byte === 0x22) {
      result += '\\"'
    } else if (byte === 0x5c) {
      result += "\\\\"
    } else if (byte >= 0x20 && byte < 0x7f) {
      result += String.fromCharCode(byte)
    } else {
      result += `\\x${byte.toString(16).padStart(2, "0")}`
    }
  }
  return `${result}"`
}

const floatLiteral = (value: unknown): string => {
  if (value === "Infinity" || value === Number.POSITIVE_INFINITY) {
    return "inf"
  }
  if (value === "-Infinity" || value === Number.NEGATIVE_INFINITY) {
    return "-inf"
  }
  if (value === "NaN" || (typeof value === "number" && Number.isNaN(value))) {
    return "nan"
  }
  if (Object.is(value, -0) || value === "-0") {
    return "-0"
  }
  return String(value)
}

// a JSON value whose `.proto` type is not known: booleans and numbers as written, an enum-like identifier bare, a
// digit string (a 64-bit value) unquoted, other strings quoted, objects and lists in text format
const untypedLiteral = (value: unknown): string => {
  if (typeof value === "string") {
    if (ENUM_LIKE.test(value) || DIGITS.test(value)) {
      return value
    }
    if (value === "Infinity" || value === "-Infinity" || value === "NaN") {
      return floatLiteral(value)
    }
    return protoStringLiteral(value)
  }
  if (typeof value === "number") {
    return floatLiteral(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(untypedLiteral).join(", ")}]`
  }
  if (isObject(value)) {
    const entries = Object.keys(value).map((key) => `${key}: ${untypedLiteral(value[key])}`)
    return entries.length ? `{ ${entries.join(", ")} }` : "{}"
  }
  return String(value)
}

/**
 * A value as a `.proto` literal (R-D, §7.2 value table), for the `.proto` type of its position: 64-bit integers as
 * unquoted digits, `float` / `double` with `inf`, `-inf`, `nan`, `-0`, `bool`, strings double-quoted with C escapes,
 * bytes (base64 in the document) as C-escaped string literals, enum values bare, messages (aggregates) in text format
 * (`{ shard: 4 }`), lists as `[a, b]`. Without a type the JSON value decides.
 */
export const formatProtoValue = (value: unknown, type?: ProtoValueType): string => {
  if (value === undefined) {
    return ""
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatProtoValue(item, type)).join(", ")}]`
  }
  if (type && INTEGER_TYPES.has(type)) {
    return typeof value === "string" || typeof value === "number" ? String(value) : untypedLiteral(value)
  }
  if (type === "float" || type === "double") {
    return floatLiteral(value)
  }
  if (type === "bool") {
    return plain(value)
  }
  if (type === "string" && typeof value === "string") {
    return protoStringLiteral(value)
  }
  if (type === "bytes" && typeof value === "string") {
    return protoBytesLiteral(value)
  }
  if (type === "enum" && typeof value === "string") {
    return value
  }
  return untypedLiteral(value)
}

/** A literal in a code span, capped at POLICY-108's length. */
const code = (text: string): string => {
  const capped = text.length > MAX_STRING_LENGTH ? `${text.slice(0, MAX_STRING_LENGTH).trimEnd()}…` : text
  return `\`${capped.replace(/`/g, "'")}\``
}

/** A range of numbers: `8`, `150 to 199`, `1000 to max`. */
export const formatRange = ([lo, hi]: Interval, max?: number): string =>
  lo === hi ? String(lo) : `${lo} to ${max !== undefined && hi >= max ? "max" : String(hi)}`

/** A list of ranges: `5, 7 to 9`. */
export const formatRanges = (list: unknown, max?: number): string =>
  (Array.isArray(list) && isInterval(list) ? [list] : mergeIntervals(list))
    .map((item) => formatRange(item, max))
    .join(", ")

const rangeCount = (list: unknown): number =>
  (Array.isArray(list) && isInterval(list) ? [list] : mergeIntervals(list)).reduce(
    (sum, [lo, hi]) => sum + hi - lo + 1,
    0,
  )

// the largest field number and enum value (`max` in ranges)
const FIELD_MAX = 536870911
const ENUM_MAX = 2147483647

/** The syntax of a file as its statement: `syntax = "proto3"`, `edition = "2023"`; absent reads `syntax = "proto2"`. */
export const formatSyntax = (syntax: unknown): string => {
  if (syntax === undefined || syntax === "proto2" || syntax === "proto3") {
    return `syntax = "${syntax ?? "proto2"}"`
  }
  return `edition = "${plain(syntax)}"`
}

/** An option key as written in `.proto`: built-in options bare, extensions in parentheses, sub-paths after them. */
export const formatOptionName = (key: string, sub: readonly (string | number)[] = []): string => {
  const subPath = (items: readonly (string | number)[]) =>
    items.map((item) => (typeof item === "number" ? `[${item}]` : `.${item}`)).join("")
  if (key === "features") {
    const [feature, ...rest] = sub
    if (feature === undefined) {
      return "features"
    }
    const name = String(feature)
    return protoApiLanguageFeatures.includes(name)
      ? `features.(${name})${subPath(rest)}`
      : `features.${name}${subPath(rest)}`
  }
  const language = protoApiLanguageFeatures.find((set) => key.startsWith(`features.${set}.`))
  if (language) {
    return `features.(${language})${subPath([key.slice(`features.${language}.`.length), ...sub])}`
  }
  return key.includes(".") ? `(${key})${subPath(sub)}` : `${key}${subPath(sub)}`
}

/** An HTTP binding: `` `GET /v1/pets/{id}` `` with ` (body `*`)` and ` (response body `r`)`. */
export const formatHttpBinding = (binding: unknown): string => {
  const method = getKeyValue(binding, "method")
  const path = getKeyValue(binding, "path")
  let text = code(`${typeof method === "string" ? method : "CUSTOM"} ${typeof path === "string" ? path : ""}`.trim())
  const body = getKeyValue(binding, "body")
  if (typeof body === "string") {
    text += ` (body ${code(body)})`
  }
  const responseBody = getKeyValue(binding, "responseBody")
  if (typeof responseBody === "string") {
    text += ` (response body ${code(responseBody)})`
  }
  return text
}

// ---- documents

const valueAt = (document: unknown, path: JsonPath): unknown => getKeyValue(document, ...path)

// a node of the documents, the side of the diff first, the shadows before the inputs
const lookup = (docs: ProtoApiDescribeDocuments, path: JsonPath, after: boolean): unknown => {
  const order = after
    ? [docs.after, docs.originalAfter, docs.before, docs.originalBefore]
    : [docs.before, docs.originalBefore, docs.after, docs.originalAfter]
  for (const document of order) {
    const value = valueAt(document, path)
    if (value !== undefined) {
      return value
    }
  }
  return
}

// ---- elements (§7.2 "Elements and containers")

type Element = {
  kind: string
  path: JsonPath
  // the element without its container: "field `id` (1)"
  label: string
  // the container: "message `p.M`" ("file `a.proto`" for declarations, PD-24)
  owner?: string
  // the element with its container: "field `id` (1) in message `p.M`"
  full: string
  // the label used when the element is added or removed ("required field `id` (1)")
  record?: string
  // the container named when a declaration is added or removed: its declaring file (PD-24)
  file?: string
  // the declaration a property belongs to (a field, an extension body) for value types
  node?: unknown
}

const fileOf = (docs: ProtoApiDescribeDocuments, path: JsonPath, after: boolean): string | undefined => {
  const file = getKeyValue(lookup(docs, path, after), "file")
  return typeof file === "string" ? file : undefined
}

const numberSuffix = (node: unknown): string => {
  const number = getKeyValue(node, "number")
  return typeof number === "number" ? ` (${number})` : ""
}

const isRequiredField = (field: unknown): boolean =>
  getKeyValue(field, "required") === true || getKeyValue(field, "presence") === "required"

/** The element a path lies in (the innermost one, R-1) and the path inside it. */
const locateElement = (
  docs: ProtoApiDescribeDocuments,
  path: JsonPath,
  after: boolean,
): { element: Element; rest: JsonPath } => {
  const [s0, s1, s2, s3, s4, s5] = path
  const make = (element: Omit<Element, "full">, length: number) => ({
    element: { ...element, full: element.owner ? `${element.label} in ${element.owner}` : element.label },
    rest: path.slice(length),
  })
  const declarationOwner = (at: JsonPath) => {
    const file = fileOf(docs, at, after)
    return file !== undefined ? `file ${code(file)}` : undefined
  }
  if (s0 === "files" && s1 !== undefined) {
    const file = String(s1)
    const bundled = getKeyValue(lookup(docs, ["files", file], after), "bundled") === true
    return make(
      {
        kind: "file",
        path: ["files", file],
        label: `file ${code(file)}`,
        record: `${bundled ? "bundled " : ""}file ${code(file)}`,
      },
      2,
    )
  }
  if (s0 === "services" && s1 !== undefined) {
    const service = String(s1)
    if (s2 === "methods" && s3 !== undefined) {
      return make(
        {
          kind: "rpc",
          path: ["services", service, "methods", s3],
          label: `rpc ${code(String(s3))}`,
          owner: `service ${code(service)}`,
        },
        4,
      )
    }
    return make(
      {
        kind: "service",
        path: ["services", service],
        label: `service ${code(service)}`,
        file: declarationOwner(["services", service]),
      },
      2,
    )
  }
  if (s0 === "components" && s1 === "messages" && s2 !== undefined) {
    const message = String(s2)
    const base: JsonPath = ["components", "messages", message]
    const messageName = `message ${code(message)}`
    if (s3 === "properties" && s4 !== undefined) {
      const fieldPath = [...base, "properties", s4]
      const field = lookup(docs, fieldPath, after)
      const label = `field ${code(String(s4))}${numberSuffix(field)}`
      return make(
        {
          kind: "field",
          path: fieldPath,
          label,
          owner: messageName,
          record: isRequiredField(field) ? `required ${label}` : label,
          node: field,
        },
        5,
      )
    }
    if (s3 === "oneofs" && s4 !== undefined) {
      return make(
        { kind: "oneof", path: [...base, "oneofs", s4], label: `oneof ${code(String(s4))}`, owner: messageName },
        5,
      )
    }
    if (s3 === "extensionOptions" && typeof s4 === "number") {
      const entry = lookup(docs, [...base, "extensionOptions", s4], after)
      const range = getKeyValue(entry, "range")
      const label = `extension range ${code(isInterval(range) ? formatRange(range, FIELD_MAX) : String(s4))}`
      return make({ kind: "range", path: [...base, "extensionOptions", s4], label: `${label} of ${messageName}` }, 5)
    }
    if (s3 === "options" && s4 === "extension_declarations" && s5 !== undefined) {
      const match = /^(\d+)-(\d+)$/.exec(String(s5))
      const range = match ? formatRange([Number(match[1]), Number(match[2])], FIELD_MAX) : String(s5)
      return make(
        {
          kind: "range",
          path: [...base, "options", "extension_declarations", s5],
          label: `extension range ${code(range)} of ${messageName}`,
        },
        6,
      )
    }
    return make({ kind: "message", path: base, label: messageName, file: declarationOwner(base) }, 3)
  }
  if (s0 === "components" && s1 === "enums" && s2 !== undefined) {
    const enumeration = String(s2)
    const base: JsonPath = ["components", "enums", enumeration]
    if (s3 === "values" && s4 !== undefined) {
      const valuePath = [...base, "values", s4]
      const value = lookup(docs, valuePath, after)
      return make(
        {
          kind: "value",
          path: valuePath,
          label: `value ${code(String(s4))}${numberSuffix(value)}`,
          owner: `enum ${code(enumeration)}`,
        },
        5,
      )
    }
    return make({ kind: "enum", path: base, label: `enum ${code(enumeration)}`, file: declarationOwner(base) }, 3)
  }
  if (s0 === "components" && s1 === "extensions" && s2 !== undefined) {
    const extension = String(s2)
    const base: JsonPath = ["components", "extensions", extension]
    const node = lookup(docs, base, after)
    const extendee = getKeyValue(node, "extendee")
    const label = `extension ${code(extension)}${numberSuffix(node)}${typeof extendee === "string" ? ` of message ${code(extendee)}` : ""}`
    return make({ kind: "extension", path: base, label, file: declarationOwner(base), node }, 3)
  }
  return make({ kind: "document", path: [], label: "the document" }, 0)
}

// ---- terms (§7.2 dictionary)

/** Terms of keywords (what changed → term). */
export const protoApiTerms: Readonly<Record<string, string>> = {
  minimum: "minimum value",
  exclusiveMinimum: "minimum value",
  maximum: "maximum value",
  exclusiveMaximum: "maximum value",
  multipleOf: "multiple-of constraint",
  minLength: "minimum length",
  maxLength: "maximum length",
  minItems: "minimum item count",
  maxItems: "maximum item count",
  minProperties: "minimum entry count",
  maxProperties: "maximum entry count",
  uniqueItems: "unique-elements constraint",
  pattern: "pattern",
  format: "format",
  enum: "allowed values",
  const: "constant value",
  required: "required constraint",
  readOnly: "output-only behavior",
  writeOnly: "input-only behavior",
  immutable: "immutable behavior",
  examples: "examples",
  "x-default": "documented default",
  default: "default value",
  title: "title",
  description: "description",
  jsonName: "JSON name",
  delimited: "delimited encoding",
  packed: "expanded encoding",
  utf8Validation: "UTF-8 validation",
  closed: "enum type",
  jsonFormat: "JSON format",
  file: "declaring file",
  type: "type",
  $ref: "type",
  number: "field number",
  extendee: "extended message",
  idempotency: "idempotency level",
  request: "request type",
  response: "response type",
  presence: "presence",
  oneof: "oneof",
  syntax: "syntax",
  package: "package",
  bundled: "bundled-file status",
  "x-annotation-conflicts": "annotation conflict",
  protoapi: "format version",
}

// keywords without a value of their own (a flag): added / removed
const FLAG_KEYWORDS = new Set(["uniqueItems", "required", "readOnly", "writeOnly", "immutable", "delimited"])

// positions inside a field (`describeInside`)
const POSITION_WORDS: Record<string, string> = {
  items: "elements",
  propertyNames: "map keys",
  additionalProperties: "map values",
}

const FREE_TEXT = new Set(["title", "description"])

// the `.proto` type of a scalar position (the field, an inner position): its scalar type, `enum` or `message`
const positionType = (position: unknown): ProtoValueType => {
  const scalar = scalarTypeOf(position)
  if (scalar !== undefined) {
    return scalar
  }
  const target = refTarget(getKeyValue(position, "$ref"))
  return target ? (target.kind === "enums" ? "enum" : "message") : undefined
}

// the value of a keyword as a code span (a bound with its comparison, a format by name, a pattern as written)
const keywordValue = (keyword: string, value: unknown, position: unknown): string => {
  if (value === undefined) {
    return ""
  }
  if (
    keyword === "minimum" ||
    keyword === "exclusiveMinimum" ||
    keyword === "maximum" ||
    keyword === "exclusiveMaximum"
  ) {
    if (typeof value === "string" && /^[<>]/.test(value)) {
      return code(value)
    }
    const sign = keyword.endsWith("inimum") ? ">" : "<"
    return code(
      `${sign}${keyword.startsWith("exclusive") ? "" : "="} ${formatProtoValue(value, positionType(position))}`,
    )
  }
  if (keyword === "pattern" || keyword === "format" || keyword === "jsonName" || keyword === "file") {
    return code(plain(value))
  }
  if (FREE_TEXT.has(keyword)) {
    return formatText(value)
  }
  if (
    ["minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties", "multipleOf"].includes(keyword)
  ) {
    return code(plain(value))
  }
  if (keyword === "enum" && Array.isArray(value)) {
    return value.map((item) => code(formatProtoValue(item, positionType(position)))).join(", ")
  }
  if (keyword === "examples" && Array.isArray(value)) {
    return value.map((item) => code(formatProtoValue(item, positionType(position)))).join(", ")
  }
  return code(formatProtoValue(value, positionType(position)))
}

// ---- options

// the `.proto` types of built-in options whose JSON value does not tell them apart (strings that read like enum names)
const BUILT_IN_STRING_OPTIONS = new Set([
  "go_package",
  "java_package",
  "java_outer_classname",
  "objc_class_prefix",
  "csharp_namespace",
  "swift_prefix",
  "php_class_prefix",
  "php_namespace",
  "php_metadata_namespace",
  "ruby_package",
])

// the `.proto` type of an option value: the option's definition in `components.extensions` (followed through message
// fields for sub-paths), else `undefined` (the JSON value decides)
const optionType = (
  docs: ProtoApiDescribeDocuments,
  key: string,
  sub: readonly (string | number)[],
): ProtoValueType => {
  if (BUILT_IN_STRING_OPTIONS.has(key) && !sub.length) {
    return "string"
  }
  let position = lookup(docs, ["components", "extensions", key], true)
  if (!position) {
    return
  }
  for (const step of sub) {
    if (typeof step === "number") {
      position = getKeyValue(position, "items") ?? position
      continue
    }
    const target = refTarget(getKeyValue(position, "$ref") ?? getKeyValue(position, "items", "$ref"))
    if (target?.kind !== "messages") {
      return
    }
    position = getKeyValue(lookup(docs, ["components", "messages", target.name], true), "properties", step)
    if (!position) {
      return
    }
  }
  const items = getKeyValue(position, "items")
  return positionType(isObject(items) && getKeyValue(position, "type") === "array" ? items : position)
}

const optionStatement = (docs: ProtoApiDescribeDocuments, key: string, sub: (string | number)[], value: unknown) =>
  code(`${formatOptionName(key, sub)} = ${formatProtoValue(value, optionType(docs, key, sub))}`)

// ---- descriptions

const ACTION_WORD: Record<Diff["action"], string> = {
  add: "Added",
  remove: "Removed",
  replace: "Replaced",
  rename: "Renamed",
}

const preposition = (action: Diff["action"]) => (action === "add" ? "to" : action === "remove" ? "from" : "of")

// `[Added] <what> to <target>`, `[Removed] <what> from <target>`, `[Replaced] <what> of <target> from <a> to <b>`
const propertyText = (diff: Diff, what: string, target: string, value: { before?: string; after?: string }): string => {
  if (diff.action === "replace") {
    return `[Replaced] ${what} of ${target}${value.before !== undefined ? ` from ${value.before}` : ""}${value.after !== undefined ? ` to ${value.after}` : ""}`
  }
  const shown = diff.action === "add" ? value.after : value.before
  return `[${ACTION_WORD[diff.action]}] ${what}${shown ? ` ${shown}` : ""} ${preposition(diff.action)} ${target}`
}

// a flag keyword or one whose meaning is inverted (`packed: false` = expanded encoding, `utf8Validation: false` = no
// validation): the effective action of the diff
const flagAction = (keyword: string, diff: Diff): "add" | "remove" | "replace" => {
  const on = (value: unknown) => {
    if (keyword === "packed" || keyword === "utf8Validation") {
      return value === false
    }
    return value === true
  }
  const before = on(diff.before)
  const after = on(diff.after)
  if (keyword === "utf8Validation") {
    // the key written (`false`) means the validation is off
    return before === after ? "replace" : after ? "remove" : "add"
  }
  return before === after ? "replace" : after ? "add" : "remove"
}

// the reservation suffix of a removed field or enum value (PD-3): what the after element reserves of it
const reservationSuffix = (docs: ProtoApiDescribeDocuments, element: Element, node: unknown): string => {
  const owner = lookup(docs, element.path.slice(0, 3), true)
  const reserved = getKeyValue(owner, "reserved")
  const number = getKeyValue(node, "number")
  const names = getKeyValue(reserved, "names")
  const numberReserved =
    typeof number === "number" &&
    mergeIntervals(getKeyValue(reserved, "numbers")).some(([lo, hi]) => lo <= number && number <= hi)
  const nameReserved = Array.isArray(names) && names.includes(String(element.path[element.path.length - 1]))
  if (numberReserved && nameReserved) {
    return ""
  }
  return numberReserved ? " without reserving the name" : " without reserving the number"
}

// an enum value whose number another value of the same enum has (an alias)
const isAlias = (docs: ProtoApiDescribeDocuments, element: Element, after: boolean): boolean => {
  const values = asObject(lookup(docs, element.path.slice(0, -1), after))
  const own = element.path[element.path.length - 1]
  const number = getKeyValue(values?.[String(own)], "number")
  if (!values || typeof number !== "number") {
    return false
  }
  const other = asObject(lookup(docs, element.path.slice(0, -1), !after))
  const numbers = (object: Obj | undefined, skip?: string) =>
    Object.keys(object ?? {})
      .filter((key) => key !== skip)
      .map((key) => getKeyValue(object?.[key], "number"))
  return numbers(values, String(own)).includes(number) || numbers(other, String(own)).includes(number)
}

// an element added, removed or renamed
const describeElementRecord = (diff: Diff, docs: ProtoApiDescribeDocuments, located: Element): string => {
  const record = located.record ?? located.label
  const element = located.file ? { ...located, owner: located.file } : located
  if (diff.action === "add") {
    if (element.kind === "value" && isAlias(docs, element, true)) {
      return `[Added] value alias ${element.label.slice("value ".length)} to ${element.owner}`
    }
    return element.owner ? `[Added] ${record} to ${element.owner}` : `[Added] ${record}`
  }
  if (diff.action === "remove") {
    if (element.kind === "value" && isAlias(docs, element, false)) {
      return `[Removed] value alias ${element.label.slice("value ".length)} from ${element.owner}`
    }
    const suffix =
      element.kind === "field" || element.kind === "value" ? reservationSuffix(docs, element, diff.before) : ""
    return element.owner ? `[Removed] ${record} from ${element.owner}${suffix}` : `[Removed] ${record}${suffix}`
  }
  return `[Replaced] ${element.full}`
}

// a rename diff (reported at the container, `before` / `after` the keys)
const describeRename = (diff: Diff, docs: ProtoApiDescribeDocuments): string => {
  const { element } = locateElement(docs, [...diff.path, diff.before as string], false)
  const to = code(String(diff.after))
  if (element.kind === "extension" || element.kind === "file") {
    return `[Renamed] ${element.label} to ${to}`
  }
  let text = `[Renamed] ${element.label} to ${to}${element.owner ? ` in ${element.owner}` : ""}`
  if (element.kind === "field") {
    // folded JSON names (S9, PD-20): named when either field writes an explicit JSON name
    const bPath = [...diff.path, diff.before as string]
    const aPath = [...diff.path, diff.after as string]
    const bField = valueAt(docs.originalBefore, bPath) ?? valueAt(docs.before, bPath)
    const aField = valueAt(docs.originalAfter, aPath) ?? valueAt(docs.after, aPath)
    if (getKeyValue(bField, "jsonName") !== undefined || getKeyValue(aField, "jsonName") !== undefined) {
      const bJson = effectiveJsonName(bField, String(diff.before))
      const aJson = effectiveJsonName(aField, String(diff.after))
      text +=
        bJson === aJson ? `, JSON name ${code(aJson)} kept` : `, JSON name ${code(bJson)} changed to ${code(aJson)}`
    }
  }
  return text
}

// the implicit default of a singular field (C6): zero, `false`, empty, an enum's effective default value
const implicitDefault = (docs: ProtoApiDescribeDocuments, field: unknown, after: boolean): unknown => {
  const target = refTarget(getKeyValue(field, "$ref"))
  if (target?.kind === "enums") {
    return effectiveEnumDefault(lookup(docs, ["components", "enums", target.name], after))?.name
  }
  if (target) {
    return
  }
  const scalar = scalarTypeOf(field)
  if (scalar === undefined) {
    return
  }
  if (INTEGER_TYPES.has(scalar) || scalar === "float" || scalar === "double") {
    return 0
  }
  return scalar === "bool" ? false : ""
}

const original = (docs: ProtoApiDescribeDocuments, path: JsonPath, after: boolean): unknown => {
  const document = after ? docs.originalAfter : docs.originalBefore
  return document !== undefined ? valueAt(document, path) : undefined
}

// the conflict entry of `x-annotation-conflicts` as text: "`email` dropped (format `uuid` kept)"
const conflictText = (entry: unknown): string => {
  const keyword = plain(getKeyValue(entry, "keyword") ?? "")
  const term = protoApiTerms[keyword] ?? keyword
  const kept = getKeyValue(entry, "kept", "value")
  const dropped = getKeyValue(entry, "dropped", "value")
  const parts = [
    dropped !== undefined ? `${keywordValue(keyword, dropped, undefined)} dropped` : undefined,
    kept !== undefined ? `${term} ${keywordValue(keyword, kept, undefined)} kept` : undefined,
  ].filter((part): part is string => !!part)
  if (!parts.length) {
    return term ? `of the ${term}` : "an entry"
  }
  return parts.length === 2 ? `${parts[0]} (${parts[1]})` : parts[0]
}

const describeConflict = (diff: Diff, docs: ProtoApiDescribeDocuments, element: Element, rest: JsonPath): string => {
  const target = element.full
  if (rest.length === 1) {
    const entries = (value: unknown) => (Array.isArray(value) ? value.map(conflictText).join(", ") : "")
    if (diff.action === "add") {
      return `[Added] annotation conflict to ${target}: ${entries(diff.after)}`
    }
    if (diff.action === "remove") {
      return `[Removed] annotation conflict from ${target}: ${entries(diff.before)}`
    }
    return `[Replaced] annotation conflict of ${target} from ${entries(diff.before)} to ${entries(diff.after)}`
  }
  const entryPath = [...element.path, rest[0], rest[1]]
  const bEntry = lookup(docs, entryPath, false)
  const aEntry = lookup(docs, entryPath, true)
  if (rest.length === 2) {
    return diff.action === "add"
      ? `[Added] annotation conflict to ${target}: ${conflictText(diff.after)}`
      : diff.action === "remove"
        ? `[Removed] annotation conflict from ${target}: ${conflictText(diff.before)}`
        : `[Replaced] annotation conflict of ${target} from ${conflictText(diff.before)} to ${conflictText(diff.after)}`
  }
  const keyword = plain(getKeyValue(aEntry ?? bEntry, "keyword") ?? "")
  const term = protoApiTerms[keyword] ?? keyword
  const bKept = getKeyValue(diff.action === "add" ? aEntry : bEntry, "kept", "value")
  const aKept = getKeyValue(aEntry ?? bEntry, "kept", "value")
  const bDropped = getKeyValue(bEntry, "dropped", "value")
  const aDropped = getKeyValue(aEntry, "dropped", "value")
  if (rest[2] === "dropped" && bKept === aKept) {
    return `[Replaced] annotation conflict of ${target} from ${keywordValue(keyword, bDropped, undefined)} dropped to ${keywordValue(keyword, aDropped, undefined)} dropped (${term} ${keywordValue(keyword, aKept, undefined)} kept)`
  }
  return `[Replaced] annotation conflict of ${target} from ${conflictText(bEntry)} to ${conflictText(aEntry)}`
}

const describeOption = (
  diff: Diff,
  docs: ProtoApiDescribeDocuments,
  element: Element,
  rest: JsonPath,
  target: string,
): string => {
  // rest: ["options", key, ...sub]
  if (rest.length === 1) {
    // the whole options object (hand-made documents): one statement per option
    const value = asObject(diff.action === "add" ? diff.after : diff.before) ?? {}
    const statements = Object.keys(value).map((key) => optionStatement(docs, key, [], value[key]))
    const word = statements.length === 1 ? "option" : "options"
    if (diff.action === "replace") {
      return `[Replaced] options of ${target}`
    }
    return `[${ACTION_WORD[diff.action]}] ${word} ${statements.join(", ")} ${preposition(diff.action)} ${target}`
  }
  const key = String(rest[1])
  const sub = rest.slice(2)
  // visibility (C6): by the effective visibility of both sides
  if (key === "visibility" && !sub.length && (element.kind === "message" || element.kind === "enum")) {
    const section = String(element.path[1])
    const name = String(element.path[2])
    const bVisibility = effectiveVisibility(docs.before, section, name) ?? diff.before
    const aVisibility = effectiveVisibility(docs.after, section, name) ?? diff.after
    if (bVisibility === aVisibility && diff.action !== "replace") {
      // the effective visibility written out or dropped (C6)
      const value = code(plain(diff.action === "add" ? diff.after : diff.before))
      return `[${ACTION_WORD[diff.action]}] explicit visibility ${value} ${preposition(diff.action)} ${target}`
    }
    return `[Replaced] visibility of ${target} from ${code(plain(bVisibility))} to ${code(plain(aVisibility))}`
  }
  // the deprecation of a file (P-12, PD-23)
  if (key === "deprecated" && !sub.length && element.kind === "file") {
    if (diff.action === "add" && diff.after === true) {
      return `[Deprecated] ${target}`
    }
    if (diff.action === "remove" && diff.before === true) {
      return `[Removed] deprecation from ${target}`
    }
  }
  const name = code(formatOptionName(key, sub))
  const type = optionType(docs, key, sub)
  if (diff.action === "replace") {
    return `[Replaced] option ${name} of ${target} from ${code(formatProtoValue(diff.before, type))} to ${code(formatProtoValue(diff.after, type))}`
  }
  const value = diff.action === "add" ? diff.after : diff.before
  return `[${ACTION_WORD[diff.action]}] option ${optionStatement(docs, key, sub, value)} ${preposition(diff.action)} ${target}`
}

// a keyword at a scalar position of a field (or extension body) or of another element
const describeKeyword = (
  diff: Diff,
  docs: ProtoApiDescribeDocuments,
  element: Element,
  keyword: string,
  rest: JsonPath,
  target: string,
  position: unknown,
): string | undefined => {
  const term = protoApiTerms[keyword]
  if (!term) {
    return
  }
  // an item of a list keyword (`enum`, `examples`)
  if (rest.length === 2 && typeof rest[1] === "number" && (keyword === "enum" || keyword === "examples")) {
    const what = keyword === "enum" ? "allowed value" : "example"
    const type = positionType(position)
    return propertyText(diff, what, target, {
      before: diff.before !== undefined ? code(formatProtoValue(diff.before, type)) : undefined,
      after: diff.after !== undefined ? code(formatProtoValue(diff.after, type)) : undefined,
    })
  }
  if (rest.length !== 1) {
    return
  }
  if (FLAG_KEYWORDS.has(keyword) || keyword === "packed" || keyword === "utf8Validation") {
    const action = flagAction(keyword, diff)
    if (action === "replace") {
      return `[Replaced] ${term} of ${target} from ${code(String(diff.before))} to ${code(String(diff.after))}`
    }
    return `[${ACTION_WORD[action]}] ${term} ${preposition(action)} ${target}`
  }
  if (keyword === "examples" && diff.action !== "replace") {
    const list = diff.action === "add" ? diff.after : diff.before
    const what = Array.isArray(list) && list.length === 1 ? "example" : "examples"
    return propertyText(diff, what, target, {
      before: keywordValue(keyword, diff.before, position),
      after: keywordValue(keyword, diff.after, position),
    })
  }
  if (keyword === "enum" && diff.action !== "replace") {
    return propertyText(diff, term, target, {
      before: keywordValue(keyword, diff.before, position),
      after: keywordValue(keyword, diff.after, position),
    })
  }
  if (keyword === "default" && element.kind !== "document") {
    // implicit defaults (C6): a default added or removed changes the effective default from or to the implicit one
    const bOriginal = getKeyValue(original(docs, element.path, false), "default")
    const aOriginal = getKeyValue(original(docs, element.path, true), "default")
    // the literal of each side follows that side's type: a type change shadows the field's `type` (ISSUE-401)
    const bType = positionType(original(docs, element.path, false) ?? position)
    const aType = positionType(original(docs, element.path, true) ?? position)
    const bImplicit = diff.before === undefined || (docs.originalBefore !== undefined && bOriginal === undefined)
    const aImplicit = diff.after === undefined || (docs.originalAfter !== undefined && aOriginal === undefined)
    const field = lookup(docs, element.path, true)
    const bValue =
      diff.before !== undefined ? diff.before : implicitDefault(docs, lookup(docs, element.path, false), false)
    const aValue =
      diff.after !== undefined && !(aImplicit && diff.action === "remove")
        ? diff.after
        : implicitDefault(docs, field, true)
    if (bValue !== undefined && aValue !== undefined) {
      const render = (value: unknown, type: ProtoValueType, implicit: boolean) =>
        `${code(formatProtoValue(value, type))}${implicit ? " (implicit)" : ""}`
      return `[Replaced] ${term} of ${target} from ${render(bValue, bType, bImplicit)} to ${render(aValue, aType, aImplicit)}`
    }
  }
  if (keyword === "closed") {
    const state = (value: unknown) => code(value === true ? "closed" : "open")
    return `[Replaced] ${term} of ${target} from ${state(diff.before)} to ${state(diff.after)}`
  }
  if (keyword === "jsonFormat") {
    const state = (value: unknown) => code(typeof value === "string" ? value : "ALLOW")
    return `[Replaced] ${term} of ${target} from ${state(diff.before)} to ${state(diff.after)}`
  }
  if (keyword === "presence") {
    const label = (value: unknown) => (value === "required" ? "required label" : "explicit presence")
    const spelling = (value: unknown) => {
      const syntax = getKeyValue(
        lookup(docs, ["files", String(fileOf(docs, element.path.slice(0, 3), true) ?? "")], true),
        "syntax",
      )
      const editions = syntax !== undefined && syntax !== "proto2" && syntax !== "proto3"
      if (value === "required") {
        return code(editions ? "features.field_presence = LEGACY_REQUIRED" : "required")
      }
      return code(editions ? "features.field_presence = EXPLICIT" : "optional")
    }
    if (diff.action === "replace") {
      // explicit ↔ required: a required field has presence, so the label is what is added or removed
      const required = diff.after === "required"
      return `[${required ? "Added" : "Removed"}] required label ${required ? "to" : "from"} ${target} (${spelling("required")})`
    }
    const value = diff.action === "add" ? diff.after : diff.before
    return `[${ACTION_WORD[diff.action]}] ${label(value)} ${preposition(diff.action)} ${target} (${spelling(value)})`
  }
  if (keyword === "oneof") {
    if (diff.action === "replace") {
      return `[Replaced] oneof of ${target} from ${code(String(diff.before))} to ${code(String(diff.after))}`
    }
    return diff.action === "add"
      ? `[Added] ${target} to oneof ${code(String(diff.after))}`
      : `[Removed] ${target} from oneof ${code(String(diff.before))}`
  }
  if (keyword === "type" || keyword === "$ref") {
    const spelling = (value: unknown) => code(refTarget(value)?.name ?? String(value))
    return propertyText(diff, term, target, {
      before: diff.before !== undefined ? spelling(diff.before) : undefined,
      after: diff.after !== undefined ? spelling(diff.after) : undefined,
    })
  }
  if (keyword === "extendee") {
    // the extension is named without its extendee, which is the changed property
    const name = element.label.replace(/ of message `[^`]*`$/, "")
    return propertyText(diff, term, name, { before: code(String(diff.before)), after: code(String(diff.after)) })
  }
  if (keyword === "number" && element.kind === "extension") {
    return propertyText(diff, term, target, { before: code(String(diff.before)), after: code(String(diff.after)) })
  }
  return propertyText(diff, term, target, {
    before: keywordValue(keyword, diff.before, position),
    after: keywordValue(keyword, diff.after, position),
  })
}

const describeDeprecation = (diff: Diff, target: string, rest: JsonPath): string => {
  if (rest.length === 1) {
    if (diff.action === "add") {
      const reason = getKeyValue(diff.after, "reason")
      return `[Deprecated] ${target}${typeof reason === "string" && reason ? ` (reason: ${reasonText(reason)})` : ""}`
    }
    if (diff.action === "remove") {
      return `[Removed] deprecation from ${target}`
    }
    return `[Replaced] deprecation of ${target}`
  }
  if (diff.action === "replace") {
    return `[Replaced] deprecation reason of ${target} from ${formatText(diff.before)} to ${formatText(diff.after)}`
  }
  return diff.action === "add"
    ? `[Added] deprecation reason ${formatText(diff.after)} to ${target}`
    : `[Removed] deprecation reason ${formatText(diff.before)} from ${target}`
}

// a deprecation reason inside "(reason: …)": free text on one line, shortened (POLICY-95)
const reasonText = (reason: string): string => {
  const text = formatText(reason)
  return text.startsWith("`") && text.endsWith("`") ? text.slice(1, -1) : text
}

const describeRanges = (diff: Diff, element: Element, rest: JsonPath, target: string): string | undefined => {
  const value = diff.action === "add" ? diff.after : diff.before
  if (rest[0] === "reserved" && rest[1] === "numbers") {
    const max = element.kind === "enum" ? ENUM_MAX : FIELD_MAX
    const what = rangeCount(value) === 1 ? "reserved number" : "reserved numbers"
    return propertyText(diff, what, target, {
      before: code(formatRanges(diff.before, max)),
      after: code(formatRanges(diff.after, max)),
    })
  }
  if (rest[0] === "reserved" && rest[1] === "names") {
    if (rest.length === 3) {
      return propertyText(diff, "reserved name", target, {
        before: code(String(diff.before)),
        after: code(String(diff.after)),
      })
    }
    const names = (list: unknown) => (Array.isArray(list) ? list.map((name) => code(String(name))).join(", ") : "")
    return propertyText(diff, "reserved names", target, { before: names(diff.before), after: names(diff.after) })
  }
  if (rest[0] === "reserved" && rest.length === 1) {
    return propertyText(diff, "reservations", target, {})
  }
  if (rest[0] === "extensions" && element.kind === "message") {
    const what = Array.isArray(value) && mergeIntervals(value).length > 1 ? "extension ranges" : "extension range"
    return propertyText(diff, what, target, {
      before: code(formatRanges(diff.before, FIELD_MAX)),
      after: code(formatRanges(diff.after, FIELD_MAX)),
    })
  }
  return
}

const describeRange = (diff: Diff, docs: ProtoApiDescribeDocuments, element: Element, rest: JsonPath): string => {
  // an extension range's options entry (`extensionOptions/<i>`) or its declarations (`extension_declarations/<r>`)
  const target = element.label
  if (!rest.length) {
    if (element.path.includes("extension_declarations")) {
      const list = diff.action === "add" ? diff.after : diff.before
      const numbers = Array.isArray(list)
        ? list.map((item) => code(String(getKeyValue(item, "number")))).join(", ")
        : ""
      return propertyText(diff, "extension declarations", target, { before: numbers, after: numbers })
    }
    const entry = diff.action === "add" ? diff.after : diff.before
    const options = asObject(getKeyValue(entry, "options")) ?? {}
    const statements = Object.keys(options).map((key) => optionStatement(docs, key, [], options[key]))
    if (diff.action === "replace") {
      return `[Replaced] options of ${target}`
    }
    return `[${ACTION_WORD[diff.action]}] ${statements.length === 1 ? "option" : "options"} ${statements.join(", ")} ${preposition(diff.action)} ${target}`
  }
  if (rest[0] === "options") {
    return describeOption(diff, docs, element, rest, target)
  }
  if (typeof rest[0] === "number") {
    const declaration = lookup(docs, [...element.path, rest[0]], diff.action === "add")
    const number =
      getKeyValue(declaration, "number") ?? getKeyValue(diff.action === "add" ? diff.after : diff.before, "number")
    const what = `extension declaration ${code(String(number))}`
    if (rest.length === 1) {
      return propertyText(diff, what, target, {})
    }
    const field = String(rest[1])
    return propertyText(diff, field, `${what} in ${target}`, {
      before: diff.before !== undefined ? code(formatProtoValue(diff.before)) : undefined,
      after: diff.after !== undefined ? code(formatProtoValue(diff.after)) : undefined,
    })
  }
  return genericText(diff, rest, target)
}

// a key the dictionary does not know: named as written (hand-made documents), `x-*` keys as custom annotations
const keyWords = (key: string | number): string => {
  if (typeof key === "number") {
    return `item ${key + 1}`
  }
  if (key.startsWith("x-")) {
    return `custom annotation ${code(key.slice(2))}`
  }
  return protoApiTerms[key] ?? code(key)
}

const genericText = (diff: Diff, rest: JsonPath, target: string): string => {
  const what = rest.length ? rest.map(keyWords).reverse().join(" of ") : "content"
  const literal = (value: unknown) => (value === undefined ? undefined : code(formatProtoValue(value)))
  if (diff.action === "replace") {
    const scalar = (value: unknown) => value === null || typeof value !== "object"
    return `[Replaced] ${what} of ${target}${scalar(diff.before) && scalar(diff.after) ? ` from ${literal(diff.before)} to ${literal(diff.after)}` : ""}`
  }
  const value = diff.action === "add" ? diff.after : diff.before
  const shown = value !== null && typeof value === "object" ? "" : ` ${literal(value)}`
  return `[${ACTION_WORD[diff.action]}] ${what}${shown} ${preposition(diff.action)} ${target}`
}

const describeFile = (diff: Diff, docs: ProtoApiDescribeDocuments, element: Element, rest: JsonPath): string => {
  const target = element.label
  const key = rest[0]
  if (key === "syntax") {
    return `[Replaced] syntax of ${target} from ${code(formatSyntax(diff.before))} to ${code(formatSyntax(diff.after))}`
  }
  if (key === "package") {
    return propertyText(diff, "package", target, {
      before: diff.before !== undefined ? code(String(diff.before)) : undefined,
      after: diff.after !== undefined ? code(String(diff.after)) : undefined,
    })
  }
  if (key === "imports") {
    if (rest.length === 2) {
      const path = String(diff.action === "add" ? diff.after : diff.before)
      const flag = getKeyValue(lookup(docs, [...element.path, "importFlags"], diff.action === "add"), path)
      const modifier = typeof flag === "string" ? ` (${code(flag)})` : ""
      if (diff.action === "replace") {
        return `[Replaced] import ${code(String(diff.before))} of ${target} by ${code(String(diff.after))}`
      }
      return `[${ACTION_WORD[diff.action]}] import ${code(path)} ${preposition(diff.action)} ${target}${modifier}`
    }
    const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => code(String(item))).join(", ") : "")
    return propertyText(diff, "imports", target, { before: list(diff.before), after: list(diff.after) })
  }
  if (key === "importFlags") {
    if (rest.length === 2) {
      const imported = `import ${code(String(rest[1]))} in ${target}`
      if (diff.action === "replace") {
        return `[Replaced] modifier of ${imported} from ${code(String(diff.before))} to ${code(String(diff.after))}`
      }
      const modifier = String(diff.action === "add" ? diff.after : diff.before)
      return `[${ACTION_WORD[diff.action]}] ${modifier} modifier ${preposition(diff.action)} ${imported}`
    }
    return genericText(diff, ["modifiers"], target)
  }
  if (key === "bundled") {
    return propertyText(diff, "bundled-file status", target, {})
  }
  if (key === "description" && rest.length === 1) {
    return propertyText(diff, "description", target, {
      before: diff.before !== undefined ? formatText(diff.before) : undefined,
      after: diff.after !== undefined ? formatText(diff.after) : undefined,
    })
  }
  if (key === "options") {
    return describeOption(diff, docs, element, rest, target)
  }
  return genericText(diff, rest, target)
}

const describeRpcSide = (diff: Diff, element: Element, rest: JsonPath): string | undefined => {
  const key = rest[0]
  if ((key === "request" || key === "response") && rest.length === 1) {
    const spelling = (value: unknown) => {
      const text = methodSideSpelling(value)
      return text === undefined ? undefined : code(text)
    }
    return propertyText(diff, `${key} type`, element.full, {
      before: spelling(diff.before),
      after: spelling(diff.after),
    })
  }
  if (key === "http") {
    if (rest.length === 1) {
      return propertyText(diff, "HTTP binding", element.full, {
        before: diff.before !== undefined ? formatHttpBinding(diff.before) : undefined,
        after: diff.after !== undefined ? formatHttpBinding(diff.after) : undefined,
      })
    }
    if (rest[1] === "additionalBindings" && rest.length === 3) {
      return propertyText(diff, "additional HTTP binding", element.full, {
        before: diff.before !== undefined ? formatHttpBinding(diff.before) : undefined,
        after: diff.after !== undefined ? formatHttpBinding(diff.after) : undefined,
      })
    }
  }
  if (key === "idempotency") {
    return propertyText(diff, "idempotency level", element.full, {
      before: diff.before !== undefined ? code(String(diff.before)) : undefined,
      after: diff.after !== undefined ? code(String(diff.after)) : undefined,
    })
  }
  return
}

/**
 * The description of a ProtoApi record (R-D, §7.2): the changed element named with its container, the changed
 * property by its protobuf term, values as `.proto` literals.
 */
export const describeProtoDiff = (diff: Diff, docs: ProtoApiDescribeDocuments): string => {
  if (diff.action === "rename") {
    return describeRename(diff, docs)
  }
  const after = diff.action === "add"
  const { element, rest } = locateElement(docs, diff.path, after)
  if (element.kind === "document") {
    if (rest.length === 1 && rest[0] === "protoapi") {
      return `[Replaced] format version of the document from ${code(String(diff.before))} to ${code(String(diff.after))}`
    }
    return genericText(diff, rest, "the document")
  }
  if (element.kind === "range") {
    return describeRange(diff, docs, element, rest)
  }
  if (!rest.length) {
    return describeElementRecord(diff, docs, element)
  }
  if (element.kind === "file") {
    return describeFile(diff, docs, element, rest)
  }
  if (element.kind === "rpc") {
    const text = describeRpcSide(diff, element, rest)
    if (text) {
      return text
    }
  }
  const key = String(rest[0])
  if (key === "deprecation") {
    return describeDeprecation(diff, element.full, rest)
  }
  if (key === "x-annotation-conflicts") {
    return describeConflict(diff, docs, element, rest)
  }
  const ranges = describeRanges(diff, element, rest, element.full)
  if (ranges) {
    return ranges
  }
  // a scalar position inside a field: "elements of field `tags` (2) in message `p.M`"
  let target = element.full
  let inner = rest
  let position = lookup(docs, element.path, after)
  if (POSITION_WORDS[key] && rest.length >= 2 && (element.kind === "field" || element.kind === "extension")) {
    target = `${POSITION_WORDS[key]} of ${element.full}`
    inner = rest.slice(1)
    position = getKeyValue(position, key)
  }
  const keyword = String(inner[0])
  if (keyword === "options") {
    return describeOption(diff, docs, element, inner, target)
  }
  if (keyword === "x-annotation-conflicts") {
    return describeConflict(diff, docs, element, inner)
  }
  if (keyword === "deprecation") {
    return describeDeprecation(diff, target, inner)
  }
  if (keyword.startsWith("x-") && keyword !== "x-default") {
    return genericText(diff, inner, target)
  }
  return describeKeyword(diff, docs, element, keyword, inner, target, position) ?? genericText(diff, inner, target)
}

// ---- merged records (A4, PD-16 / PD-27, ISSUE-374)

type Effect = {
  term: string
  positions: string[]
  kind: "added" | "removed" | "changed"
  value?: string
  from?: string
  to?: string
}

// the scalar position and keyword of a diff at a field: `undefined` position for the field itself
const keywordOf = (diff: Diff, element: Element): { keyword: string; position?: string } | undefined => {
  const rest = diff.path.slice(element.path.length)
  if (rest.length && POSITION_WORDS[String(rest[0])] && rest.length >= 2) {
    return { keyword: String(rest[1]), position: String(rest[0]) }
  }
  return rest.length ? { keyword: String(rest[0]) } : undefined
}

// the effect of a folded or merged keyword diff: "<term> <value> added", "<term> changed from <a> to <b>"
const effectOf = (diff: Diff, docs: ProtoApiDescribeDocuments, element: Element): Effect | undefined => {
  const located = keywordOf(diff, element)
  if (!located) {
    return
  }
  const { keyword, position } = located
  const term = protoApiTerms[keyword] ?? keyword
  const positions = position ? [POSITION_WORDS[position]] : []
  const node = lookup(docs, position ? [...element.path, position] : element.path, diff.action === "add")
  if (FLAG_KEYWORDS.has(keyword) || keyword === "packed" || keyword === "utf8Validation") {
    const action = flagAction(keyword, diff)
    return { term, positions, kind: action === "add" ? "added" : action === "remove" ? "removed" : "changed" }
  }
  if (keyword === "presence") {
    const label = (value: unknown) => (value === "required" ? "required label" : "explicit presence")
    if (diff.action === "replace") {
      return { term: "presence", positions, kind: "changed", from: label(diff.before), to: label(diff.after) }
    }
    return {
      term: label(diff.action === "add" ? diff.after : diff.before),
      positions,
      kind: diff.action === "add" ? "added" : "removed",
    }
  }
  if (keyword === "closed") {
    const state = (value: unknown) => code(value === true ? "closed" : "open")
    return { term, positions, kind: "changed", from: state(diff.before), to: state(diff.after) }
  }
  if (keyword === "jsonFormat") {
    const state = (value: unknown) => code(typeof value === "string" ? value : "ALLOW")
    return { term, positions, kind: "changed", from: state(diff.before), to: state(diff.after) }
  }
  const before = diff.before !== undefined ? keywordValue(keyword, diff.before, node) : undefined
  const after = diff.after !== undefined ? keywordValue(keyword, diff.after, node) : undefined
  if (diff.action === "replace") {
    return { term, positions, kind: "changed", from: before, to: after }
  }
  return {
    term,
    positions,
    value: diff.action === "add" ? after : before,
    kind: diff.action === "add" ? "added" : "removed",
  }
}

const joinAnd = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`

// "<term> of elements" (PD-27: the position after the term)
const effectTerm = (effect: Effect): string =>
  effect.positions.length ? `${effect.term} of ${joinAnd(effect.positions)}` : effect.term

const effectText = (effect: Effect): string =>
  effect.kind === "changed"
    ? `${effectTerm(effect)} changed${effect.from ? ` from ${effect.from}` : ""}${effect.to ? ` to ${effect.to}` : ""}`
    : `${effectTerm(effect)}${effect.value ? ` ${effect.value}` : ""} ${effect.kind}`

const POSITION_ORDER = ["the field", "elements", "map keys", "map values"]

// effects of one keyword at several positions are one effect ("UTF-8 validation from map keys and map values")
const groupEffects = (effects: Effect[]): Effect[] => {
  const result: Effect[] = []
  for (const effect of effects) {
    const same = result.find(
      (item) =>
        item.term === effect.term &&
        item.kind === effect.kind &&
        item.value === effect.value &&
        item.from === effect.from &&
        item.to === effect.to,
    )
    if (same) {
      for (const position of effect.positions.length ? effect.positions : ["the field"]) {
        if (!same.positions.includes(position)) {
          same.positions.push(position)
        }
      }
    } else {
      result.push({ ...effect, positions: [...effect.positions] })
    }
  }
  for (const effect of result) {
    effect.positions.sort((a, b) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b))
  }
  return result
}

const causeText = (
  cause: ProtoApiMergeCause,
  docs: ProtoApiDescribeDocuments,
  element: Element,
  allDiffs: readonly Diff[],
  keyword: string | undefined,
): string => {
  if (cause.kind === "syntax") {
    return ` (syntax of file ${code(String(cause.diff.path[1]))} changed)`
  }
  if (cause.kind === "feature") {
    const { element: owner, rest } = locateElement(docs, cause.diff.path, true)
    const optionsAt = rest.indexOf("options")
    const sub = optionsAt >= 0 ? rest.slice(optionsAt + 1) : []
    const name = sub[0] === "features" ? formatOptionName("features", sub.slice(1)) : "features"
    return owner.path.join("/") === element.path.join("/")
      ? ` (from option ${code(name)} of ${owner.label})`
      : ` (inherited from option ${code(name)} of ${owner.full})`
  }
  if (cause.kind === "inherited") {
    // the feature is not kept as an option (invariant 10): named at the widest element whose other declarations
    // changed the same resolved keyword
    const feature = Object.keys(protoApiResolvedFeatures).find((name) => protoApiResolvedFeatures[name] === keyword)
    const name = code(`features.${feature ?? keyword}`)
    const message = element.path.slice(0, 3).join("/")
    const others = allDiffs.filter(
      (diff) => diff.path.includes(String(keyword)) && diff.path.slice(0, 5).join("/") !== element.path.join("/"),
    )
    const file = fileOf(docs, element.path.slice(0, 3), true)
    if (others.some((diff) => diff.path.slice(0, 3).join("/") !== message) && file !== undefined) {
      return ` (inherited from option ${name} of file ${code(file)})`
    }
    if (others.length && element.kind === "field") {
      return ` (inherited from option ${name} of ${element.owner})`
    }
    return ` (from option ${name} of ${element.label})`
  }
  return ""
}

/**
 * The description of a merged record (A4, PD-16 / PD-27, ISSUE-374): the representative's description with the folded
 * validator effects for a shape record (W-39), else one text for the effects of one cause at the element.
 */
export const describeMergedRecord = (
  representative: Diff,
  folded: readonly Diff[],
  cause: ProtoApiMergeCause,
  docs: ProtoApiDescribeDocuments,
  allDiffs: readonly Diff[] = [],
): string => {
  const { element } = locateElement(docs, representative.path, representative.action === "add")
  if (cause.kind === "shape") {
    const base = representative.description ?? describeProtoDiff(representative, docs)
    const effects = folded.map((diff) => effectOf(diff, docs, element)).filter((item): item is Effect => !!item)
    return effects.length ? `${base} (${effects.map(effectText).join(", ")})` : base
  }
  // the diffs of the record in walk order (the representative is a copy with the merged class)
  const order = (diff: Diff) =>
    allDiffs.findIndex((item) => item.action === diff.action && item.path.join("/") === diff.path.join("/"))
  const group = [representative, ...folded].sort((a, b) => order(a) - order(b))
  if (cause.kind === "lifted" && cause.keyword === "length") {
    const [first, second] = group
    const terms = joinAnd([first, second].map((diff) => protoApiTerms[String(diff.path[diff.path.length - 1])]))
    const rest = representative.path.slice(element.path.length)
    const target = rest.length === 2 ? `${POSITION_WORDS[String(rest[0])]} of ${element.full}` : element.full
    const value = (item: unknown) => (item === undefined ? undefined : code(plain(item)))
    return propertyText(representative, terms, target, {
      before: value(representative.before),
      after: value(representative.after),
    })
  }
  const effects = groupEffects(
    group.map((diff) => effectOf(diff, docs, element)).filter((item): item is Effect => !!item),
  )
  const keyword = keywordOf(representative, element)?.keyword
  const suffix = cause.kind === "lifted" ? "" : causeText(cause, docs, element, allDiffs, keyword)
  const kinds = new Set(effects.map((effect) => effect.kind))
  if (kinds.size === 1 && !kinds.has("changed")) {
    const action = kinds.has("added") ? "Added" : "Removed"
    const prep = kinds.has("added") ? "to" : "from"
    // one keyword at several positions: the positions name the target
    if (effects.length === 1 && effects[0].positions.length) {
      const positions = effects[0].positions.filter((item) => item !== "the field")
      const target =
        positions.length === effects[0].positions.length ? `${joinAnd(positions)} of ${element.full}` : element.full
      return `[${action}] ${effects[0].term} ${prep} ${target}${suffix}`
    }
    return `[${action}] ${joinAnd(effects.map(effectTerm))} ${prep} ${element.full}${suffix}`
  }
  const what = cause.kind === "lifted" ? "field behavior" : "resolved features"
  return `[Replaced] ${what} of ${element.full}: ${effects.map(effectText).join(", ")}${suffix}`
}

// ---- hooks

/**
 * The container of a diff (§7.2 "Elements and containers", `locateProtoApiContainer`): the element the diff's path
 * lies in, named with its own container, and the number of path segments it spans.
 */
export const locateProtoApiContainer = (diff: Diff, ctx: CompareContext): { name: string; length: number } => {
  const docs = { before: shadowRoot(ctx.before), after: shadowRoot(ctx.after) }
  const { element } = locateElement(docs, diff.path, diff.action === "add")
  return { name: element.full, length: element.path.length }
}

const rootOf = (node: NodeContext): unknown => shadowRoot(node) ?? node.root

/**
 * The annotate hook of a ProtoApi comparison (R-D): `describeProtoDiff` on the walk shadows and the input documents
 * (implicit defaults, original JSON names). `documents` are the inputs of the comparison; the hook records the walk
 * shadows it sees, so the merged-record describer of the same comparison reads the same keys.
 */
export const createProtoApiAnnotateHook = (documents: { before: unknown; after: unknown }) => {
  const docs: ProtoApiDescribeDocuments = {
    before: documents.before,
    after: documents.after,
    originalBefore: documents.before,
    originalAfter: documents.after,
  }
  let shadows = false
  const hook: AnnotateHook = (diff, ctx) => {
    if (!shadows) {
      docs.before = rootOf(ctx.before)
      docs.after = rootOf(ctx.after)
      shadows = true
    }
    return ruleDescription(diff, ctx) ?? describeProtoDiff(diff, docs)
  }
  const describer =
    (allDiffs: readonly Diff[]): ProtoApiMergeDescriber =>
    (representative, folded, cause) =>
      describeMergedRecord(representative, folded, cause, docs, allDiffs)
  return { hook, describer }
}

// the `annotate` of a custom option rule (`optionRules`, §7.1): its template string rendered with its params
const ruleDescription = (diff: Diff, ctx: CompareContext): string | undefined => {
  if (!diff.path.includes("options")) {
    return
  }
  const annotate = ctx.rules ? ruleView(ctx.rules).annotate : undefined
  const template = annotate?.(diff, ctx)
  if (!template?.template) {
    return
  }
  return createAnnotation(template, { [template.template]: template.template }, diff.type) || undefined
}

/** The ProtoApi annotate hook without the input documents (descriptions from the walk shadows only). */
export const protoApiAnnotateHook: AnnotateHook = (diff, ctx) =>
  ruleDescription(diff, ctx) ?? describeProtoDiff(diff, { before: rootOf(ctx.before), after: rootOf(ctx.after) })
