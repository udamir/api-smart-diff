import type { ComapreContext } from "../types"
import { getParentContext } from "../utils"

export const emptySecurity = (value?: unknown) => {
  if (!Array.isArray(value)) { return false }

  return !!value && (value.length === 0 || (value.length === 1 && Object.keys(value[0]).length === 0))
}

export const includeSecurity = (value: unknown = [], items: unknown = []) => {
  if (!Array.isArray(value) || !Array.isArray(items)) { return false }

  // TODO match security schema
  const valueSet = new Set(value.map((item) => Object.keys(item)[0]))

  for (const item of items) {
    if (!valueSet.has(Object.keys(item)[0])) { return false }
  }

  return true
}

export const mapPathParams = ({ before, after }: ComapreContext): Record<string, string> => {
  if (typeof before.path[1] !== "string" || typeof after.path[1] !== "string") { return {} }

  const beforeParams = [...before.path[1].matchAll(new RegExp("\{(.*?)\}", "g"))].map((arr) => arr.pop()) as string[]
  const afterParams = [...after.path[1].matchAll(new RegExp("\{(.*?)\}", "g"))].map((arr) => arr.pop()) as string[]

  const result: Record<string, string> = {}
  for (let i = 0; i < beforeParams.length && i < afterParams.length; i++) {
    result[beforeParams[i]] = afterParams[i]
  }

  return result
} 
