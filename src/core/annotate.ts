import { isExist, isObject, objectKeys } from "../utils"
import type { AnnotateTemplate } from "../types"

export const annotationTemplate = (template: string, params?: AnnotateTemplate["params"]): AnnotateTemplate => ({ 
  template,
  ...params ? { params } : {} 
})

export const createAnnotation = (annotationTemplate?: AnnotateTemplate, dict: Record<string, string> = {}): string => {
  const findTemplate = (key: string, params: AnnotateTemplate["params"]) => {

    const keys = objectKeys(dict).filter((k) => k.startsWith(`${key}_`))
    
    let result = key in dict ? dict[key] : undefined
    let matchCount = 1

    for (const _key of keys) {
      const _params = _key.split("_").slice(1)
      // find params
      if (!_params.filter((p) => !isExist(params![p]) || params![p] === "").length && _params.length >= matchCount) {
        result = dict[_key]
        matchCount = _params.length
      }
    }
    
    return result
  }

  const applyTemplateParams = (name: string = "", _params: AnnotateTemplate["params"] = {}) => {
    const params: Record<string, string | number | undefined> = {}

    for (const key of objectKeys(_params)) {
      const param = _params[key]
      params[key] = isObject(param) ? createAnnotation(param as AnnotateTemplate, dict) : param as string
    }

    let template = findTemplate(name, params)
    if (!template) { return "" }
    
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
