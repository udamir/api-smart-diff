import { allAnnotation, allBreaking, allUnclassified, addNonBreaking, breaking, nonBreaking } from "../constants"
import { enumRules } from "../utils"
import { jsonSchemaRules } from "."
import { Rules } from "../types"

const childrenArray = (rules: Rules) => enumRules(rules, (b, a) => {
  if (a.type !== b.type) {
    return false
  }
  const beforePath = b.data.path?.replace(new RegExp("\{.*?\}", "g"), "*")
  const afterPath = a.data.path?.replace(new RegExp("\{.*?\}", "g"), "*")
  return beforePath === afterPath && b.data.method === a.data.method
})

const contentArray = (rules: Rules) => enumRules(rules, (b, a) => {
  return a.mediaType === b.mediaType
})


const paramRules: Rules = {
  '/name': allUnclassified,
  '/style': allUnclassified,
  '/description': allAnnotation,
  '/explode': allUnclassified,
  '/required': allUnclassified,
  '/deprecated': allUnclassified,
}

const contentRules: Rules = {
  '/': allUnclassified,
  '/mediaType': allUnclassified,
  '/schema': jsonSchemaRules(allUnclassified),
  '/examples': allAnnotation,
  '/encodings': allUnclassified
}

const requestRules: Rules = {
  '/path': {
    '/': allUnclassified,
    '/*': paramRules,
  },
  '/query': {
    '/': allUnclassified,
    '/*': {
      ...paramRules,
      '/allowEmptyValue': allUnclassified,
      '/allowReserved': allUnclassified,
    },
  },
  '/headers': {
    '/': allUnclassified,
    '/*': paramRules
  },
  '/cookie': {
    '/': allUnclassified,
    '/*': paramRules
  },
  '/body': {
    '/': allUnclassified,
    '/contents': contentArray({
      '/': allUnclassified,
      '/*': contentRules
    }),
    '/required': allUnclassified, 
    '/description': allAnnotation
  },
}

const headersRules = {
  '/': allUnclassified,
  '/*': {
    '/name': allUnclassified,
    '/style': allUnclassified,
    '/description': allAnnotation,
    '/explode': allUnclassified,
    '/required': allUnclassified,
    '/deprecated': allUnclassified,
  }
}

const responseRules: Rules = {
  '/code': allUnclassified,
  '/contents': contentArray({
    '/': allUnclassified, 
    '/*': contentRules,
  }),
  '/headers': headersRules,
  '/description': allAnnotation
}

const serverRules = {
  '/url': allUnclassified,
  '/name': allUnclassified,
  '/description': allAnnotation,
  '/variables': allUnclassified,
}

const operationRules: Rules = {
  // Node common
  '/id': allAnnotation,
  '/iid': allAnnotation,
  '/tags': allAnnotation,
  '/summary': allAnnotation,
  '/description': allAnnotation,

  // Operation
  '/method': allBreaking,
  '/path': allBreaking,
  '/request': requestRules,
  '/responses': responseRules,
  '/servers': {
    '/': allUnclassified,
    '/*': serverRules
  },
  '/callbacks': childrenArray({
    '/callbackName': allUnclassified,
    '/method': allUnclassified,
    '/path': allUnclassified,
    '/request': requestRules,
    '/responses': responseRules,
    '/deprecated': allUnclassified,
    '/internal': allUnclassified,
    '/extensions': allUnclassified,
  }),
  '/security': allUnclassified,
  '/deprecated': allUnclassified,
  '/internal': allUnclassified,
  '/extensions': allUnclassified
}

const serviceRules = {
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
    '/': allUnclassified,
    '/*': serverRules
  },
  '/security': allUnclassified,
  '/securitySchemes': allUnclassified,
  '/termsOfService': allUnclassified,
  '/contact': allAnnotation,
  '/license': allUnclassified,
  '/logo': allAnnotation
}

export const serviceNodeRules: Rules = {
  '/*': allAnnotation,
  '/data': serviceRules,
  '/children': childrenArray({
    '/': [nonBreaking, breaking, breaking],
    '/*': {
      '/': [nonBreaking, breaking, breaking],
      '/data': operationRules,
      '/*': allAnnotation,
    }
  }),
  "/components": {
    "/": [nonBreaking, nonBreaking, nonBreaking],
    "/schemas": {
      "/": [nonBreaking, breaking, breaking],
      "/*": jsonSchemaRules(addNonBreaking),
    },
  },
}
