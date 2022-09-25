import { 
  allAnnotation, allBreaking, allUnclassified, 
  unclassified, addNonBreaking, breaking, nonBreaking
} from "../constants"
import { breakingIfAfterTrue, matchRule, objArray } from "../utils"
import { jsonSchemaRules } from "."
import { Rules } from "../types"

const childrenArray = (rules: Rules) => matchRule(rules, ({ before: { value: b }, after: { value: a } }) => {
  if (a.type !== b.type) {
    return false
  }
  if (a.type === "model") {
    return a.name === b.name
  } else {
    const beforePath = b.data.path?.replace(new RegExp("\{.*?\}", "g"), "*")
    const afterPath = a.data.path?.replace(new RegExp("\{.*?\}", "g"), "*")
    return beforePath === afterPath && b.data.method === a.data.method
  }
})

export const contentMediaTypeRules = (rules: Rules): Rules => matchRule(rules, ({ before, after }) => {
  const [ afterMediaType = "" ] = String(after.value.mediaType).split(";")
  const [ beforeMediaType = "" ] = String(before.value.mediaType).split(";")

  const [ afterType, afterSubType ] = afterMediaType.split("/")
  const [ beforeType, beforeSubType ] = beforeMediaType.split("/")

  if (afterType !== beforeType && afterType !== "*" && beforeType !== "*") { return false }
  if (afterSubType !== beforeSubType && afterSubType !== "*" && beforeSubType !== "*") { return false }

  return true
})

const paramRules: Rules = {
  '/': addNonBreaking, 
  '/name': [nonBreaking, breaking, breaking],
  '/style': allUnclassified,
  '/description': allAnnotation,
  '/examples': allAnnotation,
  '/schema': jsonSchemaRules(allBreaking),
  '/explode': allUnclassified,
  '/required': [breaking, nonBreaking, breakingIfAfterTrue],
  '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
}

const paramsRules: Rules = {
  '/': [nonBreaking, breaking, breaking],
  '/*': paramRules
}

const contentsRules: Rules = contentMediaTypeRules({
  '/': addNonBreaking, 
  '/*': {
    '/': [nonBreaking, breaking, unclassified],
    '/mediaType': [nonBreaking, breaking, unclassified],
    '/schema': jsonSchemaRules(allBreaking),
    '/examples': objArray("key", {
      "/": allAnnotation,
      "/*": allAnnotation,
    }),
    '/encodings': [nonBreaking, breaking, breaking],
  }
})

const requestRules: Rules = {
  '/path': objArray("name", paramsRules),
  '/query': objArray("name", {
    '/': [nonBreaking, breaking, breaking],
    '/*': {
      ...paramRules,
      '/allowEmptyValue': [breaking, nonBreaking, breakingIfAfterTrue],
      '/allowReserved': [breaking, nonBreaking, breakingIfAfterTrue],
    },
  }),
  '/headers': objArray("name", paramsRules),
  '/cookie': objArray("name", paramsRules),
  '/body': {
    '/': [nonBreaking, breaking, breaking],
    '/contents': contentsRules,
    '/required': [breaking, nonBreaking, breakingIfAfterTrue],
    '/description': allAnnotation
  },
}

const headersRules: Rules = {
  '/': allUnclassified,
  '/*': {
    "/": addNonBreaking,
    '/name': [nonBreaking, breaking, breaking],
    '/style': allUnclassified,
    '/description': allAnnotation,
    '/schema': jsonSchemaRules(allBreaking),
    '/explode': allUnclassified,
    '/required': [breaking, nonBreaking, breakingIfAfterTrue],
    '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
  }
}

const responsesRules: Rules = {
  "/": addNonBreaking,
  "/*": {
    "/": addNonBreaking,
    '/code': allUnclassified,
    '/contents': contentsRules,
    '/headers': objArray("name", headersRules),
    '/description': allAnnotation
  }
}

const serverRules: Rules = {
  '/': [nonBreaking, breaking, breaking],
  '/url': [nonBreaking, breaking, breaking],
  '/name': allAnnotation,
  '/description': allAnnotation,
  '/variables': [nonBreaking, breaking, breaking],
}

const securityRules: Rules = {
  "/": [breaking, nonBreaking, unclassified],
  "/*": [breaking, nonBreaking, unclassified],
}

const modelRules: Rules = {
  '/': [nonBreaking, breaking, breaking],
  '/data': () => jsonSchemaRules(addNonBreaking),
  '/*': allAnnotation,
}

const operationRules: Rules = {
  '/': [nonBreaking, breaking, breaking],
  '/data': {
    // Node common
    '/id': allAnnotation,
    '/iid': allAnnotation,
    '/tags': allAnnotation,
    '/summary': allAnnotation,
    '/description': allAnnotation,

    // Operation
    '/method': [nonBreaking, breaking, breaking],
    '/path': [nonBreaking, breaking, breaking],
    '/request': requestRules,
    '/responses': objArray("code", responsesRules),
    '/servers': {
      '/': allUnclassified,
      '/*': serverRules
    },
    '/callbacks': childrenArray({
      '/callbackName': allAnnotation,
      '/method': [nonBreaking, breaking, breaking],
      '/path': [nonBreaking, breaking, breaking],
      '/request': requestRules,
      '/responses': objArray("code", responsesRules),
      '/deprecated': allUnclassified,
      '/internal': allUnclassified,
      '/extensions': allUnclassified,
    }),
    '/security': securityRules,
    '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
    '/internal': allUnclassified,
    '/extensions': allUnclassified
  },
  '/*': allAnnotation,
}

const serviceRules: Rules = {
  // Node common
  '/id': allAnnotation,
  '/iid': allAnnotation,
  '/tags': allAnnotation,
  '/summary': allAnnotation,
  '/description': allAnnotation,

  // service rules
  '/name': allAnnotation,
  '/version': allAnnotation,
  '/servers': {
    '/': [nonBreaking, breaking, breaking],
    '/*': serverRules
  },
  '/security': securityRules,
  '/securitySchemes': objArray("name", {
    '/': addNonBreaking,
    '/*': {
      "/": [breaking, nonBreaking, breaking],
      "/type": [breaking, nonBreaking, breaking],
      "/description": allAnnotation,
      "/name": [breaking, nonBreaking, breaking],
      "/in": [breaking, nonBreaking, breaking],
      "/scheme": [breaking, nonBreaking, breaking],
      "/bearerFormat": allAnnotation,
      "/flows": [breaking, nonBreaking, breaking],
      "/openIdConnectUrl": allAnnotation,
    },
  }),
  '/termsOfService': allAnnotation,
  '/contact': allAnnotation,
  '/license': [breaking, breaking, breaking],
  '/logo': allAnnotation
}

export const serviceNodeRules: Rules = {
  '/*': allAnnotation,
  '/data': serviceRules,
  '/children': childrenArray({
    '/': [nonBreaking, breaking, breaking],
    '/*': ({ type }) => type === "model" ? modelRules : operationRules,
  }),
  "/components": {
    "/": [nonBreaking, nonBreaking, nonBreaking],
    "/schemas": {
      "/": [nonBreaking, breaking, breaking],
      "/*": jsonSchemaRules(addNonBreaking),
    },
  },
}
