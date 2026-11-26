// AsyncAPI direction: the same API written as AsyncAPI 2.6 and 3.0 must give the same verdicts.
//
// Convention (docs/BENCHMARK.md §3, consumer viewpoint): messages the application consumes (2.x `publish`, 3.0 `receive`, the reply of a 3.0 `send`) are written by clients and take request semantics; messages it produces (2.x `subscribe`, 3.0 `send`, the reply of a 3.0 `receive`) are read by clients and take response semantics. AsyncAPI 2.6 §Channel Item: "subscribe - messages produced by the application", 3.0 §Operation: "send - the application will send a message". Until P2, 2.0.0 mapped 3.0 `send` to request semantics instead (ISSUE-52 (fixed), POLICY-01 decided (a)): the 3.0 variants now get the verdicts of their 2.6 twins, and a 3.0 variant that still fails carries the cause of its twin.
//
// AA-DIR-001..012 re-author the benchmark change set A1-A12 (bench/fixtures/asyncapi.js) minimally, each as a "2.6" and a "3.0" document. AA-DIR-1xx cover the compat-suites placements (operation send / receive / reply-send / reply-receive x message headers / payload) for a representative subset of keywords, plus the 2.6 publish / subscribe placements.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, type ExpectedChange, type ExpectedType, risky, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }

// ---------------------------------------------------------------------------------------------------------------
// the same API as 2.6 and 3.0

interface Channel {
  key: string
  address: string
  dir: "produced" | "consumed"
  message: string
  payload: unknown
  headers?: unknown
  description?: string
}

const v2 = (channels: Channel[]) => ({
  asyncapi: "2.6.0",
  info,
  channels: Object.fromEntries(
    channels.map((c) => [
      c.address,
      {
        ...(c.description ? { description: c.description } : {}),
        [c.dir === "produced" ? "subscribe" : "publish"]: {
          message: { name: c.message, payload: c.payload, ...(c.headers ? { headers: c.headers } : {}) },
        },
      },
    ]),
  ),
})
const v3 = (channels: Channel[]) => ({
  asyncapi: "3.0.0",
  info,
  channels: Object.fromEntries(
    channels.map((c) => [
      c.key,
      {
        address: c.address,
        ...(c.description ? { description: c.description } : {}),
        messages: {
          [c.message]: { name: c.message, payload: c.payload, ...(c.headers ? { headers: c.headers } : {}) },
        },
      },
    ]),
  ),
  operations: Object.fromEntries(
    channels.map((c) => [
      `on${c.message}`,
      {
        action: c.dir === "produced" ? "send" : "receive",
        channel: { $ref: `#/channels/${c.key}` },
        messages: [{ $ref: `#/channels/${c.key}/messages/${c.message}` }],
      },
    ]),
  ),
})
const both = (before: Channel[], after: Channel[]) => ({
  "2.6": [v2(before), v2(after)] as [unknown, unknown],
  "3.0": [v3(before), v3(after)] as [unknown, unknown],
})

const obj = (properties: Record<string, unknown>, required?: string[]) => ({
  type: "object",
  properties,
  ...(required ? { required } : {}),
})
const user = (props: Record<string, unknown> = {}, required = ["userId", "email"]) =>
  obj({ userId: { type: "string" }, email: { type: "string" }, displayName: { type: "string" }, ...props }, required)
const order = (props: Record<string, unknown> = {}, required = ["orderId", "amountCents"]) =>
  obj(
    { orderId: { type: "string" }, amountCents: { type: "integer" }, giftWrap: { type: "boolean" }, ...props },
    required,
  )
const signedUp = (payload: unknown = user(), extra: Partial<Channel> = {}): Channel => ({
  key: "userSignedUp",
  address: "user/signedup",
  dir: "produced",
  message: "UserSignedUp",
  payload,
  ...extra,
})
const orderCreated = (payload: unknown = order(), extra: Partial<Channel> = {}): Channel => ({
  key: "orderCreated",
  address: "order/created",
  dir: "consumed",
  message: "OrderCreated",
  payload,
  ...extra,
})

