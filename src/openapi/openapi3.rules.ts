import {
  caseInsensitiveValue,
  componentOf,
  mediaTypeRenameClassifier,
  responseRemoveClassifier,
  responseRenameClassifier,
  componentRule,
  fixed,
  isIgnoredHeaderParameter,
  queryOnly,
  pathRenameClassifier,
  globalSecurityClassifyRule,
  globalSecurityRequirementSchemeClassifyRule,
  globalSecurityScopeClassifyRule,
  securitySchemeRule,
  headerClassifyRule,
  headersClassifyRule,
  globalSecurityItemClassifyRule,
  operationSecurityClassifyRule,
  operationSecurityItemClassifyRule,
  paramClassifyRule,
  paramSchemaTypeClassifyRule,
  parameterExplodeClassifyRule,
  parameterNameClassifyRule,
  parameterRequiredClassifyRule,
  parameterStyleClassifyRule,
  requestBodyClassifyRule,
  requiredFlagClassifyRule,
  securityRequirementSchemeClassifyRule,
  securityScopeClassifyRule,
} from "./openapi3.classify"
import {
  allAnnotation,
  allBreaking,
  allDeprecated,
  allUnclassified,
  annotation,
  breaking,
  risky,
  caseInsensitiveKeyMappingResolver,
  nonBreaking,
  unclassified,
  CompareScopes,
  deepEqualsUniqueItemsMappingResolver,
  excludeExtensions,
  extensionRules,
  staticRules,
} from "../core"
import {
  componentChangeAnnotation,
  documentChangeAnnotation,
  encodingChangeAnnotation,
  headerChangeAnnotation,
  operationChangeAnnotation,
  parameterChangeAnnotation,
  securityChangeAnnotation,
  serversChangeAnnotation,
  serverUrlChangeAnnotation,
  tagsChangeAnnotation,
  contentChangeAnnotation,
  pathItemChangeAnnotation,
  pathMethodChangeAnnotation,
  openApiExtensionChangeAnnotation,
  requestBodyChangeAnnotation,
  responseChangeAnnotation,
} from "./openapi3.annotate"
import {
  createPathItemsTransform,
  transformExample,
  transformOperation,
  transformParameterItem,
  transformPaths,
  transformReferenceOverride,
  createContainerAlignTransform,
  transformComponents,
  transformEncodingDefaults,
  transformHeaderDefaults,
  transformRequestBodyDefaults,
} from "./openapi3.transform"
import {
  contentMediaTypeMappingResolver,
  paramMappingResolver,
  pathMappingResolver,
  securityRequirementMappingResolver,
  securityRequirementsMappingResolver,
  securitySchemesMappingResolver,
  componentMappingResolver,
  responsesMappingResolver,
} from "./openapi3.mapping"
import { refsCompareResolver, SCHEMA_KIND, valueCompareResolver } from "../jsonSchema"
import type { OpenApi3RulesOptions } from "./openapi3.types"
import type { ClassifyRule, CompareRules, CompareScope, DiffTypeClassifier, MappingResolver } from "../types"
import { openApiSchemaRules } from "./openapi3.schema"
import { enumMappingResolver } from "../jsonSchema"
import { openApiProfile } from "./openapi3.profile"
import { isObject, isString } from "../utils"
import { openApiRenames, repointedOpenApiReference } from "./openapi3.utils"

const paramRule = (classify: ClassifyRule) => ({ $: classify, annotate: parameterChangeAnnotation })
const documentAnnotationRule: CompareRules = { $: allAnnotation, annotate: documentChangeAnnotation }
const operationAnnotationRule: CompareRules = { $: allAnnotation, annotate: operationChangeAnnotation }

// direction of a path item: an API operation, or a callback (the API sends the request and receives the response)
interface Direction {
  request: CompareScope
  response: CompareScope
}
const apiDirection: Direction = { request: CompareScopes.request, response: CompareScopes.response }
const callbackDirection: Direction = { request: CompareScopes.response, response: CompareScopes.request }

