import {
  annotation,
  breaking,
  CompareScopes,
  mostSevere,
  nonBreaking,
  risky,
  transformClassifyRule,
  unclassified,
} from "../core"
import { nonDirectional, valueCompareResolver } from "../jsonSchema"
import type {
  ClassifyRule,
  CompareContext,
  CompareResolver,
  CompareRules,
  DiffType,
  DiffTypeClassifier,
  NodeContext,
  ScopedClassifyRule,
} from "../types"
import { getKeyValue, isObject } from "../utils"
import {
  protoApiCompatibilityLevels,
  protoApiIdempotencyLevels,
  protoApiLengthDelimitedScalars,
  type ProtoApiLevelCells,
  protoApiMatrix,
  type ProtoApiMatrixRow,
  protoApiWireGroups,
  protoApiWireJsonGroups,
} from "./protoapi.const"
import { methodSideSpelling } from "./protoapi.resolver"
import type { ProtoApiCompatibility } from "./protoapi.types"
import {
  effectiveJsonName,
  ENUM_REF_PREFIX,
  type Interval,
  inIntervals,
  isInterval,
  MESSAGE_REF_PREFIX,
  mergeIntervals,
  PROTO_FLOAT_TYPES,
  PROTO_INTEGER_TYPES,
  refTarget,
  scalarTypeOf,
  shadowRoot,
  subtractInterval,
} from "./protoapi.utils"

// Level-aware classifiers of the classification matrix (PROTOAPI_DESIGN §6): rpc sides (S5), renames (F-8 / F-9),
// reserved coverage and names (PD-4, PD-29), field and enum value records (S1, PD-3, PD-28, V-2 … V-7), the field shape
// (type and cardinality groups, §5.3), effective values (C6: JSON names, defaults, visibility), presence, oneof moves,
// idempotency and the generic option family (R-G, PD-13). Level-dependent cells are resolved when the rule tree is
// built (§4.5): the factories take the level and read the cells of `protoApiMatrix`.

/** The cell of a matrix row at a level. */
export const levelCell = (compatibility: ProtoApiCompatibility, row: ProtoApiMatrixRow): DiffType =>
  (protoApiMatrix[row] as ProtoApiLevelCells)[protoApiCompatibilityLevels.indexOf(compatibility)]

// the original value of a side (the input, not a transformed shadow)
const original = (side: NodeContext): unknown => (side.source !== undefined ? side.source : side.value)

/**
 * S5, R-3 … R-6: an rpc side replaced as one value (`[stream ]<message>`): the streaming flag toggled is breaking at
 * every level (R-5, R-6, with or without a retarget), a message retargeted risky at every level (TC-2).
 */
export const methodMessageClassifier: DiffTypeClassifier = ({ before, after }) => {
  const bSpelling = methodSideSpelling(original(before)) ?? ""
  const aSpelling = methodSideSpelling(original(after)) ?? ""
  return bSpelling.startsWith("stream ") !== aSpelling.startsWith("stream ") ? breaking : risky
}

/**
 * F-8 / F-9 (U2, PD-10, S9): a field renamed with the same number, classified by its effective JSON names (rule J),
 * read from the original fields (the before shadow's `jsonName` took the after spelling, PD-20): `changed` when the
 * effective JSON name changed, `kept` when it is unchanged.
 */
export const fieldRenameClassifier =
  (changed: DiffType, kept: DiffType): DiffTypeClassifier =>
  ({ before, after }) =>
    effectiveJsonName(original(before), String(before.key)) === effectiveJsonName(original(after), String(after.key))
      ? kept
      : changed

// the message (or enum) a reserved or range list belongs to: `<element>/reserved/numbers/<i>` or
// `<element>/extensions/<i>`
const ownerOf = (node: NodeContext): unknown => {
  let current: NodeContext | undefined = node.up
  while (current && current.key !== "reserved" && current.key !== "extensions") {
    current = current.up
  }
  return current?.up?.value
}

// the numbers (fields of a message, values of an enum) and names of an element on one side
const usedNumbers = (element: unknown): number[] => {
  const container = getKeyValue(element, "properties") ?? getKeyValue(element, "values")
  if (typeof container !== "object" || container === null) {
    return []
  }
  return Object.values(container)
    .map((entry) => getKeyValue(entry, "number"))
    .filter((number): number is number => typeof number === "number")
}

const usedNames = (element: unknown): string[] => {
  const container = getKeyValue(element, "properties") ?? getKeyValue(element, "values")
  return typeof container === "object" && container !== null ? Object.keys(container) : []
}

/**
 * M-9 / M-10 / E-7 (PD-4): reserved number coverage lost is breaking when a lost number is used by a field (a value)
 * of the after element, else risky, at every level.
 */
export const reservedNumbersRemovedClassifier: DiffTypeClassifier = (ctx: CompareContext) => {
  const interval = ctx.before.value
  const after = ctx.after.parent
  if (!isInterval(interval)) {
    return risky
  }
  const lost: Interval[] = subtractInterval(interval, mergeIntervals(after))
  const reused = usedNumbers(ownerOf(ctx.after)).some((number) => inIntervals(number, lost))
  return reused ? breaking : risky
}

