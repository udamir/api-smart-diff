import { isObject } from "../utils"

export const getAsyncApiVersion = (before: unknown, after: unknown) => {
  if (
    !isObject(before) ||
    !isObject(after) ||
    !("asyncapi" in before) ||
    !("asyncapi" in after)
  ) {
    return
  }

  const bMajorVersion = String(before.asyncapi).charAt(0)
  const aMajorVersion = String(after.asyncapi).charAt(0)

  if (bMajorVersion === aMajorVersion) {
    return `${bMajorVersion}.x`
  }

  return ""
}
