import {
  deepEqual,
  getParentContext,
  annotation,
  breaking,
  invertedScopes,
  isRenamedEntry,
  nonBreaking,
  risky,
  transformClassifyRule,
  unclassified,
} from "../core"
import { getKeyValue, isNotEmptyArray, isExist, isObject, isString } from "../utils"
import {
  emptySecurity,
  includeSecurity,
  inheritsGlobalSecurity,
  isRepointedComponent,
  referencedSecuritySchemes,
} from "./openapi3.utils"
import { breakingIfAfterTrue, nonDirectional, resolveRef } from "../jsonSchema"
import type { ClassifyRule, ClassifyTuple, DiffType, DiffTypeClassifier, CompareContext, NodeContext } from "../types"

// OpenAPI structural rules keep their literal meaning in every scope (only JSON Schema rules invert in responses)
const fixed = (tuple: ClassifyTuple): ClassifyRule => nonDirectional(tuple)

export const parameterStyleClassifyRule: ClassifyRule = fixed([
  ({ after }) => (after.value === "form" ? annotation : breaking),
  ({ before }) => (before.value === "form" ? annotation : breaking),
  breaking,
])

const PRIMITIVE_TYPES = new Set(["string", "number", "integer", "boolean", "null"])

// the parameter serializes a primitive value: `explode` has no effect on it (POLICY-10 decided (a), ISSUE-133)
const isPrimitiveParameter = (node: NodeContext) => {
  const schema = resolveRef(getKeyValue(node.parent, "schema"), node.root)
  const type = getKeyValue(schema, "type")
  const types = Array.isArray(type) ? type : [type]
  return types.length > 0 && types.every((t) => isString(t) && PRIMITIVE_TYPES.has(t))
}

const explodeRule: ClassifyRule = fixed([
  ({ after }) =>
    (after.value && getKeyValue(after.parent, "style") === "form") ||
    (!after.value && getKeyValue(after.parent, "style") !== "form")
      ? annotation
      : breaking,
  ({ before }) =>
    (before.value && getKeyValue(before.parent, "style") === "form") ||
    (!before.value && getKeyValue(before.parent, "style") !== "form")
      ? annotation
      : breaking,
  breaking,
])

export const parameterExplodeClassifyRule: ClassifyRule = transformClassifyRule(explodeRule, (type, ctx) =>
  isPrimitiveParameter(ctx.before.parent !== undefined ? ctx.before : ctx.after) &&
  isPrimitiveParameter(ctx.after.parent !== undefined ? ctx.after : ctx.before)
    ? annotation
    : type,
)

/** A parameter field that applies to query parameters only (`allowEmptyValue`, `allowReserved`; ISSUE-133). */
export const queryOnly = (rule: ClassifyRule): ClassifyRule =>
  transformClassifyRule(rule, (type, { before, after }) => {
    const location = getKeyValue(before.parent, "in") ?? getKeyValue(after.parent, "in")
    return location === undefined || location === "query" ? type : annotation
  })

const IGNORED_HEADERS = new Set(["accept", "content-type", "authorization"])

/** OAS: header parameters named `Accept`, `Content-Type` or `Authorization` SHALL be ignored (ISSUE-133). */
export const isIgnoredHeaderParameter = (param: unknown) => {
  const name = getKeyValue(param, "name")
  return getKeyValue(param, "in") === "header" && isString(name) && IGNORED_HEADERS.has(name.toLowerCase())
}

export const parameterNameClassifyRule: ClassifyRule = fixed([
  nonBreaking,
  breaking,
  ({ before, after }) => {
    const location = getKeyValue(before.parent, "in")
    // HTTP header field names are case-insensitive (RFC 9110 §5.1; ISSUE-74)
    if (
      location === "header" &&
      isString(before.value) &&
      isString(after.value) &&
      before.value.toLowerCase() === after.value.toLowerCase()
    ) {
      return annotation
    }
    return location === "path" ? nonBreaking : breaking
  },
])

const hasSchemaDefault = (ctx: CompareContext) => isExist(getKeyValue(ctx.after.parent, "schema", "default"))

