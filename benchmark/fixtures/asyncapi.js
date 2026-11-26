"use strict"
// AsyncAPI fixtures: one event-driven API written twice, as AsyncAPI 2.6 and as AsyncAPI 3.0, with the same scripted
// change set, plus wide synthetic documents (500 and 2 000 channels) per version and identical-document pairs.
//
// Direction semantics used for the expected classification (consumer viewpoint, the same as OpenAPI):
//   - messages the documented application PRODUCES (2.x `subscribe`, 3.0 `action: send`) are read by the API's
//     consumers -> response semantics (removing a property or changing its type breaks them; adding a required
//     property does not)
//   - messages the application CONSUMES (2.x `publish`, 3.0 `action: receive`) are written by the consumers ->
//     request semantics (adding a required property or narrowing a type breaks them)
// AsyncAPI 2.6 §Channel Item Object: "subscribe - messages produced by the application and sent to the channel",
// "publish - messages consumed by the application from the channel"; AsyncAPI 3.0 §Operation Object: "send - the
// application will send a message to the given channel". So 2.x subscribe == 3.0 send.
const clone = (v) => structuredClone(v)

const user = () => ({
  type: "object",
  required: ["userId", "email"],
  properties: {
    userId: { type: "string", format: "uuid" },
    email: { type: "string", format: "email" },
    displayName: { type: "string" },
    signupSource: { type: "string", enum: ["web", "ios", "android"] },
    referralCode: { type: "string" },
  },
})
const order = () => ({
  type: "object",
  required: ["orderId", "amountCents"],
  properties: {
    orderId: { type: "string" },
    amountCents: { type: "integer", minimum: 0 },
    couponCode: { type: "string" },
    giftWrap: { type: "boolean" },
  },
})
const headers = () => ({ type: "object", properties: { correlationId: { type: "string" }, traceDepth: { type: "integer" } } })

// produced = app sends (2.x subscribe / 3.0 send); consumed = app receives (2.x publish / 3.0 receive)
const CHANNELS = [
  { key: "userSignedUp", address: "user/signedup", dir: "produced", message: "UserSignedUp", schema: "User" },
  { key: "userDeleted", address: "user/deleted", dir: "produced", message: "UserDeleted", schema: null },
  { key: "orderCreated", address: "order/created", dir: "consumed", message: "OrderCreated", schema: "Order" },
  { key: "orderCancelled", address: "order/cancelled", dir: "consumed", message: "OrderCancelled", schema: null },
  { key: "auditLog", address: "audit/log", dir: "produced", message: "AuditLog", schema: null },
]
const inlinePayload = (m) =>
  m === "UserDeleted"
    ? { type: "object", properties: { userId: { type: "string" }, deletedAt: { type: "string", format: "date-time" } } }
    : m === "OrderCancelled"
      ? { type: "object", required: ["orderId"], properties: { orderId: { type: "string" }, cancelReason: { type: "string" } } }
      : { type: "object", properties: { actor: { type: "string" }, action: { type: "string" } } }

const v2doc = () => {
  const channels = {}
  for (const c of CHANNELS) {
    channels[c.address] = {
      description: `Channel ${c.address}`,
      [c.dir === "produced" ? "subscribe" : "publish"]: { operationId: `on${c.message}`, message: { $ref: `#/components/messages/${c.message}` } },
    }
  }
  const messages = {}
  for (const c of CHANNELS) {
    messages[c.message] = {
      name: c.message,
      contentType: "application/json",
      headers: headers(),
      payload: c.schema ? { $ref: `#/components/schemas/${c.schema}` } : inlinePayload(c.message),
    }
  }
  return {
    asyncapi: "2.6.0",
    info: { title: "Bench events", version: "1.0.0" },
    servers: { prod: { url: "broker.example.com:9092", protocol: "kafka" } },
    channels,
    components: { messages, schemas: { User: user(), Order: order() } },
  }
}

