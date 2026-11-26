import {
  allAnnotation,
  allBreaking,
  allUnclassified,
  breaking,
  nonBreaking,
  risky,
  CompareScopes,
  oppositeScopes,
  deepEqualsUniqueItemsMappingResolver,
  extensionRules,
  renameMappingResolver,
  repointedReferenceResolver,
  staticRules,
} from "../core"
import {
  createFields,
  jsonSchemaRules,
  nonDirectional,
  refsCompareResolver,
  SCHEMA_KIND,
  valueCompareResolver,
} from "../jsonSchema"
import type { ClassifyRule, ClassifyTuple, CompareRules, CompareTransformResolver, ScopeResolver } from "../types"
import type { AsyncApiRulesOptions } from "./asyncapi.types"
import { asyncApiExtensionChangeAnnotation } from "./asyncapi.annotate"
import { getStringValue } from "../utils"
import {
  channelAddressRule,
  componentMapRule,
  effectiveField,
  fixed,
  documentRenames,
  operationChannelMessages,
  renameAware,
  securityListRule,
  traitItemRules,
  traitRule,
} from "./asyncapi.classify"
import { messageRefMappingResolver, tagMappingResolver } from "./asyncapi.mapping"
import {
  asyncApiSchemaBaseRules,
  createMultiFormatResolver,
  createSchemaDialects,
  isMultiFormatSchema,
  transformMultiFormatSchema,
} from "./asyncapi.schema"
import { securityRequirementsRules, securitySchemeRules } from "./asyncapi.security"

// binding fields the AsyncAPI bindings specifications define as Schema Objects, per protocol (POLICY-19 decided (b),
// ISSUE-139): compared with the schema rules of the enclosing direction
const bindingSchemaFields: Record<string, string[]> = {
  ws: ["query", "headers"],
  http: ["query", "headers"],
  kafka: ["groupId", "clientId", "key"],
  mqtt: ["correlationData"],
  anypointmq: ["headers"],
}

// the JSON Schema normalization applies to plain schemas, not to a Multi Format Schema Object compared as such
const plainSchemaOnly =
  (transforms: CompareTransformResolver[]): CompareTransformResolver =>
  (before, after, ctx) => {
    if (isMultiFormatSchema(before) || isMultiFormatSchema(after)) {
      return [before, after]
    }
    let b = before
    let a = after
    for (const transform of transforms) {
      ;[b, a] = transform(b, a, ctx)
    }
    return [b, a]
  }

/**
 * Rules for AsyncAPI 3.x (DESIGN_PROPOSALS §4.6, decision §11.7): `operations/*` open the `send` (request
 * semantics from the application's view) or `receive` (response semantics) scope from their `action`; channels,
 * messages and components are classified by the operations that reference them.
 */
