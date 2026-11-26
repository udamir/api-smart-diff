/**
 * The API location of a diff, for the result table and the issue report: for OpenAPI the HTTP method, the endpoint
 * (path template) and the request / response part (`GET /pets/{id} · response 200 application/json`); for AsyncAPI the
 * operation, the channel and the message; for GraphApi the operation kind, the field and arguments vs output; for
 * JSON Schema the JSON pointer only. A diff inside `components` names the component and lists its usages that the
 * engine reports (the diffs whose `origin` is the component path). Derived from `diff.path` (and `origin`, `scope`)
 * against the merged document, which has the shape the diff paths refer to (path-level parameters moved into the
 * operations, `$ref`s resolved), and the before / after documents. Pure: no DOM, no engine call.
 */
import type { CompareEngineName, Diff } from "../../../src"
import { pointer } from "./diff"

type Segment = string | number
type Path = readonly Segment[]

export interface DiffLocation {
  /** OpenAPI: the HTTP method; AsyncAPI: the operation (`send onOrderCreated`, `subscribe`); GraphApi: query / mutation / subscription */
  method: string
  /** OpenAPI: the endpoint (path template) or the webhook; AsyncAPI: the channel; GraphApi: the field; a component; a top-level section */
  target: string
  /** OpenAPI: request body / response / parameter; AsyncAPI: the message; GraphApi: argument / output */
  part: string
  /** the component the value is declared in (the diff has an `origin` in `components`) */
  via?: string
  /** for a diff inside `components`: the locations of the usages the engine reports for the same change */
  usages?: string[]
  /** the location in one line (the report and the cell titles) */
  text: string
}

export interface LocationContext {
  engine: CompareEngineName
  before?: unknown
  after?: unknown
  /** the merged document of the comparison (the paths of the diffs refer to its shape) */
  merged?: unknown
}

/** A location column of the result table: the `DiffLocation` field it shows and its header */
export interface LocationColumn {
  key: "method" | "target" | "part"
  label: string
}

/**
 * Location columns of the result table for an engine (`undefined`: one "Location" column with the JSON pointer). OpenAPI
 * shows the method and the endpoint only (the request / response part stays in the one-line text: cell titles and the
 * issue report); AsyncAPI keeps the message and GraphApi the arguments / output column, which also names the member
 * of a component (`field name · output`, `value RED`) the diff is in.
 */
export const locationColumns = (engine: string | undefined): LocationColumn[] | undefined => {
  switch (engine) {
    case "openapi":
      return [
        { key: "method", label: "Method" },
        { key: "target", label: "Endpoint" },
      ]
    case "asyncapi":
      return [
        { key: "method", label: "Operation" },
        { key: "target", label: "Channel" },
        { key: "part", label: "Message" },
      ]
    case "graphapi":
      return [
        { key: "method", label: "Operation" },
        { key: "target", label: "Field" },
        { key: "part", label: "Arguments / Output" },
      ]
    default:
      return undefined
  }
}

const SEPARATOR = " · "

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const unescapePointer = (segment: string): string => segment.replace(/~1/g, "/").replace(/~0/g, "~")

/** A node of a document, following local `$ref`s (`#/...`) on the way; `undefined` when the path does not exist */
const nodeAt = (document: unknown, path: Path, depth = 0): unknown => {
  let node = document
  for (const segment of path) {
    if (!isObject(node)) {
      return undefined
    }
    if (!(String(segment) in node) && typeof node.$ref === "string" && depth < 16) {
      node = resolveRef(document, node.$ref, depth + 1)
      if (!isObject(node)) {
        return undefined
      }
    }
    node = (node as Record<string, unknown>)[String(segment)]
  }
  return node
}

const resolveRef = (document: unknown, ref: string, depth: number): unknown => {
  if (!ref.startsWith("#/")) {
    return undefined
  }
  return nodeAt(document, ref.slice(2).split("/").map(unescapePointer), depth)
}

/** The first document (merged, after, before) that has the node, `$ref`s resolved */
const lookup = (context: LocationContext, path: Path): unknown => {
  for (const document of [context.merged, context.after, context.before]) {
    const node = nodeAt(document, path)
    if (node !== undefined) {
      const ref = isObject(node) && typeof node.$ref === "string" ? resolveRef(document, node.$ref, 1) : undefined
      return ref ?? node
    }
  }
  return undefined
}

