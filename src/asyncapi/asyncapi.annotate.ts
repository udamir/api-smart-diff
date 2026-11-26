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
  componentKindWord,
  createAnnotation,
  createContainerLocator,
  describeDiff,
  describePath,
  extensionChangeAnnotation,
  fallbackAnnotation,
  FREE_TEXT_LENGTH,
  formatValue,
  isFreeTextKey,
  annotationTemplate as t,
  renamedEntry,
  renamedEntryOf,
  ruleView,
} from "../core"
import { jsonSchemaAnnotations, SCHEMA_KIND, schemaContainer } from "../jsonSchema"
import { getKeyValue, isArray, isNumber, isObject, isString } from "../utils"

const asyncApiAnnotations = {
  add: "[Added] {{text}}",
  add_target: "[Added] {{text}} to {{target}}",
  remove: "[Removed] {{text}}",
  remove_target: "[Removed] {{text}} from {{target}}",
  replace: "[Replaced] {{text}}",
  replace_target: "[Replaced] {{text}} of {{target}}",
  rename: "[Renamed] {{text}}",
  rename_target: "[Renamed] {{text}} of {{target}}",

  payloadSchema: "{{schemaChange}} in message payload of channel `{{channel}}`",
  payloadSchema_operation: "{{schemaChange}} in {{operation}} message payload of channel `{{channel}}`",
  headersSchema: "{{schemaChange}} in message headers of channel `{{channel}}`",
  headersSchema_operation: "{{schemaChange}} in {{operation}} message headers of channel `{{channel}}`",
  parameterSchema: "{{schemaChange}} in parameter `{{name}}` of channel `{{channel}}`",
  componentSchema: "{{schemaChange}} in schema component `{{name}}`",
  messageSchema: "{{schemaChange}} in message `{{name}}`",
  parameterComponentSchema: "{{schemaChange}} in parameter component `{{name}}`",
  parameterComponentSchema_renamedFrom:
    "{{schemaChange}} in parameter component `{{name}}` (renamed from `{{renamedFrom}}`)",
  traitHeadersSchema: "{{schemaChange}} in headers of message trait component `{{name}}`",
  traitHeadersSchema_renamedFrom:
    "{{schemaChange}} in headers of message trait component `{{name}}` (renamed from `{{renamedFrom}}`)",
  bindingSchema: "{{schemaChange}} in `{{field}}` of the {{protocol}} binding of {{target}}",
  serverTarget: "server `{{server}}`",
  messageTarget: "message `{{message}}` of channel `{{channel}}`",
  componentSchemaTarget: "component `{{name}}`",
  scope: "scope `{{scope}}`",
  securityScheme: "security scheme `{{name}}`",

  extension: "extension `{{key}}`",
  extensionProperty: "property `{{property}}` of extension `{{key}}`",
  extensionValue: "value {{value}} of extension `{{key}}`",
  channel: "channel `{{channel}}`",
  operation: "operation `{{operation}}`",
  channelOperation: "{{operation}} operation of channel `{{channel}}`",

  // document-level descriptions (ISSUE-114)
  of_container: "{{text}} of {{container}}",
  securityRequirement: "security requirement {{name}}",
  securityRequirements: "security requirements {{names}}",
  anonymousRequirement: "`{}` (anonymous access)",
  inlineScheme: "inline `{{type}}` scheme",
  tag: "tag `{{name}}`",
  tags: "tags {{names}}",
  tagField: "`{{field}}` of tag `{{name}}`",
  // an entry renamed with every reference repointed (ISSUE-78, POLICY-100)
  renamedChannel: "channel `{{before}}` to `{{after}}`",
  renamedMessage: "message `{{before}}` to `{{after}}` in channel `{{channel}}`",
  renamedComponent: "{{kind}} component `{{before}}` to `{{after}}`",
  // a change inside a renamed channel or component names its new and its old key (POLICY-107)
  payloadSchema_channelFrom:
    "{{schemaChange}} in message payload of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  payloadSchema_operation_channelFrom:
    "{{schemaChange}} in {{operation}} message payload of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  headersSchema_channelFrom:
    "{{schemaChange}} in message headers of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  headersSchema_operation_channelFrom:
    "{{schemaChange}} in {{operation}} message headers of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  parameterSchema_channelFrom:
    "{{schemaChange}} in parameter `{{name}}` of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  componentSchema_renamedFrom: "{{schemaChange}} in schema component `{{name}}` (renamed from `{{renamedFrom}}`)",
  messageSchema_renamedFrom: "{{schemaChange}} in message `{{name}}` (renamed from `{{renamedFrom}}`)",
  messageTarget_channelFrom: "message `{{message}}` of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  // a 3.0 channel message renamed with its references: its payload / headers name its new and its old key
  // (POLICY-114), and so does its binding target
  payloadSchema_message_messageFrom:
    "{{schemaChange}} in payload of message `{{message}}` (renamed from `{{messageFrom}}`) in channel `{{channel}}`",
  payloadSchema_message_messageFrom_channelFrom:
    "{{schemaChange}} in payload of message `{{message}}` (renamed from `{{messageFrom}}`) in channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  headersSchema_message_messageFrom:
    "{{schemaChange}} in headers of message `{{message}}` (renamed from `{{messageFrom}}`) in channel `{{channel}}`",
  headersSchema_message_messageFrom_channelFrom:
    "{{schemaChange}} in headers of message `{{message}}` (renamed from `{{messageFrom}}`) in channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  messageTarget_messageFrom: "message `{{message}}` (renamed from `{{messageFrom}}`) of channel `{{channel}}`",
  messageTarget_messageFrom_channelFrom:
    "message `{{message}}` (renamed from `{{messageFrom}}`) of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  channel_channelFrom: "channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  channelOperation_channelFrom: "{{operation}} operation of channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  renamedMessage_channelFrom:
    "message `{{before}}` to `{{after}}` in channel `{{channel}}` (renamed from `{{channelFrom}}`)",
  renamedScheme: "security scheme `{{before}}` to `{{after}}` in a security requirement of {{target}}",
  componentEntry: "`{{map}}` component `{{name}}`",
  componentEntries: "`{{map}}` components {{names}}",
  add_target_value: "[Added] {{text}} {{value}} to {{target}}",
  remove_target_value: "[Removed] {{text}} {{value}} from {{target}}",
  add_value: "[Added] {{text}} {{value}}",
  remove_value: "[Removed] {{text}} {{value}}",
  replace_before_after: "[Replaced] {{text}} from {{before}} to {{after}}",
  replace_target_before_after: "[Replaced] {{text}} of {{target}} from {{before}} to {{after}}",
}

