import {
  exposedOnly,
  jsonSchemaAllowedSibling,
  getTarget,
  jsonSchemaRules,
  schemaRootOf,
  schemaAnnotationChange,
  transformJsonSchema,
  transformJsonSchemaCombiners,
  nonDirectional,
} from "../jsonSchema"
import { CompareScopes, allAnnotation, annotation, breaking, deepEqual, nonBreaking, risky } from "../core"
import type { OpenApi3SchemaRulesOptions } from "./openapi3.types"
import { transformOpenApiSchema, transformXml } from "./openapi3.transform"
import type {
  ChangeAnnotationResolver,
  ClassifyRule,
  CompareRules,
  Diff,
  DiffTypeClassifier,
  NodeContext,
} from "../types"
import { getKeyValue, isPlainObject } from "../utils"
import { openApiProfile } from "./openapi3.profile"
import { repointedOpenApiReference } from "./openapi3.utils"

/**
 * OpenAPI 3.0 `nullable: true` widens the schema by `null` (like 3.1 `type: [T, "null"]`): harmless for a request,
 * a value a response reader may not expect; `nullable: false` is the default (ISSUE-71 (fixed): was read as a
 * restricting flag).
 */
const nullableClassifyRule: ClassifyRule = [
  nonBreaking,
  ({ before }) => (before.value === true ? breaking : nonBreaking),
  ({ after }) => (after.value === true ? nonBreaking : breaking),
  ({ after }) => (after.value === true ? breaking : nonBreaking),
  nonBreaking,
  ({ after }) => (after.value === true ? breaking : nonBreaking),
]

const isXmlMediaType = (key: unknown) => {
  if (typeof key !== "string") {
    return false
  }
  const type = key.split(";")[0].trim().toLowerCase()
  return type === "application/xml" || type === "text/xml" || type.endsWith("+xml")
}

// the media type that uses the schema: the nearest ancestor that is an entry of a `content` map (or of 3.2
// `components.mediaTypes`); the chain reaches through `$ref` targets to the usage location
const usedAsXml = (node: NodeContext | undefined): boolean => {
  for (let current = node; current; current = current.up) {
    const parent = current.up
    if (parent && (parent.key === "content" || (parent.key === "mediaTypes" && parent.up?.key === "components"))) {
      return isXmlMediaType(current.key)
    }
  }
  return false
}

const valueText = (value: unknown) =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? ` \`${value}\`` : ""

/** A keyword change described by a text naming the keyword (and its value), at the schema's location. */
const keywordChange =
  (describe: (key: string | number, value: unknown, diff: Diff) => string): ChangeAnnotationResolver =>
  (diff, ctx) => {
    const key = diff.path[diff.path.length - 1]
    const value = diff.action === "remove" ? ctx.before.value : ctx.after.value
    const target = getTarget(diff.path, schemaRootOf(ctx))
    return { template: diff.action, params: { text: describe(key, value, diff), target } }
  }

const discriminatorChange = keywordChange((key, value, diff) => {
  const parent = diff.path[diff.path.length - 2]
  if (key === "discriminator") {
    return `discriminator${valueText(getKeyValue(value, "propertyName"))}`
  }
  if (key === "propertyName") {
    return `discriminator property name${valueText(value)}`
  }
  if (key === "mapping") {
    return "discriminator mapping"
  }
  if (key === "defaultMapping") {
    return `discriminator defaultMapping${valueText(value)}`
  }
  return parent === "mapping"
    ? `discriminator mapping \`${key}\`${value ? ` (${valueText(value).trim()})` : ""}`
    : String(key)
})

const xmlChange: ChangeAnnotationResolver = (diff, ctx) =>
  diff.type === annotation
    ? schemaAnnotationChange(diff, ctx)
    : keywordChange((key, value) => (key === "xml" ? "xml mapping" : `xml \`${key}\`${valueText(value)}`))(diff, ctx)

const isArraySchema = (schema: unknown) => {
  const type = getKeyValue(schema, "type")
  return (
    type === "array" || (Array.isArray(type) && type.includes("array")) || getKeyValue(schema, "items") !== undefined
  )
}

/**
 * The XML mapping of a schema without the keywords that do not change the serialization (POLICY-76 decided (b)):
 * `name` equal to the property name, `wrapped` on a non-array or false, `attribute: false`, the default 3.2 `nodeType`
 * (`none` for an array or a `$ref`, `element` otherwise) and extensions.
 */
