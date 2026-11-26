import { deepEqual } from "../core"
import type { CompareTransformResolver } from "../types"
import { deepCopy, getKeyValue, isObject } from "../utils"
import { compareProtoBounds, effectiveProtoBound } from "./protoapi.classify"
import { PROTOAPI_FILE_PAIRS_CACHE_KEY } from "./protoapi.const"
import { oneofPairsOfShadow } from "./protoapi.mapping"
import {
  ENUM_REF_PREFIX,
  MESSAGE_REF_PREFIX,
  declarationSections,
  decodeProtoBytes,
  fieldShape,
  isSingularReference,
  mergeIntervals,
  overlaps,
  pairExtensions,
  pairFields,
  pairFiles,
  pairOneofs,
  parseRangeKey,
  PROTO_INTEGER_TYPES,
  scalarTypeOf,
  utf8Bytes,
  refTarget,
} from "./protoapi.utils"

// Shadow transforms of the ProtoApi rule tree (PROTOAPI_DESIGN §4.7). Inputs are never written: a transform returns
// new objects for what it changes (structural sharing elsewhere) and changes the before shadow where it can, so the
// after shadow, from which `merged` is written for mapped nodes, keeps the original keys. `merged` holds original
// values (the engine writes the input values of every node a transform changed).

type Obj = Record<string, unknown>

const asObject = (value: unknown): Obj | undefined => (isObject(value) && !Array.isArray(value) ? value : undefined)

// an object with its keys renamed by `rename` (the key order kept)
const rekey = (value: Obj, rename: (key: string) => string): Obj => {
  const result: Obj = {}
  for (const key of Object.keys(value)) {
    result[rename(key)] = value[key]
  }
  return result
}

// ---- root transforms

// rewrites, in place on a copied document, every reference to a renamed declaration: `$ref` strings of messages and
// enums, the `extendee` of extensions and option keys naming an extension (`options` objects at any element)
const rewriteReferences = (
  document: Obj,
  messages: ReadonlyMap<string, string>,
  enums: ReadonlyMap<string, string>,
  extensions: ReadonlyMap<string, string>,
) => {
  const visit = (value: unknown, key: string | undefined) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, undefined)
      }
      return
    }
    const node = asObject(value)
    if (!node) {
      return
    }
    const ref = node.$ref
    const target = refTarget(ref)
    if (target) {
      const renamed = (target.kind === "messages" ? messages : enums).get(target.name)
      if (renamed !== undefined) {
        node.$ref = `${target.kind === "messages" ? MESSAGE_REF_PREFIX : ENUM_REF_PREFIX}${renamed}`
      }
    }
    if (typeof node.extendee === "string" && messages.has(node.extendee)) {
      node.extendee = messages.get(node.extendee)
    }
    for (const child of Object.keys(node)) {
      visit(node[child], child)
    }
    if (key === "options" && extensions.size && Object.keys(node).some((option) => extensions.has(option))) {
      const renamed = rekey(node, (option) => extensions.get(option) ?? option)
      for (const option of Object.keys(node)) {
        delete node[option]
      }
      Object.assign(node, renamed)
    }
  }
  visit(document, undefined)
}

// the declarations to re-key in the before document (section → before key → after key), applied to a copy together
// with the reference rewrite; the input is returned when there is nothing to re-key
const rekeyDeclarations = (before: Obj, renames: Map<string, Map<string, string>>): Obj => {
  if (![...renames.values()].some((map) => map.size)) {
    return before
  }
  const result = deepCopy(before)
  for (const section of declarationSections) {
    const name = section[section.length - 1] as string
    const map = renames.get(name)
    const parent = section.length === 1 ? result : asObject(result.components)
    const entries = asObject(parent?.[name])
    if (!map?.size || !parent || !entries) {
      continue
    }
    parent[name] = rekey(entries, (key) => map.get(key) ?? key)
  }
  rewriteReferences(
    result,
    renames.get("messages") ?? new Map(),
    renames.get("enums") ?? new Map(),
    renames.get("extensions") ?? new Map(),
  )
  return result
}

const sectionEntries = (document: unknown, section: readonly (string | number)[]): Obj =>
  asObject(getKeyValue(document, ...section)) ?? {}

/**
 * A2: for every file on both sides whose `package` changed, the before declarations of that file (services, messages,
 * enums, extensions) whose key `<old>.<rel>` has an after counterpart `<new>.<rel>` declared in the same file are
 * re-keyed to `<new>.<rel>`, and every reference to them in the before shadow (`$ref`, rpc types, `extendee`, option
 * keys) is rewritten: the only record left is the file's `package` (P-5); changes inside the declarations are reported
 * at their after keys.
 */
export const packageRenameTransform: CompareTransformResolver = (before, after) => {
  const bFiles = asObject(getKeyValue(before, "files"))
  const aFiles = asObject(getKeyValue(after, "files"))
  if (!bFiles || !aFiles || !isObject(before)) {
    return [before, after]
  }
  const renames = new Map<string, Map<string, string>>()
  for (const path of Object.keys(bFiles)) {
    if (!(path in aFiles)) {
      continue
    }
    const oldPackage = getKeyValue(bFiles[path], "package")
    const newPackage = getKeyValue(aFiles[path], "package")
    if (oldPackage === newPackage) {
      continue
    }
    const oldPrefix = typeof oldPackage === "string" && oldPackage ? `${oldPackage}.` : ""
    const newPrefix = typeof newPackage === "string" && newPackage ? `${newPackage}.` : ""
    for (const section of declarationSections) {
      const name = section[section.length - 1] as string
      const bEntries = sectionEntries(before, section)
      const aEntries = sectionEntries(after, section)
      for (const key of Object.keys(bEntries)) {
        if (getKeyValue(bEntries[key], "file") !== path || !key.startsWith(oldPrefix)) {
          continue
        }
        const target = `${newPrefix}${key.slice(oldPrefix.length)}`
        if (target === key || target in bEntries || getKeyValue(aEntries[target], "file") !== path) {
          continue
        }
        let map = renames.get(name)
        if (!map) {
          map = new Map()
          renames.set(name, map)
        }
        map.set(key, target)
      }
    }
  }
  return [rekeyDeclarations(before as Obj, renames), after]
}

