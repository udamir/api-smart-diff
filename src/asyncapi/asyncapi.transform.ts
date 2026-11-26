import type { CompareTransformResolver } from "../types"
import { isPlainObject } from "../utils"

const hasOneOf = (value: unknown) => isPlainObject(value) && Array.isArray(value.oneOf)

/**
 * 2.x operation `message`: a single message on one side and `oneOf` alternatives on the other are compared as
 * alternatives, so the single message is matched with the alternative it became (ISSUE-113).
 */
export const transformMessageOneOf: CompareTransformResolver = (before, after) => {
  if (before === undefined || after === undefined) {
    return [before, after]
  }
  const bOneOf = hasOneOf(before)
  const aOneOf = hasOneOf(after)
  if (bOneOf === aOneOf || !isPlainObject(before) || !isPlainObject(after)) {
    return [before, after]
  }
  return bOneOf ? [before, { oneOf: [after] }] : [{ oneOf: [before] }, after]
}