interface AsyncApiLocation {
  channel?: string
  operation?: string
  messageName?: string
  parameterName?: string
  componentName?: string
  server?: string
  bindingProtocol?: string
  bindingField?: string
  channelMessage?: string
  channelMessageNode?: NodeContext
  // a parameter component and a message trait component the node lies in (ISSUE-313)
  parameterNode?: NodeContext
  traitNode?: NodeContext
  schemaRoot?: "payload" | "headers" | "schema" | "component" | "binding"
  // the nodes of the channel, schema component and message component (to name a renamed one, POLICY-107)
  channelNode?: NodeContext
  componentNode?: NodeContext
  messageNode?: NodeContext
  // path length of the schema root node (for the schema-relative fallback)
  schemaRootLength?: number
}

const nodeSide = (ctx: CompareContext): NodeContext => (ctx.after.value !== undefined ? ctx.after : ctx.before)

const operationKeys = new Set(["publish", "subscribe", "send", "receive"])

/**
 * Named containers of an AsyncAPI document for the fallback description (POLICY-08: the nearest container): channels,
 * 2.x channel operations and their message, 3.0 channel messages, operations and their reply, servers, components.
 */
export const locateAsyncApiContainer: ContainerLocator = createContainerLocator([
  { at: ["channels", "*"], name: ([channel]) => `channel \`${channel}\`` },
  {
    at: ["channels", "*", (key) => operationKeys.has(String(key))],
    name: ([channel, operation]) => `${operation} operation of channel \`${channel}\``,
  },
  {
    at: ["channels", "*", (key) => operationKeys.has(String(key)), "message"],
    name: ([channel, operation]) => `message of ${operation} operation of channel \`${channel}\``,
  },
  {
    at: ["channels", "*", "messages", "*"],
    name: ([channel, message]) => `message \`${message}\` of channel \`${channel}\``,
  },
  { at: ["operations", "*"], name: ([operation]) => `operation \`${operation}\`` },
  { at: ["operations", "*", "reply"], name: ([operation]) => `reply of operation \`${operation}\`` },
  { at: ["servers", "*"], name: ([server]) => `server \`${server}\`` },
  { at: ["components", "*", "*"], name: ([kind, name]) => `${componentKindWord(String(kind))} component \`${name}\`` },
  { at: ["info"], name: () => "document info" },
])