/**
 * M-12 / M-13 / E-8 (PD-4, PD-29): a reserved name removed is breaking when a field (a value) of the after element
 * uses it, else risky; annotation in WIRE (binary clients never see names).
 */
export const reservedNameRemovedClassifier =
  (wire: boolean): DiffTypeClassifier =>
  (ctx) => {
    if (wire) {
      return annotation
    }
    return usedNames(ownerOf(ctx.after)).includes(String(ctx.before.value)) ? breaking : risky
  }

/** M-14 / E-8 added: a reserved name added is non-breaking, annotation in WIRE (PD-29). */
export const reservedNameAdded = (wire: boolean): DiffType => (wire ? annotation : nonBreaking)

// ---- fields and enum values: add / remove records (S1, PD-3, PD-28, F-1 … F-7, F-46, F-47, V-1 … V-7)

type Obj = Record<string, unknown>

const asObject = (value: unknown): Obj | undefined => (isObject(value) && !Array.isArray(value) ? value : undefined)

// what the after element (message or enum) reserves of a removed field or value: `number` and `name`
const reservation = (element: unknown, number: unknown, name: string): { number: boolean; name: boolean } => {
  const reserved = getKeyValue(element, "reserved")
  const numbers = mergeIntervals(getKeyValue(reserved, "numbers"))
  const names = getKeyValue(reserved, "names")
  return {
    number: typeof number === "number" && inIntervals(number, numbers),
    name: Array.isArray(names) && names.includes(name),
  }
}

// PD-3 (A … C), PD-28: the row of a field (or enum value) deleted, by what the after element reserves
const deletionRow = (
  reserved: { number: boolean; name: boolean },
  rows: [ProtoApiMatrixRow, ProtoApiMatrixRow, ProtoApiMatrixRow, ProtoApiMatrixRow],
): ProtoApiMatrixRow => {
  const [none, numberOnly, nameOnly, both] = rows
  return reserved.number ? (reserved.name ? both : numberOnly) : reserved.name ? nameOnly : none
}

// the after message (enum) of a removed entry: `<element>/<container>/<key>`
const afterElementOf = (ctx: CompareContext): unknown => ctx.after.up?.up?.value

/**
 * S1, F-1 … F-7, F-46, F-47: a field added or removed is one record (a renumbered field is remove + add, F-10). Added:
 * `presence: required` breaking everywhere (F-2, Q5), `required: true` breaking in requests and non-breaking in
 * responses (F-46, the K-14 cells), else non-breaking (F-1, PD-14). Removed: `presence: required` breaking everywhere
 * (F-7), else by the after message's reservations (F-3 … F-6, PD-3, PD-28); with `required: true` the response scope
 * is at least risky (F-47: the more severe of the removal and the K-14 removal). Renamed (the replace slot, DG-03):
 * `renamed`. The rule is scoped, not inverted in responses (AD-05).
 */
export const fieldRecordClassifier = (
  compatibility: ProtoApiCompatibility,
  renamed: DiffType | DiffTypeClassifier,
): ScopedClassifyRule => {
  const cellOf = (row: ProtoApiMatrixRow) => levelCell(compatibility, row)
  const added =
    (response: boolean): DiffTypeClassifier =>
    ({ after }) => {
      if (getKeyValue(after.value, "presence") === "required") {
        return cellOf("F-2")
      }
      if (getKeyValue(after.value, "required") === true) {
        return cellOf(response ? "F-46.response" : "F-46.request")
      }
      return cellOf("F-1")
    }
  const removed =
    (response: boolean): DiffTypeClassifier =>
    (ctx) => {
      const field = ctx.before.value
      if (getKeyValue(field, "presence") === "required") {
        return cellOf("F-7")
      }
      const reserved = reservation(afterElementOf(ctx), getKeyValue(field, "number"), String(ctx.before.key))
      const type = cellOf(deletionRow(reserved, ["F-3", "F-4", "F-5", "F-6"]))
      return response && getKeyValue(field, "required") === true ? mostSevere([type, cellOf("F-47.response")]) : type
    }
  return {
    [CompareScopes.response]: [added(true), removed(true), renamed],
    default: [added(false), removed(false), renamed],
  }
}

// the numbers of the values of an enum
const valueNumbers = (values: unknown): Set<number> => {
  const result = new Set<number>()
  const object = asObject(values)
  for (const key of Object.keys(object ?? {})) {
    const number = getKeyValue(object?.[key], "number")
    if (typeof number === "number") {
      result.add(number)
    }
  }
  return result
}

/**
 * V-1 … V-8: an enum value added with a new number is non-breaking in requests and risky in responses (V-1, PD-11), an
 * alias of a number the before enum has is non-breaking (V-2); removed while its number stays (an alias removed) is a
 * rename (V-3), else by the after enum's reservations (V-4 … V-7, PD-3, PD-28); renamed with the same number (the
 * replace slot): V-8.
 */
