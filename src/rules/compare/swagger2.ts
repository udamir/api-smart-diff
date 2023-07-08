// import { ClassifyRule, ClassifyRules, DiffTypeFunc } from "../types"
// import { 
//   breaking, nonBreaking, allAnnotation, addNonBreaking, 
//   allBreaking, allUnclassified, onlyAddBreaking, allDeprecated,
// } from "../constants"
// import { breakingIf, breakingIfAfterTrue } from "./jsonschema"

// const maxClassifier: ClassifyRule = [
//   breaking, 
//   nonBreaking, 
//   ({ before, after }) => breakingIf(before > after)
// ]

// const minClassifier: ClassifyRule = [
//   breaking,
//   nonBreaking,
//   ({ before, after }) => breakingIf(before < after)
// ]

// const exclusiveClassifier: ClassifyRule  = [
//   breakingIfAfterTrue, 
//   nonBreaking, 
//   breakingIfAfterTrue
// ]

// const booleanClassifier: ClassifyRule  = [
//   breakingIfAfterTrue,
//   nonBreaking,
//   breakingIfAfterTrue
// ]

// const multipleOfClassifier: ClassifyRule = [
//   breaking,
//   nonBreaking,
//   ({ before, after }) => breakingIf(!!(before % after))
// ]


// const emptySecurity = (value?: Array<any>) => {
//   return !!value && (value.length === 0 || (value.length === 1 && Object.keys(value[0]).length === 0))
// }

// const includeSecurity = (value: Array<any> = [], items: Array<any> = []) => {
//   // TODO match security schema
//   const valueSet = new Set(value.map((item) => Object.keys(item)[0]))

//   for (const item of items) {
//     if (!valueSet.has(Object.keys(item)[0])) { return false }
//   }

//   return true
// }

// const globalSecurityRules: ClassifyRules = {
//   "/": [
//     (ctx) => !emptySecurity(ctx.after) ? breaking : nonBreaking, 
//     nonBreaking, 
//     (ctx) => includeSecurity(ctx.after, ctx.before) || emptySecurity(ctx.after) ? nonBreaking : breaking
//   ],
//   "/*": [
//     (ctx) => ctx.up().before.length ? nonBreaking : breaking, 
//     (ctx) => ctx.up().after.length ? breaking : nonBreaking, 
//     (ctx) => includeSecurity(ctx.up().after, ctx.up().before) || emptySecurity(ctx.after) ? nonBreaking : breaking
//   ],
// }

// const operationSecurityRules: ClassifyRules = {
//   "/": [
//     (ctx) => includeSecurity(ctx.after, ctx.root.before.security) ? nonBreaking : breaking, 
//     (ctx) => includeSecurity(ctx.root.after.security, ctx.before) ? nonBreaking : breaking,
//     (ctx) => includeSecurity(ctx.after, ctx.before) || emptySecurity(ctx.after) ? nonBreaking : breaking
//   ],
//   "/*": [
//     (ctx) => ctx.up().before.length ? nonBreaking : breaking, 
//     (ctx) => ctx.up().after.length ? breaking : nonBreaking, 
//     (ctx) => includeSecurity(ctx.up().after, ctx.up().before) || emptySecurity(ctx.after) ? nonBreaking : breaking
//   ],
// }

// const nonBreakingIfDefault: DiffTypeFunc = ({ after, up }) => 
//   up(2).after?.properties?.[after]?.default !== undefined ? nonBreaking : breaking

// const pathArrayRules = (rules: ClassifyRules) => matchRule(rules, ({ before, after }) => {
//   const beforePath = String(before.key).replace(new RegExp("\{.*?\}", "g"), "*")
//   const afterPath = String(after.key).replace(new RegExp("\{.*?\}", "g"), "*")
//   return beforePath === afterPath
// })

// const paramArrayRules = (rules: ClassifyRules) => matchRule(rules, ({ before: { value: b }, after: { value: a } }) => {
//   return b.in === a.in && (b.in === "path" || b.name === a.name)
// })

