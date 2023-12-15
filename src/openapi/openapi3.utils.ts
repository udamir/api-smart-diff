import { JsonPath, isObject } from "json-crawl"

import type { ComapreContext } from "../types"

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

export const getDefaultStyle = (type: unknown) => {
  switch (type) {
    case "query": return "form"
    case "cookie": return "form"
    case "path": return "simple"
    case "header": return "simple"
  }
}

export const isResponsePath = (path: JsonPath) => {
  return path[3] === "responses"
}

export const isRequestBodyPath = (path: JsonPath) => {
  return path[3] === "requestBody"
}

export const isParameterPath = (path: JsonPath) => {
  return path[2] === "parameters" || path[3] === "parameters"
}

export const getMaxOpenApiVersion = (before: unknown, after: unknown) => {
  if (!isObject(before) || !isObject(after) || !("openapi" in before) || !("openapi" in after)) { return }

  const version = before.openapi > after.openapi ? before.openapi : after.openapi

  return version.startsWith("3.1") ? "3.1.x" : "3.0.x"
}
