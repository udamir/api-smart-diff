import type { CompareContext, CompareTransformResolver } from "../types"
import { getStringValue, isObject, isPlainObject, objectKeys, setKeyValue } from "../utils"
import { pathMappingResolver } from "./openapi3.mapping"
import { compareTransformationFactory, isExtensionKey } from "../core"
import { getDefaultStyle } from "./openapi3.utils"
import { resolveRef } from "../jsonSchema"
import { type OpenApiProfile, openApiProfile } from "./openapi3.profile"

export const httpMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"] as const

const paramIdentity = (param: unknown, root: unknown) => {
  const resolved = resolveRef(param, root)
  const location = getStringValue(resolved, "in") ?? ""
  const name = getStringValue(resolved, "name") ?? ""
  // header names are case-insensitive (ISSUE-74)
  return `${location}:${location === "header" ? name.toLowerCase() : name}`
}

/**
 * Path item normalization for a version profile: path-level parameters are attributed to every operation with the
 * OpenAPI override semantics (an operation parameter with the same `name` and `in` replaces the path-level one);
 * `additionalOperations` entries whose method is a known method of the profile (`QUERY` in 3.2) are compared as that
 * operation. Other path-level fields stay at path level. `$ref` path items are left untouched for the `$ref` resolver.
 */
export const createPathItemsTransform = (profile: OpenApiProfile): CompareTransformResolver => {
  const methods = new Set<string>(profile.methods)

  const lift = (value: unknown, root: unknown) => {
    if (!isPlainObject(value) || "$ref" in value) {
      return value
    }

    const { parameters, additionalOperations, ...rest } = value
    const result: Record<string, unknown> = { ...rest }

    // additional operations with a standard method name are the same operation as the method key
    if (profile.additionalOperations && isPlainObject(additionalOperations)) {
      const remaining: Record<string, unknown> = {}
      for (const method of Object.keys(additionalOperations)) {
        const key = method.toLowerCase()
        if (!isExtensionKey(method) && methods.has(key) && !(key in result)) {
          result[key] = additionalOperations[method]
        } else {
          remaining[method] = additionalOperations[method]
        }
      }
      if (Object.keys(remaining).length) {
        result.additionalOperations = remaining
      }
    } else if (additionalOperations !== undefined) {
      result.additionalOperations = additionalOperations
    }

    if (!Array.isArray(parameters)) {
      return result
    }

    const attribute = (operation: Record<string, unknown>) => {
      const own = Array.isArray(operation.parameters) ? operation.parameters : []
      const overridden = new Set(own.map((param) => paramIdentity(param, root)))
      return {
        ...operation,
        parameters: [...own, ...parameters.filter((param) => !overridden.has(paramIdentity(param, root)))],
      }
    }

    for (const method of objectKeys(result)) {
      if (methods.has(method) && isPlainObject(result[method])) {
        result[method] = attribute(result[method] as Record<string, unknown>)
      }
    }
    if (isPlainObject(result.additionalOperations)) {
      const operations: Record<string, unknown> = {}
      for (const method of Object.keys(result.additionalOperations)) {
        const operation = (result.additionalOperations as Record<string, unknown>)[method]
        operations[method] = isPlainObject(operation) && !isExtensionKey(method) ? attribute(operation) : operation
      }
      result.additionalOperations = operations
    }

    return result
  }

  // a container present on one side only is compared as an empty one, so diffs land on its operations
  const align = (value: unknown, other: unknown) => {
    if (!isPlainObject(value) || !isPlainObject(other) || "$ref" in value) {
      return value
    }
    if (profile.additionalOperations && !("additionalOperations" in value) && "additionalOperations" in other) {
      return { ...value, additionalOperations: {} }
    }
    return value
  }

  return (before, after, ctx) => {
    const b = lift(before, ctx?.before.root)
    const a = lift(after, ctx?.after.root)
    return [align(b, a), align(a, b)]
  }
}

/** Compatibility: the 3.0 profile transform. */
export const transformPathItems: CompareTransformResolver = (before, after, ctx) =>
  createPathItemsTransform(openApiProfile("3.0"))(before, after, ctx)

