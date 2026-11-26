import type { CompareContext, MapKeysResult, MappingResolver } from "../types"
import { getStringValue, isObject, objectKeys } from "../utils"
import { componentRenames, mapPathParams, securitySchemeRenames } from "./openapi3.utils"
import { resolveRef } from "../jsonSchema"
import { equalKeysShortcut, identityOnEqualKeys, objectMappingResolver, withRenamedKeys } from "../core"

const OPERATION_KEYS = ["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"]

// path of a server URL (`https://api.example.com/v1/` -> `/v1`, `/v1` -> `/v1`)
const serverPath = (servers: unknown): string | undefined => {
  const url = Array.isArray(servers) && isObject(servers[0]) ? servers[0].url : undefined
  if (typeof url !== "string") {
    return
  }
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").replace(/\/+$/, "")
}

/**
 * The prefix the servers add to a path: the servers of every operation when they agree, else of the path item, else
 * of the document (ISSUE-80).
 */
const pathPrefix = (root: unknown, pathItem: unknown): string => {
  const item = resolveRef(pathItem, root)
  if (isObject(item)) {
    const own = OPERATION_KEYS.filter((method) => isObject(item[method])).map((method) =>
      serverPath((item[method] as Record<string, unknown>).servers),
    )
    if (own.length && own.every((prefix) => prefix !== undefined && prefix === own[0])) {
      return own[0] as string
    }
    const itemPrefix = serverPath(item.servers)
    if (itemPrefix !== undefined) {
      return itemPrefix
    }
  }
  return serverPath(isObject(root) ? root.servers : undefined) ?? ""
}

const template = (key: string) => key.replace(/\{.*?\}/g, "*")
// repeated slashes are one separator (POLICY-43 decided (b))
const collapse = (key: string) => key.replace(/\/{2,}/g, "/")

/**
 * Maps path keys: the same spelling, then the same template (`/pets/{id}` -> `/pets/{petId}`), then the same effective
 * URL template with repeated slashes collapsed (POLICY-43 decided (b)) and the server path prefix applied (a base path
 * moved between `servers` and the paths, ISSUE-80). Every after key is mapped at most once.
 */
export const pathMappingResolver: MappingResolver<string> = identityOnEqualKeys(
  (before, after, ctx?: CompareContext) => {
    const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }

    const beforeKeys = objectKeys(before)
    const afterKeys = objectKeys(after)

    const mappedIndex = new Set(afterKeys.keys())
    // after keys by spelling and by template (in after order), so a path is matched without scanning every key
    const exact = new Map<string, number>()
    const byTemplate = new Map<string, number[]>()
    afterKeys.forEach((key, j) => {
      exact.set(key, j)
      const t = template(key)
      const list = byTemplate.get(t)
      if (list) {
        list.push(j)
      } else {
        byTemplate.set(t, [j])
      }
    })

    const unmapped: number[] = []
    for (let i = 0; i < beforeKeys.length; i++) {
      // an exact match wins over a template match, and an after key is mapped at most once
      let _afterIndex = exact.get(beforeKeys[i]) ?? -1
      if (_afterIndex < 0 || !mappedIndex.has(_afterIndex)) {
        _afterIndex = byTemplate.get(template(beforeKeys[i]))?.find((j) => mappedIndex.has(j)) ?? -1
      }

      if (_afterIndex < 0) {
        unmapped.push(i)
      } else {
        // mapped items
        result.mapped[beforeKeys[i]] = afterKeys[_afterIndex]
        mappedIndex.delete(_afterIndex)
      }
    }

    // the effective URL of the paths left unmapped
    if (unmapped.length && mappedIndex.size) {
      const bRoot = ctx?.before?.root
      const aRoot = ctx?.after?.root
      const effective = (root: unknown, map: Record<string, unknown>, key: string) =>
        template(collapse(`${pathPrefix(root, map[key])}/${key}`))
      const afterEffective = new Map<number, string>()
      for (const j of mappedIndex) {
        afterEffective.set(j, effective(aRoot, after, afterKeys[j]))
      }
      for (let k = 0; k < unmapped.length; k++) {
        const i = unmapped[k]
        const key = effective(bRoot, before, beforeKeys[i])
        for (const [j, afterKey] of afterEffective) {
          if (afterKey === key) {
            result.mapped[beforeKeys[i]] = afterKeys[j]
            mappedIndex.delete(j)
            afterEffective.delete(j)
            unmapped[k] = -1
            break
          }
        }
      }
    }
    for (const i of unmapped) {
      if (i >= 0) {
        result.removed.push(beforeKeys[i])
      }
    }

    // added items
    mappedIndex.forEach((i) => result.added.push(afterKeys[i]))

    return result
  },
)

