import { ApiDiff } from "./apiDiff"

export * from "./rules/index"
export * from "./types"
export * from "./constants"
export * from "./utils"
export { ApiDiff } from "./apiDiff"

export const apiDiff = ApiDiff.apiDiff
export const apiMerge = ApiDiff.apiMerge
export const apiDiffTree = ApiDiff.apiDiffTree