/**
 * A5: for every renamed file (`pairFiles`: a path on one side only whose declared element set is identical and not
 * empty), the before shadow's `file` keywords of its declarations and the `imports` / `importFlags` entries naming the
 * old path are rewritten to the new path: the only record left is the rename at `files` (P-20,
 * `fileMappingResolver`). The pairs are shared with `/files` through the session.
 */
export const fileRenameTransform: CompareTransformResolver = (before, after, ctx) => {
  const pairs = pairFiles(before, after)
  ctx?.session.caches.set(PROTOAPI_FILE_PAIRS_CACHE_KEY, pairs)
  if (!pairs.size || !isObject(before)) {
    return [before, after]
  }
  const result = deepCopy(before) as Obj
  for (const section of declarationSections) {
    const entries = sectionEntries(result, section)
    for (const key of Object.keys(entries)) {
      const entry = asObject(entries[key])
      const file = entry?.file
      if (entry && typeof file === "string" && pairs.has(file)) {
        entry.file = pairs.get(file)
      }
    }
  }
  const files = sectionEntries(result, ["files"])
  for (const path of Object.keys(files)) {
    const entry = asObject(files[path])
    if (!entry) {
      continue
    }
    if (Array.isArray(entry.imports)) {
      entry.imports = entry.imports.map((item) => (typeof item === "string" ? (pairs.get(item) ?? item) : item))
    }
    const flags = asObject(entry.importFlags)
    if (flags && Object.keys(flags).some((item) => pairs.has(item))) {
      entry.importFlags = rekey(flags, (item) => pairs.get(item) ?? item)
    }
  }
  return [result, after]
}

const lastSegment = (name: string): string => name.slice(name.lastIndexOf(".") + 1)

/**
 * A6: a proto2 group renamed (`group Header` → `group Hdr`) is one field rename: for every field pair of a message
 * pair (by number) that is a group on both sides (`delimited: true`, a `$ref` to `<owner>.<Group>` with the field
 * named like the lower-cased group), the before shadow's group message (and the messages nested in it) is re-keyed to
 * the after key, its `title` takes the after name and the references to it are rewritten.
 */
export const groupRenameTransform: CompareTransformResolver = (before, after) => {
  const bMessages = sectionEntries(before, ["components", "messages"])
  const aMessages = sectionEntries(after, ["components", "messages"])
  const renames = new Map<string, string>()
  for (const owner of Object.keys(bMessages)) {
    if (!(owner in aMessages)) {
      continue
    }
    const bProperties = asObject(getKeyValue(bMessages[owner], "properties")) ?? {}
    const aProperties = asObject(getKeyValue(aMessages[owner], "properties")) ?? {}
    for (const [bKey, aKey] of pairFields(bProperties, aProperties)) {
      const bField = bProperties[bKey]
      const aField = aProperties[aKey]
      if (getKeyValue(bField, "delimited") !== true || getKeyValue(aField, "delimited") !== true) {
        continue
      }
      const bGroup = refTarget(getKeyValue(bField, "$ref"))
      const aGroup = refTarget(getKeyValue(aField, "$ref"))
      if (bGroup?.kind !== "messages" || aGroup?.kind !== "messages" || bGroup.name === aGroup.name) {
        continue
      }
      const isGroup = (name: string, field: string) =>
        name.startsWith(`${owner}.`) && lastSegment(name).toLowerCase() === field
      if (
        !isGroup(bGroup.name, bKey) ||
        !isGroup(aGroup.name, aKey) ||
        !(bGroup.name in bMessages) ||
        !(aGroup.name in aMessages) ||
        aGroup.name in bMessages ||
        bGroup.name in aMessages
      ) {
        continue
      }
      renames.set(bGroup.name, aGroup.name)
    }
  }
  if (!renames.size) {
    return [before, after]
  }
  // the group messages and the messages nested in them
  const messages = new Map<string, string>()
  for (const key of Object.keys(bMessages)) {
    for (const [from, to] of renames) {
      if (key === from || key.startsWith(`${from}.`)) {
        messages.set(key, `${to}${key.slice(from.length)}`)
      }
    }
  }
  const nested = new Map<string, string>()
  for (const section of ["enums", "extensions"]) {
    for (const key of Object.keys(sectionEntries(before, ["components", section]))) {
      for (const [from, to] of renames) {
        if (key.startsWith(`${from}.`)) {
          nested.set(`${section}|${key}`, `${to}${key.slice(from.length)}`)
        }
      }
    }
  }
  const sectionMap = (section: string) =>
    new Map(
      [...nested]
        .filter(([key]) => key.startsWith(`${section}|`))
        .map(([key, to]): [string, string] => [key.slice(section.length + 1), to]),
    )
  const result = rekeyDeclarations(
    before as Obj,
    new Map([
      ["messages", messages],
      ["enums", sectionMap("enums")],
      ["extensions", sectionMap("extensions")],
    ]),
  )
  const shadowMessages = sectionEntries(result, ["components", "messages"])
  for (const to of renames.values()) {
    const group = asObject(shadowMessages[to])
    const title = getKeyValue(aMessages[to], "title")
    if (group && typeof title === "string") {
      group.title = title
    }
  }
  return [result, after]
}

// ---- message pair transforms

const propertiesOf = (message: unknown): Obj => asObject(getKeyValue(message, "properties")) ?? {}

