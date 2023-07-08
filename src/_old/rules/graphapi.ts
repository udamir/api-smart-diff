import { addNonBreaking, allAnnotation, allUnclassified, breaking, nonBreaking } from "../constants"
import { jsonSchemaRules } from "./jsonschema"
import { breakingIfAfterTrue } from "../utils"
import { Rules } from "../types"

export const graphApiOperationRules: Rules = {
  "/title": allAnnotation,
  "/description": allAnnotation,
  "/args": {
    "/*": () => graphApiInputValueRules
  },
  "/response": () => graphApiTypesRules,
  "/directives": {
    "/*": () => graphApiDirectiveRules
  }
}

const graphApiDirectiveRules: Rules = {
  "/meta": allAnnotation  
}

// Base Type
const graphApiBaseTypeRules: Rules = {
  ...jsonSchemaRules(addNonBreaking),
  "/description": allAnnotation,
  "/directives": {
    "/*": () => graphApiDirectiveRules
  }
}

// Named Type
const graphApiNamedTypeRules: Rules = {
  ...graphApiBaseTypeRules,
  "/title": allAnnotation,
}

// SCALAR
const graphApiScalarRules: Rules = {
  ...graphApiNamedTypeRules,
  "/specifiedByURL": allAnnotation
}

const graphApiObjectRules: Rules = {
  ...graphApiNamedTypeRules,
  "/properties": {
    "/*": () => graphApiFieldRules
  }
}

const graphApiUnionRules: Rules = {
  ...graphApiNamedTypeRules,
  "/oneOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => graphApiObjectRules,
  },
}

const graphApiEnumRules: Rules = {
  ...graphApiNamedTypeRules,
  "/oneOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => graphApiScalarRules,
  },
}

const graphApiInputValueRules: Rules = {
  "/title": allAnnotation,
  "/description": allAnnotation,
  "/required": [breaking, nonBreaking, breakingIfAfterTrue],
  "/schema": () => graphApiTypesRules,
  "/default": addNonBreaking,
  "/directives": {
    "/*": () => graphApiDirectiveRules
  }
}

const graphApiInputObjectRules: Rules = {
  ...graphApiNamedTypeRules,
  "/inputFields": {
    "/*": graphApiInputValueRules
  }
}

const graphApiListRules: Rules = {
  ...graphApiNamedTypeRules,
  "/items": () => graphApiTypesRules
}

const graphApiFieldRules: Rules = {
  ...graphApiBaseTypeRules,
  "/args": {
    "/*": () => graphApiInputValueRules
  }
}

export const graphApiTypesRules: Rules = {
  ...graphApiScalarRules,
  ...graphApiObjectRules,
  ...graphApiUnionRules,
  ...graphApiListRules,
  ...graphApiInputObjectRules
}

export const graphapiRules: Rules = {
  "/queries": {
    "/*": graphApiOperationRules
  },
  "/mutations": {
    "/*": graphApiOperationRules
  },
  "/subscriptions": {
    "/*": graphApiOperationRules
  },

  "/components": {
    "/scalars": {
      "/*": graphApiScalarRules,
    },
    "/objects": {
      "/*": graphApiObjectRules,
    },
    "/interfaces": {
      "/*": graphApiObjectRules,
    },
    "/unions": {
      "/*": graphApiUnionRules,
    },
    "/enums": {
      "/*": graphApiEnumRules,
    },
    "/inputObjects": {
      "/*": graphApiInputObjectRules,
    },
    "/directives": {
      "/*": {
        "/": addNonBreaking,
        "/title": allAnnotation,
        "/description": allAnnotation,
        "/locations": allAnnotation,
        "/repeatable": allUnclassified,  
        "/args": {
          "/": addNonBreaking,
          "/*": graphApiInputValueRules,
        },
      },
    },
  }
}
