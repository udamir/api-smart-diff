// export interface CrawlMapContext {
//   index: number
//   path: JsonPath
//   source: any
// }





// export type JsonPath = Array<string | number>

// export type CrawlMapRulesFunc<T> = (ctx: CrawlMapContext) => CrawlMapRules<T>

// export type CrawlMapRules<T = {}> = {
//   [key: `/${string}`]: CrawlMapRules<T> | CrawlMapRulesFunc<T>
// } & T

// export const findPathRules = <T>(
//   rules: CrawlMapRules<T>,
//   path: JsonPath,
//   source: any
// ): CrawlMapRules<T> | T | undefined => {
//   let _rules = rules
//   for (let index = 0; index < path.length; index++) {
//     let key = path[index]
  
//     if (index === path.length) {
//       key = ""
//     } else if (!(`/${key}` in rules) || typeof key === "number") {
//       key = "*"
//     }
  
//     if (`/${key}` in rules) {
//       const rule = rules[`/${key}`] as any

//       _rules = typeof rule === "function" ? rule({ source, index, path }) : rule
//     } else {
//       return
//     }

//     if (!_rules) {
//       return
//     }
//   }

//   return _rules
// }
