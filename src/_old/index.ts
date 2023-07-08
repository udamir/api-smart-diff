import { ApiCompare } from "./apiCompare"

export * from "./rules/index"
export * from "./types"
export * from "./constants"
export * from "./utils"

export * from "./changeDoc"
export * from "./changeDoc/rules"

export { ApiCompare } from "./apiCompare"
export { JsonCompare } from "./jsonCompare"

export const apiDiff = ApiCompare.apiDiff
export const apiMerge = ApiCompare.apiMerge
export const apiDiffTree = ApiCompare.apiDiffTree