export const enumValueRecordClassifier = (compatibility: ProtoApiCompatibility): ScopedClassifyRule => {
  const cellOf = (row: ProtoApiMatrixRow) => levelCell(compatibility, row)
  const added =
    (response: boolean): DiffTypeClassifier =>
    ({ before, after }) => {
      if (valueNumbers(before.parent).has(getKeyValue(after.value, "number") as number)) {
        return cellOf("V-2")
      }
      return cellOf(response ? "V-1.response" : "V-1.request")
    }
  const removed: DiffTypeClassifier = (ctx) => {
    const number = getKeyValue(ctx.before.value, "number")
    if (valueNumbers(ctx.after.parent).has(number as number)) {
      return cellOf("V-3")
    }
    const reserved = reservation(afterElementOf(ctx), number, String(ctx.before.key))
    return cellOf(deletionRow(reserved, ["V-4", "V-5", "V-6", "V-7"]))
  }
  const renamed = cellOf("V-8")
  return {
    [CompareScopes.response]: [added(true), removed, renamed],
    default: [added(false), removed, renamed],
  }
}

// ---- field shape (F-11 … F-21, X-5, §5.3, PD-6, PD-7, TC-2)

type ItemKind = { kind: "scalar" | "enum" | "message" | "group"; name: string }

// the kind of a scalar position: a scalar type, or the enum, message or group (a message with the delimited encoding,
// `delimited` of the field) it references
const itemKind = (position: unknown, delimited = false): ItemKind | undefined => {
  const ref = getKeyValue(position, "$ref")
  if (typeof ref === "string") {
    const target = refTarget(ref)
    if (target) {
      return { kind: target.kind === "enums" ? "enum" : delimited ? "group" : "message", name: target.name }
    }
    return
  }
  const scalar = scalarTypeOf(position)
  return scalar === undefined ? undefined : { kind: "scalar", name: scalar }
}

const groupOf = (groups: readonly (readonly string[])[], name: string): number =>
  groups.findIndex((group) => group.includes(name))

// the row of one item type changed (`undefined` when it is unchanged)
const itemRow = (before: ItemKind, after: ItemKind): ProtoApiMatrixRow | undefined => {
  if (before.kind === after.kind && before.name === after.name) {
    return
  }
  if (before.kind === "scalar" && after.kind === "scalar") {
    const jsonGroup = groupOf(protoApiWireJsonGroups, before.name)
    if (jsonGroup >= 0 && jsonGroup === groupOf(protoApiWireJsonGroups, after.name)) {
      return "F-11"
    }
    const wireGroup = groupOf(protoApiWireGroups, before.name)
    if (wireGroup >= 0 && wireGroup === groupOf(protoApiWireGroups, after.name)) {
      return "F-12"
    }
    return before.name === "string" && after.name === "bytes" ? "F-13" : "F-14"
  }
  if (before.kind === after.kind) {
    // an enum, message or group retargeted: different components, not compared with each other (TC-2)
    return before.kind === "enum" ? "F-15" : "F-17"
  }
  return "F-14"
}

type Cardinality = "singular" | "repeated" | "map"

const cardinalityOf = (field: unknown): Cardinality => {
  const type = getKeyValue(field, "type")
  if (type === "array" && isObject(getKeyValue(field, "items"))) {
    return "repeated"
  }
  return type === "object" && isObject(getKeyValue(field, "additionalProperties")) ? "map" : "singular"
}

// the item position of a field of a cardinality: the field itself, its `items` or its map value
const itemPosition = (field: unknown, cardinality: Cardinality): unknown =>
  cardinality === "singular" ? field : getKeyValue(field, cardinality === "repeated" ? "items" : "additionalProperties")

const severest = (compatibility: ProtoApiCompatibility, rows: (ProtoApiMatrixRow | undefined)[]): DiffType => {
  const types = rows
    .filter((row): row is ProtoApiMatrixRow => row !== undefined)
    .map((row) => levelCell(compatibility, row))
  return types.length ? mostSevere(types) : unclassified
}

/**
 * The class of a field's shape change (the carrier diff of `fieldShapeTransform`, F-11 … F-21, X-5) at a level, from
 * the original fields: the type groups of §5.3 for an item type changed (F-11 … F-17, TC-2), the cardinality groups
 * for singular ↔ repeated (F-18, PD-7: in WIRE risky for length-delimited or expanded items, breaking for packed
 * numeric and enum items), repeated ↔ map (F-19) and singular ↔ map (F-20); a repeated or map field whose item, key or
 * value changed takes the item rows (F-21, the more severe of key and value). A cardinality change that also changes
 * the item type takes the more severe of both (POLICY-139). `unclassified` when a side is not a field.
 */
