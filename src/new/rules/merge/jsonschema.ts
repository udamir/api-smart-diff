import { mergeValues } from "../../../utils"
import { MapArray } from "../../utils"

export interface MergeContext {
  jsonSchemaMergeArgs: any[]
  onError?: (msg: string) => void
}

export type MergeFunc = (args: any[], ctx: MergeContext) => any 
export type MergeRulesFunc = () => MergeRules 
export type MergeRule = { "$": MergeFunc }
export type MergeRules = {
  [key: `/${string}` | "/"]: MergeRules | MergeRulesFunc
} | MergeRule

const getPropertiesForMerge = (args: any[]) => {
  const properties: any[] = []

  for (const obj of args) {
    if (!("properties" in obj)) { continue }
    const ownProperties = new Set(Object.keys(obj.properties))
    const additionalPropertiesSchema = new MapArray<string, any>()

    // all "properties" should be filtered with "patternProperties" 
    // all non-comman properties should be merged with "additionalProperties" schema
    for (const prop of ownProperties.values()) {
      for (const obj2 of args) {
        if (obj2 == obj || (obj2.properties && prop in obj2.properties)) { continue }

        if ("patternProperties" in obj2 && obj2.patternProperties) {
          for (const pattern of Object.keys(obj2.patternProperties)) {
            if (new RegExp(pattern).test(prop)) { continue }
            // remove property if name is not match pattern
            ownProperties.delete(prop)
          }
        } else if ("additionalProperties" in obj2) {
          if (obj2.additionalProperties === false) {
            // filter all restricted properties
            ownProperties.delete(prop)
          } else if (typeof obj2.additionalProperties === "object") {
            // store additionalProperties schema for property
            additionalPropertiesSchema.add(prop, obj2.additionalProperties)
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

const getPatternPropertiesForMerge = (args: any[]) => {
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

const getObjectPropertiesForMerge = (args: any[]): Record<string, any[]> => {
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

export const mergeJsonSchema: MergeFunc = (args: any[]) => {
  if (args.includes(false)) { return false }
  
  const result: Record<string, any> = {}
  const keys = getObjectPropertiesForMerge(args)

  if ("properties" in keys) {
    keys.properties = getPropertiesForMerge(args)
    if (!keys.properties.length) {
      delete keys.properties
    }
  }

  if ("patternProperties" in keys) {
    keys.patternProperties = getPatternPropertiesForMerge(args)
    if (!keys.patternProperties.length) {
      delete keys.patternProperties
    }
  }

  for (let [key, _args] of Object.entries(keys)) {
    const rules: any = jsonSchemaMergeRules()

    let rule = `/${key}` in rules ? rules[`/${key}`] : rules["/*"]
    rule = (!("$" in rule) && "/" in rule) ? rule["/"] : rule
    rule = typeof rule === "function" ? rule() : rule
    const mergeFunc =  "$" in rule ? rule["$"] : undefined

    if (!mergeFunc) {
      throw new Error(`Merge rule not found for key: ${key}`)
    }

    const merged = _args.length > 1 ? mergeFunc(_args, { jsonSchemaMergeArgs: args }) : _args[0]

    if (merged === undefined) {
      throw new Error('Could not merge values of :"' + key + '". They are probably incompatible. Values: \n' + JSON.stringify(_args))
    }

    result[key] = merged
  }

  return result
}

const first: MergeFunc = ([a]) => a
const alternative: MergeFunc = (args) => args.reduce((r, v) =>  r || v, false)

const minValue: MergeFunc = (args) => Math.min(...args)
const maxValue: MergeFunc = (args) => Math.max(...args)
const mergeEnum: MergeFunc = (args, ctx) => {
  const items = args.map((v) => v.map((p: any) => JSON.stringify(p)))
  const result = intersectItems(items, ctx).map((v: string) => JSON.parse(v)).sort()
  if (!result.length) {
    throw new Error('Could not merge values of enum. They are probably incompatible. Values: \n' + JSON.stringify(args))
  }
  return result
}
const mergePattern: MergeFunc = (args) => args.length > 1 ? args.reduce((r, v) => `${r}(?=${v})`, '') : args[0]
const intersectItems: MergeFunc = ([a, ...args]) => args.reduce((r, v) => r.filter((t: string) => v.includes(t)), a)

const mergeTypes: MergeFunc = (args, ctx) => {
  const arrayTypes = args.map((a) => Array.isArray(a) ? a : [a])
  const types = intersectItems(arrayTypes, ctx)
  return types.length === 1 ? types[0] : types.length ? types : undefined
}

const equal: MergeFunc = ([a, ...args]) => args.find((v) => !isEqual(v, a)) ? undefined : a

const mergeObjects: MergeFunc = ([a, ...args]) => args.reduce((r, v) => mergeValues(r, v), a)

const mergeProperties: MergeFunc = (args, ctx) => {
  const result: Record<string, any> = {}
  const props = getObjectPropertiesForMerge(args)

  for (const [prop, items] of Object.entries(props)) {
    if (items.includes(false)) {
      result[prop] = false
    } else {
      result[prop] = items.length > 1 ? { allOf: items } : items[0]
    }
  }

  return result
}

const mergeStringItems: MergeFunc = (args) => {
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
const mergeArray: MergeFunc = (args) => findCombinations(args).map((v) => ({ allOf: v }))

const mergeNot: MergeFunc = (args) => ({ anyOf: args })
const mergeMultipleOf: MergeFunc = (args) => calculateLCM(args)

const mergeDependencies: MergeFunc = (args, ctx) => {
  const result: Record<string, any> = {}
  const props = getObjectPropertiesForMerge(args)

  for (const [prop, items] of Object.entries(props)) {
    const required = items.reduce((r, v) => r && Array.isArray(v), true)

    if (required) {
      result[prop] = mergeStringItems(items, ctx)
    } else {
      const _items = items.map((v) => Array.isArray(v) ? { required: v } : v)
      result[prop] = _items.length > 1 ? { allOf: _items } : _items[0]
    }
  }

  return result
}

const mergeItems: MergeFunc = (args, ctx) => {
  // if all "items" are not array, merge items as JsonSchema
  const arrayItems = args.reduce((r, v) => Array.isArray(v) || r, false)
  if (!arrayItems) { return mergeJsonSchema(args, ctx) }

  // if any of "items" is array, additionalItems should also be merged with "items"
  const mergeItems: any[] = []
  // limit for items length in case of "items" is array and "additionalItems" is false
  let itemsLimit = Infinity
  let maxItemsLength = 0

  // map of additionalItems schemas required for 
  const additionalItemsSchema = new MapArray<number, any>()

  for(const obj of ctx.jsonSchemaMergeArgs) {
    // schema from additionalItems should be merged with all "items" with index greater then length of "items" in current schema
    // additionalItems should be ignored if no "items" in current schema or "items" in object
    if ("additionalItems" in obj && obj.additionalItems && "items" in obj && Array.isArray(obj.items)) { 
      additionalItemsSchema.add(obj.items.length, obj.additionalItems)
    } 

    if (!("items" in obj)) { continue }
    mergeItems.push(obj.items)

    // set max items length and limit
    if (Array.isArray(obj.items)) {
      maxItemsLength = Math.max(maxItemsLength, obj.items.length)
      if ("additionalItems" in obj && obj.additionalItems === false) { 
        itemsLimit = Math.min(itemsLimit, obj.items.length)
      } 
    }
  }

  const items: any[] = [] // new Array(Math.min(maxItemsLength, itemsLimit)).fill({ allOf: [] })
  for (let i = 0; i < Math.min(maxItemsLength, itemsLimit); i++) {
    items.push({ allOf: [] })
  }

  // "items" of array type should be merged with additionalItems schema if 
  for (const item of mergeItems) {
    if (!Array.isArray(item)) { 
      // merge schema from object "items" with all array "items"
      items.forEach(({ allOf }) => allOf.push(item))
      continue 
    }

    for (let j = 0; j < items.length; j++) {
      const allOf = []
      // copy all additionalItems schemas for merge via allOf
      for (let k = 0; k <= j; k++) {
        additionalItemsSchema.has(k) && allOf.push(...additionalItemsSchema.get(k)!)
      }

      if (j < item.length) {
        // merge existing items with additionals schemas if needed
        items[j].allOf.push(allOf.length ? { ...item[j], allOf } : item[j])
      } else {
        // add new schemas to "items" if itemsLimit > items.length
        items[j].allOf.push(allOf.length ? { allOf } : true)
      }
    }
  }
  
  return items
}

const mergeAdditionalItems: MergeFunc = (args, ctx) => {
  const additionalItems: any[] = []
  const itemsSchema: any[] = []

  // "additionalItems" schema should be merged with object "items" schemas
  for (const obj of ctx.jsonSchemaMergeArgs) {
    // store object "items"
    if ("items" in obj && !Array.isArray(obj.items)) {
      itemsSchema.push(obj.items)
    }

    // ignore "additionalItems" if "items" is not array
    if (!("additionalItems" in obj) || !("items" in obj) || !Array.isArray(obj.items)) { continue }
    additionalItems.push(obj.additionalItems)
  }

  // merge "items" schemas to "additionalItems" via allOf
  if (itemsSchema.length) {
    additionalItems.forEach((item) => item.allOf = itemsSchema)
  }

  return mergeJsonSchema(additionalItems, ctx)
}

export const jsonSchemaMergeRules = (draft: string = "06", mergeFunc = mergeJsonSchema): MergeRules => ({
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
    "/": () => jsonSchemaMergeRules(draft, mergeItems),
    "/*": () => jsonSchemaMergeRules(draft),
  },
  "/additionalProperties": () => jsonSchemaMergeRules(draft),
  "/additionalItems": () => jsonSchemaMergeRules(draft, mergeAdditionalItems),
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
  $: mergeFunc,
})


// utils 
const isEqual = (a: any, b: any) => JSON.stringify(a) == JSON.stringify(b)

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

export const removeDuplicates = <T>(array: T[]): T[] => {
  const uniqueItems: T[] = [];

  for (const item of array) {
    if (!uniqueItems.some((uniqueItem) => isEqual(uniqueItem, item))) {
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
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