export const asyncApi3Rules = ({ notMergeAllOf, extensions }: AsyncApiRulesOptions = {}): CompareRules => {
  const schemaRules = jsonSchemaRules({
    notMergeAllOf,
    version: "2020-12",
    extensions,
    baseRules: asyncApiSchemaBaseRules,
  })
  const dialects = createSchemaDialects(schemaRules, { notMergeAllOf, extensions })
  // specification extensions (`x-*`) of every object that allows them (POLICY-06 / POLICY-07, ISSUE-131)
  const ext = extensionRules(asyncApiExtensionChangeAnnotation, extensions)
  const annotationTree: CompareRules = { $: allAnnotation, "/**": { $: allAnnotation }, ...ext }
  // tags are matched by name (ISSUE-111)
  const tagsRules: CompareRules = { ...annotationTree, mapping: tagMappingResolver }

  // a schema site that admits a Multi Format Schema Object (`{ schemaFormat, schema }`) or a plain schema: the
  // default-format wrapper is unwrapped (ISSUE-104) and `schemaFormat` selects the schema dialect (ISSUE-109,
  // ISSUE-144); a whole payload / headers schema added or removed follows the direction of the operations that use the
  // message (ISSUE-62 (fixed)), and a boolean payload schema is compared as in 2.x (ISSUE-52: the same verdict in 2.6
  // and 3.0)
  const multiFormatCompare = createMultiFormatResolver(dialects, schemaPresenceRule, ext)
  const multiFormatTransform = [transformMultiFormatSchema, plainSchemaOnly(schemaRules.transform as [])]
  const payloadRules = (): CompareRules => ({
    ...schemaRules,
    kind: SCHEMA_KIND,
    $: schemaPresenceRule,
    transform: multiFormatTransform,
    compare: multiFormatCompare,
  })

  const correlationIdRule = fixed([nonBreaking, breaking, breaking])
  const correlationIdRules: CompareRules = {
    $: correlationIdRule,
    compare: refsCompareResolver,
    "/location": { $: fixed([nonBreaking, breaking, breaking]) },
    "/description": { $: allAnnotation },
    ...ext,
  }

  // bindings are protocol-specific and unclassified (POLICY-19) at any depth; a `$ref` to `components.*Bindings` is
  // resolved at the usage (ISSUE-108); Schema-Object fields get the schema rules of the enclosing direction (ISSUE-139)
  const bindingSchemaRule = staticRules(() => ({ ...schemaRules, $: schemaPresenceRule, kind: SCHEMA_KIND }))
  const protocolRules = (fields: string[] = []): CompareRules => ({
    $: allUnclassified,
    compare: refsCompareResolver,
    "/**": { $: allUnclassified },
    ...Object.fromEntries(fields.map((field) => [`/${field}`, bindingSchemaRule])),
  })
  const bindingsRules: CompareRules = {
    kind: "bindings",
    $: allUnclassified,
    compare: refsCompareResolver,
    "/*": protocolRules(),
    ...Object.fromEntries(
      Object.entries(bindingSchemaFields).map(([protocol, fields]) => [`/${protocol}`, protocolRules(fields)]),
    ),
  }

  const commonRules: CompareRules = {
    ...ext,
    "/title": { $: allAnnotation },
    "/summary": { $: allAnnotation },
    "/description": { $: allAnnotation },
    "/tags": tagsRules,
    "/externalDocs": annotationTree,
    "/bindings": { ...bindingsRules, $: effectiveField("bindings", allUnclassified) },
  }

  const messageFieldRules: CompareRules = {
    "/headers": staticRules(() => ({ ...payloadRules(), $: effectiveField("headers", schemaPresenceRule) })),
    "/correlationId": { ...correlationIdRules, $: effectiveField("correlationId", correlationIdRule) },
    // a message without contentType uses `defaultContentType` or a trait's value (ISSUE-70, ISSUE-103)
    "/contentType": { $: effectiveField("contentType", fixed([nonBreaking, breaking, breaking])) },
    "/name": { $: effectiveField("name", allNonBreakingTuple) },
    "/examples": { $: allAnnotation, "/*": { $: allAnnotation, compare: valueCompareResolver } },
    ...commonRules,
  }

  const messageTraitRules: CompareRules = {
    kind: "messageTrait",
    $: traitRule(fixed([nonBreaking, breaking, breaking]), false),
    compare: refsCompareResolver,
    ...messageFieldRules,
  }

  const messageRules: CompareRules = {
    kind: "message",
    $: fixed([nonBreaking, breaking, breaking]),
    compare: refsCompareResolver,
    ...messageFieldRules,
    "/payload": staticRules(() => payloadRules()),
    // traits are merged into the message: a trait is classified by what it changes in the message (ISSUE-103)
    "/traits": {
      $: traitRule(fixed([nonBreaking, breaking, breaking]), true),
      "/*": traitItemRules(messageTraitRules),
    },
  }

  // a channel message is classified by the operations that send or receive it
  const channelMessageRules: CompareRules = {
    ...messageRules,
    scope: CompareScopes.components,
    // a message key renamed with its references repointed (ISSUE-78)
    $: renameAware(fixed([nonBreaking, breaking, breaking])),
  }

  const parameterRules: CompareRules = {
    kind: "parameter",
    compare: refsCompareResolver,
    $: fixed([breaking, nonBreaking, breaking]),
    "/enum": { $: fixed([breaking, nonBreaking, breaking]), "/*": { $: fixed([nonBreaking, breaking, breaking]) } },
    "/default": { $: fixed([nonBreaking, breaking, breaking]) },
    "/description": { $: allAnnotation },
    "/examples": annotationTree,
    "/location": { $: fixed([breaking, nonBreaking, breaking]) },
    ...ext,
  }

  const serverRefListRules: CompareRules = {
    $: allAnnotation,
    mapping: deepEqualsUniqueItemsMappingResolver,
    "/*": annotationTree,
  }

  const channelRules: CompareRules = {
    kind: "channel",
    compare: refsCompareResolver,
    transform: [createFields("messages", "parameters")],
    // a channel key renamed with its references repointed (ISSUE-78)
    $: renameAware(fixed([nonBreaking, breaking, breaking])),
    // a null or absent address is unknown (ISSUE-110)
    "/address": { $: channelAddressRule },
    "/messages": {
      $: fixed([nonBreaking, breaking, breaking]),
      // a message renamed with every reference repointed: one rename diff here (POLICY-100 / 101)
      mapping: renameMappingResolver(),
      "/*": channelMessageRules,
    },
    "/parameters": {
      $: fixed([nonBreaking, breaking, breaking]),
      "/*": parameterRules,
    },
    "/servers": serverRefListRules,
    ...commonRules,
  }

  // the scope of an operation follows its `action`
  const operationScope: ScopeResolver = ({ value }) =>
    getStringValue(value, "action") === "receive" ? CompareScopes.receive : CompareScopes.send

  // the list of messages an operation may send or receive, as the 2.x `oneOf` alternatives: a new message is harmless
  // for the clients that send to a receiving application, the clients of a sending application may get a message
  // kind they do not know (POLICY-05: risky; the reversed slots apply in the send scope); a removed message breaks
  // the clients in both directions (ISSUE-52 (fixed))
  const messageRefRule: ClassifyRule = [nonBreaking, breaking, breaking, risky, breaking, breaking]
  // a reference retargeted to the message of the same key in another channel is one nominal change (ISSUE-106)
  const messageRefListRules: CompareRules = {
    $: messageRefRule,
    mapping: messageRefMappingResolver,
    "/*": {
      $: messageRefRule,
      // a reference repointed to a renamed message or channel is unchanged (POLICY-100)
      compare: repointedReferenceResolver,
      // a reference to another message (the same key in another channel) is a different message (ISSUE-106), unless
      // the message was renamed (ISSUE-78)
      "/**": { $: renameAware(fixed([nonBreaking, breaking, breaking])) },
    },
  }

  // the reply travels the other way: the reply of a send operation is consumed by the application (request
  // semantics), the reply of a receive operation is produced by it (decision §11.17, ISSUE-52 (fixed))
  const replyRules: CompareRules = {
    scope: ({ scope }) => oppositeScopes[scope] ?? scope,
    $: fixed([nonBreaking, breaking, breaking]),
    compare: refsCompareResolver,
    ...ext,
    "/address": {
      $: fixed([nonBreaking, breaking, breaking]),
      compare: refsCompareResolver,
      "/location": { $: fixed([breaking, breaking, breaking]) },
      "/description": { $: allAnnotation },
      ...ext,
    },
    "/channel": {
      $: fixed([breaking, breaking, breaking]),
      // a reference repointed to the renamed channel is unchanged (POLICY-100)
      compare: repointedReferenceResolver,
      "/**": { $: renameAware(fixed([breaking, breaking, breaking])) },
    },
    "/messages": messageRefListRules,
  }

  const schemeRules = securitySchemeRules(ext)
  const securityRules = securityRequirementsRules("3.x", schemeRules)

  const operationTraitRules: CompareRules = {
    $: traitRule(fixed([nonBreaking, breaking, breaking]), false),
    compare: refsCompareResolver,
    "/security": securityRules,
    ...commonRules,
  }

  const operationRules: CompareRules = {
    kind: "operation",
    scope: operationScope,
    compare: refsCompareResolver,
    $: fixed([nonBreaking, breaking, breaking]),
    "/action": { $: fixed([breaking, breaking, breaking]) },
    // the channel reference is nominal: a different channel is a different operation
    "/channel": {
      $: fixed([breaking, breaking, breaking]),
      // a reference repointed to the renamed channel is unchanged (POLICY-100)
      compare: repointedReferenceResolver,
      "/**": { $: renameAware(fixed([breaking, breaking, breaking])) },
    },
    "/messages": messageRefListRules,
    "/reply": replyRules,
    // security requirements are classified in both directions (ISSUE-101)
    "/security": { ...securityRules, $: effectiveField("security", securityListRule) },
    // traits are merged into the operation: a trait is classified by what it changes in the operation (ISSUE-103)
    "/traits": {
      $: traitRule(fixed([nonBreaking, breaking, breaking]), true),
      "/*": traitItemRules(operationTraitRules),
    },
    ...commonRules,
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
    $: allAnnotation,
    "/**": { $: allAnnotation },
    "/variables": { $: allAnnotation, "/*": serverVariableRules },
    "/bindings": bindingsRules,
    "/security": securityRules,
    "/tags": tagsRules,
    ...ext,
  }

  const componentRule = (rules: CompareRules, classify: ClassifyRule = fixed([nonBreaking, breaking, breaking])) => ({
    ...rules,
    scope: CompareScopes.components,
    // a component renamed with every reference repointed (ISSUE-78)
    $: renameAware(classify),
  })
  // a map of components: classified when an entry of it is referenced, unclassified otherwise (ISSUE-143)
  const componentMap = (entry: CompareRules | ReturnType<typeof staticRules>): CompareRules => ({
    $: componentMapRule(),
    // a component renamed with every reference repointed: one rename diff at the map (POLICY-100 / 101)
    mapping: renameMappingResolver(),
    "/*": entry,
  })

  return {
    ...ext,
    // channels, channel messages and components renamed with every reference repointed (ISSUE-78, POLICY-100 / 101)
    referenceRenames: documentRenames,
    // an operation without a `messages` list uses every message of its channel (POLICY-120)
    impliedReferences: operationChannelMessages,
    transform: [createFields("channels", "operations", "components", "servers")],
    "/asyncapi": { $: allAnnotation },
    "/id": { $: allAnnotation },
    "/defaultContentType": { $: fixed(allBreaking as ClassifyTuple) },
    "/info": { ...annotationTree, "/tags": tagsRules },
    "/servers": { $: allAnnotation, "/*": serverRules },
    "/channels": {
      $: fixed([nonBreaking, breaking, breaking]),
      // a channel renamed with every reference repointed: one rename diff here (POLICY-100 / 101)
      mapping: renameMappingResolver(),
      "/*": channelRules,
    },
    "/operations": {
      $: fixed([nonBreaking, breaking, breaking]),
      "/*": operationRules,
    },
    "/components": {
      $: fixed([nonBreaking, breaking, breaking]),
      ...ext,
      "/schemas": componentMap(staticRules(() => componentRule(payloadRules()))),
      "/messages": componentMap(componentRule(messageRules)),
      "/messageTraits": componentMap(componentRule(messageTraitRules)),
      "/channels": {
        $: fixed([nonBreaking, breaking, breaking]),
        mapping: renameMappingResolver(),
        "/*": channelRules,
      },
      // a component operation is classified by the operations that reference it (decision §11.4, ISSUE-143); its
      // reply opens the opposite of their scopes
      "/operations": componentMap(componentRule(operationRules)),
      "/operationTraits": componentMap(componentRule(operationTraitRules)),
      "/parameters": componentMap(componentRule(parameterRules)),
      "/correlationIds": componentMap(componentRule(correlationIdRules)),
      "/replies": componentMap(componentRule(replyRules)),
      "/replyAddresses": componentMap(componentRule(replyRules["/address"] as CompareRules)),
      "/servers": { $: allAnnotation, "/*": serverRules },
      "/serverVariables": componentMap(componentRule(serverVariableRules, allAnnotation)),
      // bindings are unclassified wherever they are declared (POLICY-19, ISSUE-108)
      "/serverBindings": componentMap(componentRule(bindingsRules, allUnclassified)),
      "/channelBindings": componentMap(componentRule(bindingsRules, allUnclassified)),
      "/operationBindings": componentMap(componentRule(bindingsRules, allUnclassified)),
      "/messageBindings": componentMap(componentRule(bindingsRules, allUnclassified)),
      // security schemes are classified as declared (ISSUE-101)
      "/securitySchemes": {
        $: fixed([nonBreaking, breaking, breaking]),
        // a scheme renamed with every requirement repointed: one rename diff here (POLICY-100 / 101)
        mapping: renameMappingResolver(),
        "/*": schemeRules,
      },
      "/externalDocs": annotationTree,
      "/tags": { ...annotationTree, "/*": annotationTree },
      // unknown component maps; the `/*` rule is merged into every map above, so it carries no extension prefix rule:
      // `x-*` keys inside a components map are map entries (POLICY-46), only those of `components` itself are
      // extensions
      "/*": { $: allAnnotation, "/**": { $: allAnnotation } },
    },
  }
}

// a whole schema added or removed: narrowing a consumed message, a guarantee for a produced one; replaced: breaking
const schemaPresenceRule: ClassifyRule = [breaking, nonBreaking, breaking, nonBreaking, breaking, breaking]

const allNonBreakingTuple: ClassifyRule = nonDirectional([nonBreaking, nonBreaking, nonBreaking])