export const fieldShapeCell = (compatibility: ProtoApiCompatibility, before: unknown, after: unknown): DiffType => {
  const bCardinality = cardinalityOf(before)
  const aCardinality = cardinalityOf(after)
  const bItem = itemKind(itemPosition(before, bCardinality), getKeyValue(before, "delimited") === true)
  const aItem = itemKind(itemPosition(after, aCardinality), getKeyValue(after, "delimited") === true)
  if (!bItem || !aItem) {
    return unclassified
  }
  if (bCardinality === aCardinality) {
    if (bCardinality !== "map") {
      return severest(compatibility, [itemRow(bItem, aItem)])
    }
    const bKey = itemKind(getKeyValue(before, "propertyNames"))
    const aKey = itemKind(getKeyValue(after, "propertyNames"))
    return severest(compatibility, [bKey && aKey ? itemRow(bKey, aKey) : "F-14", itemRow(bItem, aItem)])
  }
  const cardinalities = new Set([bCardinality, aCardinality])
  if (!cardinalities.has("singular")) {
    // repeated ↔ map: a map is a repeated entry message on the wire (F-19)
    return severest(compatibility, ["F-19"])
  }
  if (cardinalities.has("map")) {
    return severest(compatibility, ["F-20"])
  }
  // singular ↔ repeated (F-18, PD-7): the encoding of the repeated side's items decides the WIRE cell
  const repeated = bCardinality === "repeated" ? before : after
  const item = bCardinality === "repeated" ? bItem : aItem
  const lengthDelimited =
    item.kind === "message" ||
    item.kind === "group" ||
    (item.kind === "scalar" && protoApiLengthDelimitedScalars.has(item.name)) ||
    getKeyValue(repeated, "packed") === false
  return severest(compatibility, [lengthDelimited ? "F-18.lengthDelimited" : "F-18.packed", itemRow(bItem, aItem)])
}

// the original value of the parent node (the field of a keyword diff)
const originalParent = (side: NodeContext): unknown => (side.up ? original(side.up) : undefined)

/** F-11 … F-21, X-5: the shape carrier (`F/type`, `F/$ref`) classified by `fieldShapeCell` on the original fields. */
export const fieldShapeClassifier =
  (compatibility: ProtoApiCompatibility): DiffTypeClassifier =>
  ({ before, after }) =>
    fieldShapeCell(compatibility, originalParent(before), originalParent(after))

// ---- field keywords (F-22 … F-36)

/** F-23 / F-24: `presence: required` added, removed or replaced is breaking everywhere (Q5), `explicit` build-only. */
export const presenceClassifier =
  (compatibility: ProtoApiCompatibility): DiffTypeClassifier =>
  ({ before, after }) =>
    levelCell(compatibility, before.value === "required" || after.value === "required" ? "F-24" : "F-23")

// the numbers of the other members of a oneof in a message (the field of number `number` left out)
const otherMembers = (message: unknown, oneof: unknown, number: unknown): number => {
  const properties = asObject(getKeyValue(message, "properties")) ?? {}
  let count = 0
  for (const key of Object.keys(properties)) {
    const field = properties[key]
    if (getKeyValue(field, "oneof") === oneof && getKeyValue(field, "number") !== number) {
      count++
    }
  }
  return count
}

/**
 * F-25 … F-27 (G3, TC-1): a field joining or leaving a oneof that has other members is breaking (F-25), a oneof with
 * this field only build-only (F-26); moved between two oneofs breaking (F-27). A rename of the oneof never reaches the
 * field (F-28, `renameCascadeTransform`). The message is read on the side the field is a member on.
 */
export const oneofMembershipClassifier = (compatibility: ProtoApiCompatibility): ClassifyTupleOf => {
  const membership =
    (side: "before" | "after"): DiffTypeClassifier =>
    (ctx) => {
      const node = ctx[side]
      const field = node.up?.value
      const message = node.up?.up?.up?.value
      const others = otherMembers(message, node.value, getKeyValue(field, "number"))
      return levelCell(compatibility, others ? "F-25" : "F-26")
    }
  return [membership("after"), membership("before"), levelCell(compatibility, "F-27")]
}

type ClassifyTupleOf = [DiffType | DiffTypeClassifier, DiffType | DiffTypeClassifier, DiffType | DiffTypeClassifier]

/**
 * F-30 / F-31 (G2, C6): a `jsonName` diff of a field that was not renamed is classified by the effective JSON names
 * (`jsonName ?? default`, rule J): changed F-30, unchanged F-31 (on a renamed field the diff is folded, PD-20).
 */
export const jsonNameClassifier =
  (compatibility: ProtoApiCompatibility): DiffTypeClassifier =>
  ({ before, after }) => {
    const bField = originalParent(before)
    const aField = originalParent(after)
    const bName = String(before.up?.key ?? "")
    const aName = String(after.up?.key ?? "")
    return levelCell(
      compatibility,
      effectiveJsonName(bField, bName) === effectiveJsonName(aField, aName) ? "F-31" : "F-30",
    )
  }

// ---- effective defaults (C6, F-32 / F-33)

const INTEGER_TYPES = PROTO_INTEGER_TYPES
const FLOAT_TYPES = PROTO_FLOAT_TYPES

