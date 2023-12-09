import { isAnyOfNode, isOneOfNode, isRefNode } from "allof-merge"

import { isArray, isObject, objectKeys, filterObj, compareTransformationFactory } from "../utils"
import { inferTypes, isAllOfNode, isValidType } from "./jsonSchema.utils"
import { jsonSchemaTypeProps } from "./jsonSchema.consts"
import type { CompareTransformResolver } from "../types"

export const validators = {
  type: (value: unknown) => (Array.isArray(value) && value.every(isValidType)) || isValidType(value),
  description: (value: unknown) => typeof value === "string",
  title: (value: unknown) => typeof value === "string",
  deprecated: (value: unknown) => typeof value === "boolean",
  readOnly: (value: unknown) => typeof value === "boolean",
  writeOnly: (value: unknown) => typeof value === "boolean",
  examples: (value: unknown) => Array.isArray(value),
  enum: (value: unknown) => Array.isArray(value),
  format: (value: unknown) => typeof value === "string",
  minLength: (value: unknown) => typeof value === "number",
  maxLength: (value: unknown) => typeof value === "number",
  pattern: (value: unknown) => typeof value === "string",
  multipleOf: (value: unknown) => typeof value === "number",
  minimum: (value: unknown) => typeof value === "number",
  exclusiveMinimum: (value: unknown) => typeof value === "number" || typeof value === "boolean",
  maximum: (value: unknown) => typeof value === "number",
  exclusiveMaximum: (value: unknown) => typeof value === "number" || typeof value === "boolean",
  properties: (value: unknown) => isObject(value) && Object.keys(value).length,
  required: (value: unknown) => Array.isArray(value),
  patternProperties: (value: unknown) => isObject(value) && Object.keys(value).length,
  additionalProperties: (value: unknown) =>
    typeof value === "boolean" || (isObject(value) && Object.keys(value).length),
  minProperties: (value: unknown) => typeof value === "number",
  maxProperties: (value: unknown) => typeof value === "number",
  propertyNames: (value: unknown) => typeof value === "object" && value !== null && Object.keys(value).length,
  items: (value: unknown) => Array.isArray(value) || (isObject(value) && Object.keys(value).length),
  additionalItems: (value: unknown) => isObject(value) && Object.keys(value).length,
  minItems: (value: unknown) => typeof value === "number",
  maxItems: (value: unknown) => typeof value === "number",
  uniqueItems: (value: unknown) => typeof value === "boolean",
}

export const transformCombinary: CompareTransformResolver = (before, after) => {
  if (!isAnyOfNode(before) && !isAnyOfNode(after) && !isOneOfNode(before) && !isOneOfNode(after)) {
    return [before, after]
  }

  if (isOneOfNode(before)) {
    // transform after to oneOf
    return [before, isOneOfNode(after) ? after : { oneOf: [after]}]
  } else if (isAnyOfNode(before)) {
    // transform after to anyOf
    return [before, isAnyOfNode(after) ? after : { anyOf: [after]}]
  } else {
    if (isOneOfNode(after)) {
      // transform before to oneOf
      return [isOneOfNode(before) ? before : { oneOf: [before]}, after]
    } else {
      // transform before to anyOf
      return [isOneOfNode(before) ? before : { anyOf: [before]}, after]
    }
  }
}

export const transformAdditionalItems = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }

  const { additionalItems, ...rest } = value as any
  // // transform additionalItems: true into additionalItems with type: any
  // if ("type" in value && value.type === "array" && additionalItems === true) {
  //   return { ...value, additionalItems: { type: "any" } }
  // }

  // remove additionalItems: false
  if (!additionalItems) {
    return rest
  }

  return value
})

export const transformItems = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other ) {
    return value
  }

  if ("items" in other && isArray(other.items)) {
    if ("items" in value && typeof value.items === "object") {
      const { items } = value
      return isArray(items) ? value: {...value, items: other.items.map(() => items), additionalItems: items }
    } else {
      return { ...value, items: [] }
    }
  }

  return value
})

export const transformAdditionalProperties = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }

  const { additionalProperties, ...rest } = value as any

  // remove additionalProperties: false
  if (!additionalProperties) {
    return rest
  }

  return value
})

export const transformProperties = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }

  // add empty properties
  if (!("properties" in value) && "properties" in other) {
    return { ...value, properties: {} }
  }

  return value
})

export const transformDiscriminator = compareTransformationFactory((value) => {
  if (typeof value !== "object" || !value) {
    return value
  }
  // 1. convert discriminator to consts
  // 2. add custom tag to descriminator property

  if (("discriminator" in value && isOneOfNode(value)) || isAnyOfNode(value)) {
    const { discriminator, ...rest } = value

    if (
      typeof discriminator !== "object" ||
      !discriminator ||
      Array.isArray(discriminator) ||
      !("propertyName" in discriminator)
    ) {
      return rest
    }

    const prop = discriminator.propertyName
    const mapping: Record<string, string> = discriminator.mapping ?? {}
    const refs = Object.entries(mapping).reduce((res, [key, $ref]) => (res[$ref] = key), {} as any)

    const transformCombinary = (item: unknown) =>
      isRefNode(item) && item.$ref in refs
        ? { ...item, properties: { [prop]: { ...(item.properties ?? {}), const: refs[item.$ref] } } }
        : item

    if (isAnyOfNode(value)) {
      return { ...rest, anyOf: value.anyOf.map(transformCombinary) }
    } else if (isOneOfNode(value)) {
      return { ...rest, oneOf: value.oneOf.map(transformCombinary) }
    }
  }
  return value
})

