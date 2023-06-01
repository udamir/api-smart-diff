
const getMergeFunc = (key: string) => {
  return (...args: any[]) => {}
}

export const mergeJsonSchemas = (...args: any[]) => {
  const keys: Record<string, any[]> = {}
  const result: Record<string, any> = {}

  for (const obj of args) {
    const props = Object.keys(obj)
    for (const prop of props) {
      if (Array.isArray(keys[prop])) {
        keys[prop].push(obj[prop])
      } else {
        keys[prop] = [obj[prop]]
      }
    }
  }

  for (const [key, value] of Object.entries(keys)) {
    const mergeFunc = getMergeFunc(key)
    result[key] = mergeFunc(value)
  }

  return result
}