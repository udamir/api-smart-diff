// pb33f libasyncapi `what-changed` (AsyncAPI 3.0 only; 2.x is unsupported there): the change tests of `what-changed/*_test.go` and `what-changed/model/*_test.go` and the rows of its default breaking-rule table (`what-changed/model/breaking_rules.go`, test/compat/coverage/libasyncapi-breaking-rules.json) that no other AsyncAPI case represents. Scenarios that also exist in AsyncAPI 2.6 run as a "2.6" variant.
//
// libasyncapi marks a change breaking or not; `verdict` records it where it differs from ASD's expectation. Viewpoint: POLICY-01 (consumer), POLICY-05 (`risky` for URL changes clients may have configured, as OAS-SEC-034 / 035), POLICY-09 (servers: annotation), POLICY-19 (Schema-valued binding fields get JSON Schema rules in the enclosing direction, every other binding field is unclassified with a description), decision §11.4 (unreferenced components: unclassified).

import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type Action, type CompatCase, type ExpectedChange, risky, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const payload = { type: "object", properties: { userId: { type: "string" } } }
const str = { type: "string" }
const int = { type: "integer" }

type Obj = Record<string, unknown>
type Pair = [unknown, unknown]
const doc2 = (extra: Obj = {}, channels: unknown = {}) => ({ asyncapi: "2.6.0", info, channels, ...extra })
const doc3 = (extra: Obj = {}, channels: unknown = {}, operations: unknown = {}) => ({
  asyncapi: "3.0.0",
  info,
  channels,
  operations,
  ...extra,
})
const channel3 = (extra: Obj = {}, message: Obj = {}) => ({
  userEvents: { address: "user/events", messages: { event: { payload, ...message } }, ...extra },
})
const operation3 = (action: "send" | "receive" = "send", extra: Obj = {}) => ({
  onEvent: {
    action,
    channel: { $ref: "#/channels/userEvents" },
    messages: [{ $ref: "#/channels/userEvents/messages/event" }],
    ...extra,
  },
})
// one send / subscribe operation with its message on channel user/events (2.6) / userEvents (3.0)
const msg2 = (message: Obj = {}, extra: Obj = {}, op: Obj = {}) =>
  doc2(extra, { "user/events": { subscribe: { message: { payload, ...message }, ...op } } })
const msg3 = (message: Obj = {}, extra: Obj = {}, op: Obj = {}, action: "send" | "receive" = "send") =>
  doc3(extra, channel3({}, message), operation3(action, op))

const CH = /user\/events|userEvents/
const OP = /subscribe|onEvent/

const laa = (ref: string, verdict?: string) => ({ tool: "libasyncapi", ref, ...(verdict ? { verdict } : {}) })
const rule = (id: string, verdict?: string) => laa(`what-changed/model/breaking_rules.go ${id}`, verdict)
const cov = (test: string, verdict?: string) => laa(`what-changed/model/coverage_test.go ${test}`, verdict)
const fmt = (test: string, verdict?: string) => laa(`what-changed/schema_format_test.go ${test}`, verdict)
const fixture = (change: string, verdict?: string) =>
  laa(`what-changed/what_changed_test.go comprehensive-bindings fixture: ${change}`, verdict)

// ---------------------------------------------------------------------------------------------------------------
// bindings: the same binding at its level in 2.6 and 3.0

type Level = "server" | "channel" | "operation" | "message"
const bindingDoc = (version: "2.6" | "3.0", level: Level, bindings: Obj) => {
  const b = { bindings }
  if (version === "2.6") {
    const server = { url: "broker.example.com:9092", protocol: "kafka", ...(level === "server" ? b : {}) }
    return doc2(
      { servers: { prod: server } },
      {
        "user/events": {
          ...(level === "channel" ? b : {}),
          subscribe: { message: { payload, ...(level === "message" ? b : {}) }, ...(level === "operation" ? b : {}) },
        },
      },
    )
  }
  const server = { host: "broker.example.com:9092", protocol: "kafka", ...(level === "server" ? b : {}) }
  return doc3(
    { servers: { prod: server } },
    channel3(level === "channel" ? b : {}, level === "message" ? b : {}),
    operation3("send", level === "operation" ? b : {}),
  )
}
const bindingDocs = (level: Level, before: Obj, after: Obj, versions: ("2.6" | "3.0")[] = ["2.6", "3.0"]) =>
  Object.fromEntries(
    versions.map((v) => [v, [bindingDoc(v, level, before), bindingDoc(v, level, after)] as Pair]),
  ) as Record<string, Pair>
const bindingAt = (level: Level, rest: string): string[] => {
  switch (level) {
    case "server":
      return [`servers/prod/bindings/${rest}`]
    case "channel":
      return [`channels/*/bindings/${rest}`]
    case "operation":
      return [`channels/*/subscribe/bindings/${rest}`, `operations/onEvent/bindings/${rest}`]
    case "message":
      return [`channels/*/subscribe/message/bindings/${rest}`, `channels/userEvents/messages/event/bindings/${rest}`]
  }
}
const levelMention: Record<Level, string | RegExp> = { server: "prod", channel: CH, operation: OP, message: CH }
/** one expected binding field change: named by its last key, the protocol and the level's location */
const bf = (
  level: Level,
  protocol: string,
  path: string,
  action: Action = "replace",
  type: ExpectedChange["type"] = unclassified,
): ExpectedChange => ({
  at: [...bindingAt(level, `${protocol}/${path}`), ...bindingAt(level, `${protocol}/${path}/**`)],
  action,
  type,
  mentions: [
    path
      .split("/")
      .filter((s) => !/^\d+$/.test(s))
      .pop() as string,
    protocol,
    levelMention[level],
  ],
})

const policy19 = { tool: "asd", ref: "DESIGN_PROPOSALS §11.21 (POLICY-19 decided (b))" }