const SIGNUP = /user\/signedup|userSignedUp/
const ORDER = /order\/created|orderCreated/
// the @asyncapi/diff rows each benchmark change falls under (a change below `payload` / `headers` has no row of its
// own, so @asyncapi/diff reports it unclassified)
const payloadRows = (op: "publish" | "subscribe", part = "payload") => [
  `v2.ts /channels/*/${op}/message/${part}`,
  `v3.ts /channels/*/messages/*/${part}`,
]
const benchRows: Record<string, { rows: string[]; verdict?: string }> = {
  A1: { rows: ["v2.ts /channels/*", "v3.ts /channels/*", "v3.ts /operations/*"] },
  A2: { rows: ["v2.ts /channels/*", "v3.ts /channels/*", "v3.ts /operations/*"] },
  A3: { rows: payloadRows("subscribe"), verdict: "unclassified" },
  A4: { rows: payloadRows("subscribe"), verdict: "unclassified" },
  A5: { rows: payloadRows("subscribe"), verdict: "unclassified" },
  A6: { rows: payloadRows("publish"), verdict: "unclassified" },
  A7: { rows: payloadRows("publish"), verdict: "unclassified" },
  A8: { rows: payloadRows("publish"), verdict: "unclassified" },
  A9: { rows: payloadRows("subscribe"), verdict: "unclassified" },
  A10: { rows: payloadRows("publish"), verdict: "unclassified" },
  A11: { rows: payloadRows("subscribe", "headers"), verdict: "unclassified" },
  A12: { rows: ["v2.ts /channels/*/description", "v3.ts /channels/*/description"] },
}
const bench = (id: string) => [
  { tool: "bench", ref: `aa2-events / aa3-events ${id}` },
  ...benchRows[id].rows.map((row) => ({
    tool: "asyncapi-diff",
    ref: `src/standards/${row}`,
    ...(benchRows[id].verdict ? { verdict: benchRows[id].verdict } : {}),
  })),
]

