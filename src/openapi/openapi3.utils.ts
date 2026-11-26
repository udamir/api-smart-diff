import type { JsonPath } from "json-crawl"

import type { CompareContext, CompareResolver, NodeContext } from "../types"
import type { JsonSchemaDraft } from "../jsonSchema"
import type { OpenApiVersion } from "./openapi3.types"
import { isObject, isString } from "../utils"
import {
  type ReferenceSite,
  type RenameableMap,
  type StringReference,
  deepEqual,
  findRenames,
  localReferenceSites,
  pointerOfPath,
  renamesIn,
  repointedStringResolver,
} from "../core"

export const emptySecurity = (value?: unknown) => {
  if (!Array.isArray(value)) {
    return false
  }

  return value.length === 0 || value.some((item) => isObject(item) && Object.keys(item).length === 0)
}

const requirementKey = (item: unknown) => (isObject(item) ? Object.keys(item).sort().join("&") : "")

/**
 * True when every requirement of `items` is also offered by `value`: a client satisfying `items` still passes.
 * An empty or missing `items` list (a public API) is only covered by an empty or missing `value`.
 */
export const includeSecurity = (value: unknown, items: unknown) => {
  const _items = Array.isArray(items) ? items : []
  const _value = Array.isArray(value) ? value : []

  if (!_items.length) {
    return !_value.length || emptySecurity(_value)
  }

  const valueSet = new Set(_value.map(requirementKey))

  for (const item of _items) {
    if (!valueSet.has(requirementKey(item))) {
      return false
    }
  }

  return true
}

const pathTemplateOf = (node: NodeContext): string | undefined => {
  // the path item key is the nearest ancestor key that starts with "/" under a `paths`/`webhooks`-like container
  let current: NodeContext | undefined = node
  while (current) {
    if (isString(current.key) && current.key.startsWith("/") && current.up && current.up.up === undefined) {
      return current.key
    }
    if (isString(current.key) && current.key.startsWith("/") && current.up && current.up.key === "paths") {
      return current.key
    }
    current = current.up
  }
  return typeof node.path[1] === "string" && node.path[0] === "paths" ? node.path[1] : undefined
}

export const mapPathParams = ({ before, after }: CompareContext): Record<string, string> => {
  const beforeTemplate = pathTemplateOf(before)
  const afterTemplate = pathTemplateOf(after)
  if (!beforeTemplate || !afterTemplate) {
    return {}
  }

  const beforeParams = [...beforeTemplate.matchAll(/\{(.*?)\}/g)].map((arr) => arr.pop()) as string[]
  const afterParams = [...afterTemplate.matchAll(/\{(.*?)\}/g)].map((arr) => arr.pop()) as string[]

  const result: Record<string, string> = {}
  for (let i = 0; i < beforeParams.length && i < afterParams.length; i++) {
    result[beforeParams[i]] = afterParams[i]
  }

  return result
}

export const getDefaultStyle = (type: unknown) => {
  switch (type) {
    case "query":
    case "cookie":
    case "querystring":
      return "form"
    case "path":
    case "header":
      return "simple"
  }
}

export const isResponseSchema = (path: JsonPath) => {
  return path[3] === "responses" && path[7] === "schema"
}

export const isRequestBodySchema = (path: JsonPath) => {
  return path[3] === "requestBody" && path[6] === "schema"
}

export const isParameterSchema = (path: JsonPath) => {
  return (path[2] === "parameters" && path[4] === "schema") || (path[3] === "parameters" && path[5] === "schema")
}

/** OpenAPI minor version ("3.0", "3.1", "3.2") of a document; tolerates a numeric `openapi` field. */
export const getOpenApiVersion = (document: unknown): OpenApiVersion | undefined => {
  if (!isObject(document) || !("openapi" in document)) {
    return
  }
  const match = String(document.openapi).match(/^3\.(\d+)/)
  if (!match) {
    return
  }
  const minor = Number(match[1])
  return minor <= 0 ? "3.0" : minor === 1 ? "3.1" : "3.2"
}

