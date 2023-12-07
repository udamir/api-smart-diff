import type { ClassifyRule, DiffType, DiffTypeClassifier } from "../types"
import { breaking, nonBreaking } from "../constants"
import { isExist, getParentContext } from "../utils"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)
export const breakingIfAfterTrue: DiffTypeClassifier = ({ after }): DiffType => breakingIf(!!after.value)

export const maxClassifier: ClassifyRule = [
  breaking, 
  nonBreaking, 
  ({ before, after }) => breakingIf(before.value > after.value)
]

export const minClassifier: ClassifyRule = [
  breaking,
  nonBreaking,
  ({ before, after }) => breakingIf(before.value < after.value)
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
  ({ before, after }) => breakingIf(!!(before.value % after.value))
]

export const requiredItemClassifyRule: ClassifyRule = [
  ({ after }) => isExist(getParentContext(after, "", "properties", after.value, "default")?.value) ? nonBreaking : breaking,
  nonBreaking, 
  ({ after }) => isExist(getParentContext(after, "", "properties", after.value, "default")?.value) ? nonBreaking : breaking
]
