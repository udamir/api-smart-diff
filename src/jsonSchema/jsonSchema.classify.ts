import { isExist, getParentContext, isString, isNumber, isFunc } from "../utils"
import type { ClassifyRule, DiffType, DiffTypeClassifier } from "../types"
import { breaking, nonBreaking, unclassified } from "../constants"
import { isValidSchemaTypes } from "./jsonSchema.utils"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue: DiffTypeClassifier = ({ after }): DiffType => breakingIf(!!after.value)

export const typeClassifier = (types: string[] | string, base: ClassifyRule): ClassifyRule => {
  const _types = Array.isArray(types) ? types : [types]
  if (_types.includes("number")) {
    _types.push("integer")
  }
  return [
    (ctx) => isValidSchemaTypes(_types, ctx.after.parent) ? (isFunc(base[0]) ? base[0](ctx) : base[0]) : unclassified,
    (ctx) => isValidSchemaTypes(_types,ctx.before.parent) ? (isFunc(base[1]) ? base[1](ctx) : base[1]) : unclassified,
    (ctx) => isValidSchemaTypes(_types,ctx.after.parent) ? (isFunc(base[2]) ? base[2](ctx) : base[2]) : unclassified,
  ]
}

export const maxClassifier: ClassifyRule = [
  breaking, 
  nonBreaking, 
  ({ before, after }) => breakingIf(!isNumber(before.value) || !isNumber(after.value) || before.value > after.value)
]

export const minClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(!isNumber(before.value) || !isNumber(after.value) || before.value < after.value)
]

export const exclusiveClassifier: ClassifyRule = [
  breakingIfAfterTrue, 
  nonBreaking, 
  breakingIfAfterTrue
]

export const booleanClassifier: ClassifyRule = [
  breakingIfAfterTrue,
  nonBreaking,
  breakingIfAfterTrue
]

export const multipleOfClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(!!(!isNumber(before.value) || !isNumber(after.value) || before.value % after.value))
]

export const requiredItemClassifyRule: ClassifyRule = [
  ({ after }) => !isString(after.value) || isExist(getParentContext(after, "", "properties", after.value, "default")?.value) ? nonBreaking : breaking,
  nonBreaking, 
  ({ after }) => !isString(after.value) || isExist(getParentContext(after, "", "properties", after.value, "default")?.value) ? nonBreaking : breaking
]
