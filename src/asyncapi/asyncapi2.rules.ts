import {
  addNonBreaking,
  allBreaking,
  allNonBreaking,
  allUnclassified,
  allAnnotation,
  breaking,
  nonBreaking,
  risky,
  CompareScopes,
  extensionRules,
  renameMappingResolver,
  staticRules,
} from "../core"
import {
  combinaryCompareResolver,
  createFields,
  jsonSchemaRules,
  refsCompareResolver,
  valueCompareResolver,
  SCHEMA_KIND,
} from "../jsonSchema"
import type { ClassifyRule, ClassifyTuple, CompareRules } from "../types"
import type { AsyncApiRulesOptions } from "./asyncapi.types"
import { asyncApiExtensionChangeAnnotation } from "./asyncapi.annotate"
import {
  componentMapRule,
  effectiveField,
  fixed,
  documentRenames,
  renameAware,
  securityListRule,
  traitItemRules,
  traitRule,
} from "./asyncapi.classify"
import { tagMappingResolver } from "./asyncapi.mapping"
import {
  asyncApiSchemaBaseRules,
  createPayloadDialectResolver,
  createSchemaDialects,
  schemaFormatRule,
} from "./asyncapi.schema"
import { securityRequirementsRules, securitySchemeRules } from "./asyncapi.security"
import { transformMessageOneOf } from "./asyncapi.transform"

// a whole payload / headers schema added or removed follows the operation direction, a replaced one is breaking in
// both (ISSUE-62 (fixed))
const schemaPresenceRule: ClassifyRule = [breaking, nonBreaking, breaking, nonBreaking, breaking, breaking]

// binding fields the AsyncAPI bindings specifications define as Schema Objects, per protocol (POLICY-19 decided (b),
// ISSUE-139): compared with the schema rules of the enclosing direction
const bindingSchemaFields: Record<string, string[]> = {
  ws: ["query", "headers"],
  http: ["query", "headers"],
  kafka: ["groupId", "clientId", "key"],
  mqtt: ["correlationData"],
  anypointmq: ["headers"],
}