// a numeric value in its canonical spelling: integers through BigInt (64-bit values are strings), floats with `-0`,
// `Infinity`, `NaN` as written by the format
const canonicalNumber = (value: unknown, integer: boolean): string => {
  if (integer) {
    const text = typeof value === "number" || typeof value === "string" ? value : String(value)
    try {
      return BigInt(text).toString()
    } catch {
      return String(text)
    }
  }
  const number = typeof value === "number" ? value : Number(value)
  return Object.is(number, -0) ? "-0" : String(number)
}

// the enum a field (or extension) references, from the document of its side
const enumOf = (side: NodeContext, field: unknown): unknown => {
  const ref = getKeyValue(field, "$ref")
  if (typeof ref !== "string" || !ref.startsWith(ENUM_REF_PREFIX)) {
    return
  }
  return getKeyValue(shadowRoot(side), "components", "enums", ref.slice(ENUM_REF_PREFIX.length))
}

// the effective default of an enum: a closed enum's first declared value, else the value numbered 0
const enumDefaultNumber = (enumeration: unknown): number | undefined => {
  const values = asObject(getKeyValue(enumeration, "values")) ?? {}
  const closed = getKeyValue(enumeration, "closed") === true
  for (const name of Object.keys(values)) {
    const number = getKeyValue(values[name], "number")
    if (typeof number === "number" && (closed || number === 0)) {
      return number
    }
  }
  return
}

/**
 * The effective default of a singular field (C6): `default` ?? the implicit default (zero, empty, `false`; enum:
 * closed → first declared value, open → the value numbered 0), canonical, enum values by number. `side` is the node of
 * the field (its document holds the enum).
 */
export const effectiveDefault = (side: NodeContext, field: unknown): string | undefined => {
  const value = getKeyValue(field, "default")
  const ref = getKeyValue(field, "$ref")
  const reference = typeof ref === "string" ? ref : ""
  const text = (item: unknown): string => (typeof item === "string" ? item : JSON.stringify(item))
  if (reference.startsWith(ENUM_REF_PREFIX)) {
    const enumeration = enumOf(side, field)
    const number =
      value === undefined ? enumDefaultNumber(enumeration) : getKeyValue(enumeration, "values", text(value), "number")
    if (number !== undefined) {
      return `enum:${text(number)}`
    }
    return value === undefined ? undefined : `name:${text(value)}`
  }
  if (reference.startsWith(MESSAGE_REF_PREFIX)) {
    return value === undefined ? undefined : JSON.stringify(value)
  }
  const scalar = scalarTypeOf(field)
  if (scalar !== undefined && INTEGER_TYPES.has(scalar)) {
    return canonicalNumber(value ?? 0, true)
  }
  if (scalar !== undefined && FLOAT_TYPES.has(scalar)) {
    return canonicalNumber(value ?? 0, false)
  }
  if (scalar === "bool") {
    return text(value ?? false)
  }
  return JSON.stringify(value ?? "")
}

/** F-32 / F-33 (C6): a `default` diff classified by the effective defaults: changed F-32, unchanged F-33. */
export const defaultClassifier =
  (compatibility: ProtoApiCompatibility): DiffTypeClassifier =>
  ({ before, after }) => {
    const bDefault = before.up ? effectiveDefault(before.up, before.up.value) : undefined
    const aDefault = after.up ? effectiveDefault(after.up, after.up.value) : undefined
    return levelCell(compatibility, bDefault === aDefault ? "F-33" : "F-32")
  }

// ---- rpcs (G5)

const idempotencyRank = (value: unknown): number =>
  typeof value === "string" ? Math.max(0, protoApiIdempotencyLevels.indexOf(value)) : 0

/** R-7 / R-8 (G5): idempotency added or raised is non-breaking, removed or lowered risky, at every level. */
export const idempotencyClassifier =
  (compatibility: ProtoApiCompatibility): DiffTypeClassifier =>
  ({ before, after }) =>
    levelCell(compatibility, idempotencyRank(after.value) >= idempotencyRank(before.value) ? "R-7" : "R-8")

// ---- visibility (C6, M-19, M-20, P-15)

type Visibility = "export" | "local"

// the edition number of a `syntax` value (`proto2`, `proto3` count as before every edition)
const editionOf = (syntax: unknown): number => {
  const edition = Number(syntax)
  return Number.isFinite(edition) ? edition : 0
}

/**
 * The effective visibility of a message or enum (C6): the explicit `options.visibility` ?? the file feature
 * `default_symbol_visibility` (`EXPORT_ALL`; `EXPORT_TOP_LEVEL`: top-level export, nested local; `LOCAL_ALL` and
 * `STRICT`: local) ?? the edition default (`EXPORT_TOP_LEVEL` from edition 2024, else export).
 */
