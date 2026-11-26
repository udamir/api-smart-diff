import type { JsonPath } from "json-crawl"

import type {
  AnnotateHook,
  AnnotateTemplate,
  ChangeAnnotationResolver,
  CompareContext,
  Diff,
  NodeContext,
} from "../types"
import {
  type ContainerLocator,
  type ContainerPattern,
  type ContainerSegment,
  componentKindWord,
  createAnnotation,
  createContainerLocator,
  describeDiff,
  describePath,
  extensionChangeAnnotation,
  fallbackAnnotation,
  FREE_TEXT_LENGTH,
  formatParam,
  isFreeTextKey,
  annotationTemplate as t,
  renamedEntryOf,
  ruleView,
} from "../core"
import { jsonSchemaAnnotations, keywordValues, resolveRef, SCHEMA_KIND, schemaContainer } from "../jsonSchema"
import { getKeyValue, getStringValue, isArray, isObject, isString } from "../utils"

const openApiAnnotations = {
  requestBodySchema: "{{schemaChange}} in Request Body content ({{contentType}})",
  responseSchema: "{{schemaChange}} in Response {{responseCode}} content ({{contentType}})",
  parameterSchema: "{{schemaChange}} in {{in}} parameter `{{name}}`",
  parameterSchema_contentType: "{{schemaChange}} in {{in}} parameter `{{name}}` content ({{contentType}})",
  headerSchema: "{{schemaChange}} in header `{{name}}`",
  headerSchema_responseCode: "{{schemaChange}} in Response {{responseCode}} header `{{name}}`",
  headerSchema_part_content: "{{schemaChange}} in header `{{name}}` of encoding `{{part}}` in {{content}}",
  componentSchema: "{{schemaChange}} in schema component `{{name}}`",
  requestBodySchema_name: "{{schemaChange}} in Request Body `{{name}}` content ({{contentType}})",
  // a change inside a renamed component names its new and its old key (POLICY-107)
  componentSchema_renamedFrom: "{{schemaChange}} in schema component `{{name}}` (renamed from `{{renamedFrom}}`)",
  requestBodySchema_name_renamedFrom:
    "{{schemaChange}} in Request Body `{{name}}` (renamed from `{{renamedFrom}}`) content ({{contentType}})",
  responseSchema_responseFrom:
    "{{schemaChange}} in Response {{responseCode}} (renamed from `{{responseFrom}}`) content ({{contentType}})",
  headerSchema_renamedFrom: "{{schemaChange}} in header `{{name}}` (renamed from `{{renamedFrom}}`)",
  headerSchema_responseCode_responseFrom:
    "{{schemaChange}} in Response {{responseCode}} (renamed from `{{responseFrom}}`) header `{{name}}`",
  // a container named by its content inside a renamed component: the component's new and old key (POLICY-114)
  parameterSchema_component: "{{schemaChange}} in {{in}} parameter `{{name}}` of {{component}}",
  parameterSchema_contentType_component:
    "{{schemaChange}} in {{in}} parameter `{{name}}` of {{component}} content ({{contentType}})",
  componentNote: "{{kind}} component `{{name}}` (renamed from `{{from}}`)",
  // a 3.2 media type component (ISSUE-311)
  mediaTypeComponentSchema: "{{schemaChange}} in {{component}}",
  mediaTypeComponent: "media type component `{{name}}`",
  mediaTypeComponent_renamedFrom: "media type component `{{name}}` (renamed from `{{renamedFrom}}`)",

  add: "[Added] {{text}}",
  add_target: "[Added] {{text}} to {{target}}",
  add_value: "[Added] {{text}} {{value}}",
  add_target_value: "[Added] {{text}} {{value}} to {{target}}",
  add_target_overridden: "[Added] {{text}} to {{target}}, overriding the global security requirements {{overridden}}",
  remove: "[Removed] {{text}}",
  remove_target: "[Removed] {{text}} from {{target}}",
  remove_value: "[Removed] {{text}} {{value}}",
  remove_target_value: "[Removed] {{text}} {{value}} from {{target}}",
  remove_target_inherited: "[Removed] {{text}} from {{target}}, the global security requirements {{inherited}} apply",
  replace: "[Replaced] {{text}}",
  replace_target: "[Replaced] {{text}} of {{target}}",
  replace_before_after: "[Replaced] {{text}} from {{before}} to {{after}}",
  replace_target_before_after: "[Replaced] {{text}} of {{target}} from {{before}} to {{after}}",
  rename: "[Renamed] {{text}}",
  rename_target: "[Renamed] {{text}} of {{target}}",

  param: "{{in}} parameter `{{name}}`",
  param_component: "{{in}} parameter `{{name}}` of {{component}}",
  param_required: "required {{in}} parameter `{{name}}`",
  paramName: "parameter name",
  paramName_in: "name of {{in}} parameter",
  status: "{{key}} status",
  method: "operation `{{method}} {{path}}`",
  path: "path `{{path}}`",
  component: "{{kind}} component `{{key}}`",
  annotation: "annotation ({{key}})",
  // the entries of an added or removed map or list, named by their keys ("callbacks `onEvent`", "links `GetPet`")
  entries: "{{key}} {{names}}",
  tag: "tag",
  security: "some security details",
  securityList: "security requirements {{names}}",
  securityNone: "empty security requirement list (public access)",
  securityRequirement: "security requirement {{name}}",
  anonymousRequirement: "anonymous security requirement `{}`",
  securityScheme: "security scheme `{{name}}`",
  securityScope: "scope",
  requirementOf: "a security requirement of {{target}}",
  schemeIn: "security scheme `{{name}}` in {{target}}",
  globalSecurity: "global security",
  serverUrl: "server URL",
  url: "URL",
  externalDocs: "externalDocs",
  externalDocs_url: "externalDocs {{url}}",
  serverOf: "server `{{name}}`",
  openapi: "OpenAPI version",
  apiVersion: "API version",
  document: "document metadata ({{key}})",
  requestBody: "Request Body",
  requestBody_name: "Request Body `{{name}}`",
  requestBody_contentType: "Request Body content ({{contentType}})",
  requestBody_name_contentType: "Request Body `{{name}}` content ({{contentType}})",
  requestBody_name_renamedFrom: "Request Body `{{name}}` (renamed from `{{renamedFrom}}`)",
  requestBody_name_contentType_renamedFrom:
    "Request Body `{{name}}` (renamed from `{{renamedFrom}}`) content ({{contentType}})",
  response: "Response {{responseCode}}",
  response_contentType: "Response {{responseCode}} content ({{contentType}})",
  response_responseFrom: "Response {{responseCode}} (renamed from `{{responseFrom}}`)",
  response_contentType_responseFrom:
    "Response {{responseCode}} (renamed from `{{responseFrom}}`) content ({{contentType}})",
  header: "header `{{name}}`",
  header_responseCode: "Response {{responseCode}} header `{{name}}`",
  header_renamedFrom: "header `{{name}}` (renamed from `{{renamedFrom}}`)",
  header_responseCode_responseFrom: "Response {{responseCode}} (renamed from `{{responseFrom}}`) header `{{name}}`",
  header_part_content: "header `{{name}}` of encoding `{{part}}` in {{content}}",
  contentType: "Content type",
  mediaType: "media type `{{contentType}}`",
  mediaTypes: "media types {{names}}",
  renamedMediaType: "media type `{{before}}` to `{{after}}` in {{target}}",
  encoding: "Encoding details",
  encoding_key: "Encoding details ({{key}})",
  encodingPart: "encoding `{{part}}`",
  encodingIn: "encoding `{{part}}` in {{content}}",
  renamedKey: "`{{before}}` to `{{after}}`",
  // a header renamed by case only (header names are case-insensitive)
  renamedHeader: "header `{{before}}` to `{{after}}` in {{target}}",
  renamedResponse: "Response `{{before}}` to `{{after}}`",
  // an entry renamed with every reference repointed (ISSUE-78, POLICY-101)
  renamedComponent: "{{kind}} component `{{before}}` to `{{after}}`",
  renamedScheme: "security scheme `{{before}}` to `{{after}}` in {{target}}",
  extension: "extension `{{key}}`",
  extensionProperty: "property `{{property}}` of extension `{{key}}`",
  extensionValue: "value {{value}} of extension `{{key}}`",
}

