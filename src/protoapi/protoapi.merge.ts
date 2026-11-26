import type { JsonPath } from "json-crawl"

import type { Diff } from "../types"
import { deepEqual, mostSevere } from "../core"
import { getKeyValue, isObject } from "../utils"
import {
  protoApiFoldedValidators,
  protoApiInnerPositions,
  protoApiResolvedFeatures,
  protoApiResolvedKeywords,
} from "./protoapi.const"
import { diffElement, elementOf } from "./protoapi.utils"

// One record per element per cause (PROTOAPI_DESIGN §4.9, A4, PD-16, PD-25, PD-27): after the walk, the diffs one
// cause produced at one element are replaced by one record.

/**
 * The cause of a merged record: a `syntax` change, a feature option, a field's shape change (the carrier), or an
 * inherited feature the document does not record as an option (`utf8_validation`, `repeated_field_encoding` and
 * `json_format` are resolved into keywords only, invariant 10), which leaves the diffs of one resolved keyword at
 * several positions of one element (ISSUE-372).
 */
export type ProtoApiMergeCause =
  | { kind: "syntax" | "feature" | "shape"; diff: Diff }
  | { kind: "inherited"; keyword: string }
  | { kind: "lifted"; keyword: "behavior" | "length" }

/**
 * Writes the description of a merged record from its representative, the diffs folded into it (in walk order) and
 * the cause; `undefined` keeps the representative's own description.
 */
export type ProtoApiMergeDescriber = (
  representative: Diff,
  folded: readonly Diff[],
  cause: ProtoApiMergeCause,
) => string | undefined

type Documents = { before: unknown; after: unknown }

const RESOLVED_ELEMENT_KEYWORDS = new Set(["closed", "jsonFormat"])

// the field behaviours of AIP-203 lifted from one option or comment prefix (ISSUE-374)
const BEHAVIOR_KEYWORDS = new Set(["readOnly", "writeOnly", "immutable"])

// lower and upper keywords an exact length or count sets together (`len`, ISSUE-374)
const EXACT_PAIRS: Record<string, string> = {
  minLength: "length",
  maxLength: "length",
  minItems: "items",
  maxItems: "items",
  minProperties: "entries",
  maxProperties: "entries",
}

// the path of the field (or extension) a path lies in: `components/messages/<M>/properties/<f>` or
// `components/extensions/<x>`
const fieldPathOf = (path: JsonPath): JsonPath | undefined => {
  if (path[0] !== "components") {
    return
  }
  if (path[1] === "messages" && path[3] === "properties" && path.length > 4) {
    return path.slice(0, 5)
  }
  if (path[1] === "extensions" && path.length > 2) {
    return path.slice(0, 3)
  }
  return
}

// the keyword of a diff at a scalar position of its field (`F/<kw>`, `F/items/<kw>`, …, `F/<kw>/<index>`)
const positionKeyword = (diff: Diff): { field: JsonPath; keyword: string; inner: boolean } | undefined => {
  const field = fieldPathOf(diff.path)
  if (!field || diff.action === "rename") {
    return
  }
  const rest = diff.path.slice(field.length)
  if (!rest.length) {
    return
  }
  if (protoApiInnerPositions.has(String(rest[0]))) {
    return rest.length >= 2 ? { field, keyword: String(rest[1]), inner: true } : undefined
  }
  return { field, keyword: String(rest[0]), inner: false }
}

// a shape carrier (`fieldShapeTransform`): the one `type` or `$ref` replace diff of a field
const isShapeCarrier = (diff: Diff): boolean => {
  const field = fieldPathOf(diff.path)
  return (
    !!field &&
    diff.action === "replace" &&
    diff.path.length === field.length + 1 &&
    (diff.path[field.length] === "type" || diff.path[field.length] === "$ref")
  )
}

// a validator diff folded into its field's shape record (PD-27): K-1 … K-14 at the field's scalar positions
const isFoldedValidator = (diff: Diff): boolean => {
  const position = positionKeyword(diff)
  if (!position || !protoApiFoldedValidators.has(position.keyword)) {
    return false
  }
  // `required` is a field keyword, never one of an inner position
  return position.keyword !== "required" || !position.inner
}

// the resolved keyword a diff changes (A4): `presence` = `explicit`, `utf8Validation` at any position, `packed`,
// `delimited` of fields; `closed` and `jsonFormat` of messages and enums
const resolvedKeyword = (diff: Diff): string | undefined => {
  if (diff.action === "rename") {
    return
  }
  const position = positionKeyword(diff)
  if (position) {
    const { keyword } = position
    if (!protoApiResolvedKeywords.has(keyword) || RESOLVED_ELEMENT_KEYWORDS.has(keyword)) {
      return
    }
    if (keyword === "presence" && diff.before !== "explicit" && diff.after !== "explicit") {
      return
    }
    return position.inner && keyword !== "utf8Validation" ? undefined : keyword
  }
  const { path } = diff
  if (
    path[0] === "components" &&
    (path[1] === "messages" || path[1] === "enums") &&
    path.length === 4 &&
    RESOLVED_ELEMENT_KEYWORDS.has(String(path[3]))
  ) {
    return String(path[3])
  }
  return
}

