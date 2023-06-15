import { mergeValues } from "../../../utils"

export type MergeFunc = (...args: any[]) => any 
export type MergeRulesFunc = () => MergeRules 
export type MergeRule = { "$": MergeFunc }
export type MergeRules = {
  [key: `/${string}` | "/"]: MergeRules | MergeRulesFunc
} | MergeRule

const filterMergedProperties = (args: any[]) => {
  const properties: any[] = []

  for(const obj of args) {
    if (!("properties" in obj)) { continue }
    const ownProperties = new Set(Object.keys(obj.properties))
    const additionalPropertiesSchema = new Map<string, any[]>()

    for(const obj2 of args) {
      if (obj2 == obj) { continue }

      if ("patternProperties" in obj2 && obj2.patternProperties) {
        for (const prop of ownProperties.values()) {
          if (obj2.properties && prop in obj2.properties) { continue }
          for (const pattern of Object.keys(obj2.patternProperties)) {
            if (new RegExp(pattern).test(prop)) { continue }
            // remove property if name is not match pattern
            ownProperties.delete(prop)
          }
        }
      } else if ("additionalProperties" in obj2) {
        for (const prop of ownProperties.values()) {
          if (obj2.properties && prop in obj2.properties) { continue }
          if (!obj2.additionalProperties) {
            // filter all restricted properties
            ownProperties.delete(prop)
          } else if (typeof obj2.additionalProperties === "object") {
            const values = additionalPropertiesSchema.get(prop)
            if (Array.isArray(values)) {
              values.push(obj2.additionalProperties)
            } else {
              additionalPropertiesSchema.set(prop, [obj2.additionalProperties])
            }
          }
        }
      }
    }

    if (!ownProperties.size) { continue }
    const props: Record<string, any> = {}
    for (const prop of ownProperties.values()) {
      if (additionalPropertiesSchema.has(prop)) {
        props[prop] = { allOf: [obj.properties[prop], ...additionalPropertiesSchema.get(prop)!]}
      } else {
        props[prop] = obj.properties[prop]
      }
    }
    properties.push(props)
  }

  return properties
}

const filterMergedPatternProperties = (args: any[]) => {
  const patternProperties: any[] = []

  for(const obj of args) {
    if (!("patternProperties" in obj)) { continue }
    const patterns = new Set(Object.keys(obj.patternProperties))

    for(const obj2 of args) {
      if (obj2 == obj) { continue }
      if ("additionalProperties" in obj2 && !obj2.additionalProperties) {
        for (const pattern of patterns.values()) {
          if (obj2.patternProperties && pattern in obj2.patternProperties) { continue }
          patterns.delete(pattern)
        }
      }
    }

    if (!patterns.size) { continue }
    const props: Record<string, any> = {}
    for (const prop of patterns.values()) {
      props[prop] = obj.patternProperties[prop]
    }
    patternProperties.push(props)
  }

  return patternProperties
}

const filterMergedItems = (args: any[]) => {
  const items: any[] = []
  let minItemsLength = Infinity

  const additionalItemsSchema: Record<number, any[]> = {}

  for(const obj of args) {
    if ("additionalItems" in obj && obj.additionalItems && "items" in obj && Array.isArray(obj.items)) { 
      const n = "items" in obj && Array.isArray(obj.items) ? obj.items.length : 0
      if (additionalItemsSchema[n]) {
        additionalItemsSchema[n].push(obj.additionalItems)
      } else {
        additionalItemsSchema[n] = [obj.additionalItems]
      }
    } 

    if (!("items" in obj)) { continue }
    items.push(obj.items)

    if (!Array.isArray(obj.items)) { continue }

    if ("additionalItems" in obj && !obj.additionalItems) { 
      minItemsLength = Math.min(minItemsLength, obj.items.length)
    } 
  }

  for (const [i, item] of items.entries()) {
    if (!Array.isArray(item)) { continue }
    items[i] = []
    for (let j = 0; j < Math.min(item.length, minItemsLength); j++) {
      const allOf = []
      for (let k = 0; k <= j; k++) {
        if (additionalItemsSchema[k]) {
          allOf.push(...additionalItemsSchema[k])
        }
      }
      if (allOf.length) {
        items[i][j] = j < item.length ? { ...item[j], allOf } : { allOf }
      } else {
        items[i][j] = j < item.length ? item[j] : true
      }
    }
  }
  

  return items
}

const filterMergedAdditionalItems = (args: any[]) => {
  const additionalItems: any[] = []

  const allOf: any[] = []

  for (const obj of args) {
    if ("items" in obj && !Array.isArray(obj.items)) {
      allOf.push(obj.items)
    }
    if (!("additionalItems" in obj) || !("items" in obj) || !Array.isArray(obj.items)) { continue }
    additionalItems.push(obj.additionalItems)
  }

  if (allOf.length) {
    for (const item of additionalItems) {
      item.allOf = allOf
    }
  }

  return additionalItems
}