const effectiveXml = (schema: NodeContext | undefined): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  const xml = getKeyValue(schema?.value, "xml")
  if (!schema || !isPlainObject(xml)) {
    return result
  }
  const propertyName = schema.up?.key === "properties" ? schema.key : undefined
  const array = isArraySchema(schema.value)
  for (const key of Object.keys(xml)) {
    const value = xml[key]
    if (
      key.startsWith("x-") ||
      (key === "name" && value === propertyName) ||
      (key === "wrapped" && (value !== true || !array)) ||
      (key === "attribute" && value !== true) ||
      (key === "nodeType" && value === (array || getKeyValue(schema.value, "$ref") !== undefined ? "none" : "element"))
    ) {
      continue
    }
    result[key] = value
  }
  return result
}

// the schema an `xml` node (or one of its keywords) belongs to
const xmlSchemaOf = (node: NodeContext): NodeContext | undefined => (node.key === "xml" ? node.up : node.up?.up)

const xmlClassifier: DiffTypeClassifier = ({ before, after }) => {
  if (!usedAsXml(before.value !== undefined ? before : after)) {
    return annotation
  }
  const bXml = effectiveXml(xmlSchemaOf(before))
  const aXml = effectiveXml(xmlSchemaOf(after))
  const key = before.key === "xml" ? undefined : before.key
  const same = key === undefined ? deepEqual(bXml, aXml) : deepEqual(bXml[key], aXml[key])
  return same ? annotation : breaking
}

const xmlClassifyRule: ClassifyRule = exposedOnly(nonDirectional([xmlClassifier, xmlClassifier, xmlClassifier]))

/**
 * JSON Schema rules with the OpenAPI schema object extensions. Direction (request / response) is no longer baked
 * into the rule set: the classifiers read the scope opened by the enclosing parameter, request body or response.
 */
export const openApiSchemaRules = (options: OpenApi3SchemaRulesOptions = {}): CompareRules => {
  const profile = options.profile ?? openApiProfile(options.version)
  const version = profile.schemaDraft

  return jsonSchemaRules({
    baseRules: {
      transform: [
        transformJsonSchemaCombiners([...jsonSchemaAllowedSibling, "discriminator", "xml", "externalDocs", "example"]),
        transformJsonSchema(version),
        transformOpenApiSchema,
      ],
      // openapi extentions
      "/nullable": { $: exposedOnly(nullableClassifyRule), annotate: discriminatorChange },
      // POLICY-26 decided (d), ISSUE-137: adding or removing a discriminator only names the property a reader
      // dispatches on (non-breaking); changing that property, removing or retargeting a mapping entry sends or reads
      // payloads as another schema (breaking); a new mapping entry is non-breaking
      "/discriminator": {
        $: exposedOnly(nonDirectional([nonBreaking, nonBreaking, breaking])),
        annotate: discriminatorChange,
        "/propertyName": {
          $: exposedOnly(nonDirectional([breaking, nonBreaking, breaking])),
          annotate: discriminatorChange,
        },
        "/mapping": {
          $: exposedOnly(nonDirectional([nonBreaking, breaking, breaking])),
          annotate: discriminatorChange,
          "/*": {
            $: exposedOnly(nonDirectional([nonBreaking, breaking, breaking])),
            annotate: discriminatorChange,
            // POLICY-106: a value that only follows a renamed schema is no change
            compare: repointedOpenApiReference,
          },
        },
        ...(profile.discriminatorDefaultMapping
          ? {
              "/defaultMapping": {
                // POLICY-39 decided (a), direction-aware: a request accepts payloads without (or with an unmapped)
                // discriminator value once a default names their schema (add non-breaking, retarget / remove
                // breaking); a response may now send such payloads (add risky), retargeting reinterprets them
                // (breaking), removing the default stops sending them (non-breaking)
                $: exposedOnly({
                  default: [nonBreaking, breaking, breaking],
                  [CompareScopes.response]: [risky, nonBreaking, breaking],
                }),
                annotate: discriminatorChange,
                compare: repointedOpenApiReference,
              },
            }
          : {}),
      },
      "/example": { $: allAnnotation, annotate: schemaAnnotationChange },
      "/externalDocs": {
        $: allAnnotation,
        annotate: schemaAnnotationChange,
        "/*": { $: allAnnotation, annotate: schemaAnnotationChange },
      },
      // POLICY-27 decided (c), ISSUE-147: `xml` decides the wire format where an XML media type (`application/xml`,
      // `text/xml`, `*+xml`) uses the schema (any change breaks producers or readers of the element); elsewhere it is
      // documentation
      "/xml": {
        $: xmlClassifyRule,
        annotate: xmlChange,
        ...(profile.xmlNodeType ? { transform: [transformXml] } : {}),
        "/*": { $: xmlClassifyRule, annotate: xmlChange },
      },
    },
    notMergeAllOf: options.notMergeAllOf,
    version,
    extensions: options.extensions,
  })
}
