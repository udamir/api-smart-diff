import {
  allAnnotation,
  annotation,
  breaking,
  nonBreaking,
  risky,
  unclassified,
  deepEqualsUniqueItemsMappingResolver,
  objectMappingResolver,
  repointedReferenceResolver,
  withRenamedKeys,
} from "../core"
import type {
  ClassifyRule,
  ClassifyTuple,
  CompareContext,
  CompareRules,
  DiffType,
  DiffTypeClassifier,
  MappingResolver,
} from "../types"
import { isObject, isString } from "../utils"
import { securityRequirementAnnotation, securityScopeChangeAnnotation } from "./asyncapi.annotate"
import {
  fixed,
  renameAware,
  requirementSchemeRenameAware,
  schemeRenames,
  securityAlternativeRule,
  securityListRule,
  securityMappingResolver,
  securityReferenceRule,
} from "./asyncapi.classify"

// a scheme or a scope inside a 2.x requirement (AND): adding one demands more of the client, removing one less
const requirementEntryRule = fixed([breaking, nonBreaking, breaking])

// a 2.x requirement object: by scheme name, a renamed scheme (POLICY-101) as a rename
const requirementMappingResolver: MappingResolver<string> = (before, after, ctx) =>
  withRenamedKeys(objectMappingResolver(before, after, ctx), schemeRenames(ctx))

/**
 * Security requirements of a server, an operation or an operation trait, classified like OpenAPI security and in
 * both operation directions alike (the client authenticates either way, ISSUE-101): 2.x lists Security Requirement
 * Objects (scheme name → scopes), 3.0 lists Security Scheme Objects or references to them; the list items are
 * alternatives.
 */
export const securityRequirementsRules = (version: "2.x" | "3.x", schemeRules: CompareRules): CompareRules => ({
  $: securityListRule,
  annotate: securityRequirementAnnotation,
  mapping: securityMappingResolver,
  "/*":
    version === "2.x"
      ? {
          $: securityAlternativeRule,
          annotate: securityRequirementAnnotation,
          mapping: requirementMappingResolver,
          "/*": {
            // a scheme renamed with every requirement repointed (POLICY-101)
            $: requirementSchemeRenameAware(requirementEntryRule),
            annotate: securityRequirementAnnotation,
            mapping: deepEqualsUniqueItemsMappingResolver,
            "/*": { $: requirementEntryRule, annotate: securityScopeChangeAnnotation },
          },
        }
      : {
          ...schemeRules,
          $: securityAlternativeRule,
          annotate: securityRequirementAnnotation,
          // a reference repointed to a renamed scheme is unchanged (POLICY-100 / 101)
          compare: repointedReferenceResolver,
          "/$ref": { $: securityReferenceRule },
        },
})

const SCHEME_POINTER = "#/components/securitySchemes/"
// subtrees that hold no security requirement (payloads, schemas and examples may use `security` as a property name)
const NO_REQUIREMENTS = new Set(["payload", "headers", "schemas", "examples", "bindings", "messages", "messageTraits"])

/**
 * Names of the `components.securitySchemes` entries a document references: the keys of the 2.x Security Requirement
 * Objects and the 3.0 `$ref`s to a scheme, in every `security` list (servers, operations, operation traits and their
 * components). Computed once per compare session and document.
 */
const referencedSchemes = (ctx: CompareContext, root: unknown): Set<string> => {
  const key = "asyncapi:security-schemes-referenced"
  let byRoot = ctx.session.caches.get(key) as Map<unknown, Set<string>> | undefined
  if (!byRoot) {
    byRoot = new Map()
    ctx.session.caches.set(key, byRoot)
  }
  let names = byRoot.get(root)
  if (!names) {
    const found = new Set<string>()
    const seen = new Set<unknown>()
    const scan = (value: unknown) => {
      if (!isObject(value) || seen.has(value)) {
        return
      }
      seen.add(value)
      for (const name of Object.keys(value)) {
        const child = value[name]
        if (name === "security" && Array.isArray(child)) {
          for (const item of child) {
            if (!isObject(item)) {
              continue
            }
            if (isString(item.$ref)) {
              if (item.$ref.startsWith(SCHEME_POINTER)) {
                found.add(item.$ref.slice(SCHEME_POINTER.length).replace(/~1/g, "/").replace(/~0/g, "~"))
              }
            } else {
              for (const scheme of Object.keys(item)) {
                found.add(scheme)
              }
            }
          }
        } else if (!NO_REQUIREMENTS.has(name)) {
          scan(child)
        }
      }
    }
    scan(root)
    names = found
    byRoot.set(root, names)
  }
  return names
}

