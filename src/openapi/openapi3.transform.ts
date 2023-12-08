import { compareTransformationFactory, isKey, objectKeys } from "../utils"

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
