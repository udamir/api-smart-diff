// AsyncAPI components with usage-derived classification (DESIGN_PROPOSALS §11.4): a component is classified by the scopes that reference it (breaking if breaking in any usage), an unreferenced component is unclassified with a description, `options.components: "unclassified"` opts out. Covers schemas, messages, messageTraits, operationTraits, parameters (see channels.test.ts), correlationIds, channels, replyAddresses, securitySchemes and component renames.

import { annotation, breaking, nonBreaking, risky, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const obj = (properties: Record<string, unknown>, required?: string[]) => ({
  type: "object",
  properties,
  ...(required ? { required } : {}),
})
const aa2 = (channels: unknown, components: unknown) => ({ asyncapi: "2.6.0", info, channels, components })
const aa3 = (channels: unknown, operations: unknown, components: unknown) => ({
  asyncapi: "3.0.0",
  info,
  channels,
  operations,
  components,
})
const op3 = (action: "send" | "receive", channel: string, messages: string[], extra: Record<string, unknown> = {}) => ({
  action,
  channel: { $ref: `#/channels/${channel}` },
  messages: messages.map((m) => ({ $ref: `#/channels/${channel}/messages/${m}` })),
  ...extra,
})
const ref = (path: string) => ({ $ref: `#/components/${path}` })

// a document whose only payload is components/schemas/User, used by the given 2.x operations / 3.0 actions
const users2 = (ops: ("publish" | "subscribe")[], user: unknown) =>
  aa2(Object.fromEntries(ops.map((op) => [`user/${op}`, { [op]: { message: { payload: ref("schemas/User") } } }])), {
    schemas: { User: user },
  })
const users3 = (actions: ("send" | "receive")[], user: unknown) =>
  aa3(
    Object.fromEntries(
      actions.map((a) => [`${a}User`, { address: `user/${a}`, messages: { user: { payload: ref("schemas/User") } } }]),
    ),
    Object.fromEntries(actions.map((a) => [`on${a}`, op3(a, `${a}User`, ["user"])])),
    { schemas: { User: user } },
  )

const asd = (ref: string) => ({ tool: "asd", ref })
const asyncapiDiff = (ref: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const usage = asd("DESIGN_PROPOSALS §11.4 usage-derived components")

// POLICY-80 decided (a): a security scheme no requirement references (2.x requirement keys, 3.0 `$ref`s) is
// unclassified like an unreferenced OpenAPI scheme (POLICY-11); the "used" variants reference the scheme from a server
const schemes2 = (schemes: Record<string, unknown>, used = false) => ({
  ...aa2({}, { securitySchemes: schemes }),
  ...(used
    ? {
        servers: {
          prod: {
            url: "broker.example.com:9092",
            protocol: "kafka",
            security: Object.keys(schemes).map((name) => ({ [name]: [] })),
          },
        },
      }
    : {}),
})
const schemes3 = (schemes: Record<string, unknown>, used = false) => ({
  ...aa3({}, {}, { securitySchemes: schemes }),
  ...(used
    ? {
        servers: {
          prod: {
            host: "broker.example.com:9092",
            protocol: "kafka",
            security: Object.keys(schemes).map((name) => ref(`securitySchemes/${name}`)),
          },
        },
      }
    : {}),
})
const schemeDocs = (pairs: { "2.6"?: [unknown, unknown]; "3.0"?: [unknown, unknown] }) => {
  const docs: Record<string, [unknown, unknown]> = {}
  for (const [version, build] of [
    ["2.6", schemes2],
    ["3.0", schemes3],
  ] as const) {
    const pair = pairs[version] as [Record<string, unknown>, Record<string, unknown>] | undefined
    if (pair) {
      docs[version] = [build(pair[0]), build(pair[1])]
      docs[`${version} used`] = [build(pair[0], true), build(pair[1], true)]
    }
  }
  return docs
}
const whenUsed = <T>(type: T) => ({ "*": unclassified, "2.6 used": type, "3.0 used": type })

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-CMP-001",
    title: "change inside an unreferenced component schema",
    before: "components.schemas.Draft.a string, nothing references Draft",
    after: "components.schemas.Draft.a integer",
    rationale: "decision §11.4: a component without usage has no direction; unclassified with a description",
    annotation: "names the property and the schema component",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/schema_format_test.go TestMultiFormatSchemaChanges component",
        verdict: "breaking",
      },
      usage,
      asyncapiDiff("v2.ts /components"),
      asyncapiDiff("v3.ts /components"),
    ],
    docs: {
      "2.6": [
        aa2({}, { schemas: { Draft: obj({ a: { type: "string" } }) } }),
        aa2({}, { schemas: { Draft: obj({ a: { type: "integer" } }) } }),
      ],
      "3.0": [
        aa3({}, {}, { schemas: { Draft: obj({ a: { type: "string" } }) } }),
        aa3({}, {}, { schemas: { Draft: obj({ a: { type: "integer" } }) } }),
      ],
    },
    expect: [
      {
        at: "components/schemas/Draft/properties/a/type",
        action: "replace",
        type: unclassified,
        mentions: ["`a`", "Draft"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-002",
    title: "unreferenced component schema added",
    before: "components.schemas.Draft",
    after: "components.schemas.Draft and Extra (nothing references either)",
    rationale: "decision §11.4: unreferenced components are unclassified with a description",
    annotation: "names the added component",
    sources: [usage, asyncapiDiff("v2.ts /components")],
    docs: {
      "2.6": [aa2({}, { schemas: { Draft: obj({}) } }), aa2({}, { schemas: { Draft: obj({}), Extra: obj({}) } })],
      "3.0": [
        aa3({}, {}, { schemas: { Draft: obj({}) } }),
        aa3({}, {}, { schemas: { Draft: obj({}), Extra: obj({}) } }),
      ],
    },
    expect: [{ at: "components/schemas/Extra", action: "add", type: unclassified, mentions: ["Extra"] }],
  },
  {
    kind: "doc",
    id: "AA-CMP-003",
    title: "unreferenced component message removed",
    before: "components.messages Draft and Old (nothing references either)",
    after: "components.messages Draft",
    rationale: "decision §11.4: unreferenced components are unclassified with a description",
    annotation: "names the removed component",
    sources: [usage],
    docs: {
      "2.6": [
        aa2({}, { messages: { Draft: { payload: obj({}) }, Old: { payload: obj({}) } } }),
        aa2({}, { messages: { Draft: { payload: obj({}) } } }),
      ],
      "3.0": [
        aa3({}, {}, { messages: { Draft: { payload: obj({}) }, Old: { payload: obj({}) } } }),
        aa3({}, {}, { messages: { Draft: { payload: obj({}) } } }),
      ],
    },
    expect: [{ at: "components/messages/Old", action: "remove", type: unclassified, mentions: ["Old"] }],
  },
  {
    kind: "doc",
    id: "AA-CMP-004",
    title: "required property added to a schema used by a consumed and a produced message",
    before: "User { a } used by publish + subscribe (3.0: receive + send)",
    after: "User { a } required [a]",
    rationale:
      "each usage site takes its own direction (consumed: breaking, produced: non-breaking); the component is breaking because one usage breaks",
    annotation: "names the property and the channel (usage) or the component",
    sources: [
      usage,
      asd(
        "test/asyncapi/asyncapi3.test.ts H6 a message used by a send and a receive operation is breaking when either direction breaks",
      ),
      {
        tool: "fork",
        ref: "test/asyncapi.multiformat-schema.test.ts diffs for each scope are present for a change in shared payload",
      },
    ],
    docs: {
      "2.6": [
        users2(["publish", "subscribe"], obj({ a: { type: "string" } })),
        users2(["publish", "subscribe"], obj({ a: { type: "string" } }, ["a"])),
      ],
      "3.0": [
        users3(["receive", "send"], obj({ a: { type: "string" } })),
        users3(["receive", "send"], obj({ a: { type: "string" } }, ["a"])),
      ],
    },
    expect: {
      "2.6": [
        {
          at: "channels/user~1publish/**/required/**",
          action: "add",
          type: breaking,
          mentions: ["`a`", "user/publish"],
        },
        {
          at: "channels/user~1subscribe/**/required/**",
          action: "add",
          type: nonBreaking,
          mentions: ["`a`", "user/subscribe"],
        },
        { at: "components/schemas/User/required/**", action: "add", type: breaking, mentions: ["`a`", "User"] },
      ],
      "3.0": [
        { at: "channels/receiveUser/**/required/**", action: "add", type: breaking, mentions: ["`a`", "receiveUser"] },
        { at: "channels/sendUser/**/required/**", action: "add", type: nonBreaking, mentions: ["`a`", "sendUser"] },
        { at: "components/schemas/User/required/**", action: "add", type: breaking, mentions: ["`a`", "User"] },
      ],
    },
    // ISSUE-102 (fixed)
  },
  {
    kind: "doc",
    id: "AA-CMP-005",
    title: "AsyncAPI 3 property type changed in a schema shared by two channels",
    before: "channels a and b both send messages with payload $ref User (x string)",
    after: "User.x integer",
    rationale: "a type change breaks every usage; each usage site must describe its own channel",
    annotation: "names the property and the channel of each site (or the component)",
    sources: [usage, { tool: "bench", ref: "aa3-events A3 (User shared through components)" }],
    docs: [
      aa3(
        {
          a: { address: "a", messages: { m: { payload: ref("schemas/User") } } },
          b: { address: "b", messages: { m: { payload: ref("schemas/User") } } },
        },
        { onA: op3("send", "a", ["m"]), onB: op3("send", "b", ["m"]) },
        { schemas: { User: obj({ x: { type: "string" } }) } },
      ),
      aa3(
        {
          a: { address: "a", messages: { m: { payload: ref("schemas/User") } } },
          b: { address: "b", messages: { m: { payload: ref("schemas/User") } } },
        },
        { onA: op3("send", "a", ["m"]), onB: op3("send", "b", ["m"]) },
        { schemas: { User: obj({ x: { type: "integer" } }) } },
      ),
    ],
    expect: [
      {
        at: "channels/a/messages/m/payload/properties/x/type",
        action: "replace",
        type: breaking,
        mentions: ["`x`", "channel `a`"],
      },
      {
        at: "channels/b/messages/m/payload/properties/x/type",
        action: "replace",
        type: breaking,
        mentions: ["`x`", "channel `b`"],
      },
      { at: "components/schemas/User/properties/x/type", action: "replace", type: breaking, mentions: ["`x`", "User"] },
    ],
    // ISSUE-55 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CMP-006",
    title: "optional property added to a schema used only by a produced message",
    before: "User { a } used by subscribe (3.0: send)",
    after: "User { a, b }",
    rationale: "a new optional property is non-breaking in both directions",
    annotation: "names the property and the channel or the component",
    sources: [usage, { tool: "bench", ref: "aa2-events / aa3-events A4" }],
    docs: {
      "2.6": [
        users2(["subscribe"], obj({ a: { type: "string" } })),
        users2(["subscribe"], obj({ a: { type: "string" }, b: { type: "string" } })),
      ],
      "3.0": [
        users3(["send"], obj({ a: { type: "string" } })),
        users3(["send"], obj({ a: { type: "string" }, b: { type: "string" } })),
      ],
    },
    expect: [
      {
        at: ["channels/**/properties/b", "components/schemas/User/properties/b"],
        action: "add",
        type: nonBreaking,
        mentions: ["`b`", /user\/subscribe|sendUser|User/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-007",
    title: "required property removed from a schema used only by a produced message",
    before: "User { a, b } required [a, b] used by subscribe (3.0: send)",
    after: "User { a } required [a]",
    rationale: "consumers relying on b break (response semantics); the component follows its only usage",
    annotation: "names the property and the channel or the component",
    sources: [usage, { tool: "bench", ref: "aa2-events / aa3-events A5" }],
    docs: {
      "2.6": [
        users2(["subscribe"], obj({ a: { type: "string" }, b: { type: "string" } }, ["a", "b"])),
        users2(["subscribe"], obj({ a: { type: "string" } }, ["a"])),
      ],
      "3.0": [
        users3(["send"], obj({ a: { type: "string" }, b: { type: "string" } }, ["a", "b"])),
        users3(["send"], obj({ a: { type: "string" } }, ["a"])),
      ],
    },
    expect: [
      {
        at: ["channels/**/payload/**", "components/schemas/User/**"],
        action: "remove",
        type: breaking,
        mentions: ["`b`"],
      },
    ],
    // ISSUE-52 (fixed)
  },
  {
    kind: "doc",
    id: "AA-CMP-008",
    title: "enum value removed from a schema used only by a consumed message",
    before: "User.kind enum [a, b] used by publish (3.0: receive)",
    after: "User.kind enum [a]",
    rationale: "clients sending kind b are rejected (request semantics); the component follows its only usage",
    annotation: "names the property, the removed value and the channel or the component",
    sources: [usage, asd("test/asyncapi/edge-cases.test.ts publish payload removing an enum value is breaking")],
    docs: {
      "2.6": [
        users2(["publish"], obj({ kind: { type: "string", enum: ["alpha", "beta"] } })),
        users2(["publish"], obj({ kind: { type: "string", enum: ["alpha"] } })),
      ],
      "3.0": [
        users3(["receive"], obj({ kind: { type: "string", enum: ["alpha", "beta"] } })),
        users3(["receive"], obj({ kind: { type: "string", enum: ["alpha"] } })),
      ],
    },
    expect: [
      {
        at: ["channels/**/kind/enum/**", "components/schemas/User/properties/kind/enum/**"],
        action: "remove",
        type: breaking,
        mentions: ["kind", "beta"],
      },
    ],
    // ISSUE-52 (fixed): the 3.0 variant is classified like 2.6; both keep the enum description cause
    // ISSUE-57 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CMP-009",
    title: "transitively referenced component schema changed",
    before: "subscribe payload $ref Envelope, Envelope.user $ref User, User.name string",
    after: "User.name integer",
    rationale: "component-to-component references are followed: the type change breaks the usage, Envelope and User",
    annotation: "names the property path and the channel or the component",
    sources: [usage, asd("DESIGN_PROPOSALS §12.2 component-to-component references are followed transitively")],
    docs: [
      aa2(
        { "user/events": { subscribe: { message: { payload: ref("schemas/Envelope") } } } },
        { schemas: { Envelope: obj({ user: ref("schemas/User") }), User: obj({ name: { type: "string" } }) } },
      ),
      aa2(
        { "user/events": { subscribe: { message: { payload: ref("schemas/Envelope") } } } },
        { schemas: { Envelope: obj({ user: ref("schemas/User") }), User: obj({ name: { type: "integer" } }) } },
      ),
    ],
    expect: [
      {
        at: ["channels/**/name/type", "components/schemas/*/**/name/type"],
        action: "replace",
        type: breaking,
        mentions: ["name", /user\/events|Envelope|User/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-010",
    title: "component schema used as message headers changed",
    before: "subscribe message headers $ref components/schemas/Headers (trace string)",
    after: "Headers.trace integer",
    rationale: "a header type change breaks consumers; the component follows its usage",
    annotation: "names the header property and the channel or the component",
    sources: [usage, { tool: "bench", ref: "aa2-events A11" }],
    docs: [
      aa2(
        { "user/events": { subscribe: { message: { headers: ref("schemas/Headers"), payload: obj({}) } } } },
        { schemas: { Headers: obj({ trace: { type: "string" } }) } },
      ),
      aa2(
        { "user/events": { subscribe: { message: { headers: ref("schemas/Headers"), payload: obj({}) } } } },
        { schemas: { Headers: obj({ trace: { type: "integer" } }) } },
      ),
    ],
    expect: [
      {
        at: ["channels/**/headers/properties/trace/type", "components/schemas/Headers/properties/trace/type"],
        action: "replace",
        type: breaking,
        mentions: ["trace", /user\/events|Headers/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-011",
    title: "header type changed inside a components/messageTraits trait",
    before: "message traits [$ref components/messageTraits/Traced] (headers.trace string)",
    after: "Traced headers.trace integer",
    rationale: "the trait is applied to the message: the header type change breaks it; the component follows its usage",
    annotation: "names the header property and the channel (usage) or the trait component",
    sources: [
      usage,
      asd(
        "test/asyncapi/edge-cases.test.ts message trait $ref to components/messageTraits is classified at the usage path",
      ),
    ],
    docs: {
      "2.6": [
        aa2(
          { "user/events": { publish: { message: { traits: [ref("messageTraits/Traced")], payload: obj({}) } } } },
          { messageTraits: { Traced: { headers: obj({ trace: { type: "string" } }) } } },
        ),
        aa2(
          { "user/events": { publish: { message: { traits: [ref("messageTraits/Traced")], payload: obj({}) } } } },
          { messageTraits: { Traced: { headers: obj({ trace: { type: "integer" } }) } } },
        ),
      ],
      "3.0": [
        aa3(
          {
            userEvents: {
              address: "user/events",
              messages: { m: { traits: [ref("messageTraits/Traced")], payload: obj({}) } },
            },
          },
          { on: op3("receive", "userEvents", ["m"]) },
          { messageTraits: { Traced: { headers: obj({ trace: { type: "string" } }) } } },
        ),
        aa3(
          {
            userEvents: {
              address: "user/events",
              messages: { m: { traits: [ref("messageTraits/Traced")], payload: obj({}) } },
            },
          },
          { on: op3("receive", "userEvents", ["m"]) },
          { messageTraits: { Traced: { headers: obj({ trace: { type: "integer" } }) } } },
        ),
      ],
    },
    expect: [
      {
        at: [
          "channels/**/headers/properties/trace/type",
          "components/messageTraits/Traced/headers/properties/trace/type",
        ],
        action: "replace",
        type: breaking,
        mentions: ["trace", /user\/events|userEvents|Traced|component/],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CMP-012",
    title: "components/correlationIds location changed",
    before: "message correlationId $ref components/correlationIds/Req ($message.header#/requestId)",
    after: "Req location $message.header#/correlationId",
    rationale: "clients correlate by the documented location; the component follows its usage",
    annotation: "names location and the channel or the component",
    sources: [usage, asyncapiDiff("v2.ts /channels/*/subscribe/message/correlationId/location")],
    docs: [
      aa2(
        { "user/events": { subscribe: { message: { correlationId: ref("correlationIds/Req"), payload: obj({}) } } } },
        { correlationIds: { Req: { location: "$message.header#/requestId" } } },
      ),
      aa2(
        { "user/events": { subscribe: { message: { correlationId: ref("correlationIds/Req"), payload: obj({}) } } } },
        { correlationIds: { Req: { location: "$message.header#/correlationId" } } },
      ),
    ],
    expect: [
      {
        at: ["channels/**/correlationId/location", "components/correlationIds/Req/location"],
        action: "replace",
        type: breaking,
        mentions: ["location", /user\/events|Req/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-013",
    title: "components/operationTraits description changed",
    before: "operation traits [$ref components/operationTraits/Kafka] (description a)",
    after: "Kafka description b",
    rationale:
      "documentation only; POLICY-57 (decided after P3): an annotation-only change inside a component is reported at the component only",
    annotation: "names description and the operation or the trait component",
    sources: [usage, asyncapiDiff("v2.ts /channels/*/publish/traits/description")],
    docs: {
      "2.6": [
        aa2(
          { "user/events": { publish: { traits: [ref("operationTraits/Kafka")], message: { payload: obj({}) } } } },
          { operationTraits: { Kafka: { description: "Kafka operation" } } },
        ),
        aa2(
          { "user/events": { publish: { traits: [ref("operationTraits/Kafka")], message: { payload: obj({}) } } } },
          { operationTraits: { Kafka: { description: "A Kafka operation" } } },
        ),
      ],
      "3.0": [
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: obj({}) } } } },
          { on: op3("send", "userEvents", ["m"], { traits: [ref("operationTraits/Kafka")] }) },
          { operationTraits: { Kafka: { description: "Kafka operation" } } },
        ),
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: obj({}) } } } },
          { on: op3("send", "userEvents", ["m"], { traits: [ref("operationTraits/Kafka")] }) },
          { operationTraits: { Kafka: { description: "A Kafka operation" } } },
        ),
      ],
    },
    expect: [
      {
        at: [
          "channels/**/traits/0/description",
          "operations/on/traits/0/description",
          "components/operationTraits/Kafka/description",
        ],
        action: "replace",
        type: annotation,
        mentions: ["description", /publish|operations\.on|Kafka/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-014",
    title: "AsyncAPI 3 components/channels channel address changed",
    before: "channels.userEvents $ref components/channels/UserEvents (address user/events)",
    after: "UserEvents address user/events/v2",
    rationale: "the referenced channel's address is the one clients use",
    annotation: "names address and the channel",
    sources: [usage, asyncapiDiff("v3.ts /channels/*/address")],
    docs: [
      aa3(
        { userEvents: ref("channels/UserEvents") },
        { on: { action: "send", channel: { $ref: "#/channels/userEvents" } } },
        { channels: { UserEvents: { address: "user/events" } } },
      ),
      aa3(
        { userEvents: ref("channels/UserEvents") },
        { on: { action: "send", channel: { $ref: "#/channels/userEvents" } } },
        { channels: { UserEvents: { address: "user/events/v2" } } },
      ),
    ],
    expect: [
      {
        at: ["channels/userEvents/address", "components/channels/UserEvents/address"],
        action: "replace",
        type: breaking,
        mentions: ["address", /userEvents|UserEvents/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-015",
    title: "AsyncAPI 3 components/replyAddresses location changed",
    before: "reply.address $ref components/replyAddresses/ReplyTo ($message.header#/replyTo)",
    after: "ReplyTo location $message.header#/replyAddress",
    rationale: "requesters put the reply address where the before document said",
    annotation: "names location and the reply address of the operation or the component",
    sources: [
      usage,
      asyncapiDiff("v3.ts /operations/*/reply/address/location"),
      {
        tool: "fork",
        ref: "test/asyncapi.add-required-fields.test.ts adding location to replyAddress (invalid before document, see hand-back)",
      },
    ],
    docs: [
      aa3(
        { userEvents: { address: "user/events", messages: { m: { payload: obj({}) } } } },
        {
          on: op3("receive", "userEvents", ["m"], {
            reply: { address: ref("replyAddresses/ReplyTo"), messages: [{ $ref: "#/channels/userEvents/messages/m" }] },
          }),
        },
        { replyAddresses: { ReplyTo: { location: "$message.header#/replyTo" } } },
      ),
      aa3(
        { userEvents: { address: "user/events", messages: { m: { payload: obj({}) } } } },
        {
          on: op3("receive", "userEvents", ["m"], {
            reply: { address: ref("replyAddresses/ReplyTo"), messages: [{ $ref: "#/channels/userEvents/messages/m" }] },
          }),
        },
        { replyAddresses: { ReplyTo: { location: "$message.header#/replyAddress" } } },
      ),
    ],
    expect: [
      {
        at: ["operations/on/reply/address/location", "components/replyAddresses/ReplyTo/location"],
        action: "replace",
        type: breaking,
        // the operation named as a container (P8a) or by its path
        mentions: ["location", /operations\.on|operation `on`|ReplyTo/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-016",
    title: "security scheme type changed",
    before: "components.securitySchemes.auth type userPassword (used by the server / operation)",
    after: "auth type X509",
    rationale:
      "clients authenticating with a password are rejected (ASD OpenAPI: securitySchemes type change breaking)",
    annotation: "names type and the security scheme",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/what_changed_test.go TestCompareDocuments_SecuritySchemeTypeChange" },
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareSecuritySchemes_TypeModifiedBreaking",
      },
      asd("src/openapi/openapi3.rules.ts securitySchemeRules /type breaking"),
      {
        tool: "fork",
        ref: "test/asyncapi.add-required-fields.test.ts securitySchemes (invalid before documents, see hand-back)",
      },
    ],
    docs: {
      "2.6": [
        {
          asyncapi: "2.6.0",
          info,
          servers: { prod: { url: "broker.example.com:9092", protocol: "kafka", security: [{ auth: [] }] } },
          channels: {},
          components: { securitySchemes: { auth: { type: "userPassword" } } },
        },
        {
          asyncapi: "2.6.0",
          info,
          servers: { prod: { url: "broker.example.com:9092", protocol: "kafka", security: [{ auth: [] }] } },
          channels: {},
          components: { securitySchemes: { auth: { type: "X509" } } },
        },
      ],
      "3.0": [
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: obj({}) } } } },
          { on: op3("send", "userEvents", ["m"], { security: [ref("securitySchemes/auth")] }) },
          { securitySchemes: { auth: { type: "userPassword" } } },
        ),
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: obj({}) } } } },
          { on: op3("send", "userEvents", ["m"], { security: [ref("securitySchemes/auth")] }) },
          { securitySchemes: { auth: { type: "X509" } } },
        ),
      ],
    },
    expect: [
      {
        at: ["components/securitySchemes/auth/type", "operations/on/security/**"],
        action: "replace",
        type: breaking,
        mentions: ["type", "auth"],
      },
    ],
    // ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-CMP-017",
    title: "security scheme description added",
    before: "securitySchemes.auth without description",
    after: "securitySchemes.auth described",
    rationale: "documentation only",
    annotation: "names description and the security scheme",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareSecuritySchemes_DescriptionNotBreaking",
      },
      asd("src/openapi/openapi3.rules.ts securitySchemeRules /description annotation"),
    ],
    docs: {
      "2.6": [
        aa2({}, { securitySchemes: { auth: { type: "userPassword" } } }),
        aa2({}, { securitySchemes: { auth: { type: "userPassword", description: "Broker credentials" } } }),
      ],
      "3.0": [
        aa3({}, {}, { securitySchemes: { auth: { type: "userPassword" } } }),
        aa3({}, {}, { securitySchemes: { auth: { type: "userPassword", description: "Broker credentials" } } }),
      ],
    },
    expect: [
      {
        at: "components/securitySchemes/auth/description",
        action: "add",
        type: annotation,
        mentions: ["description", "auth"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-018",
    title: "OAuth2 flow scope removed from a security scheme",
    before: "oauth clientCredentials scopes { read, write }",
    after: "oauth clientCredentials scopes { read }",
    rationale:
      "clients requesting the write scope are refused (ASD OpenAPI: scope removal breaking, addition non-breaking)",
    annotation: "names the scope and the security scheme",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareOAuthFlow_AvailableScopesChanges scope removed",
      },
      asd("src/openapi/openapi3.rules.ts oauthFlowRules /scopes"),
    ],
    docs: (() => {
      const oauth = (scopes: "scopes" | "availableScopes", values: Record<string, string>) => ({
        oauth: {
          type: "oauth2",
          flows: { clientCredentials: { tokenUrl: "https://auth.example.com/token", [scopes]: values } },
        },
      })
      return schemeDocs({
        "2.6": [oauth("scopes", { read: "Read", write: "Write" }), oauth("scopes", { read: "Read" })],
        "3.0": [oauth("availableScopes", { read: "Read", write: "Write" }), oauth("availableScopes", { read: "Read" })],
      })
    })(),
    expect: [
      {
        at: [
          "components/securitySchemes/oauth/flows/clientCredentials/*/write",
          "servers/prod/security/*/flows/clientCredentials/*/write",
        ],
        action: "remove",
        type: whenUsed(breaking),
        mentions: ["write", "oauth"],
      },
    ],
    // ISSUE-101 (fixed); POLICY-80 decided (a) (P8a): unclassified where nothing references the scheme
  },
  {
    kind: "doc",
    id: "AA-CMP-019",
    title: "OAuth2 flow tokenUrl changed",
    before: "tokenUrl https://auth.example.com/token",
    after: "tokenUrl https://sso.example.com/token",
    rationale:
      "clients fetch tokens from the documented URL and fail if it stops serving (decision §11.14, POLICY-05: risky, as OAS-SEC-035 and AA-LAA-029; aligned in P6, the case predated the decision)",
    annotation: "names tokenUrl and the security scheme",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/model/coverage_test.go TestCompareOAuthFlow_TokenURLModifiedBreaking" },
      asd("src/openapi/openapi3.rules.ts oauthFlowRules /tokenUrl"),
    ],
    docs: (() => {
      const oauth = (url: string) => ({
        oauth: { type: "oauth2", flows: { clientCredentials: { tokenUrl: url, scopes: {} } } },
      })
      return schemeDocs({ "2.6": [oauth("https://auth.example.com/token"), oauth("https://sso.example.com/token")] })
    })(),
    expect: [
      {
        at: "components/securitySchemes/oauth/flows/clientCredentials/tokenUrl",
        action: "replace",
        type: whenUsed(risky),
        mentions: ["tokenUrl", "oauth"],
      },
    ],
    // ISSUE-101 (fixed); POLICY-80 decided (a) (P8a): unclassified where nothing references the scheme
  },
  {
    kind: "doc",
    id: "AA-CMP-020",
    title: "component schema renamed with every reference updated",
    before: "payload $ref components/schemas/User",
    after: "payload $ref components/schemas/Account (same content)",
    rationale: "the messages on the wire are unchanged; a component key is a document-internal name",
    annotation: "one rename annotation at the schemas map naming the old and the new component (POLICY-100)",
    sources: [usage, { tool: "fork", ref: "test/asyncapi.firstReferenceKeyMapping.test.ts (key-based mapping)" }],
    docs: {
      "2.6": [
        aa2(
          { "user/events": { subscribe: { message: { payload: ref("schemas/User") } } } },
          { schemas: { User: obj({ a: { type: "string" } }) } },
        ),
        aa2(
          { "user/events": { subscribe: { message: { payload: ref("schemas/Account") } } } },
          { schemas: { Account: obj({ a: { type: "string" } }) } },
        ),
      ],
      "3.0": [
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: ref("schemas/User") } } } },
          { on: op3("send", "userEvents", ["m"]) },
          { schemas: { User: obj({ a: { type: "string" } }) } },
        ),
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: ref("schemas/Account") } } } },
          { on: op3("send", "userEvents", ["m"]) },
          { schemas: { Account: obj({ a: { type: "string" } }) } },
        ),
      ],
    },
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["schema component", "User", "Account"],
      },
    ],
    // ISSUE-78 (fixed) (P8-rest); POLICY-100 decided (P8c): the former expectation was an optional annotation removal
    // plus addition at the component entries
  },
  {
    kind: "doc",
    id: "AA-CMP-021",
    title: "components opt-out: component sites unclassified, usage sites classified",
    before: "subscribe (3.0: send) payload $ref User (name string)",
    after: "User.name integer, compared with options.components = unclassified",
    rationale:
      "decision §11.4: the opt-out leaves component sites unclassified; the usage site (2.x operation, 3.0 channel message) keeps its classification",
    annotation: "names the property and the channel or the component",
    sources: [usage, asd("src/core/diff.ts options.components === unclassified")],
    compareOptions: { components: "unclassified" },
    docs: {
      "2.6": [
        users2(["subscribe"], obj({ name: { type: "string" } })),
        users2(["subscribe"], obj({ name: { type: "integer" } })),
      ],
      "3.0": [
        users3(["send"], obj({ name: { type: "string" } })),
        users3(["send"], obj({ name: { type: "integer" } })),
      ],
    },
    expect: [
      {
        at: "channels/**/name/type",
        action: "replace",
        type: breaking,
        mentions: ["name", /user\/subscribe|sendUser/],
      },
      {
        at: "components/schemas/User/properties/name/type",
        action: "replace",
        type: unclassified,
        mentions: ["name", "User"],
      },
    ],
    // ISSUE-107 (fixed): the opt-out covers the `components` section only (P8a)
  },
  // ---------------------------------------------------------------------------------------------------------------
  // POLICY-101 (P8c): a component renamed and changed at once is paired by its reference sites
  {
    kind: "doc",
    id: "AA-CMP-022",
    title: "component schema renamed with every reference repointed and a compatible change",
    before: "payload $ref components/schemas/User { a }",
    after: "payload $ref components/schemas/Account { a, b } (User removed)",
    rationale:
      "POLICY-101: every reference moved from User to Account, so the key change is one rename annotation; the definitions are compared on their own: an optional property added is non-breaking, at the declaration and at the usage",
    annotation: "names both component names for the rename; the added property with the component or the channel",
    sources: [usage, asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101")],
    docs: {
      "2.6": [
        aa2(
          { "user/events": { subscribe: { message: { payload: ref("schemas/User") } } } },
          { schemas: { User: obj({ a: { type: "string" } }) } },
        ),
        aa2(
          { "user/events": { subscribe: { message: { payload: ref("schemas/Account") } } } },
          { schemas: { Account: obj({ a: { type: "string" }, b: { type: "string" } }) } },
        ),
      ],
      "3.0": [
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: ref("schemas/User") } } } },
          { on: op3("send", "userEvents", ["m"]) },
          { schemas: { User: obj({ a: { type: "string" } }) } },
        ),
        aa3(
          { userEvents: { address: "user/events", messages: { m: { payload: ref("schemas/Account") } } } },
          { on: op3("send", "userEvents", ["m"]) },
          { schemas: { Account: obj({ a: { type: "string" }, b: { type: "string" } }) } },
        ),
      ],
    },
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["User", "Account"] },
      { at: "components/schemas/User/properties/b", action: "add", type: nonBreaking, count: 1, mentions: ["b"] },
      {
        at: [
          "channels/user~1events/subscribe/message/payload/properties/b",
          "channels/userEvents/messages/m/payload/properties/b",
        ],
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["b", "channel"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-023",
    title: "component message renamed with every reference repointed and a breaking change",
    before: "channel message $ref components/messages/SignupV1 (payload userId string)",
    after: "channel message $ref components/messages/SignupV2 (payload userId integer; SignupV1 removed)",
    rationale:
      "POLICY-101: the rename is an annotation; the payload property type change breaks the consumers of a produced message and the producers of a consumed one",
    annotation: "names both component names for the rename; the changed property with the component or the channel",
    sources: [usage, asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101")],
    docs: (() => {
      const msg = (type: string) => ({ payload: obj({ userId: { type } }) })
      const v2 = (op: "publish" | "subscribe", name: string, type: string) =>
        aa2({ "user/signup": { [op]: { message: ref(`messages/${name}`) } } }, { messages: { [name]: msg(type) } })
      const v3 = (action: "send" | "receive", name: string, type: string) =>
        aa3(
          { userSignup: { address: "user/signup", messages: { signup: ref(`messages/${name}`) } } },
          { onSignup: op3(action, "userSignup", ["signup"]) },
          { messages: { [name]: msg(type) } },
        )
      return {
        "2.6-pub": [v2("publish", "SignupV1", "string"), v2("publish", "SignupV2", "integer")],
        "2.6-sub": [v2("subscribe", "SignupV1", "string"), v2("subscribe", "SignupV2", "integer")],
        "3.0-send": [v3("send", "SignupV1", "string"), v3("send", "SignupV2", "integer")],
        "3.0-receive": [v3("receive", "SignupV1", "string"), v3("receive", "SignupV2", "integer")],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: [
      { at: "components/messages", action: "rename", type: annotation, count: 1, mentions: ["SignupV1", "SignupV2"] },
      {
        at: "components/messages/SignupV1/payload/properties/userId/type",
        action: "replace",
        type: breaking,
        count: 1,
        mentions: ["userId"],
      },
      {
        at: "channels/**/payload/properties/userId/type",
        action: "replace",
        type: breaking,
        count: 1,
        mentions: ["userId", "channel"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-024",
    title: "component schema renamed with only some references repointed is not a rename",
    before: "two channels' payloads $ref components/schemas/User { a }",
    after: "one payload $ref Account { a, b }, the other an inline copy of User (User removed)",
    rationale:
      "POLICY-101: the references of Account are not those of User and the definitions differ, so User is removed (breaking: a consumed message loses its declaration) and Account is added; the usages report their own changes",
    annotation: "names the removed and the added component",
    sources: [usage, asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101")],
    docs: {
      "2.6": [
        aa2(
          {
            "user/a": { subscribe: { message: { payload: ref("schemas/User") } } },
            "user/b": { publish: { message: { payload: ref("schemas/User") } } },
          },
          { schemas: { User: obj({ a: { type: "string" } }) } },
        ),
        aa2(
          {
            "user/a": { subscribe: { message: { payload: ref("schemas/Account") } } },
            "user/b": { publish: { message: { payload: obj({ a: { type: "string" } }) } } },
          },
          { schemas: { Account: obj({ a: { type: "string" }, b: { type: "string" } }) } },
        ),
      ],
      "3.0": [
        aa3(
          {
            a: { address: "a", messages: { m: { payload: ref("schemas/User") } } },
            b: { address: "b", messages: { m: { payload: ref("schemas/User") } } },
          },
          { oa: op3("send", "a", ["m"]), ob: op3("receive", "b", ["m"]) },
          { schemas: { User: obj({ a: { type: "string" } }) } },
        ),
        aa3(
          {
            a: { address: "a", messages: { m: { payload: ref("schemas/Account") } } },
            b: { address: "b", messages: { m: { payload: obj({ a: { type: "string" } }) } } },
          },
          { oa: op3("send", "a", ["m"]), ob: op3("receive", "b", ["m"]) },
          { schemas: { Account: obj({ a: { type: "string" }, b: { type: "string" } }) } },
        ),
      ],
    },
    expect: [
      { at: "components/schemas/User", action: "remove", type: breaking, count: 1, mentions: ["User"] },
      { at: "components/schemas/Account", action: "add", type: nonBreaking, count: 1, mentions: ["Account"] },
      {
        at: ["channels/user~1a/subscribe/message/payload/properties/b", "channels/a/messages/m/payload/properties/b"],
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["b"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CMP-025",
    title: "security scheme renamed with every requirement repointed, unchanged or with a breaking change",
    before: "scheme apiKey (httpApiKey header X-API-Key), server prod security [apiKey]",
    after: "scheme key2 (same, or header X-Key), server prod security [key2]",
    rationale:
      "POLICY-101: every requirement moved from apiKey to key2 (2.x requirement keys, 3.0 `$ref`s), so the key change is a rename annotation, in the scheme map and in the 2.x requirement; the definitions are compared on their own: a changed header name is breaking (a 3.0 repointed `$ref` is no change, POLICY-100)",
    annotation: "names both scheme names for the renames; the changed header name with the scheme",
    sources: [usage, asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-100 / POLICY-101")],
    docs: (() => {
      const key = (name: string) => ({ type: "httpApiKey", name, in: "header" })
      const docs: Record<string, [unknown, unknown]> = {}
      for (const [variant, header] of [
        ["same", "X-API-Key"],
        ["changed", "X-Key"],
      ] as const) {
        docs[`2.6 ${variant}`] = [schemes2({ apiKey: key("X-API-Key") }, true), schemes2({ key2: key(header) }, true)]
        docs[`3.0 ${variant}`] = [schemes3({ apiKey: key("X-API-Key") }, true), schemes3({ key2: key(header) }, true)]
      }
      return docs
    })(),
    expect: (() => {
      const map = {
        at: "components/securitySchemes",
        action: "rename" as const,
        type: annotation,
        count: 1,
        mentions: ["security scheme component", "apiKey", "key2"],
      }
      // 2.x requirements name the scheme: the requirement key is renamed too
      const requirement = {
        at: "servers/prod/security/0",
        action: "rename" as const,
        type: annotation,
        count: 1,
        mentions: ["apiKey", "key2", "server `prod`"],
      }
      const header = {
        at: "components/securitySchemes/apiKey/name",
        action: "replace" as const,
        type: breaking,
        count: 1,
        mentions: ["name", "X-API-Key", "X-Key"],
      }
      return {
        "2.6 same": [map, requirement],
        "3.0 same": [map],
        "2.6 changed": [map, requirement, header],
        "3.0 changed": [map, header],
      }
    })(),
  },
  // POLICY-105 decided (P8d): a removed and an added component are also a rename when more than 50 % of the direct
  // fields of their definitions are equal
  {
    kind: "doc",
    id: "AA-CMP-026",
    title: "component schema renamed with only some references repointed and most direct fields kept is a rename",
    before: "two channels' payloads $ref components/schemas/User { a } (required a)",
    after: "one payload $ref Account { a, b } (required a), the other an inline copy of User (User removed)",
    rationale:
      "POLICY-105: 2 of the 3 direct fields are equal (`type`, `required`; `properties` differs), so User was renamed to Account although one usage now inlines the schema (POLICY-101 alone: no rename): one rename annotation, the added optional property of a produced message non-breaking at the declaration and at the usage; the inline copy is no change",
    annotation: "names both component names for the rename; the added property",
    sources: [usage, asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-105")],
    docs: {
      "2.6": [
        aa2(
          {
            "user/a": { subscribe: { message: { payload: ref("schemas/User") } } },
            "user/b": { publish: { message: { payload: ref("schemas/User") } } },
          },
          { schemas: { User: obj({ a: { type: "string" } }, ["a"]) } },
        ),
        aa2(
          {
            "user/a": { subscribe: { message: { payload: ref("schemas/Account") } } },
            "user/b": { publish: { message: { payload: obj({ a: { type: "string" } }, ["a"]) } } },
          },
          { schemas: { Account: obj({ a: { type: "string" }, b: { type: "string" } }, ["a"]) } },
        ),
      ],
      "3.0": [
        aa3(
          {
            a: { address: "a", messages: { m: { payload: ref("schemas/User") } } },
            b: { address: "b", messages: { m: { payload: ref("schemas/User") } } },
          },
          { oa: op3("send", "a", ["m"]), ob: op3("receive", "b", ["m"]) },
          { schemas: { User: obj({ a: { type: "string" } }, ["a"]) } },
        ),
        aa3(
          {
            a: { address: "a", messages: { m: { payload: ref("schemas/Account") } } },
            b: { address: "b", messages: { m: { payload: obj({ a: { type: "string" } }, ["a"]) } } },
          },
          { oa: op3("send", "a", ["m"]), ob: op3("receive", "b", ["m"]) },
          { schemas: { Account: obj({ a: { type: "string" }, b: { type: "string" } }, ["a"]) } },
        ),
      ],
    },
    expect: [
      { at: "components/schemas", action: "rename", type: annotation, count: 1, mentions: ["User", "Account"] },
      {
        at: "components/schemas/User/properties/b",
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["b", "Account"],
      },
      {
        at: ["channels/user~1a/subscribe/message/payload/properties/b", "channels/a/messages/m/payload/properties/b"],
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["b"],
      },
    ],
  },
  // POLICY-111 decided (changed, P8e): the similarity rule applies to unreferenced entries too
  {
    kind: "doc",
    id: "AA-CMP-027",
    title: "unreferenced component schema replaced by one that keeps most of its direct fields is a rename",
    before: "components-only document: User { a string } (description) referenced by nothing",
    after: "Account { a integer } (same description), referenced by nothing (User removed)",
    rationale:
      "POLICY-111: 2 of the 3 direct fields are equal (`type`, `description`), so User was renamed to Account although neither is referenced (before P8e: a removal plus an addition); the rename and the content change are unclassified, as every change of an unreferenced component (ISSUE-143)",
    annotation: "names both component names for the rename; the changed property with the new and the old key",
    sources: [asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-111")],
    docs: (() => {
      const user = (type: string) => ({ ...obj({ a: { type } }), description: "a user" })
      return {
        "2.6": [aa2({}, { schemas: { User: user("string") } }), aa2({}, { schemas: { Account: user("integer") } })],
        "3.0": [
          aa3({}, {}, { schemas: { User: user("string") } }),
          aa3({}, {}, { schemas: { Account: user("integer") } }),
        ],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: [
      { at: "components/schemas", action: "rename", type: unclassified, count: 1, mentions: ["User", "Account"] },
      {
        at: "components/schemas/User/properties/a/type",
        action: "replace",
        type: unclassified,
        count: 1,
        mentions: ["`Account` (renamed from `User`)"],
      },
    ],
  },
  // POLICY-113 decided (changed, P8e): fields are compared with the renames found so far applied (cascading renames)
  {
    kind: "doc",
    id: "AA-CMP-028",
    title: "component schema renamed together with the schema it references (cascading rename)",
    before: "two channels' payloads $ref A { next: $ref B }; B { id }",
    after: "one payload $ref A2 { next: $ref B2 }, the other an inline copy of A2; B2 an identical copy of B",
    rationale:
      "POLICY-113: B2 is B renamed (deep-equal); A keeps `type` and `properties` differs only by the reference repointed through that rename, so A was renamed to A2 although one usage now inlines the schema (before P8e: 1 of 2 fields, A removed and A2 added); no content change",
    annotation: "names both component names of each rename",
    sources: [asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-113")],
    docs: (() => {
      const holder = (to: string) => obj({ next: ref(`schemas/${to}`) })
      const leaf = { ...obj({ id: { type: "integer" } }), title: "leaf" }
      const ops = { oa: op3("send", "a", ["m"]), ob: op3("receive", "b", ["m"]) }
      return {
        "2.6": [
          aa2(
            {
              "u/a": { subscribe: { message: { payload: ref("schemas/A") } } },
              "u/b": { publish: { message: { payload: ref("schemas/A") } } },
            },
            { schemas: { A: holder("B"), B: leaf } },
          ),
          aa2(
            {
              "u/a": { subscribe: { message: { payload: ref("schemas/A2") } } },
              "u/b": { publish: { message: { payload: holder("B2") } } },
            },
            { schemas: { A2: holder("B2"), B2: leaf } },
          ),
        ],
        "3.0": [
          aa3(
            {
              a: { address: "a", messages: { m: { payload: ref("schemas/A") } } },
              b: { address: "b", messages: { m: { payload: ref("schemas/A") } } },
            },
            ops,
            { schemas: { A: holder("B"), B: leaf } },
          ),
          aa3(
            {
              a: { address: "a", messages: { m: { payload: ref("schemas/A2") } } },
              b: { address: "b", messages: { m: { payload: holder("B2") } } },
            },
            ops,
            { schemas: { A2: holder("B2"), B2: leaf } },
          ),
        ],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: [
      {
        at: "components/schemas",
        action: "rename",
        type: annotation,
        count: 2,
        mentions: [/`A` to `A2`|`B` to `B2`/],
      },
    ],
  },
]

runCases("asyncapi", "components", cases, import.meta.filename)