const bindingCases: CompatCase[] = [
  // ---- protocol bindings removed at each level
  {
    kind: "doc",
    id: "AA-LAA-001",
    area: "bindings-traits",
    title: "server bindings of every protocol removed",
    before: "server bindings { http, kafka, mqtt, sqs }",
    after: "server bindings {}",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the protocol",
    annotation: "names the protocol and the server",
    sources: [
      rule("serverBindings.http", "breaking (removed)"),
      rule("serverBindings.kafka", "breaking (removed)"),
      rule("serverBindings.mqtt", "breaking (removed)"),
      rule("serverBindings.sqs", "breaking (removed)"),
      policy19,
    ],
    covers: [
      "laa:serverBindings.http",
      "laa:serverBindings.kafka",
      "laa:serverBindings.mqtt",
      "laa:serverBindings.sqs",
    ],
    docs: bindingDocs(
      "server",
      { http: {}, kafka: { bindingVersion: "0.5.0" }, mqtt: { clientId: "c1" }, sqs: {} },
      {},
    ),
    expect: ["http", "kafka", "mqtt", "sqs"].map((p) => ({
      at: bindingAt("server", p),
      action: "remove" as const,
      type: unclassified,
      mentions: [p, "prod"],
    })),
  },
  {
    kind: "doc",
    id: "AA-LAA-002",
    area: "bindings-traits",
    title: "channel bindings of every protocol removed",
    before: "channel bindings { http, ws, kafka, amqp, sqs }",
    after: "channel bindings {}",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the protocol",
    annotation: "names the protocol and the channel",
    sources: [
      ...["http", "ws", "kafka", "amqp", "sqs"].map((p) => rule(`channelBindings.${p}`, "breaking (removed)")),
      fixture("ws-channel removed with its ws binding"),
      policy19,
    ],
    covers: ["http", "ws", "kafka", "amqp", "sqs"].map((p) => `laa:channelBindings.${p}`),
    docs: bindingDocs(
      "channel",
      {
        http: {},
        ws: { method: "GET" },
        kafka: { topic: "events" },
        amqp: { is: "routingKey" },
        sqs: { queue: { name: "q" } },
      },
      {},
    ),
    expect: ["http", "ws", "kafka", "amqp", "sqs"].map((p) => ({
      at: bindingAt("channel", p),
      action: "remove" as const,
      type: unclassified,
      mentions: [p, CH],
    })),
  },
  {
    kind: "doc",
    id: "AA-LAA-003",
    area: "bindings-traits",
    title: "operation bindings of every protocol removed",
    before: "operation bindings { http, kafka, amqp, mqtt, sqs }",
    after: "operation bindings {}",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the protocol",
    annotation: "names the protocol and the operation",
    sources: [
      ...["http", "kafka", "amqp", "mqtt", "sqs"].map((p) => rule(`operationBindings.${p}`, "breaking (removed)")),
      policy19,
    ],
    covers: ["http", "kafka", "amqp", "mqtt", "sqs"].map((p) => `laa:operationBindings.${p}`),
    docs: bindingDocs(
      "operation",
      {
        http: { method: "POST" },
        kafka: { bindingVersion: "0.5.0" },
        amqp: { ack: true },
        mqtt: { qos: 1 },
        sqs: { queues: [{ name: "q" }] },
      },
      {},
    ),
    expect: ["http", "kafka", "amqp", "mqtt", "sqs"].map((p) => ({
      at: bindingAt("operation", p),
      action: "remove" as const,
      type: unclassified,
      mentions: [p, OP],
    })),
  },
  {
    kind: "doc",
    id: "AA-LAA-004",
    area: "bindings-traits",
    title: "message bindings of every protocol removed",
    before: "message bindings { http, kafka, amqp, mqtt, sqs }",
    after: "message bindings {}",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the protocol",
    annotation: "names the protocol and the channel",
    sources: [
      ...["http", "kafka", "amqp", "mqtt", "sqs"].map((p) => rule(`messageBindings.${p}`, "breaking (removed)")),
      policy19,
    ],
    covers: ["http", "kafka", "amqp", "mqtt", "sqs"].map((p) => `laa:messageBindings.${p}`),
    docs: bindingDocs(
      "message",
      {
        http: { statusCode: 200 },
        kafka: { bindingVersion: "0.5.0" },
        amqp: { messageType: "signup" },
        mqtt: { contentType: "application/json" },
        sqs: {},
      },
      {},
    ),
    expect: ["http", "kafka", "amqp", "mqtt", "sqs"].map((p) => ({
      at: bindingAt("message", p),
      action: "remove" as const,
      type: unclassified,
      mentions: [p, CH],
    })),
  },
  // ---- kafka
  {
    kind: "doc",
    id: "AA-LAA-005",
    area: "bindings-traits",
    title: "Kafka server binding fields changed",
    before: "kafka server binding { schemaRegistryUrl a, schemaRegistryVendor confluent, bindingVersion 0.4.0 }",
    after: "kafka server binding { schemaRegistryUrl b, schemaRegistryVendor apicurio, bindingVersion 0.5.0 }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, kafka and the server",
    sources: [
      rule("kafkaServerBinding.schemaRegistryUrl", "breaking"),
      rule("kafkaServerBinding.schemaRegistryVendor", "breaking"),
      rule("kafkaServerBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["schemaRegistryUrl", "schemaRegistryVendor", "bindingVersion"].map((f) => `laa:kafkaServerBinding.${f}`),
    docs: bindingDocs(
      "server",
      {
        kafka: {
          schemaRegistryUrl: "https://a.example.com",
          schemaRegistryVendor: "confluent",
          bindingVersion: "0.4.0",
        },
      },
      {
        kafka: {
          schemaRegistryUrl: "https://b.example.com",
          schemaRegistryVendor: "apicurio",
          bindingVersion: "0.5.0",
        },
      },
    ),
    expect: [
      bf("server", "kafka", "schemaRegistryUrl"),
      bf("server", "kafka", "schemaRegistryVendor"),
      bf("server", "kafka", "bindingVersion"),
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-006",
    area: "bindings-traits",
    title: "Kafka channel binding topic, partitions and replicas changed, topicConfiguration removed",
    before:
      "kafka channel binding { topic test-topic, partitions 24, replicas 3, topicConfiguration, bindingVersion 0.4.0 }",
    after: "kafka channel binding { topic test-topic-v2, partitions 48, replicas 2, bindingVersion 0.5.0 }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, kafka and the channel",
    sources: [
      fixture("kafka-channel topic test-topic -> test-topic-v2, partitions 24 -> 48", "breaking"),
      laa("what-changed/what_changed_test.go TestCompareDocuments_ChannelBindingChanges", "breaking"),
      rule("kafkaChannelBinding.topic", "breaking"),
      rule("kafkaChannelBinding.partitions", "breaking (modified)"),
      rule("kafkaChannelBinding.replicas", "non-breaking"),
      rule("kafkaChannelBinding.topicConfiguration", "breaking (removed)"),
      rule("kafkaChannelBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["topic", "partitions", "replicas", "topicConfiguration", "bindingVersion"].map(
      (f) => `laa:kafkaChannelBinding.${f}`,
    ),
    docs: bindingDocs(
      "channel",
      {
        kafka: {
          topic: "test-topic",
          partitions: 24,
          replicas: 3,
          topicConfiguration: { "retention.ms": 604800000 },
          bindingVersion: "0.4.0",
        },
      },
      { kafka: { topic: "test-topic-v2", partitions: 48, replicas: 2, bindingVersion: "0.5.0" } },
    ),
    expect: [
      bf("channel", "kafka", "topic"),
      bf("channel", "kafka", "partitions"),
      bf("channel", "kafka", "replicas"),
      bf("channel", "kafka", "topicConfiguration", "remove"),
      bf("channel", "kafka", "bindingVersion"),
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-007",
    area: "bindings-traits",
    title: "Kafka channel binding topicConfiguration values changed",
    before: "topicConfiguration { cleanup.policy [delete], retention.ms 7d, ... }",
    after: "every topicConfiguration value changed",
    rationale: "broker-side topic settings; POLICY-19 (b): unclassified with a description naming the setting",
    annotation: "names the setting, kafka and the channel",
    sources: [
      ...[
        "cleanup.policy",
        "retention.ms",
        "retention.bytes",
        "delete.retention.ms",
        "max.message.bytes",
        "confluent.key.schema.validation",
        "confluent.key.subject.name.strategy",
        "confluent.value.schema.validation",
        "confluent.value.subject.name.strategy",
      ].map((f) => rule(`kafkaTopicConfiguration.${f}`, "breaking (modified)")),
      policy19,
    ],
    covers: [
      "cleanup.policy",
      "retention.ms",
      "retention.bytes",
      "delete.retention.ms",
      "max.message.bytes",
      "confluent.key.schema.validation",
      "confluent.key.subject.name.strategy",
      "confluent.value.schema.validation",
      "confluent.value.subject.name.strategy",
    ].map((f) => `laa:kafkaTopicConfiguration.${f}`),
    docs: bindingDocs(
      "channel",
      {
        kafka: {
          topic: "events",
          topicConfiguration: {
            "cleanup.policy": ["delete"],
            "retention.ms": 604800000,
            "retention.bytes": 1000000,
            "delete.retention.ms": 86400000,
            "max.message.bytes": 1048588,
            "confluent.key.schema.validation": false,
            "confluent.key.subject.name.strategy": "TopicNameStrategy",
            "confluent.value.schema.validation": false,
            "confluent.value.subject.name.strategy": "TopicNameStrategy",
          },
        },
      },
      {
        kafka: {
          topic: "events",
          topicConfiguration: {
            "cleanup.policy": ["compact"],
            "retention.ms": 86400000,
            "retention.bytes": 2000000,
            "delete.retention.ms": 3600000,
            "max.message.bytes": 524288,
            "confluent.key.schema.validation": true,
            "confluent.key.subject.name.strategy": "RecordNameStrategy",
            "confluent.value.schema.validation": true,
            "confluent.value.subject.name.strategy": "RecordNameStrategy",
          },
        },
      },
      ["3.0"],
    ),
    expect: [
      bf("channel", "kafka", "topicConfiguration/cleanup.policy"),
      ...[
        "retention.ms",
        "retention.bytes",
        "delete.retention.ms",
        "max.message.bytes",
        "confluent.key.schema.validation",
        "confluent.key.subject.name.strategy",
        "confluent.value.schema.validation",
        "confluent.value.subject.name.strategy",
      ].map((f) => bf("channel", "kafka", `topicConfiguration/${f}`)),
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-008",
    area: "bindings-traits",
    title: "Kafka operation binding groupId and clientId schemas changed",
    before:
      "kafka operation binding { groupId: { type: string, enum: [a] }, clientId: { type: string }, bindingVersion 0.4.0 }",
    after:
      "kafka operation binding { groupId: { type: string, enum: [a, b] }, clientId: { type: integer }, bindingVersion 0.5.0 }",
    rationale:
      "groupId / clientId are Schema Objects (POLICY-19 (b): JSON Schema rules in the enclosing direction): a type change is breaking in both directions, an enum value added to a produced operation's schema is risky (POLICY-05); bindingVersion is unclassified",
    annotation: "names the schema keyword, groupId / clientId, kafka and the operation",
    sources: [
      rule("kafkaOperationBinding.groupId", "breaking (added / removed), schema diff on modification"),
      rule("kafkaOperationBinding.clientId", "breaking (added / removed), schema diff on modification"),
      rule("kafkaOperationBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["groupId", "clientId", "bindingVersion"].map((f) => `laa:kafkaOperationBinding.${f}`),
    docs: bindingDocs(
      "operation",
      { kafka: { groupId: { type: "string", enum: ["a"] }, clientId: str, bindingVersion: "0.4.0" } },
      { kafka: { groupId: { type: "string", enum: ["a", "b"] }, clientId: int, bindingVersion: "0.5.0" } },
    ),
    expect: [
      { ...bf("operation", "kafka", "groupId/enum/1", "add", risky), mentions: ["groupId", "b", OP] },
      { ...bf("operation", "kafka", "clientId/type", "replace", breaking), mentions: ["clientId", OP] },
      bf("operation", "kafka", "bindingVersion"),
    ],
    // ISSUE-57 (fixed) (P8a); ISSUE-139 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-009",
    area: "bindings-traits",
    title: "Kafka message binding schema id fields changed",
    before:
      "kafka message binding { schemaIdLocation payload, schemaIdPayloadEncoding apicurio-new, schemaLookupStrategy TopicIdStrategy, bindingVersion 0.4.0 }",
    after:
      "{ schemaIdLocation header, schemaIdPayloadEncoding confluent, schemaLookupStrategy RecordIdStrategy, bindingVersion 0.5.0 }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, kafka and the channel",
    sources: [
      rule("kafkaMessageBinding.schemaIdLocation", "breaking"),
      rule("kafkaMessageBinding.schemaIdPayloadEncoding", "breaking"),
      rule("kafkaMessageBinding.schemaLookupStrategy", "breaking"),
      rule("kafkaMessageBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["schemaIdLocation", "schemaIdPayloadEncoding", "schemaLookupStrategy", "bindingVersion"].map(
      (f) => `laa:kafkaMessageBinding.${f}`,
    ),
    docs: bindingDocs(
      "message",
      {
        kafka: {
          schemaIdLocation: "payload",
          schemaIdPayloadEncoding: "apicurio-new",
          schemaLookupStrategy: "TopicIdStrategy",
          bindingVersion: "0.4.0",
        },
      },
      {
        kafka: {
          schemaIdLocation: "header",
          schemaIdPayloadEncoding: "confluent",
          schemaLookupStrategy: "RecordIdStrategy",
          bindingVersion: "0.5.0",
        },
      },
    ),
    expect: ["schemaIdLocation", "schemaIdPayloadEncoding", "schemaLookupStrategy", "bindingVersion"].map((f) =>
      bf("message", "kafka", f),
    ),
  },
  // ---- http / ws
  {
    kind: "doc",
    id: "AA-LAA-010",
    area: "bindings-traits",
    title: "HTTP operation binding method and query schema changed",
    before: "http operation binding { method POST, query: { page: integer }, bindingVersion 0.2.0 }",
    after: "http operation binding { method PUT, query: { page: string }, bindingVersion 0.3.0 }",
    rationale:
      "method is protocol-specific (unclassified); query is a Schema Object (POLICY-19 (b)): a property type change is breaking in both directions",
    annotation: "names the field, http and the operation",
    sources: [
      fixture("http-operation method POST -> PUT", "breaking"),
      laa("what-changed/what_changed_test.go TestCompareDocuments_OperationChanges http-operation", "breaking"),
      rule("httpOperationBinding.method", "breaking"),
      rule("httpOperationBinding.query", "breaking (added / removed), schema diff on modification"),
      rule("httpOperationBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["method", "query", "bindingVersion"].map((f) => `laa:httpOperationBinding.${f}`),
    docs: bindingDocs(
      "operation",
      { http: { method: "POST", query: { type: "object", properties: { page: int } }, bindingVersion: "0.2.0" } },
      { http: { method: "PUT", query: { type: "object", properties: { page: str } }, bindingVersion: "0.3.0" } },
    ),
    expect: [
      bf("operation", "http", "method"),
      { ...bf("operation", "http", "query/properties/page/type", "replace", breaking), mentions: ["page", OP] },
      bf("operation", "http", "bindingVersion"),
    ],
    // ISSUE-139 (fixed), ISSUE-114 (fixed) (P6: binding schema descriptions); POLICY-19 decided (b)
  },
  {
    kind: "doc",
    id: "AA-LAA-011",
    area: "bindings-traits",
    title: "HTTP message binding statusCode changed",
    before: "http message binding { statusCode 200, bindingVersion 0.2.0 }",
    after: "http message binding { statusCode 201, bindingVersion 0.3.0 }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names statusCode, http and the channel",
    sources: [
      rule("httpMessageBinding.statusCode", "breaking"),
      rule("httpMessageBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["laa:httpMessageBinding.statusCode", "laa:httpMessageBinding.bindingVersion"],
    docs: bindingDocs(
      "message",
      { http: { statusCode: 200, bindingVersion: "0.2.0" } },
      { http: { statusCode: 201, bindingVersion: "0.3.0" } },
    ),
    expect: [bf("message", "http", "statusCode"), bf("message", "http", "bindingVersion")],
  },
  {
    kind: "doc",
    id: "AA-LAA-012",
    area: "bindings-traits",
    title: "WebSockets channel binding method and headers schema changed",
    before: "ws channel binding { method GET, headers: { Authorization: string }, bindingVersion 0.1.0 }",
    after: "ws channel binding { method POST, headers: { Authorization: integer }, bindingVersion 0.2.0 }",
    rationale:
      "method is protocol-specific (unclassified); headers is a Schema Object (POLICY-19 (b)): a property type change is breaking in both directions",
    annotation: "names the field, ws and the channel",
    sources: [
      rule("wsChannelBinding.method", "breaking"),
      rule("wsChannelBinding.headers", "breaking (added / removed), schema diff on modification"),
      rule("wsChannelBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["method", "headers", "bindingVersion"].map((f) => `laa:wsChannelBinding.${f}`),
    docs: bindingDocs(
      "channel",
      {
        ws: { method: "GET", headers: { type: "object", properties: { Authorization: str } }, bindingVersion: "0.1.0" },
      },
      {
        ws: {
          method: "POST",
          headers: { type: "object", properties: { Authorization: int } },
          bindingVersion: "0.2.0",
        },
      },
    ),
    expect: [
      bf("channel", "ws", "method"),
      {
        ...bf("channel", "ws", "headers/properties/Authorization/type", "replace", breaking),
        mentions: ["Authorization", CH],
      },
      bf("channel", "ws", "bindingVersion"),
    ],
    // ISSUE-139 (fixed)
  },
  // ---- amqp
  {
    kind: "doc",
    id: "AA-LAA-013",
    area: "bindings-traits",
    title: "AMQP channel binding exchange changed",
    before:
      "amqp channel binding { is routingKey, exchange { name a, type topic, durable true, autoDelete false, vhost / } }",
    after:
      "{ is routingKey, exchange { name b, type direct, durable false, autoDelete true, vhost /b }, bindingVersion 0.3.0 }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the exchange field, amqp and the channel",
    sources: [
      fixture("amqp-channel exchange type topic -> direct", "breaking"),
      rule("amqpChannelBinding.exchange", "breaking (added / removed)"),
      rule("amqpChannelBinding.bindingVersion", "non-breaking"),
      ...["name", "type", "durable", "autoDelete", "vhost"].map((f) => rule(`amqpExchange.${f}`, "breaking")),
      policy19,
    ],
    covers: [
      "laa:amqpChannelBinding.exchange",
      "laa:amqpChannelBinding.bindingVersion",
      ...["name", "type", "durable", "autoDelete", "vhost"].map((f) => `laa:amqpExchange.${f}`),
    ],
    docs: bindingDocs(
      "channel",
      {
        amqp: {
          is: "routingKey",
          exchange: { name: "a", type: "topic", durable: true, autoDelete: false, vhost: "/" },
          bindingVersion: "0.2.0",
        },
      },
      {
        amqp: {
          is: "routingKey",
          exchange: { name: "b", type: "direct", durable: false, autoDelete: true, vhost: "/b" },
          bindingVersion: "0.3.0",
        },
      },
    ),
    expect: [
      ...["name", "type", "durable", "autoDelete", "vhost"].map((f) => bf("channel", "amqp", `exchange/${f}`)),
      bf("channel", "amqp", "bindingVersion"),
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-014",
    area: "bindings-traits",
    title: "AMQP channel binding switched from a routing key to a queue",
    before: "amqp channel binding { is routingKey, exchange { name a } }",
    after: "{ is queue, queue { name q, durable true, exclusive false, autoDelete false, vhost / } }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names is / queue / exchange, amqp and the channel",
    sources: [
      fixture("findings-worker queue name -> findings-worker-v2", "breaking"),
      rule("amqpChannelBinding.is", "breaking"),
      rule("amqpChannelBinding.queue", "breaking (added / removed)"),
      ...["name", "durable", "exclusive", "autoDelete", "vhost"].map((f) => rule(`amqpQueue.${f}`, "breaking")),
      policy19,
    ],
    covers: [
      "laa:amqpChannelBinding.is",
      "laa:amqpChannelBinding.queue",
      ...["name", "durable", "exclusive", "autoDelete", "vhost"].map((f) => `laa:amqpQueue.${f}`),
    ],
    docs: bindingDocs(
      "channel",
      { amqp: { is: "routingKey", exchange: { name: "a" } } },
      {
        amqp: {
          is: "queue",
          queue: { name: "q", durable: true, exclusive: false, autoDelete: false, vhost: "/" },
        },
      },
    ),
    expect: [
      bf("channel", "amqp", "is"),
      bf("channel", "amqp", "exchange", "remove"),
      bf("channel", "amqp", "queue", "add"),
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-015",
    area: "bindings-traits",
    title: "AMQP channel binding queue fields changed",
    before:
      "amqp channel binding { is queue, queue { name findings-worker, durable true, exclusive false, autoDelete false, vhost / } }",
    after: "queue { name findings-worker-v2, durable false, exclusive true, autoDelete true, vhost /b }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the queue field, amqp and the channel",
    sources: [
      fixture("findings-worker queue name -> findings-worker-v2", "breaking"),
      ...["name", "durable", "exclusive", "autoDelete", "vhost"].map((f) => rule(`amqpQueue.${f}`, "breaking")),
      policy19,
    ],
    covers: ["name", "durable", "exclusive", "autoDelete", "vhost"].map((f) => `laa:amqpQueue.${f}`),
    docs: bindingDocs(
      "channel",
      {
        amqp: {
          is: "queue",
          queue: { name: "findings-worker", durable: true, exclusive: false, autoDelete: false, vhost: "/" },
        },
      },
      {
        amqp: {
          is: "queue",
          queue: { name: "findings-worker-v2", durable: false, exclusive: true, autoDelete: true, vhost: "/b" },
        },
      },
    ),
    expect: ["name", "durable", "exclusive", "autoDelete", "vhost"].map((f) => bf("channel", "amqp", `queue/${f}`)),
  },
  {
    kind: "doc",
    id: "AA-LAA-016",
    area: "bindings-traits",
    title: "AMQP operation binding delivery fields changed",
    before:
      "amqp operation binding { expiration 100000, userId guest, cc [user.logs], priority 10, deliveryMode 2, mandatory false, bcc [external.audit], timestamp true, ack false }",
    after: "every field changed, bindingVersion 0.3.0",
    rationale:
      "delivery semantics are protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, amqp and the operation",
    sources: [
      ...["expiration", "userId", "cc", "priority", "deliveryMode", "mandatory", "bcc", "timestamp", "ack"].map((f) =>
        rule(`amqpOperationBinding.${f}`, "breaking (modified)"),
      ),
      rule("amqpOperationBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: [
      "expiration",
      "userId",
      "cc",
      "priority",
      "deliveryMode",
      "mandatory",
      "bcc",
      "timestamp",
      "ack",
      "bindingVersion",
    ].map((f) => `laa:amqpOperationBinding.${f}`),
    docs: bindingDocs(
      "operation",
      {
        amqp: {
          expiration: 100000,
          userId: "guest",
          cc: ["user.logs"],
          priority: 10,
          deliveryMode: 2,
          mandatory: false,
          bcc: ["external.audit"],
          timestamp: true,
          ack: false,
          bindingVersion: "0.2.0",
        },
      },
      {
        amqp: {
          expiration: 200000,
          userId: "admin",
          cc: ["user.audit"],
          priority: 5,
          deliveryMode: 1,
          mandatory: true,
          bcc: ["internal.audit"],
          timestamp: false,
          ack: true,
          bindingVersion: "0.3.0",
        },
      },
    ),
    expect: [
      ...["expiration", "userId", "priority", "deliveryMode", "mandatory", "timestamp", "ack", "bindingVersion"].map(
        (f) => bf("operation", "amqp", f),
      ),
      { ...bf("operation", "amqp", "cc"), action: undefined, mentions: ["cc", "amqp", OP] },
      { ...bf("operation", "amqp", "bcc"), action: undefined, mentions: ["bcc", "amqp", OP] },
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-017",
    area: "bindings-traits",
    title: "AMQP message binding contentEncoding and messageType changed",
    before: "amqp message binding { contentEncoding utf-8, messageType user.signup, bindingVersion 0.2.0 }",
    after: "{ contentEncoding gzip, messageType user.registered, bindingVersion 0.3.0 }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, amqp and the channel",
    sources: [
      fixture("amqpMessage contentEncoding utf-8 -> gzip", "breaking"),
      laa("what-changed/what_changed_test.go TestCompareDocuments_DelegatedSchemaChange amqpMessage", "breaking"),
      rule("amqpMessageBinding.contentEncoding", "breaking"),
      rule("amqpMessageBinding.messageType", "breaking (modified)"),
      rule("amqpMessageBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["contentEncoding", "messageType", "bindingVersion"].map((f) => `laa:amqpMessageBinding.${f}`),
    docs: bindingDocs(
      "message",
      { amqp: { contentEncoding: "utf-8", messageType: "user.signup", bindingVersion: "0.2.0" } },
      { amqp: { contentEncoding: "gzip", messageType: "user.registered", bindingVersion: "0.3.0" } },
    ),
    expect: ["contentEncoding", "messageType", "bindingVersion"].map((f) => bf("message", "amqp", f)),
  },
  // ---- mqtt
  {
    kind: "doc",
    id: "AA-LAA-018",
    area: "bindings-traits",
    title: "MQTT server binding session fields and last will changed",
    before:
      "mqtt server binding { clientId a, cleanSession true, lastWill { topic t, qos 1, message bye, retain false }, keepAlive 120, sessionExpiryInterval 60, maximumPacketSize 1024 }",
    after: "every field changed (keepAlive 60, lastWill topic t2, qos 2, ...), bindingVersion 0.2.0",
    rationale: "protocol-specific connection settings; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, mqtt and the server",
    sources: [
      fixture("mqtt-server keepAlive 120 -> 60", "breaking"),
      laa("what-changed/what_changed_test.go TestCompareDocuments_ServerHostChange mqtt-server keepAlive", "breaking"),
      ...["clientId", "cleanSession", "lastWill", "keepAlive", "sessionExpiryInterval", "maximumPacketSize"].map((f) =>
        rule(`mqttServerBinding.${f}`, "breaking (modified)"),
      ),
      rule("mqttServerBinding.bindingVersion", "non-breaking"),
      ...["topic", "qos", "retain"].map((f) => rule(`mqttLastWill.${f}`, "breaking (modified)")),
      rule("mqttLastWill.message", "non-breaking"),
      policy19,
    ],
    covers: [
      ...[
        "clientId",
        "cleanSession",
        "lastWill",
        "keepAlive",
        "sessionExpiryInterval",
        "maximumPacketSize",
        "bindingVersion",
      ].map((f) => `laa:mqttServerBinding.${f}`),
      ...["topic", "qos", "message", "retain"].map((f) => `laa:mqttLastWill.${f}`),
    ],
    docs: bindingDocs(
      "server",
      {
        mqtt: {
          clientId: "a",
          cleanSession: true,
          lastWill: { topic: "t", qos: 1, message: "bye", retain: false },
          keepAlive: 120,
          sessionExpiryInterval: 60,
          maximumPacketSize: 1024,
          bindingVersion: "0.1.0",
        },
      },
      {
        mqtt: {
          clientId: "b",
          cleanSession: false,
          lastWill: { topic: "t2", qos: 2, message: "gone", retain: true },
          keepAlive: 60,
          sessionExpiryInterval: 120,
          maximumPacketSize: 2048,
          bindingVersion: "0.2.0",
        },
      },
    ),
    expect: [
      ...["clientId", "cleanSession", "keepAlive", "sessionExpiryInterval", "maximumPacketSize", "bindingVersion"].map(
        (f) => bf("server", "mqtt", f),
      ),
      ...["topic", "qos", "message", "retain"].map((f) => bf("server", "mqtt", `lastWill/${f}`)),
    ],
    // ISSUE-146 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-019",
    area: "bindings-traits",
    title: "MQTT operation binding qos and retain changed",
    before: "mqtt operation binding { qos 2, retain false, bindingVersion 0.1.0 }",
    after: "{ qos 1, retain true, bindingVersion 0.2.0 }",
    rationale:
      "delivery semantics are protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, mqtt and the operation",
    sources: [
      fixture("mqtt-operation qos 2 -> 1", "breaking"),
      rule("mqttOperationBinding.qos", "breaking (modified)"),
      rule("mqttOperationBinding.retain", "breaking (modified)"),
      rule("mqttOperationBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["qos", "retain", "bindingVersion"].map((f) => `laa:mqttOperationBinding.${f}`),
    docs: bindingDocs(
      "operation",
      { mqtt: { qos: 2, retain: false, bindingVersion: "0.1.0" } },
      { mqtt: { qos: 1, retain: true, bindingVersion: "0.2.0" } },
    ),
    expect: ["qos", "retain", "bindingVersion"].map((f) => bf("operation", "mqtt", f)),
  },
  {
    kind: "doc",
    id: "AA-LAA-020",
    area: "bindings-traits",
    title: "MQTT message binding fields changed (correlationData schema type changed)",
    before:
      "mqtt message binding { payloadFormatIndicator 0, correlationData: { type: string }, contentType application/json, responseTopic a }",
    after:
      "{ payloadFormatIndicator 1, correlationData: { type: integer }, contentType text/plain, responseTopic b, bindingVersion 0.2.0 }",
    rationale:
      "correlationData is a Schema Object (POLICY-19 (b)): a type change is breaking in both directions; the other fields are protocol-specific and unclassified",
    annotation: "names the field, mqtt and the channel",
    sources: [
      rule("mqttMessageBinding.payloadFormatIndicator", "breaking"),
      rule("mqttMessageBinding.correlationData", "breaking (added / removed)"),
      rule("mqttMessageBinding.contentType", "breaking"),
      rule("mqttMessageBinding.responseTopic", "breaking"),
      rule("mqttMessageBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["payloadFormatIndicator", "correlationData", "contentType", "responseTopic", "bindingVersion"].map(
      (f) => `laa:mqttMessageBinding.${f}`,
    ),
    docs: bindingDocs(
      "message",
      {
        mqtt: {
          payloadFormatIndicator: 0,
          correlationData: str,
          contentType: "application/json",
          responseTopic: "a",
          bindingVersion: "0.1.0",
        },
      },
      {
        mqtt: {
          payloadFormatIndicator: 1,
          correlationData: int,
          contentType: "text/plain",
          responseTopic: "b",
          bindingVersion: "0.2.0",
        },
      },
    ),
    expect: [
      ...["payloadFormatIndicator", "contentType", "responseTopic", "bindingVersion"].map((f) =>
        bf("message", "mqtt", f),
      ),
      { ...bf("message", "mqtt", "correlationData/type", "replace", breaking), mentions: ["correlationData", CH] },
    ],
    // ISSUE-139 (fixed)
  },
  // ---- sqs
  {
    kind: "doc",
    id: "AA-LAA-021",
    area: "bindings-traits",
    title: "SQS channel binding queue settings changed and dead-letter queue removed",
    before:
      "sqs channel binding { queue { name a, fifoQueue false, deduplicationScope queue, ... }, deadLetterQueue { name dlq } }",
    after: "queue { name b, fifoQueue true, ... every setting changed }, no deadLetterQueue, bindingVersion 0.3.0",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, sqs and the channel",
    sources: [
      fixture("sqs-channel queue name changed", "breaking"),
      rule("sqsChannelBinding.queue", "breaking (added / removed)"),
      rule("sqsChannelBinding.deadLetterQueue", "breaking (removed)"),
      rule("sqsChannelBinding.bindingVersion", "non-breaking"),
      ...[
        "name",
        "fifoQueue",
        "deduplicationScope",
        "fifoThroughputLimit",
        "deliveryDelay",
        "visibilityTimeout",
        "receiveMessageWaitTime",
        "messageRetentionPeriod",
      ].map((f) => rule(`sqsQueue.${f}`, "breaking (modified)")),
      rule("sqsQueue.tags", "non-breaking"),
      policy19,
    ],
    covers: [
      "laa:sqsChannelBinding.queue",
      "laa:sqsChannelBinding.deadLetterQueue",
      "laa:sqsChannelBinding.bindingVersion",
      ...[
        "name",
        "fifoQueue",
        "deduplicationScope",
        "fifoThroughputLimit",
        "deliveryDelay",
        "visibilityTimeout",
        "receiveMessageWaitTime",
        "messageRetentionPeriod",
        "tags",
      ].map((f) => `laa:sqsQueue.${f}`),
    ],
    docs: bindingDocs(
      "channel",
      {
        sqs: {
          queue: {
            name: "a",
            fifoQueue: false,
            deduplicationScope: "queue",
            fifoThroughputLimit: "perQueue",
            deliveryDelay: 0,
            visibilityTimeout: 30,
            receiveMessageWaitTime: 0,
            messageRetentionPeriod: 345600,
            tags: { team: "a" },
          },
          deadLetterQueue: { name: "dlq" },
          bindingVersion: "0.2.0",
        },
      },
      {
        sqs: {
          queue: {
            name: "b",
            fifoQueue: true,
            deduplicationScope: "messageGroup",
            fifoThroughputLimit: "perMessageGroupId",
            deliveryDelay: 10,
            visibilityTimeout: 60,
            receiveMessageWaitTime: 20,
            messageRetentionPeriod: 86400,
            tags: { team: "b" },
          },
          bindingVersion: "0.3.0",
        },
      },
    ),
    expect: [
      ...[
        "name",
        "fifoQueue",
        "deduplicationScope",
        "fifoThroughputLimit",
        "deliveryDelay",
        "visibilityTimeout",
        "receiveMessageWaitTime",
        "messageRetentionPeriod",
        "tags/team",
      ].map((f) => bf("channel", "sqs", `queue/${f}`)),
      bf("channel", "sqs", "deadLetterQueue", "remove"),
      bf("channel", "sqs", "bindingVersion"),
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-022",
    area: "bindings-traits",
    title: "SQS queue arn, redrive policy and access policy changed",
    before:
      "queue { arn a, redrivePolicy { deadLetterQueue { name dlq, arn a, fifoQueue false }, maxReceiveCount 3 }, policy { statements [Allow ...] } }",
    after:
      "queue { arn b, redrivePolicy { deadLetterQueue { name dlq2, arn b, fifoQueue true }, maxReceiveCount 5 }, policy { statements [Deny ..., Allow ...] } }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names the field, sqs and the channel",
    sources: [
      laa("what-changed/model/wired_comparators_test.go TestCompareSQSPolicy_StatementEditIsGranular", "breaking"),
      laa("what-changed/model/wired_comparators_test.go TestCompareSQSPolicy_StatementAddedAndRemoved", "breaking"),
      rule("sqsQueue.arn", "breaking"),
      rule("sqsQueue.redrivePolicy", "breaking (removed)"),
      rule("sqsQueue.policy", "breaking"),
      ...["name", "arn", "fifoQueue"].map((f) => rule(`sqsIdentifier.${f}`, "breaking")),
      rule("sqsRedrivePolicy.deadLetterQueue", "breaking"),
      rule("sqsRedrivePolicy.maxReceiveCount", "breaking (modified)"),
      rule("sqsPolicy.statements", "breaking"),
      ...["effect", "principal", "action", "resource", "condition"].map((f) =>
        rule(`sqsPolicyStatement.${f}`, "breaking"),
      ),
      policy19,
    ],
    covers: [
      "laa:sqsQueue.arn",
      "laa:sqsQueue.redrivePolicy",
      "laa:sqsQueue.policy",
      ...["name", "arn", "fifoQueue"].map((f) => `laa:sqsIdentifier.${f}`),
      "laa:sqsRedrivePolicy.deadLetterQueue",
      "laa:sqsRedrivePolicy.maxReceiveCount",
      "laa:sqsPolicy.statements",
      ...["effect", "principal", "action", "resource", "condition"].map((f) => `laa:sqsPolicyStatement.${f}`),
    ],
    docs: bindingDocs(
      "channel",
      {
        sqs: {
          queue: {
            name: "q",
            arn: "arn:aws:sqs:eu-west-1:1:a",
            redrivePolicy: {
              deadLetterQueue: { name: "dlq", arn: "arn:aws:sqs:eu-west-1:1:dlq", fifoQueue: false },
              maxReceiveCount: 3,
            },
            policy: {
              statements: [
                {
                  effect: "Allow",
                  principal: "events.amazonaws.com",
                  action: "sqs:SendMessage",
                  resource: "arn:aws:sqs:eu-west-1:1:a",
                  condition: { StringEquals: { "aws:SourceAccount": "1" } },
                },
              ],
            },
          },
        },
      },
      {
        sqs: {
          queue: {
            name: "q",
            arn: "arn:aws:sqs:eu-west-1:1:b",
            redrivePolicy: {
              deadLetterQueue: { name: "dlq2", arn: "arn:aws:sqs:eu-west-1:1:dlq2", fifoQueue: true },
              maxReceiveCount: 5,
            },
            policy: {
              statements: [
                {
                  effect: "Deny",
                  principal: "*",
                  action: "sqs:*",
                  resource: "arn:aws:sqs:eu-west-1:1:b",
                  condition: { StringEquals: { "aws:SourceAccount": "2" } },
                },
                { effect: "Allow", principal: "events.amazonaws.com", action: "sqs:SendMessage" },
              ],
            },
          },
        },
      },
      ["3.0"],
    ),
    expect: [
      bf("channel", "sqs", "queue/arn"),
      ...["name", "arn", "fifoQueue"].map((f) => bf("channel", "sqs", `queue/redrivePolicy/deadLetterQueue/${f}`)),
      bf("channel", "sqs", "queue/redrivePolicy/maxReceiveCount"),
      {
        at: bindingAt("channel", "sqs/queue/policy/statements/**"),
        type: unclassified,
        mentions: ["sqs", CH],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-023",
    area: "bindings-traits",
    title: "SQS operation binding queue added to the queues list",
    before: "sqs operation binding { queues [{ name a }], bindingVersion 0.2.0 }",
    after: "{ queues [{ name a }, { name b }], bindingVersion 0.3.0 }",
    rationale: "protocol-specific; POLICY-19 (b): unclassified with a description naming the field",
    annotation: "names queues, sqs and the operation",
    sources: [
      rule("sqsOperationBinding.queues", "breaking (added / removed)"),
      rule("sqsOperationBinding.bindingVersion", "non-breaking"),
      policy19,
    ],
    covers: ["laa:sqsOperationBinding.queues", "laa:sqsOperationBinding.bindingVersion"],
    docs: bindingDocs(
      "operation",
      { sqs: { queues: [{ name: "a" }], bindingVersion: "0.2.0" } },
      { sqs: { queues: [{ name: "a" }, { name: "b" }], bindingVersion: "0.3.0" } },
    ),
    expect: [bf("operation", "sqs", "queues", "add"), bf("operation", "sqs", "bindingVersion")],
  },
]

// ---------------------------------------------------------------------------------------------------------------
// security schemes, OAuth flows

// POLICY-80 decided (a): a scheme no requirement references (2.x requirement keys, 3.0 `$ref`s) is unclassified like
// an unreferenced OpenAPI scheme (POLICY-11); the "used" variants reference every scheme from a server requirement and
// keep the classification of the change (3.0 also reports it at the referencing requirement)
const servers2 = (schemes: Obj) => ({
  prod: {
    url: "broker.example.com:9092",
    protocol: "kafka",
    security: Object.keys(schemes).map((name) => ({ [name]: [] })),
  },
})
const servers3 = (schemes: Obj) => ({
  prod: {
    host: "broker.example.com:9092",
    protocol: "kafka",
    security: Object.keys(schemes).map((name) => ({ $ref: `#/components/securitySchemes/${name}` })),
  },
})
const withSchemes2 = (schemes: Obj, used = false) =>
  doc2({ ...(used ? { servers: servers2(schemes) } : {}), components: { securitySchemes: schemes } })
const withSchemes3 = (schemes: Obj, used = false) =>
  doc3({ ...(used ? { servers: servers3(schemes) } : {}), components: { securitySchemes: schemes } })
const schemeVariants = (before: Obj, after: Obj, versions: ("2.6" | "3.0")[] = ["2.6", "3.0"]) =>
  Object.fromEntries(
    versions.flatMap((v) => {
      const build = v === "2.6" ? withSchemes2 : withSchemes3
      return [
        [v, [build(before), build(after)] as Pair],
        [`${v} used`, [build(before, true), build(after, true)] as Pair],
      ]
    }),
  ) as Record<string, Pair>
// the class of a change in a referenced scheme; unclassified where nothing references the scheme (POLICY-80)
const whenUsed = (type: ExpectedChange["type"]) =>
  ({ "*": unclassified, "2.6 used": type, "3.0 used": type }) as ExpectedChange["type"]
// a change of a scheme at its declaration or (3.0) at the server requirement that references it
const schemeAt = (path: string) => [
  `components/securitySchemes/${path}`,
  `servers/prod/security/*/${path.replace(/^[^/]+\//, "")}`,
]

const securityCases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-LAA-024",
    area: "components",
    title: "httpApiKey security scheme name and location changed",
    before: "auth httpApiKey { name X-Key, in header }",
    after: "auth httpApiKey { name X-Api-Key, in query }",
    rationale: "clients send the key under the old name / in the old place and are rejected",
    annotation: "names the field, the scheme and the new value",
    sources: [rule("securityScheme.name", "breaking"), rule("securityScheme.in", "breaking")],
    covers: ["laa:securityScheme.name", "laa:securityScheme.in"],
    docs: schemeVariants(
      { auth: { type: "httpApiKey", name: "X-Key", in: "header" } },
      { auth: { type: "httpApiKey", name: "X-Api-Key", in: "query" } },
    ),
    expect: [
      {
        at: schemeAt("auth/name"),
        action: "replace",
        type: whenUsed(breaking),
        mentions: ["name", "auth", "X-Api-Key"],
      },
      {
        at: schemeAt("auth/in"),
        action: "replace",
        type: whenUsed(breaking),
        mentions: ["in", "auth", "query"],
      },
    ],
    // ISSUE-114 (fixed) (P8a); ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-025",
    area: "components",
    title: "http security scheme scheme and bearerFormat changed",
    before: "auth http { scheme bearer, bearerFormat JWT }",
    after: "auth http { scheme basic, bearerFormat opaque }",
    rationale:
      "clients authenticating with a bearer token are rejected; bearerFormat is documentation only (the token stays opaque to the protocol)",
    annotation: "names the field, the scheme and the new value",
    sources: [rule("securityScheme.scheme", "breaking"), rule("securityScheme.bearerFormat")],
    covers: ["laa:securityScheme.scheme", "laa:securityScheme.bearerFormat"],
    docs: schemeVariants(
      { auth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      { auth: { type: "http", scheme: "basic", bearerFormat: "opaque" } },
    ),
    expect: [
      {
        at: schemeAt("auth/scheme"),
        action: "replace",
        type: whenUsed(breaking),
        mentions: ["scheme", "auth", "basic"],
      },
      {
        at: schemeAt("auth/bearerFormat"),
        action: "replace",
        type: annotation,
        mentions: ["bearerFormat", "auth"],
      },
    ],
    // ISSUE-114 (fixed) (P8a); ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-026",
    area: "components",
    title: "openIdConnect security scheme openIdConnectUrl changed",
    before: "oidc openIdConnectUrl https://id.example.com/.well-known/openid-configuration",
    after: "https://login.example.com/.well-known/openid-configuration",
    rationale: "clients discover endpoints from the old URL; POLICY-05: risky (as OAS-SEC-034)",
    annotation: "names the scheme and the new URL",
    sources: [rule("securityScheme.openIdConnectUrl", "non-breaking")],
    covers: ["laa:securityScheme.openIdConnectUrl"],
    docs: schemeVariants(
      { oidc: { type: "openIdConnect", openIdConnectUrl: "https://id.example.com/.well-known/openid-configuration" } },
      {
        oidc: { type: "openIdConnect", openIdConnectUrl: "https://login.example.com/.well-known/openid-configuration" },
      },
    ),
    expect: [
      {
        at: schemeAt("oidc/openIdConnectUrl"),
        action: "replace",
        type: whenUsed(risky),
        mentions: ["oidc", "https://login.example.com/.well-known/openid-configuration"],
      },
    ],
    // ISSUE-114 (fixed) (P8a); ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-027",
    area: "components",
    title: "AsyncAPI 3 security scheme required scopes changed",
    before: "oauth scopes [read, write]",
    after: "oauth scopes [read, admin]",
    rationale:
      "3.0 `scopes` lists the scopes a client token needs: requiring admin rejects tokens without it (breaking); no longer requiring write is harmless (non-breaking)",
    annotation: "names the scope and the scheme",
    sources: [
      cov("TestCompareSecuritySchemes_ScopesAddedAndRemoved", "removed breaking, added non-breaking"),
      rule("securityScheme.scopes", "breaking (removed)"),
    ],
    covers: ["laa:securityScheme.scopes"],
    docs: (() => {
      const flows = { clientCredentials: { tokenUrl: "https://a.example.com/token", availableScopes: {} } }
      return schemeVariants(
        { oauth: { type: "oauth2", flows, scopes: ["read", "write"] } },
        { oauth: { type: "oauth2", flows, scopes: ["read", "admin"] } },
        ["3.0"],
      )
    })(),
    expect: [
      { at: schemeAt("oauth/scopes/**"), action: "remove", type: whenUsed(nonBreaking), mentions: ["write"] },
      { at: schemeAt("oauth/scopes/**"), action: "add", type: whenUsed(breaking), mentions: ["admin"] },
    ],
    // ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-028",
    area: "components",
    title: "OAuth2 implicit flow removed, password and authorizationCode flows added",
    before: "oauth flows { implicit }",
    after: "oauth flows { password, authorizationCode }",
    rationale:
      "clients using the implicit flow can no longer obtain tokens (breaking); new flows are additional options",
    annotation: "names the flow and the scheme",
    sources: [
      cov("TestCompareOAuthFlows_FlowRemovedAndAdded"),
      rule("securityScheme.flows", "breaking (removed)"),
      rule("oauthFlows.implicit", "breaking (removed)"),
      rule("oauthFlows.password", "breaking (removed)"),
      rule("oauthFlows.authorizationCode", "breaking (removed)"),
    ],
    covers: [
      "laa:securityScheme.flows",
      "laa:oauthFlows.implicit",
      "laa:oauthFlows.password",
      "laa:oauthFlows.authorizationCode",
    ],
    docs: (() => {
      const flows = (scopes: "scopes" | "availableScopes") => [
        { implicit: { authorizationUrl: "https://a.example.com/auth", [scopes]: {} } },
        {
          password: { tokenUrl: "https://a.example.com/token", [scopes]: {} },
          authorizationCode: {
            authorizationUrl: "https://a.example.com/auth",
            tokenUrl: "https://a.example.com/token",
            [scopes]: {},
          },
        },
      ]
      const [b2, a2] = flows("scopes")
      const [b3, a3] = flows("availableScopes")
      return {
        ...schemeVariants({ oauth: { type: "oauth2", flows: b2 } }, { oauth: { type: "oauth2", flows: a2 } }, ["2.6"]),
        ...schemeVariants({ oauth: { type: "oauth2", flows: b3 } }, { oauth: { type: "oauth2", flows: a3 } }, ["3.0"]),
      }
    })(),
    expect: [
      {
        at: schemeAt("oauth/flows/implicit"),
        action: "remove",
        type: whenUsed(breaking),
        mentions: ["implicit", "oauth"],
      },
      {
        at: [...schemeAt("oauth/flows/password"), ...schemeAt("oauth/flows/authorizationCode")],
        action: "add",
        type: whenUsed(nonBreaking),
        mentions: [/password|authorizationCode/, "oauth"],
      },
    ],
    // ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-029",
    area: "components",
    title: "OAuth2 flow authorizationUrl and refreshUrl changed",
    before: "authorizationCode { authorizationUrl a, tokenUrl t, refreshUrl a }",
    after: "authorizationCode { authorizationUrl b, tokenUrl t, refreshUrl b }",
    rationale: "clients configured with the old URLs fail if they stop serving; POLICY-05: risky (as OAS-SEC-035)",
    annotation: "names the URL field, the flow, the scheme and the new URL",
    sources: [
      cov("TestCompareOAuthFlows_NestedFlowChangeIsGranular", "breaking"),
      rule("oauthFlow.authorizationUrl", "breaking"),
      rule("oauthFlow.refreshUrl", "breaking"),
    ],
    covers: ["laa:oauthFlow.authorizationUrl", "laa:oauthFlow.refreshUrl"],
    docs: (() => {
      const flow2 = (u: string) => ({
        authorizationUrl: `https://${u}.example.com/auth`,
        tokenUrl: "https://t.example.com/token",
        refreshUrl: `https://${u}.example.com/refresh`,
      })
      const oauth = (u: string, scopes: "scopes" | "availableScopes") => ({
        oauth: { type: "oauth2", flows: { authorizationCode: { ...flow2(u), [scopes]: {} } } },
      })
      return {
        ...schemeVariants(oauth("a", "scopes"), oauth("b", "scopes"), ["2.6"]),
        ...schemeVariants(oauth("a", "availableScopes"), oauth("b", "availableScopes"), ["3.0"]),
      }
    })(),
    expect: [
      {
        at: schemeAt("oauth/flows/authorizationCode/authorizationUrl"),
        action: "replace",
        type: whenUsed(risky),
        mentions: ["authorizationCode", "https://b.example.com/auth"],
      },
      {
        at: schemeAt("oauth/flows/authorizationCode/refreshUrl"),
        action: "replace",
        type: whenUsed(risky),
        mentions: ["authorizationCode", "https://b.example.com/refresh"],
      },
    ],
    // ISSUE-114 (fixed) (P8a); ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-030",
    area: "components",
    title: "OAuth2 flow scope description changed",
    before: "availableScopes { read: read stuff }",
    after: "availableScopes { read: read more stuff }",
    rationale: "the scope name a token carries is unchanged; its description is documentation only",
    annotation: "names the scope and the flow",
    sources: [
      cov("TestCompareOAuthFlow_AvailableScopesChanges scope description modified", "breaking"),
      rule("oauthFlow.availableScopes", "breaking (modified)"),
    ],
    covers: ["laa:oauthFlow.availableScopes"],
    docs: (() => {
      const oauth = (description: string, scopes: "scopes" | "availableScopes") => ({
        oauth: {
          type: "oauth2",
          flows: { clientCredentials: { tokenUrl: "https://t.example.com", [scopes]: { read: description } } },
        },
      })
      return {
        ...schemeVariants(oauth("read stuff", "scopes"), oauth("read more stuff", "scopes"), ["2.6"]),
        ...schemeVariants(oauth("read stuff", "availableScopes"), oauth("read more stuff", "availableScopes"), ["3.0"]),
      }
    })(),
    expect: [
      {
        at: schemeAt("oauth/flows/clientCredentials/*/read"),
        action: "replace",
        type: whenUsed(annotation),
        mentions: ["read"],
      },
    ],
  },
]

// ---------------------------------------------------------------------------------------------------------------
// documents, components, channels, messages, schemas

const docCases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-LAA-031",
    area: "document",
    title: "tags changed by name: description edited, one removed, one added with externalDocs",
    before: "tags [one 'first tag', two 'second tag']",
    after: "tags [one 'first tag, changed', three 'third tag' + externalDocs]",
    rationale: "tags are documentation only; they are identified by name",
    annotation: "names the tag and the changed field",
    sources: [
      laa("what-changed/model/proof_test.go TestProof_MapChangeDetected"),
      cov("TestCompareServers_TagDescriptionModifiedIsGranular"),
      rule("tag.name", "breaking (modified / removed)"),
      rule("tag.description"),
      rule("tag.externalDocs"),
    ],
    covers: ["laa:tag.name", "laa:tag.description", "laa:tag.externalDocs"],
    docs: (() => {
      const before = [
        { name: "one", description: "first tag" },
        { name: "two", description: "second tag" },
      ]
      const after = [
        { name: "one", description: "first tag, changed" },
        { name: "three", description: "third tag", externalDocs: { url: "https://docs.example.com/three" } },
      ]
      return {
        "2.6": [doc2({ tags: before }), doc2({ tags: after })],
        "3.0": [doc3({ info: { ...info, tags: before } }), doc3({ info: { ...info, tags: after } })],
        "3.0-server": [
          doc3({ servers: { prod: { host: "broker.example.com", protocol: "kafka", tags: before } } }),
          doc3({ servers: { prod: { host: "broker.example.com", protocol: "kafka", tags: after } } }),
        ],
      } as Record<string, Pair>
    })(),
    expect: [
      { at: "**/tags/0/description", action: "replace", type: annotation, mentions: ["description", "one"] },
      { at: ["**/tags/1", "**/tags/1/**"], type: annotation, mentions: [/two|three/] },
    ],
    // ISSUE-114 (fixed) (P8-rest)
  },
  {
    kind: "doc",
    id: "AA-LAA-032",
    area: "operations",
    title: "operation externalDocs url and description changed",
    before: "externalDocs { url https://docs.example.com, description the docs }",
    after: "externalDocs { url https://docs2.example.com, description the better docs }",
    rationale: "external documentation link only",
    annotation: "names externalDocs url / description and the operation",
    sources: [cov("TestCompareExternalDocs_NotBreaking"), rule("externalDocs.url"), rule("externalDocs.description")],
    covers: ["laa:externalDocs.url", "laa:externalDocs.description"],
    docs: {
      "2.6": [
        msg2({}, {}, { externalDocs: { url: "https://docs.example.com", description: "the docs" } }),
        msg2({}, {}, { externalDocs: { url: "https://docs2.example.com", description: "the better docs" } }),
      ],
      "3.0": [
        msg3({}, {}, { externalDocs: { url: "https://docs.example.com", description: "the docs" } }),
        msg3({}, {}, { externalDocs: { url: "https://docs2.example.com", description: "the better docs" } }),
      ],
    },
    expect: [
      {
        at: ["channels/*/subscribe/externalDocs/url", "operations/onEvent/externalDocs/url"],
        action: "replace",
        type: annotation,
        mentions: ["url", OP],
      },
      {
        at: ["channels/*/subscribe/externalDocs/description", "operations/onEvent/externalDocs/description"],
        action: "replace",
        type: annotation,
        mentions: ["description", OP],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-LAA-033",
    area: "messages",
    title: "named message example edited: summary, name and headers changed",
    before: "examples [{ name minimal, summary 'a minimal order', headers { trace: 1 }, payload }]",
    after: "examples [{ name minimal-order, summary 'a minimal order, updated', headers { trace: 2 }, payload }]",
    rationale: "examples are documentation only",
    annotation: "names the example field and the channel",
    sources: [
      laa("what-changed/model/wired_comparators_test.go TestCompareMessages_NamedExampleEditIsGranular"),
      laa(
        "what-changed/model/wired_comparators_test.go TestCompareMessages_DuplicateNamedExamplesRetainEveryOccurrence",
      ),
      cov("TestCompareMessageTraits_NamedExampleEditIsGranular"),
      ...["headers", "payload", "name", "summary"].map((f) => rule(`messageExample.${f}`)),
    ],
    covers: ["headers", "payload", "name", "summary"].map((f) => `laa:messageExample.${f}`),
    docs: (() => {
      const before = [{ name: "minimal", summary: "a minimal order", headers: { trace: 1 }, payload: { userId: "a" } }]
      const after = [
        { name: "minimal-order", summary: "a minimal order, updated", headers: { trace: 2 }, payload: { userId: "b" } },
      ]
      return {
        "2.6": [msg2({ examples: before }), msg2({ examples: after })],
        "3.0": [msg3({ examples: before }), msg3({ examples: after })],
        "3.0-trait": [msg3({ traits: [{ examples: before }] }), msg3({ traits: [{ examples: after }] })],
        // example names need not be unique: the first of two same-named examples is edited
        "3.0-duplicate-names": [
          msg3({
            examples: [
              { name: "duplicate", summary: "before" },
              { name: "duplicate", summary: "unchanged" },
            ],
          }),
          msg3({
            examples: [
              { name: "duplicate", summary: "after" },
              { name: "duplicate", summary: "unchanged" },
            ],
          }),
        ],
      } as Record<string, Pair>
    })(),
    expect: [{ at: ["channels/**/examples", "channels/**/examples/**"], type: annotation, mentions: ["examples", CH] }],
  },
  {
    kind: "doc",
    id: "AA-LAA-034",
    area: "messages",
    title: "unnamed message example added to the examples list",
    before: "examples [{ name minimal, payload { id 1 } }]",
    after: "examples [{ name minimal, payload { id 1 } }, { payload { id 2 } }]",
    rationale: "examples are documentation only",
    annotation: "names examples and the channel",
    sources: [
      laa("what-changed/model/wired_comparators_test.go TestCompareMessages_ExampleAddedRemovedAndUnnamed"),
      laa("what-changed/model/wired_comparators_test.go TestCompareMessages_DuplicateNamedExampleAdditionAndRemoval"),
    ],
    docs: {
      "2.6": [
        msg2({ examples: [{ name: "minimal", payload: { userId: "1" } }] }),
        msg2({ examples: [{ name: "minimal", payload: { userId: "1" } }, { payload: { userId: "2" } }] }),
      ],
      "3.0": [
        msg3({ examples: [{ name: "minimal", payload: { userId: "1" } }] }),
        msg3({ examples: [{ name: "minimal", payload: { userId: "1" } }, { payload: { userId: "2" } }] }),
      ],
      "3.0-duplicate-name": [
        msg3({ examples: [{ name: "duplicate", summary: "first" }] }),
        msg3({
          examples: [
            { name: "duplicate", summary: "first" },
            { name: "duplicate", summary: "second" },
          ],
        }),
      ],
    },
    expect: [{ at: "channels/**/examples/**", action: "add", type: annotation, mentions: ["examples", CH] }],
  },
  {
    kind: "doc",
    id: "AA-LAA-035",
    area: "components",
    title: "unreferenced components without a usage removed (operations, replies, serverVariables, externalDocs, tags)",
    before:
      "components { operations.op, replies.r, serverVariables.port, externalDocs.docs, tags.t } (none referenced)",
    after: "components {}",
    rationale:
      "decision §11.4: a definition nothing references is unclassified with a description (as AA-CMP-003); externalDocs and tags are documentation (annotation)",
    annotation: "names the removed component",
    sources: [
      rule("components.operations", "breaking (removed)"),
      rule("components.replies", "breaking (removed)"),
      rule("components.serverVariables", "breaking (removed)"),
      rule("components.externalDocs"),
      rule("components.tags"),
    ],
    covers: [
      "laa:components.operations",
      "laa:components.replies",
      "laa:components.serverVariables",
      "laa:components.externalDocs",
      "laa:components.tags",
    ],
    docs: {
      "2.6": [doc2({ components: { serverVariables: { port: { default: "9092" } } } }), doc2({ components: {} })],
      "3.0": [
        doc3({
          components: {
            operations: { op: { action: "send", channel: { $ref: "#/components/channels/c" } } },
            channels: { c: { address: "c" } },
            replies: { r: { address: { location: "$message.header#/replyTo" } } },
            serverVariables: { port: { default: "9092" } },
            externalDocs: { docs: { url: "https://docs.example.com" } },
            tags: { t: { name: "t" } },
          },
        }),
        doc3({ components: { channels: { c: { address: "c" } } } }),
      ],
    },
    expect: {
      "2.6": [
        {
          at: ["components/serverVariables", "components/serverVariables/port"],
          action: "remove",
          type: unclassified,
          mentions: ["port"],
        },
      ],
      "3.0": [
        {
          at: ["components/operations", "components/operations/op"],
          action: "remove",
          type: unclassified,
          mentions: ["op"],
        },
        {
          at: ["components/replies", "components/replies/r"],
          action: "remove",
          type: unclassified,
          mentions: [/`r`|replies/],
        },
        {
          at: ["components/serverVariables", "components/serverVariables/port"],
          action: "remove",
          type: unclassified,
          mentions: ["port"],
        },
        {
          at: ["components/externalDocs", "components/externalDocs/docs"],
          action: "remove",
          type: annotation,
          mentions: ["docs"],
        },
        { at: ["components/tags", "components/tags/t"], action: "remove", type: annotation, mentions: [/`t`|tags/] },
      ],
    },
    // ISSUE-114 (fixed) (P8-rest); ISSUE-143 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-036",
    area: "components",
    title: "unreferenced components/*Bindings removed",
    before: "components { serverBindings.k, operationBindings.k, messageBindings.k } (none referenced)",
    after: "components {}",
    rationale:
      "decision §11.4: unreferenced definitions are unclassified; bindings are unclassified anyway (POLICY-19)",
    annotation: "names the removed binding component",
    sources: [
      rule("components.serverBindings", "breaking (removed)"),
      rule("components.operationBindings", "breaking (removed)"),
      rule("components.messageBindings", "breaking (removed)"),
    ],
    covers: ["laa:components.serverBindings", "laa:components.operationBindings", "laa:components.messageBindings"],
    docs: (() => {
      const components = {
        serverBindings: { k: { kafka: { schemaRegistryUrl: "https://a.example.com" } } },
        operationBindings: { k: { kafka: { bindingVersion: "0.5.0" } } },
        messageBindings: { k: { kafka: { bindingVersion: "0.5.0" } } },
      }
      return {
        "2.6": [doc2({ components }), doc2({ components: {} })],
        "3.0": [doc3({ components }), doc3({ components: {} })],
      } as Record<string, Pair>
    })(),
    expect: ["serverBindings", "operationBindings", "messageBindings"].map((c) => ({
      at: [`components/${c}`, `components/${c}/k`],
      action: "remove" as const,
      type: unclassified,
      mentions: [c],
    })),
    // ISSUE-108 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-037",
    area: "servers",
    title: "AsyncAPI 3 channel servers reference swapped",
    before: "channel servers [production]",
    after: "channel servers [staging]",
    rationale: "POLICY-09 (a): the servers a channel is available on are deployment metadata (annotation)",
    annotation: "names the server reference and the channel",
    sources: [
      laa("what-changed/model/channel_test.go TestCompareChannels_ServerRefSwapDetected", "removal breaking"),
      laa("what-changed/what_changed_test.go TestCompareDocuments_ChannelServerRefSwap", "removal breaking"),
      fixture("kafka-channel servers kafka-server -> mqtt-server", "removal breaking"),
    ],
    docs: (() => {
      const servers = {
        production: { host: "prod.example.com", protocol: "kafka" },
        staging: { host: "staging.example.com", protocol: "kafka" },
      }
      const d = (s: string) =>
        doc3({ servers }, { userEvents: { address: "user/events", servers: [{ $ref: `#/servers/${s}` }] } })
      return [d("production"), d("staging")] as Pair
    })(),
    expect: [
      {
        at: ["channels/userEvents/servers", "channels/userEvents/servers/**"],
        type: annotation,
        mentions: [/production|staging/, CH],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-LAA-038",
    area: "channels",
    title: "AsyncAPI 3 channel address null and absent transitions",
    before: "address absent / null / user/events",
    after: "address null / absent / user/events / null",
    rationale:
      "3.0 §Channel: a null or absent address is unknown (dynamic): absent ↔ null is no change; a known address becoming unknown is breaking (as AA-CH-006); unknown becoming known is non-breaking (as AA-CH-007)",
    annotation: "names address and the channel (no diff for absent ↔ null)",
    sources: [
      laa(
        "what-changed/model/channel_test.go TestCompareChannels_AddressStateTransitions",
        "every transition breaking",
      ),
    ],
    docs: (() => {
      const d = (address: unknown) =>
        doc3({}, { userEvents: { ...(address === undefined ? {} : { address }), title: "orders" } })
      return {
        "null-to-value": [d(null), d("user/events")],
        "value-to-null": [d("user/events"), d(null)],
        "absent-to-null": [d(undefined), d(null)],
        "null-to-absent": [d(null), d(undefined)],
      } as Record<string, Pair>
    })(),
    expect: {
      "null-to-value": [
        { at: "channels/userEvents/address", type: nonBreaking, mentions: ["address", CH, "user/events"] },
      ],
      "value-to-null": [{ at: "channels/userEvents/address", type: breaking, mentions: ["address", CH] }],
      "absent-to-null": [
        { at: "channels/userEvents/address", type: annotation, optional: true, mentions: ["address"] },
      ],
      "null-to-absent": [
        { at: "channels/userEvents/address", type: annotation, optional: true, mentions: ["address"] },
      ],
    },
    // ISSUE-114 (fixed) (P8a); ISSUE-110 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-039",
    area: "messages",
    title: "AsyncAPI 3 multi-format message headers schema changed",
    before: "headers { schemaFormat avro, schema string } / { schemaFormat draft-07, schema { type: string } }",
    after: "avro schema int / draft-07 { type: integer }",
    rationale:
      "an Avro headers schema is compared opaquely (unclassified, as AA-MSG-019); a JSON Schema headers type change is breaking in both directions",
    annotation: "names headers (the schema / type) and the channel",
    sources: [fmt("TestMultiFormatHeaders message / trait / component channel")],
    docs: (() => {
      const AVRO = "application/vnd.apache.avro;version=1.9.0"
      const DRAFT7 = "application/schema+json;version=draft-07"
      const h = (schemaFormat: string, schema: unknown) => ({ headers: { schemaFormat, schema } })
      return {
        "avro-send": [msg3(h(AVRO, { type: "string" })), msg3(h(AVRO, { type: "int" }))],
        "avro-receive": [
          msg3(h(AVRO, { type: "string" }), {}, {}, "receive"),
          msg3(h(AVRO, { type: "int" }), {}, {}, "receive"),
        ],
        "json-send": [msg3(h(DRAFT7, str)), msg3(h(DRAFT7, int))],
        "json-receive": [msg3(h(DRAFT7, str), {}, {}, "receive"), msg3(h(DRAFT7, int), {}, {}, "receive")],
        "json-trait": [msg3({ traits: [h(DRAFT7, str)] }), msg3({ traits: [h(DRAFT7, int)] })],
      } as Record<string, Pair>
    })(),
    expect: {
      "avro-send": [
        { at: ["channels/**/headers", "channels/**/headers/**"], type: unclassified, mentions: ["headers", CH] },
      ],
      "avro-receive": [
        { at: ["channels/**/headers", "channels/**/headers/**"], type: unclassified, mentions: ["headers", CH] },
      ],
      "*": [{ at: "channels/**/headers/schema/type", action: "replace", type: breaking, mentions: [CH] }],
    },
    // ISSUE-144 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-040",
    area: "messages",
    title: "AsyncAPI 3 draft-07 multi-format payload boolean schema replaced",
    before: "payload { schemaFormat draft-07, schema true } / { schema { type: string } }",
    after: "payload { schemaFormat draft-07, schema false }",
    rationale:
      "no message is valid any more: producers cannot send and consumers cannot accept anything (breaking, as JS 'schema became false')",
    annotation: "names the payload schema and the channel",
    sources: [fmt("TestJSONSchemaWrapperNonObjectContent true to false / {type: string} to false")],
    docs: (() => {
      const p = (schema: unknown) => ({ payload: { schemaFormat: "application/schema+json;version=draft-07", schema } })
      return {
        "true-send": [msg3(p(true)), msg3(p(false))],
        "true-receive": [msg3(p(true), {}, {}, "receive"), msg3(p(false), {}, {}, "receive")],
        "string-send": [msg3(p(str)), msg3(p(false))],
        "string-receive": [msg3(p(str), {}, {}, "receive"), msg3(p(false), {}, {}, "receive")],
      } as Record<string, Pair>
    })(),
    expect: [
      {
        at: ["channels/**/payload/schema", "channels/**/payload/schema/**"],
        type: breaking,
        mentions: [/false|nothing|no value/i, CH],
      },
    ],
    // ISSUE-89 (fixed) (P5)
    // ISSUE-89 (fixed) (P5)
    // ISSUE-144 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-041",
    area: "components",
    title: "title added to a self-referencing schema",
    before: "Node { type: object, properties: { next: $ref Node } }",
    after: "Node { type: object, title: changed, properties: { next: $ref Node } }",
    rationale: "a title is documentation only; the recursive reference must not loop or repeat the change",
    annotation: "names title (and the schema / channel)",
    sources: [fmt("TestSkipCircularCheckSelfReference component / payload"), fmt("TestMultiFormatCircularJSONContent")],
    docs: (() => {
      const node = (extra: Obj = {}) => ({
        type: "object",
        ...extra,
        properties: { next: { $ref: "#/components/schemas/Node" } },
      })
      return {
        payload: [
          msg3({ payload: { $ref: "#/components/schemas/Node" } }, { components: { schemas: { Node: node() } } }),
          msg3(
            { payload: { $ref: "#/components/schemas/Node" } },
            { components: { schemas: { Node: node({ title: "changed" }) } } },
          ),
        ],
        component: [
          doc3({ components: { schemas: { Node: node() } } }),
          doc3({ components: { schemas: { Node: node({ title: "changed" }) } } }),
        ],
      } as Record<string, Pair>
    })(),
    expect: {
      payload: [
        {
          at: ["channels/**/payload/title", "components/schemas/Node/title"],
          action: "add",
          type: annotation,
          mentions: ["title"],
        },
      ],
      // an unreferenced component: decision §11.4
      component: [{ at: "components/schemas/Node/title", action: "add", type: unclassified, mentions: ["title"] }],
    },
    // ISSUE-145 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-LAA-042",
    area: "components",
    title: "$ref retargeted to an identical component schema",
    before: "payload / headers / kafka key / http headers / trait headers $ref S; Alias $ref S",
    after: "the same sites $ref S2 (S2 identical to S)",
    rationale:
      "the effective schema is unchanged: no message on the wire changes (libasyncapi reports the $ref string change)",
    annotation: "no diff",
    sources: [
      fmt(
        "TestSchemaReferenceRename payload / headers / wrapper / kafka key / http headers / trait / component alias",
        "$ref modified",
      ),
      fmt("TestSchemaReferenceRename inline to reference with same content"),
      fmt("TestSkipCircularCheckReferenceRename", "$ref modified"),
    ],
    docs: (() => {
      const schemas = {
        S: str,
        S2: str,
        W: { schemaFormat: "application/vnd.apache.avro;version=1.9.0", schema: { type: "string" } },
        W2: { schemaFormat: "application/vnd.apache.avro;version=1.9.0", schema: { type: "string" } },
        A: { type: "object", properties: { next: { $ref: "#/components/schemas/A" } } },
        B: { type: "object", properties: { next: { $ref: "#/components/schemas/B" } } },
      }
      const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
      const site = (message: (t: string) => Obj, a: string, b: string): Pair => [
        msg3(message(a), { components: { schemas } }),
        msg3(message(b), { components: { schemas } }),
      ]
      return {
        payload: site((t) => ({ payload: ref(t) }), "S", "S2"),
        headers: site((t) => ({ headers: ref(t) }), "S", "S2"),
        wrapper: site((t) => ({ payload: ref(t) }), "W", "W2"),
        "kafka-key": site((t) => ({ bindings: { kafka: { key: ref(t) } } }), "S", "S2"),
        "http-headers": site((t) => ({ bindings: { http: { headers: ref(t) } } }), "S", "S2"),
        trait: site((t) => ({ traits: [{ headers: ref(t) }] }), "S", "S2"),
        recursive: site((t) => ({ payload: ref(t) }), "A", "B"),
        "inline-to-ref": [
          msg3({ payload: str }, { components: { schemas } }),
          msg3({ payload: ref("S") }, { components: { schemas } }),
        ],
        "component-alias": [
          doc3({ components: { schemas: { ...schemas, Alias: ref("S") } } }),
          doc3({ components: { schemas: { ...schemas, Alias: ref("S2") } } }),
        ],
      } as Record<string, Pair>
    })(),
    expect: [],
    // ISSUE-99 (fixed) (P5)
    // ISSUE-139 (fixed)
  },
  {
    kind: "doc",
    id: "AA-LAA-043",
    area: "messages",
    title: "AsyncAPI 3 Avro payload referencing a component schema property: target type changed",
    before:
      "payload { schemaFormat avro, schema: $ref #/components/schemas/Alias/properties/x }, Alias $ref Target, Target.x string",
    after: "Target.x integer",
    rationale:
      "the payload's effective schema changes; a non-JSON format is compared opaquely, so the change is unclassified (as AA-MSG-019)",
    annotation: "names the payload schema and the channel",
    sources: [laa("what-changed/reference_alias_lookup_test.go TestWrappedSchemaReferenceThroughRepairedAlias")],
    docs: (() => {
      const d = (type: string) =>
        msg3(
          {
            payload: {
              schemaFormat: "application/vnd.apache.avro;version=1.9.0",
              schema: { $ref: "#/components/schemas/Alias/properties/x" },
            },
          },
          {
            components: {
              schemas: {
                Alias: { $ref: "#/components/schemas/Target" },
                Target: { type: "object", properties: { x: { type } } },
              },
            },
          },
        )
      return [d("string"), d("integer")] as Pair
    })(),
    expect: [
      {
        at: ["channels/**/payload", "channels/**/payload/**"],
        type: unclassified,
        mentions: ["payload", CH],
      },
      // the component itself is referenced through the payload: its own diff, if any, is attributed here
      { at: "components/schemas/**", type: unclassified, optional: true },
    ],
    // ISSUE-144 (fixed)
  },
]

runCases("asyncapi", "libasyncapi", [...bindingCases, ...securityCases, ...docCases], import.meta.filename)