const httpMethods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"])
const isMethod = (key: string | number) => isString(key) && httpMethods.has(key)

// the values of a changed field; free-text fields (`description`, `summary`, `title`) shortened (POLICY-95)
const valuesOf = (diff: Diff, ctx: CompareContext, key: unknown) =>
  keywordValues(diff, ctx, false, isFreeTextKey(key) ? FREE_TEXT_LENGTH : undefined)

const MAX_NAMES = 5
const backticked = (name: unknown) => `\`${String(name).replace(/`/g, "'")}\``

/** Names in backticks, the first five and the count of the rest (`a`, `b`); `undefined` for none. */
const nameList = (names: unknown[], separator = ", "): string | undefined => {
  if (!names.length) {
    return
  }
  const listed = names.slice(0, MAX_NAMES).map(backticked).join(separator)
  return names.length > MAX_NAMES ? `${listed}${separator}… (${names.length} in all)` : listed
}

// the name of an item of an OpenAPI list: a parameter or tag `name`, a server `url`, a scalar itself
const itemName = (item: unknown): unknown => {
  if (!isObject(item) || isArray(item)) {
    return isObject(item) ? undefined : item
  }
  return item.name ?? item.url ?? (isString(item.$ref) ? item.$ref.slice(item.$ref.lastIndexOf("/") + 1) : undefined)
}

/** The entry names of a map (its keys, without extensions) or list (its items' names) for the `entries` template. */
const entryNames = (value: unknown): string | undefined => {
  if (isArray(value)) {
    const names = value.map(itemName).filter((name) => name !== undefined && name !== null)
    return names.length === value.length ? nameList(names) : undefined
  }
  return isObject(value) ? nameList(Object.keys(value).filter((key) => !key.startsWith("x-"))) : undefined
}

const operationName = (method: string | number, at: string) => `operation \`${String(method).toUpperCase()} ${at}\``

// operations of a document: path items, 3.2 additional operations, webhooks, callbacks and path item components
interface OperationPrefix {
  at: ContainerSegment[]
  name: (keys: (string | number)[]) => string
}
const operationPrefixes: OperationPrefix[] = [
  { at: ["paths", "*", isMethod], name: ([path, method]) => operationName(method, String(path)) },
  { at: ["paths", "*", "additionalOperations", "*"], name: ([path, method]) => operationName(method, String(path)) },
  {
    at: ["webhooks", "*", isMethod],
    name: ([name, method]) => `operation \`${String(method).toUpperCase()}\` of webhook \`${name}\``,
  },
  {
    at: ["paths", "*", isMethod, "callbacks", "*", "*", isMethod],
    name: ([, , callback, expression, method]) =>
      `${operationName(method, String(expression))} of callback \`${callback}\``,
  },
  {
    at: ["webhooks", "*", isMethod, "callbacks", "*", "*", isMethod],
    name: ([, , callback, expression, method]) =>
      `${operationName(method, String(expression))} of callback \`${callback}\``,
  },
  {
    at: ["components", "pathItems", "*", isMethod],
    name: ([name, method]) => `operation \`${String(method).toUpperCase()}\` of path item component \`${name}\``,
  },
  {
    at: ["components", "callbacks", "*", "*", isMethod],
    name: ([callback, expression, method]) =>
      `${operationName(method, String(expression))} of callback component \`${callback}\``,
  },
]