export const parameterRequiredClassifyRule: ClassifyRule = fixed([
  (ctx) => (ctx.after.value && !hasSchemaDefault(ctx) ? breaking : nonBreaking),
  nonBreaking,
  (ctx) => (hasSchemaDefault(ctx) ? nonBreaking : breakingIfAfterTrue(ctx)),
])

/**
 * `type` of a parameter schema: a form-style query parameter accepts a single value where an array is expected
 * (string -> array is harmless), every other scalar change (string -> integer, array -> string) rejects values
 * that were valid before.
 */
export const paramSchemaTypeClassifyRule: ClassifyRule = fixed([
  breaking,
  nonBreaking,
  ({ before, after, scope }) => {
    const paramContext = getParentContext(before, "")
    const paramStyle = getKeyValue(paramContext?.value, "style") ?? "form"
    if (getKeyValue(paramContext?.value, "in") === "query" && paramStyle === "form") {
      if (before.value === "string" && after.value === "array") {
        return nonBreaking
      }
    }
    // every integer is a number: the server accepts every value it accepted before (ISSUE-94); a callback parameter
    // is sent by the API, so the reader may receive values it does not accept
    if (before.value === "integer" && after.value === "number") {
      return invertedScopes.has(scope) ? breaking : nonBreaking
    }
    return breaking
  },
])

// an exploded form-style object query parameter serializes as one query parameter per property (`?a=1&b=2`)
const explodedProperties = (param: unknown, root: unknown): Record<string, unknown> | undefined => {
  if (getKeyValue(param, "in") !== "query") {
    return
  }
  const style = getKeyValue(param, "style") ?? "form"
  const explode = getKeyValue(param, "explode") ?? style === "form"
  const schema = resolveRef(getKeyValue(param, "schema"), root)
  const properties = getKeyValue(schema, "properties")
  return style === "form" && explode === true && isObject(properties) && Object.keys(properties).length
    ? properties
    : undefined
}

const queryParams = (list: unknown, root: unknown) => {
  const result = new Map<string, unknown>()
  if (Array.isArray(list)) {
    for (const item of list) {
      const param = resolveRef(item, root)
      const name = getKeyValue(param, "name")
      if (getKeyValue(param, "in") === "query" && isString(name)) {
        result.set(name, param)
      }
    }
  }
  return result
}

/**
 * The exploded object parameter `object` (one side) and the query parameters `params` (other side) serialize the
 * same requests: every property is a parameter of the other side with the same schema, which the object side does
 * not declare by itself (ISSUE-79).
 */
const sameSerialization = (
  object: unknown,
  objectRoot: unknown,
  objectList: unknown,
  list: unknown,
  root: unknown,
): boolean => {
  const properties = explodedProperties(object, objectRoot)
  if (!properties) {
    return false
  }
  const params = queryParams(list, root)
  const own = queryParams(objectList, objectRoot)
  return Object.keys(properties).every(
    (name) =>
      !own.has(name) &&
      params.has(name) &&
      deepEqual(resolveRef(properties[name], objectRoot), resolveRef(getKeyValue(params.get(name), "schema"), root)),
  )
}

// a query parameter added / removed as a property of an exploded object parameter removed / added on the other side
const isExplodedProperty = (param: unknown, side: NodeContext, other: NodeContext): boolean => {
  const name = getKeyValue(param, "name")
  if (getKeyValue(param, "in") !== "query" || !isString(name) || !Array.isArray(other.parent)) {
    return false
  }
  const names = queryParams(side.parent, side.root)
  return other.parent.some((item) => {
    const object = resolveRef(item, other.root)
    const properties = explodedProperties(object, other.root)
    return (
      !!properties &&
      name in properties &&
      !names.has(String(getKeyValue(object, "name"))) &&
      sameSerialization(object, other.root, other.parent, side.parent, side.root)
    )
  })
}

export const paramClassifyRule: ClassifyRule = fixed([
  ({ before, after }) => {
    const param = resolveRef(after.value, after.root)
    if (
      isIgnoredHeaderParameter(param) ||
      sameSerialization(param, after.root, after.parent, before.parent, before.root) ||
      isExplodedProperty(param, after, before)
    ) {
      return annotation
    }
    return getKeyValue(param, "required") && !isExist(getKeyValue(param, "schema", "default")) ? breaking : nonBreaking
  },
  ({ before, after }) => {
    const param = resolveRef(before.value, before.root)
    if (
      isIgnoredHeaderParameter(param) ||
      sameSerialization(param, before.root, before.parent, after.parent, after.root) ||
      isExplodedProperty(param, before, after)
    ) {
      return annotation
    }
    return breaking
  },
  unclassified,
])