export const effectiveVisibility = (document: unknown, section: string, key: string): Visibility | undefined => {
  const element = getKeyValue(document, "components", section, key)
  if (element === undefined) {
    return
  }
  const explicit = getKeyValue(element, "options", "visibility")
  if (explicit === "export" || explicit === "local") {
    return explicit
  }
  const fileName = getKeyValue(element, "file")
  const file = typeof fileName === "string" ? getKeyValue(document, "files", fileName) : undefined
  const feature =
    getKeyValue(file, "options", "features", "default_symbol_visibility") ??
    (editionOf(getKeyValue(file, "syntax")) >= 2024 ? "EXPORT_TOP_LEVEL" : "EXPORT_ALL")
  if (feature === "EXPORT_ALL") {
    return "export"
  }
  if (feature === "EXPORT_TOP_LEVEL") {
    const pkg = getKeyValue(file, "package")
    const relative = typeof pkg === "string" && pkg && key.startsWith(`${pkg}.`) ? key.slice(pkg.length + 1) : key
    return relative.includes(".") ? "local" : "export"
  }
  return "local"
}

const visibilityRow = (before: Visibility | undefined, after: Visibility | undefined): ProtoApiMatrixRow =>
  before === after || !before || !after ? "P-15.unchanged" : after === "local" ? "M-19" : "M-20"

/**
 * M-19 / M-20 (C6, U1 G0): `options.visibility` of a message or enum classified by its effective visibility on both
 * sides: export → local build-only (M-19), local → export non-breaking F / P (M-20), unchanged annotation.
 */
export const visibilityClassifier =
  (compatibility: ProtoApiCompatibility): DiffTypeClassifier =>
  ({ before, after }) => {
    // `<components>/<section>/<key>/options/visibility`
    const bPath = before.path
    const aPath = after.path
    const row = visibilityRow(
      effectiveVisibility(shadowRoot(before), String(bPath[1]), String(bPath[2])),
      effectiveVisibility(shadowRoot(after), String(aPath[1]), String(aPath[2])),
    )
    return levelCell(compatibility, row)
  }

/**
 * P-15 (C6, G0): the file feature `default_symbol_visibility` classified by the effective visibility of the messages
 * and enums the file declares on both sides: risky F / P when one narrows (export → local), non-breaking F / P when
 * they only widen, annotation when none changes (and in WIRE_JSON / WIRE).
 */
export const defaultVisibilityClassifier =
  (compatibility: ProtoApiCompatibility): DiffTypeClassifier =>
  ({ before, after }) => {
    const bRoot = shadowRoot(before)
    const aRoot = shadowRoot(after)
    const bFile = String(before.path[1])
    const aFile = String(after.path[1])
    let narrowed = false
    let widened = false
    for (const section of ["messages", "enums"]) {
      const entries = asObject(getKeyValue(aRoot, "components", section)) ?? {}
      for (const key of Object.keys(entries)) {
        if (
          getKeyValue(entries[key], "file") !== aFile ||
          getKeyValue(bRoot, "components", section, key, "file") !== bFile
        ) {
          continue
        }
        const row = visibilityRow(effectiveVisibility(bRoot, section, key), effectiveVisibility(aRoot, section, key))
        narrowed ||= row === "M-19"
        widened ||= row === "M-20"
      }
    }
    return levelCell(compatibility, narrowed ? "P-15.narrowed" : widened ? "P-15.widened" : "P-15.unchanged")
  }

// ---- HTTP bindings (S6, PD-2)

/**
 * R-9 … R-13, R-19 (S6, PD-2): an HTTP rule or an additional binding added is non-breaking, removed or replaced (one
 * value per binding) breaking, in FILE, PACKAGE and WIRE_JSON (transcoding clients are JSON clients); annotation in
 * WIRE. `primary`: the rule at `R/http` (R-9 … R-11), else an additional binding (R-12, R-13, R-19).
 */
export const httpBindingClassifier = (compatibility: ProtoApiCompatibility, primary: boolean) =>
  nonDirectional(
    primary
      ? [levelCell(compatibility, "R-9"), levelCell(compatibility, "R-10"), levelCell(compatibility, "R-11")]
      : [levelCell(compatibility, "R-12"), levelCell(compatibility, "R-13"), levelCell(compatibility, "R-19")],
  )

// ---- generic options (R-G, PD-13, PD-26, L-1 … L-4)

// a repeated option value (`method_signature`, `(google.api.resource).pattern`) is compared as one value (PD-26)
export const repeatedValueCompare: CompareResolver = (ctx) =>
  Array.isArray(ctx.before.value) || Array.isArray(ctx.after.value) ? valueCompareResolver(ctx) : undefined

/**
 * R-G, PD-13: the generic rule of the language-specific and googleapis options (L-1 … L-4): one record per changed
 * option (an aggregate option per changed sub-path, a repeated value as one value), build-only at every action: risky
 * in FILE / PACKAGE, annotation in WIRE_JSON / WIRE; no effective value or equivalence (`ctype` and
 * `features.(pb.cpp).string_type` are two options). Not inverted in responses.
 */
export const languageOptionRule = (
  compatibility: ProtoApiCompatibility,
  row: ProtoApiMatrixRow = "L-1",
): CompareRules => {
  const type = levelCell(compatibility, row)
  const classify = nonDirectional([type, type, type])
  return { $: classify, compare: repeatedValueCompare, "/**": { $: classify, compare: repeatedValueCompare } }
}