const captures = (segments: ContainerSegment[]) =>
  segments.filter((s) => s === "*" || s === "#" || typeof s === "function").length

type InnerName = (keys: (string | number)[], root: unknown, path: JsonPath, operation: string) => string | undefined

/** Container patterns below every operation; `name` gets the keys captured below the operation and its name. */
const inOperations = (inner: ContainerSegment[], name: InnerName): ContainerPattern[] =>
  operationPrefixes.map((prefix) => {
    const count = captures(prefix.at)
    return {
      at: [...prefix.at, ...inner],
      name: (keys, root, path) => name(keys.slice(count), root, path, prefix.name(keys.slice(0, count))),
    }
  })

const serverName = (root: unknown, path: JsonPath): string | undefined => {
  const server = getKeyValue(root, ...path)
  // by URL (a changed URL is described by `serverUrlChangeAnnotation`, which names a 3.2 server by its `name`)
  const name = getStringValue(server, "url") ?? getStringValue(server, "name")
  return name !== undefined ? `server \`${name}\`` : undefined
}

const parameterName = (root: unknown, path: JsonPath): string | undefined => {
  const parameter = resolveRef(getKeyValue(root, ...path), root)
  const name = getStringValue(parameter, "name")
  const location = getStringValue(parameter, "in")
  return name === undefined ? undefined : location ? `${location} parameter \`${name}\`` : `parameter \`${name}\``
}

const requestContent = (contentType: string | number) => `Request Body content (${contentType})`
const responseContent = (code: string | number, contentType: string | number) =>
  `Response ${code} content (${contentType})`

const operationPatterns: ContainerPattern[] = operationPrefixes.map(({ at, name }) => ({ at, name }))

/**
 * Named containers of an OpenAPI document for the fallback description (POLICY-08: the nearest container; `diff.path`
 * carries the operation): paths, operations (also 3.2 additional operations, webhooks, callbacks and path item
 * components), callbacks, parameters, request and response media types, examples, encodings, response headers and
 * links, components, servers (by name or URL), tags and info. Per-spec templates name the same containers through
 * `locateOpenApiNode`.
 */
export const locateOpenApiContainer: ContainerLocator = createContainerLocator([
  { at: ["paths", "*"], name: ([path]) => `path \`${path}\`` },
  ...operationPatterns,
  { at: ["webhooks", "*"], name: ([name]) => `webhook \`${name}\`` },
  { at: ["components", "*", "*"], name: ([kind, name]) => `${componentKindWord(String(kind))} component \`${name}\`` },
  ...inOperations(
    ["callbacks", "*"],
    ([callback], _root, _path, operation) => `callback \`${callback}\` of ${operation}`,
  ),
  ...inOperations(["parameters", "#"], (_keys, root, path) => parameterName(root, path)),
  ...inOperations(["parameters", "#", "examples", "*"], ([, example], root, path) => {
    const parameter = parameterName(root, path.slice(0, -2))
    return parameter && `example \`${example}\` in ${parameter}`
  }),
  ...inOperations(["requestBody", "content", "*"], ([contentType]) => requestContent(contentType)),
  ...inOperations(
    ["requestBody", "content", "*", "examples", "*"],
    ([contentType, example]) => `example \`${example}\` in ${requestContent(contentType)}`,
  ),
  ...inOperations(
    ["requestBody", "content", "*", "encoding", "*"],
    ([contentType, part]) => `encoding \`${part}\` in ${requestContent(contentType)}`,
  ),
  // no pattern for a bare response: its fields are described by `responseChangeAnnotation`; the generated description
  // of a custom rule set names the operation there (A8.8)
  ...inOperations(["responses", "*", "content", "*"], ([code, contentType]) => responseContent(code, contentType)),
  ...inOperations(
    ["responses", "*", "content", "*", "examples", "*"],
    ([code, contentType, example]) => `example \`${example}\` in ${responseContent(code, contentType)}`,
  ),
  ...inOperations(["responses", "*", "headers", "*"], ([code, header]) => `Response ${code} header \`${header}\``),
  ...inOperations(
    ["responses", "*", "headers", "*", "examples", "*"],
    ([code, header, example]) => `example \`${example}\` of Response ${code} header \`${header}\``,
  ),
  ...inOperations(["responses", "*", "links", "*"], ([code, link]) => `link \`${link}\` in Response ${code}`),
  ...inOperations(["responses", "*", "links", "*", "server"], ([, link], root, path) => {
    const server = serverName(root, path)
    return server && `${server} of link \`${link}\``
  }),
  { at: ["servers", "#"], name: (_keys, root, path) => serverName(root, path) },
  { at: ["paths", "*", "servers", "#"], name: (_keys, root, path) => serverName(root, path) },
  ...inOperations(["servers", "#"], (_keys, root, path) => serverName(root, path)),
  {
    at: ["tags", "#"],
    name: (_keys, root, path) => {
      const name = getStringValue(getKeyValue(root, ...path), "name")
      return name !== undefined ? `tag \`${name}\`` : undefined
    },
  },
  { at: ["info"], name: () => "document info" },
])