/** The higher of the two document versions (cross-version comparison uses the newer profile). */
export const getMaxOpenApiVersion = (before: unknown, after: unknown): OpenApiVersion => {
  const versions: OpenApiVersion[] = ["3.0", "3.1", "3.2"]
  const b = getOpenApiVersion(before)
  const a = getOpenApiVersion(after)
  const max = Math.max(b ? versions.indexOf(b) : 0, a ? versions.indexOf(a) : 0)
  return versions[max]
}

/** Schema dialect of an OpenAPI version: 3.0 uses the draft-04 flavour (nullable, boolean exclusive bounds). */
export const schemaDraftOf = (version: OpenApiVersion | "3.0.x" | "3.1.x" | undefined): JsonSchemaDraft =>
  version === undefined || version === "3.0" || version === "3.0.x" ? "draft-04" : "2020-12"

// ---------------------------------------------------------------------------------------------------------------
// document indexes (per compare session and document root)

const operationMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"]

/** A value computed once per compare session and document root (the session's caches outlive no call). */
export const perDocument = <T>(ctx: CompareContext, name: string, root: unknown, compute: (root: unknown) => T): T => {
  const key = `openapi:${name}`
  let byRoot = ctx.session.caches.get(key) as Map<unknown, T> | undefined
  if (!byRoot) {
    byRoot = new Map()
    ctx.session.caches.set(key, byRoot)
  }
  if (!byRoot.has(root)) {
    byRoot.set(root, compute(root))
  }
  return byRoot.get(root) as T
}

const resolveLocal = (value: unknown, root: unknown, depth = 0): unknown => {
  if (!isObject(value) || !isString(value.$ref) || !value.$ref.startsWith("#/") || depth > 16) {
    return value
  }
  let target: unknown = root
  for (const step of value.$ref.slice(2).split("/")) {
    const key = step.replace(/~1/g, "/").replace(/~0/g, "~")
    target = isObject(target) ? target[key] : undefined
  }
  return target === undefined ? value : resolveLocal(target, root, depth + 1)
}

/**
 * Every operation of a document (paths, webhooks, `components.pathItems`, callbacks, 3.2 `additionalOperations`)
 * with the container it was found in (`paths` / `webhooks` / `components` / `callbacks`).
 */
export const forEachOperation = (
  root: unknown,
  visit: (operation: Record<string, unknown>, container: string) => void,
) => {
  const seen = new Set<unknown>()
  const visitPathItem = (item: unknown, container: string, depth: number) => {
    const pathItem = resolveLocal(item, root)
    if (!isObject(pathItem) || seen.has(pathItem) || depth > 8) {
      return
    }
    seen.add(pathItem)
    const operations = [
      ...operationMethods.map((method) => pathItem[method]),
      ...(isObject(pathItem.additionalOperations) ? Object.values(pathItem.additionalOperations) : []),
    ]
    for (const operation of operations) {
      if (!isObject(operation)) {
        continue
      }
      visit(operation, container)
      if (isObject(operation.callbacks)) {
        for (const callback of Object.values(operation.callbacks)) {
          const resolved = resolveLocal(callback, root)
          if (isObject(resolved)) {
            for (const nested of Object.values(resolved)) {
              visitPathItem(nested, "callbacks", depth + 1)
            }
          }
        }
      }
    }
  }
  if (!isObject(root)) {
    return
  }
  for (const [container, map] of [
    ["paths", root.paths],
    ["webhooks", root.webhooks],
    ["components", isObject(root.components) ? root.components.pathItems : undefined],
  ] as const) {
    if (isObject(map)) {
      for (const item of Object.values(map)) {
        visitPathItem(item, container, 0)
      }
    }
  }
}

const requirementSchemes = (requirements: unknown, out: Set<string>) => {
  if (Array.isArray(requirements)) {
    for (const requirement of requirements) {
      if (isObject(requirement)) {
        for (const name of Object.keys(requirement)) {
          out.add(name)
        }
      }
    }
  }
}