/**
 * G3, S9, PD-20: the before members' `oneof` values are rewritten through `pairOneofs`, so a oneof renamed with the
 * same members is one rename diff (M-7); for every renamed field (paired by number) the before `jsonName` takes the
 * after spelling, so the JSON name is folded into the rename record (whose classifier and description read the
 * original effective names).
 */
export const renameCascadeTransform: CompareTransformResolver = (before, after) => {
  const bMessage = asObject(before)
  if (!bMessage || !isObject(after)) {
    return [before, after]
  }
  const pairs = pairOneofs(before, after)
  const bProperties = propertiesOf(before)
  const aProperties = propertiesOf(after)
  let properties: Obj | undefined
  const writable = () => {
    properties ??= { ...bProperties }
    return properties
  }
  const update = (key: string, change: (field: Obj) => void) => {
    const target = writable()
    const field = { ...asObject(target[key]) }
    change(field)
    target[key] = field
  }
  for (const key of Object.keys(bProperties)) {
    const oneof = getKeyValue(bProperties[key], "oneof")
    const renamed = typeof oneof === "string" ? pairs.get(oneof) : undefined
    if (renamed !== undefined && renamed !== oneof) {
      update(key, (field) => {
        field.oneof = renamed
      })
    }
  }
  for (const [bKey, aKey] of pairFields(bProperties, aProperties)) {
    if (bKey === aKey) {
      continue
    }
    const bJson = getKeyValue(bProperties[bKey], "jsonName")
    const aJson = getKeyValue(aProperties[aKey], "jsonName")
    if (bJson !== aJson) {
      update(bKey, (field) => {
        if (aJson === undefined) {
          delete field.jsonName
        } else {
          field.jsonName = aJson
        }
      })
    }
  }
  if (!properties) {
    return [before, after]
  }
  const result = { ...bMessage, properties }
  oneofPairsOfShadow.set(result, pairs)
  return [result, after]
}

// keys that make a oneof entry carry something of its own (S8)
const OWN_ONEOF_KEYS = ["title", "description", "deprecation", "options", "x-annotation-conflicts"]

const isBareOneof = (entry: unknown): boolean => isObject(entry) && OWN_ONEOF_KEYS.every((key) => !(key in entry))

const hasMembers = (message: unknown, oneof: string): boolean =>
  Object.values(propertiesOf(message)).some((field) => getKeyValue(field, "oneof") === oneof)

/**
 * S8: a `oneofs` entry on one side only (after pairing) that carries nothing of its own (no title, description,
 * deprecation, options or conflict entries) and whose members exist on that side is mirrored into the before shadow,
 * so the entry gives no record (M-5 / M-6): the members' `oneof` records (F-25, F-26) carry the change.
 */
export const oneofEntryTransform: CompareTransformResolver = (before, after) => {
  const bMessage = asObject(before)
  if (!bMessage || !isObject(after)) {
    return [before, after]
  }
  const pairs = oneofPairsOfShadow.get(bMessage) ?? pairOneofs(before, after)
  const bOneofs = asObject(bMessage.oneofs) ?? {}
  const aOneofs = asObject(getKeyValue(after, "oneofs")) ?? {}
  const paired = new Set(pairs.values())
  let oneofs: Obj | undefined
  for (const key of Object.keys(bOneofs)) {
    if (!pairs.has(key) && isBareOneof(bOneofs[key]) && hasMembers(before, key)) {
      oneofs ??= { ...bOneofs }
      delete oneofs[key]
    }
  }
  for (const key of Object.keys(aOneofs)) {
    if (!paired.has(key) && !(key in bOneofs) && isBareOneof(aOneofs[key]) && hasMembers(after, key)) {
      oneofs ??= { ...bOneofs }
      oneofs[key] = aOneofs[key]
    }
  }
  if (!oneofs) {
    return [before, after]
  }
  const result = { ...bMessage, oneofs }
  oneofPairsOfShadow.set(result, pairs)
  return [result, after]
}

// the largest field number of a message: 2147483646 in a MessageSet (`message_set_wire_format`), else 536870911
const MAX_FIELD_NUMBER = 536870911
const MAX_MESSAGE_SET_NUMBER = 2147483646
const maxFieldNumber = (message: unknown): number =>
  getKeyValue(message, "options", "message_set_wire_format") === true ? MAX_MESSAGE_SET_NUMBER : MAX_FIELD_NUMBER

// a range list with the upper bound `from` (written `max`) read as `to`
const withMax = (list: unknown, from: number, to: number): unknown =>
  Array.isArray(list) && list.some((range) => Array.isArray(range) && range[1] === from)
    ? list.map((range) => (Array.isArray(range) && range[1] === from ? [range[0], to] : range))
    : list

/**
 * ISSUE-403: `max` in an extension or reserved range is the largest field number of the message, which
 * `message_set_wire_format` changes; when the option is toggled, a before range ending at the before maximum ends at
 * the after maximum in the before shadow, so the unchanged `to max` statement gives no record next to the option's.
 */
export const messageSetMaxTransform: CompareTransformResolver = (before, after) => {
  const bMessage = asObject(before)
  if (!bMessage || !isObject(after)) {
    return [before, after]
  }
  const from = maxFieldNumber(bMessage)
  const to = maxFieldNumber(after)
  if (from === to) {
    return [before, after]
  }
  const extensions = withMax(bMessage.extensions, from, to)
  const reserved = asObject(bMessage.reserved)
  const numbers = withMax(reserved?.numbers, from, to)
  if (extensions === bMessage.extensions && numbers === reserved?.numbers) {
    return [before, after]
  }
  return [{ ...bMessage, extensions, ...(reserved ? { reserved: { ...reserved, numbers } } : {}) }, after]
}

