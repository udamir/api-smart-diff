// @asyncapi/diff standard classification (`src/standards/v2.ts`, `v3.ts`): one case per row of its JSON-pointer table that no other AsyncAPI case represents (test/compat/coverage/asyncapi-diff-standard.json). The rows of the 2.x table repeat for the `publish` and `subscribe` operation; a case runs both where the row exists for both. Each source cites the row pattern exactly; `verdict` records the row's class where it differs from ASD's expectation (the standard has no annotation class: its non-breaking for documentation fields is ASD's annotation).
//
// Viewpoint: POLICY-01 (consumer: 2.x publish / 3.0 receive = request semantics), POLICY-09 (every server change is an annotation; server security is classified like operation security), POLICY-19 (non-Schema binding fields unclassified with a description).

import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, type ExpectedChange, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const payload = { type: "object", properties: { userId: { type: "string" } } }
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties })

type Obj = Record<string, unknown>
const doc2 = (extra: Obj = {}, channels: unknown = {}) => ({ asyncapi: "2.6.0", info, channels, ...extra })
const doc3 = (extra: Obj = {}, channels?: unknown, operations?: unknown) => ({
  asyncapi: "3.0.0",
  info,
  ...(channels === undefined ? {} : { channels }),
  ...(operations === undefined ? {} : { operations }),
  ...extra,
})

// one operation on channel user/events (2.6) / userEvents + onEvent (3.0), with its operation and message fields
type Kind = "publish" | "subscribe"
const op2 = (kind: Kind, op: Obj = {}, message: Obj = {}, extra: Obj = {}) =>
  doc2(extra, { "user/events": { [kind]: { message: { payload, ...message }, ...op } } })
const op3 = (action: "send" | "receive", op: Obj = {}, message: Obj = {}, extra: Obj = {}) =>
  doc3(
    extra,
    { userEvents: { address: "user/events", messages: { event: { payload, ...message } } } },
    {
      onEvent: {
        action,
        channel: { $ref: "#/channels/userEvents" },
        messages: [{ $ref: "#/channels/userEvents/messages/event" }],
        ...op,
      },
    },
  )
type Pair = [unknown, unknown]
const pair = <T extends unknown[]>(f: (...args: T) => unknown, before: T, after: T): Pair => [f(...before), f(...after)]

// variants: operation-level fields (2.6 publish, 2.6 subscribe, 3.0) and message-level fields (consumed / produced)
const opVariants = (before: Obj, after: Obj) => ({
  "2.6-pub": pair(op2, ["publish", before], ["publish", after]),
  "2.6-sub": pair(op2, ["subscribe", before], ["subscribe", after]),
  "3.0": pair(op3, ["send", before], ["send", after]),
})
const msgVariants = (before: Obj, after: Obj, v3 = true) => ({
  "2.6-pub": pair(op2, ["publish", {}, before], ["publish", {}, after]),
  "2.6-sub": pair(op2, ["subscribe", {}, before], ["subscribe", {}, after]),
  ...(v3
    ? {
        "3.0-send": pair(op3, ["send", {}, before], ["send", {}, after]),
        "3.0-receive": pair(op3, ["receive", {}, before], ["receive", {}, after]),
      }
    : {}),
})

const opAt = (field: string) => [`channels/user~1events/*/${field}`, `operations/onEvent/${field}`]
const msgAt = (field: string) => [
  `channels/user~1events/*/message/${field}`,
  `channels/userEvents/messages/event/${field}`,
]
const OP = /publish|subscribe|onEvent/
const CH = /user\/events|userEvents/