export const locateAsyncApiNode = (ctx: CompareContext): AsyncApiLocation => locateFrom(nodeSide(ctx))

// an entry of the `components.<kind>` map of the document
const isComponentEntry = (node: NodeContext, kind: string): boolean =>
  node.up?.key === kind && node.up.up?.key === "components" && node.up.up.up?.up === undefined

// the nodes are recognized by the kind their rule gives them (`CompareRule.kind`), not by key names: a channel,
// message, parameter, component or property named like a field (`payload`, `headers`, `schema`, `items`, …) is never
// read as one (ISSUE-300)
const locateFrom = (start: NodeContext | undefined): AsyncApiLocation => {
  // every field present (possibly undefined): one hidden class instead of one per order in which fields are found,
  // whose stores and reads went through the runtime once per diff (ISSUE-330 / ISSUE-331)
  const location: AsyncApiLocation = {
    channel: undefined,
    operation: undefined,
    messageName: undefined,
    parameterName: undefined,
    componentName: undefined,
    server: undefined,
    bindingProtocol: undefined,
    bindingField: undefined,
    channelMessage: undefined,
    channelMessageNode: undefined,
    parameterNode: undefined,
    traitNode: undefined,
    schemaRoot: undefined,
    channelNode: undefined,
    componentNode: undefined,
    messageNode: undefined,
    schemaRootLength: undefined,
  }
  let node: NodeContext | undefined = start
  while (node) {
    const key: string | number = node.key
    const up: NodeContext | undefined = node.up
    switch (node.kind) {
      case SCHEMA_KIND:
        // the innermost schema root (the `schema` of a 3.0 Multi Format Schema Object lies inside the payload node)
        if (location.schemaRootLength === undefined) {
          location.schemaRootLength = node.path.length
        }
        if ((up?.kind === "message" || up?.kind === "messageTrait") && (key === "payload" || key === "headers")) {
          location.schemaRoot = key
          if (up.kind === "messageTrait" && isComponentEntry(up, "messageTraits")) {
            location.traitNode = up
          }
        } else if (up?.up?.kind === "bindings" && up.up.key === "bindings" && isString(key) && isString(up.key)) {
          // a Schema-Object field of a protocol binding (`bindings.<protocol>.<field>`, POLICY-19)
          location.schemaRoot = "binding"
          location.bindingProtocol = up.key
          location.bindingField = key
        } else if (up?.kind === "parameter") {
          location.schemaRoot = "schema"
          location.parameterName = String(up.key)
          if (isComponentEntry(up, "parameters")) {
            location.parameterNode = up
          }
        } else if (
          up?.key === "schemas" &&
          up.up?.key === "components" &&
          up.up.up?.up === undefined &&
          isString(key)
        ) {
          location.componentName = key
          location.componentNode = node
          location.schemaRoot = "component"
        }
        break
      case "channel":
        if (isString(key)) {
          location.channel = key
          location.channelNode = node
        }
        break
      case "operation":
        if (isString(key)) {
          location.operation = key
        }
        break
      case "message":
        if (up?.key === "messages" && up.up?.kind === "channel" && isString(key)) {
          location.channelMessage = key
          location.channelMessageNode = node
        }
        if (up?.key === "messages" && up.up?.key === "components" && up.up.up?.up === undefined && isString(key)) {
          location.messageName = key
          location.messageNode = node
        }
        break
    }
    if (up?.key === "servers" && up.up?.up === undefined && isString(key)) {
      location.server = key
    }
    node = up
  }
  return location
}