/** The operation a node belongs to (path item, additional, webhook, callback or path item component operation). */
export const locateOpenApiOperation: ContainerLocator = createContainerLocator(operationPatterns)

/** Where a node sits in the OpenAPI document, derived from the context chain (works inside `$ref` targets). */
export interface OpenApiLocation {
  responseCode?: string
  contentType?: string
  requestBody?: boolean
  parameter?: { in?: string; name?: string }
  headerName?: string
  componentName?: string
  // the `components.<kind>.<name>` entry the node belongs to (ISSUE-56) and its node
  component?: { kind: string; name: string; node: NodeContext }
  requestBodyName?: string
  // the encoding entry (multipart part) the node belongs to (ISSUE-86)
  encodingPart?: string
  // the ancestor that is the schema root (parameter / content / header schema), if the node is inside a schema
  schemaRoot?: NodeContext
  // the component the node lies in (not the component itself), when it was renamed: its kind, new and old key
  renamed?: { kind: string; name: string; from: string }
}

const nodeSide = (ctx: CompareContext): NodeContext => (ctx.after.value !== undefined ? ctx.after : ctx.before)

export const locateOpenApiNode = (ctx: CompareContext): OpenApiLocation => locateFrom(nodeSide(ctx), ctx)

// the nodes are recognized by the kind their rule gives them (`CompareRule.kind`), not by key names: a header,
// parameter, component or property named like a field (`schema`, `content`, `headers`, `items`, …) is never read as
// one (ISSUE-300)
const locateFrom = (start: NodeContext | undefined, ctx?: CompareContext): OpenApiLocation => {
  const location: OpenApiLocation = {}
  let node: NodeContext | undefined = start
  let schemaRoot: NodeContext | undefined

  while (node) {
    const key: string | number = node.key
    const up: NodeContext | undefined = node.up
    switch (node.kind) {
      case SCHEMA_KIND:
        if (up) {
          schemaRoot = node
        }
        break
      case "mediaType":
        // an entry of a `content` map (a 3.2 `components.mediaTypes` entry is named by the component)
        if (up?.key === "content" && isString(key)) {
          location.contentType = key
        }
        break
      case "encoding":
        if (up?.key === "encoding" && isString(key) && location.encodingPart === undefined) {
          location.encodingPart = key
        }
        break
      case "response":
        location.responseCode = String(key)
        break
      case "requestBody":
        location.requestBody = true
        break
      case "header":
        if (isString(key)) {
          location.headerName = key
        }
        break
      case "parameter": {
        const param = resolveRef(node.value, node.root)
        location.parameter = { in: getStringValue(param, "in"), name: getStringValue(param, "name") ?? String(key) }
        break
      }
    }
    if (up?.up?.key === "components" && up.up.up?.up === undefined && isString(key) && isString(up.key)) {
      location.component = { kind: up.key, name: key, node }
      if (up.key === "schemas") {
        location.componentName = key
      }
      if (up.key === "requestBodies") {
        location.requestBody = true
        location.requestBodyName = key
      }
    }
    node = up
  }

  location.schemaRoot = schemaRoot
  // the renamed component the node lies in (POLICY-107 / 114)
  const { component } = location
  const renamed = ctx && component && component.node !== start ? renamedEntryOf(ctx, component.node) : undefined
  if (component && renamed) {
    location.renamed = { kind: component.kind, ...renamed }
  }
  return location
}

// the renamed component a container named by its content lies in ("parameter component `New` (renamed from `Old`)",
// POLICY-114)
const componentNote = (location: OpenApiLocation): AnnotateTemplate | undefined => {
  const { renamed } = location
  return renamed
    ? t("componentNote", { kind: componentKindWord(renamed.kind), name: renamed.name, from: renamed.from })
    : undefined
}

// the key a renamed component of the kind had before
const renamedFromOf = (location: OpenApiLocation, kind: string): string | undefined =>
  location.renamed?.kind === kind ? location.renamed.from : undefined

// a parameter, named by its `in` and `name` fields, with the renamed component it lies in (POLICY-114)
const paramTarget = (location: OpenApiLocation): AnnotateTemplate =>
  t("param", { ...location.parameter, component: componentNote(location) })

// a 3.2 `components.mediaTypes` entry (ISSUE-311)
const mediaTypeComponentTarget = (location: OpenApiLocation): AnnotateTemplate | undefined =>
  location.component?.kind === "mediaTypes" && location.contentType === undefined
    ? t("mediaTypeComponent", { name: location.component.name, renamedFrom: renamedFromOf(location, "mediaTypes") })
    : undefined

const hasSchemaLocation = (location: OpenApiLocation) =>
  location.schemaRoot !== undefined &&
  (location.parameter ||
    location.headerName !== undefined ||
    location.contentType !== undefined ||
    location.component?.kind === "mediaTypes")

// the media type a header of an encoding entry belongs to (the header and the part removed from the location)
const encodingContent = (location: OpenApiLocation): AnnotateTemplate =>
  contentTarget({ ...location, headerName: undefined, parameter: undefined, encodingPart: undefined })

// a `components.<kind>` entry renamed with every reference repointed (POLICY-101): "schema component `Old` to `New`"
const componentRenameAnnotation = (diff: Diff): string | undefined => {
  const { path } = diff
  if (diff.action !== "rename" || path.length !== 2 || path[0] !== "components" || !isString(path[1])) {
    return
  }
  const text = t("renamedComponent", { kind: componentKindWord(path[1]), before: diff.before, after: diff.after })
  return createAnnotation(t("rename", { text }), openApiAnnotations, diff.type) || undefined
}

