import { MappingResolver } from "../../types"

export const arrayMappingResolver: MappingResolver<number> = (before, after) => {
  const length = Math.abs(before.length - after.length)
  const arr = Array.from({ length: Math.min(before.length, after.length) }, ((_, i) => i))
  return {
    removed: before.length > after.length ? Array.from({length}, (_, i) => after.length + i) : [],
    added: before.length < after.length ? Array.from({length}, (_, i) => before.length + i) : [],
    mapped: arr.reduce((res, i) => { res[i] = i; return res }, {} as Record<number, number>)
  }
}
