import type { ComapreContext, CompareTransformResolver } from "../types"
import { isKey, isObject, objectKeys, setKeyValue } from "../utils"
import { pathMappingResolver } from "./openapi3.mapping"
import { compareTransformationFactory } from "../core"
import { getDefaultStyle } from "./openapi3.utils"

export const transformPathItems = compareTransformationFactory((value) => {
  if (!isObject(value)) {
    return value
  }

  const methods = [
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
  ]

  const _value = objectKeys(value).reduce((res, key) => {
    if (methods.includes(key)) {
      return res
    }
    res[key] = value[key]
    return res
  }, {} as any)

  if (!objectKeys(_value).length) {
    return value
  }

  const result: Record<string, any> = {}

  for (const method of methods) {
    if (
      !isKey(value, method) ||
      typeof value[method] !== "object" ||
      !value[method]
    ) {
      continue
    }
    const data = { ...(value[method] as any) }

    const { parameters, servers, ...rest } = _value

    // copy path parameters to all methods
    if (parameters && Array.isArray(parameters)) {
      if ("parameters" in data && Array.isArray(data.parameters)) {
        data.parameters = [...data.parameters, ...parameters]
      } else {
        data.parameters = parameters
      }
    }

    // copy servers to all methods
    if (servers && Array.isArray(servers)) {
      if ("servers" in data && Array.isArray(data.servers)) {
        data.servers = [...data.servers, ...servers]
      } else {
        data.servers = servers
      }
    }

    // copy summary/description and rest to all methods
    for (const key of objectKeys(rest)) {
      if (isKey(data, key)) {
        continue
      }
      data[key] = rest[key]
    }

    result[method] = data
  }

  return result
})

export const transformOperation = compareTransformationFactory(
  (value, other) => {
    if (!isObject(value) || !isObject(other)) {
      return value
    }
    const result: any = { ...value }

    // add empty tags array
    if (!("tags" in value) && "tags" in other) {
      result.tags = []
    }

    // remvoe deprecated: false
    if ("deprecated" in result && !result.deprecated) {
      result.deprecated = undefined
    }

    return result
  },
)

export const transformPaths: CompareTransformResolver = (before, after) => {
  if (!isObject(before) || !isObject(after)) {
    return [before, after]
  }

  // add empty paths (diff should be in methods)
  const { added, removed } = pathMappingResolver(
    before,
    after,
    {} as ComapreContext,
  )
  return [
    added.reduce((obj, key) => setKeyValue(obj, key, { [key]: {} }), {
      ...before,
    }),
    removed.reduce((obj, key) => setKeyValue(obj, key, { [key]: {} }), {
      ...after,
    }),
  ]
}

export const transformParameterItem = compareTransformationFactory(
  (value, other) => {
    if (!isObject(value) || !isObject(other)) {
      return value
    }

    const result: any = { ...value }

    // set default value for style
    if ("in" in value && !("style" in value) && "style" in other) {
      const style = getDefaultStyle(value.in)
      if (style) {
        result.style = style
      }
    }

    // set default value for explode
    if ("style" in result && "explode" in value && "explode" in other) {
      if (result.style === "form") {
        result.explode = true
      }
    }

    // remove deprecated: false
    if ("deprecated" in result && !result.deprecated) {
      result.deprecated = undefined
    }

    // remove required: false
    if ("required" in result && !result.required) {
      result.required = undefined
    }

    return result
  },
)

export const transformOpenApiSchema = compareTransformationFactory(
  (value, other) => {
    if (!isObject(value) || !isObject(other)) {
      return value
    }

    // 1. convert discriminator to consts
    // 2. add custom tag to descriminator property
    // if (("discriminator" in value && isOneOfNode(value)) || isAnyOfNode(value)) {
    //   const { discriminator, ...rest } = value

    //   if (
    //     typeof discriminator !== "object" ||
    //     !discriminator ||
    //     Array.isArray(discriminator) ||
    //     !("propertyName" in discriminator)
    //   ) {
    //     return rest
    //   }

    //   const prop = discriminator.propertyName
    //   const mapping: Record<string, string> = discriminator.mapping ?? {}
    //   const refs = Object.entries(mapping).reduce((res, [key, $ref]) => (res[$ref] = key), {} as any)

    //   const transformCombinary = (item: unknown) =>
    //     isRefNode(item) && item.$ref in refs
    //       ? { ...item, properties: { [prop]: { ...(item.properties ?? {}), const: refs[item.$ref] } } }
    //       : item

    //   if (isAnyOfNode(value)) {
    //     return { ...rest, anyOf: value.anyOf.map(transformCombinary) }
    //   } else if (isOneOfNode(value)) {
    //     return { ...rest, oneOf: value.oneOf.map(transformCombinary) }
    //   }
    // }
    return value
  },
)