/** OpenAPI 3.x rules generated from the version profile (DESIGN_PROPOSALS §7). */
export const openapi3Rules = (options: OpenApi3RulesOptions = {}): CompareRules => {
  const profile = options.profile ?? openApiProfile(options.version)
  const schemaRules = openApiSchemaRules({ ...options, profile })
  // 3.1+ Reference Object `summary` / `description` overrides (ISSUE-60)
  const referenceOverride = profile.version === "3.0" ? [] : [transformReferenceOverride]
  // specification extensions (`x-*`) of every object that allows them (POLICY-06 / POLICY-07, ISSUE-54 / 73 / 131)
  const ext = extensionRules(openApiExtensionChangeAnnotation, options.extensions)

  // a whole schema added or removed follows the direction (ISSUE-62 (fixed)): constraining an unconstrained request
  // body or header rejects values, dropping the constraint does not; for a response it is the reverse; a replaced
  // schema is breaking in both directions
  const schemaRule = (): CompareRules => ({ ...schemaRules, $: schemaPresenceRule, kind: SCHEMA_KIND })

  const serversRules: CompareRules = {
    $: allAnnotation,
    annotate: serversChangeAnnotation,
    "/**": { $: allAnnotation },
    mapping: serverMappingResolver,
    "/*": {
      $: allAnnotation,
      "/url": { $: allAnnotation, annotate: serverUrlChangeAnnotation },
      ...ext,
      "/variables": {
        $: allAnnotation,
        "/*": {
          $: allAnnotation,
          ...ext,
          "/enum": { $: allAnnotation, mapping: enumMappingResolver, "/*": { $: allAnnotation } },
        },
      },
    },
  }

  const exampleRules: CompareRules = {
    $: allAnnotation,
    ...ext,
    compare: refsCompareResolver,
    transform: [...referenceOverride, ...(profile.exampleValues ? [transformExample] : [])],
    "/*": { $: allAnnotation, compare: valueCompareResolver },
  }

  const examplesRules: CompareRules = {
    $: allAnnotation,
    "/*": exampleRules,
  }

  const parameterRules = (scope: CompareScope): CompareRules => ({
    scope,
    kind: "parameter",
    annotate: parameterChangeAnnotation,
    compare: refsCompareResolver,
    transform: [...referenceOverride, transformParameterItem],
    $: paramClassifyRule,
    "/name": paramRule(parameterNameClassifyRule),
    "/in": paramRule(fixed([nonBreaking, breaking, breaking])),
    // a parameter switching between `schema` and `content` changes its serialization: breaking either way
    "/schema": staticRules(() => ({
      ...schemaRules,
      kind: SCHEMA_KIND,
      $: fixed(allBreaking as any),
      "/type": {
        ...(schemaRules["/type"] as CompareRules),
        $: paramSchemaTypeClassifyRule,
      },
    })),
    "/content": contentRules,
    "/explode": paramRule(parameterExplodeClassifyRule),
    "/style": paramRule(parameterStyleClassifyRule),
    // both apply to query parameters only: elsewhere they have no effect (POLICY-10 decided (a), ISSUE-133)
    "/allowEmptyValue": paramRule(queryOnly(fixed([nonBreaking, breaking, breakingIfAfterTrueInverse]))),
    "/allowReserved": paramRule(queryOnly(fixed([nonBreaking, breaking, breakingIfAfterTrueInverse]))),
    "/description": paramRule(allAnnotation),
    "/required": paramRule(parameterRequiredClassifyRule),
    "/deprecated": paramRule(allDeprecated),
    // nested values of an object example are annotations too (ISSUE-73)
    "/example": { ...paramRule(allAnnotation), "/**": paramRule(allAnnotation) },
    "/examples": { ...examplesRules, annotate: parameterChangeAnnotation },
    "/*": paramRule(allAnnotation),
    ...ext,
  })

  // OAS: header parameters named `Accept`, `Content-Type` or `Authorization` SHALL be ignored (POLICY-10 decided (a),
  // ISSUE-133); a `$ref` parameter is checked by `paramClassifyRule`
  const ignoredParameterRules: CompareRules = {
    kind: "parameter",
    $: allAnnotation,
    annotate: parameterChangeAnnotation,
    "/**": { $: allAnnotation, annotate: parameterChangeAnnotation },
  }

  const parametersRules = (scope: CompareScope): CompareRules => {
    const itemRules = parameterRules(scope)
    return {
      $: fixed([nonBreaking, breaking, breaking]),
      mapping: paramMappingResolver,
      "/*": ({ value }) => (isIgnoredHeaderParameter(value) ? ignoredParameterRules : itemRules),
    }
  }

  // headers take the direction of their message: response headers are read by the client, encoding part headers are
  // sent by it (ISSUE-61 (fixed))
  const headerRules: CompareRules = {
    kind: "header",
    $: headerClassifyRule,
    annotate: headerChangeAnnotation,
    compare: refsCompareResolver,
    transform: [...referenceOverride, transformHeaderDefaults],
    "/description": { $: allAnnotation, annotate: headerChangeAnnotation },
    "/required": { $: requiredFlagClassifyRule, annotate: headerChangeAnnotation },
    "/deprecated": { $: allDeprecated, annotate: headerChangeAnnotation },
    "/schema": staticRules(() => schemaRule()),
    "/content": staticRules(() => contentRules),
    "/style": { $: fixed([nonBreaking, breaking, breaking]) },
    "/explode": { $: fixed([nonBreaking, breaking, breaking]) },
    "/example": { $: allAnnotation },
    "/examples": examplesRules,
    "/*": { $: allAnnotation },
    ...ext,
  }

  // OAS: a `Content-Type` entry of a Response or Encoding headers map SHALL be ignored (ISSUE-76)
  const ignoredHeaderRules: CompareRules = {
    kind: "header",
    $: allAnnotation,
    annotate: headerChangeAnnotation,
    "/**": { $: allAnnotation, annotate: headerChangeAnnotation },
  }

  const headersRules: CompareRules = {
    $: headersClassifyRule,
    mapping: caseInsensitiveKeyMappingResolver,
    "/*": ({ key }) => (isString(key) && key.toLowerCase() === "content-type" ? ignoredHeaderRules : headerRules),
  }

  const encodingRules: CompareRules = {
    annotate: encodingChangeAnnotation,
    $: fixed([breaking, nonBreaking, breaking]),
    "/*": {
      kind: "encoding",
      $: fixed([breaking, nonBreaking, breaking]),
      transform: [transformEncodingDefaults],
      "/contentType": { $: fixed([nonBreaking, breaking, breaking]) },
      "/headers": headersRules,
      "/style": { $: fixed([nonBreaking, breaking, breaking]) },
      "/explode": { $: fixed([nonBreaking, breaking, breaking]) },
      // accepting unencoded reserved characters keeps percent-encoded values valid (as for parameters, ISSUE-75)
      "/allowReserved": { $: fixed([nonBreaking, breaking, breakingIfAfterTrueInverse]) },
      // 3.2: nested encoding for array / object parts
      "/encoding": staticRules(() => encodingRules),
      "/itemEncoding": staticRules(() => encodingRules["/*"] as CompareRules),
      "/prefixEncoding": staticRules(() => ({
        $: fixed([breaking, nonBreaking, breaking]),
        "/*": encodingRules["/*"],
      })),
      "/*": { $: allAnnotation },
      ...ext,
    },
    "/**": {
      annotate: encodingChangeAnnotation,
    },
  }

  const mediaTypeRules: CompareRules = {
    kind: "mediaType",
    annotate: contentChangeAnnotation,
    "/*": {
      annotate: contentChangeAnnotation,
      $: allAnnotation,
    },
    $: fixed([nonBreaking, breaking, mediaTypeRenameClassifier]),
    compare: refsCompareResolver,
    ...ext,
    "/schema": staticRules(() => schemaRule()),
    "/example": { $: allAnnotation, compare: valueCompareResolver },
    "/examples": examplesRules,
    "/encoding": encodingRules,
    ...(profile.mediaTypeStreaming
      ? {
          "/itemSchema": staticRules(() => schemaRule()),
          "/itemEncoding": encodingRules["/*"] as CompareRules,
          "/prefixEncoding": { $: fixed([breaking, nonBreaking, breaking]), "/*": encodingRules["/*"] },
        }
      : {}),
  }

  const contentRules: CompareRules = {
    annotate: contentChangeAnnotation,
    $: fixed([nonBreaking, breaking, breaking]),
    mapping: contentMediaTypeMappingResolver,
    "/*": mediaTypeRules,
  }

  const requestBodyRules = (scope: CompareScope): CompareRules => ({
    scope,
    kind: "requestBody",
    annotate: requestBodyChangeAnnotation,
    $: requestBodyClassifyRule,
    compare: refsCompareResolver,
    transform: [...referenceOverride, transformRequestBodyDefaults],
    "/description": { $: allAnnotation, annotate: requestBodyChangeAnnotation },
    "/content": contentRules,
    "/required": { $: requiredFlagClassifyRule, annotate: requestBodyChangeAnnotation },
    "/*": { $: allAnnotation, annotate: requestBodyChangeAnnotation },
    ...ext,
  })

  const linkRules: CompareRules = {
    $: fixed([nonBreaking, breaking, breaking]),
    compare: refsCompareResolver,
    transform: referenceOverride,
    // POLICY-106: an operationRef that only follows a renamed path item component is no change
    "/operationRef": { $: fixed([breaking, nonBreaking, breaking]), compare: repointedOpenApiReference },
    "/operationId": { $: fixed([breaking, nonBreaking, breaking]) },
    "/parameters": {
      $: fixed([nonBreaking, breaking, breaking]),
      "/*": { $: fixed([nonBreaking, breaking, breaking]) },
    },
    "/requestBody": { $: fixed([nonBreaking, breaking, breaking]) },
    "/description": { $: allAnnotation },
    "/server": serversRules["/*"] as CompareRules,
    "/*": { $: allAnnotation },
    ...ext,
  }

  const responseRules = (scope: CompareScope): CompareRules => ({
    scope,
    kind: "response",
    annotate: responseChangeAnnotation,
    $: fixed([nonBreaking, responseRemoveClassifier, responseRenameClassifier]),
    compare: refsCompareResolver,
    transform: referenceOverride,
    "/description": { $: allAnnotation, annotate: responseChangeAnnotation },
    "/summary": { $: allAnnotation, annotate: responseChangeAnnotation },
    "/headers": headersRules,
    "/content": contentRules,
    "/links": { $: fixed([nonBreaking, breaking, breaking]), "/*": linkRules },
    "/*": { $: allAnnotation, annotate: responseChangeAnnotation },
    ...ext,
  })

  // the Responses object allows extensions next to its status codes (ISSUE-54)
  const responsesRules = (scope: CompareScope): CompareRules => ({
    $: fixed([nonBreaking, breaking, breaking]),
    mapping: excludeExtensions(responsesMappingResolver),
    "/*": responseRules(scope),
    ...ext,
  })

  // requirement alternatives are a set (ISSUE-65); inside one, schemes and scopes are sets too
  const securityRequirementRules = (
    itemRule: ClassifyRule,
    schemeRule: ClassifyRule,
    scopeRule: ClassifyRule,
  ): CompareRules => ({
    mapping: securityRequirementsMappingResolver,
    "/*": {
      $: itemRule,
      mapping: securityRequirementMappingResolver,
      "/*": {
        $: schemeRule,
        mapping: deepEqualsUniqueItemsMappingResolver,
        "/*": { $: scopeRule },
      },
    },
  })

  const operationRules = (direction: Direction): CompareRules => ({
    annotate: pathMethodChangeAnnotation,
    $: fixed([nonBreaking, breaking, unclassified]),
    transform: [transformOperation],
    "/*": operationAnnotationRule,
    ...ext,
    "/tags": {
      ...operationAnnotationRule,
      mapping: enumMappingResolver,
      "/*": operationAnnotationRule,
    },
    "/externalDocs": { ...operationAnnotationRule, "/**": operationAnnotationRule },
    "/parameters": parametersRules(direction.request),
    "/requestBody": requestBodyRules(direction.request),
    "/callbacks": {
      $: fixed([nonBreaking, breaking, breaking]),
      // lazy: a callback path item contains operations, which contain callbacks
      "/*": staticRules(() => callbackRules(direction)),
    },
    "/responses": responsesRules(direction.response),
    "/deprecated": { $: allDeprecated, annotate: operationChangeAnnotation },
    "/security": {
      annotate: securityChangeAnnotation,
      "/**": {
        annotate: securityChangeAnnotation,
      },
      $: operationSecurityClassifyRule,
      ...securityRequirementRules(
        operationSecurityItemClassifyRule,
        securityRequirementSchemeClassifyRule,
        securityScopeClassifyRule,
      ),
    },
    "/servers": serversRules,
  })

  const pathItemsTransform = createPathItemsTransform(profile)
  const pathItemRulesCache = new Map<Direction, CompareRules>()
  const pathItemRules = (direction: Direction): CompareRules => {
    let rules = pathItemRulesCache.get(direction)
    if (!rules) {
      rules = buildPathItemRules(direction)
      pathItemRulesCache.set(direction, rules)
    }
    return rules
  }

  // an entry of `webhooks` or of a callback: a new event / callback URL is non-breaking, a removed one breaks its
  // receivers (ISSUE-68)
  const mapEntryRulesCache = new Map<Direction, CompareRules>()
  const mapEntryPathItemRules = (direction: Direction): CompareRules => {
    let rules = mapEntryRulesCache.get(direction)
    if (!rules) {
      rules = { ...pathItemRules(direction), $: fixed([nonBreaking, breaking, breaking]) }
      mapEntryRulesCache.set(direction, rules)
    }
    return rules
  }

  // paths: a path item is added / removed per operation (`transformPaths`); a renamed path is a changed template
  // (non-breaking) or, when the effective URL is unchanged (server prefix moved into the path, ISSUE-80; repeated
  // slashes collapsed, POLICY-43 decided (b)), an annotation
  const buildPathItemRules = (direction: Direction): CompareRules => ({
    $: fixed([unclassified, unclassified, pathRenameClassifier]),
    transform: [pathItemsTransform],
    compare: refsCompareResolver,
    "/summary": { $: allAnnotation, annotate: pathItemChangeAnnotation },
    "/description": { $: allAnnotation, annotate: pathItemChangeAnnotation },
    "/servers": serversRules,
    "/parameters": parametersRules(direction.request),
    ...(profile.additionalOperations
      ? {
          "/additionalOperations": {
            $: fixed([nonBreaking, breaking, breaking]),
            "/*": operationRules(direction),
            ...ext,
          },
        }
      : {}),
    "/*": operationRules(direction),
    // a path item allows extensions next to its operations (ISSUE-54)
    ...ext,
  })

  // callbacks: the API is the client of the callback URL, so its request is a response-direction payload
  function callbackRules(direction: Direction): CompareRules {
    const inverted: Direction = direction === apiDirection ? callbackDirection : apiDirection
    return {
      $: fixed([nonBreaking, breaking, breaking]),
      compare: refsCompareResolver,
      "/*": mapEntryPathItemRules(inverted),
      ...ext,
    }
  }

  const pathsRules = (direction: Direction): CompareRules => ({
    $: fixed([nonBreaking, breaking, breaking]),
    transform: [transformPaths],
    mapping: excludeExtensions(pathMappingResolver),
    "/*": pathItemRules(direction),
    ...ext,
  })

  // every node of a security scheme is classified only while a requirement references the scheme (POLICY-11 decided
  // (a)); the definition offers ways to authenticate: a new flow or URL is an option more (non-breaking), a removed
  // one is an option less (breaking), and the requirements carry the classification of adding or removing a whole
  // scheme (ISSUE-64)
  const scheme = securitySchemeRule
  // a changed OAuth / OpenID Connect URL breaks clients configured with the old one only if it stops serving
  // (POLICY-05: risky)
  const endpointUrlRule: CompareRules = { $: scheme([breaking, nonBreaking, risky]) }
  const optionalUrlRule: CompareRules = { $: scheme([nonBreaking, breaking, risky]) }

  const oauthFlowRules: CompareRules = {
    $: scheme([nonBreaking, breaking, breaking]),
    "/authorizationUrl": endpointUrlRule,
    "/tokenUrl": endpointUrlRule,
    "/refreshUrl": optionalUrlRule,
    ...(profile.oauthDeviceFlow ? { "/deviceAuthorizationUrl": endpointUrlRule } : {}),
    "/scopes": {
      $: scheme([nonBreaking, breaking, breaking]),
      "/*": { $: scheme([nonBreaking, breaking, annotation]) },
    },
    "/*": { $: allAnnotation },
    ...ext,
  }

  const securitySchemeRules: CompareRules = {
    // a renamed scheme (identical definition, requirements repointed) is an annotation (ISSUE-78)
    $: scheme([nonBreaking, nonBreaking, ({ before, after }) => (before.key !== after.key ? annotation : breaking)]),
    compare: refsCompareResolver,
    transform: referenceOverride,
    "/type": { $: scheme([breaking, nonBreaking, breaking]) },
    "/description": { $: allAnnotation },
    "/name": { $: scheme([breaking, nonBreaking, breaking]) },
    "/in": { $: scheme([breaking, nonBreaking, breaking]) },
    // HTTP authentication scheme names are case-insensitive (RFC 9110 §11.1; ISSUE-77)
    "/scheme": { $: scheme([breaking, nonBreaking, caseInsensitiveValue(breaking)]) },
    "/bearerFormat": { $: allAnnotation },
    // the whole `flows` field goes with a change of the scheme `type` (a field of the new type is a new demand, as
    // `scheme` or `name`); a single flow added is one more way to obtain a token
    "/flows": {
      $: scheme([breaking, nonBreaking, breaking]),
      "/*": oauthFlowRules,
      ...ext,
    },
    "/openIdConnectUrl": endpointUrlRule,
    ...(profile.oauthDeviceFlow
      ? {
          "/oauth2MetadataUrl": optionalUrlRule,
          "/deprecated": { $: allDeprecated },
        }
      : {}),
    "/*": { $: allAnnotation },
    ...ext,
  }

  const tagRules: CompareRules = {
    $: allAnnotation,
    annotate: tagsChangeAnnotation,
    "/**": { $: allAnnotation },
    mapping: tagMappingResolver,
    "/*": { $: allAnnotation, "/**": { $: allAnnotation }, ...ext },
  }

  const rules: CompareRules = {
    ...ext,
    // components and security schemes renamed with every reference repointed (ISSUE-78, POLICY-101)
    referenceRenames: openApiRenames,
    // `paths`, `webhooks` and `components` present on one side only are compared entry by entry (ISSUE-160, ISSUE-68)
    transform: [
      createContainerAlignTransform(profile.webhooks ? ["paths", "webhooks", "components"] : ["paths", "components"]),
    ],
    "/openapi": documentAnnotationRule,
    ...(profile.self ? { "/$self": documentAnnotationRule } : {}),
    ...(profile.version !== "3.0" ? { "/jsonSchemaDialect": documentAnnotationRule } : {}),
    "/info": {
      ...documentAnnotationRule,
      "/**": documentAnnotationRule,
      ...ext,
    },
    "/servers": serversRules,
    "/paths": pathsRules(apiDirection),
    ...(profile.webhooks
      ? {
          // the API sends the webhook request and reads its response, as for a callback (decision §11.17,
          // POLICY-12 (a), ISSUE-135 (fixed))
          "/webhooks": {
            $: fixed([nonBreaking, breaking, breaking]),
            "/*": mapEntryPathItemRules(callbackDirection),
            ...ext,
          },
        }
      : {}),
    // every component is classified by the scopes that reference it, unreferenced components are unclassified
    // (decision §11.4; ISSUE-69: also responses, parameters, request bodies, headers, links, callbacks, path items and
    // media types); a component removed after its usages were repointed to an identical one is non-breaking (POLICY-18)
    "/components": {
      $: fixed([nonBreaking, breaking, breaking]),
      transform: [transformComponents],
      ...ext,
      "/schemas": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: componentMappingResolver("schemas"),
        "/*": staticRules(() => ({
          ...schemaRules,
          kind: SCHEMA_KIND,
          scope: CompareScopes.components,
          $: componentRule,
          annotate: componentChangeAnnotation,
        })),
      },
      "/responses": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: componentMappingResolver("responses"),
        "/*": { ...responseRules(CompareScopes.components), $: componentRule },
      },
      "/parameters": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: componentMappingResolver("parameters"),
        "/*": { ...parameterRules(CompareScopes.components), $: componentOf(paramClassifyRule) },
      },
      "/examples": { $: allAnnotation, mapping: componentMappingResolver("examples"), "/*": exampleRules },
      "/requestBodies": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: componentMappingResolver("requestBodies"),
        "/*": { ...requestBodyRules(CompareScopes.components), $: componentOf(requestBodyClassifyRule) },
      },
      "/headers": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: componentMappingResolver("headers", caseInsensitiveKeyMappingResolver),
        "/*": { ...headerRules, scope: CompareScopes.components, $: componentOf(headerClassifyRule) },
      },
      "/securitySchemes": {
        $: fixed([nonBreaking, nonBreaking, breaking]),
        mapping: securitySchemesMappingResolver,
        "/*": securitySchemeRules,
      },
      "/links": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: componentMappingResolver("links"),
        "/*": { ...linkRules, scope: CompareScopes.components, $: componentRule },
      },
      "/callbacks": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: componentMappingResolver("callbacks"),
        "/*": { ...callbackRules(apiDirection), scope: CompareScopes.components, $: componentRule },
      },
      ...(profile.componentsPathItems
        ? {
            "/pathItems": {
              $: fixed([nonBreaking, breaking, breaking]),
              mapping: componentMappingResolver("pathItems"),
              // the entry itself is usage-classified; its operations open their own request / response scopes
              "/*": { ...pathItemRules(apiDirection), scope: CompareScopes.components, $: componentRule },
            },
          }
        : {}),
      ...(profile.componentsMediaTypes
        ? {
            "/mediaTypes": {
              $: fixed([nonBreaking, breaking, breaking]),
              mapping: componentMappingResolver("mediaTypes"),
              "/*": { ...mediaTypeRules, scope: CompareScopes.components, $: componentRule },
            },
          }
        : {}),
      "/*": allUnclassifiedTree,
    },
    "/security": {
      $: globalSecurityClassifyRule,
      annotate: securityChangeAnnotation,
      "/**": { annotate: securityChangeAnnotation },
      ...securityRequirementRules(
        globalSecurityItemClassifyRule,
        globalSecurityRequirementSchemeClassifyRule,
        globalSecurityScopeClassifyRule,
      ),
    },
    "/tags": tagRules,
    "/externalDocs": {
      $: allAnnotation,
      annotate: documentChangeAnnotation,
      "/**": { $: allAnnotation, annotate: documentChangeAnnotation },
      ...ext,
    },
  }
  return rules
}