/** The `$ref` of a node as written in the before or after document (the merged document may have it resolved) */
const refAt = (context: LocationContext, path: Path): string | undefined => {
  for (const document of [context.after, context.before, context.merged]) {
    const node = nodeAt(document, path)
    if (isObject(node) && typeof node.$ref === "string") {
      return node.$ref
    }
  }
  return undefined
}

const refName = (ref: string | undefined): string | undefined =>
  ref ? unescapePointer(ref.slice(ref.lastIndexOf("/") + 1)) : undefined

const join = (...parts: (string | undefined)[]): string => parts.filter(Boolean).join(SEPARATOR)

/** `label`: the target as the one-line text names it (`channel orderCreated`), the target itself by default */
const make = (method: string, target: string, part: string, label = target): DiffLocation => ({
  method,
  target,
  part,
  text: join(method && label && label === target ? `${method} ${label}` : join(method, label), part),
})

/** A top-level section of the document (`info · version`, `servers`, `openapi`) */
const documentLocation = (section: Segment | undefined, name: Segment | undefined): DiffLocation =>
  make("", section === undefined ? "document" : String(section), name === undefined ? "" : String(name))

// ---- OpenAPI ----------------------------------------------------------------------------------------------------

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"])

const OPENAPI_COMPONENTS: Record<string, string> = {
  schemas: "schema",
  responses: "response",
  parameters: "parameter",
  examples: "example",
  requestBodies: "request body",
  headers: "header",
  securitySchemes: "security scheme",
  links: "link",
  callbacks: "callback",
  pathItems: "path item",
}

const parameterLabel = (parameter: unknown): string => {
  if (isObject(parameter) && (typeof parameter.name === "string" || typeof parameter.in === "string")) {
    return ["parameter", parameter.in, parameter.name].filter((item) => typeof item === "string").join(" ")
  }
  return "parameter"
}

/** The part of a response below its status code: media type, header, link */
const responseRest = (rest: Path): string => {
  const [key, name] = rest
  if (key === "content" && name !== undefined) {
    return String(name)
  }
  if (key === "headers" && name !== undefined) {
    return `header ${name}`
  }
  if (key === "links" && name !== undefined) {
    return `link ${name}`
  }
  return ""
}

/**
 * The part of an operation (`rest` is the path below the operation object): parameters, request body, responses,
 * callbacks (described recursively), security
 */
const operationPart = (
  context: LocationContext,
  operationPath: Path,
  rest: Path,
  diff: Pick<Diff, "action" | "before" | "after">,
): string => {
  const [key, child] = rest
  switch (key) {
    case "parameters": {
      if (child === undefined) {
        return "parameters"
      }
      const own = rest.length === 2 ? (diff.action === "remove" ? diff.before : diff.after) : undefined
      return parameterLabel(isObject(own) ? own : lookup(context, [...operationPath, "parameters", child]))
    }
    case "requestBody": {
      const media = rest[1] === "content" && rest[2] !== undefined ? String(rest[2]) : ""
      return `request body${media ? ` ${media}` : ""}`
    }
    case "responses": {
      if (child === undefined) {
        return "responses"
      }
      const below = responseRest(rest.slice(2))
      return below.startsWith("header") || below.startsWith("link")
        ? `response ${child}${SEPARATOR}${below}`
        : `response ${child}${below ? ` ${below}` : ""}`
    }
    case "callbacks": {
      if (child === undefined) {
        return "callbacks"
      }
      const [, , expression, method, ...below] = rest
      const head = `callback ${child}`
      if (expression === undefined) {
        return head
      }
      if (method === undefined || !HTTP_METHODS.has(String(method))) {
        return join(head, String(expression))
      }
      const callbackPath = [...operationPath, "callbacks", child, expression, method]
      return join(
        head,
        `${String(method).toUpperCase()} ${expression}`,
        operationPart(context, callbackPath, below, diff),
      )
    }
    case "security":
      return "security"
    case "servers":
      return "servers"
    default:
      return ""
  }
}

