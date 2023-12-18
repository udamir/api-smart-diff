import { getParentContext, breaking, nonBreaking, unclassified } from "../core"
import { isExist, isString, isNumber, transformClassifyRule } from "../utils"
import type { ClassifyRule, DiffType, DiffTypeClassifier } from "../types"
import { isValidSchemaTypes } from "./jsonSchema.utils"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue: DiffTypeClassifier = ({ after }): DiffType => breakingIf(!!after.value)

export const typeClassifier = (types: string[] | string, base: ClassifyRule): ClassifyRule => {
  const _types = Array.isArray(types) ? types : [types]
  if (_types.includes("number")) {
    _types.push("integer")
  }

  return transformClassifyRule(base, (diffType, { before, after }, action) => {
    return isValidSchemaTypes(_types, action === "remove" ? before.parent : after.parent) ? diffType : unclassified
  })
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