export const transformOperation = compareTransformationFactory((value, other) => {
  if (!isPlainObject(value) || !isPlainObject(other)) {
    return value
  }
  const { deprecated, ...result }: any = { ...value }

  // add empty tags / parameters arrays, so that diffs land on the items
  for (const key of ["tags", "parameters"]) {
    if (!(key in value) && key in other) {
      result[key] = []
    }
  }

  // remove deprecated: false
  if (deprecated) {
    result.deprecated = deprecated
  }

  return result
})

export const transformPaths: CompareTransformResolver = (before, after, ctx) => {
  if (!isPlainObject(before) || !isPlainObject(after)) {
    return [before, after]
  }

  // add empty path items (diffs should be reported per operation); `x-*` keys are extensions, not paths (ISSUE-54)
  const { added, removed } = pathMappingResolver(before, after, ctx ?? ({} as CompareContext))
  return [
    added.filter((key) => !isExtensionKey(key)).reduce((obj, key) => setKeyValue(obj, key, {}), { ...before }),
    removed.filter((key) => !isExtensionKey(key)).reduce((obj, key) => setKeyValue(obj, key, {}), { ...after }),
  ]
}

/**
 * Parameter normalization: `style` and `explode` defaults are made explicit on both sides (so an explicit default is
 * not a change and a real change is visible), `deprecated: false` and `required: false` are dropped.
 */
export const transformParameterItem = compareTransformationFactory((value, other) => {
  if (!isObject(value) || !isObject(other) || "$ref" in value) {
    return value
  }

  const { deprecated, required, ...result }: any = { ...value }

  // set default value for style
  if ("in" in value && !("style" in value)) {
    const style = getDefaultStyle(value.in)
    if (style) {
      result.style = style
    }
  }

  // set default value for explode (only when both sides share the style: a style change already covers it)
  const otherStyle = "style" in other ? other.style : getDefaultStyle(other.in)
  if ("style" in result && !("explode" in value) && result.style === otherStyle) {
    result.explode = result.style === "form"
  }

  // remove deprecated: false
  if (deprecated) {
    result.deprecated = deprecated
  }

  // remove required: false
  if (required) {
    result.required = required
  }

  // `allowEmptyValue` / `allowReserved` default to false (ISSUE-70)
  for (const key of ["allowEmptyValue", "allowReserved"]) {
    if (result[key] === false && !(key in other)) {
      delete result[key]
    }
  }

  return result
})

/**
 * Cross-version schema adapter: OpenAPI 3.0 `nullable: true` is the same schema as a 3.1 `type` array including
 * "null", so the 3.0 form is rewritten when the other side uses the array form.
 */
export const transformOpenApiSchema = compareTransformationFactory((value, other) => {
  if (!isPlainObject(value) || !isPlainObject(other)) {
    return value
  }

  if (value.nullable === true && "type" in value && Array.isArray(other.type) && other.type.includes("null")) {
    const { nullable, type, ...rest } = value
    const types = Array.isArray(type) ? type : [type]
    return { ...rest, type: types.includes("null") ? types : [...types, "null"] }
  }

  return value
})

/**
 * Cross-version example adapter (3.2 `dataValue` / `serializedValue`): an Example object whose `value` moved to
 * `dataValue` with the same content is the same example.
 */
export const transformExample = compareTransformationFactory((value, other) => {
  if (!isPlainObject(value) || !isPlainObject(other)) {
    return value
  }
  if ("value" in value && !("dataValue" in value) && "dataValue" in other && !("value" in other)) {
    const { value: data, ...rest } = value
    return { ...rest, dataValue: data }
  }
  return value
})

/** Cross-version XML adapter (3.2 `nodeType`): `attribute: true` is `nodeType: attribute`, `wrapped: true` is `element`. */
export const transformXml = compareTransformationFactory((value, other) => {
  if (!isPlainObject(value) || !isPlainObject(other) || !("nodeType" in other) || "nodeType" in value) {
    return value
  }
  const { attribute, wrapped, ...rest } = value
  if (attribute === true) {
    return { ...rest, nodeType: "attribute" }
  }
  if (wrapped === true) {
    return { ...rest, nodeType: "element" }
  }
  return value
})

const OVERRIDE_KEYS = ["summary", "description"] as const

const overrideOf = (value: unknown): Record<string, unknown> | undefined => {
  if (!isPlainObject(value) || typeof value.$ref !== "string") {
    return
  }
  let result: Record<string, unknown> | undefined
  for (const key of OVERRIDE_KEYS) {
    if (key in value) {
      result ??= {}
      result[key] = value[key]
    }
  }
  return result
}