/** A path item (`/paths/{template}`, `/webhooks/{name}`, a callback expression) and what is below it */
const pathItemLocation = (
  context: LocationContext,
  itemPath: Path,
  target: string,
  rest: Path,
  diff: Pick<Diff, "action" | "before" | "after">,
): DiffLocation => {
  const [key, child] = rest
  if (key !== undefined && HTTP_METHODS.has(String(key))) {
    return make(String(key).toUpperCase(), target, operationPart(context, [...itemPath, key], rest.slice(1), diff))
  }
  if (key === "parameters" && child !== undefined) {
    // path-level parameters (the operations have them as well, the transform copies them)
    const own = rest.length === 2 ? (diff.action === "remove" ? diff.before : diff.after) : undefined
    return make("", target, parameterLabel(isObject(own) ? own : lookup(context, [...itemPath, "parameters", child])))
  }
  return make("", target, key === undefined ? "" : String(key))
}

const openApiLocation = (context: LocationContext, path: Path, diff: Diff): DiffLocation => {
  const [section, name, ...rest] = path
  if (section === "paths" && name !== undefined) {
    return pathItemLocation(context, ["paths", name], String(name), rest, diff)
  }
  if (section === "webhooks" && name !== undefined) {
    return pathItemLocation(context, ["webhooks", name], `webhook ${name}`, rest, diff)
  }
  if (section === "components" && name !== undefined) {
    const kind = OPENAPI_COMPONENTS[String(name)] ?? String(name)
    const [component, ...below] = rest
    if (component === undefined) {
      return make("", `components ${name}`, "")
    }
    let part = ""
    if (name === "responses") {
      part = responseRest(below)
    } else if (name === "requestBodies" && below[0] === "content" && below[1] !== undefined) {
      part = String(below[1])
    } else if (name === "pathItems") {
      return pathItemLocation(context, ["components", name, component], `path item ${component}`, below, diff)
    } else if (name === "callbacks" && below.length >= 2) {
      const [expression, method, ...deeper] = below
      if (HTTP_METHODS.has(String(method))) {
        const callbackPath = ["components", name, component, expression, method]
        part = join(`${String(method).toUpperCase()} ${expression}`, operationPart(context, callbackPath, deeper, diff))
      } else {
        part = String(expression)
      }
    }
    return make("", `${kind} ${component}`, part)
  }
  return documentLocation(section, name)
}

// ---- AsyncAPI ---------------------------------------------------------------------------------------------------

const ASYNCAPI_COMPONENTS: Record<string, string> = {
  schemas: "schema",
  messages: "message",
  parameters: "parameter",
  channels: "channel",
  operations: "operation",
  servers: "server",
  securitySchemes: "security scheme",
  correlationIds: "correlation id",
  messageTraits: "message trait",
  operationTraits: "operation trait",
  serverBindings: "server bindings",
  channelBindings: "channel bindings",
  operationBindings: "operation bindings",
  messageBindings: "message bindings",
  replies: "reply",
  replyAddresses: "reply address",
  tags: "tag",
  externalDocs: "external docs",
}

/** The name of an AsyncAPI 2.x message: the `$ref` target, `name`, `messageId` or `title` */
const messageName = (context: LocationContext, path: Path): string => {
  const ref = refName(refAt(context, path))
  if (ref) {
    return ref
  }
  const message = lookup(context, path)
  if (isObject(message)) {
    for (const key of ["name", "messageId", "title"]) {
      if (typeof message[key] === "string") {
        return message[key] as string
      }
    }
  }
  return ""
}

/** Message part below a message object: payload, headers, ... */
const messageRest = (rest: Path): string => (rest.length ? String(rest[0]) : "")

/** AsyncAPI 3.0: the operations (`send onOrderCreated`) whose `channel` references the channel */
const channelOperations = (context: LocationContext, channel: Segment): string => {
  const ref = `#/channels/${String(channel).replace(/~/g, "~0").replace(/\//g, "~1")}`
  const found: string[] = []
  for (const document of [context.after, context.before, context.merged]) {
    const operations = isObject(document) ? document.operations : undefined
    if (!isObject(operations)) {
      continue
    }
    for (const [id, operation] of Object.entries(operations)) {
      if (!isObject(operation) || !isObject(operation.channel) || operation.channel.$ref !== ref) {
        continue
      }
      const label = `${typeof operation.action === "string" ? `${operation.action} ` : ""}${id}`
      if (!found.includes(label)) {
        found.push(label)
      }
    }
    if (found.length) {
      break
    }
  }
  return found.join(", ")
}

