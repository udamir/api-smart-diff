
import { JsonPath } from "json-crawl"

import { ChangeDocResolver, ChangeDocRules } from "../types"

const actions: Record<string, "[Added]" | "[Deleted]" | "[Changed]"> = {
  "add": "[Added]",
  "replace": "[Changed]",
  "remove": "[Deleted]"
}

const targetProperty = (path: JsonPath, from: number, prefix = ""): string => {
  if (from >= path.length) { return prefix }
  if (path[from] === "properties" && from < path.length) {
    prefix += prefix ? "." + String(path[from+1]) : String(path[from+1]) 
    return targetProperty(path, from + 2, prefix)
  } else if (path[from] === "items") {
    prefix += "[]"
  }
  return targetProperty(path, from + 1, prefix) 
}

const mark = (text: string | number): string => "`" + text + "`"

const validatorRule = (location: string, index: number): ChangeDocResolver => ({ action, key, path }) => {
  let target = targetProperty(path, index)
  return `${actions[action]} ${key} validator ${target ? "for " + target : ""} in ${location}`
}

const propertyList = (node: any, path: JsonPath, index: number) => {
  return Object.keys(node || {}).map((prop) => mark(targetProperty([...path, prop], index))).join(", ")
}

const requiredList = (required: string[], path: JsonPath, index: number) => {
  return (required.length > 1 ? "properties " : "property ") + required.map((prop) => mark(targetProperty([...path, "properties", prop], index))).join(", ")
}

const propertyRule = (target: string, location: string, index: number): ChangeDocResolver => ({ action, path }) => 
  `${actions[action]} ${target}property ${mark(targetProperty(path, index))} in ${location}`


const operationMethods = (node: any) => {
  const methods = Object.keys(node).filter(key => ["get", "post", "put", "head", "delete", "patch", "connect", "trace", "options"].includes(key.toLocaleLowerCase())).map(mark)
  return (methods.length > 1 ? "methods " : "method ") + methods.join(", ")
}

const changeSchemaRules = (location: string, index: number): ChangeDocRules => ({
  // property
  "%": propertyRule("", location, index),
  // validators
  "/multipleOf": { "%": validatorRule(location, index) },
  "/maximum": { "%": validatorRule(location, index) },
  "/exclusiveMaximum": { "%": validatorRule(location, index) },
  "/minimum": { "%": validatorRule(location, index) },
  "/exclusiveMinimum": { "%": validatorRule(location, index) },
  "/maxLength": { "%": validatorRule(location, index) },
  "/minLength": { "%": validatorRule(location, index) },
  "/pattern": { "%": validatorRule(location, index) },
  "/maxItems": { "%": validatorRule(location, index) },
  "/minItems": { "%": validatorRule(location, index) },
  "/uniqueItems": { "%": validatorRule(location, index) },
  "/maxProperties": { "%": validatorRule(location, index) },
  "/minProperties": { "%": validatorRule(location, index) },
  // items
  "/items": () => changeSchemaRules(location, index),
  // properties
  "/properties": {
    "%": ({ action, path, node }) => `${actions[action]} properties ${propertyList(node, path, index)} in ${location}`,
    "/*": () => changeSchemaRules(location, index)
  },
  // type
  "/type": { "%": propertyRule("Type of ", location, index) },
  // required
  "/required": {
    "%": ({ action, node, path }) => `${actions[action]} Required ${requiredList(node, path, index)} in ${location}`,
    "/*": {
      "%": ({ action, parent, key }) => `${actions[action]} Required property ${mark(parent[key])} in ${location}`
    },
  },
  // value
  "/format": { "%": propertyRule("Value format for ", location, index) },
  "/default": { "%": propertyRule("Default value for ", location, index) },
  "/nullable": { "%": propertyRule("Possbile nullable value for ", location, index) },
  "/enum": { "%": propertyRule("Possbile values for ", location, index) },
  // status
  "/readOnly": { "%": propertyRule("Readonly status to ", location, index) },
  "/writeOnly": { "%": propertyRule("Wrightonly status to ", location, index) },
  "/deprecated": { "%": propertyRule("Deprecated status to ", location, index) },
  // polymorph
  "/allOf": {
    "/*": () => changeSchemaRules(location, index),
  },
  "/oneOf": {
    "/*": () => changeSchemaRules(location, index),
  },
  "/anyOf": {
    "/*": () => changeSchemaRules(location, index),
  },
  "/not": () => changeSchemaRules(location, index),
})

