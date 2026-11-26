// AsyncAPI bindings (server, channel, operation, message; inline and through components/*Bindings) and traits (2.x / 3.0 operation and message traits). Bindings are protocol-specific: every tool reports their changes unclassified, except Schema-valued binding fields (POLICY-19, decided (b)). Traits are merged into the object they apply to (2.6 §Operation / Message Object `traits`, 3.0 §Operation Trait / Message Trait), so the effective object is what clients see (ISSUE-103).

import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const payload = { type: "object", properties: { userId: { type: "string" } } }
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties })

const aa2 = (channel: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  asyncapi: "2.6.0",
  info,
  channels: { "user/events": channel },
  ...extra,
})
const aa3 = (
  channel: Record<string, unknown>,
  operation: Record<string, unknown> = {},
  message: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) => ({
  asyncapi: "3.0.0",
  info,
  channels: { userEvents: { address: "user/events", messages: { event: { payload, ...message } }, ...channel } },
  operations: {
    onEvent: {
      action: "send",
      channel: { $ref: "#/channels/userEvents" },
      messages: [{ $ref: "#/channels/userEvents/messages/event" }],
      ...operation,
    },
  },
  ...extra,
})
const sub2 = (
  op: Record<string, unknown> = {},
  message: Record<string, unknown> = {},
  channel: Record<string, unknown> = {},
) => aa2({ ...channel, subscribe: { message: { payload, ...message }, ...op } })
const pub2 = (op: Record<string, unknown> = {}, message: Record<string, unknown> = {}) =>
  aa2({ publish: { message: { payload, ...message }, ...op } })
const recv3 = (operation: Record<string, unknown> = {}, message: Record<string, unknown> = {}) =>
  aa3({}, { action: "receive", ...operation }, message)

const CH = /user\/events|userEvents/
const asyncapiDiff = (ref: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string) => ({ tool: "asd", ref })

// POLICY-19 decided (b): binding fields that the AsyncAPI bindings specifications define as Schema Objects (ws / http
// query and headers, kafka key, groupId, clientId) are compared with the JSON Schema rules of the enclosing direction;
// other binding fields stay unclassified with a description (decision §11.21)