/**
 * POLICY-136: the options and declarations of an extension range follow their range. An `extensionOptions` entry or
 * an `options.extension_declarations` entry whose range overlaps no range of the other side (a range added or removed
 * with its options) is mirrored into the before shadow: the coverage record of the range (M-15 / M-16) carries the
 * change. A declarations entry whose range was extended or shrunk (its key overlaps exactly one unmatched key of the
 * other side) is re-keyed to the after range, so its declarations are compared by number.
 */
export const extensionRangeTransform: CompareTransformResolver = (before, after) => {
  const bMessage = asObject(before)
  if (!bMessage || !isObject(after)) {
    return [before, after]
  }
  const bRanges = mergeIntervals(bMessage.extensions)
  const aRanges = mergeIntervals(getKeyValue(after, "extensions"))
  const covered = (range: unknown, set: [number, number][]) =>
    Array.isArray(range) && set.some((interval) => overlaps(range as [number, number], interval))
  let result: Obj | undefined
  const writable = () => {
    result ??= { ...bMessage }
    return result
  }

  // extension range options
  const bOptions = Array.isArray(bMessage.extensionOptions) ? bMessage.extensionOptions : []
  const aOptions = getKeyValue(after, "extensionOptions")
  const aList = Array.isArray(aOptions) ? aOptions : []
  const keptOptions = bOptions.filter((entry) => covered(getKeyValue(entry, "range"), aRanges))
  const addedOptions = aList.filter((entry) => !covered(getKeyValue(entry, "range"), bRanges))
  if (keptOptions.length !== bOptions.length || addedOptions.length) {
    writable().extensionOptions = [...keptOptions, ...addedOptions]
  }

  // extension declarations, keyed by range
  const bDeclarations = asObject(getKeyValue(bMessage, "options", "extension_declarations"))
  const aDeclarations = asObject(getKeyValue(after, "options", "extension_declarations"))
  if (bDeclarations || aDeclarations) {
    const bKeys = Object.keys(bDeclarations ?? {})
    const aKeys = Object.keys(aDeclarations ?? {})
    const bOnly = bKeys.filter((key) => !aKeys.includes(key))
    const aOnly = aKeys.filter((key) => !bKeys.includes(key))
    const renamed = new Map<string, string>()
    const overlapping = (key: string, others: string[]) => {
      const range = parseRangeKey(key)
      return others.filter((other) => {
        const otherRange = parseRangeKey(other)
        return !!range && !!otherRange && overlaps(range, otherRange)
      })
    }
    for (const key of bOnly) {
      const candidates = overlapping(key, aOnly)
      if (candidates.length === 1 && overlapping(candidates[0], bOnly).length === 1) {
        renamed.set(key, candidates[0])
      }
    }
    const declarations: Obj = {}
    let changed = renamed.size > 0
    for (const key of bKeys) {
      const target = renamed.get(key) ?? key
      if (!renamed.has(key) && bOnly.includes(key) && !covered(parseRangeKey(key), aRanges)) {
        changed = true
        continue
      }
      declarations[target] = (bDeclarations as Obj)[key]
    }
    for (const key of aOnly) {
      if (![...renamed.values()].includes(key) && !covered(parseRangeKey(key), bRanges)) {
        declarations[key] = (aDeclarations as Obj)[key]
        changed = true
      }
    }
    if (changed) {
      const options = { ...asObject(bMessage.options) }
      if (Object.keys(declarations).length) {
        options.extension_declarations = declarations
      } else {
        delete options.extension_declarations
      }
      writable().options = options
    }
  }
  if (!result) {
    return [before, after]
  }
  const pairs = oneofPairsOfShadow.get(bMessage)
  if (pairs) {
    oneofPairsOfShadow.set(result, pairs)
  }
  return [result, after]
}

// ---- field pair transforms

const SHAPE_KEYS = ["type", "$ref"]
const INNER_POSITIONS = ["items", "propertyNames", "additionalProperties"]

// the field without its shape keys (inner positions left empty are dropped), the carrier key holding the spelling
const shapeShadow = (field: Obj, carrier: string, spelling: string): Obj => {
  const result: Obj = { ...field }
  for (const key of SHAPE_KEYS) {
    delete result[key]
  }
  for (const position of INNER_POSITIONS) {
    const inner = asObject(result[position])
    if (!inner) {
      continue
    }
    const rest = { ...inner }
    for (const key of SHAPE_KEYS) {
      delete rest[key]
    }
    if (Object.keys(rest).length) {
      result[position] = rest
    } else {
      delete result[position]
    }
  }
  result[carrier] = spelling
  return result
}

const cardinalityOf = (field: Obj): "singular" | "repeated" | "map" =>
  field.type === "array"
    ? "repeated"
    : field.type === "object" && isObject(field.additionalProperties)
      ? "map"
      : "singular"

// the value of a keyword at a scalar position (`undefined` position: the field itself)
const positionValue = (field: Obj, position: string | undefined, key: string): unknown =>
  position === undefined ? field[key] : getKeyValue(field[position], key)

const isStringPosition = (field: Obj, position: string | undefined): boolean =>
  scalarTypeOf(position === undefined ? field : field[position]) === "string"

// sets (or deletes) a keyword at a scalar position of a shadow field; an inner position left empty is dropped
const setPositionValue = (field: Obj, position: string | undefined, key: string, value: unknown) => {
  if (position === undefined) {
    if (value === undefined) {
      delete field[key]
    } else {
      field[key] = value
    }
    return
  }
  const inner = { ...asObject(field[position]) }
  if (value === undefined) {
    delete inner[key]
  } else {
    inner[key] = value
  }
  if (Object.keys(inner).length) {
    field[position] = inner
  } else {
    delete field[position]
  }
}

