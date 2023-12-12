import { isParameterPath, isRequestBodyPath, isResponsePath } from "./openapi3.utils"
import type { ChangeAnnotationResolver, ComapreContext, Diff } from "../types"
import { getKeyValue } from "../utils"

export const openApiAnnotations = {
  requestBodySchemaChange: (schemaChange: string, type: string) => `${schemaChange} in Request body content (${type})`,
  responseSchemaChange: (schemaChange: string, code: string, type: string) => `${schemaChange} in Response ${code} content (${type})`,
  parameterSchemaChange: (schemaChange: string, type: string, name: string) => `${schemaChange} in ${type} parameter ${name}`
}

export const openApiKeyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const key = diff.path[diff.path.length-1]
  switch (key) {

  }
  return ""
}

export const openApiParentKeyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const key = diff.path[diff.path.length-1]
  switch (key) {

  }
  return ""
}

export const openApiSchemaAnnotate = (resolver: ChangeAnnotationResolver): ChangeAnnotationResolver => {
  return (diff: Diff, ctx: ComapreContext): string => {
    const description = resolver(diff, ctx) 
    if (!description) { return "" }

    if (isResponsePath(ctx.before.path)) {
      const responseCode = String(ctx.before.path[5])
      const responseType = String(ctx.before.path[6])
      return openApiAnnotations.responseSchemaChange(description, responseCode, responseType)
    } else if (isRequestBodyPath(ctx.before.path)) {
      const responseType = String(ctx.before.path[5])
      return openApiAnnotations.requestBodySchemaChange(description, responseType)
    } else if (isParameterPath(ctx.before.path)) {
      const diffContext = diff.action === "add" ? ctx.after : ctx.before
      const _path = diffContext.path.slice(0, diffContext.path[2] === "parameters" ? 3 : 4)
      const parameterType = getKeyValue(diffContext.root, ..._path, "in") as string
      const parameterName = getKeyValue(diffContext.root, ..._path, "name") as string
      return openApiAnnotations.parameterSchemaChange(description, parameterType, parameterName)
    }

    return ""
  }
}