// ---- annotation keywords (§6.8, K-1 … K-18): JSON Schema vocabulary at the field's scalar positions

// the scalar position a keyword belongs to, as written in the input (the field, `items`, `propertyNames`,
// `additionalProperties`)
const positionOf = (side: NodeContext): unknown => (side.up ? original(side.up) : undefined)

// integer positions: the bounds compare as integers, `> n` ≡ `>= n + 1`
const isIntegerPosition = (position: unknown): boolean => INTEGER_TYPES.has(scalarTypeOf(position) ?? "")

// the scalar types a validator keyword applies to: numeric bounds and steps (`minimum`, `multipleOf`, …) to the integer
// and floating-point types, length and pattern keywords to `string` and `bytes`
const VALIDATOR_SCALARS: Record<"number" | "string", ReadonlySet<string>> = {
  number: new Set([...PROTO_INTEGER_TYPES, ...PROTO_FLOAT_TYPES]),
  string: new Set(["string", "bytes"]),
}

/**
 * A validator keyword of a scalar position classified by `base` where it applies to the position's protobuf scalar type
 * (ProtoApi 0.1 `type: int64`, `type: bytes`), and an annotation where it has no effect (a length bound on an
 * `int32`, POLICY-10); a position without `type` (a message or enum reference) keeps the class of `base`.
 */
export const scalarTypeClassifier = (kind: "number" | "string", base: ClassifyRule): ClassifyRule =>
  transformClassifyRule(base, (diffType, { before, after }, action) => {
    const position = action === "remove" ? before.parent : after.parent
    if (!isObject(position)) {
      return annotation
    }
    const type = getKeyValue(position, "type")
    if (type === undefined) {
      return diffType
    }
    const scalar = scalarTypeOf(position)
    return scalar !== undefined && VALIDATOR_SCALARS[kind].has(scalar) ? diffType : annotation
  })

/** An effective bound: the value (`BigInt` at integer positions) and whether it is exclusive. */
export type ProtoApiBound = { value: bigint | number; exclusive: boolean }

// a bound value as a BigInt (integer positions) or a number; `undefined` when it is not numeric
const boundNumber = (value: unknown, integer: boolean): bigint | number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") {
    return
  }
  if (integer) {
    try {
      return BigInt(value)
    } catch {
      // a fractional bound on an integer field: compared as a number
    }
  }
  const number = typeof value === "number" ? value : Number(value)
  return Number.isNaN(number) ? undefined : number
}

const BOUND_KEYS = {
  min: { inclusive: "minimum", exclusive: "exclusiveMinimum" },
  max: { inclusive: "maximum", exclusive: "exclusiveMaximum" },
} as const

export type ProtoApiBoundKind = keyof typeof BOUND_KEYS

/** Orders two bounds of a kind: > 0 when `a` admits fewer values than `b` (tighter), 0 when they are equal. */
export const compareProtoBounds = (kind: ProtoApiBoundKind, a: ProtoApiBound, b: ProtoApiBound): number => {
  const sign = kind === "min" ? 1 : -1
  if (a.value !== b.value) {
    return (a.value > b.value ? 1 : -1) * sign
  }
  return a.exclusive === b.exclusive ? 0 : a.exclusive ? 1 : -1
}

/**
 * The effective lower (`min`) or upper (`max`) bound of a scalar position (S3, C6): the tighter of `minimum` and
 * `exclusiveMinimum` (`maximum`, `exclusiveMaximum`), 64-bit decimal strings compared as `BigInt`, integers normalised
 * (`> n` ≡ `>= n + 1`, `< n` ≡ `<= n - 1`); `undefined` without a bound.
 */
export const effectiveProtoBound = (position: unknown, kind: ProtoApiBoundKind): ProtoApiBound | undefined => {
  const integer = isIntegerPosition(position)
  const keys = BOUND_KEYS[kind]
  let result: ProtoApiBound | undefined
  for (const exclusive of [false, true]) {
    const raw = boundNumber(getKeyValue(position, exclusive ? keys.exclusive : keys.inclusive), integer)
    if (raw === undefined) {
      continue
    }
    let bound: ProtoApiBound = { value: raw, exclusive }
    if (exclusive && typeof raw === "bigint") {
      bound = { value: kind === "min" ? raw + BigInt(1) : raw - BigInt(1), exclusive: false }
    }
    if (!result || compareProtoBounds(kind, bound, result) > 0) {
      result = bound
    }
  }
  return result
}

/**
 * K-1 / K-2 (S3, BigInt wrapper): the one bound diff `boundPairTransform` leaves, classified by the effective bounds of
 * the original positions: added or tighter is breaking in requests and non-breaking in responses, removed or looser
 * non-breaking in requests and risky in responses (POLICY-05), the same effective bound annotation.
 */
