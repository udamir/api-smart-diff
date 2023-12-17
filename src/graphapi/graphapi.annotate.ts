import { CrawlRulesFunc, JsonPath, getNodeRules, syncCrawl } from "json-crawl"

import { ChangeAnnotationResolver, ComapreContext, CompareRules, CompareRulesFunc, Diff } from "../types"
import { createTemplateAnnotation, getParentContext, isObject } from "../utils"
import { getTarget, jsonSchemaAnnotations } from "../jsonSchema"

const graphSchemaArgAnnotations = {
  add: "[Added] {{text}} to Argument {{arg}}",
  add_target: "[Added] {{text}} to Argument `{{target}}`",
  remove: "[Removed] {{text}} from Argument {{arg}}",
  remove_target: "[Removed] {{text}} from Argument `{{target}}`",
  replace: "[Replaced] {{text}} of Argument {{arg}}",
  replace_target: "[Replaced] {{text}} of Argument `{{target}}`",
}

const graphApiAnnotations = {
  operationSchema: "{{schemaChange}} in Request Body content ({{contentType}})",
  operationArgsSchema: "{{schemaChange}} Argument {{arg}} ",
  directiveArgsSchema: "{{schemaChange}} in {{in}} parameter `{{name}}`",
}

// const getArgPath = (path: JsonPath, ctx: ComapreContext): JsonPath | undefined => {
//   let _rules = ctx.options.rules ?? {}
//   let value: any = ctx.before.root
//   const _path: JsonPath = []

//   for (const p of path) {
//     if (p === "args" && "/args" in _rules) {
//       return _path
//     }
//     _rules = getNodeRules(_rules, p, _path, value)!
//     value = value[p]
//     _path.push(p)
//   }
// }  


// export const graphApiSchemaAnnotate = (resolver: ChangeAnnotationResolver, argsSchema = false): ChangeAnnotationResolver => {
//   return (diff: Diff, ctx: ComapreContext): string => {
//     const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? graphApiAnnotations)
//     const dictionary = { ...ctx.options.dictionary }
//     dictionary.jsonSchema = { ...dictionary.jsonSchema ?? jsonSchemaAnnotations, ...graphSchemaArgAnnotations }

//     const argPath = getArgPath(ctx.before.path, ctx)
//     if (argPath) {
//       return resolver(diff, { ...ctx, options: { ...ctx.options, dictionary }})
//       // const arg = getTarget(ctx.before.path.slice(argPath.length))
//       // return t("operationArgsSchema", { schemaChange, arg })
//     } else {
//       return resolver(diff, ctx)
//     }

//     // if (isResponsePath(ctx.before.path)) {
//     //   return t("responseSchema", { schemaChange, responseCode: ctx.before.path[4], contentType: ctx.before.path[6] })
//     // } else if (isRequestBodyPath(ctx.before.path)) {
//     //   return t("requestBodySchema", { schemaChange, contentType: ctx.before.path[5] })
//     // } else if (isParameterPath(ctx.before.path)) {
//     //   const { path, root } = diff.action === "add" ? ctx.after : ctx.before
//     //   const paramPath = path.slice(0, path[2] === "parameters" ? 4 : 5)
//     //   const node = getObjectValue(root, ...paramPath)
//     //   return t("parameterSchema", { ...resolveRef(node, root), schemaChange })
//     // }

//     return ""
//   }
// }
