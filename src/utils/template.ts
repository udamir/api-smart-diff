import type { AnnotateTemplate } from "../types"
import { isExist, isObject, objectKeys } from "../utils"

export const annotationTemplate = (template: string, params?: AnnotateTemplate["params"]): AnnotateTemplate => ({ 
  template,
  ...params ? { params } : {} 
})

export const createTemplateAnnotation = (dict: Record<string, string>, annotationTemplate?: AnnotateTemplate): string => {
  const findTemplate = (key: string, params: AnnotateTemplate["params"] = {}) => {

    const keys = objectKeys(dict).filter((k) => k.startsWith(`${key}_`))
    
    for (const _key of keys) {
      const _params = _key.split("_").slice(1)
      // find params
      if (!_params.filter((p) => !isExist(params[p]) || params[p] === "").length) {
        return dict[_key]
      }
    }
    
    if (key in dict) {
      return dict[key]
    }
  }

  const applyTemplateParams = (name: string = "", _params: AnnotateTemplate["params"] = {}) => {
    let template = findTemplate(name, _params)
    if (!template) { return "" }

    const params: Record<string, string | number | undefined> = {}

    for (const key of objectKeys(_params)) {
      const param = _params[key]
      params[key] = isObject(param) ? createTemplateAnnotation(dict, param as AnnotateTemplate) : param as string
    }
    
    for (const match of [...template.matchAll(/{{(\w+)}}/g)].reverse()) {
      if (!(match[1] in params)) { continue }

      const index = match.index ?? 0
      template = template.substring(0, index) + String(params[match[1]]) + template.substring(index + match[0].length)
    }
    return template
  }

  if (!annotationTemplate) { return "" }

  const { template, params } = annotationTemplate
  
  return applyTemplateParams(template, params)
}