const asyncApiLocation = (context: LocationContext, path: Path): DiffLocation => {
  const [section, name, ...rest] = path
  if (section === "channels" && name !== undefined) {
    const [key, child, ...below] = rest
    if (key === "publish" || key === "subscribe") {
      // AsyncAPI 2.x operation
      if (child !== "message") {
        return make(key, String(name), "", `channel ${name}`)
      }
      if (below[0] === "oneOf" && below[1] !== undefined) {
        const messagePath = ["channels", name, key, "message", "oneOf", below[1]]
        const label = messageName(context, messagePath) || `#${below[1]}`
        return make(key, String(name), join(`message ${label}`, messageRest(below.slice(2))), `channel ${name}`)
      }
      const label = messageName(context, ["channels", name, key, "message"])
      const part = label ? join(`message ${label}`, messageRest(below)) : `message ${messageRest(below)}`.trim()
      return make(key, String(name), part, `channel ${name}`)
    }
    const operations = channelOperations(context, name)
    if (key === "messages" && child !== undefined) {
      return make(operations, String(name), join(`message ${child}`, messageRest(below)), `channel ${name}`)
    }
    if (key === "parameters" && child !== undefined) {
      return make(operations, String(name), `parameter ${child}`, `channel ${name}`)
    }
    return make(operations, String(name), key === undefined ? "" : String(key), `channel ${name}`)
  }
  if (section === "operations" && name !== undefined) {
    // AsyncAPI 3.0 operation
    const operation = lookup(context, ["operations", name])
    const action = isObject(operation) && typeof operation.action === "string" ? operation.action : ""
    const channel = refName(refAt(context, ["operations", name, "channel"])) ?? ""
    const [key, child] = rest
    let part = ""
    if (key === "messages" && child !== undefined) {
      const ref = refAt(context, ["operations", name, "messages", child])
      part = `message ${refName(ref) ?? `#${child}`}`
    } else if (key === "reply") {
      part = "reply"
    }
    return make(`${action ? `${action} ` : ""}${name}`, channel, part, channel ? `channel ${channel}` : "")
  }
  if (section === "components" && name !== undefined) {
    const kind = ASYNCAPI_COMPONENTS[String(name)] ?? String(name)
    const [component, ...below] = rest
    if (component === undefined) {
      return make("", `components ${name}`, "")
    }
    return make("", `${kind} ${component}`, name === "messages" ? messageRest(below) : "")
  }
  if (section === "servers" && name !== undefined) {
    return make("", `server ${name}`, "")
  }
  return documentLocation(section, name)
}

// ---- GraphApi ---------------------------------------------------------------------------------------------------

const GRAPHAPI_OPERATIONS: Record<string, string> = {
  queries: "query",
  mutations: "mutation",
  subscriptions: "subscription",
}

const GRAPHAPI_COMPONENTS: Record<string, string> = {
  objects: "object",
  inputObjects: "input",
  interfaces: "interface",
  enums: "enum",
  unions: "union",
  scalars: "scalar",
  directives: "directive",
}

const FIELD_METADATA = new Set(["description", "deprecation", "directives"])

/** The part below a field: an argument, its metadata or the output type */
const fieldPart = (rest: Path, scope: string): string => {
  const [key, child] = rest
  if (key === undefined) {
    return ""
  }
  if (key === "args") {
    return child === undefined ? "arguments" : `argument ${child}`
  }
  if (FIELD_METADATA.has(String(key))) {
    return String(key)
  }
  return scope === "args" ? "arguments" : "output"
}

