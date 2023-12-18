import { getParentContext, annotation, breaking, nonBreaking, unclassified } from "../core"
import { getKeyValue, isNotEmptyArray, isExist } from "../utils"
import { emptySecurity, includeSecurity } from "./openapi3.utils"
import { breakingIfAfterTrue } from "../jsonSchema"
import type { ClassifyRule } from "../types"

export const parameterStyleClassifyRule: ClassifyRule = [
  ({ after }) => after.value === "form" ? annotation : breaking, 
  ({ before }) => before.value === "form" ? annotation : breaking,
  breaking
]

export const parameterExplodeClassifyRule: ClassifyRule = [
  ({ after }) => (after.value && getKeyValue(after.parent, "style") === "form") || (!after.value && getKeyValue(after.parent, "style") !== "form") ? annotation : breaking, 
  ({ before }) => (before.value && getKeyValue(before.parent, "style") === "form") || (!before.value && getKeyValue(before.parent, "style") !== "form") ? annotation : breaking,
  breaking
]

export const parameterNameClassifyRule: ClassifyRule = [
  nonBreaking, 
  breaking, 
  ({ before }) => getKeyValue(before.parent, "in") === "path" ? nonBreaking : breaking 
]

export const parameterRequiredClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking,
  (ctx) => getKeyValue(ctx.after.parent, "schema", "default") ? nonBreaking : breakingIfAfterTrue(ctx)
]

export const paramSchemaTypeClassifyRule: ClassifyRule = [
  breaking,
  nonBreaking, 
  ({ before, after }) => {
    const paramContext = getParentContext(before, "")
    const paramStyle = getKeyValue(paramContext?.value, "style") ?? "form"
    if (getKeyValue(paramContext?.value, "in") === "query" && paramStyle === "form") {
      return before.value === "object" || before.value === "array" || after.value === "object" ? breaking : nonBreaking
    }
    return breaking
  }
]

export const paramClassifyRule: ClassifyRule = [
  ({ after }) => getKeyValue(after.value, "required") && !isExist(getKeyValue(after.value, "schema", "default")) ? breaking : nonBreaking,
  breaking,
  unclassified
]

export const globalSecurityClassifyRule: ClassifyRule = [
  ({ after }) => !emptySecurity(after.value) ? breaking : nonBreaking, 
  nonBreaking, 
  ({ after, before }) => includeSecurity(after.value, before.value) || emptySecurity(after.value) ? nonBreaking : breaking
]

export const globalSecurityItemClassifyRule: ClassifyRule = [
  ({ before }) => isNotEmptyArray(before.parent) ? nonBreaking : breaking, 
  ({ after }) => isNotEmptyArray(after.parent) ? nonBreaking : breaking, 
  ({ after, before }) => includeSecurity(after.parent, before.parent) || emptySecurity(after.value) ? nonBreaking : breaking
]

export const operationSecurityClassifyRule: ClassifyRule = [
  ({ before, after }) => emptySecurity(after.value) || includeSecurity(after.value, getKeyValue(before.root, "security")) ? nonBreaking : breaking, 
  ({ before, after }) => includeSecurity(getKeyValue(after.root, "security"), before.value) ? nonBreaking : breaking,
  ({ before, after }) => includeSecurity(after.value, before.value) || emptySecurity(after.value) ? nonBreaking : breaking
]

export const operationSecurityItemClassifyRule: ClassifyRule = [
  ({ before }) => isNotEmptyArray(before.parent) ? nonBreaking : breaking, 
  ({ after }) => isNotEmptyArray(after.parent) ? breaking : nonBreaking, 
  ({ before, after }) => includeSecurity(after.parent, before.parent) || emptySecurity(after.value) ? nonBreaking : breaking
]