// a whole schema added or removed: narrowing a request, a guarantee for a response (6-tuple: replace stays breaking)
const schemaPresenceRule: ClassifyRule = [breaking, nonBreaking, breaking, nonBreaking, breaking, breaking]

// `allowEmptyValue` / `allowReserved`: turning the permission off rejects values that were accepted before
const breakingIfAfterTrueInverse: DiffTypeClassifier = (ctx) => (ctx.after.value ? nonBreaking : breaking)

const allUnclassifiedTree: CompareRules = { $: allUnclassified, "/**": { $: allUnclassified } }

const mapByKey =
  (identity: (item: unknown, index: number) => unknown): MappingResolver<number> =>
  (before, after) => {
    const result: { added: number[]; removed: number[]; mapped: Record<number, number> } = {
      added: [],
      removed: [],
      mapped: {},
    }
    const unmappedAfter = new Set((after as unknown[]).keys())
    ;(before as unknown[]).forEach((item, i) => {
      const id = identity(item, i)
      let found = -1
      for (const j of unmappedAfter) {
        if (id !== undefined && identity((after as unknown[])[j], j) === id) {
          found = j
          break
        }
      }
      if (found < 0) {
        result.removed.push(i)
      } else {
        result.mapped[i] = found
        unmappedAfter.delete(found)
      }
    })
    unmappedAfter.forEach((j) => result.added.push(j))
    return result
  }

