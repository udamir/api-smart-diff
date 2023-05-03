import { mergeValues } from "../utils"

export type MergeRule = (prev: any, next: any) => any 

export type MergeRules = {
  [key: `/${string}`]: MergeRule
}

const first: MergeRule = (a) => a
const alternative: MergeRule = (...args) => args.reduce((r, v) =>  r || v, false)
const mergeArray: MergeRule = (...args) => args.reduce((r, v) => r.push(...v), [])
const minValue: MergeRule = (...args) => Math.min(...args)
const maxValue: MergeRule = (...args) => Math.max(...args)
const mergeEnum: MergeRule = (...args) => [...new Set(mergeArray(...args)).values()]
const mergePattern: MergeRule = (...args) => args.reduce((r, v) => `${r}(?=${v})`, '')
const intersect: MergeRule = (...args) => args.slice(1).reduce((r, v) => r.filter((t: string) => v.includes(t)), args[0])

const mergeTypes: MergeRule = (...args) => {
  const arrayTypes = args.map((a) => Array.isArray(a) ? a : [a])
  const types = intersect(...arrayTypes)
    reduce((r, v) => r.filter((t: string) => Array.isArray(v) ? v.includes(t) : t === v ), )
  return types.length === 1 ? types[0] : types.length ? types : undefined
}

const mergeObjects: MergeRule = (a, ...args) => args.reduce((r, v) => mergeValues(r, v), a)

export const jsonSchemaMergeRules = (): MergeRules => ({
  "/title": first,
  "/maximum": minValue,
  "/exclusiveMaximum": alternative,
  "/minimum": maxValue,
  "/exclusiveMinimum": alternative,
  "/maxLength": minValue,
  "/minLength": maxValue,
  "/maxItems": minValue,
  "/minItems": maxValue,
  "/uniqueItems": alternative,
  "/maxProperties": minValue,
  "/minProperties": maxValue,
  "/required": mergeEnum,
  "/enum": mergeEnum,
  "/type": mergeTypes,
  "/not": mergeArray,
  "/oneOf": mergeArray,
  "/anyOf": mergeArray,
  "/items": () => jsonSchemaMergeRules(),
  "/properties": () => jsonSchemaMergeRules(),
  "/additionalProperties": () => jsonSchemaMergeRules(),
  "/description": first,
  "/format": first,
  "/pattern": mergePattern,
  "/default": first,
  "/nullable": alternative,
  "/discriminator": mergeObjects,
  "/readOnly": alternative,
  "/writeOnly": alternative,
  "/example": mergeObjects,
  "/examples": mergeObjects,
  "/externalDocs": first,
  "/deprecated": alternative,
  "/xml": mergeObjects,
})