// the features a diff under `<element>/options` changes (a feature value, the `features` object or the whole
// `options` object added, removed or replaced)
const changedFeatures = (diff: Diff): { element: JsonPath; features: Set<string> } | undefined => {
  const index = diff.path.lastIndexOf("options")
  if (index < 0 || diff.action === "rename") {
    return
  }
  const element = diff.path.slice(0, index)
  if (elementOf(element) !== elementOf(diff.path)) {
    return
  }
  const rest = diff.path.slice(index + 1)
  const features = new Set<string>()
  if (rest.length >= 2 && rest[0] === "features") {
    features.add(String(rest[1]))
  } else if (rest.length <= 1 && (rest.length === 0 || rest[0] === "features")) {
    for (const value of [diff.before, diff.after]) {
      const object = rest.length === 0 ? getKeyValue(value, "features") : value
      if (isObject(object)) {
        for (const key of Object.keys(object)) {
          features.add(key)
        }
      }
    }
  }
  for (const feature of features) {
    if (!(feature in protoApiResolvedFeatures)) {
      features.delete(feature)
    }
  }
  return features.size ? { element, features } : undefined
}

// the component key and section of an element path (`components/<section>/<key>/…`)
const componentOf = (path: JsonPath): { section: string; key: string } | undefined =>
  path[0] === "components" && path.length >= 3 ? { section: String(path[1]), key: String(path[2]) } : undefined

const declaringFile = (documents: Documents, component: { section: string; key: string }): string | undefined => {
  for (const document of [documents.after, documents.before]) {
    const file = getKeyValue(document, "components", component.section, component.key, "file")
    if (typeof file === "string") {
      return file
    }
  }
  return
}

/**
 * Merges the diffs of one element that have one cause (A4, PD-16, PD-25, PD-27) and returns the records:
 *
 * 1. a shape carrier of a field or extension (F-11 … F-21, X-5) takes the validator diffs K-1 … K-14 at that field's
 *    scalar positions; it keeps its own `type`;
 * 2. the resolved-keyword diffs of one element caused by one `syntax` change of its declaring file, or by one feature
 *    option set at the element, an enclosing message or the declaring file, become one record: the representative is
 *    the most severe diff (the first in walk order among equals), it keeps its `action`, `path`, `before`, `after` and
 *    takes the most severe `type`; the cause's own record stays at its element.
 *
 * The other diffs of a group leave the result; `merged` keeps their meta. Resolved-keyword diffs without a cause diff
 * are merged per element, keyword and action (an inherited feature the document keeps no option for, ISSUE-372). `describe` writes the description of a merged record (descriptions of the folds, Q4).
 */