/** A request body that is required from the start rejects every existing call without a body. */
export const requestBodyClassifyRule: ClassifyRule = fixed([
  ({ after }) => (getKeyValue(resolveRef(after.value, after.root), "required") === true ? breaking : nonBreaking),
  breaking,
  breaking,
])

/** Keys that differ only by case (response codes, header names) are renamed without semantic change. */
export const caseOnlyRename = (otherwise: DiffType | DiffTypeClassifier): DiffTypeClassifier => {
  return (ctx) => {
    const { before, after } = ctx
    if (
      isString(before.key) &&
      isString(after.key) &&
      before.key !== after.key &&
      before.key.toLowerCase() === after.key.toLowerCase()
    ) {
      return annotation
    }
    return typeof otherwise === "function" ? otherwise(ctx) : otherwise
  }
}

const headerRequired = (node: NodeContext, value: unknown = node.value) =>
  getKeyValue(resolveRef(value, node.root), "required") === true

const anyHeaderRequired = (node: NodeContext) =>
  isObject(node.value) && Object.values(node.value).some((header) => headerRequired(node, header))

/**
 * A header follows the direction of its message (ISSUE-61 (fixed)). Request side (encoding part headers, callback
 * responses): a new required header rejects callers that do not send it, a removed header is no longer read. Response
 * side: the client reads the header, so a removed required header breaks it, a removed optional one and any added
 * header do not. A case-only rename is an annotation (header names are case-insensitive).
 */
export const headerClassifyRule: ClassifyRule = [
  ({ after }) => (headerRequired(after) ? breaking : nonBreaking),
  nonBreaking,
  caseOnlyRename(breaking),
  nonBreaking,
  ({ before }) => (headerRequired(before) ? breaking : nonBreaking),
  caseOnlyRename(breaking),
]

/** A whole headers map added or removed: as its headers (ISSUE-61 (fixed)). */
export const headersClassifyRule: ClassifyRule = [
  ({ after }) => (anyHeaderRequired(after) ? breaking : nonBreaking),
  nonBreaking,
  breaking,
  nonBreaking,
  ({ before }) => (anyHeaderRequired(before) ? breaking : nonBreaking),
  breaking,
]

/**
 * `required` of a header or a request body: a stronger demand on the sender, a stronger guarantee to the reader
 * (ISSUE-61 (fixed); a webhook / callback request body is read by the client, ISSUE-135 (fixed)).
 */
export const requiredFlagClassifyRule: ClassifyRule = [
  breakingIfAfterTrue,
  nonBreaking,
  breakingIfAfterTrue,
  nonBreaking,
  ({ before }) => (before.value === true ? breaking : nonBreaking),
  ({ after }) => (after.value === true ? nonBreaking : breaking),
]

const slotValue = (slot: DiffType | DiffTypeClassifier, ctx: CompareContext): DiffType =>
  typeof slot === "function" ? slot(ctx) : slot

const isPublic = (requirements: unknown) => !Array.isArray(requirements) || emptySecurity(requirements)

/**
 * Global security applies to the operations of `paths` without their own `security` only: when no operation inherits
 * it on either side, no request changes (ISSUE-67, oasdiff api-global-security-added INFO).
 */
const inheritedOnly =
  (slot: DiffType | DiffTypeClassifier): DiffTypeClassifier =>
  (ctx) => {
    const type = slotValue(slot, ctx)
    if (type !== breaking && type !== risky) {
      return type
    }
    return inheritsGlobalSecurity(ctx, ctx.before.root) || inheritsGlobalSecurity(ctx, ctx.after.root)
      ? type
      : nonBreaking
  }

const globalOnly = (tuple: ClassifyTuple): ClassifyRule =>
  fixed([inheritedOnly(tuple[0]), inheritedOnly(tuple[1]), inheritedOnly(tuple[2])])