export const openApi3AnnotateHook: AnnotateHook = (diff, ctx) => {
  const renameText = componentRenameAnnotation(diff)
  if (renameText) {
    return renameText
  }
  const annotate = ctx.rules ? ruleView(ctx.rules).annotate : undefined
  if (!annotate) {
    return fallbackAnnotation(diff, ctx, locateOpenApiContainer)
  }

  const location = locateOpenApiNode(ctx)

  // the component the node lies in, when it was renamed (POLICY-107: its new and its old key are named)
  const { component, renamed } = location
  const renamedKind = renamed?.kind

  if (hasSchemaLocation(location)) {
    const schemaChange =
      createAnnotation(annotate(diff, ctx), jsonSchemaAnnotations, diff.type) ||
      fallbackAnnotation(diff, ctx, () => schemaContainer(location.schemaRoot?.path.length ?? 0))
    const { parameter, headerName, responseCode, contentType, encodingPart } = location
    // a renamed response component is named by its key in place of a status code
    const responseFrom = renamedKind === "responses" ? renamed?.from : undefined
    let text: string
    if (headerName !== undefined) {
      const part = encodingPart !== undefined ? { part: encodingPart, content: encodingContent(location) } : {}
      const headerFrom =
        renamedKind === "headers" && component?.name === headerName && !part.part ? renamed?.from : undefined
      text = createAnnotation(
        t("headerSchema", {
          schemaChange,
          name: headerName,
          responseCode,
          ...part,
          renamedFrom: headerFrom,
          responseFrom: part.part ? undefined : responseFrom,
        }),
        openApiAnnotations,
        diff.type,
      )
    } else if (parameter) {
      text = createAnnotation(
        t("parameterSchema", { schemaChange, ...parameter, contentType, component: componentNote(location) }),
        openApiAnnotations,
        diff.type,
      )
    } else if (location.component?.kind === "mediaTypes" && contentType === undefined) {
      text = createAnnotation(
        t("mediaTypeComponentSchema", { schemaChange, component: mediaTypeComponentTarget(location) }),
        openApiAnnotations,
        diff.type,
      )
    } else if (responseCode !== undefined) {
      text = createAnnotation(
        t("responseSchema", { schemaChange, responseCode, contentType, responseFrom }),
        openApiAnnotations,
        diff.type,
      )
    } else {
      const name = location.requestBodyName
      text = createAnnotation(
        t("requestBodySchema", {
          schemaChange,
          contentType,
          name,
          renamedFrom: renamedKind === "requestBodies" && name !== undefined ? renamed?.from : undefined,
        }),
        openApiAnnotations,
        diff.type,
      )
    }
    return text || fallbackAnnotation(diff, ctx, locateOpenApiContainer)
  }

  // a node inside a schema component (not the component itself): the schema change in the named component (ISSUE-56)
  if (component?.kind === "schemas" && component.node !== nodeSide(ctx)) {
    const schemaChange =
      createAnnotation(annotate(diff, ctx), jsonSchemaAnnotations, diff.type) ||
      fallbackAnnotation(diff, ctx, () => schemaContainer(component.node.path.length))
    const text = createAnnotation(
      t("componentSchema", { schemaChange, name: component.name, renamedFrom: renamed?.from }),
      openApiAnnotations,
      diff.type,
    )
    return text || fallbackAnnotation(diff, ctx, locateOpenApiContainer)
  }

  return describeDiff(diff, ctx, openApiAnnotations, annotate, locateOpenApiContainer)
}

const changedValue = (diff: Diff, ctx: CompareContext) => (diff.action === "add" ? ctx.after.value : ctx.before.value)

// fields whose value is a map or a list of named entries
const entryFields = new Set([
  "callbacks",
  "responses",
  "servers",
  "parameters",
  "tags",
  "links",
  "headers",
  "examples",
  "encoding",
  "variables",
])

/** An added or removed map / list named by its entries ("[Added] links `GetPet` to Response 201"). */
const entriesText = (diff: Diff, ctx: CompareContext, key: string | number) => {
  if ((diff.action !== "add" && diff.action !== "remove") || !entryFields.has(String(key))) {
    return
  }
  const names = entryNames(changedValue(diff, ctx))
  return names !== undefined ? t("entries", { key, names }) : undefined
}

// `externalDocs` added or removed as a whole, named by its URL
const externalDocsText = (diff: Diff, ctx: CompareContext, key: unknown) =>
  key === "externalDocs" && (diff.action === "add" || diff.action === "remove")
    ? t("externalDocs", { url: formatParam(getStringValue(changedValue(diff, ctx), "url")) })
    : undefined

// an operation as the target of a description: its container name (ISSUE-81)
const operationTarget = (diff: Diff, ctx: CompareContext) => locateOpenApiOperation(diff, ctx)?.name

export const pathMethodChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const operation = locateOpenApiOperation(diff, ctx)
  if (operation && operation.length === path.length) {
    return t(action, { text: operation.name })
  }
  return t(action, { text: t("method", { path: path[1], method: String(path[path.length - 1]).toUpperCase() }) })
}

export const pathItemChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const key = path[path.length - 1]
  const pathItem = locateOpenApiContainer({ ...diff, path: path.slice(0, -1) }, ctx)?.name
  return t(action, {
    text: t("annotation", { key }),
    target: pathItem ?? t("path", { path: path[1] }),
    ...valuesOf(diff, ctx, key),
  })
}

