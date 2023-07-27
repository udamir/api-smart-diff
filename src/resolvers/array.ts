import { MapKeysResult } from "../rules/types";

export const mapArraysKeysRule = (before: Array<any>, after: Array<any>): MapKeysResult<number> => {
  const length = Math.abs(before.length - after.length)
  const arr = Array.from({ length: Math.min(before.length, after.length) }, ((_, i) => i))
  return {
    value: before.slice(0, arr.length),
    removed: before.length > after.length ? Array.from({length}, (_, i) => after.length + i) : [],
    added: before.length < after.length ? Array.from({length}, (_, i) => before.length + i) : [],
    mapped: arr.reduce((res, i) => { res[i] = i; return res }, {} as Record<number, number>)
  }
}
