

// export const mapEnumItemsRule = <T extends Diff>(before: Array<any>, after: Array<any>): MapKeysResult<number> => {

//   const afterEquals = new Set<number>()
//   const beforeEquals = new Set<number>()

//   for (const i of before.keys()) {
//     let afterDiffs: JsonMergeResult<T>[] | JsonMergeResult<T> = []

//     for (const j of after.keys()) {
//       if (afterEquals.has(j)) { continue }
//       const res = jsonMerge<T>(before[i], after[j])
//       if (!res.diffs.length) {
//         afterEquals.add(j)
//         beforeEquals.add(i)
//         afterDiffs = res
//         break
//       }
//       afterDiffs[j] = { value: _merged.value, res, diffs: typeof before[i] === typeof after[j] ? res.diffs.length : -1 }
//     }
//     beforeDiffs.push(afterDiffs)
//   }

//   const length = Math.abs(before.length - after.length)
//   const arr = Array.from({ length: Math.min(before.length, after.length) }, ((_, i) => i))


//   return {
//     added: before.length > after.length ? Array.from({length}, (_, i) => after.length + i) : [],
//     removed: before.length < after.length ? Array.from({length}, (_, i) => before.length + i) : [],
//     mapped: arr.reduce((res, i) => { res[i] = i; return res }, {} as Record<number, number>)
//   }
// }
