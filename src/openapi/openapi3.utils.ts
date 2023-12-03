
export const emptySecurity = (value?: Array<any>) => {
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