export const transformConstEnum = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }
  // 1. transform const into enum
  if ("const" in value && "enum" in other) {
    const { const: v, ...rest } = value
    return { ...rest, enum: [v] }
  }

  // 2. remove not unique items
  if ("enum" in value && Array.isArray(value.enum)) {
    const _enum = value.enum.filter((v, i, arr) => arr.indexOf(v) === i)

    return { ...value, enum: _enum }
  }

  // 3. add empty required
  if (!("enum" in value) && "enum" in other) {
    return { ...value, enum: [] }
  }

  return value
})

export const transformRequred = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }
  // 1. remove not unique items
  // 2. remove non-string items
  if ("required" in value && Array.isArray(value.required)) {
    const required = value.required.filter(
      (item, index, array) => typeof item === "string" && array.indexOf(item) === index
    )

    return { ...value, required }
  }

  // 3. add empty required
  if (!("required" in value) && "required" in other) {
    return { ...value, required: [] }
  }

  return value
})

export const transformExclusiveMinimum = compareTransformationFactory((value) => {
  if (typeof value !== "object" || !value) {
    return value
  }
  // 1. convert exclusiveMinimum from boolean to number
  // 2. remove minimum if exclusiveMinimum exists
  if ("exclusiveMinimum" in value && typeof value.exclusiveMinimum === "boolean" && "minimum" in value) {
    const { minimum, exclusiveMinimum, ...rest } = value
    return { ...rest, exclusiveMinimum: minimum }
  }
  return value
})

export const transformExclusiveMaximum = compareTransformationFactory((value) => {
  if (typeof value !== "object" || !value) {
    return value
  }
  // 1. convert exclusiveMaximum from boolean to number
  // 2. remove maximum if exclusiveMaximum exists
  if ("exclusiveMaximum" in value && typeof value.exclusiveMaximum === "boolean" && "maximum" in value) {
    const { maximum, exclusiveMaximum, ...rest } = value
    return { ...rest, exclusiveMaximum: maximum }
  }
  return value
})

export const transformExample = compareTransformationFactory((value, other) => {
  if (typeof value !== "object" || !value || typeof other !== "object" || !other) {
    return value
  }
  // convert example to array of examples
  if ("example" in value && "examples" in other) {
    const { example, ...rest } = value
    const examples = "examples" in value && Array.isArray(value.examples) ? value.examples : []
    return { ...rest, examples: [...examples, example] }
  }

  // add empty examples
  if (!("examples" in value) && "examples" in other) {
    return { ...value, examples: [] }
  }

  return value
})

export const transformTypeOfArray = compareTransformationFactory((value) => {
  if (typeof value !== "object" || !value) {
    return value
  }
  // 1. remove non-standard types
  // 2. convert nullable into null type
  // 3. convert array of types into anyOf with single type
  // TODO: 4. set any type if it is undefined ?
  if (isOneOfNode(value) || isAnyOfNode(value) || isAllOfNode(value)) {
    return value
  }

  const types = "type" in value && value.type ? (Array.isArray(value.type) ? value.type : [value.type]) : []
  let typeSet = new Set(types.filter(isValidType))

  if (!typeSet.size) {
    typeSet = new Set(inferTypes(value))
  }

  if (typeSet.size && "nullable" in value && value.nullable) {
    typeSet.add("null")
  }

  if (!typeSet.size) {
    return value
  }

  const { defs, definitions, ...rest } = value as any
  if (typeSet.size === 1) {
    const [type] = [...typeSet.values()]
    return {
      ...filterObj(value, (key) => typeof key === "string" && (jsonSchemaTypeProps[type].includes(key) || key.startsWith("x-"))),
      type,
      ...defs ? { defs } : {},
      ...definitions ? { definitions } : {},
    }
  } else {

    return {
      anyOf: [...typeSet.values()].map((type) => ({
        ...filterObj(rest, (key) => typeof key === "string" && (jsonSchemaTypeProps[type].includes(key) || key.startsWith("x-"))),
        type,
      })),
      ...defs ? { defs } : {},
      ...definitions ? { definitions } : {},
    }
  }
})

export const transformDeprecated = compareTransformationFactory((value) => {
  if (typeof value !== "object" || !value) {
    return value
  }
  // 1. convert boolean "x-deprecated" into deprecated
  // 2. convert string "x-deprecated" into deprecated object
  if ( "x-deprecated" in value) {
    const { "x-deprecated": deprecated, ...rest } = value
    if (typeof deprecated === "boolean") {
      return deprecated ? { deprecated, ...value } : value
    } else if (typeof deprecated === "string") {
      return { deprecated: { reason: deprecated, ...value }}
    }
  }

  return value
})

export const filterValidProps = compareTransformationFactory((value) => {
  if (typeof value !== "object" || !value || Array.isArray(value)) {
    return value
  }

  const result: any = { ...value }

  for (const prop of objectKeys(validators)) {
    if (prop in result) {
      const isValidProp = validators[prop]
      if (!isValidProp(result[prop])) {
        delete result[prop]
      }
    }
  }

  return result
})

export const jsonSchemaTransformers = [
  // !! order is important
  // filterValidProps,
  transformCombinary,
  transformAdditionalItems,
  transformItems,
  transformAdditionalProperties,
  transformProperties,
  transformConstEnum,
  transformDeprecated,
  transformDiscriminator,
  transformExample,
  transformExclusiveMaximum,
  transformExclusiveMinimum,
  transformRequred,
  transformTypeOfArray,
]