export const globalSecurityClassifyRule: ClassifyRule = globalOnly([
  ({ after }) => (!emptySecurity(after.value) ? breaking : nonBreaking),
  nonBreaking,
  ({ after, before }) =>
    includeSecurity(after.value, before.value) || emptySecurity(after.value) ? nonBreaking : breaking,
])

// a requirement alternative: adding one to a secured API opens a new option, removing one of several closes it
const securityItemTuple: ClassifyTuple = [
  ({ before }) => (isNotEmptyArray(before.parent) ? nonBreaking : breaking),
  ({ after }) => (isNotEmptyArray(after.parent) && !emptySecurity(after.parent) ? breaking : nonBreaking),
  ({ after, before }) =>
    includeSecurity(after.parent, before.parent) || emptySecurity(after.value) ? nonBreaking : breaking,
]

export const globalSecurityItemClassifyRule: ClassifyRule = globalOnly(securityItemTuple)

// a scheme inside a requirement (AND): adding one demands more, removing one demands less; a scheme renamed with an
// identical definition (every requirement repointed) changes nothing on the wire (ISSUE-78)
const requirementSchemeTuple: ClassifyTuple = [
  breaking,
  nonBreaking,
  ({ before, after }) => (before.key !== after.key ? annotation : breaking),
]
export const securityRequirementSchemeClassifyRule: ClassifyRule = fixed(requirementSchemeTuple)
export const globalSecurityRequirementSchemeClassifyRule: ClassifyRule = globalOnly(requirementSchemeTuple)

// a scope inside a requirement: requiring an additional scope rejects previously valid tokens
export const securityScopeClassifyRule: ClassifyRule = fixed([breaking, nonBreaking, breaking])
export const globalSecurityScopeClassifyRule: ClassifyRule = globalOnly([breaking, nonBreaking, breaking])

/**
 * Operation `security`: it replaces the global requirements of the operation. Removing it makes the global
 * requirements apply again, so it is harmless when they are absent (the operation becomes public, ISSUE-66) or
 * offer every alternative the operation accepted.
 */
export const operationSecurityClassifyRule: ClassifyRule = fixed([
  ({ before, after }) =>
    emptySecurity(after.value) || includeSecurity(after.value, getKeyValue(before.root, "security"))
      ? nonBreaking
      : breaking,
  ({ before, after }) => {
    const global = getKeyValue(after.root, "security")
    return isPublic(global) || includeSecurity(global, before.value) ? nonBreaking : breaking
  },
  ({ before, after }) =>
    includeSecurity(after.value, before.value) || emptySecurity(after.value) ? nonBreaking : breaking,
])

export const operationSecurityItemClassifyRule: ClassifyRule = fixed(securityItemTuple)

/** Name of the security scheme a node of `components.securitySchemes` belongs to. */
const securitySchemeName = ({ before, after }: CompareContext): string | undefined => {
  const path = before.path.length >= 3 ? before.path : after.path
  return path[0] === "components" && path[1] === "securitySchemes" && isString(path[2]) ? path[2] : undefined
}

/**
 * A security scheme no requirement references (in either document) has no effect on any request: its changes are
 * unclassified (POLICY-11 decided (a), decision §11.18).
 */
const referencedSchemeOnly =
  (slot: DiffType | DiffTypeClassifier): DiffTypeClassifier =>
  (ctx) => {
    const name = securitySchemeName(ctx)
    if (
      name !== undefined &&
      !referencedSecuritySchemes(ctx, ctx.before.root).has(name) &&
      !referencedSecuritySchemes(ctx, ctx.after.root).has(name)
    ) {
      return unclassified
    }
    return slotValue(slot, ctx)
  }

/** Classifier of a node of a security scheme: as given while a requirement references the scheme, else unclassified. */
export const securitySchemeRule = (tuple: ClassifyTuple): ClassifyRule =>
  fixed([referencedSchemeOnly(tuple[0]), referencedSchemeOnly(tuple[1]), referencedSchemeOnly(tuple[2])])

/** A value compared case-insensitively (HTTP authentication scheme names, RFC 9110 §11.1; ISSUE-77). */
export const caseInsensitiveValue =
  (otherwise: DiffType): DiffTypeClassifier =>
  ({ before, after }) =>
    isString(before.value) && isString(after.value) && before.value.toLowerCase() === after.value.toLowerCase()
      ? annotation
      : otherwise

