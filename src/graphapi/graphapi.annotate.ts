import { ChangeAnnotationResolver, ComapreContext, Diff } from "../types"
import { createTemplateFunc } from "../utils"

const graphApiAnnotations = {
  operationSchema: "{{schemaChange}} in Request Body content ({{contentType}})",
  operationArgsSchema: "{{schemaChange}} in Response {{responseCode}} content ({{contentType}})",
  directiveArgsSchema: "{{schemaChange}} in {{in}} parameter `{{name}}`",
}

export const graphApiSchemaAnnotate = (resolver: ChangeAnnotationResolver, argsSchema = false): ChangeAnnotationResolver => {
  return (diff: Diff, ctx: ComapreContext): string => {
    const t = createTemplateFunc(ctx.options.dictionary?.openapi ?? graphApiAnnotations)
    const schemaChange = resolver(diff, ctx) 
    if (!schemaChange) { return "" }

    // if (isResponsePath(ctx.before.path)) {
    //   return t("responseSchema", { schemaChange, responseCode: ctx.before.path[4], contentType: ctx.before.path[6] })
    // } else if (isRequestBodyPath(ctx.before.path)) {
    //   return t("requestBodySchema", { schemaChange, contentType: ctx.before.path[5] })
    // } else if (isParameterPath(ctx.before.path)) {
    //   const { path, root } = diff.action === "add" ? ctx.after : ctx.before
    //   const paramPath = path.slice(0, path[2] === "parameters" ? 4 : 5)
    //   const node = getObjectValue(root, ...paramPath)
    //   return t("parameterSchema", { ...resolveRef(node, root), schemaChange })
    // }

    return schemaChange
  }
}