const schemeNameOf = ({ before, after }: CompareContext): string | undefined => {
  const path = before.path.length >= 3 ? before.path : after.path
  return path[0] === "components" && path[1] === "securitySchemes" && isString(path[2]) ? path[2] : undefined
}

/**
 * A node of a `components.securitySchemes` entry: classified as given while a requirement of either document
 * references the scheme, unclassified otherwise (POLICY-80 decided (a), extending POLICY-11 to AsyncAPI; as in
 * OpenAPI, documentation fields stay annotations).
 */
const referencedOnly =
  (slot: DiffType | DiffTypeClassifier): DiffTypeClassifier =>
  (ctx) => {
    const name = schemeNameOf(ctx)
    if (
      name !== undefined &&
      !referencedSchemes(ctx, ctx.before.root).has(name) &&
      !referencedSchemes(ctx, ctx.after.root).has(name)
    ) {
      return unclassified
    }
    return typeof slot === "function" ? slot(ctx) : slot
  }

const scheme = (tuple: ClassifyTuple): ClassifyRule =>
  fixed([referencedOnly(tuple[0]), referencedOnly(tuple[1]), referencedOnly(tuple[2])])

/** The rule of a whole `components.securitySchemes` entry. */
export const securitySchemeEntryRule: ClassifyRule = scheme([nonBreaking, breaking, breaking])

// a changed OAuth / OpenID Connect URL breaks clients configured with the old one only if it stops serving
// (POLICY-05 / decision §11.14: risky, as OpenAPI)
const endpointUrlRule: CompareRules = { $: scheme([breaking, nonBreaking, risky]) }

/** Security scheme rules (`components.securitySchemes`, 3.0 inline schemes), as the OpenAPI security schemes. */
export const securitySchemeRules = (ext: CompareRules): CompareRules => {
  const scopesRules: CompareRules = {
    // a new scope is an option, a removed one refuses clients requesting it; its description is documentation
    $: scheme([nonBreaking, breaking, breaking]),
    "/*": { $: scheme([nonBreaking, breaking, annotation]) },
  }
  const oauthFlowRules: CompareRules = {
    $: scheme([nonBreaking, breaking, breaking]),
    "/authorizationUrl": endpointUrlRule,
    "/tokenUrl": endpointUrlRule,
    "/refreshUrl": endpointUrlRule,
    "/scopes": scopesRules,
    "/availableScopes": scopesRules,
    "/*": { $: allAnnotation },
    ...ext,
  }
  return {
    // a scheme renamed with every requirement repointed is an annotation (ISSUE-78, POLICY-101)
    $: renameAware(scheme([nonBreaking, breaking, breaking])),
    "/type": { $: scheme([breaking, nonBreaking, breaking]) },
    "/description": { $: allAnnotation },
    "/name": { $: scheme([breaking, nonBreaking, breaking]) },
    "/in": { $: scheme([breaking, nonBreaking, breaking]) },
    "/scheme": { $: scheme([breaking, nonBreaking, breaking]) },
    "/bearerFormat": { $: allAnnotation },
    "/flows": {
      // a new flow is another way to obtain a token; clients using a removed flow can no longer obtain one
      $: scheme([nonBreaking, breaking, breaking]),
      "/*": oauthFlowRules,
      ...ext,
    },
    "/openIdConnectUrl": endpointUrlRule,
    // 3.0: the scopes a token must carry (a requirement, the reverse of the scopes a flow offers)
    "/scopes": {
      $: scheme([breaking, nonBreaking, breaking]),
      mapping: deepEqualsUniqueItemsMappingResolver,
      "/*": { $: scheme([breaking, nonBreaking, breaking]), annotate: securityScopeChangeAnnotation },
    },
    "/*": { $: allAnnotation, "/**": { $: allAnnotation } },
    ...ext,
  }
}