/**
 * A component entry (`components.<kind>.<name>`): classified by the scopes that reference it (decision §11.4); its
 * removal is non-breaking when every usage was repointed to an added component with the same content (POLICY-18
 * decided (b)).
 */
export const componentOf = (rule: ClassifyRule): ClassifyRule =>
  transformClassifyRule(rule, (type, ctx, action) =>
    // a component renamed with every reference repointed is an annotation; its content is compared on its own
    // (POLICY-101; a rename is read through the replace slot)
    action === "replace" && isRenamedEntry(ctx)
      ? annotation
      : action === "remove" && (type === breaking || type === risky) && isRepointedComponent(ctx)
        ? nonBreaking
        : type,
  )

export const componentRule: ClassifyRule = componentOf(fixed([nonBreaking, breaking, breaking]))

const pathTemplate = (key: string) => key.replace(/\{.*?\}/g, "{}")

/**
 * A renamed path (`pathMappingResolver`): another parameter name in the same template is non-breaking (the URL a client
 * builds is unchanged, the parameter it fills is renamed); a path mapped through its effective URL (server prefix moved
 * into the path, ISSUE-80) or with its repeated slashes collapsed (POLICY-43 decided (b)) is an annotation.
 */
export const pathRenameClassifier: DiffTypeClassifier = ({ before, after }) =>
  isString(before.key) && isString(after.key) && pathTemplate(before.key) !== pathTemplate(after.key)
    ? annotation
    : nonBreaking

const baseMediaType = (key: string) => key.split(";")[0].trim().toLowerCase()

// `a` covers `b` (`*/*` covers every type, `application/*` every application type)
const coversMediaType = (a: string, b: string) => {
  const [aType, aSub] = a.split("/")
  const [bType, bSub] = b.split("/")
  return (aType === "*" || aType === bType) && (aSub === "*" || aSub === bSub)
}

/**
 * A media type mapped to another key (`contentMediaTypeMappingResolver`, ISSUE-63): a case-only change is an annotation
 * (RFC 6838 names are case-insensitive), a parameter-only change non-breaking (POLICY-15 decided (a)); a wildcard
 * narrowed to a specific type rejects the other types a sender used (breaking in a request), generalized to a wildcard
 * it lets the server send types a reader does not expect (breaking in a response); the opposite directions are
 * non-breaking.
 */
export const mediaTypeRenameClassifier: DiffTypeClassifier = ({ before, after, scope }) => {
  if (!isString(before.key) || !isString(after.key) || before.key === after.key) {
    return nonBreaking
  }
  if (before.key.toLowerCase() === after.key.toLowerCase()) {
    return annotation
  }
  const b = baseMediaType(before.key)
  const a = baseMediaType(after.key)
  if (b === a) {
    return nonBreaking
  }
  const response = invertedScopes.has(scope)
  if (coversMediaType(b, a)) {
    return response ? nonBreaking : breaking
  }
  if (coversMediaType(a, b)) {
    return response ? breaking : nonBreaking
  }
  return breaking
}

const statusClass = (code: unknown) => (isString(code) || typeof code === "number" ? String(code)[0] : "")
const isRangeCode = (code: unknown) => isString(code) && /^[1-5]xx$/i.test(code)
const isSuccessCode = (code: unknown) => statusClass(code) === "2"

/**
 * Removing a response: a success outcome clients rely on is breaking, a non-success or `default` response is
 * non-breaking (POLICY-13 decided (b), ISSUE-134).
 */
export const responseRemoveClassifier: DiffTypeClassifier = ({ before }) =>
  isSuccessCode(before.key) ? breaking : nonBreaking

/**
 * A response mapped to another key: a case-only change of a range is an annotation; an explicit code replaced by its
 * range lets the server answer codes clients do not expect (breaking), a range narrowed to one of its codes does not
 * (POLICY-14 decided (b), ISSUE-134).
 */
export const responseRenameClassifier: DiffTypeClassifier = caseOnlyRename(({ before, after }) => {
  if (!isRangeCode(before.key) && isRangeCode(after.key)) {
    return breaking
  }
  if (isRangeCode(before.key) && !isRangeCode(after.key)) {
    return nonBreaking
  }
  return breaking
})

export { fixed }