export const componentChangeAnnotation: ChangeAnnotationResolver = ({ action, path }) => {
  return t(action, { text: t("component", { kind: String(path[1]).replace(/s$/, ""), key: path[2] }) })
}

/** Document fields: `openapi`, `info.*`, `$self`, `jsonSchemaDialect`, root `externalDocs` (ISSUE-84: with values). */
export const documentChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const key = path.join(".")
  const text =
    key === "openapi"
      ? t("openapi")
      : key === "info.version"
        ? t("apiVersion")
        : (externalDocsText(diff, ctx, key) ?? t("document", { key }))
  return t(action, { text, ...valuesOf(diff, ctx, path[path.length - 1]) })
}

/** The entries of a list of servers added or removed as a whole, at the root, a path item or an operation. */
export const serversChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const key = path[path.length - 1]
  const owner = path.length > 1 ? locateOpenApiContainer({ ...diff, path: path.slice(0, -1) }, ctx)?.name : undefined
  return t(action, { text: entriesText(diff, ctx, key) ?? t("annotation", { key }), target: owner })
}

/** A server URL changed: the server is named by its 3.2 `name` (a URL is the changed value, not its name). */
export const serverUrlChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const server = getKeyValue((action === "add" ? ctx.after : ctx.before).root, ...path.slice(0, -1))
  const name = getStringValue(server, "name")
  // the owner of the server list (path item, operation) or of a link `server`
  const servers = path.lastIndexOf("servers")
  const ownerPath = servers >= 0 ? path.slice(0, servers) : path.slice(0, -2)
  const owner =
    name !== undefined
      ? t("serverOf", { name })
      : ownerPath.length
        ? locateOpenApiContainer({ ...diff, path: ownerPath }, ctx)?.name
        : undefined
  return t(action, { text: t(name !== undefined ? "url" : "serverUrl"), target: owner, ...keywordValues(diff, ctx) })
}

/** The list of tags of the document added or removed as a whole. */
export const tagsChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const key = diff.path[diff.path.length - 1]
  return t(diff.action, { text: entriesText(diff, ctx, key) ?? t("annotation", { key }) })
}

// a security requirement named by its schemes (AND); the empty requirement is anonymous access
const requirementName = (requirement: unknown): string | undefined =>
  isObject(requirement) && !isArray(requirement) ? nameList(Object.keys(requirement), " and ") : undefined

// a list of alternative requirements (OR)
const requirementList = (requirements: unknown): string | undefined => {
  if (!isArray(requirements)) {
    return
  }
  const names = requirements.map((requirement) => requirementName(requirement) ?? "anonymous `{}`")
  return names.length ? names.join(" or ") : undefined
}

/**
 * Global and operation security (ISSUE-83): the requirements of a list added or removed as a whole, a requirement
 * (alternative) by its schemes, a scheme of a requirement, a scope of a scheme; the owner is the operation or the
 * global security. Removing or adding an operation list states the global requirements that apply instead.
 */
export const securityChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const index = path.lastIndexOf("security")
  const inside = path.slice(index + 1)
  const operation = index > 0 ? operationTarget(diff, ctx) : undefined
  const owner = operation ?? t("globalSecurity")
  const value = changedValue(diff, ctx)

  if (!inside.length) {
    if (action !== "add" && action !== "remove") {
      return
    }
    const names = requirementList(value)
    const text = names !== undefined ? t("securityList", { names }) : isArray(value) ? t("securityNone") : undefined
    if (!text) {
      return
    }
    // the global requirements that apply instead of a removed operation list, or that an added one overrides
    const global = operation ? requirementList(getKeyValue(ctx.after.root, "security")) : undefined
    const clause =
      global === undefined || (action === "add" && global === names)
        ? {}
        : action === "add"
          ? { overridden: global }
          : { inherited: global }
    return t(action, { text, target: owner, ...clause })
  }

  if (inside.length === 1) {
    // a scheme renamed with every requirement repointed (ISSUE-78, POLICY-101)
    if (action === "rename") {
      return t(action, {
        text: t("renamedScheme", {
          before: diff.before,
          after: diff.after,
          target: t("requirementOf", { target: owner }),
        }),
      })
    }
    if (action === "replace") {
      return
    }
    const name = requirementName(value)
    const text = name !== undefined ? t("securityRequirement", { name }) : t("anonymousRequirement")
    return t(action, { text, target: owner })
  }

  const scheme = String(inside[1])
  if (inside.length === 2) {
    return t(action, { text: t("securityScheme", { name: scheme }), target: t("requirementOf", { target: owner }) })
  }

  return t(action, {
    text: t("securityScope"),
    target: t("schemeIn", { name: scheme, target: owner }),
    ...keywordValues(diff, ctx),
  })
}

export const requestBodyChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, action } = diff
  const key = path[path.length - 1]
  const location = locateOpenApiNode(ctx)
  const requestBody = t("requestBody", {
    name: location.requestBodyName,
    renamedFrom: renamedFromOf(location, "requestBodies"),
  })

  if (key === "requestBody") {
    return t(action, { text: requestBody })
  }
  if (key === "required" || key === "deprecated") {
    return t(action, { text: t("status", { key }), target: requestBody })
  }

  return t(action, { text: t("annotation", { key }), target: requestBody, ...valuesOf(diff, ctx, key) })
}