/** AsyncAPI descriptions. */
export const asyncApiAnnotateHook: AnnotateHook = (diff, ctx) => {
  // the fields of the diff read once (diffs come in many hidden classes, ISSUE-330)
  const { action, path, type } = diff
  // most diffs are no document-level change (checks written out: every call costs before V8 optimizes the hook)
  const documentChange =
    action === "rename" || path.length === 2 || path.lastIndexOf("tags") >= 0
      ? describeDocumentChange(diff, ctx)
      : undefined
  if (documentChange) {
    return documentChange
  }
  const annotate = ctx.rules ? ruleView(ctx.rules).annotate : undefined
  if (!annotate) {
    return fallbackAnnotation(diff, ctx, locateAsyncApiContainer)
  }

  const location = locateAsyncApiNode(ctx)
  if (location.schemaRoot) {
    const schemaChange =
      createAnnotation(annotate(diff, ctx), jsonSchemaAnnotations, type) ||
      fallbackAnnotation(diff, ctx, () => schemaContainer(location.schemaRootLength ?? 0))
    const { channel, operation, parameterName, componentName, messageName } = location
    const channelFrom = renamedFrom(ctx, location.channelNode)
    const template =
      location.schemaRoot === "binding"
        ? t("bindingSchema", {
            schemaChange,
            field: location.bindingField,
            protocol: location.bindingProtocol,
            target: bindingTarget(location, ctx),
          })
        : location.schemaRoot === "component"
          ? t("componentSchema", {
              schemaChange,
              name: componentName,
              renamedFrom: renamedFrom(ctx, location.componentNode),
            })
          : location.schemaRoot === "schema"
            ? channel === undefined && location.parameterNode
              ? // a parameter component (ISSUE-313)
                t("parameterComponentSchema", {
                  schemaChange,
                  name: parameterName,
                  renamedFrom: renamedFrom(ctx, location.parameterNode),
                })
              : t("parameterSchema", { schemaChange, name: parameterName, channel, channelFrom })
            : location.traitNode && channel === undefined && messageName === undefined
              ? // the headers of a message trait component (ISSUE-313)
                t("traitHeadersSchema", {
                  schemaChange,
                  name: String(location.traitNode.key),
                  renamedFrom: renamedFrom(ctx, location.traitNode),
                })
              : messageName !== undefined && channel === undefined
                ? t("messageSchema", {
                    schemaChange,
                    name: messageName,
                    renamedFrom: renamedFrom(ctx, location.messageNode),
                  })
                : t(location.schemaRoot === "payload" ? "payloadSchema" : "headersSchema", {
                    schemaChange,
                    operation,
                    channel,
                    channelFrom,
                    ...renamedChannelMessage(ctx, location),
                  })
    return (
      createAnnotation(template, asyncApiAnnotations, type) || fallbackAnnotation(diff, ctx, locateAsyncApiContainer)
    )
  }

  return describeDiff(diff, ctx, asyncApiAnnotations, annotate, locateAsyncApiContainer)
}

