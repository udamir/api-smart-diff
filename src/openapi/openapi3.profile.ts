import type { JsonSchemaDraft } from "../jsonSchema"
import type { OpenApiVersion } from "./openapi3.types"

/**
 * Version profile of an OpenAPI document: the rule tree is generated from these flags, so OpenAPI 3.2 is a profile
 * row instead of a second tree (DESIGN_PROPOSALS §7.1). Cross-version comparisons use the profile of the higher
 * version.
 */
export interface OpenApiProfile {
  version: OpenApiVersion
  // nullable & boolean exclusive bounds (3.0) vs type arrays & numeric bounds (3.1+)
  schemaDraft: JsonSchemaDraft
  // operation keys of a path item (3.2 adds `query`)
  methods: readonly string[]
  // 3.2: `additionalOperations` on path items
  additionalOperations: boolean
  // 3.2 adds `querystring`
  parameterLocations: readonly string[]
  // 3.1+: root `webhooks`, `components.pathItems`
  webhooks: boolean
  componentsPathItems: boolean
  // 3.2: `components.mediaTypes`
  componentsMediaTypes: boolean
  // 3.2: media type `itemSchema` / `itemEncoding` / `prefixEncoding`
  mediaTypeStreaming: boolean
  // 3.2: `tags[].parent` / `kind` / `summary`
  tagHierarchy: boolean
  // 3.2: `flows.deviceAuthorization`, `oauth2MetadataUrl`, security scheme `deprecated`
  oauthDeviceFlow: boolean
  // 3.2: Example `dataValue` / `serializedValue`
  exampleValues: boolean
  // 3.2: `xml.nodeType`
  xmlNodeType: boolean
  // 3.2: `discriminator.defaultMapping`
  discriminatorDefaultMapping: boolean
  // 3.2: `$self`
  self: boolean
}

const baseMethods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const
const baseLocations = ["query", "header", "path", "cookie"] as const

export const openApiProfile = (version: OpenApiVersion | "3.0.x" | "3.1.x" | undefined = "3.0"): OpenApiProfile => {
  const v: OpenApiVersion = version === "3.0.x" ? "3.0" : version === "3.1.x" ? "3.1" : version
  const is31 = v !== "3.0"
  const is32 = v === "3.2"
  return {
    version: v,
    schemaDraft: is31 ? "2020-12" : "draft-04",
    methods: is32 ? [...baseMethods, "query"] : baseMethods,
    additionalOperations: is32,
    parameterLocations: is32 ? [...baseLocations, "querystring"] : baseLocations,
    webhooks: is31,
    componentsPathItems: is31,
    componentsMediaTypes: is32,
    mediaTypeStreaming: is32,
    tagHierarchy: is32,
    oauthDeviceFlow: is32,
    exampleValues: is32,
    xmlNodeType: is32,
    discriminatorDefaultMapping: is32,
    self: is32,
  }
}
