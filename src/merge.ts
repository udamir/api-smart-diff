import { CompareContext, MergeContext, MergeResult } from "./context"
import { dereference } from "./dereference"
import { classifyDiff } from "./classifier"
import { DiffAction } from "./constants"
import { enumDiff } from "./diff"
import { typeOf } from "./utils"
import { 
  ObjPath, MergedArrayMeta, MergedKeyMeta,
  MergeOptions
} from "./types"
import { compare } from "./compare"

export const apiMerge = (before: any, after: any, options: MergeOptions): any => {
  const result = compare<MergeResult>(before, after, new MergeContext(before, after, options))
  return result.merged
}

// const mergeChanges = (before: any, after: any, ctx: MergeContext, path: ObjPath = []): MergeResult => {
//   if (typeOf(before) !== typeOf(after)) {
//     const diff = { path, before, after, action: DiffAction.replace }
//     return [ after, ctx.formatMeta(classifyDiff(diff, ctx.rules)) ]
//   }

//   switch (typeOf(before)) {
//     case "object":
//       return mergeObjects(before, after, ctx, path)
//     case "array":
//       return mergeArrays(before, after, ctx, path)
//     default:
//       if (typeof before === "string") {
//         before = normalizeString(before, ctx)
//         after = normalizeString(after, ctx)
//       }
//       if (before !== after) {
//         const diff = { path, before, after, action: DiffAction.replace }
//         return [ after, ctx.formatMeta(classifyDiff(diff, ctx.rules)) ]
//       } 
//   }
//   return [ after ]
// }

// const normalizeString = (value: string, ctx: CompareContext) => {
//   value = ctx.trimStrings ? value.trim() : value
//   value = ctx.caseSensitive ? value : value.toLowerCase()
//   return value
// }

// const mergeObjects = (before: any, after: any, ctx: MergeContext, path: ObjPath): MergeResult => {
//   const merged: any = {}
//   const meta: any = {}

//   const _before = dereference(before, ctx.before, ctx.beforeRefs, ctx.beforeCache)
//   const _after = dereference(after, ctx.after, ctx.afterRefs, ctx.afterCache)

//   const keys = new Set([...Object.keys(_before), ...Object.keys(_after)])

//   for (const key of keys) {
//     // skip symbol key
//     if (typeof key === "symbol") {
//       continue
//     }

//     if (!_before.hasOwnProperty(key)) {
//       // added key
//       const diff = { path: [...path, key], after: _after[key], action: DiffAction.add }
//       merged[key] = _after[key]
//       meta[key] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
//     } else if (!_after.hasOwnProperty(key)) {
//       // deleted key
//       const diff = { path: [...path, key], before: _before[key], action: DiffAction.remove }
//       merged[key] = _before[key]
//       meta[key] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
//     } else {
//       // updated value
//       const [ value, m ] = mergeChanges(_before[key], _after[key], ctx, [...path, key])
//       merged[key] = value
//       if (m) {
//         meta[key] = m
//       }
//     }
//   }

//   // remove refs
//   before.$ref && ctx.beforeRefs.delete(before.$ref)
//   after.$ref && ctx.afterRefs.delete(after.$ref)

//   if (Object.keys(meta).length) {
//     merged[ctx.metaKey] = meta
//   }

//   return [ merged ]
// }

// // const mergeByDiff = (before: any, path: DiffPath, diff: Diff, ctx: DiffContext) => {
// //   const arrPath = diff.path.slice(path.length)
// //   const _path = buildPath(arrPath)
// //   const value = resolveObjValue(before, _path, ctx.beforeCache)

 
// // }

// const mergeArrays = (before: any[], after: any[], ctx: MergeContext, path: ObjPath): MergeResult => {
//   const arrMeta: { [i: number]: MergedKeyMeta | MergedArrayMeta } = {}

//   const array: any[] = []
//   const _after = [...after]

//   if (ctx.strictArrays) {
//     for (let i = 0; i < before.length; i++) {
//       if (i >= after.length) {
//         const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
//         array[i] = before[i]
//         arrMeta[i] = ctx.formatMeta((classifyDiff(diff, ctx.rules)))
//       } else {
//         const [value, m] = mergeChanges(before[i], after[i], ctx, [...path, i])
//         array[i] = value
//         if (m) {
//           arrMeta[i] = m
//         } 
//       }
//     }
//   } else {
//     const itemsDiff = enumDiff(before, after, ctx, path)
//     for (let i = 0; i < before.length; i++) {
//       array[i] = before[i]
//       if (itemsDiff.unchanged.includes(i)) {
//       } else if (itemsDiff.removed.includes(i)) {
//         const diff = { path: [...path, i], before: before[i], action: DiffAction.remove }
//         arrMeta[i] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
//       } else if (itemsDiff.changed[i]) {
//         const { afterIndex } = itemsDiff.changed[i]
//         const [value, m] = mergeChanges(before[i], after[afterIndex], ctx, [...path, i])
//         array[i] = value
//         if (m) {
//           arrMeta[i] = m
//         } 
//         // TODO: [optimization] generate merged array item from before and diffs
//         // const { diffs } = itemsDiff.changed[i]
//         // apply diffs to array[i]
//         // for (let diff of diffs) {
//         //   mergeByDiff(array[i], [...path, i], diff)
//         // }
//       }
//     }
//     for (const j of itemsDiff.added) {
//       array.push(after[j])
//       const diff = { path: [...path, j], after: after[j], action: DiffAction.add }
//       arrMeta[j] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
//     }
//   }

//   if (ctx.strictArrays) {
//     _after.splice(0, before.length)
//     for (let j = before.length, i = 0; j < before.length + _after.length; j++, i++) {
//       array[j] = _after[i]
//       const diff = { path: [...path, j], after: _after[i], action: DiffAction.add }
//       arrMeta[j] = ctx.formatMeta(classifyDiff(diff, ctx.rules))
//     }
//   }

//   if (ctx.arrayMeta && Object.keys(arrMeta).length) {
//     (array as any)[ctx.metaKey] = arrMeta
//   }
  
//   if (ctx.arrayMeta || !Object.keys(arrMeta).length) {
//     return [array]
//   } else {
//     return [array, { array: arrMeta }]
//   }
// }
