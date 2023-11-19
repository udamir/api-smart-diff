import { ChangeAnnotationResolver } from "../types"

export const annotationChange: ChangeAnnotationResolver = (diff, ctx) => {
  return ""
}

export const validationChange: ChangeAnnotationResolver = (diff, ctx) => {
  return ""
}

export const statusChange: ChangeAnnotationResolver = (diff, ctx) => {
  return ""
}

export const customChangeAnnotation = (text: string): ChangeAnnotationResolver => {
  return (diff, ctx) => {
    return ""
  }
}



// const actions: Record<string, "[Added]" | "[Deleted]" | "[Changed]"> = {
//   "add": "[Added]",
//   "replace": "[Changed]",
//   "remove": "[Deleted]"
// }

// const targetProperty = (path: JsonPath, from: number, prefix = ""): string => {
//   if (from >= path.length) { return prefix }
//   if (path[from] === "properties" && from < path.length) {
//     prefix += prefix ? "." + String(path[from+1]) : String(path[from+1]) 
//     return targetProperty(path, from + 2, prefix)
//   } else if (path[from] === "items") {
//     prefix += "[]"
//   }
//   return targetProperty(path, from + 1, prefix) 
// }

// const mark = (text: string | number): string => "`" + text + "`"

// const validatorRule = (location: string, index: number): ChangeDocResolver => ({ action, key, path }) => {
//   let target = targetProperty(path, index)
//   return `${actions[action]} ${key} validator ${target ? "for " + target : ""} in ${location}`
// }

// const propertyList = (node: any, path: JsonPath, index: number) => {
//   return Object.keys(node || {}).map((prop) => mark(targetProperty([...path, prop], index))).join(", ")
// }

// const requiredList = (required: string[], path: JsonPath, index: number) => {
//   return (required.length > 1 ? "properties " : "property ") + required.map((prop) => mark(targetProperty([...path, "properties", prop], index))).join(", ")
// }

// const propertyRule = (target: string, location: string, index: number): ChangeDocResolver => ({ action, path }) => 
//   `${actions[action]} ${target}property ${mark(targetProperty(path, index))} in ${location}`


// const operationMethods = (node: any) => {
//   const methods = Object.keys(node).filter(key => ["get", "post", "put", "head", "delete", "patch", "connect", "trace", "options"].includes(key.toLocaleLowerCase())).map(mark)
//   return (methods.length > 1 ? "methods " : "method ") + methods.join(", ")
// }

// const changeSchemaRules = (location: string, index: number): ChangeDocRules => ({
//   // property
//   "%": propertyRule("", location, index),
//   // validators
//   "/multipleOf": { "%": validatorRule(location, index) },
//   "/maximum": { "%": validatorRule(location, index) },
//   "/exclusiveMaximum": { "%": validatorRule(location, index) },
//   "/minimum": { "%": validatorRule(location, index) },
//   "/exclusiveMinimum": { "%": validatorRule(location, index) },
//   "/maxLength": { "%": validatorRule(location, index) },
//   "/minLength": { "%": validatorRule(location, index) },
//   "/pattern": { "%": validatorRule(location, index) },
//   "/maxItems": { "%": validatorRule(location, index) },
//   "/minItems": { "%": validatorRule(location, index) },
//   "/uniqueItems": { "%": validatorRule(location, index) },
//   "/maxProperties": { "%": validatorRule(location, index) },
//   "/minProperties": { "%": validatorRule(location, index) },
//   // items
//   "/items": () => changeSchemaRules(location, index),
//   // properties
//   "/properties": {
//     "%": ({ action, path, node }) => `${actions[action]} properties ${propertyList(node, path, index)} in ${location}`,
//     "/*": () => changeSchemaRules(location, index)
//   },
//   // type
//   "/type": { "%": propertyRule("Type of ", location, index) },
//   // required
//   "/required": {
//     "%": ({ action, node, path }) => `${actions[action]} Required ${requiredList(node, path, index)} in ${location}`,
//     "/*": {
//       "%": ({ action, parent, key }) => `${actions[action]} Required property ${mark(parent[key])} in ${location}`
//     },
//   },
//   // value
//   "/format": { "%": propertyRule("Value format for ", location, index) },
//   "/default": { "%": propertyRule("Default value for ", location, index) },
//   "/nullable": { "%": propertyRule("Possbile nullable value for ", location, index) },
//   "/enum": { "%": propertyRule("Possbile values for ", location, index) },
//   // status
//   "/readOnly": { "%": propertyRule("Readonly status to ", location, index) },
//   "/writeOnly": { "%": propertyRule("Wrightonly status to ", location, index) },
//   "/deprecated": { "%": propertyRule("Deprecated status to ", location, index) },
//   // polymorph
//   "/allOf": {
//     "/*": () => changeSchemaRules(location, index),
//   },
//   "/oneOf": {
//     "/*": () => changeSchemaRules(location, index),
//   },
//   "/anyOf": {
//     "/*": () => changeSchemaRules(location, index),
//   },
//   "/not": () => changeSchemaRules(location, index),
// })