export const responseChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, action } = diff
  const location = locateOpenApiNode(ctx)
  const { responseCode } = location
  const key = path[path.length - 1]

  if (action === "rename") {
    return t(action, { text: t("renamedResponse", { before: diff.before, after: diff.after }) })
  }
  if (responseCode === undefined || String(key) === responseCode) {
    return t(action, { text: t("response", { responseCode: responseCode ?? key }) })
  }

  const response = t("response", { responseCode, responseFrom: renamedFromOf(location, "responses") })
  if (key === "links" || key === "headers") {
    const entries = entriesText(diff, ctx, key)
    if (entries) {
      return t(action, { text: entries, target: response })
    }
  }
  return t(action, { text: t("annotation", { key }), target: response, ...valuesOf(diff, ctx, key) })
}

// a header named with its response, or with its encoding entry and media type (ISSUE-86)
const headerTarget = (location: OpenApiLocation): AnnotateTemplate => {
  const { headerName, responseCode, encodingPart } = location
  if (encodingPart !== undefined) {
    return t("header", { name: headerName, part: encodingPart, content: encodingContent(location) })
  }
  // a renamed header or response component names its new and its old key (POLICY-107)
  const renamedFrom = location.component?.name === headerName ? renamedFromOf(location, "headers") : undefined
  return t("header", {
    name: headerName,
    responseCode,
    renamedFrom,
    responseFrom: renamedFromOf(location, "responses"),
  })
}

const contentTarget = (location: OpenApiLocation): AnnotateTemplate => {
  const { responseCode, contentType, headerName, parameter } = location
  if (headerName !== undefined) {
    return headerTarget(location)
  }
  if (parameter) {
    return paramTarget(location)
  }
  const mediaTypeComponent = mediaTypeComponentTarget(location)
  if (mediaTypeComponent) {
    return mediaTypeComponent
  }
  return responseCode !== undefined
    ? t("response", { contentType, responseCode, responseFrom: renamedFromOf(location, "responses") })
    : t("requestBody", {
        contentType,
        name: location.requestBodyName,
        renamedFrom: renamedFromOf(location, "requestBodies"),
      })
}

/** Media types (ISSUE-85): a media type added, removed or renamed (wildcard, parameters), and its fields. */
export const contentChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, action } = diff
  const location = locateOpenApiNode(ctx)
  const key = path[path.length - 1]
  const owner = contentTarget({ ...location, contentType: undefined })

  if (action === "rename") {
    return t(action, {
      text: t("renamedMediaType", { before: diff.before, after: diff.after, target: owner }),
    })
  }
  if (key === "content") {
    // the media types of a content map added or removed as a whole
    const value = changedValue(diff, ctx)
    const mediaTypes =
      action !== "replace" && isObject(value) ? Object.keys(value).filter((k) => !k.startsWith("x-")) : []
    const text =
      mediaTypes.length === 1
        ? t("mediaType", { contentType: mediaTypes[0] })
        : mediaTypes.length
          ? t("mediaTypes", { names: nameList(mediaTypes) })
          : t("contentType")
    return t(action, { text, target: owner })
  }
  // a 3.2 media type component itself, and its fields (ISSUE-311)
  const mediaTypeComponent = mediaTypeComponentTarget(location)
  if (mediaTypeComponent && location.component && path.length === 3 && action !== "replace") {
    return t(action, { text: t("component", { kind: "media type", key }) })
  }
  if (mediaTypeComponent && path.length > 3) {
    const examples = key === "examples" ? entriesText(diff, ctx, key) : undefined
    return t(action, {
      text: examples ?? t("annotation", { key }),
      target: mediaTypeComponent,
      ...(examples ? {} : valuesOf(diff, ctx, key)),
    })
  }
  if (location.contentType && location.contentType !== key) {
    const examples = key === "examples" ? entriesText(diff, ctx, key) : undefined
    return t(action, {
      text: examples ?? t("annotation", { key }),
      target: contentTarget(location),
      ...(examples ? {} : valuesOf(diff, ctx, key)),
    })
  }

  return t(action, { text: t("mediaType", { contentType: key }), target: owner })
}

/** Encoding entries (multipart parts) of a media type, named with the part and the media type (ISSUE-85). */
export const encodingChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, action } = diff
  const location = locateOpenApiNode(ctx)
  const encodingIndex = path.lastIndexOf("encoding")
  const content = contentTarget({ ...location, encodingPart: undefined })
  if (encodingIndex < 0) {
    return t(action, { text: t("encoding"), target: content })
  }
  const inside = path.slice(encodingIndex + 1)
  if (!inside.length) {
    return t(action, { text: entriesText(diff, ctx, "encoding") ?? t("encoding"), target: content })
  }
  const part = String(inside[0])
  if (inside.length === 1) {
    return t(action, { text: t("encodingPart", { part }), target: content })
  }
  const key = inside.slice(1).join(".")
  const entries = inside.length === 2 && inside[1] === "headers" ? entriesText(diff, ctx, "headers") : undefined
  return t(action, {
    text: entries ?? t("annotation", { key }),
    target: t("encodingIn", { part, content }),
    ...(entries ? {} : keywordValues(diff, ctx)),
  })
}

/**
 * Operation fields (ISSUE-81): named with the operation (`` operation `GET /pets` ``, also webhook, callback and 3.2
 * additional operations), with the values of scalar fields (`operationId`, tags, `externalDocs.url`); an added or
 * removed map or list (callbacks, responses, servers, parameters) is named by its entries.
 */