export const paramMappingResolver: MappingResolver<number> = (before, after, ctx) => {
  const result: MapKeysResult<number> = { added: [], removed: [], mapped: {} }

  const pathParamMapping = mapPathParams(ctx)
  const mappedIndex = new Set(after.keys())
  const _before = before.map((b) => resolveRef(b, ctx.before.root))
  const _after = after.map((a) => resolveRef(a, ctx.after.root))

  for (let i = 0; i < _before.length; i++) {
    const beforeIn = getStringValue(_before[i], "in")
    const beforeName = getStringValue(_before[i], "name") ?? ""

    const _afterIndex = _after.findIndex((a, j) => {
      if (!mappedIndex.has(j)) {
        return false
      }
      const afterIn = getStringValue(a, "in")
      const afterName = getStringValue(a, "name") ?? ""

      // use extra mapping logic for path parameters; header names are case-insensitive (RFC 9110 §5.1, ISSUE-74)
      return (
        beforeIn === afterIn &&
        (beforeName === afterName ||
          (beforeIn === "path" && pathParamMapping[beforeName] === afterName) ||
          (beforeIn === "header" && beforeName.toLowerCase() === afterName.toLowerCase()))
      )
    })

    if (_afterIndex < 0) {
      // removed item
      result.removed.push(i)
    } else {
      // mapped items
      result.mapped[i] = _afterIndex
      mappedIndex.delete(_afterIndex)
    }
  }

  // added items
  mappedIndex.forEach((i) => result.added.push(i))
  return result
}

const mediaTypeOf = (key: string) => key.split(";")[0].trim().toLowerCase()

const wildcardMatch = (a: string, b: string) => {
  const [aType, aSubType] = a.split("/")
  const [bType, bSubType] = b.split("/")
  if (aType !== bType && aType !== "*" && bType !== "*") {
    return false
  }
  if (aSubType !== bSubType && aSubType !== "*" && bSubType !== "*") {
    return false
  }
  return true
}

/**
 * Maps media type keys in three passes: exact key, equal media type ignoring parameters (charset, ...), then one
 * wildcard pair; every after key is mapped at most once.
 */
export const contentMediaTypeMappingResolver: MappingResolver<string> = identityOnEqualKeys((before, after) => {
  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }

  const beforeKeys = objectKeys(before)
  const afterKeys = objectKeys(after)
  const _beforeKeys = beforeKeys.map(mediaTypeOf)
  const _afterKeys = afterKeys.map(mediaTypeOf)

  const unmappedBefore = new Set(beforeKeys.keys())
  const unmappedAfter = new Set(afterKeys.keys())

  const passes: Array<(i: number, j: number) => boolean> = [
    (i, j) => beforeKeys[i] === afterKeys[j],
    (i, j) => _beforeKeys[i] === _afterKeys[j],
    (i, j) => wildcardMatch(_beforeKeys[i], _afterKeys[j]),
  ]

  for (const matches of passes) {
    for (const i of unmappedBefore) {
      for (const j of unmappedAfter) {
        if (matches(i, j)) {
          result.mapped[beforeKeys[i]] = afterKeys[j]
          unmappedBefore.delete(i)
          unmappedAfter.delete(j)
          break
        }
      }
    }
  }

  unmappedBefore.forEach((i) => result.removed.push(beforeKeys[i]))
  unmappedAfter.forEach((j) => result.added.push(afterKeys[j]))

  return result
})

// ---------------------------------------------------------------------------------------------------------------
// security

const withRenames = withRenamedKeys

/**
 * A `components.<kind>` map: by key (`base`), and a component renamed with every reference repointed as a rename
 * (ISSUE-78, POLICY-101); its content is compared old definition against new definition.
 */
