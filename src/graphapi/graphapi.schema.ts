import {
  jsonSchemaKeyChange,
  jsonSchemaRules,
  schemaStatusChange,
  transformJsonSchema,
  transformJsonSchemaCombiners,
} from "../jsonSchema"
import {
  reverseClassifyRuleTransformer,
  transformComapreRules,
  allAnnotation,
  allDeprecated,
  nonBreaking,
  breaking,
} from "../core"
import {
  transformGraphSchema,
  transfromGraphSchemaDirective,
} from "./graphapi.transform"
import {
  parentKeyChangeAnnotation,
  valuesAnnotationChange,
} from "./graphapi.annotate"
import type { CompareRules } from "../types"

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