/**
 * DG-01: a field's (or an extension's) type, cardinality, map key or map value is one value. When the canonical
 * spellings (`int64`, `pkg.M`, `repeated <item>`, `map<K, V>`) differ, both shadows lose `$ref` and the
 * shape keys of the inner positions, and the carrier key (`$ref` when the after field is a singular message or enum
 * field, else `type`) holds the spelling on both sides: exactly one diff, at a key the after source has. Its
 * classifier reads the original fields. The keywords the shape alone decides follow it in the before shadow
 * (ISSUE-371): `presence` and `packed` when the cardinality changes (a repeated field has no presence, a singular one
 * no encoding), `utf8Validation` at a position that is not a string position on both sides, and `delimited` (a group
 * is another item kind than a message, ISSUE-380).
 */
export const fieldShapeTransform: CompareTransformResolver = (before, after, ctx) => {
  const bField = asObject(before)
  const aField = asObject(after)
  const bShape = fieldShape(bField)
  const aShape = fieldShape(aField)
  if (!bField || !aField || bShape === undefined || aShape === undefined || bShape === aShape) {
    return [before, after]
  }
  const carrier = isSingularReference(aField) ? "$ref" : "type"
  const bShadow = shapeShadow(bField, carrier, bShape)
  if (cardinalityOf(bField) !== cardinalityOf(aField)) {
    for (const key of ["presence", "packed"]) {
      setPositionValue(bShadow, undefined, key, aField[key])
    }
  }
  // the message encoding (group or length-delimited message) is part of the item kind the shape record classifies
  // (ISSUE-380)
  setPositionValue(bShadow, undefined, "delimited", aField.delimited)
  for (const position of [undefined, ...INNER_POSITIONS]) {
    if (isStringPosition(bField, position) && isStringPosition(aField, position)) {
      continue
    }
    // a string scalar that moves with the cardinality (field → items, field → map value, …) keeps its validation
    // value, so a validation changed at the same time (by a syntax change) is still compared (ISSUE-402)
    const source = movedPosition(bField, aField, position)
    const value =
      source !== null && isStringPosition(aField, position) && isStringPosition(bField, source)
        ? positionValue(bField, source, "utf8Validation")
        : positionValue(aField, position, "utf8Validation")
    setPositionValue(bShadow, position, "utf8Validation", value)
  }
  // a default (or documented default) the type change only respells is the same wire value: the after spelling in the
  // before shadow, no record of its own (R-1, ISSUE-400)
  const bType = scalarKind(bField, ctx?.before.root)
  const aType = scalarKind(aField, ctx?.after.root)
  for (const key of ["default", "x-default"]) {
    if (sameWireValue(bType(bField[key]), aType(aField[key]))) {
      bShadow[key] = aField[key]
    }
  }
  const aShadow = shapeShadow(aField, carrier, aShape)
  // an inner position the before shadow keeps a keyword at (a validation compared across the move) exists on both
  // sides, so the keyword is the diff and not the position
  for (const position of INNER_POSITIONS) {
    if (isObject(bShadow[position]) && !isObject(aShadow[position]) && isObject(aField[position])) {
      aShadow[position] = {}
    }
  }
  return [bShadow, aShadow]
}

// the position of a field's values: the field itself, its items or its map values
const valuesPosition = (field: Obj): string | undefined => {
  const cardinality = cardinalityOf(field)
  return cardinality === "repeated" ? "items" : cardinality === "map" ? "additionalProperties" : undefined
}

// the before position whose scalar the after position holds across a cardinality change (`null`: none)
const movedPosition = (bField: Obj, aField: Obj, position: string | undefined): string | undefined | null => {
  if (position === "propertyNames") {
    return cardinalityOf(bField) === "map" ? "propertyNames" : null
  }
  return position === valuesPosition(aField) ? valuesPosition(bField) : null
}

type WireValue = { kind: "bytes"; bytes: number[] } | { kind: "varint"; value: bigint } | undefined

/**
 * The wire value of a field's scalar value, by the field's type: the bytes of a string or bytes value, the varint of a
 * bool, integer or enum value (an enum value by its number in the document `root`).
 */
const scalarKind =
  (field: Obj, root: unknown) =>
  (value: unknown): WireValue => {
    if (value === undefined) {
      return
    }
    const scalar = scalarTypeOf(field)
    if (scalar === "string" && typeof value === "string") {
      return { kind: "bytes", bytes: utf8Bytes(value) }
    }
    if (scalar === "bytes" && typeof value === "string") {
      const bytes = decodeProtoBytes(value)
      return bytes ? { kind: "bytes", bytes } : undefined
    }
    if (scalar === "bool" && typeof value === "boolean") {
      return { kind: "varint", value: BigInt(value ? 1 : 0) }
    }
    if (
      PROTO_INTEGER_TYPES.has(scalar ?? "") &&
      (typeof value === "number" || (typeof value === "string" && /^-?\d+$/.test(value)))
    ) {
      return Number.isInteger(Number(value)) ? { kind: "varint", value: BigInt(value) } : undefined
    }
    const target = refTarget(field.$ref)
    if (target?.kind === "enums" && typeof value === "string") {
      const number = getKeyValue(root, "components", "enums", target.name, "values", value, "number")
      return typeof number === "number" ? { kind: "varint", value: BigInt(number) } : undefined
    }
    return
  }

/**
 * Whether two values of different scalar types are the same wire value: a string and a bytes value with the same
 * bytes; a bool, an integer or an enum value with the same varint (ISSUE-400). Values of one type are compared by the
 * other transforms (S4).
 */
const sameWireValue = (bValue: WireValue, aValue: WireValue): boolean => {
  if (!bValue || !aValue || bValue.kind !== aValue.kind) {
    return false
  }
  if (bValue.kind === "varint" && aValue.kind === "varint") {
    return bValue.value === aValue.value
  }
  if (bValue.kind === "bytes" && aValue.kind === "bytes") {
    return bValue.bytes.length === aValue.bytes.length && bValue.bytes.every((byte, i) => byte === aValue.bytes[i])
  }
  return false
}