export const operationChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { path, action } = diff
  const { key } = action === "add" ? ctx.after : ctx.before
  const operation = locateOpenApiOperation(diff, ctx)
  const target = operation?.name

  if (key === "deprecated") {
    if (ctx.after.value) {
      return t("add", { text: t("status", { key }), target })
    }
    if (ctx.before.value) {
      return t("remove", { text: t("status", { key }), target })
    }
    return
  }

  if (key === "requestBody") {
    return t(action, { text: t(key), target })
  }

  const inside = operation ? path.slice(operation.length) : [key]
  if (inside[0] === "tags" && typeof key === "number") {
    return t(action, { text: t("tag"), target, ...keywordValues(diff, ctx) })
  }

  if (inside.length === 1) {
    const entries = entriesText(diff, ctx, key) ?? externalDocsText(diff, ctx, key)
    if (entries) {
      return t(action, { text: entries, target })
    }
  }

  return t(action, { text: t("annotation", { key: inside.join(".") }), target, ...valuesOf(diff, ctx, key) })
}

export const parameterChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const location = locateOpenApiNode(ctx)
  const { key } = action === "add" ? ctx.after : ctx.before
  const param = location.parameter ?? {}
  const target = t("param", { ...param, component: componentNote(location) })

  if (typeof key === "number" || path[path.length - 2] === "parameters") {
    return t(action, { text: target })
  }
  if (key === "required" || key === "deprecated") {
    return statusChange(diff, ctx, key, target)
  }
  // a renamed parameter (path template parameter): the name is the changed value (ISSUE-82)
  if (key === "name" && action === "replace") {
    return t(action, { text: t("paramName", { in: param.in }), ...keywordValues(diff, ctx) })
  }
  if (key === "examples") {
    const entries = entriesText(diff, ctx, key)
    if (entries) {
      return t(action, { text: entries, target })
    }
  }
  // a nested value (an object example) is named by its path inside the parameter (ISSUE-73)
  const index = path.lastIndexOf("parameters")
  const nested = index >= 0 && path.length > index + 3 ? path.slice(index + 2).join(".") : key
  return t(action, { text: t("annotation", { key: nested }), target, ...valuesOf(diff, ctx, key) })
}

// a boolean flag (`required`, `deprecated`) of a parameter or header: its status, with the values of a replace
const statusChange = (diff: Diff, ctx: CompareContext, key: string, target: AnnotateTemplate) =>
  t(diff.action, {
    text: t("status", { key }),
    target,
    ...(diff.action === "replace" ? keywordValues(diff, ctx) : {}),
  })

export const headerChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const location = locateOpenApiNode(ctx)
  const key = path[path.length - 1]

  // a header renamed by case only: reported at its headers map
  if (action === "rename") {
    const { encodingPart, responseCode } = location
    const target =
      encodingPart !== undefined
        ? t("encodingIn", { part: encodingPart, content: encodingContent(location) })
        : t("response", { responseCode, responseFrom: renamedFromOf(location, "responses") })
    return t(action, { text: t("renamedHeader", { before: diff.before, after: diff.after, target }) })
  }
  if (key === location.headerName) {
    return t(action, { text: headerTarget(location) })
  }
  if (key === "required" || key === "deprecated") {
    return statusChange(diff, ctx, key, headerTarget(location))
  }
  return t(action, { text: t("annotation", { key }), target: headerTarget(location), ...valuesOf(diff, ctx, key) })
}

// the node that owns the extension (its parent), found on the context chain of the described node
const extensionOwner = (ctx: CompareContext, extension: number): NodeContext | undefined => {
  let node: NodeContext | undefined = nodeSide(ctx)
  while (node && node.path.length > extension) {
    node = node.up
  }
  return node
}

/** The container of an extension: parameter, header, content, response, request body, link, operation, path, server. */
const extensionTarget = (diff: Diff, ctx: CompareContext, extension: number) => {
  const owner = extensionOwner(ctx, extension)
  const location = locateFrom(owner, ctx)
  const path = diff.path.slice(0, extension)
  const root = (diff.action === "add" ? ctx.after : ctx.before).root

  const links = path.lastIndexOf("links")
  if (links >= 0 && links === path.length - 2) {
    return `link \`${String(path[links + 1])}\``
  }
  if (location.headerName !== undefined || location.parameter || location.contentType !== undefined) {
    return contentTarget(location)
  }
  if (location.responseCode !== undefined) {
    return t("response", { responseCode: location.responseCode })
  }
  if (location.requestBody) {
    return t("requestBody")
  }
  const servers = path.lastIndexOf("servers")
  if (servers >= 0 && typeof path[servers + 1] === "number") {
    const url = getStringValue(getKeyValue(root, ...path.slice(0, servers + 2)), "url")
    const server = url !== undefined ? `server \`${url}\`` : describePath(path.slice(0, servers + 2))
    return path[servers + 2] === "variables" && path.length > servers + 3
      ? `variable \`${String(path[servers + 3])}\` of ${server}`
      : server
  }
  if (path[0] === "tags" && typeof path[1] === "number") {
    const name = getStringValue(getKeyValue(root, "tags", path[1]), "name")
    return name !== undefined ? `tag \`${name}\`` : describePath(path)
  }
  const operation = locateOpenApiOperation({ ...diff, path }, ctx)
  if (operation) {
    return operation.name
  }
  if (path[0] === "paths" && isString(path[1])) {
    return t("path", { path: path[1] })
  }
  return path.length ? describePath(path) : undefined
}

/** Description of an `x-*` change in an OpenAPI object (POLICY-06: names the key and its container). */
export const openApiExtensionChangeAnnotation = extensionChangeAnnotation(extensionTarget)