// const contentMediaTypeRules = (rules: ClassifyRules) => matchRule(rules, ({ before, after }) => {
//   const [ afterMediaType = "" ] = String(after.key).split(";")
//   const [ beforeMediaType = "" ] = String(before.key).split(";")

//   const [ afterType, afterSubType ] = afterMediaType.split("/")
//   const [ beforeType, beforeSubType ] = beforeMediaType.split("/")

//   if (afterType !== beforeType && afterType !== "*" && beforeType !== "*") { return false }
//   if (afterSubType !== beforeSubType && afterSubType !== "*" && beforeSubType !== "*") { return false }

//   return true
// })

// const inlineJsonSchemaRules = (): ClassifyRules => ({
//   "/type": [breaking, nonBreaking, breaking],
//   "/format": [breaking, nonBreaking, breaking],
//   "/items": () => jsonSchemaRules(allBreaking),
//   "/default": [nonBreaking, breaking, breaking],
//   "/maximum": maxClassifier,
//   "/exclusiveMaximum": exclusiveClassifier,
//   "/minimum": minClassifier,
//   "/exclusiveMinimum": exclusiveClassifier,
//   "/maxLength": maxClassifier,
//   "/minLength": minClassifier,
//   "/pattern": [breaking, nonBreaking, breaking], // TODO: Compare Regex before vs after
//   "/maxItems": maxClassifier,
//   "/minItems": minClassifier,
//   "/uniqueItems": booleanClassifier,
//   "/enum": {
//     "/": [breaking, nonBreaking, breaking],
//     "/*": [nonBreaking, breaking, breaking],
//   },
//   "/multipleOf": multipleOfClassifier,
// })

// const jsonSchemaRules = (rootRule: ClassifyRule = allUnclassified): ClassifyRules => ({
//   "/": rootRule,
//   ...inlineJsonSchemaRules(),
//   "/title": allAnnotation,
//   "/description": allAnnotation,
//   "/items": () => jsonSchemaRules(allBreaking),
//   "/maxProperties": maxClassifier,
//   "/minProperties": minClassifier,
//   "/required": {
//     "/": onlyAddBreaking,
//     "/*": [nonBreakingIfDefault, nonBreaking, nonBreakingIfDefault],
//   },
//   "/properties": {
//     "/": [breaking, nonBreaking, breaking],
//     "/*": () => jsonSchemaRules(addNonBreaking),
//   },
//   "/allOf": {
//     "/": [breaking, nonBreaking, breaking],
//     "/*": () => jsonSchemaRules(allBreaking),
//   },
//   "/readOnly": booleanClassifier,
//   "/discriminator": allAnnotation,
//   "/additionalProperties": () => jsonSchemaRules([breaking, breaking, breakingIfAfterTrue]),
//   "/example": allAnnotation,
//   "/externalDocs": allAnnotation,
//   "/xml": allUnclassified,
// })

// const serversRules: ClassifyRules = {
//   "/": [nonBreaking, breaking, breaking],
//   "/*": {
//     "/": [nonBreaking, breaking, breaking],
//     "/url": [nonBreaking, breaking, breaking],
//     "/description": allAnnotation,
//     "/variables": {
//       "/": [nonBreaking, breaking, breaking],
//       "/*": {
//         "/": [nonBreaking, breaking, breaking],
//         "/enum": {
//           "/": [nonBreaking, breaking, breaking],
//           "/*": [nonBreaking, breaking, breaking],
//         },
//         "/default": [breaking, breaking, breaking],
//         "/description": allAnnotation,
//       },
//     },
//   },
// }

// const parametersRules: ClassifyRules = paramArrayRules({
//   "/": [nonBreaking, breaking, breaking],
//   "/*": {
//     "/": [nonBreaking, breaking, breaking],
//     "/name": [nonBreaking, breaking, (ctx) => ctx.up().before?.in === "path" ? nonBreaking : breaking ],
//     "/in": [nonBreaking, breaking, breaking],
//     "/schema": () => jsonSchemaRules(allBreaking),
//     "/description": allAnnotation,
//     "/required": [breaking, nonBreaking, breakingIfAfterTrue],
//     ...jsonSchemaRules(),
//     "/allowEmptyValue": [nonBreaking, ({ before }) => before, ({ before }) => before],
//     "/collectionFormat": [breaking, nonBreaking, breaking],
//   },
// })

