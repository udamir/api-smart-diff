// AsyncAPI messages: identity and documentation fields, contentType, schemaFormat (incl. non-JSON formats compared opaquely and 3.0 multi-format schema objects), correlationId, examples, payload / headers added or removed as a whole, `$ref` messages and message keys. Payload JSON Schema keyword changes are covered by the JSON Schema family in the AsyncAPI placements; header keyword changes per direction are in direction.test.ts.
//
// Variants: `2.6-pub` / `3.0-receive` = a message the application consumes (request semantics), `2.6-sub` / `3.0-send` = a message it produces (response semantics), docs/BENCHMARK.md §3.

import { annotation, breaking, deprecated, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const payload = { type: "object", properties: { userId: { type: "string" } } }

type Msg = Record<string, unknown>
const withPayload = (msg: Msg) => ("payload" in msg ? msg : { payload, ...msg })
const strip = (msg: Msg) => Object.fromEntries(Object.entries(msg).filter(([, v]) => v !== undefined))
const m2 = (op: "publish" | "subscribe", msg: Msg, extra: Record<string, unknown> = {}) => ({
  asyncapi: "2.6.0",
  info,
  channels: { "user/signup": { [op]: { message: strip(withPayload(msg)) } } },
  ...extra,
})
const m3 = (action: "send" | "receive", msg: Msg, extra: Record<string, unknown> = {}) => ({
  asyncapi: "3.0.0",
  info,
  channels: { userSignup: { address: "user/signup", messages: { signup: strip(withPayload(msg)) } } },
  operations: {
    onSignup: {
      action,
      channel: { $ref: "#/channels/userSignup" },
      messages: [{ $ref: "#/channels/userSignup/messages/signup" }],
    },
  },
  ...extra,
})

const four = (before: Msg, after: Msg, extra: [Record<string, unknown>, Record<string, unknown>] = [{}, {}]) => ({
  "2.6-pub": [m2("publish", before, extra[0]), m2("publish", after, extra[1])] as [unknown, unknown],
  "2.6-sub": [m2("subscribe", before, extra[0]), m2("subscribe", after, extra[1])] as [unknown, unknown],
  "3.0-send": [m3("send", before, extra[0]), m3("send", after, extra[1])] as [unknown, unknown],
  "3.0-receive": [m3("receive", before, extra[0]), m3("receive", after, extra[1])] as [unknown, unknown],
})
const v2only = (before: Msg, after: Msg) => {
  const { "2.6-pub": pub, "2.6-sub": sub } = four(before, after)
  return { "2.6-pub": pub, "2.6-sub": sub }
}
const v3only = (before: Msg, after: Msg) => {
  const { "3.0-send": send, "3.0-receive": receive } = four(before, after)
  return { "3.0-send": send, "3.0-receive": receive }
}
// consumed (request semantics) vs produced (response semantics)
const dir = <T>(consumed: T, produced: T) => ({
  "2.6-pub": consumed,
  "3.0-receive": consumed,
  "2.6-sub": produced,
  "3.0-send": produced,
})

const at = (field: string) => [
  `channels/user~1signup/*/message/${field}`,
  `channels/userSignup/messages/signup/${field}`,
]
const CH = /user\/signup|userSignup/

const asyncapiDiff = (ref: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${ref}`,
  ...(verdict ? { verdict } : {}),
})
// the 2.x standard has the same row for the message of a publish and of a subscribe operation; the cases run both
const v2msg = (field: string, verdict?: string) => [
  asyncapiDiff(`v2.ts /channels/*/publish/message/${field}`, verdict),
  asyncapiDiff(`v2.ts /channels/*/subscribe/message/${field}`, verdict),
]
const asd = (ref: string) => ({ tool: "asd", ref })
const fork = (ref: string, verdict?: string) => ({ tool: "fork", ref, ...(verdict ? { verdict } : {}) })

const AVRO = "application/vnd.apache.avro;version=1.9.0"
const avroRecord = (type: string) => ({ type: "record", name: "Signup", fields: [{ name: "userId", type }] })
const AA_FORMAT = "application/vnd.aai.asyncapi+json;version=3.0.0"

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-MSG-001",
    title: "message name changed",
    before: "message name signup",
    after: "message name userSignup",
    rationale:
      "name is a machine-friendly identifier for tooling; the bytes on the wire do not change (@asyncapi/diff 2.x and ASD: non-breaking)",
    annotation: "names the message name field and the channel",
    sources: [
      ...v2msg("name"),
      asyncapiDiff("v3.ts /channels/*/messages/*/name", "breaking"),
      asd("test/asyncapi/edge-cases.test.ts name, title, summary and description changes are not breaking"),
    ],
    docs: four({ name: "signup" }, { name: "userSignup" }),
    expect: [{ at: at("name"), action: "replace", type: nonBreaking, mentions: ["name", CH] }],
    // ISSUE-105 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-002",
    title: "message title changed",
    before: "title 'Signup'",
    after: "title 'User signup'",
    rationale: "documentation only",
    annotation: "names title and the channel",
    sources: [...v2msg("title"), asyncapiDiff("v3.ts /channels/*/messages/*/title")],
    docs: four({ title: "Signup" }, { title: "User signup" }),
    expect: [{ at: at("title"), action: "replace", type: annotation, mentions: ["title", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-003",
    title: "message summary added and description changed",
    before: "no summary, description 'A signup'",
    after: "summary set, description 'A user signed up'",
    rationale: "documentation only",
    annotation: "names the field and the channel",
    sources: [
      ...v2msg("summary"),
      ...v2msg("description"),
      asyncapiDiff("v3.ts /channels/*/messages/*/summary"),
      asyncapiDiff("v3.ts /channels/*/messages/*/description"),
    ],
    docs: four({ description: "A signup" }, { summary: "Signup", description: "A user signed up" }),
    expect: [
      { at: at("summary"), action: "add", type: annotation, mentions: ["summary", CH] },
      { at: at("description"), action: "replace", type: annotation, mentions: ["description", CH] },
    ],
  },
  {
    kind: "doc",
    id: "AA-MSG-004",
    title: "message contentType changed",
    before: "contentType application/json",
    after: "contentType application/xml",
    rationale: "producers and consumers encode / decode the payload with the declared content type",
    annotation: "names contentType, the channel and the new media type",
    sources: [
      ...v2msg("contentType"),
      asyncapiDiff("v3.ts /channels/*/messages/*/contentType"),
      asd("test/asyncapi/edge-cases.test.ts contentType change is breaking"),
    ],
    docs: four({ contentType: "application/json" }, { contentType: "application/xml" }),
    expect: [
      { at: at("contentType"), action: "replace", type: breaking, mentions: ["contentType", CH, "application/xml"] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-MSG-005",
    title: "message contentType added (no defaultContentType)",
    before: "no contentType, no defaultContentType",
    after: "contentType application/json",
    rationale:
      "an undeclared encoding becomes declared; the encoding clients already use is documented (@asyncapi/diff 2.x: non-breaking)",
    annotation: "names contentType, the channel and the media type",
    sources: [...v2msg("contentType"), asyncapiDiff("v3.ts /channels/*/messages/*/contentType", "breaking")],
    docs: four({}, { contentType: "application/json" }),
    expect: [
      { at: at("contentType"), action: "add", type: nonBreaking, mentions: ["contentType", CH, "application/json"] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-MSG-006",
    title: "message contentType removed (no defaultContentType)",
    before: "contentType application/json",
    after: "no contentType, no defaultContentType",
    rationale: "clients lose the declared encoding of the payload",
    annotation: "names contentType, the channel and the removed media type",
    sources: [...v2msg("contentType"), asyncapiDiff("v3.ts /channels/*/messages/*/contentType")],
    docs: four({ contentType: "application/json" }, {}),
    expect: [
      { at: at("contentType"), action: "remove", type: breaking, mentions: ["contentType", CH, "application/json"] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-MSG-007",
    title: "message contentType equal to defaultContentType removed",
    before: "defaultContentType application/json, message contentType application/json",
    after: "defaultContentType application/json, no message contentType",
    rationale:
      "2.6 / 3.0 §defaultContentType: a message without contentType uses the default, so the effective content type is unchanged",
    annotation: "if reported, an annotation naming contentType",
    sources: [...v2msg("contentType", "breaking")],
    docs: four({ contentType: "application/json" }, {}, [
      { defaultContentType: "application/json" },
      { defaultContentType: "application/json" },
    ]),
    expect: [{ at: at("contentType"), type: annotation, optional: true, mentions: ["contentType"] }],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-008",
    title: "message correlationId added",
    before: "no correlationId",
    after: "correlationId $message.header#/correlationId",
    rationale: "a new correlation hint asks nothing of existing clients",
    annotation: "names correlationId and the channel",
    sources: [...v2msg("correlationId"), asyncapiDiff("v3.ts /channels/*/messages/*/correlationId")],
    docs: four({}, { correlationId: { location: "$message.header#/correlationId" } }),
    expect: [{ at: at("correlationId"), action: "add", type: nonBreaking, mentions: ["correlationId", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-009",
    title: "message correlationId removed",
    before: "correlationId $message.header#/correlationId",
    after: "no correlationId",
    rationale: "clients correlating messages by the documented location lose it",
    annotation: "names correlationId and the channel",
    sources: [...v2msg("correlationId"), asyncapiDiff("v3.ts /channels/*/messages/*/correlationId")],
    docs: four({ correlationId: { location: "$message.header#/correlationId" } }, {}),
    expect: [{ at: at("correlationId"), action: "remove", type: breaking, mentions: ["correlationId", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-010",
    title: "message correlationId location changed and description added",
    before: "location $message.header#/correlationId",
    after: "location $message.payload#/requestId, description set",
    rationale: "clients read / write the correlation id at the documented location",
    annotation: "names location, correlationId and the channel",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareCorrelationID_LocationModifiedBreaking",
      },
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareCorrelationID_DescriptionNotBreaking",
      },
      ...v2msg("correlationId/location"),
      ...v2msg("correlationId/description"),
      asd("test/asyncapi/edge-cases.test.ts correlationId location change is breaking"),
    ],
    docs: four(
      { correlationId: { location: "$message.header#/correlationId" } },
      { correlationId: { location: "$message.payload#/requestId", description: "Request id" } },
    ),
    expect: [
      {
        at: at("correlationId/location"),
        action: "replace",
        type: breaking,
        mentions: ["location", "correlationId", CH],
      },
      {
        at: at("correlationId/description"),
        action: "add",
        type: annotation,
        mentions: ["description", "correlationId"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-MSG-011",
    title: "message example changed",
    before: "examples [{ payload: { userId: a } }]",
    after: "examples [{ payload: { userId: b } }]",
    rationale: "examples are documentation only",
    annotation: "names examples and the channel",
    sources: [...v2msg("examples/*"), asyncapiDiff("v3.ts /channels/*/messages/*/examples/*")],
    docs: four({ examples: [{ payload: { userId: "a" } }] }, { examples: [{ payload: { userId: "b" } }] }),
    expect: [{ at: [...at("examples"), ...at("examples/**")], type: annotation, mentions: ["examples", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-012",
    title: "AsyncAPI 2 messageId changed",
    before: "messageId signupV1",
    after: "messageId signupV2",
    rationale: "2.4+ messageId identifies the message for tooling only (annotation in ASD)",
    annotation: "names messageId and the channel",
    sources: [asd("src/asyncapi/asyncapi2.rules.ts /messageId annotation")],
    docs: v2only({ messageId: "signupV1" }, { messageId: "signupV2" }),
    expect: [{ at: at("messageId"), action: "replace", type: annotation, mentions: ["messageId", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-013",
    title: "message tag added",
    before: "tags [users]",
    after: "tags [users, onboarding]",
    rationale: "documentation only",
    annotation: "names the added tag and the channel",
    sources: [...v2msg("tags/*"), asyncapiDiff("v3.ts /channels/*/messages/*/tags/*")],
    docs: four({ tags: [{ name: "users" }] }, { tags: [{ name: "users" }, { name: "onboarding" }] }),
    expect: [{ at: at("tags/**"), action: "add", type: annotation, mentions: ["onboarding", CH] }],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-MSG-014",
    title: "message externalDocs added",
    before: "no externalDocs",
    after: "externalDocs https://docs.example.com/signup",
    rationale: "documentation only",
    annotation: "names externalDocs and the channel",
    sources: [...v2msg("externalDocs"), asyncapiDiff("v3.ts /channels/*/messages/*/externalDocs")],
    docs: four({}, { externalDocs: { url: "https://docs.example.com/signup" } }),
    expect: [{ at: at("externalDocs"), action: "add", type: annotation, mentions: ["externalDocs", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-015",
    title: "payload property marked deprecated",
    before: "payload.userId",
    after: "payload.userId deprecated: true",
    rationale: "a deprecation announces a future removal; nothing breaks now",
    annotation: "names the property and the channel",
    sources: [asd("jsonSchema deprecated rule (allDeprecated)")],
    docs: four({}, { payload: { type: "object", properties: { userId: { type: "string", deprecated: true } } } }),
    expect: [
      { at: at("payload/properties/userId/deprecated"), action: "add", type: deprecated, mentions: ["userId", CH] },
    ],
  },
  // ---- schemaFormat
  {
    kind: "doc",
    id: "AA-MSG-016",
    title: "AsyncAPI 2 explicit default schemaFormat added",
    before: "no schemaFormat (default AsyncAPI schema format)",
    after: "schemaFormat application/vnd.aai.asyncapi;version=2.6.0",
    rationale:
      "2.6 §Message Object: the default schemaFormat is the AsyncAPI schema of the document version, so the payload is interpreted exactly as before",
    annotation: "if reported, an annotation naming schemaFormat",
    sources: [...v2msg("schemaFormat", "breaking")],
    docs: v2only({}, { schemaFormat: "application/vnd.aai.asyncapi;version=2.6.0" }),
    expect: [{ at: at("schemaFormat"), type: annotation, optional: true, mentions: ["schemaFormat"] }],
    // ISSUE-70 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-017",
    title: "AsyncAPI 2 schemaFormat changed with the same payload text",
    before: "schemaFormat application/schema+json;version=draft-07",
    after: "schemaFormat application/vnd.oai.openapi;version=3.0.0 (3.1.0; with `nullable`)",
    rationale:
      "POLICY-91 decided: OpenAPI 3.1 and OpenAPI 3.0 without 3.0-specific keywords read an equal schema as JSON Schema does, so the valid payloads are unchanged (annotation, POLICY-82); a schema with `nullable` (3.0-specific) is read differently by the new format (breaking)",
    annotation: "names schemaFormat, the channel and the new format",
    sources: [...v2msg("schemaFormat"), asd("test/asyncapi/edge-cases.test.ts schemaFormat change is breaking")],
    docs: {
      ...v2only(
        { schemaFormat: "application/schema+json;version=draft-07", payload: { type: "string" } },
        { schemaFormat: "application/vnd.oai.openapi;version=3.0.0", payload: { type: "string" } },
      ),
      "2.6-pub-3.1": four(
        { schemaFormat: "application/schema+json;version=draft-07", payload: { type: "string" } },
        { schemaFormat: "application/vnd.oai.openapi;version=3.1.0", payload: { type: "string" } },
      )["2.6-pub"],
      "2.6-pub-nullable": four(
        { schemaFormat: "application/schema+json;version=draft-07", payload: { type: "string", nullable: true } },
        { schemaFormat: "application/vnd.oai.openapi;version=3.0.0", payload: { type: "string", nullable: true } },
      )["2.6-pub"],
    },
    expect: {
      "*": [{ at: at("schemaFormat"), action: "replace", type: annotation, mentions: ["schemaFormat", CH, "openapi"] }],
      "2.6-pub-nullable": [
        { at: at("schemaFormat"), action: "replace", type: breaking, mentions: ["schemaFormat", CH, "openapi"] },
      ],
    },
    // POLICY-91 decided (P8-rest): the expectation rewritten from breaking to annotation; 3.1 and `nullable` variants added
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-MSG-018",
    title: "AsyncAPI 3 multi-format schemaFormat changed",
    before: "payload { schemaFormat avro 1.9.0, schema }",
    after: "payload { schemaFormat avro 1.10.0, schema }",
    rationale: "the payload is interpreted with another schema language version",
    annotation: "names schemaFormat and the channel without calling it an annotation",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/schema_format_test.go TestMultiFormatSchemaRulesAndFormatChange avro version=1.9.0 -> 1.10.0",
      },
      asyncapiDiff("v3.ts /channels/*/messages/*/payload"),
      fork("test/asyncapi.multiformat-schema.test.ts schema rules selection"),
    ],
    docs: v3only(
      { payload: { schemaFormat: AVRO, schema: avroRecord("string") } },
      { payload: { schemaFormat: "application/vnd.apache.avro;version=1.10.0", schema: avroRecord("string") } },
    ),
    expect: [{ at: at("payload/schemaFormat"), action: "replace", type: breaking, mentions: ["schemaFormat", CH] }],
    // ISSUE-114 (fixed) (P6: the multi-format `schemaFormat` is described as a message field)
  },
  {
    kind: "doc",
    id: "AA-MSG-019",
    title: "non-JSON (Avro) payload schema changed",
    before: "Avro record field userId string",
    after: "Avro record field userId int",
    rationale:
      "DESIGN_PROPOSALS §4.6: schema formats other than JSON Schema / AsyncAPI / OpenAPI are compared as opaque values with an unclassified described diff (fork: unknown-format-fallback unclassified)",
    annotation: "names the payload and the channel without calling it an annotation",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/schema_format_test.go TestMultiFormatSchemaChanges payload/avro",
        verdict: "breaking",
      },
      fork("test/asyncapi.multiformat-schema.test.ts unknown-format-fallback", "unclassified"),
      asd("test/asyncapi/asyncapi3.test.ts H12 non-JSON schema format is opaque"),
    ],
    docs: {
      ...v2only(
        { schemaFormat: AVRO, payload: avroRecord("string") },
        { schemaFormat: AVRO, payload: avroRecord("int") },
      ),
      ...v3only(
        { payload: { schemaFormat: AVRO, schema: avroRecord("string") } },
        { payload: { schemaFormat: AVRO, schema: avroRecord("int") } },
      ),
    },
    expect: [{ at: [...at("payload"), ...at("payload/**")], type: unclassified, mentions: ["payload", CH] }],
    // ISSUE-114 (fixed) (P6: an opaque payload is one described replace of the payload / schema)
  },
  {
    kind: "doc",
    id: "AA-MSG-020",
    title: "AsyncAPI 3 plain payload schema wrapped into a multi-format schema object",
    before: "payload { type: object, ... }",
    after: "payload { schemaFormat: application/vnd.aai.asyncapi+json;version=3.0.0, schema: { same } }",
    rationale:
      "3.0 §Multi Format Schema Object: a plain schema is the AsyncAPI schema format; the wrapped schema is the same contract",
    annotation: "no diff (or an annotation for the representation change)",
    sources: [fork("test/asyncapi.multiformat-schema.test.ts schema-to-multiformat-no-content-change")],
    docs: v3only({}, { payload: { schemaFormat: AA_FORMAT, schema: payload } }),
    expect: [{ at: at("payload/**"), type: annotation, optional: true, mentions: ["payload"] }],
    // ISSUE-104 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-021",
    title: "AsyncAPI 3 multi-format schema object unwrapped into a plain payload schema",
    before: "payload { schemaFormat: application/vnd.aai.asyncapi+json;version=3.0.0, schema }",
    after: "payload { same schema }",
    rationale: "the same contract in another representation",
    annotation: "no diff (or an annotation for the representation change)",
    sources: [fork("test/asyncapi.multiformat-schema.test.ts multiformat-to-schema-no-content-change")],
    docs: v3only({ payload: { schemaFormat: AA_FORMAT, schema: payload } }, {}),
    expect: [{ at: at("payload/**"), type: annotation, optional: true, mentions: ["payload"] }],
    // ISSUE-104 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-022",
    title: "AsyncAPI 3 plain payload wrapped into a multi-format object with a type change",
    before: "payload { type: string }",
    after: "payload { schemaFormat: AsyncAPI 3.0.0, schema: { type: integer } }",
    rationale: "only the type change is a contract change (fork: schema-to-multiformat-with-type-change breaking)",
    annotation: "names the type change and the channel",
    sources: [fork("test/asyncapi.multiformat-schema.test.ts schema-to-multiformat-with-type-change")],
    docs: v3only(
      { payload: { type: "string" } },
      { payload: { schemaFormat: AA_FORMAT, schema: { type: "integer" } } },
    ),
    expect: [
      { at: at("payload/**/type"), type: breaking, mentions: ["type", CH] },
      { at: at("payload/schemaFormat"), type: annotation, optional: true, mentions: ["schemaFormat"] },
    ],
    // ISSUE-104 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-023",
    title: "AsyncAPI 3 multi-format JSON Schema draft-07 payload type changed",
    before: "payload { schemaFormat draft-07, schema: { type: string } }",
    after: "payload { schemaFormat draft-07, schema: { type: integer } }",
    rationale: "JSON Schema formats are compared structurally; a type change breaks both directions",
    annotation: "names the type change and the channel",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/schema_format_test.go TestMultiFormatSchemaChanges payload/draft-07" },
      { tool: "libasyncapi", ref: "what-changed/schema_format_test.go TestJSONSchemaWrapperAliasedContent" },
      fork(
        "test/asyncapi.multiformat-schema.test.ts json-draft7-format-uses-json-schema-rules: type change is breaking",
      ),
    ],
    docs: v3only(
      { payload: { schemaFormat: "application/schema+json;version=draft-07", schema: { type: "string" } } },
      { payload: { schemaFormat: "application/schema+json;version=draft-07", schema: { type: "integer" } } },
    ),
    expect: [{ at: at("payload/schema/type"), action: "replace", type: breaking, mentions: ["type", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-024",
    title: "AsyncAPI 3 multi-format AsyncAPI schema (alias without +json) payload type changed",
    before: "payload { schemaFormat application/vnd.aai.asyncapi;version=3.0.0, schema: { type: string } }",
    after: "the same format, schema { type: integer }",
    rationale: "both spellings of the AsyncAPI schema format are compared structurally",
    annotation: "names the type change and the channel",
    sources: [fork("test/asyncapi.multiformat-schema.test.ts asyncapi-format-aliases")],
    docs: v3only(
      { payload: { schemaFormat: "application/vnd.aai.asyncapi;version=3.0.0", schema: { type: "string" } } },
      { payload: { schemaFormat: "application/vnd.aai.asyncapi;version=3.0.0", schema: { type: "integer" } } },
    ),
    expect: [{ at: at("payload/schema/type"), action: "replace", type: breaking, mentions: ["type", CH] }],
  },
  {
    kind: "doc",
    id: "AA-MSG-025",
    title: "AsyncAPI 3 multi-format OpenAPI 3.0 payload becomes nullable",
    before: "payload { schemaFormat application/vnd.oai.openapi;version=3.0.0, schema: { type: string } }",
    after: "the same format, schema { type: string, nullable: true }",
    rationale:
      "in the OpenAPI 3.0 schema dialect nullable widens the type: consumers of a produced message may now get null, a consumed message accepts more",
    annotation: "names nullable and the channel without calling it an annotation",
    sources: [
      fork(
        "test/asyncapi.multiformat-schema.test.ts openapi30-format-uses-openapi-schema-rules: nullable change is detected",
      ),
    ],
    docs: v3only(
      { payload: { schemaFormat: "application/vnd.oai.openapi;version=3.0.0", schema: { type: "string" } } },
      {
        payload: {
          schemaFormat: "application/vnd.oai.openapi;version=3.0.0",
          schema: { type: "string", nullable: true },
        },
      },
    ),
    expect: [{ at: at("payload/schema/**"), type: dir(nonBreaking, breaking), mentions: [CH] }],
    // ISSUE-109 (fixed)
  },
  // ---- payload / headers as a whole
  {
    kind: "doc",
    id: "AA-MSG-026",
    title: "message payload schema added",
    before: "message without payload (any payload)",
    after: "payload { type: object, properties: { userId: string } }",
    rationale:
      "an absent schema allows any payload: constraining a consumed payload rejects what clients sent (request narrowing), constraining a produced one only tells consumers more (response narrowing)",
    annotation: "names payload and the channel",
    sources: [asyncapiDiff("v3.ts /channels/*/messages/*/payload"), ...v2msg("payload", "unclassified")],
    docs: four({ name: "signup", payload: undefined }, { name: "signup", payload }),
    expect: [{ at: at("payload"), action: "add", type: dir(breaking, nonBreaking), mentions: ["payload", CH] }],
    // ISSUE-62 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-027",
    title: "message payload schema removed",
    before: "payload { type: object, ... }",
    after: "message without payload (any payload)",
    rationale:
      "dropping the schema widens the payload: consumers of a produced message lose every guarantee (breaking), a consumed message accepts anything (non-breaking)",
    annotation: "names payload and the channel",
    sources: [asyncapiDiff("v3.ts /channels/*/messages/*/payload"), ...v2msg("payload", "unclassified")],
    docs: four({ name: "signup", payload }, { name: "signup", payload: undefined }),
    expect: [{ at: at("payload"), action: "remove", type: dir(nonBreaking, breaking), mentions: ["payload", CH] }],
    // ISSUE-62 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-028",
    title: "message headers schema added",
    before: "message without headers (any headers)",
    after: "headers { type: object, properties: { traceId: string } }",
    rationale:
      "as for the payload: constraining consumed headers is request narrowing, constraining produced headers is response narrowing",
    annotation: "names headers and the channel",
    sources: [asyncapiDiff("v3.ts /channels/*/messages/*/headers"), ...v2msg("headers", "unclassified")],
    docs: four({}, { headers: { type: "object", properties: { traceId: { type: "string" } } } }),
    expect: [{ at: at("headers"), action: "add", type: dir(breaking, nonBreaking), mentions: ["headers", CH] }],
    // ISSUE-62 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-029",
    title: "message headers schema removed",
    before: "headers { type: object, properties: { traceId: string } }",
    after: "message without headers",
    rationale:
      "dropping the headers schema widens the headers: breaking for consumers of a produced message, non-breaking for a consumed one",
    annotation: "names headers and the channel",
    sources: [asyncapiDiff("v3.ts /channels/*/messages/*/headers"), ...v2msg("headers", "unclassified")],
    docs: four({ headers: { type: "object", properties: { traceId: { type: "string" } } } }, {}),
    expect: [{ at: at("headers"), action: "remove", type: dir(nonBreaking, breaking), mentions: ["headers", CH] }],
    // ISSUE-62 (fixed)
  },
  // ---- $ref messages and message keys
  {
    kind: "doc",
    id: "AA-MSG-030",
    title: "property type changed inside a components/messages message used through $ref",
    before: "message $ref components/messages/Signup, payload.displayName string",
    after: "the same reference, payload.displayName integer",
    rationale: "a type change breaks both directions; the change is reported at the usage and at the component",
    annotation: "names the property and the channel (usage) or the message component",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/what_changed_test.go TestCompareDocuments_DelegatedSchemaChange kafkaMessage payload",
      },
      { tool: "libasyncapi", ref: "what-changed/model/proof_test.go TestProof_DelegatedSchemaDiff" },
      asd("test/asyncapi/edge-cases.test.ts message $ref to components/messages is classified at the usage path"),
      { tool: "bench", ref: "aa2-events / aa3-events A3" },
    ],
    docs: (() => {
      const comp = (type: string) => ({
        components: {
          messages: { Signup: { name: "signup", payload: { type: "object", properties: { displayName: { type } } } } },
        },
      })
      const ref = { $ref: "#/components/messages/Signup" }
      const v2 = (op: "publish" | "subscribe", type: string) => ({
        asyncapi: "2.6.0",
        info,
        channels: { "user/signup": { [op]: { message: ref } } },
        ...comp(type),
      })
      const v3 = (action: "send" | "receive", type: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: { userSignup: { address: "user/signup", messages: { signup: ref } } },
        operations: {
          onSignup: {
            action,
            channel: { $ref: "#/channels/userSignup" },
            messages: [{ $ref: "#/channels/userSignup/messages/signup" }],
          },
        },
        ...comp(type),
      })
      return {
        "2.6-pub": [v2("publish", "string"), v2("publish", "integer")] as [unknown, unknown],
        "2.6-sub": [v2("subscribe", "string"), v2("subscribe", "integer")] as [unknown, unknown],
        "3.0-send": [v3("send", "string"), v3("send", "integer")] as [unknown, unknown],
        "3.0-receive": [v3("receive", "string"), v3("receive", "integer")] as [unknown, unknown],
      }
    })(),
    expect: [
      {
        at: [
          ...at("payload/properties/displayName/type"),
          "components/messages/Signup/payload/properties/displayName/type",
        ],
        action: "replace",
        type: breaking,
        mentions: ["displayName", /user\/signup|userSignup|`Signup`/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-MSG-031",
    title: "message $ref switched to another component message",
    before: "message $ref components/messages/SignupV1 (name signupV1, userId string)",
    after: "message $ref components/messages/SignupV2 (name signupV2, userId integer)",
    rationale:
      "the effective message changes: the name change is non-breaking, the payload type change breaks both directions",
    annotation: "names the changed fields and the channel",
    sources: [asd("message $ref resolution (refsCompareResolver)")],
    docs: (() => {
      const messages = {
        SignupV1: { name: "signupV1", payload: { type: "object", properties: { userId: { type: "string" } } } },
        SignupV2: { name: "signupV2", payload: { type: "object", properties: { userId: { type: "integer" } } } },
      }
      const v2 = (op: "publish" | "subscribe", n: string) => ({
        asyncapi: "2.6.0",
        info,
        channels: { "user/signup": { [op]: { message: { $ref: `#/components/messages/${n}` } } } },
        components: { messages },
      })
      const v3 = (action: "send" | "receive", n: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userSignup: { address: "user/signup", messages: { signup: { $ref: `#/components/messages/${n}` } } },
        },
        operations: {
          onSignup: {
            action,
            channel: { $ref: "#/channels/userSignup" },
            messages: [{ $ref: "#/channels/userSignup/messages/signup" }],
          },
        },
        components: { messages },
      })
      return {
        "2.6-pub": [v2("publish", "SignupV1"), v2("publish", "SignupV2")] as [unknown, unknown],
        "2.6-sub": [v2("subscribe", "SignupV1"), v2("subscribe", "SignupV2")] as [unknown, unknown],
        "3.0-send": [v3("send", "SignupV1"), v3("send", "SignupV2")] as [unknown, unknown],
        "3.0-receive": [v3("receive", "SignupV1"), v3("receive", "SignupV2")] as [unknown, unknown],
      }
    })(),
    expect: [
      { at: at("name"), action: "replace", type: nonBreaking, mentions: ["name", CH] },
      { at: at("payload/properties/userId/type"), action: "replace", type: breaking, mentions: ["userId", CH] },
    ],
    // ISSUE-105 (fixed)
  },
  {
    kind: "doc",
    id: "AA-MSG-032",
    title: "AsyncAPI 3 channel message key renamed with references updated",
    before: "channels.userSignup.messages.signup, operation refs .../messages/signup",
    after: "channels.userSignup.messages.registration (same content), operation refs .../messages/registration",
    rationale: "the message key is a document-internal id: the message on the wire is unchanged",
    annotation: "one rename annotation at the channel's messages map naming both keys and the channel (POLICY-100)",
    sources: [fork("test/asyncapi.firstReferenceKeyMapping.test.ts messages mapped by firstReferenceKeyProperty")],
    docs: (() => {
      const v3 = (action: "send" | "receive", key: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: { userSignup: { address: "user/signup", messages: { [key]: { payload } } } },
        operations: {
          onSignup: {
            action,
            channel: { $ref: "#/channels/userSignup" },
            messages: [{ $ref: `#/channels/userSignup/messages/${key}` }],
          },
        },
      })
      return {
        "3.0-send": [v3("send", "signup"), v3("send", "registration")] as [unknown, unknown],
        "3.0-receive": [v3("receive", "signup"), v3("receive", "registration")] as [unknown, unknown],
      }
    })(),
    expect: [
      {
        at: "channels/userSignup/messages",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["message", "signup", "registration", "userSignup"],
      },
    ],
    // ISSUE-78 (fixed) (P8-rest); POLICY-100 decided (P8c): the former expectation was an optional annotation removal
    // plus addition at the message entries and optional annotations for the repointed operation reference
  },
  {
    kind: "doc",
    id: "AA-MSG-033",
    title: "AsyncAPI 3 message removed from a channel and from its operation",
    before: "channel userSignup messages signup, deleted; operation lists both",
    after: "channel userSignup message signup; operation lists signup",
    rationale:
      "removing a message kind removes a capability in both directions (consistent with AA-OP-027 / AA-OP-028)",
    annotation: "names the removed message",
    sources: [asyncapiDiff("v3.ts /channels/*/messages/*"), asyncapiDiff("v3.ts /operations/*/messages/*")],
    docs: (() => {
      const v3 = (action: "send" | "receive", both: boolean) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userSignup: {
            address: "user/signup",
            messages: both ? { signup: { payload }, deleted: { payload } } : { signup: { payload } },
          },
        },
        operations: {
          onSignup: {
            action,
            channel: { $ref: "#/channels/userSignup" },
            messages: (both ? ["signup", "deleted"] : ["signup"]).map((m) => ({
              $ref: `#/channels/userSignup/messages/${m}`,
            })),
          },
        },
      })
      return {
        "3.0-send": [v3("send", true), v3("send", false)] as [unknown, unknown],
        "3.0-receive": [v3("receive", true), v3("receive", false)] as [unknown, unknown],
      }
    })(),
    expect: [
      {
        at: "channels/userSignup/messages/deleted",
        action: "remove",
        type: breaking,
        mentions: ["deleted", "userSignup"],
      },
      { at: "operations/onSignup/messages/**", action: "remove", type: breaking, mentions: ["deleted"] },
    ],
    // ISSUE-52 (fixed): classified by direction; the operation-list item ("item [1]") is ISSUE-114
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-MSG-034",
    title: "AsyncAPI 3 payload change of a channel message no operation uses",
    before: "channels.userSignup.messages.audit payload.userId string, no operation lists audit",
    after: "payload.userId integer",
    rationale: "DESIGN_PROPOSALS §11.4: without a usage the change is unclassified with a description",
    annotation: "names the property and the channel",
    sources: [asd("test/asyncapi/asyncapi3.test.ts H7 unreferenced channel message is unclassified")],
    docs: (() => {
      const v3 = (type: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userSignup: {
            address: "user/signup",
            messages: { audit: { payload: { type: "object", properties: { userId: { type } } } } },
          },
        },
        operations: {},
      })
      return [v3("string"), v3("integer")] as [unknown, unknown]
    })(),
    expect: [
      {
        at: "channels/userSignup/messages/audit/payload/properties/userId/type",
        action: "replace",
        type: unclassified,
        mentions: ["userId", "userSignup"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-MSG-035",
    title: "equal payload schema switched between JSON Schema compatible formats",
    before:
      "2.6: no schemaFormat (AsyncAPI) / 3.0: plain payload / payload { draft-07, schema } / { draft-07, schema with a tuple `items` }",
    after:
      "2.6: schemaFormat draft-07 / 3.0: payload { draft-07, same schema } / { 2020-12, same schema } / { 2020-12, same schema }",
    rationale:
      "POLICY-82 decided: the AsyncAPI schema is a draft-07 superset and the JSON Schema drafts read an equal schema without draft-specific keywords the same way, so the valid payloads are unchanged (annotation, consistent with POLICY-28); a tuple `items` means something else in 2020-12 (breaking)",
    annotation: "names schemaFormat and the channel",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-82" }],
    docs: (() => {
      const DRAFT7 = "application/schema+json;version=draft-07"
      const DRAFT2020 = "application/schema+json;version=2020-12"
      const tuple = { type: "array", items: [{ type: "string" }, { type: "integer" }] }
      return {
        ...v2only({}, { schemaFormat: DRAFT7 }),
        ...Object.fromEntries(
          Object.entries(v3only({}, { payload: { schemaFormat: DRAFT7, schema: payload } })).map(([k, v]) => [
            `${k}-wrapped`,
            v,
          ]),
        ),
        "3.0-send-drafts": [
          m3("send", { payload: { schemaFormat: DRAFT7, schema: payload } }),
          m3("send", { payload: { schemaFormat: DRAFT2020, schema: payload } }),
        ] as [unknown, unknown],
        "3.0-send-tuple": [
          m3("send", { payload: { schemaFormat: DRAFT7, schema: tuple } }),
          m3("send", { payload: { schemaFormat: DRAFT2020, schema: tuple } }),
        ] as [unknown, unknown],
      }
    })(),
    expect: {
      "*": [
        {
          at: [...at("schemaFormat"), ...at("payload/schemaFormat")],
          type: annotation,
          mentions: ["schemaFormat", CH],
        },
      ],
      "3.0-send-tuple": [
        { at: at("payload/schemaFormat"), action: "replace", type: breaking, mentions: ["schemaFormat", CH] },
      ],
    },
    // POLICY-82 decided (P8a)
  },
  // POLICY-101 (P8c): a channel message renamed and changed at once is paired by its reference sites
  {
    kind: "doc",
    id: "AA-MSG-036",
    title: "AsyncAPI 3 channel message renamed with references repointed and a breaking change",
    before: "channels.userSignup.messages.signup (userId string), operation refs .../messages/signup",
    after: "channels.userSignup.messages.registration (userId integer), operation refs .../messages/registration",
    rationale:
      "POLICY-101: every reference moved to the new key, so the key change is one rename annotation; the messages are compared on their own: the payload type change is breaking in both directions",
    annotation: "names both keys and the channel for the rename; the changed property with the channel",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101" }],
    docs: (() => {
      const v3 = (action: "send" | "receive", key: string, type: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userSignup: {
            address: "user/signup",
            messages: { [key]: { payload: { type: "object", properties: { userId: { type } } } } },
          },
        },
        operations: {
          onSignup: {
            action,
            channel: { $ref: "#/channels/userSignup" },
            messages: [{ $ref: `#/channels/userSignup/messages/${key}` }],
          },
        },
      })
      return {
        "3.0-send": [v3("send", "signup", "string"), v3("send", "registration", "integer")] as [unknown, unknown],
        "3.0-receive": [v3("receive", "signup", "string"), v3("receive", "registration", "integer")] as [
          unknown,
          unknown,
        ],
      }
    })(),
    expect: [
      {
        at: "channels/userSignup/messages",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["signup", "registration"],
      },
      {
        at: "channels/userSignup/messages/signup/payload/properties/userId/type",
        action: "replace",
        type: breaking,
        count: 1,
        mentions: ["userId", "userSignup"],
      },
    ],
  },
  // ISSUE-301 (fixed) (P8d): a channel message renamed in a renamed channel was a removal plus an addition (the messages
  // map of a renamed channel was no rename candidate)
  {
    kind: "doc",
    id: "AA-MSG-037",
    title: "AsyncAPI 3 channel renamed together with its message, every reference repointed",
    before: "channels.userSignup.messages.signup, operation refs userSignup and .../messages/signup",
    after: "channels.userRegistration.messages.registration (same definitions), operation refs repointed",
    rationale:
      "POLICY-100 / POLICY-101 / POLICY-105: the channel keeps 2 of its 3 direct fields and every reference of the message moved with both renames, so both are renames (annotations) and the repointed operation references are no change",
    annotation: "names both channel ids and both message keys; the message rename names the channel's new and old key",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-100 / POLICY-101 / POLICY-105" }],
    docs: (() => {
      const v3 = (action: "send" | "receive", channel: string, key: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          [channel]: { address: "user/signup", description: "Sign-ups", messages: { [key]: { payload } } },
        },
        operations: {
          onSignup: {
            action,
            channel: { $ref: `#/channels/${channel}` },
            messages: [{ $ref: `#/channels/${channel}/messages/${key}` }],
          },
        },
      })
      return {
        "3.0-send": [v3("send", "userSignup", "signup"), v3("send", "userRegistration", "registration")] as [
          unknown,
          unknown,
        ],
        "3.0-receive": [v3("receive", "userSignup", "signup"), v3("receive", "userRegistration", "registration")] as [
          unknown,
          unknown,
        ],
      }
    })(),
    expect: [
      { at: "channels", action: "rename", type: annotation, count: 1, mentions: ["userSignup", "userRegistration"] },
      {
        at: "channels/userSignup/messages",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["signup", "registration", "userRegistration"],
      },
    ],
  },
  // POLICY-116 decided (changed, P8f): a field that differs only by the keys of a nested renameable map renamed together
  // with the entry (a 3.0 channel's `messages`) counts as equal for the direct field share
  {
    kind: "doc",
    id: "AA-MSG-038",
    title: "AsyncAPI 3 channel with only an address renamed together with its message",
    before: "channels.userSignup { address, messages.signup }, operation refs userSignup and .../messages/signup",
    after: "channels.userRegistration { same address, messages.registration (same definition) }, refs repointed",
    rationale:
      "POLICY-116: the channel's `messages` differs only by the key of the message renamed with it, so 2 of 2 direct fields are equal (before P8f: 1 of 2, exactly 50 %, the channel was removed and added and every operation reference retargeted as breaking); both are renames (annotations) and the repointed operation references are no change",
    annotation: "names both channel ids and both message keys; the message rename names the channel's new and old key",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-116" }],
    docs: (() => {
      const v3 = (action: "send" | "receive", channel: string, key: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: { [channel]: { address: "user/signup", messages: { [key]: { payload } } } },
        operations: {
          onSignup: {
            action,
            channel: { $ref: `#/channels/${channel}` },
            messages: [{ $ref: `#/channels/${channel}/messages/${key}` }],
          },
        },
      })
      return {
        "3.0-send": [v3("send", "userSignup", "signup"), v3("send", "userRegistration", "registration")] as [
          unknown,
          unknown,
        ],
        "3.0-receive": [v3("receive", "userSignup", "signup"), v3("receive", "userRegistration", "registration")] as [
          unknown,
          unknown,
        ],
      }
    })(),
    expect: [
      { at: "channels", action: "rename", type: annotation, count: 1, mentions: ["userSignup", "userRegistration"] },
      {
        at: "channels/userSignup/messages",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["signup", "registration", "userRegistration"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-MSG-039",
    title: "AsyncAPI 3 channel renamed together with one of its two messages",
    before: "channels.userSignup { address, messages { signup, audit } }, operations ref the channel and both messages",
    after:
      "channels.userRegistration { same address, messages { registration (same as signup), audit } }, refs repointed",
    rationale:
      "POLICY-116: `messages` differs only by the key of signup, renamed with the channel to registration (audit keeps its key), so 2 of 2 direct fields are equal: two renames (annotations), no other change",
    annotation: "names both channel ids and both message keys",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-116" }],
    docs: (() => {
      const audit = { payload: { type: "object", properties: { at: { type: "string" } } } }
      const v3 = (action: "send" | "receive", channel: string, key: string) => ({
        asyncapi: "3.0.0",
        info,
        channels: { [channel]: { address: "user/signup", messages: { [key]: { payload }, audit } } },
        operations: {
          onSignup: {
            action,
            channel: { $ref: `#/channels/${channel}` },
            messages: [
              { $ref: `#/channels/${channel}/messages/${key}` },
              { $ref: `#/channels/${channel}/messages/audit` },
            ],
          },
        },
      })
      return {
        "3.0-send": [v3("send", "userSignup", "signup"), v3("send", "userRegistration", "registration")] as [
          unknown,
          unknown,
        ],
        "3.0-receive": [v3("receive", "userSignup", "signup"), v3("receive", "userRegistration", "registration")] as [
          unknown,
          unknown,
        ],
      }
    })(),
    expect: [
      { at: "channels", action: "rename", type: annotation, count: 1, mentions: ["userSignup", "userRegistration"] },
      {
        at: "channels/userSignup/messages",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["signup", "registration"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-MSG-040",
    title: "AsyncAPI 3 channel whose only message was replaced by a different one is not renamed",
    before: "channels.userSignup { address, messages.signup { payload { userId } } }, operation refs both",
    after:
      "channels.userRegistration { same address, messages.registration { payload { count integer } } }, refs repointed",
    rationale:
      "POLICY-116: only a key renamed together with the entry counts; registration shares no direct field with signup (its payload differs), so it is not signup renamed and `messages` differs: 1 of 2 direct fields, exactly 50 %, the channel is removed and another added, and the operation now uses another channel (nominal, breaking) and another message (the old one removed, breaking; the new one added, non-breaking for a received message)",
    annotation: "names the removed and the added channel and the operation",
    sources: [{ tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-116" }],
    docs: (() => {
      const other = { payload: { type: "object", properties: { count: { type: "integer" } } } }
      const v3 = (channel: string, key: string, message: unknown) => ({
        asyncapi: "3.0.0",
        info,
        channels: { [channel]: { address: "user/signup", messages: { [key]: message } } },
        operations: {
          onSignup: {
            action: "receive",
            channel: { $ref: `#/channels/${channel}` },
            messages: [{ $ref: `#/channels/${channel}/messages/${key}` }],
          },
        },
      })
      return [v3("userSignup", "signup", { payload }), v3("userRegistration", "registration", other)] as [
        unknown,
        unknown,
      ]
    })(),
    expect: [
      { at: "channels/userSignup", action: "remove", type: breaking, count: 1, mentions: ["userSignup"] },
      { at: "channels/userRegistration", action: "add", type: nonBreaking, count: 1, mentions: ["userRegistration"] },
      {
        at: "operations/onSignup/channel/$ref",
        action: "replace",
        type: breaking,
        count: 1,
        mentions: ["onSignup", "userRegistration"],
      },
      { at: "operations/onSignup/messages/0", action: "remove", type: breaking, count: 1, mentions: ["signup"] },
      { at: "operations/onSignup/messages/0", action: "add", type: nonBreaking, count: 1, mentions: ["registration"] },
    ],
  },
]

runCases("asyncapi", "messages", cases, import.meta.filename)