export const changeDocParametersRules: ChangeDocRules = {
  "%": ({ action, node }) => `${actions[action]} ${node.map((param: any) => `${param.in} parameter ${mark(param.name)}`).join(", ")}`,
  "/*": {
    // [Deleted] Required query parameter `filter`
    "%": ({ action, node }) => `${actions[action]} ${node.required ? "Required " : ""}${node.in} parameter ${mark(node.name)}`,
    // [Changed] Required status to query parameter `filter`
    "/*": { "%": ({ parent }) => `${actions.replace} ${parent.required ? "Required " : ""}${parent.in} parameter ${mark(parent.name)}` },
    // [Added] Required status in query parameter `filter`
    "/required": { "%": ({ action, parent }) => `${actions[action]} Required status in ${parent.in} parameter ${mark(parent.name)}` },
    // [Added] Deprecation status to query parameter `filter`
    "/deprecated": { "%": ({ action, parent }) => `${actions[action]} Deprecated status in ${parent.in} parameter ${mark(parent.name)}` },
  }
}

export const changeDocOpenApiRules: ChangeDocRules = {
  "/paths": {
    "/*": {
      "%": ({ action, node }) => `${actions[action]} operation ${operationMethods(node)}`,
      "/parameters": changeDocParametersRules,
      "/*": {
        "%": ({ action }) => `${actions[action]} operation`,
        "/parameters": changeDocParametersRules,
        "/requestBody": {
          // [Removed] Body content in Request
          "%": ({ action }) => `${actions[action]} Body content in Request`,
          // [Added] Required status to Request body content
          "/required": { "%": ({ action }) => `${actions[action]} Required status to Request body content` },
          "/content": {
            // [Removed] Body content in Request
            "%": ({ action }) => `${actions[action]} Body content in Request`,
            "/*": {
              // [Add] Body content (application/json) in Request body
              "%": ({ action, path }) => `${actions[action]} Body content (${path[5]}) in Request`,
              // [Added] `groups.[].lastVersion` property in Request body content (application/json)
              "/schema": (path) => changeSchemaRules(`Request body content (${path[5]})`, 7),
              // TODO: encoding
              "/encoding": { "%": ({ action, path }) => `${actions[path.length === 8 ? action : "replace"]} Encoding of Response ${path[4]} content (${path[6]})` },
            }
          }
        },
        // [Add] Deprecated status
        "/deprecated": { "%": ({ action }) => `${actions[action]} Deprecated status` },
        // TODO: security
        "/security": { "%": ({ action, path }) => `${actions[path.length === 4 ? action : "replace"]} Security in Request` },
        "/responses": {
          "/*": {
            // [Add] Response with status 500
            "%": ({ action, path }) => `${actions[action]} Response with status ${path[4]}`,
            "/headers": {
              "%": ({ action, node, path }) => `${actions[action]} Header parameters ${Object.keys(node).map(mark).join(", ")} in Response ${path[4]}`,
              "/*": {
                // [Deleted] Header parameter `token` in Response 200
                "%": ({ action, node, key, path }) => `${actions[action]} ${node.required ? "required " : ""}Header parameter ${mark(key)} in Response ${path[4]}`,
                // [Changed] Required status to query parameter `filter`
                "/*": { "%": ({ node, key, path }) => `${actions.replace} ${node.required ? "required " : ""}Header parameter ${mark(key)} in Response ${path[4]}` },
                // [Added] Required status to query parameter `filter`
                "/required": { "%": ({ action, key, path }) => `${actions[action]} Required status to Header parameter ${mark(key)} in Response ${path[4]}` },
                // [Added] Deprecation status to query parameter `filter`
                "/deprecated": { "%": ({ action, path, key }) => `${actions[action]} Deprecated status to Header parameter ${mark(key)} in Response ${path[4]}` },
              }
            },
            "/content": {
              // [Add] Content in Response 200
              "%": ({ action, path }) => `${actions[action]} Content in Response ${path[4]}`,
              "/*": {
                // [Add] Content (application/json) in Response 200
                "%": ({ action, path }) => `${actions[action]} Content (${path[6]}) in Response ${path[4]}`,
                // [Added] `groups.[].lastVersion` property in response 200 content
                "/schema": (path) => changeSchemaRules(`Response ${path[4]} content (${path[6]})`, 8),
                // TODO: encoding
                "/encoding": { "%": ({ action, path }) => `${actions[path.length === 8 ? action : "replace"]} Encoding of Response ${path[4]} content (${path[6]})` },
              }
            },
          }
        }
      }
    }
  }
}
