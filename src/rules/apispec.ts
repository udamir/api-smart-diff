import { allAnnotation, allBreaking, allUnclassified, RuleMeta } from "../constants"
import { Classifier, Rules } from "../types"
import { jsonSchemaRules } from "."

const objectArrayRule = (rules: Rules, arrayObjectKeys: string[] = []): Rules => {
  rules[RuleMeta] = { arrayObjectKeys }
  return rules
}

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
    '/contents': objectArrayRule({
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
  '/contents': objectArrayRule({
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
  '/callbacks': objectArrayRule({
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

const operationsRules = objectArrayRule(operationRules, [])

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

export const apiSpecRules = {
  '/service': serviceRules,
  '/operations': operationsRules
}