// the key a renamed channel or component had before (POLICY-107), for a node of the context chain (not the entry
// itself being added, removed or renamed)
const renamedFrom = (ctx: CompareContext, node: NodeContext | undefined): string | undefined =>
  node && node !== nodeSide(ctx) ? renamedEntryOf(ctx, node)?.from : undefined

// a 3.0 channel message the node lies in, when it was renamed: its new and its old key (POLICY-114)
const renamedChannelMessage = (ctx: CompareContext, location: AsyncApiLocation) => {
  const node = location.channelMessageNode
  // by the channel path (a channel message that references a renamed message component is no renamed entry itself)
  const messageFrom =
    node && node !== nodeSide(ctx)
      ? renamedEntry(ctx, node.root === ctx.after.root ? "after" : "before", node.path)?.from
      : undefined
  return messageFrom !== undefined ? { message: location.channelMessage, messageFrom } : {}
}

// the object a binding belongs to: an operation, a channel message, a channel or a server
const bindingTarget = (location: AsyncApiLocation, ctx: CompareContext) => {
  const { channel, operation, server, channelMessage } = location
  const channelFrom = renamedFrom(ctx, location.channelNode)
  if (operation !== undefined && channel !== undefined) {
    return t("channelOperation", { operation, channel, channelFrom })
  }
  if (operation !== undefined) {
    return t("operation", { operation })
  }
  if (channelMessage !== undefined && channel !== undefined) {
    return t("messageTarget", {
      message: channelMessage,
      channel,
      channelFrom,
      ...renamedChannelMessage(ctx, location),
    })
  }
  if (channel !== undefined) {
    return t("channel", { channel, channelFrom })
  }
  if (server !== undefined) {
    return t("serverTarget", { server })
  }
  return location.componentName !== undefined
    ? t("componentSchemaTarget", { name: location.componentName })
    : "the document"
}

// the node that owns the extension (its parent), found on the context chain of the described node
const extensionOwner = (ctx: CompareContext, extension: number): NodeContext | undefined => {
  let node: NodeContext | undefined = nodeSide(ctx)
  while (node && node.path.length > extension) {
    node = node.up
  }
  return node
}

/** The container of an extension: the operation of a channel, the channel, the operation, else its path. */
const extensionTarget = (diff: Diff, ctx: CompareContext, extension: number) => {
  const path = diff.path.slice(0, extension)
  const location = locateFrom(extensionOwner(ctx, extension))
  const { channel, operation } = location
  const channelFrom = location.channelNode ? renamedEntryOf(ctx, location.channelNode)?.from : undefined
  // the extension of the channel / operation object itself is located by that object; deeper ones by their path
  const depth = path[0] === "channels" || path[0] === "operations" ? 2 : 0
  if (path.length === depth + 1 && operation !== undefined && channel !== undefined) {
    return t("channelOperation", { operation, channel, channelFrom })
  }
  if (path.length === depth && path[0] === "channels" && channel !== undefined) {
    return t("channel", { channel, channelFrom })
  }
  if (path.length === depth && path[0] === "operations" && operation !== undefined) {
    return t("operation", { operation })
  }
  // an object named by its container (a channel message, a 2.x operation message, a component; ISSUE-312: was its path)
  const container = path.length ? locateAsyncApiContainer({ ...diff, path }, ctx) : undefined
  if (container && container.length === path.length) {
    return container.name
  }
  return path.length ? describePath(path) : undefined
}

/** Description of an `x-*` change in an AsyncAPI object (POLICY-06: names the key and its container). */
export const asyncApiExtensionChangeAnnotation = extensionChangeAnnotation(extensionTarget)