/**
 * DG-23: a field that joins or leaves a oneof takes the other side's presence in the before shadow (oneof members
 * have explicit presence by rule P), so the move is one `oneof` diff.
 */
export const oneofPresenceTransform: CompareTransformResolver = (before, after) => {
  const bField = asObject(before)
  const aField = asObject(after)
  if (!bField || !aField || (bField.oneof === undefined) === (aField.oneof === undefined)) {
    return [before, after]
  }
  if (bField.presence === aField.presence) {
    return [before, after]
  }
  const result = { ...bField }
  if (aField.presence === undefined) {
    delete result.presence
  } else {
    result.presence = aField.presence
  }
  return [result, after]
}

// ---- document pre-pass

/** The effective default value of an enum (C6): a closed enum's first declared value, else the value numbered 0. */
export const effectiveEnumDefault = (enumeration: unknown): { name: string; number: number } | undefined => {
  const values = asObject(getKeyValue(enumeration, "values"))
  if (!values) {
    return
  }
  const closed = getKeyValue(enumeration, "closed") === true
  for (const name of Object.keys(values)) {
    const number = getKeyValue(values[name], "number")
    if (typeof number === "number" && (closed || number === 0)) {
      return { name, number }
    }
  }
  return
}

/**
 * C6, F-32: an enum-typed singular field (or extension) without `default` on both sides whose effective default
 * changed (a closed enum's first declared value, compared by number) gets the before effective default in the before
 * shadow: one `remove` diff at `…/default`, classified by the after effective default; `merged` shows the removed
 * implicit default with its meta. Runs on the documents before the walk (ISSUE-370): a reordering of enum values
 * leaves both documents structurally equal for the unchanged-subtree check, which compares objects without their key
 * order, so a transform of the field pair would never run. Returns the before document unchanged when no field is
 * affected.
 */
export const implicitDefaultTransform = (before: unknown, after: unknown): [unknown, unknown] => {
  const bEnums = sectionEntries(before, ["components", "enums"])
  const aEnums = sectionEntries(after, ["components", "enums"])
  const changedDefaults = new Map<string, string>()
  for (const name of Object.keys(bEnums)) {
    if (!(name in aEnums)) {
      continue
    }
    const bDefault = effectiveEnumDefault(bEnums[name])
    const aDefault = effectiveEnumDefault(aEnums[name])
    if (bDefault && aDefault && bDefault.number !== aDefault.number) {
      changedDefaults.set(name, bDefault.name)
    }
  }
  if (!changedDefaults.size) {
    return [before, after]
  }
  // the fields to update: [section path, entry key, field key or undefined for an extension]
  const updates: { section: string; key: string; field?: string; value: string }[] = []
  const implicit = (bField: unknown, aField: unknown): string | undefined => {
    if (getKeyValue(bField, "default") !== undefined || getKeyValue(aField, "default") !== undefined) {
      return
    }
    const bTarget = refTarget(getKeyValue(bField, "$ref"))
    const aTarget = refTarget(getKeyValue(aField, "$ref"))
    if (bTarget?.kind !== "enums" || aTarget?.kind !== "enums" || bTarget.name !== aTarget.name) {
      return
    }
    return changedDefaults.get(bTarget.name)
  }
  const bMessages = sectionEntries(before, ["components", "messages"])
  const aMessages = sectionEntries(after, ["components", "messages"])
  for (const key of Object.keys(bMessages)) {
    if (!(key in aMessages)) {
      continue
    }
    const bProperties = propertiesOf(bMessages[key])
    const aProperties = propertiesOf(aMessages[key])
    for (const [bKey, aKey] of pairFields(bProperties, aProperties)) {
      const value = implicit(bProperties[bKey], aProperties[aKey])
      if (value !== undefined) {
        updates.push({ section: "messages", key, field: bKey, value })
      }
    }
  }
  const bExtensions = sectionEntries(before, ["components", "extensions"])
  const aExtensions = sectionEntries(after, ["components", "extensions"])
  for (const key of Object.keys(bExtensions)) {
    const value = key in aExtensions ? implicit(bExtensions[key], aExtensions[key]) : undefined
    if (value !== undefined) {
      updates.push({ section: "extensions", key, value })
    }
  }
  if (!updates.length) {
    return [before, after]
  }
  // copy-on-write along the updated paths
  const document = { ...(before as Obj) }
  const components = { ...asObject(document.components) }
  document.components = components
  for (const { section, key, field, value } of updates) {
    const entries = { ...asObject(components[section]) }
    components[section] = entries
    const entry = { ...asObject(entries[key]) }
    entries[key] = entry
    if (field === undefined) {
      entry.default = value
      continue
    }
    const properties = { ...asObject(entry.properties) }
    entry.properties = properties
    properties[field] = { ...asObject(properties[field]), default: value }
  }
  return [document, after]
}

// ---- container transforms

/**
 * A3 (ISSUE-373): an extension renamed with the same extendee and number (`extensionMappingResolver`) keeps its
 * `title`, the short name, in step with its key: the before shadow takes the after title, so the rename is one
 * record.
 */
export const extensionRenameTransform: CompareTransformResolver = (before, after) => {
  const bExtensions = asObject(before)
  const aExtensions = asObject(after)
  if (!bExtensions || !aExtensions) {
    return [before, after]
  }
  let result: Obj | undefined
  for (const [bKey, aKey] of pairExtensions(bExtensions, aExtensions)) {
    const bTitle = getKeyValue(bExtensions[bKey], "title")
    const aTitle = getKeyValue(aExtensions[aKey], "title")
    if (bKey !== aKey && bTitle === lastSegment(bKey) && aTitle === lastSegment(aKey)) {
      result ??= { ...bExtensions }
      result[bKey] = { ...asObject(bExtensions[bKey]), title: aTitle }
    }
  }
  return [result ?? before, after]
}