const v3doc = () => {
  const channels = {}
  const operations = {}
  for (const c of CHANNELS) {
    channels[c.key] = { address: c.address, description: `Channel ${c.address}`, messages: { [c.message]: { $ref: `#/components/messages/${c.message}` } } }
    operations[`on${c.message}`] = {
      action: c.dir === "produced" ? "send" : "receive",
      channel: { $ref: `#/channels/${c.key}` },
      messages: [{ $ref: `#/channels/${c.key}/messages/${c.message}` }],
    }
  }
  const messages = {}
  for (const c of CHANNELS) {
    messages[c.message] = {
      name: c.message,
      contentType: "application/json",
      headers: headers(),
      payload: c.schema ? { $ref: `#/components/schemas/${c.schema}` } : inlinePayload(c.message),
    }
  }
  return {
    asyncapi: "3.0.0",
    info: { title: "Bench events", version: "1.0.0" },
    servers: { prod: { host: "broker.example.com:9092", protocol: "kafka" } },
    channels,
    operations,
    components: { messages, schemas: { User: user(), Order: order() } },
  }
}

// the change set, applied through accessors so that the same edits land in both versions
const applyChanges = (d, v) => {
  const S = d.components.schemas
  const M = d.components.messages
  // A1 remove the auditLog channel (and its operation in 3.0)
  if (v === 2) delete d.channels["audit/log"]
  else {
    delete d.channels.auditLog
    delete d.operations.onAuditLog
  }
  delete M.AuditLog
  // A2 add a produced channel
  const newMsg = { name: "BenchAdded", contentType: "application/json", payload: { type: "object", properties: { benchAddedField: { type: "string" } } } }
  M.BenchAdded = newMsg
  if (v === 2) d.channels["bench/added"] = { subscribe: { operationId: "onBenchAdded", message: { $ref: "#/components/messages/BenchAdded" } } }
  else {
    d.channels.benchAdded = { address: "bench/added", messages: { BenchAdded: { $ref: "#/components/messages/BenchAdded" } } }
    d.operations.onBenchAdded = { action: "send", channel: { $ref: "#/channels/benchAdded" }, messages: [{ $ref: "#/channels/benchAdded/messages/BenchAdded" }] }
  }
  // A3 produced payload property type change (User.displayName string -> integer)
  S.User.properties.displayName = { type: "integer" }
  // A4 produced payload gains an optional property
  S.User.properties.benchNickname = { type: "string" }
  // A5 produced payload: required property removed
  delete S.User.properties.email
  S.User.required = S.User.required.filter((k) => k !== "email")
  // A6 consumed payload gains a required property
  S.Order.properties.benchCurrency = { type: "string" }
  S.Order.required = [...S.Order.required, "benchCurrency"]
  // A7 consumed payload gains an optional property
  S.Order.properties.benchNote = { type: "string" }
  // A8 consumed payload property type change (Order.giftWrap boolean -> string)
  S.Order.properties.giftWrap = { type: "string" }
  // A9 produced payload gains a required property (UserDeleted)
  const ud = M.UserDeleted.payload
  ud.properties.benchReason = { type: "string" }
  ud.required = ["benchReason"]
  // A10 consumed payload: required property becomes optional (OrderCancelled.orderId)
  M.OrderCancelled.payload.required = []
  // A11 message header property type change (UserSignedUp.headers.traceDepth integer -> string)
  M.UserSignedUp.headers.properties.traceDepth = { type: "string" }
  // A12 channel description change
  if (v === 2) d.channels["order/created"].description = "Orders created by the shop (bench)"
  else d.channels.orderCreated.description = "Orders created by the shop (bench)"
  return d
}

const expected = () => [
  { id: "A1", what: "channel audit/log removed", class: "breaking", tokens: [["audit/log", "auditlog"]] },
  { id: "A2", what: "produced channel bench/added added", class: "non-breaking", tokens: [["bench/added", "benchadded"]] },
  { id: "A3", what: "produced payload User.displayName string -> integer", class: "breaking", tokens: ["displayname"] },
  { id: "A4", what: "produced payload gains optional property benchNickname", class: "non-breaking", tokens: ["benchnickname"] },
  { id: "A5", what: "produced payload required property email removed", class: "breaking", tokens: ["email"], direction: true },
  { id: "A6", what: "consumed payload gains required property benchCurrency", class: "breaking", tokens: ["benchcurrency"] },
  { id: "A7", what: "consumed payload gains optional property benchNote", class: "non-breaking", tokens: ["benchnote"] },
  { id: "A8", what: "consumed payload Order.giftWrap boolean -> string", class: "breaking", tokens: ["giftwrap"] },
  { id: "A9", what: "produced payload (UserDeleted) gains required property benchReason", class: "non-breaking", tokens: ["benchreason"], direction: true },
  { id: "A10", what: "consumed payload (OrderCancelled) orderId no longer required", class: "non-breaking", tokens: [["ordercancelled", "order/cancelled"], "required"], direction: true },
  { id: "A11", what: "message header traceDepth integer -> string", class: "breaking", tokens: ["tracedepth"] },
  { id: "A12", what: "channel order/created description changed", class: "annotation", tokens: [["order/created", "ordercreated"], "description"] },
]

