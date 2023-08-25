"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeDocOpenApiRules = exports.changeDocParametersRules = void 0;
const actions = {
    "add": "[Added]",
    "replace": "[Changed]",
    "remove": "[Deleted]"
};
const targetProperty = (path, from, prefix = "") => {
    if (from >= path.length) {
        return prefix;
    }
    if (path[from] === "properties" && from < path.length) {
        prefix += prefix ? "." + String(path[from + 1]) : String(path[from + 1]);
        return targetProperty(path, from + 2, prefix);
    }
    else if (path[from] === "items") {
        prefix += "[]";
    }
    return targetProperty(path, from + 1, prefix);
};
const mark = (text) => "`" + text + "`";
const validatorRule = (location, index) => ({ action, key, path }) => {
    let target = targetProperty(path, index);
    return `${actions[action]} ${key} validator ${target ? "for " + target : ""} in ${location}`;
};
const propertyList = (node, path, index) => {
    return Object.keys(node || {}).map((prop) => mark(targetProperty([...path, prop], index))).join(", ");
};
const requiredList = (required, path, index) => {
    return (required.length > 1 ? "properties " : "property ") + required.map((prop) => mark(targetProperty([...path, "properties", prop], index))).join(", ");
};
const requiredProperty = (name, path, index) => {
    let target = targetProperty(path, index);
    return mark(target ? `${target}.${name}` : name);
};
const propertyRule = (target, location, index) => ({ action, path }) => `${actions[action]} ${target ? target + " " + dir(action) + " " : ""}property ${mark(targetProperty(path, index))} in ${location}`;
const operationMethods = (node) => {
    const methods = Object.keys(node).filter(key => ["get", "post", "put", "head", "delete", "patch", "connect", "trace", "options"].includes(key.toLocaleLowerCase())).map(mark);
    return (methods.length > 1 ? "methods " : "method ") + methods.join(", ");
};
const dir = (action) => {
    if (action === "add") {
        return "to";
    }
    else if (action === "remove") {
        return "from";
    }
    else {
        return "of";
    }
};
const changeSchemaRules = (location, index) => ({
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
    "/nullable": propertyRule("Possbile nullable value", location, index),
    "/enum": propertyRule("Possbile values", location, index),
    // status
    "/readOnly": propertyRule("Readonly status", location, index),
    "/writeOnly": propertyRule("Wrightonly status", location, index),
    "/deprecated": propertyRule("Deprecated status", location, index),
    // polymorph
    "/allOf": () => changeSchemaRules(location, index),
    "/oneOf": { "/*": () => changeSchemaRules(location, index) },
    "/anyOf": { "/*": () => changeSchemaRules(location, index) },
    "/not": () => changeSchemaRules(location, index),
});
exports.changeDocParametersRules = {
    "/": ({ action, node }) => `${actions[action]} ${node.map((param) => `${param.in} parameter ${mark(param.name)}`).join(", ")}`,
    "/*": {
        // [Deleted] Required query parameter `filter`
        "/": ({ action, node }) => `${actions[action]} ${node.required ? "Required " : ""}${node.in} parameter ${mark(node.name)}`,
        // [Changed] Required status to query parameter `filter`
        "/*": ({ parent }) => `${actions.replace} ${parent.required ? "Required " : ""}${parent.in} parameter ${mark(parent.name)}`,
        // [Added] Required status in query parameter `filter`
        "/required": ({ action, parent }) => `${actions[action]} Required status ${dir(action)} ${parent.in} parameter ${mark(parent.name)}`,
        // [Added] Deprecation status to query parameter `filter`
        "/deprecated": ({ action, parent }) => `${actions[action]} Deprecated status ${dir(action)} ${parent.in} parameter ${mark(parent.name)}`,
    }
};
exports.changeDocOpenApiRules = {
    "/paths": {
        "/*": {
            "/": ({ action, node }) => `${actions[action]} operation ${operationMethods(node)}`,
            "/parameters": exports.changeDocParametersRules,
            "/*": {
                "/": ({ action }) => `${actions[action]} operation`,
                "/parameters": exports.changeDocParametersRules,
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
                            "/schema": ({ path }) => changeSchemaRules(`Request body content (${path[5]})`, 7),
                            // TODO: encoding
                            "/encoding": ({ action, path }) => `${actions[path.length === 8 ? action : "replace"]} Encoding of Response ${path[4]} content (${path[6]})`,
                        }
                    }
                },
                // [Add] Deprecated status
                "/deprecated": ({ action }) => `${actions[action]} Deprecated status`,
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
                                "/schema": ({ path }) => changeSchemaRules(`Response ${path[4]} content (${path[6]})`, 8),
                                // TODO: encoding
                                "/encoding": ({ action, path }) => `${actions[path.length === 8 ? action : "replace"]} Encoding of Response ${path[4]} content (${path[6]})`,
                            }
                        },
                    }
                }
            }
        }
    }
};
//# sourceMappingURL=openapi.js.map