/**
 * POLICY-137: an import added or removed together with its modifier (`import public`, `import weak`, edition 2024
 * `import option`) is one record, the `imports` entry: the `importFlags` entry of an import present on one side only is
 * mirrored into the before shadow. The `imports` rule classifies the record by the modifier.
 */
export const importFlagsTransform: CompareTransformResolver = (before, after) => {
  const bFile = asObject(before)
  const aFile = asObject(after)
  if (!bFile || !aFile) {
    return [before, after]
  }
  const bImports = new Set(Array.isArray(bFile.imports) ? bFile.imports : [])
  const aImports = new Set(Array.isArray(aFile.imports) ? aFile.imports : [])
  const bFlags = asObject(bFile.importFlags) ?? {}
  const aFlags = asObject(aFile.importFlags) ?? {}
  let flags: Obj | undefined
  for (const path of Object.keys(bFlags)) {
    if (bImports.has(path) && !aImports.has(path)) {
      flags ??= { ...bFlags }
      delete flags[path]
    }
  }
  for (const path of Object.keys(aFlags)) {
    if (aImports.has(path) && !bImports.has(path)) {
      flags ??= { ...bFlags }
      flags[path] = aFlags[path]
    }
  }
  return flags ? [{ ...bFile, importFlags: flags }, after] : [before, after]
}

// ---- keyword folds (§4.7: S4, S3, A7 / PD-19)

// the scalar positions of a field: the field itself (`undefined`) and its inner positions
const SCALAR_POSITIONS: (string | undefined)[] = [undefined, ...INNER_POSITIONS]

// keywords whose numeric values are compared numerically (S4)
const NUMERIC_KEYWORDS = [
  "minimum",
  "exclusiveMinimum",
  "maximum",
  "exclusiveMaximum",
  "multipleOf",
  "const",
  "default",
  "x-default",
]

const INTEGER_SPELLING = /^-?\d+$/
const NUMBER_SPELLING = /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

/**
 * S4: two numeric spellings of one value (`0` ≡ `"0"`, `10` ≡ `"10"`): integers through `BigInt` (64-bit values are
 * decimal strings), other numbers through `Number`; a string that does not spell a number never equals a number.
 */
export const numericEqual = (a: unknown, b: unknown): boolean => {
  const spelling = (value: unknown): string | undefined =>
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : typeof value === "string" && NUMBER_SPELLING.test(value)
        ? value
        : undefined
  const aText = spelling(a)
  const bText = spelling(b)
  if (aText === undefined || bText === undefined) {
    return false
  }
  if (INTEGER_SPELLING.test(aText) && INTEGER_SPELLING.test(bText)) {
    return BigInt(aText) === BigInt(bText)
  }
  return Number(aText) === Number(bText)
}

// a before value respelled as the after value when both spell the same number (enum lists item by item)
const respell = (bValue: unknown, aValue: unknown): unknown => {
  if (bValue === aValue) {
    return bValue
  }
  if (Array.isArray(bValue) && Array.isArray(aValue)) {
    let changed = false
    const result = bValue.map((item) => {
      if (aValue.includes(item)) {
        return item
      }
      const match = aValue.find((candidate) => numericEqual(item, candidate))
      if (match === undefined) {
        return item
      }
      changed = true
      return match
    })
    return changed ? result : bValue
  }
  return numericEqual(bValue, aValue) ? aValue : bValue
}

/**
 * S4: at every scalar position pair (the field, `items`, `propertyNames`, `additionalProperties`), a before value of
 * `minimum`, `exclusiveMinimum`, `maximum`, `exclusiveMaximum`, `multipleOf`, `const`, `default`, `x-default` or an
 * `enum` item numerically equal to the after value takes the after spelling (`numericEqual`), so an `int32` → `int64`
 * change with an unchanged rule leaves only the shape record (W-16).
 */
export const numericSpellingTransform: CompareTransformResolver = (before, after) => {
  const bField = asObject(before)
  const aField = asObject(after)
  if (!bField || !aField) {
    return [before, after]
  }
  let result: Obj | undefined
  for (const position of SCALAR_POSITIONS) {
    for (const key of [...NUMERIC_KEYWORDS, "enum"]) {
      const bValue = positionValue(result ?? bField, position, key)
      const aValue = positionValue(aField, position, key)
      if (bValue === undefined || aValue === undefined) {
        continue
      }
      const value = respell(bValue, aValue)
      if (value !== bValue) {
        result ??= { ...bField }
        setPositionValue(result, position, key, value)
      }
    }
  }
  return [result ?? before, after]
}

type WrittenBound = { key: string; value: unknown; exclusive: boolean }

const BOUND_PAIRS = [
  { kind: "min" as const, inclusive: "minimum", exclusive: "exclusiveMinimum", sign: ">" },
  { kind: "max" as const, inclusive: "maximum", exclusive: "exclusiveMaximum", sign: "<" },
]

// the bound keys written at a position, the effective (tighter) one first
const writtenBounds = (field: Obj, position: string | undefined, pair: (typeof BOUND_PAIRS)[number]) => {
  const written: WrittenBound[] = []
  for (const exclusive of [false, true]) {
    const key = exclusive ? pair.exclusive : pair.inclusive
    const value = positionValue(field, position, key)
    if (value !== undefined) {
      written.push({ key, value, exclusive })
    }
  }
  if (written.length === 2) {
    const target = (position === undefined ? field : asObject(field[position])) ?? {}
    const alone = (item: WrittenBound) => effectiveProtoBound({ type: target.type, [item.key]: item.value }, pair.kind)
    const first = alone(written[0])
    const second = alone(written[1])
    if (first && second && compareProtoBounds(pair.kind, second, first) > 0) {
      written.reverse()
    }
  }
  return written
}

