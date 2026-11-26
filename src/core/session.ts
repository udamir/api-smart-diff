import { type ResolutionIndex, createResolutionIndex } from "allof-merge"

import { parseRefCached as parseRef } from "./ref"

import type { CompareOptions, CompareError, CompareSession, CompareSide, RefTarget } from "../types"
import { isObject } from "../utils"
import { DIFF_META_KEY } from "./constants"

const pointerToPath = (pointer: string): (string | number)[] => {
  if (!pointer) {
    return []
  }
  const segments = pointer.split("/")
  segments.shift()
  if (pointer.indexOf("~") < 0) {
    return segments
  }
  return segments.map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
}

// the value at `path` when every step is an own key of a plain container (array steps must be canonical indexes)
const walkPath = (document: unknown, path: (string | number)[]): unknown => {
  let value = document
  for (let i = 0; i < path.length; i++) {
    const step = path[i]
    if (Array.isArray(value)) {
      const index = Number(step)
      if (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== step) {
        return
      }
      value = value[index]
    } else if (isObject(value) && Object.prototype.hasOwnProperty.call(value, step)) {
      value = (value as Record<string, unknown>)[step as string]
    } else {
      return
    }
  }
  return value
}

const resolveAgainstSelf = (filePath: string, root: unknown): string => {
  const self = isObject(root) && typeof root.$self === "string" ? root.$self : undefined
  if (!self || /^[a-z][a-z0-9+.-]*:/i.test(filePath)) {
    return filePath
  }
  try {
    return new URL(filePath, self).toString()
  } catch {
    return filePath
  }
}

/**
 * Creates the per-call session: error sink, `$ref` resolution (with `externalSources`), the reference stack used for
 * cycle detection and the cache of compared `$ref` pairs. Nothing mutable lives in rules any more.
 */
export const createSession = (options: CompareOptions = {}): CompareSession => {
  const errors: CompareError[] = []

  const report = (error: CompareError) => {
    if (options.onError) {
      options.onError(error)
    } else {
      errors.push(error)
    }
  }

  // resolved references per side and root document (a `$ref` is resolved once per session)
  const resolved: Record<CompareSide, WeakMap<object, Map<string, RefTarget | undefined>>> = {
    before: new WeakMap(),
    after: new WeakMap(),
  }

  const resolveRef = (side: CompareSide, root: unknown, $ref: string): RefTarget | undefined => {
    if (!isObject(root)) {
      return resolveRefUncached(side, root, $ref)
    }
    let byRef = resolved[side].get(root)
    if (!byRef) {
      byRef = new Map()
      resolved[side].set(root, byRef)
    }
    if (byRef.has($ref)) {
      return byRef.get($ref)
    }
    const target = resolveRefUncached(side, root, $ref)
    byRef.set($ref, target)
    return target
  }

  // one resolution index per document (the pointer walk of `resolvePointer` without building an index per call)
  const indexes = new WeakMap<object, ResolutionIndex>()
  const indexOf = (document: object): ResolutionIndex => {
    let index = indexes.get(document)
    if (!index) {
      index = createResolutionIndex(document)
      indexes.set(document, index)
    }
    return index
  }

  const resolveRefUncached = (side: CompareSide, root: unknown, $ref: string): RefTarget | undefined => {
    const { filePath, pointer, normalized } = parseRef($ref)

    let document = root
    if (filePath) {
      const sources = options.externalSources?.[side]
      // a relative reference is resolved against the document's `$self` (OpenAPI 3.2) when it has one
      const absolute = resolveAgainstSelf(filePath, root)
      const key = sources && filePath in sources ? filePath : sources && absolute in sources ? absolute : undefined
      if (!sources || key === undefined) {
        return
      }
      document = sources[key]
    }

    if (!pointer) {
      return { value: document, document, path: [], ref: normalized }
    }

    if (!isObject(document)) {
      return
    }
    const path = pointerToPath(pointer)
    // fast path: a pointer without percent-encoding that walks plain containers (the common case); anything else
    // (encoded segments, a walk through an intermediate `$ref`) goes through the resolution index of allof-merge
    let value: unknown = pointer.indexOf("%") < 0 ? walkPath(document, path) : undefined
    if (value === undefined) {
      value = indexOf(document).resolvePointer(pointer)
    }
    if (value === undefined) {
      return
    }
    return { value, document, path, ref: normalized }
  }

  return {
    options,
    errors,
    report,
    resolveRef,
    refStack: { before: new Set(), after: new Set() },
    refPairs: new Set(),
    pathStack: [],
    aliases: new WeakSet(),
    refResults: new Map(),
    diffCount: 0,
    declarationOnly: 0,
    suppressedDiffs: [],
    suppressedContexts: [],
    keepAtUsage: undefined,
    nominalDiffs: 0,
    nominalNesting: 0,
    caches: new Map(),
    metaKey: options.metaKey ?? DIFF_META_KEY,
    arrayMeta: !!options.arrayMeta,
    normalized: options.merged === "normalized",
    annotateHook: options.annotateHook,
    unclassifiedComponents: options.components === "unclassified",
  }
}