const aad = (row: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${row}`,
  ...(verdict ? { verdict } : {}),
})
// the same 2.x row under publish and subscribe
const pubSub = (row: string, verdict?: string) => [
  aad(`v2.ts /channels/*/publish/${row}`, verdict),
  aad(`v2.ts /channels/*/subscribe/${row}`, verdict),
]

const server2 = { url: "broker.example.com:9092", protocol: "kafka" }
const server3 = { host: "broker.example.com:9092", protocol: "kafka" }
const secSchemes = {
  securitySchemes: { user: { type: "userPassword" }, cert: { type: "X509" } },
}
const ref3 = (name: string) => ({ $ref: `#/components/securitySchemes/${name}` })

// the 2.x message trait has no description row in the standard; 3.0 has one
const traitDocs: ExpectedChange[] = [
  { at: msgAt("traits/0/name"), action: "replace", type: nonBreaking, mentions: ["name", CH] },
  { at: msgAt("traits/0/title"), action: "replace", type: annotation, mentions: ["title", CH] },
  { at: msgAt("traits/0/summary"), action: "replace", type: annotation, mentions: ["summary", CH] },
]

const cases: CompatCase[] = [
  // ---- info
  {
    kind: "doc",
    id: "AA-AAD-001",
    area: "document",
    title: "info.license added",
    before: "info without license",
    after: "info.license { name: MIT }",
    rationale: "licensing metadata; no message or channel changes",
    annotation: "names the license",
    sources: [aad("v2.ts /info/license"), aad("v3.ts /info/license")],
    docs: {
      "2.6": [doc2(), doc2({ info: { ...info, license: { name: "MIT" } } })],
      "3.0": [doc3(), doc3({ info: { ...info, license: { name: "MIT" } } })],
    },
    expect: [{ at: ["info/license", "info/license/**"], action: "add", type: annotation, mentions: ["license"] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-002",
    area: "document",
    title: "info.license removed",
    before: "info.license { name: MIT }",
    after: "info without license",
    rationale: "licensing metadata; no client depends on it on the wire",
    annotation: "names the license",
    sources: [aad("v2.ts /info/license", "breaking"), aad("v3.ts /info/license", "breaking")],
    docs: {
      "2.6": [doc2({ info: { ...info, license: { name: "MIT" } } }), doc2()],
      "3.0": [doc3({ info: { ...info, license: { name: "MIT" } } }), doc3()],
    },
    expect: [{ at: ["info/license", "info/license/**"], action: "remove", type: annotation, mentions: ["license"] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-003",
    area: "document",
    title: "info.contact added",
    before: "info without contact",
    after: "info.contact { name, url, email }",
    rationale: "contact data is documentation only",
    annotation: "names the contact",
    sources: [aad("v2.ts /info/contact"), aad("v3.ts /info/contact")],
    docs: {
      "2.6": [
        doc2(),
        doc2({ info: { ...info, contact: { name: "Team", url: "https://a.example.com", email: "a@example.com" } } }),
      ],
      "3.0": [
        doc3(),
        doc3({ info: { ...info, contact: { name: "Team", url: "https://a.example.com", email: "a@example.com" } } }),
      ],
    },
    expect: [{ at: ["info/contact", "info/contact/**"], action: "add", type: annotation, mentions: ["contact"] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-004",
    area: "document",
    title: "info.contact removed",
    before: "info.contact { name: Team }",
    after: "info without contact",
    rationale: "contact data is documentation only",
    annotation: "names the contact",
    sources: [aad("v2.ts /info/contact"), aad("v3.ts /info/contact", "breaking")],
    docs: {
      "2.6": [doc2({ info: { ...info, contact: { name: "Team" } } }), doc2()],
      "3.0": [doc3({ info: { ...info, contact: { name: "Team" } } }), doc3()],
    },
    expect: [{ at: ["info/contact", "info/contact/**"], action: "remove", type: annotation, mentions: ["contact"] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-005",
    area: "document",
    title: "info.contact url changed",
    before: "contact.url https://a.example.com",
    after: "contact.url https://b.example.com",
    rationale: "contact data is documentation only",
    annotation: "names the contact url",
    sources: [aad("v2.ts /info/contact/url"), aad("v3.ts /info/contact/url")],
    docs: {
      "2.6": [
        doc2({ info: { ...info, contact: { url: "https://a.example.com" } } }),
        doc2({ info: { ...info, contact: { url: "https://b.example.com" } } }),
      ],
      "3.0": [
        doc3({ info: { ...info, contact: { url: "https://a.example.com" } } }),
        doc3({ info: { ...info, contact: { url: "https://b.example.com" } } }),
      ],
    },
    expect: [{ at: "info/contact/url", action: "replace", type: annotation, mentions: ["url", "contact"] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-006",
    area: "document",
    title: "AsyncAPI 3 info.tags added",
    before: "info without tags",
    after: "info.tags [users]",
    rationale: "tags group operations for documentation only",
    annotation: "names tags (or the tag)",
    sources: [aad("v3.ts /info/tags")],
    docs: [doc3(), doc3({ info: { ...info, tags: [{ name: "users" }] } })],
    expect: [{ at: ["info/tags", "info/tags/**"], action: "add", type: annotation, mentions: [/tags|users/] }],
  },
  // ---- servers (POLICY-09 decided (a): annotation)
  {
    kind: "doc",
    id: "AA-AAD-007",
    area: "servers",
    title: "servers section removed",
    before: "servers { prod }",
    after: "no servers",
    rationale: "POLICY-09 (a): servers are deployment metadata; every server change is an annotation",
    annotation: "names the removed server (or servers)",
    sources: [aad("v2.ts /servers", "breaking"), aad("v3.ts /servers", "breaking")],
    docs: {
      "2.6": [doc2({ servers: { prod: server2 } }), doc2()],
      "3.0": [doc3({ servers: { prod: server3 } }), doc3()],
    },
    expect: [{ at: ["servers", "servers/prod"], action: "remove", type: annotation, mentions: [/servers|prod/] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-008",
    area: "servers",
    title: "server variables object added",
    before: "server url {env}.example.com without variables",
    after: "server variables { env: { default: eu } }",
    rationale: "POLICY-09 (a): annotation",
    annotation: "names variables (or the variable) and the server",
    sources: [aad("v2.ts /servers/*/variables"), aad("v3.ts /servers/*/variables")],
    docs: {
      "2.6": [
        doc2({ servers: { prod: { url: "{env}.example.com:9092", protocol: "kafka" } } }),
        doc2({
          servers: {
            prod: { url: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu" } } },
          },
        }),
      ],
      "3.0": [
        doc3({ servers: { prod: { host: "{env}.example.com:9092", protocol: "kafka" } } }),
        doc3({
          servers: {
            prod: { host: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu" } } },
          },
        }),
      ],
    },
    expect: [
      {
        at: ["servers/prod/variables", "servers/prod/variables/**"],
        action: "add",
        type: annotation,
        mentions: [/variables|env/, "prod"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-009",
    area: "servers",
    title: "server variable added with its url template",
    before: "url {env}.example.com:9092, variables { env }",
    after: "url {env}.example.com:{port}, variables { env, port }",
    rationale: "POLICY-09 (a): annotation",
    annotation: "names the variable (and the url) and the server",
    sources: [aad("v2.ts /servers/*/variables/*"), aad("v3.ts /servers/*/variables/*")],
    docs: {
      "2.6": [
        doc2({
          servers: {
            prod: { url: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu" } } },
          },
        }),
        doc2({
          servers: {
            prod: {
              url: "{env}.example.com:{port}",
              protocol: "kafka",
              variables: { env: { default: "eu" }, port: { default: "9092" } },
            },
          },
        }),
      ],
      "3.0": [
        doc3({
          servers: {
            prod: { host: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu" } } },
          },
        }),
        doc3({
          servers: {
            prod: {
              host: "{env}.example.com:{port}",
              protocol: "kafka",
              variables: { env: { default: "eu" }, port: { default: "9092" } },
            },
          },
        }),
      ],
    },
    expect: [
      { at: ["servers/prod/url", "servers/prod/host"], action: "replace", type: annotation, mentions: ["prod"] },
      { at: "servers/prod/variables/port", action: "add", type: annotation, mentions: ["port", "prod"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-010",
    area: "servers",
    title: "server variable enum introduced",
    before: "variable env { default: eu }",
    after: "variable env { default: eu, enum: [eu, us] }",
    rationale: "POLICY-09 (a): annotation",
    annotation: "names enum, the variable and the server",
    sources: [aad("v2.ts /servers/*/variables/*/enum"), aad("v3.ts /servers/*/variables/*/enum")],
    docs: {
      "2.6": [
        doc2({
          servers: { prod: { url: "{env}.example.com", protocol: "kafka", variables: { env: { default: "eu" } } } },
        }),
        doc2({
          servers: {
            prod: {
              url: "{env}.example.com",
              protocol: "kafka",
              variables: { env: { default: "eu", enum: ["eu", "us"] } },
            },
          },
        }),
      ],
      "3.0": [
        doc3({
          servers: { prod: { host: "{env}.example.com", protocol: "kafka", variables: { env: { default: "eu" } } } },
        }),
        doc3({
          servers: {
            prod: {
              host: "{env}.example.com",
              protocol: "kafka",
              variables: { env: { default: "eu", enum: ["eu", "us"] } },
            },
          },
        }),
      ],
    },
    expect: [
      {
        at: ["servers/prod/variables/env/enum", "servers/prod/variables/env/enum/**"],
        action: "add",
        type: annotation,
        mentions: [/enum|eu/, "env"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-011",
    area: "servers",
    title: "server variable example added",
    before: "variable env examples [eu]",
    after: "variable env examples [eu, us]",
    rationale: "examples are documentation only",
    annotation: "names the added example, the variable and the server",
    sources: [aad("v2.ts /servers/*/variables/*/examples/*"), aad("v3.ts /servers/*/variables/*/examples/*")],
    docs: {
      "2.6": [
        doc2({
          servers: {
            prod: {
              url: "{env}.example.com",
              protocol: "kafka",
              variables: { env: { default: "eu", examples: ["eu"] } },
            },
          },
        }),
        doc2({
          servers: {
            prod: {
              url: "{env}.example.com",
              protocol: "kafka",
              variables: { env: { default: "eu", examples: ["eu", "us"] } },
            },
          },
        }),
      ],
      "3.0": [
        doc3({
          servers: {
            prod: {
              host: "{env}.example.com",
              protocol: "kafka",
              variables: { env: { default: "eu", examples: ["eu"] } },
            },
          },
        }),
        doc3({
          servers: {
            prod: {
              host: "{env}.example.com",
              protocol: "kafka",
              variables: { env: { default: "eu", examples: ["eu", "us"] } },
            },
          },
        }),
      ],
    },
    expect: [
      {
        at: "servers/prod/variables/env/examples/**",
        action: "add",
        type: annotation,
        mentions: ["us", "env"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-AAD-012",
    area: "servers",
    title: "server security alternative added",
    before: "server security [user]",
    after: "server security [user, cert]",
    rationale:
      "the requirements are alternatives: clients that authenticate with user keep connecting (ASD OpenAPI: a security alternative added is non-breaking)",
    annotation: "names the added scheme and the server",
    sources: [aad("v2.ts /servers/*/security/*", "breaking"), aad("v3.ts /servers/*/security/*", "breaking")],
    docs: {
      "2.6": [
        doc2({ servers: { prod: { ...server2, security: [{ user: [] }] } }, components: secSchemes }),
        doc2({ servers: { prod: { ...server2, security: [{ user: [] }, { cert: [] }] } }, components: secSchemes }),
      ],
      "3.0": [
        doc3({ servers: { prod: { ...server3, security: [ref3("user")] } }, components: secSchemes }),
        doc3({ servers: { prod: { ...server3, security: [ref3("user"), ref3("cert")] } }, components: secSchemes }),
      ],
    },
    expect: [
      {
        at: "servers/prod/security/**",
        action: "add",
        type: nonBreaking,
        mentions: ["cert", "prod"],
      },
    ],
    // ISSUE-114 (fixed) (P8-rest); ISSUE-101 (fixed); ISSUE-114 fixed for 3.0 (P8a)
  },
  {
    kind: "doc",
    id: "AA-AAD-013",
    area: "servers",
    title: "AsyncAPI 3 server tag added",
    before: "server tags [env:prod]",
    after: "server tags [env:prod, region:eu]",
    rationale: "documentation only",
    annotation: "names the added tag and the server",
    sources: [aad("v3.ts /servers/*/tags/*")],
    docs: [
      doc3({ servers: { prod: { ...server3, tags: [{ name: "env:prod" }] } } }),
      doc3({ servers: { prod: { ...server3, tags: [{ name: "env:prod" }, { name: "region:eu" }] } } }),
    ],
    expect: [{ at: "servers/prod/tags/**", action: "add", type: annotation, mentions: ["region:eu", "prod"] }],
    // ISSUE-114 (fixed) (P8a)
  },
  // ---- 3.0 sections and containers
  {
    kind: "doc",
    id: "AA-AAD-014",
    area: "channels",
    title: "AsyncAPI 3 channels section added",
    before: "no channels",
    after: "channels { userEvents }",
    rationale: "a new channel asks nothing of existing clients (as AA-CH-003)",
    annotation: "names the added channel",
    sources: [aad("v3.ts /channels")],
    docs: [doc3(), doc3({}, { userEvents: { address: "user/events", messages: { event: { payload } } } })],
    expect: [{ at: ["channels", "channels/userEvents"], action: "add", type: nonBreaking, mentions: [CH] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-015",
    area: "operations",
    title: "AsyncAPI 3 operations section added",
    before: "channel userEvents, no operations",
    after: "operations { onEvent: send userEvents }",
    rationale: "a new operation asks nothing of existing clients (as AA-OP-020)",
    annotation: "names the added operation",
    sources: [aad("v3.ts /operations")],
    docs: {
      send: [doc3({}, { userEvents: { address: "user/events", messages: { event: { payload } } } }), op3("send")],
      receive: [doc3({}, { userEvents: { address: "user/events", messages: { event: { payload } } } }), op3("receive")],
    },
    expect: [
      { at: ["operations", "operations/onEvent"], action: "add", type: nonBreaking, mentions: ["onEvent"] },
      // the channel message becomes used: no change of the message itself
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-016",
    area: "messages",
    title: "AsyncAPI 3 messages map of a channel removed with the operation messages list",
    before: "channel userEvents messages { event }, operation messages [event]",
    after: "channel userEvents without messages, operation without messages",
    rationale:
      "the operation no longer carries the message: subscribers of a send operation lose it, clients of a receive operation are no longer served",
    annotation: "names the removed message(s) and the channel / operation",
    sources: [aad("v3.ts /channels/*/messages"), aad("v3.ts /operations/*/messages")],
    docs: {
      send: [
        op3("send"),
        doc3(
          {},
          { userEvents: { address: "user/events" } },
          {
            onEvent: { action: "send", channel: { $ref: "#/channels/userEvents" } },
          },
        ),
      ],
      receive: [
        op3("receive"),
        doc3(
          {},
          { userEvents: { address: "user/events" } },
          {
            onEvent: { action: "receive", channel: { $ref: "#/channels/userEvents" } },
          },
        ),
      ],
    },
    expect: [
      {
        at: ["channels/userEvents/messages", "channels/userEvents/messages/event"],
        action: "remove",
        type: breaking,
        mentions: [/event|messages/],
      },
      {
        at: ["operations/onEvent/messages", "operations/onEvent/messages/**"],
        action: "remove",
        type: breaking,
        mentions: [/event|messages/, "onEvent"],
      },
    ],
    // ISSUE-52 (fixed)
  },
  {
    kind: "doc",
    id: "AA-AAD-017",
    area: "channels",
    title: "AsyncAPI 3 channel tag added",
    before: "channel tags [users]",
    after: "channel tags [users, accounts]",
    rationale: "documentation only",
    annotation: "names the added tag and the channel",
    sources: [aad("v3.ts /channels/*/tags/*")],
    docs: [
      doc3({}, { userEvents: { address: "user/events", tags: [{ name: "users" }] } }),
      doc3({}, { userEvents: { address: "user/events", tags: [{ name: "users" }, { name: "accounts" }] } }),
    ],
    expect: [{ at: "channels/userEvents/tags/**", action: "add", type: annotation, mentions: ["accounts", CH] }],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-AAD-018",
    area: "operations",
    title: "AsyncAPI 3 reply address removed",
    before: "reply { address: { location: $message.header#/replyTo }, channel }",
    after: "reply { channel }",
    rationale:
      "the requester no longer learns at runtime where the reply goes: it must use the reply channel's address instead",
    annotation: "names the reply address and the operation",
    sources: [aad("v3.ts /operations/*/reply/address")],
    docs: {
      receive: [
        op3("receive", {
          reply: { address: { location: "$message.header#/replyTo" }, channel: { $ref: "#/channels/userEvents" } },
        }),
        op3("receive", { reply: { channel: { $ref: "#/channels/userEvents" } } }),
      ],
    },
    expect: [
      {
        at: ["operations/onEvent/reply/address", "operations/onEvent/reply/address/**"],
        action: "remove",
        type: breaking,
        mentions: [/address|replyTo/, "onEvent"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-019",
    area: "operations",
    title: "AsyncAPI 3 reply messages list removed",
    before: "reply { channel, messages: [event] }",
    after: "reply { channel }",
    rationale: "the reply no longer declares the message the requester must handle",
    annotation: "names the reply messages and the operation",
    sources: [aad("v3.ts /operations/*/reply/messages", "unclassified")],
    docs: {
      receive: [
        op3("receive", {
          reply: {
            channel: { $ref: "#/channels/userEvents" },
            messages: [{ $ref: "#/channels/userEvents/messages/event" }],
          },
        }),
        op3("receive", { reply: { channel: { $ref: "#/channels/userEvents" } } }),
      ],
    },
    expect: [
      {
        at: ["operations/onEvent/reply/messages", "operations/onEvent/reply/messages/**"],
        action: "remove",
        type: breaking,
        mentions: ["onEvent"],
      },
    ],
    // ISSUE-52 (fixed)
  },
  // ---- message documentation containers
  {
    kind: "doc",
    id: "AA-AAD-020",
    area: "messages",
    title: "message tags added",
    before: "message without tags",
    after: "message tags [users]",
    rationale: "documentation only",
    annotation: "names tags (or the tag) and the channel",
    sources: [...pubSub("message/tags"), aad("v3.ts /channels/*/messages/*/tags")],
    docs: msgVariants({}, { tags: [{ name: "users" }] }),
    expect: [{ at: [...msgAt("tags"), ...msgAt("tags/**")], action: "add", type: annotation, mentions: [CH] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-021",
    area: "messages",
    title: "message examples added",
    before: "message without examples",
    after: "message examples [{ payload: { userId: a } }]",
    rationale: "examples are documentation only",
    annotation: "names examples and the channel",
    sources: [...pubSub("message/examples"), aad("v3.ts /channels/*/messages/*/examples")],
    docs: msgVariants({}, { examples: [{ payload: { userId: "a" } }] }),
    expect: [
      {
        at: [...msgAt("examples"), ...msgAt("examples/**")],
        action: "add",
        type: annotation,
        mentions: ["examples", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-022",
    area: "bindings-traits",
    title: "AsyncAPI 2 message binding changed in a publish operation",
    before: "publish message bindings.kafka.bindingVersion 0.4.0",
    after: "publish message bindings.kafka.bindingVersion 0.5.0",
    rationale: "protocol-specific; POLICY-19 (b): non-Schema binding fields are unclassified with a description",
    annotation: "names bindingVersion, the protocol and the channel",
    sources: [aad("v2.ts /channels/*/publish/message/bindings", "unclassified")],
    docs: {
      "2.6-pub": pair(
        op2,
        ["publish", {}, { bindings: { kafka: { bindingVersion: "0.4.0" } } }],
        ["publish", {}, { bindings: { kafka: { bindingVersion: "0.5.0" } } }],
      ),
    },
    expect: [
      {
        at: msgAt("bindings/kafka/bindingVersion"),
        action: "replace",
        type: unclassified,
        mentions: ["bindingVersion", "kafka", CH],
      },
    ],
  },
  // ---- 2.x publish operation fields
  {
    kind: "doc",
    id: "AA-AAD-023",
    area: "operations",
    title: "AsyncAPI 2 publish operationId changed",
    before: "publish.operationId sendUserEvent",
    after: "publish.operationId emitUserEvent",
    rationale: "operationId is the identifier generated clients use (as AA-OP-005 for subscribe)",
    annotation: "names operationId, publish and the channel",
    sources: [aad("v2.ts /channels/*/publish/operationId")],
    docs: [op2("publish", { operationId: "sendUserEvent" }), op2("publish", { operationId: "emitUserEvent" })],
    expect: [
      {
        at: "channels/*/publish/operationId",
        action: "replace",
        type: breaking,
        mentions: ["operationId", "publish", "user/events"],
      },
    ],
    // ISSUE-112 (fixed)
  },
  {
    kind: "doc",
    id: "AA-AAD-024",
    area: "operations",
    title: "AsyncAPI 2 publish operation documentation changed",
    before: "publish summary 'User events', description 'All'",
    after: "publish summary 'Account events', description 'All account events', externalDocs added",
    rationale: "documentation only",
    annotation: "names the field, publish and the channel",
    sources: [
      aad("v2.ts /channels/*/publish/summary"),
      aad("v2.ts /channels/*/publish/description"),
      aad("v2.ts /channels/*/publish/externalDocs"),
    ],
    docs: [
      op2("publish", { summary: "User events", description: "All" }),
      op2("publish", {
        summary: "Account events",
        description: "All account events",
        externalDocs: { url: "https://docs.example.com" },
      }),
    ],
    expect: [
      { at: "channels/*/publish/summary", action: "replace", type: annotation, mentions: ["summary", "publish"] },
      {
        at: "channels/*/publish/description",
        action: "replace",
        type: annotation,
        mentions: ["description", "publish"],
      },
      { at: "channels/*/publish/externalDocs", action: "add", type: annotation, mentions: ["externalDocs", "publish"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-025",
    area: "operations",
    title: "operation tags added",
    before: "operation without tags",
    after: "operation tags [users]",
    rationale: "tags group operations for documentation only",
    annotation: "names tags (or the tag) and the operation",
    sources: [...pubSub("tags"), aad("v3.ts /operations/*/tags")],
    docs: opVariants({}, { tags: [{ name: "users" }] }),
    expect: [{ at: [...opAt("tags"), ...opAt("tags/**")], action: "add", type: annotation, mentions: [OP] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-026",
    area: "operations",
    title: "AsyncAPI 2 publish operation tag added",
    before: "publish tags [users]",
    after: "publish tags [users, accounts]",
    rationale: "documentation only",
    annotation: "names the added tag and the operation",
    sources: [aad("v2.ts /channels/*/publish/tags/*")],
    docs: [
      op2("publish", { tags: [{ name: "users" }] }),
      op2("publish", { tags: [{ name: "users" }, { name: "accounts" }] }),
    ],
    expect: [{ at: "channels/*/publish/tags/**", action: "add", type: annotation, mentions: ["accounts"] }],
    // ISSUE-114 (fixed) (P8a)
  },
  // ---- operation traits (merged into the operation, ISSUE-103)
  {
    kind: "doc",
    id: "AA-AAD-027",
    area: "bindings-traits",
    title: "operation trait documentation changed",
    before: "traits [{ summary: a, description: a, externalDocs: a }] (3.0: and title a)",
    after: "traits [{ summary: b, description: b, externalDocs: b }] (3.0: and title b)",
    rationale: "the merged operation only changes documentation",
    annotation: "names the field and the operation",
    sources: [
      ...pubSub("traits/summary"),
      ...pubSub("traits/externalDocs"),
      aad("v2.ts /channels/*/subscribe/traits/description"),
      aad("v3.ts /operations/*/traits/*/title"),
      aad("v3.ts /operations/*/traits/*/summary"),
      aad("v3.ts /operations/*/traits/*/description"),
      aad("v3.ts /operations/*/traits/*/externalDocs"),
    ],
    docs: {
      ...(({ "3.0": _, ...v2 }) => v2)(
        opVariants(
          { traits: [{ summary: "a", description: "a", externalDocs: { url: "https://a.example.com" } }] },
          { traits: [{ summary: "b", description: "b", externalDocs: { url: "https://b.example.com" } }] },
        ),
      ),
      "3.0": pair(
        op3,
        [
          "send",
          { traits: [{ title: "a", summary: "a", description: "a", externalDocs: { url: "https://a.example.com" } }] },
        ],
        [
          "send",
          { traits: [{ title: "b", summary: "b", description: "b", externalDocs: { url: "https://b.example.com" } }] },
        ],
      ),
    },
    expect: [{ at: [...opAt("traits/**"), ...opAt("**")], action: "replace", type: annotation, mentions: [OP] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-028",
    area: "bindings-traits",
    title: "AsyncAPI 2 operation trait operationId changed",
    before: "traits [{ operationId: onUserEvent }]",
    after: "traits [{ operationId: handleUserEvent }]",
    rationale: "the merged operation's operationId changes (as AA-OP-005)",
    annotation: "names operationId and the operation",
    sources: pubSub("traits/operationId"),
    docs: (({ "3.0": _, ...v2 }) => v2)(
      opVariants({ traits: [{ operationId: "onUserEvent" }] }, { traits: [{ operationId: "handleUserEvent" }] }),
    ),
    expect: [{ at: opAt("**/operationId"), action: "replace", type: breaking, mentions: ["operationId", OP] }],
    // ISSUE-112 (fixed)
  },
  {
    kind: "doc",
    id: "AA-AAD-029",
    area: "bindings-traits",
    title: "operation trait tags added and extended",
    before: "traits [{ tags: [users] }, { summary }]",
    after: "traits [{ tags: [users, accounts] }, { summary, tags: [kafka] }]",
    rationale: "the merged operation only gains tags, documentation only",
    annotation: "names the added tag and the operation",
    sources: [
      ...pubSub("traits/tags"),
      ...pubSub("traits/tags/*"),
      aad("v3.ts /operations/*/traits/*/tags"),
      aad("v3.ts /operations/*/traits/*/tags/*"),
    ],
    docs: opVariants(
      { traits: [{ tags: [{ name: "users" }] }, { summary: "Kafka" }] },
      {
        traits: [{ tags: [{ name: "users" }, { name: "accounts" }] }, { summary: "Kafka", tags: [{ name: "kafka" }] }],
      },
    ),
    expect: [
      { at: opAt("traits/0/tags/**"), action: "add", type: annotation, mentions: ["accounts", OP] },
      { at: [...opAt("traits/1/tags"), ...opAt("traits/1/tags/**")], action: "add", type: annotation, mentions: [OP] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-AAD-030",
    area: "bindings-traits",
    title: "AsyncAPI 2 publish operation trait carrying only documentation added",
    before: "publish without traits",
    after: "publish traits [{ summary }]",
    rationale: "the merged operation only gains a summary (as AA-BND-011 for subscribe)",
    annotation: "names traits (or summary) and the operation",
    sources: [aad("v2.ts /channels/*/publish/traits", "non-breaking")],
    docs: [op2("publish"), op2("publish", { traits: [{ summary: "User events" }] })],
    expect: [{ at: "channels/*/publish/**", type: annotation, mentions: ["publish"] }],
    // ISSUE-103 (fixed)
  },
  {
    kind: "doc",
    id: "AA-AAD-031",
    area: "bindings-traits",
    title: "AsyncAPI 2 publish operation trait carrying only a description removed",
    before: "publish traits [{ description }]",
    after: "publish without traits",
    rationale: "the merged operation only loses a description (as AA-BND-012 for subscribe)",
    annotation: "names traits (or description) and the operation",
    sources: [aad("v2.ts /channels/*/publish/traits/*", "breaking")],
    docs: [op2("publish", { traits: [{ description: "Kafka operation" }] }), op2("publish")],
    expect: [{ at: "channels/*/publish/**", type: annotation, mentions: ["publish"] }],
    // ISSUE-103 (fixed)
  },
  {
    kind: "doc",
    id: "AA-AAD-032",
    area: "bindings-traits",
    title: "AsyncAPI 2 publish operation trait binding changed",
    before: "publish traits [{ bindings.kafka.bindingVersion 0.4.0 }]",
    after: "publish traits [{ bindings.kafka.bindingVersion 0.5.0 }]",
    rationale: "a binding merged from a trait is still a binding: unclassified (POLICY-19)",
    annotation: "names bindingVersion and the operation",
    sources: [aad("v2.ts /channels/*/publish/traits/bindings", "unclassified")],
    docs: [
      op2("publish", { traits: [{ bindings: { kafka: { bindingVersion: "0.4.0" } } }] }),
      op2("publish", { traits: [{ bindings: { kafka: { bindingVersion: "0.5.0" } } }] }),
    ],
    expect: [
      {
        at: "channels/*/publish/traits/**",
        action: "replace",
        type: unclassified,
        mentions: ["bindingVersion", "publish"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-033",
    area: "bindings-traits",
    title: "AsyncAPI 3 operation trait security requirement added and extended",
    before: "traits [{ summary }, { security: [user] }]",
    after: "traits [{ summary, security: [user] }, { security: [user, cert] }]",
    rationale:
      "POLICY-81 decided: a change inside a trait is classified by its effect on the merged operation; the second trait already contributed [user], so the merged operation keeps requiring user and only gains the cert alternative (harmless): both changes are non-breaking",
    annotation: "names security, the scheme and the operation",
    sources: [aad("v3.ts /operations/*/traits/*/security"), aad("v3.ts /operations/*/traits/*/security/*", "breaking")],
    docs: {
      send: [
        op3("send", { traits: [{ summary: "Kafka" }, { security: [ref3("user")] }] }, {}, { components: secSchemes }),
        op3(
          "send",
          { traits: [{ summary: "Kafka", security: [ref3("user")] }, { security: [ref3("user"), ref3("cert")] }] },
          {},
          { components: secSchemes },
        ),
      ],
    },
    expect: [
      {
        at: ["operations/onEvent/traits/0/security", "operations/onEvent/traits/0/security/**"],
        action: "add",
        type: nonBreaking,
        mentions: ["security", "user", "onEvent"],
      },
      {
        at: "operations/onEvent/traits/1/security/**",
        action: "add",
        type: nonBreaking,
        mentions: ["cert", "onEvent"],
      },
    ],
    // POLICY-81 decided (P8a): the first expectation rewritten from breaking to non-breaking
    // ISSUE-114 (fixed) (P8-rest); ISSUE-101 (fixed)
  },
  // ---- message traits (merged into the message, ISSUE-103)
  {
    kind: "doc",
    id: "AA-AAD-034",
    area: "bindings-traits",
    title: "message trait name, title and summary changed",
    before: "message traits [{ name: signup, title: a, summary: a }] (3.0: and description a)",
    after: "message traits [{ name: userSignup, title: b, summary: b }] (3.0: and description b)",
    rationale: "the merged message changes only its tooling name (non-breaking, as AA-MSG-001) and documentation",
    annotation: "names the field and the channel",
    sources: [
      ...pubSub("message/traits/name"),
      ...pubSub("message/traits/title"),
      ...pubSub("message/traits/summary"),
      aad("v3.ts /channels/*/messages/*/traits/*/name"),
      aad("v3.ts /channels/*/messages/*/traits/*/title"),
      aad("v3.ts /channels/*/messages/*/traits/*/summary"),
      aad("v3.ts /channels/*/messages/*/traits/*/description"),
    ],
    docs: {
      ...msgVariants(
        { traits: [{ name: "signup", title: "a", summary: "a" }] },
        { traits: [{ name: "userSignup", title: "b", summary: "b" }] },
        false,
      ),
      "3.0-send": pair(
        op3,
        ["send", {}, { traits: [{ name: "signup", title: "a", summary: "a", description: "a" }] }],
        ["send", {}, { traits: [{ name: "userSignup", title: "b", summary: "b", description: "b" }] }],
      ),
    },
    expect: {
      "*": traitDocs,
      "3.0-send": [
        ...traitDocs,
        { at: msgAt("traits/0/description"), action: "replace", type: annotation, mentions: ["description", CH] },
      ],
    },
    // ISSUE-105 (fixed)
  },
  {
    kind: "doc",
    id: "AA-AAD-035",
    area: "bindings-traits",
    title: "message trait tags, externalDocs and examples added",
    before: "message traits [{ name: signup }]",
    after: "message traits [{ name: signup, tags: [users], externalDocs, examples: [{ payload }] }]",
    rationale: "the merged message only gains documentation",
    annotation: "names the field and the channel",
    sources: [
      ...pubSub("message/traits/tags"),
      ...pubSub("message/traits/externalDocs"),
      ...pubSub("message/traits/examples"),
      aad("v3.ts /channels/*/messages/*/traits/*/tags"),
      aad("v3.ts /channels/*/messages/*/traits/*/externalDocs"),
      aad("v3.ts /channels/*/messages/*/traits/*/examples"),
    ],
    docs: {
      ...msgVariants(
        { traits: [{ name: "signup" }] },
        {
          traits: [
            {
              name: "signup",
              tags: [{ name: "users" }],
              externalDocs: { url: "https://docs.example.com" },
              examples: [{ payload: { userId: "a" } }],
            },
          ],
        },
        false,
      ),
      "3.0-send": pair(
        op3,
        ["send", {}, { traits: [{ name: "signup" }] }],
        [
          "send",
          {},
          {
            traits: [
              {
                name: "signup",
                tags: [{ name: "users" }],
                externalDocs: { url: "https://docs.example.com" },
                examples: [{ payload: { userId: "a" } }],
              },
            ],
          },
        ],
      ),
    },
    expect: [
      {
        at: [...msgAt("traits/0/tags"), ...msgAt("traits/0/tags/**")],
        action: "add",
        type: annotation,
        mentions: [CH],
      },
      { at: msgAt("traits/0/externalDocs"), action: "add", type: annotation, mentions: ["externalDocs", CH] },
      {
        at: [...msgAt("traits/0/examples"), ...msgAt("traits/0/examples/**")],
        action: "add",
        type: annotation,
        mentions: ["examples", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-036",
    area: "bindings-traits",
    title: "message trait tag and example added",
    before: "message traits [{ tags: [users], examples: [{ payload: a }] }]",
    after: "message traits [{ tags: [users, onboarding], examples: [{ payload: a }, { payload: b }] }]",
    rationale: "documentation only",
    annotation: "names the added tag / example and the channel",
    sources: [
      ...pubSub("message/traits/tags/*"),
      ...pubSub("message/traits/examples/*"),
      aad("v3.ts /channels/*/messages/*/traits/*/tags/*"),
      aad("v3.ts /channels/*/messages/*/traits/*/examples/*"),
    ],
    docs: {
      ...msgVariants(
        { traits: [{ tags: [{ name: "users" }], examples: [{ payload: { userId: "a" } }] }] },
        {
          traits: [
            {
              tags: [{ name: "users" }, { name: "onboarding" }],
              examples: [{ payload: { userId: "a" } }, { payload: { userId: "b" } }],
            },
          ],
        },
        false,
      ),
      "3.0-send": pair(
        op3,
        ["send", {}, { traits: [{ tags: [{ name: "users" }], examples: [{ payload: { userId: "a" } }] }] }],
        [
          "send",
          {},
          {
            traits: [
              {
                tags: [{ name: "users" }, { name: "onboarding" }],
                examples: [{ payload: { userId: "a" } }, { payload: { userId: "b" } }],
              },
            ],
          },
        ],
      ),
    },
    expect: [
      { at: msgAt("traits/0/tags/**"), action: "add", type: annotation, mentions: ["onboarding", CH] },
      { at: msgAt("traits/0/examples/**"), action: "add", type: annotation, mentions: ["examples", CH] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-AAD-037",
    area: "bindings-traits",
    title: "message trait binding changed",
    before: "message traits [{ bindings.kafka.bindingVersion 0.4.0 }]",
    after: "message traits [{ bindings.kafka.bindingVersion 0.5.0 }]",
    rationale: "a binding merged from a trait is still a binding: unclassified (POLICY-19)",
    annotation: "names bindingVersion, the protocol and the channel",
    sources: [
      ...pubSub("message/traits/bindings", "unclassified"),
      aad("v3.ts /channels/*/messages/*/traits/*/bindings", "unclassified"),
    ],
    docs: (({ "3.0-receive": _, ...v }) => v)(
      msgVariants(
        { traits: [{ bindings: { kafka: { bindingVersion: "0.4.0" } } }] },
        { traits: [{ bindings: { kafka: { bindingVersion: "0.5.0" } } }] },
      ),
    ),
    expect: [
      {
        at: msgAt("traits/0/bindings/kafka/bindingVersion"),
        action: "replace",
        type: unclassified,
        mentions: ["bindingVersion", "kafka", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-038",
    area: "bindings-traits",
    title: "message trait correlationId location changed and description added",
    before: "message traits [{ correlationId: { location: $message.header#/id } }]",
    after: "message traits [{ correlationId: { location: $message.header#/traceId, description } }]",
    rationale:
      "the merged message is correlated through another field: consumers look in the wrong place (as AA-MSG-010)",
    annotation: "names correlationId location / description and the channel",
    sources: [
      ...pubSub("message/traits/correlationId/location"),
      ...pubSub("message/traits/correlationId/description"),
      aad("v3.ts /channels/*/messages/*/traits/*/correlationId/location"),
      aad("v3.ts /channels/*/messages/*/traits/*/correlationId/description"),
    ],
    docs: (({ "3.0-receive": _, ...v }) => v)(
      msgVariants(
        { traits: [{ correlationId: { location: "$message.header#/id" } }] },
        { traits: [{ correlationId: { location: "$message.header#/traceId", description: "Trace id" } }] },
      ),
    ),
    expect: [
      {
        at: msgAt("traits/0/correlationId/location"),
        action: "replace",
        type: breaking,
        mentions: ["location", CH],
      },
      {
        at: msgAt("traits/0/correlationId/description"),
        action: "add",
        type: annotation,
        mentions: ["description", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-039",
    area: "bindings-traits",
    title: "AsyncAPI 2 message trait schemaFormat changed",
    before: "message traits [{ schemaFormat: application/vnd.aai.asyncapi;version=2.6.0 }]",
    after: "message traits [{ schemaFormat: application/schema+json;version=draft-07 }]",
    rationale:
      "POLICY-82 decided: the merged message's payload (equal on both sides) is read as draft-07 instead of the AsyncAPI schema, a draft-07 superset, so the valid payloads are unchanged (annotation); a non-JSON format (Avro) reads the payload in another language (breaking, as AA-MSG-017)",
    annotation: "names schemaFormat and the channel",
    sources: pubSub("message/traits/schemaFormat"),
    docs: {
      ...msgVariants(
        { traits: [{ schemaFormat: "application/vnd.aai.asyncapi;version=2.6.0" }] },
        { traits: [{ schemaFormat: "application/schema+json;version=draft-07" }] },
        false,
      ),
      "2.6-pub-avro": pair(
        op2,
        ["publish", {}, { traits: [{ schemaFormat: "application/vnd.aai.asyncapi;version=2.6.0" }] }],
        ["publish", {}, { traits: [{ schemaFormat: "application/vnd.apache.avro;version=1.9.0" }] }],
      ),
    },
    expect: {
      "*": [
        { at: msgAt("traits/0/schemaFormat"), action: "replace", type: annotation, mentions: ["schemaFormat", CH] },
      ],
      "2.6-pub-avro": [
        { at: msgAt("traits/0/schemaFormat"), action: "replace", type: breaking, mentions: ["schemaFormat", CH] },
      ],
    },
    // POLICY-82 decided (P8a): the draft-07 expectation rewritten from breaking to annotation; Avro variant added
  },
  {
    kind: "doc",
    id: "AA-AAD-040",
    area: "bindings-traits",
    title: "header type changed inside a subscribe message trait",
    before: "subscribe message traits [{ headers: { trace: string } }]",
    after: "subscribe message traits [{ headers: { trace: integer } }]",
    rationale: "the merged message headers change type: breaking in both directions (as AA-BND-018 for publish)",
    annotation: "names the header property and the channel",
    sources: [
      aad("v2.ts /channels/*/subscribe/message/traits/headers", "unclassified"),
      aad("v3.ts /channels/*/messages/*/traits/*/headers", "unclassified"),
    ],
    docs: {
      "2.6-sub": pair(
        op2,
        ["subscribe", {}, { traits: [{ headers: obj({ trace: { type: "string" } }) }] }],
        ["subscribe", {}, { traits: [{ headers: obj({ trace: { type: "integer" } }) }] }],
      ),
      "3.0-send": pair(
        op3,
        ["send", {}, { traits: [{ headers: obj({ trace: { type: "string" } }) }] }],
        ["send", {}, { traits: [{ headers: obj({ trace: { type: "integer" } }) }] }],
      ),
    },
    expect: [
      {
        at: msgAt("traits/0/headers/properties/trace/type"),
        action: "replace",
        type: breaking,
        mentions: ["trace", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-AAD-041",
    area: "bindings-traits",
    title: "AsyncAPI 2 publish message trait carrying a correlationId added",
    before: "publish message without traits",
    after: "publish message traits [{ correlationId: $message.header#/correlationId }]",
    rationale: "the merged message gains a correlationId, which asks nothing of existing clients (as AA-BND-019)",
    annotation: "names traits or correlationId and the channel",
    sources: [
      aad("v2.ts /channels/*/publish/message/traits"),
      aad("v2.ts /channels/*/publish/message/traits/correlationId"),
    ],
    docs: [
      op2("publish"),
      op2("publish", {}, { traits: [{ correlationId: { location: "$message.header#/correlationId" } }] }),
    ],
    expect: [{ at: "channels/**", action: "add", type: nonBreaking, mentions: [CH] }],
  },
  {
    kind: "doc",
    id: "AA-AAD-042",
    area: "bindings-traits",
    title: "AsyncAPI 2 publish message trait contentType changed",
    before: "publish message traits [{ contentType: application/json }]",
    after: "publish message traits [{ contentType: application/avro }]",
    rationale: "the merged message's content type changes: producers and consumers decode differently",
    annotation: "names contentType, the channel and the new media type",
    sources: [aad("v2.ts /channels/*/publish/message/traits/contentType")],
    docs: [
      op2("publish", {}, { traits: [{ contentType: "application/json" }] }),
      op2("publish", {}, { traits: [{ contentType: "application/avro" }] }),
    ],
    expect: [
      {
        at: "channels/**/traits/0/contentType",
        action: "replace",
        type: breaking,
        mentions: ["contentType", CH, "application/avro"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-AAD-043",
    area: "bindings-traits",
    title: "AsyncAPI 2 publish message trait carrying only a description removed",
    before: "publish message traits [{ description }]",
    after: "publish message without traits",
    rationale: "the merged message only loses a description (as AA-BND-016)",
    annotation: "names traits (or description) and the channel",
    sources: [aad("v2.ts /channels/*/publish/message/traits/*", "breaking")],
    docs: [op2("publish", {}, { traits: [{ description: "Traced message" }] }), op2("publish")],
    expect: [{ at: "channels/**", type: annotation, mentions: [CH] }],
    // ISSUE-103 (fixed)
  },
]

runCases("asyncapi", "asyncapi-diff-standard", cases, import.meta.filename)