export const mergeJsonSchema = (...args: any[]) => {
  if (args.includes(false)) {
    return false
  }
  
  const result: Record<string, any> = {}
  const keys = mergedKeys(args)

  if ("properties" in keys) {
    keys.properties = filterMergedProperties(args)
    if (!keys.properties.length) {
      delete keys.properties
    }
  }

  if ("patternProperties" in keys) {
    keys.patternProperties = filterMergedPatternProperties(args)
    if (!keys.patternProperties.length) {
      delete keys.patternProperties
    }
  }

  if ("items" in keys) {
    keys.items = filterMergedItems(args)
  }

  if ("additionalItems" in keys) {
    keys.additionalItems = filterMergedAdditionalItems(args)
  }

  for (let [key, value] of Object.entries(keys)) {
    const rules: any = jsonSchemaMergeRules()

    let rule = `/${key}` in rules ? rules[`/${key}`] : rules["/*"]
    rule = (!("$" in rule) && "/" in rule) ? rule["/"] : rule
    rule = typeof rule === "function" ? rule() : rule
    const mergeFunc =  "$" in rule ? rule["$"] : undefined

    if (!mergeFunc) {
      throw new Error(`Merge rule not found for key: ${key}`)
    }

    const merged = value.length > 1 ? mergeFunc(...value) : value[0]

    if (merged === undefined) {
      throw new Error('Could not merge values of :"' + key + '". They are probably incompatible. Values: \n' + JSON.stringify(value))
    }

    result[key] = merged
  }

  return result
}

const isEqual = (a: any, b: any) => JSON.stringify(a) == JSON.stringify(b)