export const componentMappingResolver = (
  kind: string,
  base: MappingResolver<string> = objectMappingResolver,
): MappingResolver<string> => {
  const resolver: MappingResolver<string> = (before, after, ctx) =>
    withRenames(base(before, after, ctx), componentRenames(ctx, kind))
  // without removed and added keys there is no rename
  const shortcut = equalKeysShortcut(base)
  return shortcut === undefined ? resolver : identityOnEqualKeys(resolver, shortcut ?? undefined)
}

/** `components.securitySchemes`: by name, and a scheme renamed with every requirement repointed as a rename (ISSUE-78). */
export const securitySchemesMappingResolver: MappingResolver<string> = (before, after, ctx) =>
  withRenames(objectMappingResolver(before, after, ctx), securitySchemeRenames(ctx))

/** A security requirement object: by scheme name, a renamed scheme (ISSUE-78) as a rename. */
export const securityRequirementMappingResolver: MappingResolver<string> = (before, after, ctx) =>
  withRenames(objectMappingResolver(before, after, ctx), securitySchemeRenames(ctx))

const requirementKey = (item: unknown, renames?: Map<string, string>) =>
  isObject(item)
    ? Object.keys(item)
        .map((name) => renames?.get(name) ?? name)
        .sort()
        .join("&")
    : ""

/**
 * Security requirement alternatives are a set (ISSUE-65): matched by their scheme names (renamed schemes by their
 * new name), the rest paired by position so that a changed requirement is compared scheme by scheme.
 */
export const securityRequirementsMappingResolver: MappingResolver<number> = (before, after, ctx: CompareContext) => {
  const renames = securitySchemeRenames(ctx)
  const result: MapKeysResult<number> = { added: [], removed: [], mapped: {} }
  const unmappedAfter = new Map<number, string>()
  after.forEach((item, j) => unmappedAfter.set(j, requirementKey(item)))
  const unmappedBefore: number[] = []
  before.forEach((item, i) => {
    const key = requirementKey(item, renames)
    for (const [j, afterKey] of unmappedAfter) {
      if (afterKey === key) {
        result.mapped[i] = j
        unmappedAfter.delete(j)
        return
      }
    }
    unmappedBefore.push(i)
  })
  const rest = [...unmappedAfter.keys()]
  for (const i of unmappedBefore) {
    const j = rest.shift()
    if (j === undefined) {
      result.removed.push(i)
    } else {
      result.mapped[i] = j
    }
  }
  result.added.push(...rest)
  return result
}

// ---------------------------------------------------------------------------------------------------------------
// responses

const isRange = (code: string) => /^[1-5]xx$/i.test(code)

/**
 * Status codes: case-insensitively (`5XX` / `5xx`), then an explicit code and the range of its class are the same
 * response (POLICY-14 decided (b), ISSUE-134: `200` <-> `2XX`). Extension keys are left to the extension rule.
 */
export const responsesMappingResolver: MappingResolver<string> = identityOnEqualKeys((before, after) => {
  const result: MapKeysResult<string> = { added: [], removed: [], mapped: {} }
  // the usual case: the same codes in the same order
  const bKeys = Object.keys(before)
  const aKeys = Object.keys(after)
  if (bKeys.length === aKeys.length && bKeys.every((key, i) => key === aKeys[i])) {
    for (const key of bKeys) {
      result.mapped[key] = key
    }
    return result
  }
  const afterByLower = new Map<string, string>()
  for (const key of aKeys) {
    if (!afterByLower.has(key.toLowerCase())) {
      afterByLower.set(key.toLowerCase(), key)
    }
  }
  const unmappedBefore: string[] = []
  for (const key of bKeys) {
    const afterKey = afterByLower.get(key.toLowerCase())
    if (afterKey !== undefined) {
      result.mapped[key] = afterKey
      afterByLower.delete(key.toLowerCase())
    } else {
      unmappedBefore.push(key)
    }
  }
  const unmappedAfter = [...afterByLower.values()]
  for (const key of unmappedBefore) {
    const index = unmappedAfter.findIndex(
      (other) => isRange(key) !== isRange(other) && key[0] === other[0] && /^[1-5]/.test(key),
    )
    if (index >= 0) {
      result.mapped[key] = unmappedAfter[index]
      unmappedAfter.splice(index, 1)
    } else {
      result.removed.push(key)
    }
  }
  result.added.push(...unmappedAfter)
  return result
})