/** The canonical spelling of a bound for the bound carrier and descriptions: `> 0`, `>= 0`, `< 100`, `<= 100`. */
export const boundSpelling = (sign: ">" | "<", exclusive: boolean, value: unknown): string =>
  `${sign}${exclusive ? "" : "="} ${String(value)}`

/**
 * S3: a lower bound is one value (`minimum` / `exclusiveMinimum`), so is an upper bound (`maximum` /
 * `exclusiveMaximum`). At every scalar position pair whose bound keys differ between the sides (`exclusiveMinimum` on
 * one, `minimum` on the other) or where a side writes both, both shadows lose the two keys and the carrier key (the
 * effective key of the after side, else of the before side) holds each side's effective bound as written (`> 0`,
 * `>= 0`; absent on a side without the bound): exactly one diff, classified by `int64BoundClassifyRule` on the
 * original positions.
 */
export const boundPairTransform: CompareTransformResolver = (before, after) => {
  const bField = asObject(before)
  const aField = asObject(after)
  if (!bField || !aField) {
    return [before, after]
  }
  let bResult: Obj | undefined
  let aResult: Obj | undefined
  for (const position of SCALAR_POSITIONS) {
    for (const pair of BOUND_PAIRS) {
      const bWritten = writtenBounds(bResult ?? bField, position, pair)
      const aWritten = writtenBounds(aResult ?? aField, position, pair)
      const respelled =
        bWritten.length === 2 ||
        aWritten.length === 2 ||
        (bWritten.length === 1 && aWritten.length === 1 && bWritten[0].key !== aWritten[0].key)
      if (!respelled) {
        continue
      }
      const carrier = (aWritten[0] ?? bWritten[0]).key
      const spelling = (written: WrittenBound[]) =>
        written.length ? boundSpelling(pair.sign as ">" | "<", written[0].exclusive, written[0].value) : undefined
      bResult ??= { ...bField }
      aResult ??= { ...aField }
      for (const [shadow, written] of [
        [bResult, bWritten],
        [aResult, aWritten],
      ] as const) {
        setPositionValue(shadow, position, pair.inclusive, undefined)
        setPositionValue(shadow, position, pair.exclusive, undefined)
        setPositionValue(shadow, position, carrier, spelling(written))
      }
    }
  }
  return [bResult ?? before, aResult ?? after]
}

// keywords lifted from comments and options (§6.8 keywords, `required`, the field behaviours, deprecation, JSON name,
// defaults, title, description, examples): a change of one of them may also change a conflict entry or the remainder
// of the option it was lifted from (A7, PD-19)
const LIFTED_KEYWORDS = [
  ...NUMERIC_KEYWORDS,
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minProperties",
  "maxProperties",
  "uniqueItems",
  "pattern",
  "format",
  "enum",
  "required",
  "readOnly",
  "writeOnly",
  "immutable",
  "deprecation",
  "jsonName",
  "title",
  "description",
  "examples",
]

/** Options whose values are lifted into keywords; their remainders stay under `options` (§4.7, PD-19). */
export const protoApiLiftingOptions = [
  "google.api.field_behavior",
  "google.api.field_info",
  "buf.validate.field",
  "buf.validate.message",
  "validate.rules",
  "grpc.gateway.protoc_gen_openapiv2.options.openapiv2_field",
  "grpc.gateway.protoc_gen_openapiv2.options.openapiv2_schema",
  "grpc.gateway.protoc_gen_openapiv2.options.openapiv2_operation",
  "grpc.gateway.protoc_gen_openapiv2.options.openapiv2_tag",
]

const CONFLICTS = "x-annotation-conflicts"

const liftedKeywordChanged = (bElement: Obj, aElement: Obj): boolean => {
  for (const position of SCALAR_POSITIONS) {
    const bPosition = position === undefined ? bElement : asObject(bElement[position])
    const aPosition = position === undefined ? aElement : asObject(aElement[position])
    if (!bPosition || !aPosition) {
      continue
    }
    for (const key of LIFTED_KEYWORDS) {
      if (!deepEqual(bPosition[key], aPosition[key])) {
        return true
      }
    }
  }
  return false
}

/**
 * A7, PD-19: when a lifted keyword of an element changes, the before shadow takes the after `x-annotation-conflicts`
 * entries and the after remainder of every lifting option (`google.api.field_behavior`, `google.api.field_info`,
 * `buf.validate.field`, `validate.rules`, the openapiv2 options), so the keyword diff is the only record of the source
 * change; a conflict entry or a remainder that changes alone keeps its own record (AN-22).
 */
export const liftedSourceFoldTransform: CompareTransformResolver = (before, after) => {
  const bElement = asObject(before)
  const aElement = asObject(after)
  if (!bElement || !aElement || !liftedKeywordChanged(bElement, aElement)) {
    return [before, after]
  }
  let result: Obj | undefined
  if (!deepEqual(bElement[CONFLICTS], aElement[CONFLICTS])) {
    result = { ...bElement }
    if (aElement[CONFLICTS] === undefined) {
      delete result[CONFLICTS]
    } else {
      result[CONFLICTS] = aElement[CONFLICTS]
    }
  }
  const bOptions = asObject(bElement.options)
  const aOptions = asObject(aElement.options)
  if (bOptions || aOptions) {
    let options: Obj | undefined
    for (const key of protoApiLiftingOptions) {
      if (!deepEqual(bOptions?.[key], aOptions?.[key])) {
        options ??= { ...bOptions }
        if (aOptions?.[key] === undefined) {
          delete options[key]
        } else {
          options[key] = aOptions[key]
        }
      }
    }
    if (options) {
      result ??= { ...bElement }
      result.options = options
    }
  }
  return [result ?? before, after]
}