export const removeDuplicates = <T>(array: T[]): T[] => {
  const uniqueItems: T[] = [];

  for (const item of array) {
    if (!uniqueItems.some((uniqueItem) => isEqual(uniqueItem, item))) {
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

const first: MergeFunc = (a) => a
const alternative: MergeFunc = (...args) => args.reduce((r, v) =>  r || v, false)

const minValue: MergeFunc = (...args) => Math.min(...args)
const maxValue: MergeFunc = (...args) => Math.max(...args)
const mergeEnum: MergeFunc = (...args) => {
  const result = intersectItems(...args.map((v) => v.map((p: any) => JSON.stringify(p)))).map((v: string) => JSON.parse(v)).sort()
  if (!result.length) {
    throw new Error('Could not merge values of enum. They are probably incompatible. Values: \n' + JSON.stringify(args))
  }
  return result
}
const mergePattern: MergeFunc = (...args) => args.length > 1 ? args.reduce((r, v) => `${r}(?=${v})`, '') : args[0]
const intersectItems: MergeFunc = (a, ...args) => args.reduce((r, v) => r.filter((t: string) => v.includes(t)), a)

const mergeTypes: MergeFunc = (...args) => {
  const arrayTypes = args.map((a) => Array.isArray(a) ? a : [a])
  const types = intersectItems(...arrayTypes)
  return types.length === 1 ? types[0] : types.length ? types : undefined
}

const equal: MergeFunc = (a, ...args) => args.find((v) => !isEqual(v, a)) ? undefined : a

const mergeObjects: MergeFunc = (a, ...args) => args.reduce((r, v) => mergeValues(r, v), a)

const mergeProperties: MergeFunc = (...args) => {
  const result: Record<string, any> = {}
  const props = mergedKeys(args)

  for (const [prop, items] of Object.entries(props)) {
    if (items.includes(false)) {
      result[prop] = false
    } else {
      result[prop] = items.length > 1 ? { allOf: items } : items[0]
    }
  }

  return result
}

function findCombinations(vectors: any[][]): any[][] {
  if (vectors.length === 0) {
    return [[]]; // Base case: empty vector, return an empty combination
  }

  const firstVector = vectors[0];
  const remainingVectors = vectors.slice(1);

  const combinationsOfRemaining = findCombinations(remainingVectors); // Recursively find combinations for remaining vectors

  const combinations = [];
  for (const element of firstVector) {
    for (const combination of combinationsOfRemaining) {
      combinations.push([element, ...combination]); // Add the current element to each combination of the remaining vectors
    }
  }

  return combinations;
}

const mergeStringItems: MergeFunc = (...args) => {
  const uniqueStrings: Set<string> = new Set();

  // Iterate through each array and add its strings to the set
  for (const array of args) {
    for (const str of array) {
      uniqueStrings.add(str);
    }
  }

  // Convert the set back to an array and return it
  return Array.from(uniqueStrings).sort()
} 
const mergeArray: MergeFunc = (...args) => findCombinations(args).map((v) => ({ allOf: v }))

const mergeNot: MergeFunc = (...args) => ({ anyOf: args })
const mergeMultipleOf: MergeFunc = (...args) => calculateLCM(args)

function findMultiplierForInteger(number: number): number {
  let multiplier = 1;

  while (number * multiplier % 1 !== 0) {
    multiplier *= 10;
  }

  return multiplier;
}

function calculateLCM(args: number[]): number {
  const x = args.reduce((r, v) => Math.max(r, findMultiplierForInteger(v)), 0)
  return args.reduce((a, b) => Math.round((a * x * b * x) / calculateGCD(a * x, b * x)) / x)
}

function calculateGCD(a: number, b: number): number {
  return b === 0 ? a : calculateGCD(b, a % b);
}

const mergedKeys = (args: any[]): Record<string, any[]> => {
  const props: Record<string, any[]> = {}

  for (const obj of args) {
    for (const prop of Object.keys(obj)) {
      if (Array.isArray(props[prop])) {
        props[prop].push(obj[prop])
      } else {
        props[prop] = [obj[prop]]
      }
    }
  }
  return props
}

const mergeDependencies: MergeFunc = (...args) => {
  const result: Record<string, any> = {}
  const props = mergedKeys(args)

  for (const [prop, items] of Object.entries(props)) {
    const required = items.reduce((r, v) => r && Array.isArray(v), true)

    if (required) {
      result[prop] = mergeStringItems(...items)
    } else {
      const _items = items.map((v) => Array.isArray(v) ? { required: v } : v)
      result[prop] = _items.length > 1 ? { allOf: _items } : _items[0]
    }
  }

  return result
}

const mergeItems: MergeFunc = (...args) => {
  const maxArraySize = args.reduce((r, v) => Array.isArray(v) ? Math.max(r, v.length) : r, -1)

  if (maxArraySize === -1) { return mergeJsonSchema(...args) }

  const items: any[] = []

  for (let i = 0; i < maxArraySize; i++) {
    const allOf = []
    for (const arg of args) {
      allOf.push(Array.isArray(arg) ? arg[i] || true : arg)
    }
    items.push({ allOf })
  }

  return items
}

export const jsonSchemaMergeRules = (draft: string = "06"): MergeRules => ({
  "/maximum": { $: minValue },
  "/exclusiveMaximum": { $: alternative },
  "/minimum": { $: maxValue },
  "/exclusiveMinimum": { $: alternative },
  "/maxLength": { $: minValue },
  "/minLength": { $: maxValue },
  "/maxItems": { $: minValue },
  "/minItems": { $: maxValue },
  "/uniqueItems": { $: alternative },
  "/maxProperties": { $: minValue },
  "/minProperties": { $: maxValue },
  "/required": { $: mergeStringItems },
  "/multipleOf": { $: mergeMultipleOf },
  "/enum": { $: mergeEnum },
  "/type": { $: mergeTypes },
  "/allOf": {
    "/*": () => jsonSchemaMergeRules(draft),
    $: mergeArray,
  },
  "/not": { $: mergeNot },
  "/oneOf": {
    "/*": () => jsonSchemaMergeRules(draft),
    $: mergeArray,
  },
  "/anyOf": {
    "/*": () => jsonSchemaMergeRules(draft),
    $: mergeArray,
  },
  "/properties": {
    "/*": () => jsonSchemaMergeRules(draft),
    $: mergeProperties,
  },
  "/items": {
    "/": () => jsonSchemaMergeRules(draft),
    "/*": () => jsonSchemaMergeRules(draft),
    $: mergeItems,
  },
  "/additionalProperties": () => jsonSchemaMergeRules(draft),
  "/additionalItems": () => jsonSchemaMergeRules(draft),
  "/patternProperties": { 
    "/*": () => jsonSchemaMergeRules(draft),
    $: mergeProperties,
  },
  "/pattern": { $: mergePattern },
  "/nullable": { $: alternative },
  "/discriminator": { $: mergeObjects },
  "/readOnly": { $: alternative },
  "/writeOnly": { $: alternative },
  "/example": { $: mergeObjects },
  "/examples": { $: mergeObjects },
  "/deprecated": { $: alternative },
  ...draft === "06" ? { 
    "/propertyNames": () => jsonSchemaMergeRules(draft),
    "/contains": () => jsonSchemaMergeRules(draft),
    "/dependencies": { 
      "/*": () => jsonSchemaMergeRules(draft),
      $: mergeDependencies
    },
    "/const": { $: equal },
    "/exclusiveMaximum": { $: minValue },
    "/exclusiveMinimum": { $: maxValue },
  } : {},
  "/xml": { $: mergeObjects },
  // "/externalDocs": { $: first },
  // "/description": { $: first },
  // "/title": { $: first },
  // "/format": { $: first },
  // "/default": { $: first },
  "/*": { $: first },
  $: mergeJsonSchema,
})
