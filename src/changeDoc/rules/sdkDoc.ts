import { ObjPath } from "../../types"
import { getValueByPath } from "../../utils";
import { ChangeDocRuleRef, ChangeDocRules } from "../types"

const actions: Record<string, "[Added]" | "[Deleted]" | "[Changed]"> = {
  "add": "[Added]",
  "replace": "[Changed]",
  "remove": "[Deleted]"
}

function breakingChange(type: string, isBreaking: boolean){
  if(type !== "breaking" && isBreaking){
      return "[Breaking] ";
  }
  return "";
}

function getBreakingTag(){
  return "[Breaking] ";
}

function getNodeFromPath(source: any, path: Array<string | number>){
  let res = source;
  path.forEach((item: string | number) => {
    res = res[item];
  })
  return res;
}

const targetProperty = (path: ObjPath, from: number, prefix = ""): string => {
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

const validatorRule = (location: string, index: number): ChangeDocRuleRef => ({ action, key, path }) => {
  let target = targetProperty(path, index)
  return `${actions[action]} ${key} validator ${target ? "for " + target : ""} in ${location}`
}

const propertyList = (node: any, path: ObjPath, index: number) => {
  return Object.keys(node || {}).map((prop) => mark(targetProperty([...path, prop], index))).join(", ")
}

const requiredList = (required: string[], path: ObjPath, index: number) => {
  return (required.length > 1 ? "properties " : "property ") + required.map((prop) => mark(targetProperty([...path, "properties", prop], index))).join(", ")
}

const requiredProperty = (name: string, path: ObjPath, index: number) => {
  let target = targetProperty(path, index)
  return mark(target ? `${target}.${name}` : name)
}

const propertyRule = (target: string, location: string, index: number): ChangeDocRuleRef => (data) => {

  // Finding name of schema
  let schemaName = "";

  let currentPathIndex = 0;
  let currentPath = data.path;
  let currentSchema = data.source;

  while(currentPathIndex < currentPath.length-1){
    currentSchema = getValueByPath(data.source, currentPath.slice(0, currentPathIndex+1));
    currentPathIndex++;
    if(currentSchema.hasOwnProperty("$ref")){
      let newSchemaPath = currentSchema["$ref"].split("/").slice(1);
      schemaName = currentSchema["$ref"].split("/").slice(-1)[0];
      // currentSchema = getValueByPath(data.source, newSchemaPath);
      currentPath = newSchemaPath.concat(currentPath.slice(currentPathIndex));
      currentPathIndex = 2;
    }
  }
  
  if(typeof(data.before) === "object" && !Array.isArray(data.before)){
    data.before = undefined;
  }
  if(typeof(data.after) === "object" && !Array.isArray(data.after)){
    data.after = undefined;
  }
  return `${actions[data.action]} ${target ? target + `${data.before ? ` from ${mark(data.before)}`: ''}${data.after ? ` ${data.action !== 'add' ? 'to ' : ''}${mark(data.after)}` : ''}` + " " + dir(data.action) + " " : ""}property ${mark(targetProperty(data.path, index))} of schema ${mark(schemaName)} in ${location}`
}

// const propertyRule = (target: string, location: string, index: number): ChangeDocRuleRef => (data) => {
//   delete data.source
//   console.log(data);
//   return `${actions[data.action]} ${target ? target + " " + dir(data.action) + " " : ""}property ${mark(targetProperty(data.path, index))}${data.before? ` from \`${data.before}\``: ""} in ${location}`
//   return `${actions[data.action]} ${target ? target : ""}${data.before? ` from \`${data.before}\``: ""}${data.after ? ` to \`${data.after}\``: ""} of property ${mark(targetProperty(data.path, index))} in ${location}`
// }


// const operationMethods = (node: any) => {
//   const methods = Object.keys(node).filter(key => ["get", "post", "put", "head", "delete", "patch", "connect", "trace", "options"].includes(key.toLocaleLowerCase())).map(mark)
//   return (methods.length > 1 ? "methods " : "method ") + methods.join(", ")
// }

const dir = (action: string) => {
  if (action === "add") {
    return "to"
  } else if (action === "remove") {
    return "from"
  } else {
    return "of"
  }
} 

const changeSchemaRules = (location: string, index: number): ChangeDocRules => ({
  // property
  "/": propertyRule("", location, index),
  // validators
  "/multipleOf": validatorRule(location, index),
  "/maximum": validatorRule(location, index),
  "/exclusiveMaximum": validatorRule(location, index),
  "/minimum": validatorRule(location, index),
  "/exclusiveMinimum": validatorRule(location, index),
  "/maxLength": validatorRule(location, index),
  "/minLength": validatorRule(location, index),
  "/pattern": validatorRule(location, index),
  "/maxItems": validatorRule(location, index),
  "/minItems": validatorRule(location, index),
  "/uniqueItems": validatorRule(location, index),
  "/maxProperties": validatorRule(location, index),
  "/minProperties": validatorRule(location, index),
  // items
  "/items": () => changeSchemaRules(location, index),
  // properties
  "/properties": {
    "/": ({ action, path, node }) => `${actions[action]} properties ${propertyList(node, path, index)} in ${location}`,
    "/*": () => changeSchemaRules(location, index)
  },
  // type
  "/type": propertyRule("Type", location, index),
  // required
  "/required": {
    "/": ({ action, node, path }) => `${actions[action]} Required status ${dir(action)} ${requiredList(node, path, index)} in ${location}`,
    "/*": ({ action, parent, key, path }) => `${actions[action]} Required status ${dir(action)} property ${requiredProperty(parent[key], path, index)} in ${location}`,
  },
  // value
  "/format": propertyRule("Value format", location, index),
  "/default": propertyRule("Default value", location, index),
  "/nullable": propertyRule("Possible nullable value", location, index),
  "/enum": propertyRule("Possible values", location, index),
  // status
  "/readOnly": propertyRule("Readonly status", location, index),
  "/writeOnly": propertyRule("WriteOnly status", location, index),
  "/deprecated": propertyRule("Deprecated status", location, index),
  // polymorph
  "/allOf": () => changeSchemaRules(location, index),
  "/oneOf": { "/*": () => changeSchemaRules(location, index) },
  "/anyOf": { "/*": () => changeSchemaRules(location, index) },
  "/not": () => changeSchemaRules(location, index),
})

const parameterArrayChangeDoc = (data: any) => {
  let changedParamObj: any[] = [];

  let change = "";
  // Whole parameter object changed (parameter array)
  if(data.after) changedParamObj = changedParamObj.concat(data.after);
  if(data.before) changedParamObj = changedParamObj.concat(data.before);
  
  let isFirst = true;
  for(const param of changedParamObj){
    const isBreaking = param.required ? true : false;
    if(isFirst){
        isFirst = false;
    }
    else{
        change += "- ";
    }
    change += `${breakingChange(data.type, isBreaking)}${actions[data.action]}${param.required ? " Required" : ""} \`${param.in}\` parameter \`${param.name}\` (type: \`${param.schema.type}\`)\n`;
  }
  return change
};

const parameterChangeDoc = (data: any) => {
  if(data.action == "replace"){
    let change = ``;
    if(data.before.name === data.after.name){
      const isRequiredChanged = data.before.required !== data.after.required && data.before.required !== undefined && data.after.required !== undefined;
      const isLocationChanged = data.before.in !== data.after.in;
      const isTypeChanged = data.before.schema.type !== data.after.schema.type && data.before.schema.type !== undefined && data.after.schema.type;
      
      change += `${breakingChange(data.type, true)}${actions[data.action]}`;
      let isFirst = true;
      if(isRequiredChanged){
        change += ` type from ${data.before.type} to ${data.after.type}`
        isFirst = false;
      }
      if(isLocationChanged){
        if(!isFirst) change += ",";
        isFirst = false;
        change += ` location from ${data.before.in} to ${data.after.in}`
      }
      if(isTypeChanged){
        if(!isFirst) change += ",";
        isFirst = false;
        change += ` type from ${data.before.schema.type} to ${data.after.schema.type}`
      }
      
      change += ` of parameter ${data.before.name}`;
    }
    else{
      // change += `${breakingChange(data.type, true)}${actions['add']}`;
      if(data.before){
        change += `${breakingChange(data.type, true)}${actions['remove']}`;
        change += `${data.before.required ? " Required" : ""} \`${data.before.in}\` parameter \`${data.before.name}\` (type: \`${data.before.schema.type}\`)`
      }
      if(data.after){
        if(change !== ""){
          change += `\n\n- ${data.after.required ? getBreakingTag(): ""}`;
        }
        else{
          change += `${breakingChange(data.type, true)}`;
        }
        change += `${actions['add']}`;
        change += `${data.after.required ? " Required" : ""} \`${data.after.in}\` parameter \`${data.after.name}\` (type: \`${data.after.schema.type}\`)`
      }
    }
    return change;
  }
  else{
    const param = data.before ?? data.after;
    const isBreaking = param.required ? true : false;
    return `${breakingChange(data.type, isBreaking)}${actions[data.action]}${param.required ? " Required" : ""} \`${param.in}\` parameter \`${param.name}\` (type: \`${param.schema.type}\`)\n`;
  }
}

const changeDocParametersRules: ChangeDocRules = {
  "/": parameterArrayChangeDoc,
  "/*": {
    // [Deleted] Required query parameter `filter`
    "/": parameterChangeDoc,
    // [Changed] Required status to query parameter `filter`
    // "/*": parameterChangeDoc,
    // "/*": ({ parent }) => `${actions.replace} ${parent.required ? "Required " : ""}${parent.in} parameter ${mark(parent.name)}`,
    // [Added] Required status in query parameter `filter`
    "/required": (data) => `${actions[data.action]} Required status ${dir(data.action)} ${data.parent.in} parameter ${mark(data.parent.name)}`,
    // "/default": (data) => ``,
    // [Added] Deprecation status to query parameter `filter`
    "/deprecated": ({ action, parent }) => `${actions[action]} Deprecated status ${dir(action)} ${parent.in} parameter ${mark(parent.name)}`,
  }
}

export const changeDocSDKRules: ChangeDocRules = {
  "/paths": {
    "/*": {
      "/": ({ action, key }) => `${actions[action]} method \`${key}\`\n`,
      // "/": ({ action, node }) => `${actions[action]} operation ${operationMethods(node)}`,
      "/parameters": changeDocParametersRules,
      "/*": {
        // "/": ({ action }) => `${actions[action]} operation`,
        "/": ({ action, node }) => `${actions[action]} method \`${node.operationId}\`\n`,
        "/parameters": changeDocParametersRules,
        "/requestBody": {
          // [Removed] Body content in Request
          "/": ({ action }) => `${actions[action]} Body content in Request`,
          // [Added] Required status to Request body content
          "/required": ({ action }) => `${actions[action]} Required status to Request body content`,
          "/content": {
            // [Removed] Body content in Request
            "/": ({ action }) => `${actions[action]} Body content in Request`,
            "/*": {
              // [Add] Body content (application/json) in Request body
              "/": ({ action, path }) => `${actions[action]} Body content (${path[5]}) in Request`,
              // [Added] `groups.[].lastVersion` property in Request body content (application/json)
              "/schema": ({ path }) => changeSchemaRules(`request body`, 7),
              // TODO: encoding
              "/encoding": ({ action, path }) => `${actions[path.length === 8 ? action : "replace"]} Encoding of Response ${path[4]} content (${path[6]})`,
            }
          }
        },
        // [Add] Deprecated status
        "/deprecated": (data) => {
          if(data.action === "add" || (data.action === "replace" && data.after === true)){
            return "[Note] This method is deprecated and it will be removed in future versions."
          }
          return `${actions[data.action]} Deprecated status${data.before ? ` from ${data.before}`: ""}${data.after ? ` to ${data.after}`: ""}`
        },
        // TODO: security
        "/security": ({ action, path }) => `${actions[path.length === 4 ? action : "replace"]} Security in Request`,
        "/responses": {
          "/*": {
            // [Add] Response with status 500
            "/": ({ action, path }) => `${actions[action]} Response with status ${path[4]}`,
            "/headers": {
              "/": ({ action, node, path }) => `${actions[action]} Header parameters ${Object.keys(node).map(mark).join(", ")} in Response ${path[4]}`,
              "/*": {
                // [Deleted] Header parameter `token` in Response 200
                "/": ({ action, node, key, path }) => `${actions[action]} ${node.required ? "required " : ""}Header parameter ${mark(key)} in Response ${path[4]}`,
                // [Changed] Required status to query parameter `filter`
                "/*": ({ node, key, path }) => `${actions.replace} ${node.required ? "required " : ""}Header parameter ${mark(key)} in Response ${path[4]}`,
                // [Added] Required status to query parameter `filter`
                "/required": ({ action, key, path }) => `${actions[action]} Required status ${dir(action)} Header parameter ${mark(key)} in Response ${path[4]}`,
                // [Added] Deprecation status to query parameter `filter`
                "/deprecated": ({ action, path, key }) => `${actions[action]} Deprecated status ${dir(action)} Header parameter ${mark(key)} in Response ${path[4]}`,
              }
            },
            "/content": {
              // [Add] Content in Response 200
              "/": ({ action, path }) => `${actions[action]} Content in Response ${path[4]}`,
              "/*": {
                // [Add] Content (application/json) in Response 200
                "/": ({ action, path }) => `${actions[action]} Content (${path[6]}) in Response ${path[4]}`,
                // [Added] `groups.[].lastVersion` property in response 200 content
                "/schema": ({ path }) => changeSchemaRules(`response with status code ${path[4]}`, 8),
                // TODO: encoding
                "/encoding": ({ action, path }) => `${actions[path.length === 8 ? action : "replace"]} Encoding of Response ${path[4]} content (${path[6]})`,
              }
            },
          }
        },
        "/operationId": (data) => `${actions[data.action]} operationId${data.before ? ` from \`${data.before}\`` : ""}${data.after ? ` to \`${data.after}\`` : ""}`,
        "/methodType": (data) => `${actions[data.action]} http method type ${data.before ? `from \`${data.before}\`` : ""} ${data.after ? `To \`${data.after}\`` : ""}`,
        "/path": (data) => {
          const beforePath = String(data.before).replace(new RegExp("\{.*?\}", "g"), "*")
          const afterPath = String(data.after).replace(new RegExp("\{.*?\}", "g"), "*")
          if(beforePath !== afterPath){
              return `${actions[data.action]} Path ${data.before ? "From \`" + data.before + "\`" : ""} ${data.after ? "To \`" + data.after + "\`" : ""}`
          }
          return "";
        }
      }
    }
  },
  "/components": {
    "/schemas": {
      "/*": {
       //Schema changed
        "/": (data) => `${breakingChange(data.type, false)}${actions[data.action]} schema \`${data.key}\``,
       //property of schema changed
       "/properties": {
          
         
          //inside parameter
          "/*": {
            // parameter added or deleted
          // "/": `parameter added`,
            "/": (data) => {
              return `${breakingChange(data.type, false)}${actions[data.action]} parameter \`${data.key}\` in ${data.path[2]}`
            },
            "/type": (data) => `${breakingChange(data.type, false)} ${actions[data.action]} type of property \`${data.path[data.path.length - 2]}\` from \`${data.before}\` to \`${data.after}\` in schema \`${data.path[data.path.length - 4]}\``
          },
        },
      //   "/*": (data) => {
      //     delete data.source
      //     console.log(data)
      //     return `${breakingChange(data.type, false)} ${actions[data.action]} `
      //  }
      }
      
    }
  }
}