// wide synthetic documents: n produced channels with inline payloads, every 20th payload gains a type change
const wide = (version, n, changed) => {
  const payload = (i) => ({ type: "object", properties: { id: { type: "string" }, [`f${i}`]: { type: changed && i % 20 === 0 ? "integer" : "string" }, note: { type: "string" } } })
  if (version === 2) {
    const channels = {}
    for (let i = 0; i < n; i++) channels[`ch/${i}`] = { subscribe: { operationId: `op${i}`, message: { name: `M${i}`, payload: payload(i) } } }
    return { asyncapi: "2.6.0", info: { title: "wide", version: "1.0.0" }, channels }
  }
  const channels = {}
  const operations = {}
  for (let i = 0; i < n; i++) {
    channels[`ch${i}`] = { address: `ch/${i}`, messages: { [`M${i}`]: { name: `M${i}`, payload: payload(i) } } }
    operations[`op${i}`] = { action: "send", channel: { $ref: `#/channels/ch${i}` }, messages: [{ $ref: `#/channels/ch${i}/messages/M${i}` }] }
  }
  return { asyncapi: "3.0.0", info: { title: "wide", version: "1.0.0" }, channels, operations }
}

const fixtures = [
  { name: "aa2-events", family: "asyncapi", spec: "aa2", kind: "changeset", desc: "AsyncAPI 2.6 event API (5 channels, $ref messages/schemas), 12 scripted changes", generate: () => ({ before: v2doc(), after: applyChanges(v2doc(), 2), expected: expected() }) },
  { name: "aa3-events", family: "asyncapi", spec: "aa3", kind: "changeset", desc: "the same API as AsyncAPI 3.0 (channels + operations), the same 12 changes", generate: () => ({ before: v3doc(), after: applyChanges(v3doc(), 3), expected: expected() }) },
  { name: "aa2-identical", family: "asyncapi", spec: "aa2", kind: "identical", desc: "aa2-events before document compared with itself", generate: () => ({ before: v2doc(), after: v2doc() }) },
  { name: "aa3-identical", family: "asyncapi", spec: "aa3", kind: "identical", desc: "aa3-events before document compared with itself", generate: () => ({ before: v3doc(), after: v3doc() }) },
  { name: "aa2-wide-500", family: "asyncapi", spec: "aa2", kind: "synthetic", desc: "AsyncAPI 2.6, 500 channels with inline payloads, 25 payload type changes", generate: () => ({ before: wide(2, 500, false), after: wide(2, 500, true) }) },
  { name: "aa3-wide-500", family: "asyncapi", spec: "aa3", kind: "synthetic", desc: "AsyncAPI 3.0, 500 channels + 500 send operations, 25 payload type changes", generate: () => ({ before: wide(3, 500, false), after: wide(3, 500, true) }) },
  // larger scaling step (linear scaling on the wide fixtures), 4× the input
  { name: "aa2-wide-2000", family: "asyncapi", spec: "aa2", kind: "synthetic", desc: "AsyncAPI 2.6, 2 000 channels with inline payloads, 100 payload type changes", generate: () => ({ before: wide(2, 2000, false), after: wide(2, 2000, true) }) },
  { name: "aa3-wide-2000", family: "asyncapi", spec: "aa3", kind: "synthetic", desc: "AsyncAPI 3.0, 2 000 channels + 2 000 send operations, 100 payload type changes", generate: () => ({ before: wide(3, 2000, false), after: wide(3, 2000, true) }) },
]

module.exports = { fixtures, clone }