const graphApiLocation = (context: LocationContext, path: Path, diff: Diff): DiffLocation => {
  const [section, name, ...rest] = path
  const operation = GRAPHAPI_OPERATIONS[String(section)]
  if (operation) {
    return make(operation, name === undefined ? "" : String(name), fieldPart(rest, diff.scope))
  }
  if (section === "components" && name !== undefined) {
    const kind = GRAPHAPI_COMPONENTS[String(name)] ?? String(name)
    const [component, key, child, ...below] = rest
    if (component === undefined) {
      return make("", `components ${name}`, "")
    }
    let part = ""
    if ((key === "methods" || key === "properties") && child !== undefined) {
      part = join(`field ${child}`, fieldPart(below, diff.scope))
    } else if (key === "values" && child !== undefined) {
      part = `value ${child}`
    } else if (key === "oneOf" && child !== undefined) {
      part = `member ${refName(refAt(context, ["components", name, component, "oneOf", child])) ?? `#${child}`}`
    } else if (key === "args" && child !== undefined) {
      part = `argument ${child}`
    } else if (key !== undefined) {
      part = String(key)
    }
    return make("", `${kind} ${component}`, part)
  }
  return documentLocation(section, name)
}

// ---- entry points -----------------------------------------------------------------------------------------------

/** The component an `origin` points into (`schema Pet`), for the usages of a component */
const originComponent = (engine: CompareEngineName, origin: Path): string | undefined => {
  const [section, kind, name] = origin
  if (section !== "components" || kind === undefined || name === undefined) {
    return undefined
  }
  const names =
    engine === "asyncapi" ? ASYNCAPI_COMPONENTS : engine === "graphapi" ? GRAPHAPI_COMPONENTS : OPENAPI_COMPONENTS
  return `${names[String(kind)] ?? String(kind)} ${name}`
}

/** The location of one diff (without the usages of a component, see `diffLocations`) */
export const diffLocation = (diff: Diff, context: LocationContext): DiffLocation => {
  const path = diff.path
  if (context.engine === "jsonschema") {
    const text = pointer(path) || "/"
    return { method: "", target: text, part: "", text }
  }
  // a rename is reported at the parent map: locate the renamed key and show both names
  const renamed = diff.action === "rename" && (typeof diff.after === "string" || typeof diff.after === "number")
  const located = renamed ? [...path, diff.after as Segment] : path
  const locate =
    context.engine === "openapi" ? openApiLocation : context.engine === "asyncapi" ? asyncApiLocation : graphApiLocation
  let location = locate(context, located, diff)
  if (renamed && location.target.endsWith(String(diff.after))) {
    const target = `${location.target.slice(0, -String(diff.after).length)}${String(diff.before)} → ${String(diff.after)}`
    location = { ...location, target, text: location.text.replace(location.target, target) }
  }
  const origin = diff.origin && (diff.action === "remove" ? diff.origin.before : diff.origin.after)
  const via = origin ? originComponent(context.engine, origin) : undefined
  if (via && !location.text.includes(via)) {
    location = { ...location, via, text: `${location.text} (via ${via})` }
  }
  return location
}

/**
 * The locations of all diffs of a comparison (same order). A diff inside `components` lists as usages the locations
 * of the diffs the engine reports for the same change at the places that reference the component (their `origin` is
 * the component path).
 */
export const diffLocations = (diffs: readonly Diff[], context: LocationContext): DiffLocation[] => {
  const locations = diffs.map((diff) => diffLocation(diff, context))
  const byOrigin = new Map<string, string[]>()
  diffs.forEach((diff, index) => {
    if (!diff.origin) {
      return
    }
    const base = locations[index].via ? locations[index].text.replace(/ \(via [^)]*\)$/, "") : locations[index].text
    for (const origin of new Set([pointer(diff.origin.before), pointer(diff.origin.after)])) {
      const list = byOrigin.get(origin) ?? []
      if (!list.includes(base)) {
        list.push(base)
      }
      byOrigin.set(origin, list)
    }
  })
  return locations.map((location, index) => {
    const diff = diffs[index]
    if (diff.path[0] !== "components" || diff.origin) {
      return location
    }
    const usages = byOrigin.get(pointer(diff.path))
    return usages?.length
      ? { ...location, usages, text: `${location.text}${SEPARATOR}used in ${usages.join("; ")}` }
      : location
  })
}
