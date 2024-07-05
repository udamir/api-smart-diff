import {
  allAnnotation,
  allDeprecated,
  breaking,
  nonBreaking,
  reverseClassifyRuleTransformer,
  transformComapreRules,
} from "../core"
import {
  jsonSchemaKeyChange,
  jsonSchemaRules,
  schemaStatusChange,
  transformJsonSchema,
  transformJsonSchemaCombiners,
} from "../jsonSchema"
import type { CompareRules } from "../types"
import {
  parentKeyChangeAnnotation,
  valuesAnnotationChange,
} from "./graphapi.annotate"
import {
  transformGraphSchema,
  transfromGraphSchemaDirective,
} from "./graphapi.transform"

export const graphApiSchemaRules = (response = false): CompareRules => {
  const graphSchemaRules = jsonSchemaRules({
    notMergeAllOf: true,
    baseRules: {
      transform: [
        transformJsonSchemaCombiners(),
        transformJsonSchema(),
        transformGraphSchema,
      ],
      // graphschema extentions
      "/nullable": {
        $: [nonBreaking, breaking, nonBreaking],
        annotate: jsonSchemaKeyChange,
      },
      "/specifiedByURL": { $: allAnnotation },
      "/args": () => ({
        ...graphApiSchemaRules(),
      }),
      "/values": {
        "/*": {
          "/description": {
            annotate: valuesAnnotationChange,
            $: allAnnotation,
          },
          "/deprecated": {
            annotate: valuesAnnotationChange,
            $: allDeprecated,
            "/reason": {
              annotate: valuesAnnotationChange,
              $: allDeprecated,
            },
          },
        },
      },
      "/deprecated": {
        $: allDeprecated,
        annotate: schemaStatusChange,
        "/reason": {
          annotate: parentKeyChangeAnnotation,
          $: allDeprecated,
        },
      },
      "/interfaces": {
        "/*": { $: allAnnotation },
      },
      "/directives": {
        "/*": {
          annotate: parentKeyChangeAnnotation,
          transform: [transfromGraphSchemaDirective],
          "/meta": {
            "/*": {
              annotate: parentKeyChangeAnnotation,
              $: allAnnotation,
            },
          },
        },
      },
    },
  })

  return response
    ? transformComapreRules(graphSchemaRules, reverseClassifyRuleTransformer)
    : graphSchemaRules
}