export const int64BoundClassifyRule = (kind: ProtoApiBoundKind): ClassifyRule => {
  const classify =
    (response: boolean): DiffTypeClassifier =>
    ({ before, after }) => {
      const bBound = effectiveProtoBound(positionOf(before), kind)
      const aBound = effectiveProtoBound(positionOf(after), kind)
      const relation = !aBound ? -1 : !bBound ? 1 : compareProtoBounds(kind, aBound, bBound)
      if (relation === 0) {
        return annotation
      }
      return relation > 0 ? (response ? nonBreaking : breaking) : response ? risky : nonBreaking
    }
  const request = classify(false)
  const response = classify(true)
  return [request, request, request, response, response, response]
}

// divisibility of two `multipleOf` values: BigInt when both are integers (64-bit decimal strings included)
const isMultipleOf = (value: unknown, of: unknown): boolean => {
  const asBig = (item: unknown): bigint | undefined => {
    if (typeof item === "string" || (typeof item === "number" && Number.isInteger(item))) {
      try {
        return BigInt(item)
      } catch {
        return
      }
    }
    return
  }
  const bigValue = asBig(value)
  const bigOf = asBig(of)
  if (bigValue !== undefined && bigOf !== undefined) {
    return bigOf !== BigInt(0) && bigValue % bigOf === BigInt(0)
  }
  const ratio = Number(value) / Number(of)
  return Number.isFinite(ratio) && Math.abs(ratio - Math.round(ratio)) < 1e-9
}

/**
 * K-3 (BigInt wrapper of `multipleOfClassifier`): a step narrowed (added, or a multiple of the old step) is breaking in
 * requests and non-breaking in responses, widened (removed, or the old step a multiple of the new one) the reverse,
 * an unrelated step breaking both ways.
 */
export const int64MultipleOfClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  // request: widened (the old step a multiple of the new one) is non-breaking, narrowed or unrelated breaking
  ({ before, after }) => (isMultipleOf(before.value, after.value) ? nonBreaking : breaking),
  nonBreaking,
  breaking,
  // response: narrowed (the new step a multiple of the old one) is non-breaking, widened or unrelated breaking
  ({ before, after }) => (isMultipleOf(after.value, before.value) ? nonBreaking : breaking),
]

// formats whose values are a subset of another format's (ProtoApi's format names, §4.3)
const protoFormatGeneralizations: Record<string, string[]> = {
  ipv4: ["ip", "address"],
  ipv6: ["ip", "address"],
  ip: ["address"],
  hostname: ["address"],
  ipv4_with_prefixlen: ["ip_with_prefixlen"],
  ipv6_with_prefixlen: ["ip_with_prefixlen"],
  ipv4_prefix: ["ip_prefix"],
  ipv6_prefix: ["ip_prefix"],
}

/**
 * K-10: `format` added breaking in requests / non-breaking in responses, removed the reverse, replaced breaking both
 * ways, except a generalization (`ipv4` → `ip`, `hostname` → `address`, …), which reads like a removal (POLICY-41).
 */
export const protoFormatGeneralizationClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) =>
    protoFormatGeneralizations[String(before.value)]?.includes(String(after.value)) ? nonBreaking : breaking,
  nonBreaking,
  breaking,
  breaking,
]

/**
 * K-14 (S1): the field keyword `required` (annotation-level requiredness) with the cells of 2.0.0's
 * `requiredItemClassifyRule` for a kept property: added breaking in requests and non-breaking in responses, removed
 * non-breaking in requests and risky in responses (POLICY-05).
 */
export const protoRequiredFlagClassifyRule: ClassifyRule = [
  ({ after }) => (after.value === true ? breaking : nonBreaking),
  nonBreaking,
  ({ after }) => (after.value === true ? breaking : nonBreaking),
  nonBreaking,
  ({ before }) => (before.value === true ? risky : nonBreaking),
  ({ after }) => (after.value === true ? nonBreaking : risky),
]

/** The scoped cells of a field behaviour (PD-12): request [added, removed], response [added, removed]. */
const behaviorRule = (request: [DiffType, DiffType], response: [DiffType, DiffType]): ScopedClassifyRule => {
  const tuple = ([added, removed]: [DiffType, DiffType]): ClassifyTupleOf => [
    ({ after }) => (after.value === true ? added : removed),
    ({ before }) => (before.value === true ? removed : added),
    ({ after }) => (after.value === true ? added : removed),
  ]
  return { [CompareScopes.response]: tuple(response), default: tuple(request) }
}

/** K-15 (PD-12): output-only behavior (`readOnly`) added req B / resp N, removed req R / resp N. */
export const readOnlyFlagRule: ScopedClassifyRule = behaviorRule([breaking, risky], [nonBreaking, nonBreaking])
/** K-16 (PD-12): input-only behavior (`writeOnly`) added req N / resp B, removed N both. */
export const writeOnlyFlagRule: ScopedClassifyRule = behaviorRule([nonBreaking, nonBreaking], [breaking, nonBreaking])
/** K-17 (PD-12): immutable behavior added req B / resp A, removed req N / resp A. */
export const immutableFlagRule: ScopedClassifyRule = behaviorRule([breaking, nonBreaking], [annotation, annotation])