/** A scope of a 3.0 security scheme or of a 2.x security requirement: names the scope and the scheme. */
export const securityScopeChangeAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const node = diff.action === "add" ? ctx.after : ctx.before
  const scheme = node.up?.key
  const scope = node.value
  if (!isString(scope) || scheme === undefined) {
    return
  }
  // a 3.0 scheme's `scopes` list sits one level below the scheme
  const name = scheme === "scopes" ? node.up?.up?.key : scheme
  return t(diff.action, { text: t("scope", { scope }), target: t("securityScheme", { name: String(name) }) })
}

// ---------------------------------------------------------------------------------------------------------------
// document-level descriptions (ISSUE-114): security requirements, tags, whole component maps

const backticked = (name: string) => `\`${name}\``

// the container of a node (server, operation, channel operation, document info) with the path inside it: the
// security list of an operation trait is "traits[0] of operation `onEvent`"
const containerOf = (diff: Diff, ctx: CompareContext, length: number) => {
  const node = { ...diff, path: diff.path.slice(0, length) }
  const container = locateAsyncApiContainer(node, ctx)
  if (!container) {
    return length ? describePath(diff.path.slice(0, length)) : undefined
  }
  const inside = diff.path.slice(container.length, length)
  return inside.length ? t("of_container", { text: describePath(inside), container: container.name }) : container.name
}

/** The name of a security requirement (an alternative): its schemes (2.x, AND), its `$ref` or inline scheme (3.0). */
const requirementName = (value: unknown) => {
  if (!isObject(value) || isArray(value)) {
    return
  }
  if (isString(value.$ref)) {
    return backticked(value.$ref.slice(value.$ref.lastIndexOf("/") + 1))
  }
  const keys = Object.keys(value)
  if (!keys.length) {
    return t("anonymousRequirement")
  }
  if (isString(value.type) && !isArray(value.type)) {
    return t("inlineScheme", { type: value.type })
  }
  return keys.map(backticked).join(" and ")
}

/** A security requirement list (`security`) or one of its alternatives added, removed or replaced as a whole. */
export const securityRequirementAnnotation: ChangeAnnotationResolver = (diff, ctx) => {
  const { action, path } = diff
  const index = path.lastIndexOf("security")
  if (index < 0) {
    return
  }
  const target = containerOf(diff, ctx, index)
  // a 2.x requirement whose scheme was renamed with every requirement repointed (ISSUE-78, POLICY-101)
  if (action === "rename") {
    return index === path.length - 2
      ? t(action, { text: t("renamedScheme", { before: diff.before, after: diff.after, target }) })
      : undefined
  }
  if (index === path.length - 1) {
    const list = action === "add" ? diff.after : action === "remove" ? diff.before : undefined
    if (!isArray(list) || !list.length) {
      return
    }
    const names = list.map(requirementName)
    if (names.some((name) => name === undefined)) {
      return
    }
    if (names.length === 1) {
      return t(action, { text: t("securityRequirement", { name: names[0] }), target })
    }
    const rendered = names.map((name) => (isString(name) ? name : createAnnotation(name, asyncApiAnnotations)))
    return t(action, { text: t("securityRequirements", { names: rendered.join(", ") }), target })
  }
  if (index !== path.length - 2 || !isNumber(path[path.length - 1]) || action === "replace") {
    return
  }
  const name = requirementName(action === "add" ? diff.after : diff.before)
  return name ? t(action, { text: t("securityRequirement", { name }), target }) : undefined
}

// `tags` of the document, info, a server, a channel, an operation, a message or a trait (not a schema property)
const tagsIndexOf = (path: readonly unknown[]) => {
  const index = path.lastIndexOf("tags")
  if (index < 0 || (index + 1 < path.length && !isNumber(path[index + 1]))) {
    return -1
  }
  const owner = path[index - 1]
  return owner === "properties" || owner === "payload" || owner === "headers" ? -1 : index
}

const tagName = (value: unknown) =>
  isString(getKeyValue(value, "name")) ? String(getKeyValue(value, "name")) : undefined