/** Names of the security schemes referenced by a security requirement of the document (global or operation). */
export const referencedSecuritySchemes = (ctx: CompareContext, root: unknown): Set<string> =>
  perDocument(ctx, "security-schemes-referenced", root, () => {
    const names = new Set<string>()
    requirementSchemes(getObjectKey(root, "security"), names)
    forEachOperation(root, (operation) => requirementSchemes(operation.security, names))
    return names
  })

/**
 * Whether an operation of `paths` has no `security` of its own, i.e. inherits the global requirements; a document
 * without operations (a fragment) is read as if every operation inherited them.
 */
export const inheritsGlobalSecurity = (ctx: CompareContext, root: unknown): boolean =>
  perDocument(ctx, "security-inherited", root, () => {
    let inherits = false
    let operations = 0
    forEachOperation(root, (operation, container) => {
      if (container === "paths") {
        operations++
        inherits ||= !("security" in operation)
      }
    })
    return inherits || operations === 0
  })

const getObjectKey = (value: unknown, key: string): unknown => (isObject(value) ? value[key] : undefined)

// the security requirements of a document as reference sites: each scheme name of a requirement points at
// `#/components/securitySchemes/<name>`; a requirement is located by its owner (global, or the n-th operation in
// document order) and its index
const requirementSites = (root: unknown): ReferenceSite[] => {
  const sites: ReferenceSite[] = []
  const add = (requirements: unknown, owner: string) => {
    if (!Array.isArray(requirements)) {
      return
    }
    requirements.forEach((requirement, i) => {
      if (isObject(requirement)) {
        for (const name of Object.keys(requirement)) {
          sites.push({ site: `${owner}/${i}`, ref: pointerOfPath(["components", "securitySchemes", name]) })
        }
      }
    })
  }
  add(getObjectKey(root, "security"), "#/security")
  let index = 0
  forEachOperation(root, (operation) => add(operation.security, `operation:${index++}`))
  return sites
}

// POLICY-106: a discriminator mapping value (a schema name or a local reference) and a link `operationRef` (a local
// reference) are references of the entry they name; a bare name is one when the document declares that schema
const stringReference =
  (root: unknown): StringReference =>
  (key, value, holder) => {
    const last = holder[holder.length - 1]
    if (
      (last === "mapping" && holder[holder.length - 2] === "discriminator") ||
      (key === "defaultMapping" && last === "discriminator")
    ) {
      return mappingTarget(root, value)
    }
    return key === "operationRef" && value.startsWith("#") ? value : undefined
  }

/** The pointer a discriminator mapping value names: a local reference as it is, a declared schema name as its pointer. */
export const mappingTarget = (root: unknown, value: string): string | undefined => {
  if (value.startsWith("#")) {
    return value
  }
  const schemas = getObjectKey(getObjectKey(root, "components"), "schemas")
  return isObject(schemas) && Object.prototype.hasOwnProperty.call(schemas, value)
    ? pointerOfPath(["components", "schemas", value])
    : undefined
}

/** The reference sites of an OpenAPI document: local `$ref`s, discriminator mapping values and link `operationRef`s. */
export const openApiReferenceSites = (root: unknown): ReferenceSite[] =>
  localReferenceSites(root, stringReference(root))

const objectMap = (value: unknown): Record<string, unknown> | undefined =>
  isObject(value) && !Array.isArray(value) ? value : undefined

/**
 * Entries renamed with every reference repointed (ISSUE-78, POLICY-101): components of every kind (by their local
 * `$ref`s) and security schemes (by the requirements that name them); before pointer -> after pointer
 * (`findRenames`). Used as the root rule's `referenceRenames`.
 */