export const mergeElementDiffs = (diffs: Diff[], documents: Documents, describe?: ProtoApiMergeDescriber): Diff[] => {
  if (diffs.length < 2) {
    return diffs
  }
  const removed = new Set<Diff>()
  const replacements = new Map<Diff, Diff>()

  // (3) the PD-16 shape fold
  const carriers = new Map<string, Diff>()
  for (const diff of diffs) {
    if (isShapeCarrier(diff)) {
      carriers.set(elementOf(diff.path), diff)
    }
  }
  if (carriers.size) {
    const folded = new Map<Diff, Diff[]>()
    for (const diff of diffs) {
      if (carriers.has(elementOf(diff.path)) && !isShapeCarrier(diff) && isFoldedValidator(diff)) {
        const carrier = carriers.get(elementOf(diff.path)) as Diff
        const list = folded.get(carrier) ?? []
        list.push(diff)
        folded.set(carrier, list)
        removed.add(diff)
      }
    }
    for (const [carrier, list] of folded) {
      const description = describe?.(carrier, list, { kind: "shape", diff: carrier })
      if (description !== undefined) {
        replacements.set(carrier, { ...carrier, description })
      }
    }
  }

  // (4) one lifted source field that sets two keywords (ISSUE-374): the field behaviours of one field
  // (`(google.api.field_behavior) = IMMUTABLE` → `OUTPUT_ONLY`: `immutable` removed, `readOnly` added) and an exact
  // length or count (`string.len = 4` → `5`: `minLength` and `maxLength` replaced alike)
  {
    const groups = new Map<string, { keyword: "behavior" | "length"; diffs: Diff[] }>()
    for (const diff of diffs) {
      if (removed.has(diff) || diff.action === "rename") {
        continue
      }
      const position = positionKeyword(diff)
      if (!position) {
        continue
      }
      const atPosition = diff.path.length === position.field.length + (position.inner ? 2 : 1)
      if (!atPosition) {
        continue
      }
      let key: string | undefined
      let keyword: "behavior" | "length" | undefined
      if (!position.inner && BEHAVIOR_KEYWORDS.has(position.keyword)) {
        key = `${elementOf(diff.path)}\u0000behavior`
        keyword = "behavior"
      } else if (position.keyword in EXACT_PAIRS) {
        key = `${diff.path.slice(0, -1).join("\u0000")}\u0000${EXACT_PAIRS[position.keyword]}`
        keyword = "length"
      }
      if (key && keyword) {
        const group = groups.get(key) ?? { keyword, diffs: [] }
        group.diffs.push(diff)
        groups.set(key, group)
      }
    }
    for (const { keyword, diffs: group } of groups.values()) {
      if (group.length < 2) {
        continue
      }
      // an exact length or count: both keywords of the pair with one action and one value on each side
      if (
        keyword === "length" &&
        (group.length !== 2 ||
          group[0].action !== group[1].action ||
          !deepEqual(group[0].before, group[1].before) ||
          !deepEqual(group[0].after, group[1].after))
      ) {
        continue
      }
      const type = mostSevere(group.map((diff) => diff.type))
      const representative = group.find((diff) => diff.type === type) as Diff
      const folded = group.filter((diff) => diff !== representative)
      for (const diff of folded) {
        removed.add(diff)
      }
      const merged: Diff = { ...representative, type }
      const description = describe?.(merged, folded, { kind: "lifted", keyword })
      if (description !== undefined) {
        merged.description = description
      }
      replacements.set(representative, merged)
    }
  }

  // (1), (2) resolved keywords by cause
  const syntaxCauses = new Map<string, Diff>()
  const featureCauses: { element: JsonPath; pointer: string; features: Set<string>; diff: Diff }[] = []
  for (const diff of diffs) {
    if (diff.path[0] === "files" && diff.path.length === 3 && diff.path[2] === "syntax") {
      syntaxCauses.set(String(diff.path[1]), diff)
      continue
    }
    const changed = changedFeatures(diff)
    if (changed) {
      featureCauses.push({ ...changed, pointer: elementOf(changed.element), diff })
    }
  }
  {
    const featureOf = new Map(Object.entries(protoApiResolvedFeatures).map(([feature, keyword]) => [keyword, feature]))
    const causeOf = (diff: Diff, keyword: string): ProtoApiMergeCause | undefined => {
      const element = elementOf(diff.path)
      const component = componentOf(diff.path)
      const file = component ? declaringFile(documents, component) : undefined
      const feature = featureOf.get(keyword) as string
      let best: { rank: number; diff: Diff } | undefined
      for (const cause of featureCauses) {
        if (!cause.features.has(feature)) {
          continue
        }
        let rank = -1
        if (cause.pointer === element) {
          rank = 1_000_000
        } else if (cause.element[0] === "files") {
          rank = file !== undefined && cause.element[1] === file ? 0 : -1
        } else if (component && cause.element[0] === "components" && cause.element[1] === "messages") {
          // a message feature reaches the message's fields and the declarations nested in it (same file)
          const owner = String(cause.element[2])
          const own = component.section === "messages" && component.key === owner && cause.element.length === 3
          const nested = component.key.startsWith(`${owner}.`)
          const sameFile = declaringFile(documents, { section: "messages", key: owner }) === file
          rank = (own || nested) && sameFile ? owner.length : -1
        }
        if (rank >= 0 && (!best || rank > best.rank)) {
          best = { rank, diff: cause.diff }
        }
      }
      if (best) {
        return { kind: "feature", diff: best.diff }
      }
      const syntax = file !== undefined ? syntaxCauses.get(file) : undefined
      return syntax ? { kind: "syntax", diff: syntax } : undefined
    }

    const groups = new Map<string, { cause: ProtoApiMergeCause; diffs: Diff[] }>()
    for (const diff of diffs) {
      if (removed.has(diff)) {
        continue
      }
      const keyword = resolvedKeyword(diff)
      if (!keyword) {
        continue
      }
      const cause: ProtoApiMergeCause = causeOf(diff, keyword) ?? { kind: "inherited", keyword }
      const key = `${elementOf(diff.path)}\u0000${"diff" in cause ? diffs.indexOf(cause.diff) : `${keyword}|${diff.action}`}`
      const group = groups.get(key)
      if (group) {
        group.diffs.push(diff)
      } else {
        groups.set(key, { cause, diffs: [diff] })
      }
    }
    for (const { cause, diffs: group } of groups.values()) {
      if (group.length < 2) {
        continue
      }
      const type = mostSevere(group.map((diff) => diff.type))
      const representative = group.find((diff) => diff.type === type) as Diff
      const folded = group.filter((diff) => diff !== representative)
      for (const diff of folded) {
        removed.add(diff)
      }
      const merged: Diff = { ...representative, type }
      const description = describe?.(merged, folded, cause)
      if (description !== undefined) {
        merged.description = description
      }
      replacements.set(representative, merged)
    }
  }

  if (!removed.size && !replacements.size) {
    return diffs
  }
  const result: Diff[] = []
  for (const diff of diffs) {
    if (!removed.has(diff)) {
      result.push(replacements.get(diff) ?? diff)
    }
  }
  return result
}

/** Records grouped by element (R-1): element pointer → number of records. */
export const recordsByElement = (diffs: readonly Diff[]): Map<string, number> => {
  const result = new Map<string, number>()
  for (const diff of diffs) {
    const element = diffElement(diff)
    result.set(element, (result.get(element) ?? 0) + 1)
  }
  return result
}
