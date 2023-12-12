import { compareTransformationFactory, isKey, objectKeys } from "../utils"
import { getDefaultStyle } from "./openapi3.utils"

export const transformPathItems = compareTransformationFactory((value) => {
  if (typeof value !== 'object' || !value) { return value }
  
  const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']
  
  const _value = objectKeys(value).reduce((res, key) => {
    if (methods.includes(key)) { return res }
    res[key] = value[key]
    return res
  }, {} as any)

  if (!objectKeys(_value).length) {
    return value
  }

  const result: Record<string, any> = {}

  for (const method of methods) {
    if (!isKey(value, method) || typeof value[method] !== 'object' || !value[method]) { continue }
    const data = {...value[method] as any}

    const { parameters, servers, ...rest } = _value

    // copy path parameters to all methods
    if (parameters && Array.isArray(parameters)) {
      if ('parameters' in data && Array.isArray(data.parameters)) {
        data.parameters = [...data.parameters, ...parameters]
      } else {
        data.parameters = parameters
      }
    }
    
    // copy servers to all methods
    if (servers && Array.isArray(servers)) {
      if ('servers' in data && Array.isArray(data.servers)) {
        data.servers = [...data.servers, ...servers]
      } else {
        data.servers = servers
      }
    }

    // copy summary/description and rest to all methods
    for (const key of objectKeys(rest)) {
      if (isKey(data, key)) { continue }
      data[key] = rest[key]
    }

    result[method] = data
  }
  
  return result
})

export const transformParameterItems = compareTransformationFactory((value, other) => {
  if (typeof value !== 'object' || !value || typeof other !== 'object' || !other) { return value }
  
  const result: any = { ...value }

  if (("in" in value) && !("style" in value) && ("style" in other)) {
    const style = getDefaultStyle(value.in)
    if (style) {
      result.style = style
    }
  }

  if (("style" in result) && ("explode" in value) && ("explode" in other)) {
    if (result.style === "form") {
      result.explode = true
    }
  }
  
  return result
})