const describeTagChange = (diff: Diff, ctx: CompareContext) => {
  const { action, path } = diff
  const index = tagsIndexOf(path)
  if (index < 0 || action === "rename" || locateAsyncApiNode(ctx).schemaRoot) {
    return
  }
  const target = containerOf(diff, ctx, index)
  if (index === path.length - 1) {
    const list = action === "add" ? diff.after : action === "remove" ? diff.before : undefined
    const names = isArray(list) ? list.map(tagName) : []
    if (!names.length || names.some((name) => name === undefined)) {
      return
    }
    // the `tags` list itself: named as the list with its tags
    return t(action, { text: t("tags", { names: names.map((n) => backticked(String(n))).join(", ") }), target })
  }
  const item = path[index + 1]
  const side = action === "add" ? ctx.after : ctx.before
  let node: NodeContext | undefined = side
  while (node && node.path.length > index + 2) {
    node = node.up
  }
  const name = tagName(node?.value)
  if (!isNumber(item) || name === undefined) {
    return
  }
  if (path.length === index + 2) {
    return action === "replace" ? undefined : t(action, { text: t("tag", { name }), target })
  }
  if (path.length !== index + 3) {
    return
  }
  const field = path[index + 2]
  const text = t("tagField", { field: String(field), name })
  const before = ctx.before.value
  const after = ctx.after.value
  const scalar = (value: unknown) => value === null || (value !== undefined && typeof value !== "object")
  // a tag `description` is free text: shortened (POLICY-95)
  const limit = isFreeTextKey(field) ? FREE_TEXT_LENGTH : undefined
  if (action === "replace") {
    return t("replace", {
      text,
      target,
      ...(scalar(before) && scalar(after)
        ? { before: formatValue(before, limit), after: formatValue(after, limit) }
        : {}),
    })
  }
  const value = action === "add" ? after : before
  return t(action, { text, target, value: scalar(value) ? formatValue(value, limit) : undefined })
}

// a whole `components.<kind>` map added or removed: names its entries
const describeComponentMapChange = (diff: Diff) => {
  const { action, path } = diff
  if (path.length !== 2 || path[0] !== "components" || (action !== "add" && action !== "remove")) {
    return
  }
  const value = action === "add" ? diff.after : diff.before
  const names = isObject(value) && !isArray(value) ? Object.keys(value) : []
  if (!names.length) {
    return
  }
  const map = String(path[1])
  return t(
    action,
    names.length === 1
      ? { text: t("componentEntry", { map, name: names[0] }) }
      : { text: t("componentEntries", { map, names: names.map(backticked).join(", ") }) },
  )
}

const describeDocumentChange = (diff: Diff, ctx: CompareContext): string | undefined => {
  const template = describeRename(diff, ctx) ?? describeComponentMapChange(diff) ?? describeTagChange(diff, ctx)
  return template ? createAnnotation(template, asyncApiAnnotations, diff.type) || undefined : undefined
}

// an entry renamed with every reference repointed (ISSUE-78, POLICY-100): one `rename` diff at its map
const describeRename = (diff: Diff, ctx: CompareContext): AnnotateTemplate | undefined => {
  const { action, path } = diff
  if (action !== "rename") {
    return
  }
  const names = { before: diff.before, after: diff.after }
  if (path.length === 1 && path[0] === "channels") {
    return t(action, { text: t("renamedChannel", names) })
  }
  if (path.length === 3 && path[0] === "channels" && path[2] === "messages") {
    // a message renamed in a renamed channel names the channel's new and old key (POLICY-107)
    const channel = renamedEntry(ctx, "before", path.slice(0, 2))
    return t(action, {
      text: t("renamedMessage", { ...names, channel: channel?.name ?? path[1], channelFrom: channel?.from }),
    })
  }
  if (path.length === 2 && path[0] === "components" && isString(path[1])) {
    return t(action, { text: t("renamedComponent", { ...names, kind: componentKindWord(path[1]) }) })
  }
  return
}
