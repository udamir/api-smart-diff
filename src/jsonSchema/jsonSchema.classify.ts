import type { ClassifyRule, DiffType, DiffTypeClassifier } from "../types"
import { isExist, getParentContext, isString, isNumber } from "../utils"
import { breaking, nonBreaking } from "../constants"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue: DiffTypeClassifier = ({ after }): DiffType => breakingIf(!!after.value)

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