// const headersRules: ClassifyRules = {
//   "/": [nonBreaking, breaking, breaking],
//   "/*": {
//     "/": [nonBreaking, breaking, breaking],
//     "/description": allAnnotation,
//     ...jsonSchemaRules(),
//     "/allowEmptyValue": [nonBreaking, ({ before }) => before, ({ before }) => before],
//     "/collectionFormat": [breaking, nonBreaking, breaking],
//   },
// }

// const responsesRules: ClassifyRules = {
//   "/": [nonBreaking, breaking, breaking],
//   "/*": {
//     "/": [nonBreaking, breaking, breaking],
//     "/description": allAnnotation,
//     "/headers": headersRules,
//     "/schema": () => jsonSchemaRules(allBreaking),
//     "/examples": allAnnotation,
//   },
// }

// const operationRules: ClassifyRules = {
//   "/": [nonBreaking, breaking, breaking],
//   "/tags": allAnnotation,
//   "/summary": allAnnotation,
//   "/description": allAnnotation,
//   "/externalDocs": allAnnotation,
//   "/operationId": allAnnotation,
//   "/consumes": contentMediaTypeRules({
//     "/": [nonBreaking, breaking, breaking],
//     "/*": [nonBreaking, breaking, breaking],
//   }),
//   "/produces": contentMediaTypeRules({
//     "/": [nonBreaking, breaking, breaking],
//     "/*": [nonBreaking, breaking, breaking],
//   }),
//   "/parameters": parametersRules,
//   "/responses": responsesRules,
//   "/deprecated": allDeprecated,
//   "/security": operationSecurityRules  
// }

// export const swagger2Rules: ClassifyRules = {
//   "/swagger": allAnnotation,
//   "/info": {
//     "/": allAnnotation,
//     "/title": allAnnotation,
//     "/description": allAnnotation,
//     "/termsOfService": allAnnotation,
//     "/contact": allAnnotation,
//     "/licence": {
//       "/": [nonBreaking, breaking, breaking],
//       "/name": [breaking, breaking, breaking],
//       "/url": [breaking, nonBreaking, nonBreaking],
//     },
//     "/version": allAnnotation,
//   },
//   "/servers": serversRules,
//   "/paths": pathArrayRules({
//     "/": [nonBreaking, breaking, breaking],
//     "/*": {
//       "/": [nonBreaking, breaking, nonBreaking],
//       "/*": operationRules,
//       "/parameters": parametersRules,
//     },
//   }),
//   "/definitions": {
//     "/": [nonBreaking, breaking, breaking],
//     "/*": () => jsonSchemaRules(addNonBreaking),
//   },
//   "/responses": {
//     "/": [nonBreaking, breaking, breaking],
//     "/*": responsesRules,
//   },
//   "/parameters": {
//     "/": [nonBreaking, breaking, breaking],
//     "/*": parametersRules,
//   },
//   "/examples": allAnnotation,
//   "/securityDefinitions": {
//     "/": [breaking, nonBreaking, breaking],
//     "/*": {
//       "/": [breaking, nonBreaking, breaking],
//       "/type": [breaking, nonBreaking, breaking],
//       "/description": allAnnotation,
//       "/name": [breaking, nonBreaking, breaking],
//       "/in": [breaking, nonBreaking, breaking],
//       "/flow": [breaking, nonBreaking, breaking],
//       "/authorizationUrl": [breaking, nonBreaking, breaking],
//       "/tokenUrl": [breaking, nonBreaking, breaking],
//       "/scopes": [breaking, nonBreaking, breaking],
//     },
//   },
//   "/security": globalSecurityRules,
//   "/tags": allAnnotation,
//   "/externalDocs": allAnnotation,
// }
