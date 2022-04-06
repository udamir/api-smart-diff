import { 
  allAnnotation, allBreaking, allUnclassified, 
  unclassified, addNonBreaking, breaking, nonBreaking
} from "../constants"
import { breakingIfAfterTrue, enumRules } from "../utils"
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
  '/name': [nonBreaking, breaking, breaking],
  '/style': allUnclassified,
  '/description': allAnnotation,
  '/explode': allUnclassified,
  '/required': [breaking, nonBreaking, breakingIfAfterTrue],
  '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
}

const contentRules: Rules = {
  '/': [nonBreaking, breaking, breaking],
  '/mediaType': [nonBreaking, breaking, breaking],
  '/schema': jsonSchemaRules(allBreaking),
  '/examples': allAnnotation,
  '/encodings': [nonBreaking, breaking, breaking],
}

const requestRules: Rules = {
  '/path': {
    '/': [nonBreaking, breaking, breaking],
    '/*': paramRules,
  },
  '/query': {
    '/': [nonBreaking, breaking, breaking],
    '/*': {
      ...paramRules,
      '/allowEmptyValue': [breaking, nonBreaking, breakingIfAfterTrue],
      '/allowReserved': [breaking, nonBreaking, breakingIfAfterTrue],
    },
  },
  '/headers': {
    '/': [nonBreaking, breaking, breaking],
    '/*': paramRules
  },
  '/cookie': {
    '/': [nonBreaking, breaking, breaking],
    '/*': paramRules
  },
  '/body': {
    '/': [nonBreaking, breaking, breaking],
    '/contents': contentArray({
      '/': allUnclassified,
      '/*': contentRules
    }),
    '/required': [breaking, nonBreaking, breakingIfAfterTrue],
    '/description': allAnnotation
  },
}

const headersRules: Rules = {
  '/': allUnclassified,
  '/*': {
    '/name': [nonBreaking, breaking, breaking],
    '/style': allUnclassified,
    '/description': allAnnotation,
    '/explode': allUnclassified,
    '/required': [breaking, nonBreaking, breakingIfAfterTrue],
    '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
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

const operationRules: Rules = {
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
  '/responses': responseRules,
  '/servers': {
    '/': allUnclassified,
    '/*': serverRules
  },
  '/callbacks': childrenArray({
    '/callbackName': allAnnotation,
    '/method': [nonBreaking, breaking, breaking],
    '/path': [nonBreaking, breaking, breaking],
    '/request': requestRules,
    '/responses': responseRules,
    '/deprecated': allUnclassified,
    '/internal': allUnclassified,
    '/extensions': allUnclassified,
  }),
  '/security': securityRules,
  '/deprecated': [breaking, nonBreaking, breakingIfAfterTrue],
  '/internal': allUnclassified,
  '/extensions': allUnclassified
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
  '/securitySchemes': [breaking, nonBreaking, breaking],
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