export const asyncApi2Rules = ({ notMergeAllOf, extensions }: AsyncApiRulesOptions = {}): CompareRules => {
  // one schema rule set: `publish` (request semantics) and `subscribe` (response semantics) are scopes
  const schemaRules = jsonSchemaRules({
    notMergeAllOf,
    version: "draft-07",
    extensions,
    baseRules: asyncApiSchemaBaseRules,
  })
  const dialects = createSchemaDialects(schemaRules, { notMergeAllOf, extensions })
  // specification extensions (`x-*`) of every object that allows them (POLICY-06 / POLICY-07, ISSUE-131)
  const ext = extensionRules(asyncApiExtensionChangeAnnotation, extensions)

  const correlationIdRule = fixed(addNonBreaking as ClassifyTuple)
  const correlationIdRules: CompareRules = {
    $: correlationIdRule,
    compare: refsCompareResolver,
    "/location": { $: fixed(addNonBreaking as ClassifyTuple) },
    "/description": { $: allAnnotation },
    ...ext,
  }

  // bindings are protocol-specific and unclassified (POLICY-19), at any depth (ISSUE-146); a `$ref` to
  // `components.*Bindings` is resolved at the usage (ISSUE-108)
  const bindingValueRules: CompareRules = { $: allUnclassified, "/**": { $: allUnclassified } }
  const bindingSchemaRule = staticRules(() => ({ ...schemaRules, $: schemaPresenceRule, kind: SCHEMA_KIND }))
  const protocolRules = (fields: string[] = []): CompareRules => ({
    $: allUnclassified,
    compare: refsCompareResolver,
    "/*": bindingValueRules,
    ...Object.fromEntries(fields.map((field) => [`/${field}`, bindingSchemaRule])),
  })
  const bindingsRule: CompareRules = {
    kind: "bindings",
    $: allUnclassified,
    compare: refsCompareResolver,
    "/*": protocolRules(),
    ...Object.fromEntries(
      Object.entries(bindingSchemaFields).map(([protocol, fields]) => [`/${protocol}`, protocolRules(fields)]),
    ),
  }

  const tagsRules: CompareRules = {
    $: allAnnotation,
    mapping: tagMappingResolver,
    "/*": { $: allAnnotation, "/**": { $: allAnnotation } },
  }
  const externalDocsRules: CompareRules = { $: allAnnotation, "/**": { $: allAnnotation } }

  const schemeRules = securitySchemeRules(ext)
  const securityRules = securityRequirementsRules("2.x", schemeRules)

  const commonRules: CompareRules = {
    ...ext,
    transform: [createFields("tags", "traits", "bindings", "examples")],
    "/summary": { $: allAnnotation },
    "/tags": tagsRules,
    "/externalDocs": externalDocsRules,
    "/bindings": { ...bindingsRule, $: effectiveField("bindings", allUnclassified) },
  }

  // operationId is the identifier tools and generated clients use (ISSUE-112): a change or a removal breaks them
  const operationIdRule: ClassifyRule = fixed([nonBreaking, breaking, breaking])

  const operationTraitRules: CompareRules = {
    $: traitRule(fixed(addNonBreaking as ClassifyTuple), false),
    compare: refsCompareResolver,
    "/operationId": { $: operationIdRule },
    "/description": { $: allAnnotation },
    "/security": securityRules,
    ...commonRules,
  }

  const pubsubTraitsRules: CompareRules = {
    $: traitRule(fixed(addNonBreaking as ClassifyTuple), true),
    "/*": traitItemRules(operationTraitRules),
  }

  const messageBodyRules: CompareRules = {
    // a whole schema added or removed follows the operation direction (ISSUE-62 (fixed))
    "/headers": staticRules(() => ({
      ...schemaRules,
      $: effectiveField("headers", schemaPresenceRule),
      kind: SCHEMA_KIND,
    })),
    "/correlationId": { ...correlationIdRules, $: effectiveField("correlationId", correlationIdRule) },
    // the default schema format is the AsyncAPI schema of the document version (ISSUE-70)
    "/schemaFormat": { $: effectiveField("schemaFormat", schemaFormatRule) },
    // a message without contentType uses `defaultContentType` or a trait's value (ISSUE-70, ISSUE-103)
    "/contentType": { $: effectiveField("contentType", fixed(addNonBreaking as ClassifyTuple)) },
    // a message name is a machine-friendly label, not part of the wire format: non-breaking in both operation
    // directions (ISSUE-105 (fixed): a plain tuple was inverted in subscribe)
    "/name": { $: effectiveField("name", fixed(allNonBreaking as ClassifyTuple)) },
    "/title": { $: allAnnotation },
    "/description": { $: allAnnotation },
    "/examples": { $: allAnnotation, "/*": { $: allAnnotation, compare: valueCompareResolver } },
    "/messageId": { $: allAnnotation },
    ...commonRules,
  }

  const messageTraitRules: CompareRules = {
    kind: "messageTrait",
    $: traitRule(fixed(addNonBreaking as ClassifyTuple), false),
    compare: refsCompareResolver,
    ...messageBodyRules,
  }

  const messageRules: CompareRules = {
    kind: "message",
    $: fixed(allBreaking as ClassifyTuple),
    compare: refsCompareResolver,
    ...messageBodyRules,
    "/traits": {
      $: traitRule(fixed(addNonBreaking as ClassifyTuple), true),
      "/*": traitItemRules(messageTraitRules),
    },
    // the message's `schemaFormat` selects the schema language of the payload (ISSUE-109, ISSUE-144)
    "/payload": staticRules(() => ({
      ...schemaRules,
      kind: SCHEMA_KIND,
      $: schemaPresenceRule,
      compare: createPayloadDialectResolver(dialects, schemaPresenceRule),
    })),
  }

  const operationRules = (scope: string): CompareRules => ({
    scope,
    kind: "operation",
    $: fixed(addNonBreaking as ClassifyTuple),
    "/operationId": { $: effectiveField("operationId", operationIdRule) },
    "/description": { $: allAnnotation },
    "/traits": pubsubTraitsRules,
    "/security": { ...securityRules, $: effectiveField("security", securityListRule) },
    "/message": {
      ...messageRules,
      // a single message and `oneOf` alternatives are compared as alternatives (ISSUE-113)
      transform: [transformMessageOneOf, ...(messageRules.transform as [])],
      "/oneOf": {
        compare: combinaryCompareResolver,
        // a new alternative is harmless for publishers; subscribers may receive a message kind they do not know
        // (POLICY-05: risky in the subscribe scope)
        "/*": { ...messageRules, $: [nonBreaking, breaking, breaking, risky, breaking, breaking] },
      },
    },
    ...commonRules,
  })

  const infoRules: CompareRules = {
    $: allAnnotation,
    "/**": { $: allAnnotation },
    "/tags": tagsRules,
    ...ext,
  }

  // servers are deployment metadata: annotations (POLICY-09 decided (a)), except their security requirements
  // (ISSUE-101) and bindings
  const serverVariableRules: CompareRules = {
    compare: refsCompareResolver,
    $: allAnnotation,
    "/**": { $: allAnnotation },
    ...ext,
  }
  const serverRules: CompareRules = {
    compare: refsCompareResolver,
    transform: [createFields("variables", "bindings", "security")],
    $: allAnnotation,
    "/**": { $: allAnnotation },
    ...ext,
    "/variables": { $: allAnnotation, "/*": serverVariableRules },
    "/bindings": bindingsRule,
    "/security": securityRules,
    "/tags": tagsRules,
  }
  const serversRules: CompareRules = { $: allAnnotation, "/*": serverRules }

  const parameterRules: CompareRules = {
    kind: "parameter",
    compare: refsCompareResolver,
    $: fixed(addNonBreaking as ClassifyTuple),
    "/description": { $: allAnnotation },
    "/schema": staticRules(() => ({ ...schemaRules, $: fixed(allBreaking as ClassifyTuple), kind: SCHEMA_KIND })),
    "/location": { $: fixed(allBreaking as ClassifyTuple) },
    ...ext,
  }

  const channelRules: CompareRules = {
    kind: "channel",
    compare: refsCompareResolver,
    transform: [createFields("parameters", "bindings")],
    $: fixed(addNonBreaking as ClassifyTuple),
    ...ext,
    "/description": { $: allAnnotation },
    "/servers": { $: allAnnotation, "/*": { $: allAnnotation } },
    "/bindings": bindingsRule,
    "/subscribe": operationRules(CompareScopes.subscribe),
    "/publish": operationRules(CompareScopes.publish),
    "/parameters": {
      $: fixed(allBreaking as ClassifyTuple),
      "/*": parameterRules,
    },
  }

  const componentRule = (rules: CompareRules, classify: ClassifyRule = fixed([nonBreaking, breaking, breaking])) => ({
    ...rules,
    scope: CompareScopes.components,
    // a component renamed with every reference repointed (ISSUE-78)
    $: renameAware(classify),
  })
  // a map of components: classified when an entry of it is referenced, unclassified otherwise (ISSUE-143)
  const componentMap = (entry: CompareRules | ReturnType<typeof staticRules>, base?: ClassifyTuple): CompareRules => ({
    $: componentMapRule(base),
    // a component renamed with every reference repointed: one rename diff at the map (POLICY-100 / 101)
    mapping: renameMappingResolver(),
    "/*": entry,
  })

  return {
    ...ext,
    // components renamed with every reference repointed (ISSUE-78, POLICY-100 / 101)
    referenceRenames: documentRenames,
    transform: [createFields("channels", "components", "tags", "servers")],
    "/asyncapi": { $: allAnnotation },
    "/id": { $: allAnnotation },
    "/defaultContentType": { $: fixed(allBreaking as ClassifyTuple) },
    "/info": infoRules,
    "/servers": serversRules,
    "/channels": {
      $: fixed(addNonBreaking as ClassifyTuple),
      "/*": channelRules,
    },
    "/components": {
      $: fixed([nonBreaking, breaking, breaking]),
      ...ext,
      "/schemas": componentMap(staticRules(() => ({ ...componentRule(schemaRules), kind: SCHEMA_KIND }))),
      "/messages": componentMap(componentRule(messageRules)),
      "/messageTraits": componentMap(componentRule(messageTraitRules)),
      "/operationTraits": componentMap(componentRule(operationTraitRules)),
      "/parameters": componentMap(componentRule(parameterRules)),
      "/correlationIds": componentMap(componentRule(correlationIdRules)),
      "/servers": { $: allAnnotation, "/*": serverRules },
      "/serverVariables": componentMap(componentRule(serverVariableRules, allAnnotation)),
      "/channels": { $: fixed(addNonBreaking as ClassifyTuple), "/*": channelRules },
      // bindings are unclassified wherever they are declared (POLICY-19, ISSUE-108)
      "/serverBindings": componentMap(componentRule(bindingsRule, allUnclassified)),
      "/channelBindings": componentMap(componentRule(bindingsRule, allUnclassified)),
      "/operationBindings": componentMap(componentRule(bindingsRule, allUnclassified)),
      "/messageBindings": componentMap(componentRule(bindingsRule, allUnclassified)),
      // security schemes are referenced by name, not by `$ref`: classified as declared (ISSUE-101)
      "/securitySchemes": {
        $: fixed([nonBreaking, breaking, breaking]),
        // a scheme renamed with every requirement repointed: one rename diff here (POLICY-100 / 101)
        mapping: renameMappingResolver(),
        "/*": schemeRules,
      },
      "/*": { $: allAnnotation, "/**": { $: allAnnotation } },
    },
    "/tags": tagsRules,
    "/externalDocs": externalDocsRules,
  }
}