const cases: CompatCase[] = [
  // ---- bindings
  {
    kind: "doc",
    id: "AA-BND-001",
    title: "channel binding added",
    before: "channel without bindings",
    after: "channel bindings.kafka { topic, partitions }",
    rationale: "bindings are protocol-specific; every tool reports them unclassified",
    annotation: "names the binding protocol and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/bindings", "unclassified"),
      asyncapiDiff("v3.ts /channels/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [sub2(), sub2({}, {}, { bindings: { kafka: { topic: "user-events", partitions: 3 } } })],
      "3.0": [aa3({}), aa3({ bindings: { kafka: { topic: "user-events", partitions: 3 } } })],
    },
    expect: [
      {
        at: ["channels/*/bindings", "channels/*/bindings/**"],
        action: "add",
        type: unclassified,
        mentions: [/bindings|kafka/, CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-BND-002",
    title: "channel binding value changed",
    before: "bindings.kafka.partitions 3",
    after: "bindings.kafka.partitions 6",
    rationale: "protocol-specific configuration; unclassified with a description",
    annotation: "names the binding field, the protocol and the channel",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/what_changed_test.go TestCompareDocuments_ChannelBindingChanges kafka partitions",
        verdict: "breaking",
      },
      asyncapiDiff("v2.ts /channels/*/bindings", "unclassified"),
      asyncapiDiff("v3.ts /channels/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [
        sub2({}, {}, { bindings: { kafka: { partitions: 3 } } }),
        sub2({}, {}, { bindings: { kafka: { partitions: 6 } } }),
      ],
      "3.0": [aa3({ bindings: { kafka: { partitions: 3 } } }), aa3({ bindings: { kafka: { partitions: 6 } } })],
    },
    expect: [
      {
        at: "channels/*/bindings/kafka/partitions",
        action: "replace",
        type: unclassified,
        mentions: ["partitions", "kafka", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-BND-003",
    title: "operation binding value changed",
    before: "operation bindings.mqtt.qos 1",
    after: "operation bindings.mqtt.qos 2",
    rationale: "protocol-specific configuration; unclassified with a description",
    annotation: "names the binding field, the protocol and the operation",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/what_changed_test.go TestCompareDocuments_OperationChanges mqtt-operation qos",
        verdict: "breaking",
      },
      asyncapiDiff("v2.ts /channels/*/subscribe/bindings", "unclassified"),
      asyncapiDiff("v3.ts /operations/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [sub2({ bindings: { mqtt: { qos: 1 } } }), sub2({ bindings: { mqtt: { qos: 2 } } })],
      "3.0": [aa3({}, { bindings: { mqtt: { qos: 1 } } }), aa3({}, { bindings: { mqtt: { qos: 2 } } })],
    },
    expect: [
      {
        at: ["channels/*/subscribe/bindings/mqtt/qos", "operations/onEvent/bindings/mqtt/qos"],
        action: "replace",
        type: unclassified,
        mentions: ["qos", "mqtt", /subscribe|onEvent/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-BND-004",
    title: "operation binding removed",
    before: "operation bindings.amqp { expiration: 100000 }",
    after: "operation without bindings",
    rationale: "protocol-specific configuration; unclassified with a description",
    annotation: "names bindings and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/publish/bindings", "unclassified"),
      asyncapiDiff("v3.ts /operations/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [pub2({ bindings: { amqp: { expiration: 100000 } } }), pub2()],
      "3.0": [recv3({ bindings: { amqp: { expiration: 100000 } } }), recv3()],
    },
    expect: [
      {
        at: [
          "channels/*/publish/bindings",
          "channels/*/publish/bindings/**",
          "operations/onEvent/bindings",
          "operations/onEvent/bindings/**",
        ],
        action: "remove",
        type: unclassified,
        mentions: [/bindings|amqp/, /publish|onEvent/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-BND-005",
    title: "message binding version changed",
    before: "message bindings.kafka.bindingVersion 0.4.0",
    after: "message bindings.kafka.bindingVersion 0.5.0",
    rationale: "protocol-specific; unclassified with a description",
    annotation: "names bindingVersion, the protocol and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message/bindings", "unclassified"),
      asyncapiDiff("v3.ts /channels/*/messages/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [
        sub2({}, { bindings: { kafka: { bindingVersion: "0.4.0" } } }),
        sub2({}, { bindings: { kafka: { bindingVersion: "0.5.0" } } }),
      ],
      "3.0": [
        aa3({}, {}, { bindings: { kafka: { bindingVersion: "0.4.0" } } }),
        aa3({}, {}, { bindings: { kafka: { bindingVersion: "0.5.0" } } }),
      ],
    },
    expect: [
      {
        at: "channels/**/bindings/kafka/bindingVersion",
        action: "replace",
        type: unclassified,
        mentions: ["bindingVersion", "kafka", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-BND-006",
    title: "server binding value changed",
    before: "server bindings.kafka.schemaRegistryUrl https://a.example.com",
    after: "server bindings.kafka.schemaRegistryUrl https://b.example.com",
    rationale: "protocol-specific; unclassified with a description",
    annotation: "names the binding field, the protocol and the server",
    sources: [
      asyncapiDiff("v2.ts /servers/*/bindings", "unclassified"),
      asyncapiDiff("v3.ts /servers/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [
        {
          asyncapi: "2.6.0",
          info,
          channels: {},
          servers: {
            prod: {
              url: "broker.example.com:9092",
              protocol: "kafka",
              bindings: { kafka: { schemaRegistryUrl: "https://a.example.com" } },
            },
          },
        },
        {
          asyncapi: "2.6.0",
          info,
          channels: {},
          servers: {
            prod: {
              url: "broker.example.com:9092",
              protocol: "kafka",
              bindings: { kafka: { schemaRegistryUrl: "https://b.example.com" } },
            },
          },
        },
      ],
      "3.0": [
        {
          asyncapi: "3.0.0",
          info,
          channels: {},
          operations: {},
          servers: {
            prod: {
              host: "broker.example.com:9092",
              protocol: "kafka",
              bindings: { kafka: { schemaRegistryUrl: "https://a.example.com" } },
            },
          },
        },
        {
          asyncapi: "3.0.0",
          info,
          channels: {},
          operations: {},
          servers: {
            prod: {
              host: "broker.example.com:9092",
              protocol: "kafka",
              bindings: { kafka: { schemaRegistryUrl: "https://b.example.com" } },
            },
          },
        },
      ],
    },
    expect: [
      {
        at: "servers/prod/bindings/kafka/schemaRegistryUrl",
        action: "replace",
        type: unclassified,
        mentions: ["schemaRegistryUrl", "kafka", "prod"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-BND-007",
    title: "channel binding changed through a components/channelBindings $ref",
    before: "channel bindings $ref components/channelBindings/Kafka (partitions 3)",
    after: "Kafka partitions 6",
    rationale:
      "the referenced binding is the channel's binding: unclassified at the usage and at the component, like an inline binding",
    annotation: "names the binding field and the channel or the component",
    sources: [
      asyncapiDiff("v2.ts /channels/*/bindings", "unclassified"),
      asyncapiDiff("v3.ts /channels/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [
        sub2({}, {}, { bindings: { $ref: "#/components/channelBindings/Kafka" } }),
        sub2({}, {}, { bindings: { $ref: "#/components/channelBindings/Kafka" } }),
      ].map((d, i) => ({ ...d, components: { channelBindings: { Kafka: { kafka: { partitions: i ? 6 : 3 } } } } })) as [
        unknown,
        unknown,
      ],
      "3.0": [
        aa3(
          { bindings: { $ref: "#/components/channelBindings/Kafka" } },
          {},
          {},
          { components: { channelBindings: { Kafka: { kafka: { partitions: 3 } } } } },
        ),
        aa3(
          { bindings: { $ref: "#/components/channelBindings/Kafka" } },
          {},
          {},
          { components: { channelBindings: { Kafka: { kafka: { partitions: 6 } } } } },
        ),
      ],
    },
    expect: [
      {
        at: "channels/*/bindings/kafka/partitions",
        action: "replace",
        type: unclassified,
        mentions: ["partitions", CH],
      },
      {
        at: "components/channelBindings/Kafka/kafka/partitions",
        action: "replace",
        type: unclassified,
        mentions: ["partitions", "Kafka"],
      },
    ],
    // ISSUE-108 (fixed)
  },
  {
    kind: "doc",
    id: "AA-BND-008",
    title: "WebSockets channel binding query property type changed",
    before: "bindings.ws.query { token: string }",
    after: "bindings.ws.query { token: integer }",
    rationale:
      "the ws binding query is a Schema Object clients fill when opening the connection; a type change breaks them. Proposed option (b)",
    annotation: "names the query property, the binding and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/bindings", "unclassified"),
      asd("src/asyncapi/asyncapi2.rules.ts bindingsRule /query schema rules"),
    ],
    docs: {
      "2.6": [
        sub2({}, {}, { bindings: { ws: { query: obj({ token: { type: "string" } }) } } }),
        sub2({}, {}, { bindings: { ws: { query: obj({ token: { type: "integer" } }) } } }),
      ],
      "3.0": [
        aa3({ bindings: { ws: { query: obj({ token: { type: "string" } }) } } }),
        aa3({ bindings: { ws: { query: obj({ token: { type: "integer" } }) } } }),
      ],
    },
    expect: [
      {
        at: "channels/*/bindings/ws/query/properties/token/type",
        action: "replace",
        type: breaking,
        mentions: ["token", "ws", CH],
      },
    ],
    // ISSUE-139 (fixed), ISSUE-114 (fixed) (P6: binding schema descriptions); POLICY-19 decided (b)
  },
  {
    kind: "doc",
    id: "AA-BND-009",
    title: "HTTP message binding headers property type changed",
    before: "message bindings.http.headers { X-Trace: string }",
    after: "message bindings.http.headers { X-Trace: integer }",
    rationale:
      "the http message binding headers is a Schema Object; a type change breaks producers and consumers. Proposed option (b)",
    annotation: "names the header, the binding and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message/bindings", "unclassified"),
      asd("src/asyncapi/asyncapi2.rules.ts bindingsRule /headers schema rules"),
    ],
    docs: {
      "2.6": [
        sub2({}, { bindings: { http: { headers: obj({ "X-Trace": { type: "string" } }) } } }),
        sub2({}, { bindings: { http: { headers: obj({ "X-Trace": { type: "integer" } }) } } }),
      ],
      "3.0": [
        aa3({}, {}, { bindings: { http: { headers: obj({ "X-Trace": { type: "string" } }) } } }),
        aa3({}, {}, { bindings: { http: { headers: obj({ "X-Trace": { type: "integer" } }) } } }),
      ],
    },
    expect: [
      {
        at: "channels/**/bindings/http/headers/properties/X-Trace/type",
        action: "replace",
        type: breaking,
        mentions: ["X-Trace", "http", CH],
      },
    ],
    // ISSUE-139 (fixed), ISSUE-114 (fixed) (P6: binding schema descriptions); POLICY-19 decided (b)
  },
  {
    kind: "doc",
    id: "AA-BND-010",
    title: "Kafka message binding key schema type changed",
    before: "message bindings.kafka.key { type: string }",
    after: "message bindings.kafka.key { type: integer }",
    rationale: "the kafka message key is a Schema Object; consumers deserialize the key with it. Proposed option (b)",
    annotation: "names key, the binding and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message/bindings", "unclassified"),
      asyncapiDiff("v3.ts /channels/*/messages/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [
        sub2({}, { bindings: { kafka: { key: { type: "string" } } } }),
        sub2({}, { bindings: { kafka: { key: { type: "integer" } } } }),
      ],
      "3.0": [
        aa3({}, {}, { bindings: { kafka: { key: { type: "string" } } } }),
        aa3({}, {}, { bindings: { kafka: { key: { type: "integer" } } } }),
      ],
    },
    expect: [
      { at: "channels/**/bindings/kafka/key/type", action: "replace", type: breaking, mentions: ["key", "kafka", CH] },
    ],
    // ISSUE-139 (fixed); POLICY-19 decided (b)
  },
  // ---- operation traits
  {
    kind: "doc",
    id: "AA-BND-011",
    title: "operation trait carrying only documentation added",
    before: "operation without traits",
    after: "operation traits [{ summary, tags }]",
    rationale:
      "the trait is merged into the operation: the effective change is a summary and a tag, documentation only",
    annotation: "names traits (or the merged fields) and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/traits", "non-breaking"),
      asyncapiDiff("v3.ts /operations/*/traits", "non-breaking"),
    ],
    docs: {
      "2.6": [sub2(), sub2({ traits: [{ summary: "User events", tags: [{ name: "users" }] }] })],
      "3.0": [aa3({}), aa3({}, { traits: [{ summary: "User events", tags: [{ name: "users" }] }] })],
    },
    expect: [
      { at: ["channels/*/subscribe/**", "operations/onEvent/**"], type: annotation, mentions: [/subscribe|onEvent/] },
    ],
    // ISSUE-103 (fixed)
  },
  {
    kind: "doc",
    id: "AA-BND-012",
    title: "operation trait carrying only a description removed",
    before: "operation traits [{ description }]",
    after: "operation without traits",
    rationale: "the effective operation only loses a description",
    annotation: "names traits (or description) and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/traits/*", "breaking"),
      asyncapiDiff("v3.ts /operations/*/traits/*", "breaking"),
    ],
    docs: {
      "2.6": [sub2({ traits: [{ description: "Kafka operation" }] }), sub2()],
      "3.0": [aa3({}, { traits: [{ description: "Kafka operation" }] }), aa3({})],
    },
    expect: [
      { at: ["channels/*/subscribe/**", "operations/onEvent/**"], type: annotation, mentions: [/subscribe|onEvent/] },
    ],
    // ISSUE-103 (fixed)
  },
  {
    kind: "doc",
    id: "AA-BND-013",
    title: "operation trait inlined into the operation",
    before: "operation traits [{ summary: User events }]",
    after: "operation summary: User events, no traits",
    rationale: "the effective (merged) operation is identical",
    annotation: "no diff (or an annotation for the representation change)",
    sources: [asyncapiDiff("v2.ts /channels/*/subscribe/traits", "breaking")],
    docs: {
      "2.6": [sub2({ traits: [{ summary: "User events" }] }), sub2({ summary: "User events" })],
      "3.0": [aa3({}, { traits: [{ summary: "User events" }] }), aa3({}, { summary: "User events" })],
    },
    expect: [
      {
        at: ["channels/*/subscribe/**", "operations/onEvent/**"],
        type: annotation,
        optional: true,
        mentions: [/subscribe|onEvent/],
      },
    ],
    // ISSUE-103 (fixed)
  },
  {
    kind: "doc",
    id: "AA-BND-014",
    title: "operation trait binding changed",
    before: "operation traits [{ bindings.kafka.bindingVersion 0.4.0 }]",
    after: "operation traits [{ bindings.kafka.bindingVersion 0.5.0 }]",
    rationale: "a binding merged from a trait is still a binding: unclassified",
    annotation: "names the binding field and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/traits/bindings", "unclassified"),
      asyncapiDiff("v3.ts /operations/*/traits/*/bindings", "unclassified"),
    ],
    docs: {
      "2.6": [
        sub2({ traits: [{ bindings: { kafka: { bindingVersion: "0.4.0" } } }] }),
        sub2({ traits: [{ bindings: { kafka: { bindingVersion: "0.5.0" } } }] }),
      ],
      "3.0": [
        aa3({}, { traits: [{ bindings: { kafka: { bindingVersion: "0.4.0" } } }] }),
        aa3({}, { traits: [{ bindings: { kafka: { bindingVersion: "0.5.0" } } }] }),
      ],
    },
    expect: [
      {
        at: ["channels/*/subscribe/traits/**", "operations/onEvent/traits/**"],
        action: "replace",
        type: unclassified,
        mentions: ["bindingVersion", /subscribe|onEvent/],
      },
    ],
  },
  // ---- message traits
  {
    kind: "doc",
    id: "AA-BND-015",
    title: "message trait inlined into the message",
    before: "message traits [{ contentType: application/json }]",
    after: "message contentType application/json, no traits",
    rationale: "the effective (merged) message is identical",
    annotation: "no diff (or an annotation for the representation change)",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message/traits", "breaking"),
      asyncapiDiff("v3.ts /channels/*/messages/*/traits", "breaking"),
    ],
    docs: {
      "2.6": [
        sub2({}, { traits: [{ contentType: "application/json" }] }),
        sub2({}, { contentType: "application/json" }),
      ],
      "3.0": [
        aa3({}, {}, { traits: [{ contentType: "application/json" }] }),
        aa3({}, {}, { contentType: "application/json" }),
      ],
    },
    expect: [{ at: "channels/**", type: annotation, optional: true, mentions: [CH] }],
    // ISSUE-103 (fixed)
  },
  {
    kind: "doc",
    id: "AA-BND-016",
    title: "message trait carrying only a description removed",
    before: "message traits [{ description }]",
    after: "message without traits",
    rationale: "the effective message only loses a description",
    annotation: "names traits (or description) and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message/traits/*", "breaking"),
      asyncapiDiff("v3.ts /channels/*/messages/*/traits/*", "breaking"),
    ],
    docs: {
      "2.6": [sub2({}, { traits: [{ description: "Traced message" }] }), sub2()],
      "3.0": [aa3({}, {}, { traits: [{ description: "Traced message" }] }), aa3({})],
    },
    expect: [{ at: "channels/**", type: annotation, mentions: [CH] }],
    // ISSUE-103 (fixed)
  },
  {
    kind: "doc",
    id: "AA-BND-017",
    title: "message trait contentType changed",
    before: "message traits [{ contentType: application/json }]",
    after: "message traits [{ contentType: application/avro }]",
    rationale: "the merged message's content type changes: producers and consumers decode differently",
    annotation: "names contentType, the channel and the new media type",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareMessageTraits_ContentTypeModifiedBreaking",
      },
      asyncapiDiff("v2.ts /channels/*/subscribe/message/traits/contentType"),
      asyncapiDiff("v3.ts /channels/*/messages/*/traits/*/contentType"),
    ],
    docs: {
      "2.6": [
        sub2({}, { traits: [{ contentType: "application/json" }] }),
        sub2({}, { traits: [{ contentType: "application/avro" }] }),
      ],
      "3.0": [
        aa3({}, {}, { traits: [{ contentType: "application/json" }] }),
        aa3({}, {}, { traits: [{ contentType: "application/avro" }] }),
      ],
    },
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
    id: "AA-BND-018",
    title: "header type changed inside an inline message trait",
    before: "message traits [{ headers: { trace: string } }]",
    after: "message traits [{ headers: { trace: integer } }]",
    rationale: "the merged message headers change type: breaking in both directions",
    annotation: "names the header property and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/publish/message/traits/headers", "unclassified"),
      asyncapiDiff("v3.ts /channels/*/messages/*/traits/*/headers", "unclassified"),
    ],
    docs: {
      "2.6": [
        pub2({}, { traits: [{ headers: obj({ trace: { type: "string" } }) }] }),
        pub2({}, { traits: [{ headers: obj({ trace: { type: "integer" } }) }] }),
      ],
      "3.0": [
        recv3({}, { traits: [{ headers: obj({ trace: { type: "string" } }) }] }),
        recv3({}, { traits: [{ headers: obj({ trace: { type: "integer" } }) }] }),
      ],
    },
    expect: [
      {
        at: "channels/**/traits/0/headers/properties/trace/type",
        action: "replace",
        type: breaking,
        mentions: ["trace", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-BND-019",
    title: "message trait carrying a correlationId added",
    before: "message without traits",
    after: "message traits [{ correlationId: $message.header#/correlationId }]",
    rationale: "the merged message gains a correlationId, which asks nothing of existing clients (as AA-MSG-008)",
    annotation: "names traits or correlationId and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message/traits/correlationId"),
      asyncapiDiff("v3.ts /channels/*/messages/*/traits/*/correlationId"),
    ],
    docs: {
      "2.6": [sub2(), sub2({}, { traits: [{ correlationId: { location: "$message.header#/correlationId" } }] })],
      "3.0": [aa3({}), aa3({}, {}, { traits: [{ correlationId: { location: "$message.header#/correlationId" } }] })],
    },
    expect: [{ at: "channels/**", action: "add", type: nonBreaking, mentions: [CH] }],
  },
]

runCases("asyncapi", "bindings-traits", cases, import.meta.filename)