export const openApiRenames = (ctx: CompareContext): ReadonlyMap<string, string> =>
  perDocument(ctx, "renames", ctx.before.root, () => {
    const bComponents = objectMap(getObjectKey(ctx.before.root, "components"))
    const aComponents = objectMap(getObjectKey(ctx.after.root, "components"))
    if (!bComponents || !aComponents) {
      return new Map<string, string>()
    }
    const maps: RenameableMap[] = []
    let schemes: RenameableMap | undefined
    for (const kind of Object.keys(bComponents)) {
      const before = objectMap(bComponents[kind])
      const after = objectMap(aComponents[kind])
      if (!before || !after) {
        continue
      }
      if (kind === "securitySchemes") {
        schemes = { path: ["components", kind], before, after }
      } else {
        maps.push({ path: ["components", kind], before, after })
      }
    }
    // POLICY-116: a field that differs only by string references (POLICY-106) repointed through a rename counts as equal
    const renames = findRenames(
      maps,
      () => openApiReferenceSites(ctx.before.root),
      () => openApiReferenceSites(ctx.after.root),
      { strings: { before: stringReference(ctx.before.root), after: stringReference(ctx.after.root) } },
    )
    if (schemes) {
      const schemeRenames = findRenames(
        [schemes],
        () => requirementSites(ctx.before.root),
        () => requirementSites(ctx.after.root),
      )
      for (const [from, to] of schemeRenames) {
        renames.set(from, to)
      }
    }
    return renames
  })

/**
 * Security schemes renamed with every requirement repointed (ISSUE-78, POLICY-101): before name -> after name. A pair
 * is a scheme that only the before document declares and references and one that only the after document declares
 * and references, named by the same requirements (or with the same definition).
 */
export const securitySchemeRenames = (ctx: CompareContext): Map<string, string> =>
  perDocument(ctx, "security-scheme-renames", ctx.before.root, () =>
    renamesIn(openApiRenames(ctx), ["components", "securitySchemes"]),
  )

/** Components of `kind` renamed with every reference repointed (POLICY-101): before name -> after name. */
export const componentRenames = (ctx: CompareContext, kind: string): Map<string, string> =>
  perDocument(ctx, `component-renames:${kind}`, ctx.before.root, () =>
    renamesIn(openApiRenames(ctx), ["components", kind]),
  )

/** Every local `$ref` string of a document (normalized to `#/...`). */
export const localReferences = (ctx: CompareContext, root: unknown): Set<string> =>
  perDocument(ctx, "local-refs", root, () => {
    const refs = new Set<string>()
    const seen = new Set<unknown>()
    const stack: unknown[] = [root]
    while (stack.length) {
      const value = stack.pop()
      if (!isObject(value) || seen.has(value)) {
        continue
      }
      seen.add(value)
      if (isString(value.$ref) && value.$ref.startsWith("#")) {
        refs.add(value.$ref)
      }
      for (const child of Array.isArray(value) ? value : Object.values(value)) {
        if (isObject(child)) {
          stack.push(child)
        }
      }
    }
    return refs
  })

const pointerStep = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1")

/**
 * POLICY-18 decided (b): a component removed after every usage was repointed to an added component with the same
 * content changes no resolved request or response; the usages report any difference themselves.
 */
export const isRepointedComponent = (ctx: CompareContext): boolean => {
  const { before, after } = ctx
  const path = before.path
  if (path.length !== 3 || path[0] !== "components" || !isString(path[1]) || !isString(path[2])) {
    return false
  }
  const kind = path[1]
  const name = path[2]
  const bKind = getObjectKey(getObjectKey(before.root, "components"), kind)
  const aKind = getObjectKey(getObjectKey(after.root, "components"), kind)
  if (!isObject(bKind) || !isObject(aKind)) {
    return false
  }
  const pointer = (key: string) => `#/components/${pointerStep(kind)}/${pointerStep(key)}`
  const aRefs = localReferences(ctx, after.root)
  if (aRefs.has(pointer(name))) {
    return false
  }
  return Object.keys(aKind).some(
    (other) => !(other in bKind) && aRefs.has(pointer(other)) && deepEqual(bKind[name], aKind[other]),
  )
}

/**
 * A discriminator mapping value or a link `operationRef` repointed only because the entry it names was renamed: no
 * change (POLICY-106).
 */
export const repointedOpenApiReference: CompareResolver = repointedStringResolver((side, value, ctx) =>
  ctx[side].key === "operationRef" ? (value.startsWith("#") ? value : undefined) : mappingTarget(ctx[side].root, value),
)