const sameOverride = (a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined) =>
  OVERRIDE_KEYS.every((key) => a?.[key] === b?.[key])

/** The referenced object with the Reference Object's own `summary` / `description` in place of its own. */
const applyOverride = (value: unknown, side: "before" | "after", ctx: CompareContext | undefined): unknown => {
  const override = overrideOf(value)
  if (!override || !ctx) {
    return value
  }
  let target: unknown = value
  for (let hops = 0; hops < 16 && isPlainObject(target) && typeof target.$ref === "string"; hops++) {
    target = ctx.session.resolveRef(side, ctx[side].root, target.$ref)?.value
  }
  if (!isPlainObject(target)) {
    return value
  }
  return { ...target, ...override }
}

/**
 * OpenAPI 3.1+ Reference Object `summary` / `description` override the referenced object's (ISSUE-60): when the
 * override differs between the sides, the reference is compared as the referenced object with the override applied,
 * so the documentation change is reported at the usage and a referenced description the override hides is not. The
 * same reference with the same override on both sides stays a reference (changes of the target are reported at its
 * declaration). OpenAPI 3.0 ignores the siblings of `$ref`.
 */
export const transformReferenceOverride: CompareTransformResolver = (before, after, ctx) => {
  const bOverride = overrideOf(before)
  const aOverride = overrideOf(after)
  if ((!bOverride && !aOverride) || sameOverride(bOverride, aOverride)) {
    return [before, after]
  }
  return [applyOverride(before, "before", ctx), applyOverride(after, "after", ctx)]
}

/**
 * A map present on one side only is compared as an empty map, so that the change is reported per entry (each one
 * classified and described on its own, e.g. by its usages) instead of as one container diff (ISSUE-160, ISSUE-68).
 */
export const createContainerAlignTransform = (keys: readonly string[]): CompareTransformResolver =>
  compareTransformationFactory((value, other) => {
    if (!isPlainObject(value) || !isPlainObject(other)) {
      return value
    }
    let result = value
    for (const key of keys) {
      if (!(key in value) && isPlainObject(other[key])) {
        result = result === value ? { ...value } : result
        result[key] = {}
      }
    }
    return result
  })

/** The `components` object: every component map present on one side only is aligned with an empty map. */
export const transformComponents = compareTransformationFactory((value, other) => {
  if (!isPlainObject(value) || !isPlainObject(other)) {
    return value
  }
  let result = value
  for (const key of Object.keys(other)) {
    if (!isExtensionKey(key) && !(key in value) && isPlainObject(other[key])) {
      result = result === value ? { ...value } : result
      result[key] = {}
    }
  }
  return result
})

/**
 * Drops the keys whose value is the default where the other side does not have the key (ISSUE-70): an explicit
 * default is the same contract as the omitted key; a real change (`false` -> `true`) stays a replace.
 */
const withoutDefaults = (
  value: unknown,
  other: unknown,
  defaults: (value: Record<string, unknown>) => Record<string, unknown>,
) => {
  if (!isPlainObject(value) || "$ref" in value) {
    return value
  }
  const values = defaults(value)
  let result = value
  for (const key of Object.keys(values)) {
    if (key in value && value[key] === values[key] && !(isPlainObject(other) && key in other)) {
      if (result === value) {
        result = { ...value }
      }
      delete result[key]
    }
  }
  return result
}

const headerDefaults = () => ({
  required: false,
  deprecated: false,
  allowEmptyValue: false,
  allowReserved: false,
  style: "simple",
  explode: false,
})

/** Header Object defaults (`required` / `deprecated` / `allowEmptyValue` / `allowReserved` false, `simple`, no explode). */
export const transformHeaderDefaults = compareTransformationFactory((value, other) =>
  withoutDefaults(value, other, headerDefaults),
)

// Encoding Object: `style` defaults to `form`, `explode` to true for `form`, `allowReserved` to false
const encodingDefaults = (value: Record<string, unknown>) => ({
  style: "form",
  explode: (value.style ?? "form") === "form",
  allowReserved: false,
})

export const transformEncodingDefaults = compareTransformationFactory((value, other) =>
  withoutDefaults(value, other, encodingDefaults),
)

/** Request Body Object: `required` defaults to false. */
export const transformRequestBodyDefaults = compareTransformationFactory((value, other) =>
  withoutDefaults(value, other, () => ({ required: false })),
)
