import { mergeValues } from "../../../utils"

export type MergeFunc = (...args: any[]) => any 
export type MergeRulesFunc = () => MergeRules 
export type MergeRule = {
  "$": MergeFunc
}

export type MergeRules = {
  [key: `/${string}` | "/"]: MergeRules | MergeRulesFunc | MergeRule
}

const getMergeFunc = (key: string) => {
  const rules = jsonSchemaMergeRules

  if (!(`/${key}` in rules)) {
    key = "*"
  }
 
  const rule = rules[`/${key}`]
  return "$" in rule ? rule["$"] : undefined
}

export const mergeJsonSchema = (...args: any[]) => {
  const keys: Record<string, any[]> = {}
  const result: Record<string, any> = {}

  for (const obj of args) {
    const props = Object.keys(obj)
    for (const prop of props) {
      if (Array.isArray(keys[prop])) {
        keys[prop].push(obj[prop])
      } else {
        keys[prop] = [obj[prop]]
      }
    }
  }

  for (const [key, value] of Object.entries(keys)) {
    const mergeFunc = getMergeFunc(key)

    if (!mergeFunc) {
      throw new Error(`Merge rule not found for key: ${key}`)
    }
    result[key] = mergeFunc(...value)
  }

  return result
}

const first: MergeFunc = (a) => a
const alternative: MergeFunc = (...args) => args.reduce((r, v) =>  r || v, false)
const mergeArray: MergeFunc = (...args) => args.reduce((r, v) => r.push(...v), [])
const minValue: MergeFunc = (...args) => Math.min(...args)
const maxValue: MergeFunc = (...args) => Math.max(...args)
const mergeEnum: MergeFunc = (...args) => [...new Set(mergeArray(...args)).values()]
const mergePattern: MergeFunc = (...args) => args.reduce((r, v) => `${r}(?=${v})`, '')
const intersect: MergeFunc = (a, ...args) => args.reduce((r, v) => r.filter((t: string) => v.includes(t)), a)

const mergeTypes: MergeFunc = (...args) => {
  const arrayTypes = args.map((a) => Array.isArray(a) ? a : [a])
  const types = intersect(...arrayTypes)
  return types.length === 1 ? types[0] : types.length ? types : undefined
}

const mergeObjects: MergeFunc = (a, ...args) => args.reduce((r, v) => mergeValues(r, v), a)

const mergeProperties: MergeFunc = (...args) => {
  const props: Record<string, any[]> = {}
  const result: Record<string, any> = {}

  for (const obj of args) {
    for (const prop of Object.keys(obj)) {
      if (Array.isArray(props[prop])) {
        props[prop].push(obj[prop])
      } else {
        props[prop] = [obj[prop]]
      }
    }
  }

  for (const [prop, items] of Object.entries(props)) {
    result[prop] = items.length > 1 ? { allOf: items } : items[0]
  }

  return result
}

export const jsonSchemaMergeRules: MergeRules = {
  "/title": { $: first },
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
  "/required": { $: mergeEnum },
  "/enum": { $: mergeEnum },
  "/type": { $: mergeTypes },
  "/allOf": {
    $: mergeArray,
    "/*": () => jsonSchemaMergeRules
  },
  "/not": {
    $: mergeArray,
    "/*": () => jsonSchemaMergeRules
  },
  "/oneOf": {
    $: mergeArray,
    "/*": () => jsonSchemaMergeRules
  },
  "/anyOf": {
    $: mergeArray,
    "/*": () => jsonSchemaMergeRules
  },
  "/items": {
    $: mergeJsonSchema,
    "/": () => jsonSchemaMergeRules
  },
  "/properties": {
    $: mergeProperties,
    "/*": () => jsonSchemaMergeRules
  },
  "/additionalProperties": {
   $: mergeJsonSchema,
   "/*": () => jsonSchemaMergeRules
  },
  "/description": { $: first },
  "/format": { $: first },
  "/pattern": { $: mergePattern },
  "/default": { $: first },
  "/nullable": { $: alternative },
  "/discriminator": { $: mergeObjects },
  "/readOnly": { $: alternative },
  "/writeOnly": { $: alternative },
  "/example": { $: mergeObjects },
  "/examples": { $: mergeObjects },
  "/externalDocs": { $: first },
  "/deprecated": { $: alternative },
  "/xml": { $: mergeObjects },
  "/*": { $: first },
}
