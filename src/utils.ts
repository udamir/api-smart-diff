
export const typeOf = (value: any) => {
  if (Array.isArray(value)) {
    return "array"
  }
  return typeof value == null ? "null" : typeof value
}