const benchCases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-DIR-001",
    title: "A1 channel removed",
    before: "channels user/signedup and audit/log (both produced)",
    after: "channel user/signedup",
    rationale: "subscribers of audit/log lose their channel; the same verdict in 2.6 and 3.0",
    annotation: "names the removed channel (and the 3.0 operation)",
    sources: bench("A1"),
    docs: both(
      [
        signedUp(),
        {
          key: "auditLog",
          address: "audit/log",
          dir: "produced",
          message: "AuditLog",
          payload: obj({ actor: { type: "string" } }),
        },
      ],
      [signedUp()],
    ),
    expect: [
      {
        at: ["channels/audit~1log", "channels/auditLog", "operations/onAuditLog"],
        action: "remove",
        type: breaking,
        mentions: [/audit\/log|auditLog/i],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-DIR-002",
    title: "A2 produced channel added",
    before: "channel user/signedup",
    after: "channels user/signedup and bench/added (produced)",
    rationale: "existing clients never use the new channel",
    annotation: "names the added channel (and the 3.0 operation)",
    sources: bench("A2"),
    docs: both(
      [signedUp()],
      [
        signedUp(),
        {
          key: "benchAdded",
          address: "bench/added",
          dir: "produced",
          message: "BenchAdded",
          payload: obj({ benchAddedField: { type: "string" } }),
        },
      ],
    ),
    expect: [
      {
        at: ["channels/bench~1added", "channels/benchAdded", "operations/onBenchAdded"],
        action: "add",
        type: nonBreaking,
        mentions: [/bench\/added|benchAdded/i],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-DIR-003",
    title: "A3 produced payload property type changed",
    before: "UserSignedUp.displayName string",
    after: "UserSignedUp.displayName integer",
    rationale: "a type change breaks consumers and producers alike (ISSUE-39)",
    annotation: "names the property and the channel",
    sources: bench("A3"),
    docs: both([signedUp()], [signedUp(user({ displayName: { type: "integer" } }))]),
    expect: [
      {
        at: "channels/**/payload/properties/displayName/type",
        action: "replace",
        type: breaking,
        mentions: ["displayName", SIGNUP],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-DIR-004",
    title: "A4 produced payload gains an optional property",
    before: "UserSignedUp without nickname",
    after: "UserSignedUp.nickname (optional)",
    rationale: "consumers ignore unknown properties",
    annotation: "names the property and the channel",
    sources: bench("A4"),
    docs: both([signedUp()], [signedUp(user({ nickname: { type: "string" } }))]),
    expect: [
      {
        at: "channels/**/payload/properties/nickname",
        action: "add",
        type: nonBreaking,
        mentions: ["nickname", SIGNUP],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-DIR-005",
    title: "A5 required property removed from a produced payload",
    before: "UserSignedUp.email required",
    after: "UserSignedUp without email",
    rationale:
      "consumers relying on email break (response semantics); POLICY-01: 3.0 send must read like 2.x subscribe",
    annotation: "names the property and the channel",
    sources: [
      ...bench("A5"),
      {
        tool: "fork",
        ref: "test/asyncapi.multiformat-schema.test.ts remove-required-property-send-scope",
        verdict: "non-breaking",
      },
    ],
    docs: both(
      [signedUp()],
      [signedUp(obj({ userId: { type: "string" }, displayName: { type: "string" } }, ["userId"]))],
    ),
    expect: [
      { at: "channels/**/payload/properties/email", action: "remove", type: breaking, mentions: ["email", SIGNUP] },
      { at: "channels/**/payload/required/**", action: "remove", type: breaking, mentions: ["email", SIGNUP] },
    ],
    // ISSUE-52 (fixed)
  },
  {
    kind: "doc",
    id: "AA-DIR-006",
    title: "A6 consumed payload gains a required property",
    before: "OrderCreated without currency",
    after: "OrderCreated.currency required",
    rationale:
      "clients sending orders without currency are rejected (request semantics); POLICY-01: 3.0 receive must read like 2.x publish",
    annotation: "names the property and the channel",
    sources: [
      ...bench("A6"),
      {
        tool: "fork",
        ref: "test/asyncapi.multiformat-schema.test.ts add-required-property-receive-scope",
        verdict: "non-breaking",
      },
    ],
    docs: both(
      [orderCreated()],
      [orderCreated(order({ currency: { type: "string" } }, ["orderId", "amountCents", "currency"]))],
    ),
    expect: [
      { at: "channels/**/payload/properties/currency", action: "add", type: breaking, mentions: ["currency", ORDER] },
      { at: "channels/**/payload/required/**", action: "add", type: breaking, mentions: ["currency", ORDER] },
    ],
    // ISSUE-52 (fixed)
  },
  {
    kind: "doc",
    id: "AA-DIR-007",
    title: "A7 consumed payload gains an optional property",
    before: "OrderCreated without note",
    after: "OrderCreated.note (optional)",
    rationale: "clients need not send it",
    annotation: "names the property and the channel",
    sources: bench("A7"),
    docs: both([orderCreated()], [orderCreated(order({ note: { type: "string" } }))]),
    expect: [
      { at: "channels/**/payload/properties/note", action: "add", type: nonBreaking, mentions: ["note", ORDER] },
    ],
  },
  {
    kind: "doc",
    id: "AA-DIR-008",
    title: "A8 consumed payload property type changed",
    before: "OrderCreated.giftWrap boolean",
    after: "OrderCreated.giftWrap string",
    rationale: "clients sending booleans are rejected",
    annotation: "names the property and the channel",
    sources: bench("A8"),
    docs: both([orderCreated()], [orderCreated(order({ giftWrap: { type: "string" } }))]),
    expect: [
      {
        at: "channels/**/payload/properties/giftWrap/type",
        action: "replace",
        type: breaking,
        mentions: ["giftWrap", ORDER],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-DIR-009",
    title: "A9 produced payload gains a required property",
    before: "UserSignedUp without reason",
    after: "UserSignedUp.reason required",
    rationale: "consumers always receive more; nothing they rely on disappears (response semantics); POLICY-01",
    annotation: "names the property and the channel",
    sources: [
      ...bench("A9"),
      {
        tool: "fork",
        ref: "test/asyncapi.multiformat-schema.test.ts add-required-property-send-scope",
        verdict: "breaking",
      },
      { tool: "openapi-changes", ref: "bench aa3-events A9", verdict: "breaking" },
    ],
    docs: both([signedUp()], [signedUp(user({ reason: { type: "string" } }, ["userId", "email", "reason"]))]),
    expect: [
      { at: "channels/**/payload/properties/reason", action: "add", type: nonBreaking, mentions: ["reason", SIGNUP] },
      { at: "channels/**/payload/required/**", action: "add", type: nonBreaking, mentions: ["reason", SIGNUP] },
    ],
    // ISSUE-52 (fixed)
  },
  {
    kind: "doc",
    id: "AA-DIR-010",
    title: "A10 consumed payload property no longer required",
    before: "OrderCreated.amountCents required",
    after: "OrderCreated.amountCents optional",
    rationale: "clients that send it keep working (request widening); POLICY-01",
    annotation: "names the property and the channel",
    sources: [
      ...bench("A10"),
      {
        tool: "fork",
        ref: "test/asyncapi.multiformat-schema.test.ts remove-required-property-receive-scope",
        verdict: "risky",
      },
      { tool: "openapi-changes", ref: "bench aa3-events A10", verdict: "breaking" },
    ],
    docs: both([orderCreated()], [orderCreated(order({}, ["orderId"]))]),
    expect: [
      { at: "channels/**/payload/required/**", action: "remove", type: nonBreaking, mentions: ["amountCents", ORDER] },
    ],
    // ISSUE-52 (fixed)
  },
  {
    kind: "doc",
    id: "AA-DIR-011",
    title: "A11 produced message header type changed",
    before: "UserSignedUp headers.traceDepth integer",
    after: "UserSignedUp headers.traceDepth string",
    rationale: "a header type change breaks consumers (ISSUE-23 fixed: headers are compared as schemas)",
    annotation: "names the header property and the channel",
    sources: [
      ...bench("A11"),
      { tool: "asd", ref: "test/asyncapi/edge-cases.test.ts headers property type change is breaking" },
    ],
    docs: both(
      [signedUp(user(), { headers: obj({ traceDepth: { type: "integer" } }) })],
      [signedUp(user(), { headers: obj({ traceDepth: { type: "string" } }) })],
    ),
    expect: [
      {
        at: "channels/**/headers/properties/traceDepth/type",
        action: "replace",
        type: breaking,
        mentions: ["traceDepth", SIGNUP],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-DIR-012",
    title: "A12 channel description changed",
    before: "order/created description 'Orders'",
    after: "order/created description 'Orders created by the shop'",
    rationale: "documentation only",
    annotation: "names description and the channel",
    sources: bench("A12"),
    docs: both(
      [orderCreated(order(), { description: "Orders" })],
      [orderCreated(order(), { description: "Orders created by the shop" })],
    ),
    expect: [{ at: "channels/*/description", action: "replace", type: annotation, mentions: ["description", ORDER] }],
  },
]

// ---------------------------------------------------------------------------------------------------------------
// compat-suites placements: message headers / payload in every operation role

const PLACEMENTS = [
  "2.6-pub",
  "2.6-sub",
  "3.0-send",
  "3.0-receive",
  "3.0-reply-of-send",
  "3.0-reply-of-receive",
] as const
type PlacementName = (typeof PLACEMENTS)[number]
// the application consumes: publish, receive, and the reply its send operation waits for
const CONSUMED = new Set<PlacementName>(["2.6-pub", "3.0-receive", "3.0-reply-of-send"])
const CTX = /order\/events|orderEvents|orderReplies/

const host = (p: PlacementName, part: "headers" | "payload", schema: unknown) => {
  const message = part === "headers" ? { headers: schema, payload: { type: "object" } } : { payload: schema }
  if (p === "2.6-pub" || p === "2.6-sub") {
    return {
      asyncapi: "2.6.0",
      info,
      channels: { "order/events": { [p === "2.6-pub" ? "publish" : "subscribe"]: { message } } },
    }
  }
  const reply = p === "3.0-reply-of-send" || p === "3.0-reply-of-receive"
  const action = p === "3.0-send" || p === "3.0-reply-of-send" ? "send" : "receive"
  return {
    asyncapi: "3.0.0",
    info,
    channels: {
      orderEvents: {
        address: "order/events",
        messages: { request: reply ? { payload: { type: "object" } } : message },
      },
      ...(reply ? { orderReplies: { address: "order/replies", messages: { reply: message } } } : {}),
    },
    operations: {
      onOrder: {
        action,
        channel: { $ref: "#/channels/orderEvents" },
        messages: [{ $ref: "#/channels/orderEvents/messages/request" }],
        ...(reply
          ? {
              reply: {
                channel: { $ref: "#/channels/orderReplies" },
                messages: [{ $ref: "#/channels/orderReplies/messages/reply" }],
              },
            }
          : {}),
      },
    },
  }
}

interface MatrixChange {
  rel: string
  action: ExpectedChange["action"]
  consumed: ExpectedType
  produced: ExpectedType
  mentions: (string | RegExp)[]
}

interface MatrixCase {
  id: string
  suite: string
  title: string
  before: string
  after: string
  rationale: string
  part: "headers" | "payload"
  schema: [unknown, unknown]
  changes: MatrixChange[]
  issue?: Partial<Record<PlacementName | "*", string>>
  policy?: Partial<Record<PlacementName, string>>
  options?: string[]
  extraSources?: CompatCase["sources"]
}

const matrix = (m: MatrixCase): CompatCase => {
  // ISSUE-52 (fixed): the 3.0 send / receive variants are no longer tagged by default
  const issue: Partial<Record<string, string>> = { ...m.issue }
  for (const p of Object.keys(m.policy ?? {})) delete issue[p]
  const expect: Partial<Record<string, ExpectedChange[]>> = {}
  const docs: Record<string, [unknown, unknown]> = {}
  for (const p of PLACEMENTS) {
    docs[p] = [host(p, m.part, m.schema[0]), host(p, m.part, m.schema[1])]
    const op = p === "2.6-pub" ? ["publish"] : p === "2.6-sub" ? ["subscribe"] : []
    expect[p] = m.changes.map((c) => ({
      at: [`channels/*/*/message/${m.part}/${c.rel}`, `channels/*/messages/*/${m.part}/${c.rel}`],
      action: c.action,
      type: CONSUMED.has(p) ? c.consumed : c.produced,
      mentions: [...c.mentions, CTX, ...op],
    }))
  }
  return {
    kind: "doc",
    id: m.id,
    title: m.title,
    before: m.before,
    after: m.after,
    rationale: m.rationale,
    annotation: `names the ${m.part === "headers" ? "header" : "payload"} property and the channel (2.6: and publish / subscribe)`,
    sources: [
      {
        tool: "compat-suites",
        ref: `asyncapi/operation-{send,receive,reply-send,reply-receive}-message-${m.part} ${m.suite}`,
      },
      {
        tool: "fork",
        ref: `test/compatibility-suites/asyncapi/*-message-${m.part}-schema.test.ts ${m.suite} (send = request semantics)`,
      },
      ...(m.extraSources ?? []),
    ],
    docs,
    expect,
    ...(Object.keys(issue).length ? { issue } : {}),
    ...(m.policy ? { policy: m.policy, options: m.options } : {}),
  }
}

const headers = (header1: Record<string, unknown>, extra: Record<string, unknown> = {}, required?: string[]) =>
  obj({ header1, ...extra }, required)

const matrixCases: CompatCase[] = [
  matrix({
    id: "AA-DIR-101",
    suite: "add-schema-title",
    title: "header schema title added",
    before: "header1 { type: string }",
    after: "header1 { type: string, title }",
    rationale: "documentation only, in every role",
    part: "headers",
    schema: [headers({ type: "string" }), headers({ type: "string", title: "Header one" })],
    changes: [
      {
        rel: "properties/header1/title",
        action: "add",
        consumed: annotation,
        produced: annotation,
        mentions: ["header1"],
      },
    ],
  }),
  matrix({
    id: "AA-DIR-102",
    suite: "update-schema-type",
    title: "header type changed",
    before: "header1 string",
    after: "header1 integer",
    rationale: "a type change breaks writers and readers alike",
    part: "headers",
    schema: [headers({ type: "string" }), headers({ type: "integer" })],
    changes: [
      {
        rel: "properties/header1/type",
        action: "replace",
        consumed: breaking,
        produced: breaking,
        mentions: ["header1"],
      },
    ],
  }),
  matrix({
    id: "AA-DIR-103",
    suite: "add-enum",
    title: "header enum introduced",
    before: "header1 string",
    after: "header1 string enum [a, b]",
    rationale:
      "introducing an enum narrows the header: breaking for a consumed message (clients write it), non-breaking for a produced one; 2.0.0 reports it as enum values added (widening)",
    part: "headers",
    schema: [headers({ type: "string" }), headers({ type: "string", enum: ["alpha", "beta"] })],
    changes: [
      {
        rel: "properties/header1/enum/**",
        action: "add",
        consumed: breaking,
        produced: nonBreaking,
        mentions: ["header1"],
      },
    ],
    // ISSUE-87 (fixed)
  }),
  matrix({
    id: "AA-DIR-104",
    suite: "add-enum-value",
    title: "header enum value added",
    before: "header1 enum [alpha]",
    after: "header1 enum [alpha, beta]",
    rationale:
      "widening: non-breaking for a consumed message; for a produced one readers may get an unknown value (POLICY-05: risky)",
    part: "headers",
    schema: [headers({ type: "string", enum: ["alpha"] }), headers({ type: "string", enum: ["alpha", "beta"] })],
    changes: [
      {
        rel: "properties/header1/enum/**",
        action: "add",
        consumed: nonBreaking,
        produced: risky,
        mentions: ["header1", "beta"],
      },
    ],
    // POLICY-05 decided (b): risky on the produced side (ISSUE-130 fixed; ISSUE-52 fixed); the description is ISSUE-57
    // ISSUE-57 (fixed) (P8a)
  }),
  matrix({
    id: "AA-DIR-105",
    suite: "remove-enum-value",
    title: "header enum value removed",
    before: "header1 enum [alpha, beta]",
    after: "header1 enum [alpha]",
    rationale: "narrowing: breaking for a consumed message, non-breaking for a produced one",
    part: "headers",
    schema: [headers({ type: "string", enum: ["alpha", "beta"] }), headers({ type: "string", enum: ["alpha"] })],
    changes: [
      {
        rel: "properties/header1/enum/**",
        action: "remove",
        consumed: breaking,
        produced: nonBreaking,
        mentions: ["header1", "beta"],
      },
    ],
    // ISSUE-52 (fixed); the description is ISSUE-57
    // ISSUE-57 (fixed) (P8a)
  }),
  matrix({
    id: "AA-DIR-106",
    suite: "decrease-max-length-for-string-property",
    title: "header maxLength decreased",
    before: "header1 maxLength 64",
    after: "header1 maxLength 16",
    rationale: "narrowing: breaking for a consumed message, non-breaking for a produced one",
    part: "headers",
    schema: [headers({ type: "string", maxLength: 64 }), headers({ type: "string", maxLength: 16 })],
    changes: [
      {
        rel: "properties/header1/maxLength",
        action: "replace",
        consumed: breaking,
        produced: nonBreaking,
        mentions: ["header1", "maxLength"],
      },
    ],
  }),
  matrix({
    id: "AA-DIR-107",
    suite: "increase-max-length-for-string-property",
    title: "header maxLength increased",
    before: "header1 maxLength 16",
    after: "header1 maxLength 64",
    rationale: "widening: non-breaking for a consumed message, breaking for a produced one",
    part: "headers",
    schema: [headers({ type: "string", maxLength: 16 }), headers({ type: "string", maxLength: 64 })],
    changes: [
      {
        rel: "properties/header1/maxLength",
        action: "replace",
        consumed: nonBreaking,
        produced: breaking,
        mentions: ["header1", "maxLength"],
      },
    ],
  }),
  matrix({
    id: "AA-DIR-108",
    suite: "add-min-length-for-string-property",
    title: "header minLength added",
    before: "header1 string",
    after: "header1 string minLength 8",
    rationale: "narrowing: breaking for a consumed message, non-breaking for a produced one",
    part: "headers",
    schema: [headers({ type: "string" }), headers({ type: "string", minLength: 8 })],
    changes: [
      {
        rel: "properties/header1/minLength",
        action: "add",
        consumed: breaking,
        produced: nonBreaking,
        mentions: ["header1", "minLength"],
      },
    ],
  }),
  matrix({
    id: "AA-DIR-109",
    suite: "decrease-minimum-for-number-property",
    title: "header minimum decreased",
    before: "header1 integer minimum 10",
    after: "header1 integer minimum 0",
    rationale:
      "widening: non-breaking for a consumed message; for a produced one readers validating the old range can fail (POLICY-05: risky)",
    part: "headers",
    schema: [headers({ type: "integer", minimum: 10 }), headers({ type: "integer", minimum: 0 })],
    // POLICY-05 decided (b), decision §11.14: a loosened bound on the produced side is risky (was breaking)
    changes: [
      {
        rel: "properties/header1/minimum",
        action: "replace",
        consumed: nonBreaking,
        produced: risky,
        mentions: ["header1", "minimum"],
      },
    ],
  }),
  matrix({
    id: "AA-DIR-110",
    suite: "add-required-property",
    title: "header made required",
    before: "headers { header1 } without required",
    after: "headers required [header1]",
    rationale:
      "breaking for a consumed message (clients must now send it), non-breaking for a produced one (readers always get it)",
    part: "headers",
    schema: [headers({ type: "string" }), headers({ type: "string" }, {}, ["header1"])],
    changes: [{ rel: "required/**", action: "add", consumed: breaking, produced: nonBreaking, mentions: ["header1"] }],
    extraSources: [
      {
        tool: "fork",
        ref: "test/asyncapi.multiformat-schema.test.ts reply-of-send / reply-of-receive scope inversion",
      },
    ],
  }),
  matrix({
    id: "AA-DIR-111",
    suite: "remove-required-property",
    title: "header no longer required",
    before: "headers required [header1]",
    after: "headers without required",
    rationale:
      "non-breaking for a consumed message; for a produced one readers relying on it can fail (POLICY-05: required -> optional is risky)",
    part: "headers",
    schema: [headers({ type: "string" }, {}, ["header1"]), headers({ type: "string" })],
    // POLICY-05 decided (b), decision §11.14: required -> optional on the produced side is risky (was breaking)
    changes: [{ rel: "required/**", action: "remove", consumed: nonBreaking, produced: risky, mentions: ["header1"] }],
  }),
  matrix({
    id: "AA-DIR-112",
    suite: "add-property (header added)",
    title: "optional header added",
    before: "headers { header1 }",
    after: "headers { header1, header2 }",
    rationale: "an optional header is non-breaking in every role",
    part: "headers",
    schema: [headers({ type: "string" }), headers({ type: "string" }, { header2: { type: "string" } })],
    changes: [
      { rel: "properties/header2", action: "add", consumed: nonBreaking, produced: nonBreaking, mentions: ["header2"] },
    ],
  }),
  matrix({
    id: "AA-DIR-113",
    suite: "remove-property (required header removed)",
    title: "required header removed",
    before: "headers { header1, header2 } required [header1, header2]",
    after: "headers { header1 } required [header1]",
    rationale:
      "a consumed message: senders still sending header2 may have it silently dropped (POLICY-03: risky; its required status alone is non-breaking); breaking for a produced one (readers relying on header2)",
    part: "headers",
    schema: [
      headers({ type: "string" }, { header2: { type: "string" } }, ["header1", "header2"]),
      headers({ type: "string" }, {}, ["header1"]),
    ],
    changes: [
      // POLICY-03 decided (c), decision §11.14: removing a property of a consumed message is risky (was non-breaking)
      { rel: "properties/header2", action: "remove", consumed: risky, produced: breaking, mentions: ["header2"] },
      { rel: "required/**", action: "remove", consumed: nonBreaking, produced: breaking, mentions: ["header2"] },
    ],
  }),
  matrix({
    id: "AA-DIR-120",
    suite: "add-required-property",
    title: "payload property made required",
    before: "payload { a }",
    after: "payload { a } required [a]",
    rationale:
      "breaking for a consumed message, non-breaking for a produced one; the reply placements are not covered by the coordinator's payload runs",
    part: "payload",
    schema: [obj({ a: { type: "string" } }), obj({ a: { type: "string" } }, ["a"])],
    changes: [{ rel: "required/**", action: "add", consumed: breaking, produced: nonBreaking, mentions: ["`a`"] }],
    extraSources: [
      {
        tool: "fork",
        ref: "test/asyncapi.multiformat-schema.test.ts add-required-property-send-scope / receive-scope / reply scope inversion",
      },
    ],
  }),
  matrix({
    id: "AA-DIR-121",
    suite: "update-schema-type",
    title: "payload property type changed",
    before: "payload.a string",
    after: "payload.a integer",
    rationale: "a type change breaks every role",
    part: "payload",
    schema: [obj({ a: { type: "string" } }), obj({ a: { type: "integer" } })],
    changes: [
      { rel: "properties/a/type", action: "replace", consumed: breaking, produced: breaking, mentions: ["`a`"] },
    ],
  }),
  matrix({
    id: "AA-DIR-122",
    suite: "add-enum",
    title: "payload property enum introduced",
    before: "payload.a string",
    after: "payload.a enum [alpha, beta]",
    rationale:
      "introducing an enum narrows the property: breaking for a consumed message, non-breaking for a produced one; 2.0.0 reports it as enum values added (widening)",
    part: "payload",
    schema: [obj({ a: { type: "string" } }), obj({ a: { type: "string", enum: ["alpha", "beta"] } })],
    changes: [
      { rel: "properties/a/enum/**", action: "add", consumed: breaking, produced: nonBreaking, mentions: ["`a`"] },
    ],
    // ISSUE-87 (fixed)
  }),
  matrix({
    id: "AA-DIR-123",
    suite: "increase-maximum-for-number-property",
    title: "payload property maximum increased",
    before: "payload.a integer maximum 10",
    after: "payload.a integer maximum 100",
    rationale:
      "widening: non-breaking for a consumed message; for a produced one readers validating the old range can fail (POLICY-05: risky)",
    part: "payload",
    schema: [obj({ a: { type: "integer", maximum: 10 } }), obj({ a: { type: "integer", maximum: 100 } })],
    // POLICY-05 decided (b), decision §11.14: a loosened bound on the produced side is risky (was breaking)
    changes: [
      {
        rel: "properties/a/maximum",
        action: "replace",
        consumed: nonBreaking,
        produced: risky,
        mentions: ["`a`", "maximum"],
      },
    ],
  }),
]

runCases("asyncapi", "direction", [...benchCases, ...matrixCases], import.meta.filename)
