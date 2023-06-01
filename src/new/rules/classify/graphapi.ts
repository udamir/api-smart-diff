import { addNonBreaking, allAnnotation, allUnclassified, breaking, nonBreaking } from "../constants"
import { breakingIfAfterTrue, jsonSchemaRules } from "./jsonschema"
import { ClassifyRules } from "../types"

export const graphApiOperationRules: ClassifyRules = {
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

const graphApiDirectiveRules: ClassifyRules = {
  "/meta": allAnnotation  
}

// Base Type
const graphApiBaseTypeRules: ClassifyRules = {
  ...jsonSchemaRules(addNonBreaking),
  "/description": allAnnotation,
  "/directives": {
    "/*": () => graphApiDirectiveRules
  }
}

// Named Type
const graphApiNamedTypeRules: ClassifyRules = {
  ...graphApiBaseTypeRules,
  "/title": allAnnotation,
}

// SCALAR
const graphApiScalarRules: ClassifyRules = {
  ...graphApiNamedTypeRules,
  "/specifiedByURL": allAnnotation
}

const graphApiObjectRules: ClassifyRules = {
  ...graphApiNamedTypeRules,
  "/properties": {
    "/*": () => graphApiFieldRules
  }
}

const graphApiUnionRules: ClassifyRules = {
  ...graphApiNamedTypeRules,
  "/oneOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => graphApiObjectRules,
  },
}

const graphApiEnumRules: ClassifyRules = {
  ...graphApiNamedTypeRules,
  "/oneOf": {
    "/": [breaking, nonBreaking, breaking],
    "/*": () => graphApiScalarRules,
  },
}

const graphApiInputValueRules: ClassifyRules = {
  "/title": allAnnotation,
  "/description": allAnnotation,
  "/required": [breaking, nonBreaking, breakingIfAfterTrue],
  "/schema": () => graphApiTypesRules,
  "/default": addNonBreaking,
  "/directives": {
    "/*": () => graphApiDirectiveRules
  }
}

const graphApiInputObjectRules: ClassifyRules = {
  ...graphApiNamedTypeRules,
  "/inputFields": {
    "/*": graphApiInputValueRules
  }
}

const graphApiListRules: ClassifyRules = {
  ...graphApiNamedTypeRules,
  "/items": () => graphApiTypesRules
}

const graphApiFieldRules: ClassifyRules = {
  ...graphApiBaseTypeRules,
  "/args": {
    "/*": () => graphApiInputValueRules
  }
}

export const graphApiTypesRules: ClassifyRules = {
  ...graphApiScalarRules,
  ...graphApiObjectRules,
  ...graphApiUnionRules,
  ...graphApiListRules,
  ...graphApiInputObjectRules
}

export const graphapiRules: ClassifyRules = {
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