// tags are matched by name, so reordering is not a change
const tagMappingResolver = mapByKey((tag) => (isObject(tag) ? tag.name : tag))

// servers are matched by `name` (3.2) when both items have one, else by `url`
const serverMappingResolver: MappingResolver<number> = (before, after, ctx) => {
  const byName = mapByKey((server) =>
    isObject(server) && server.name !== undefined ? `name:${server.name}` : undefined,
  )(before, after, ctx)
  const unmappedBefore = new Set(byName.removed)
  const unmappedAfter = new Set(byName.added)
  const result = { added: [] as number[], removed: [] as number[], mapped: { ...byName.mapped } }
  for (const i of unmappedBefore) {
    const url = isObject(before[i]) ? before[i].url : undefined
    let found = -1
    for (const j of unmappedAfter) {
      if (isObject(after[j]) && after[j].url === url) {
        found = j
        break
      }
    }
    if (found >= 0) {
      result.mapped[i] = found
      unmappedAfter.delete(found)
      unmappedBefore.delete(i)
    }
  }
  // the rest is paired by position (a changed url of an unnamed server is a replacement, not remove + add)
  const restAfter = [...unmappedAfter]
  for (const i of unmappedBefore) {
    const j = restAfter.shift()
    if (j === undefined) {
      result.removed.push(i)
    } else {
      result.mapped[i] = j
    }
  }
  result.added.push(...restAfter)
  return result
}
