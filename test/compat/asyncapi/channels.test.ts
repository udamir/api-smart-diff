// AsyncAPI channels: added / removed / renamed channels, the 3.0 `address`, documentation fields and channel parameters (2.x parameter schema and location, 3.0 enum / default / location / examples).

import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const payload = { type: "object", properties: { id: { type: "string" } } }
const aa20 = (channels: unknown, extra: Record<string, unknown> = {}) => ({
  asyncapi: "2.0.0",
  info,
  channels,
  ...extra,
})
const aa2 = (channels: unknown, extra: Record<string, unknown> = {}) => ({
  asyncapi: "2.6.0",
  info,
  channels,
  ...extra,
})
const aa3 = (channels: unknown, operations: unknown = {}, extra: Record<string, unknown> = {}) => ({
  asyncapi: "3.0.0",
  info,
  channels,
  operations,
  ...extra,
})
const op3 = (action: "send" | "receive", channel: string, messages: string[], extra: Record<string, unknown> = {}) => ({
  action,
  channel: { $ref: `#/channels/${channel}` },
  messages: messages.map((m) => ({ $ref: `#/channels/${channel}/messages/${m}` })),
  ...extra,
})

// 2.x: one produced and one consumed channel
const sub = (extra: Record<string, unknown> = {}) => ({ subscribe: { message: { payload } }, ...extra })
const pub = (extra: Record<string, unknown> = {}) => ({ publish: { message: { payload } }, ...extra })
// 3.0: channel with one message
const chan = (address: string | undefined, extra: Record<string, unknown> = {}) => ({
  ...(address === undefined ? {} : { address }),
  messages: { event: { payload } },
  ...extra,
})

const asyncapiDiff = (ref: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string) => ({ tool: "asd", ref })

// 2.x channel `user/{userId}` with one parameter
const param2 = (param: unknown, extra: Record<string, unknown> = {}) =>
  aa2({ "user/{userId}": { parameters: { userId: param }, ...sub() } }, extra)
// 3.0 channel `user/{userId}` with one parameter
const param3 = (param: unknown, extra: Record<string, unknown> = {}) =>
  aa3(
    { user: chan("user/{userId}", { parameters: { userId: param } }) },
    { onUser: op3("send", "user", ["event"]) },
    extra,
  )

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-CH-001",
    title: "channel removed",
    before: "channels user/signup and audit/log",
    after: "channel user/signup only (3.0: its operation removed too)",
    rationale: "clients publishing to or subscribed on the removed channel lose it",
    annotation: "names the removed channel (and the removed 3.0 operation)",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/what_changed_test.go TestCompareDocuments_ChannelAddedAndRemoved ws-channel removed",
      },
      asyncapiDiff("v2.ts /channels/*"),
      asyncapiDiff("v3.ts /channels/*"),
      asd("test/asyncapi/edge-cases.test.ts removing a channel is breaking"),
      { tool: "bench", ref: "aa2-events / aa3-events A1" },
    ],
    docs: {
      "2.0": [aa20({ "user/signup": sub(), "audit/log": sub() }), aa20({ "user/signup": sub() })],
      "2.6": [aa2({ "user/signup": sub(), "audit/log": sub() }), aa2({ "user/signup": sub() })],
      "3.0": [
        aa3(
          { userSignup: chan("user/signup"), auditLog: chan("audit/log") },
          { onSignup: op3("send", "userSignup", ["event"]), onAudit: op3("send", "auditLog", ["event"]) },
        ),
        aa3({ userSignup: chan("user/signup") }, { onSignup: op3("send", "userSignup", ["event"]) }),
      ],
    },
    expect: {
      "*": [{ at: "channels/audit~1log", action: "remove", type: breaking, mentions: ["audit/log"] }],
      "3.0": [
        { at: "channels/auditLog", action: "remove", type: breaking, mentions: ["auditLog"] },
        { at: "operations/onAudit", action: "remove", type: breaking, mentions: ["onAudit"] },
      ],
    },
  },
  {
    kind: "doc",
    id: "AA-CH-002",
    title: "channel added",
    before: "channel user/signup",
    after: "channels user/signup and user/deleted (3.0: with a send operation)",
    rationale: "existing clients never use the new channel",
    annotation: "names the added channel (and the added 3.0 operation)",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/what_changed_test.go TestCompareDocuments_ChannelAddedAndRemoved audit-channel added",
      },
      asyncapiDiff("v2.ts /channels/*"),
      asyncapiDiff("v3.ts /channels/*"),
      asd("test/asyncapi/edge-cases.test.ts adding a channel is non-breaking"),
      { tool: "bench", ref: "aa2-events / aa3-events A2" },
      { tool: "fork", ref: "test/asyncapi.diff.test.ts classifies adding a send operation as non-breaking" },
    ],
    docs: {
      "2.0": [aa20({ "user/signup": sub() }), aa20({ "user/signup": sub(), "user/deleted": sub() })],
      "2.6": [aa2({ "user/signup": sub() }), aa2({ "user/signup": sub(), "user/deleted": sub() })],
      "3.0": [
        aa3({ userSignup: chan("user/signup") }, { onSignup: op3("send", "userSignup", ["event"]) }),
        aa3(
          { userSignup: chan("user/signup"), userDeleted: chan("user/deleted") },
          { onSignup: op3("send", "userSignup", ["event"]), onDeleted: op3("send", "userDeleted", ["event"]) },
        ),
      ],
    },
    expect: {
      "*": [{ at: "channels/user~1deleted", action: "add", type: nonBreaking, mentions: ["user/deleted"] }],
      "3.0": [
        { at: "channels/userDeleted", action: "add", type: nonBreaking, mentions: ["userDeleted"] },
        { at: "operations/onDeleted", action: "add", type: nonBreaking, mentions: ["onDeleted"] },
      ],
    },
  },
  {
    kind: "doc",
    id: "AA-CH-003",
    title: "AsyncAPI 3 channel added without any operation",
    before: "channel userSignup",
    after: "channels userSignup and userDeleted (no operation uses it)",
    rationale: "a channel no operation uses changes nothing a client does",
    annotation: "names the added channel",
    sources: [asyncapiDiff("v3.ts /channels/*")],
    docs: [
      aa3({ userSignup: chan("user/signup") }, { onSignup: op3("send", "userSignup", ["event"]) }),
      aa3(
        { userSignup: chan("user/signup"), userDeleted: chan("user/deleted") },
        { onSignup: op3("send", "userSignup", ["event"]) },
      ),
    ],
    expect: [{ at: "channels/userDeleted", action: "add", type: nonBreaking, mentions: ["userDeleted"] }],
  },
  {
    kind: "doc",
    id: "AA-CH-004",
    title: "AsyncAPI 2 channel name changed",
    before: "channel user/signup",
    after: "channel user/register",
    rationale:
      "in 2.x the channel name is the address: clients of user/signup lose their channel, user/register is new",
    annotation: "names the removed and the added channel",
    sources: [asyncapiDiff("v2.ts /channels/*")],
    docs: {
      "2.0": [aa20({ "user/signup": sub() }), aa20({ "user/register": sub() })],
      "2.6": [aa2({ "user/signup": sub() }), aa2({ "user/register": sub() })],
    },
    expect: [
      { at: "channels/user~1signup", action: "remove", type: breaking, mentions: ["user/signup"] },
      { at: "channels/user~1register", action: "add", type: nonBreaking, mentions: ["user/register"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-005",
    title: "AsyncAPI 3 channel address changed",
    before: "address user/signup",
    after: "address user/register",
    rationale: "producers and consumers connected to the old address no longer meet the application",
    annotation: "names the channel, address and the new address",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/channel_test.go TestCompareChannels_AddressStateTransitions value modified",
      },
      asyncapiDiff("v3.ts /channels/*/address"),
      {
        tool: "openapi-changes",
        ref: "sample-specs/asyncapi-original.yaml -> asyncapi.yaml (address orders.v1 -> orders.v2), cmd/asyncapi_test.go TestAsyncAPIRulesAreScoped",
      },
      asd("test/asyncapi/asyncapi3.test.ts H3 the address is breaking"),
    ],
    docs: [
      aa3({ userSignup: chan("user/signup") }, { onSignup: op3("send", "userSignup", ["event"]) }),
      aa3({ userSignup: chan("user/register") }, { onSignup: op3("send", "userSignup", ["event"]) }),
    ],
    expect: [
      {
        at: "channels/userSignup/address",
        action: "replace",
        type: breaking,
        mentions: ["address", "userSignup", "user/register"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CH-006",
    title: "AsyncAPI 3 channel address removed (becomes unknown)",
    before: "address user/signup",
    after: "no address (dynamic, unknown)",
    rationale: "3.0 §Channel Object: an absent address is unknown; clients lose the address they connect to",
    annotation: "names the channel and address",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/channel_test.go TestCompareChannels_AddressStateTransitions value to absent",
      },
      asyncapiDiff("v3.ts /channels/*/address"),
    ],
    docs: [
      aa3({ userSignup: chan("user/signup") }, { onSignup: op3("send", "userSignup", ["event"]) }),
      aa3({ userSignup: chan(undefined) }, { onSignup: op3("send", "userSignup", ["event"]) }),
    ],
    expect: [
      { at: "channels/userSignup/address", action: "remove", type: breaking, mentions: ["address", "userSignup"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-007",
    title: "AsyncAPI 3 channel address added (was unknown)",
    before: "no address (dynamic, unknown)",
    after: "address user/signup",
    rationale:
      "a client following the before document cannot rely on any address and obtains it at runtime; documenting the address cannot break it (@asyncapi/diff: add non-breaking)",
    annotation: "names the channel, address and the address value",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/channel_test.go TestCompareChannels_AddressStateTransitions absent to value",
        verdict: "breaking",
      },
      asyncapiDiff("v3.ts /channels/*/address"),
    ],
    docs: [
      aa3({ userSignup: chan(undefined) }, { onSignup: op3("send", "userSignup", ["event"]) }),
      aa3({ userSignup: chan("user/signup") }, { onSignup: op3("send", "userSignup", ["event"]) }),
    ],
    expect: [
      {
        at: "channels/userSignup/address",
        action: "add",
        type: nonBreaking,
        mentions: ["address", "userSignup", "user/signup"],
      },
    ],
    // ISSUE-114 (fixed) (P8a); ISSUE-110 (fixed)
  },
  {
    kind: "doc",
    id: "AA-CH-008",
    title: "AsyncAPI 3 channel key renamed with the same address",
    before: "channel userSignup (address user/signup), operation refs #/channels/userSignup",
    after: "channel userRegistration (address user/signup), operation refs #/channels/userRegistration",
    rationale:
      "the channel key is a document-internal id: address, messages and operations on the wire are unchanged, so nothing breaks",
    annotation: "one rename annotation at the channels map naming both channel ids (POLICY-100)",
    sources: [
      {
        tool: "fork",
        ref: "test/asyncapi.firstReferenceKeyMapping.test.ts (key-based mapping of channels/operations)",
      },
    ],
    docs: [
      aa3({ userSignup: chan("user/signup") }, { onSignup: op3("send", "userSignup", ["event"]) }),
      aa3({ userRegistration: chan("user/signup") }, { onSignup: op3("send", "userRegistration", ["event"]) }),
    ],
    expect: [
      {
        at: "channels",
        action: "rename",
        type: annotation,
        count: 1,
        mentions: ["channel", "userSignup", "userRegistration"],
      },
    ],
    // ISSUE-78 (fixed) (P8-rest); POLICY-100 decided (P8c): the former expectation was an optional annotation removal
    // plus addition at the channel entries and optional annotations for the repointed operation references
  },
  {
    kind: "doc",
    id: "AA-CH-009",
    title: "channel description changed",
    before: "description 'Orders'",
    after: "description 'Orders created by the shop'",
    rationale: "documentation only",
    annotation: "names the channel and description",
    sources: [
      asyncapiDiff("v2.ts /channels/*/description"),
      asyncapiDiff("v3.ts /channels/*/description"),
      { tool: "bench", ref: "aa2-events / aa3-events A12" },
      asd("test/asyncapi/edge-cases.test.ts channel description change is an annotation"),
    ],
    docs: {
      "2.0": [
        aa20({ "order/created": pub({ description: "Orders" }) }),
        aa20({ "order/created": pub({ description: "Orders created by the shop" }) }),
      ],
      "2.6": [
        aa2({ "order/created": pub({ description: "Orders" }) }),
        aa2({ "order/created": pub({ description: "Orders created by the shop" }) }),
      ],
      "3.0": [
        aa3(
          { orderCreated: chan("order/created", { description: "Orders" }) },
          { onOrder: op3("receive", "orderCreated", ["event"]) },
        ),
        aa3(
          { orderCreated: chan("order/created", { description: "Orders created by the shop" }) },
          { onOrder: op3("receive", "orderCreated", ["event"]) },
        ),
      ],
    },
    expect: [
      {
        at: "channels/*/description",
        action: "replace",
        type: annotation,
        mentions: ["description", /order\/created|orderCreated/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-010",
    title: "channel description added and removed",
    before: "channel a without description, channel b with description",
    after: "channel a with description, channel b without",
    rationale: "documentation only",
    annotation: "names the channel and description",
    sources: [asyncapiDiff("v2.ts /channels/*/description"), asyncapiDiff("v3.ts /channels/*/description")],
    docs: {
      "2.6": [
        aa2({ "a/x": sub(), "b/x": sub({ description: "B" }) }),
        aa2({ "a/x": sub({ description: "A" }), "b/x": sub() }),
      ],
      "3.0": [
        aa3({ a: chan("a/x"), b: chan("b/x", { description: "B" }) }),
        aa3({ a: chan("a/x", { description: "A" }), b: chan("b/x") }),
      ],
    },
    expect: [
      { at: "channels/*/description", action: "add", type: annotation, mentions: ["description", /a\/x|`a`|\.a\b/] },
      { at: "channels/*/description", action: "remove", type: annotation, mentions: ["description", /b\/x|`b`|\.b\b/] },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-011",
    title: "AsyncAPI 3 channel title and summary changed",
    before: "title 'Signup', no summary",
    after: "title 'Registration', summary set",
    rationale: "documentation only",
    annotation: "names the channel and the field",
    sources: [asyncapiDiff("v3.ts /channels/*/title"), asyncapiDiff("v3.ts /channels/*/summary")],
    docs: [
      aa3({ userSignup: chan("user/signup", { title: "Signup" }) }),
      aa3({ userSignup: chan("user/signup", { title: "Registration", summary: "User registrations" }) }),
    ],
    expect: [
      { at: "channels/userSignup/title", action: "replace", type: annotation, mentions: ["title", "userSignup"] },
      { at: "channels/userSignup/summary", action: "add", type: annotation, mentions: ["summary", "userSignup"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-012",
    title: "AsyncAPI 3 channel tags and externalDocs added",
    before: "channel without tags / externalDocs",
    after: "channel with tags [users] and externalDocs",
    rationale: "documentation only",
    annotation: "names the channel and the field",
    sources: [asyncapiDiff("v3.ts /channels/*/tags"), asyncapiDiff("v3.ts /channels/*/externalDocs")],
    docs: [
      aa3({ userSignup: chan("user/signup") }),
      aa3({
        userSignup: chan("user/signup", {
          tags: [{ name: "users" }],
          externalDocs: { url: "https://docs.example.com" },
        }),
      }),
    ],
    expect: [
      { at: "channels/userSignup/tags", action: "add", type: annotation, mentions: ["tags", "userSignup"] },
      {
        at: "channels/userSignup/externalDocs",
        action: "add",
        type: annotation,
        mentions: ["externalDocs", "userSignup"],
      },
    ],
  },
  // ---- 2.x parameters
  {
    kind: "doc",
    id: "AA-CH-013",
    title: "AsyncAPI 2 channel parameter description added",
    before: "parameter userId without description",
    after: "parameter userId described",
    rationale: "documentation only",
    annotation: "names the parameter and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/parameters/*/description"),
      asd("test/asyncapi/edge-cases.test.ts channel parameter description change"),
    ],
    docs: [param2({ schema: { type: "string" } }), param2({ description: "The user id", schema: { type: "string" } })],
    expect: [
      {
        at: "channels/*/parameters/userId/description",
        action: "add",
        type: annotation,
        mentions: ["userId", "user/{userId}"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-014",
    title: "AsyncAPI 2 channel parameter schema type changed",
    before: "parameter userId string",
    after: "parameter userId integer",
    rationale: "clients build the channel name from the parameter: values valid before are rejected",
    annotation: "names the parameter, the channel and the type",
    sources: [
      asyncapiDiff("v2.ts /channels/*/parameters/*/schema", "unclassified"),
      asd("test/asyncapi/edge-cases.test.ts channel parameter schema type change is breaking"),
    ],
    docs: [param2({ schema: { type: "string" } }), param2({ schema: { type: "integer" } })],
    expect: [
      {
        at: "channels/*/parameters/userId/schema/type",
        action: "replace",
        type: breaking,
        mentions: ["userId", "user/{userId}", "type"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-015",
    title: "AsyncAPI 2 channel parameter enum value removed",
    before: "parameter region enum [eu, us]",
    after: "parameter region enum [eu]",
    rationale: "clients publishing or subscribing on region us lose their channel",
    annotation: "names the parameter, the channel and the removed value",
    sources: [asyncapiDiff("v2.ts /channels/*/parameters/*/schema", "unclassified")],
    docs: [
      param2({ schema: { type: "string", enum: ["eu-west", "us-east"] } }),
      param2({ schema: { type: "string", enum: ["eu-west"] } }),
    ],
    expect: [
      {
        at: "channels/*/parameters/userId/schema/enum/**",
        action: "remove",
        type: breaking,
        mentions: ["userId", "user/{userId}", "us-east"],
      },
    ],
    // ISSUE-57 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CH-016",
    title: "AsyncAPI 2 channel parameter enum value added",
    before: "parameter enum [eu]",
    after: "parameter enum [eu, us]",
    rationale: "every channel name valid before is still valid",
    annotation: "names the parameter, the channel and the added value",
    sources: [asyncapiDiff("v2.ts /channels/*/parameters/*/schema", "unclassified")],
    docs: [
      param2({ schema: { type: "string", enum: ["eu-west"] } }),
      param2({ schema: { type: "string", enum: ["eu-west", "us-east"] } }),
    ],
    expect: [
      {
        at: "channels/*/parameters/userId/schema/enum/**",
        action: "add",
        type: nonBreaking,
        mentions: ["userId", "user/{userId}", "us-east"],
      },
    ],
    // ISSUE-57 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CH-017",
    title: "AsyncAPI 2 channel parameter pattern added",
    before: "parameter userId string",
    after: "parameter userId string pattern ^[0-9]+$",
    rationale: "parameter values valid before are rejected",
    annotation: "names the parameter, the channel and the pattern",
    sources: [asyncapiDiff("v2.ts /channels/*/parameters/*/schema", "unclassified")],
    docs: [param2({ schema: { type: "string" } }), param2({ schema: { type: "string", pattern: "^[0-9]+$" } })],
    expect: [
      {
        at: "channels/*/parameters/userId/schema/pattern",
        action: "add",
        type: breaking,
        mentions: ["userId", "user/{userId}", "pattern"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-018",
    title: "AsyncAPI 2 channel parameter maxLength decreased through a components/parameters $ref",
    before: "parameters.userId $ref components/parameters/userId (maxLength 36)",
    after: "the same reference, maxLength 8",
    rationale:
      "a narrower parameter rejects channel names that were valid; the component takes the classification of its usage",
    annotation: "names the parameter and the channel (usage) or the component",
    sources: [
      asyncapiDiff("v2.ts /channels/*/parameters/*/schema", "unclassified"),
      asd("DESIGN_PROPOSALS §11.4 usage-derived components"),
    ],
    docs: [
      param2(
        { $ref: "#/components/parameters/userId" },
        { components: { parameters: { userId: { schema: { type: "string", maxLength: 36 } } } } },
      ),
      param2(
        { $ref: "#/components/parameters/userId" },
        { components: { parameters: { userId: { schema: { type: "string", maxLength: 8 } } } } },
      ),
    ],
    expect: [
      {
        at: ["channels/*/parameters/userId/schema/maxLength", "components/parameters/userId/schema/maxLength"],
        action: "replace",
        type: breaking,
        mentions: ["userId", "maxLength", /user\/\{userId\}|component/],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CH-019",
    title: "AsyncAPI 2 channel parameter location changed",
    before: "location $message.payload#/user/id",
    after: "location $message.payload#/userId",
    rationale:
      "the runtime expression tells clients where the parameter value lives in the message; moving it breaks them",
    annotation: "names the parameter, the channel and location",
    sources: [asyncapiDiff("v2.ts /channels/*/parameters/*/location")],
    docs: [
      param2({ schema: { type: "string" }, location: "$message.payload#/user/id" }),
      param2({ schema: { type: "string" }, location: "$message.payload#/userId" }),
    ],
    expect: [
      {
        at: "channels/*/parameters/userId/location",
        action: "replace",
        type: breaking,
        mentions: ["location", "userId", "user/{userId}"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-020",
    title: "AsyncAPI 2 channel parameter location added",
    before: "parameter without location",
    after: "location $message.payload#/userId",
    rationale:
      "the parameter value must now be carried in the message at that location (@asyncapi/diff: breaking on add)",
    annotation: "names the parameter, the channel and location",
    sources: [asyncapiDiff("v2.ts /channels/*/parameters/*/location")],
    docs: [
      param2({ schema: { type: "string" } }),
      param2({ schema: { type: "string" }, location: "$message.payload#/userId" }),
    ],
    expect: [
      {
        at: "channels/*/parameters/userId/location",
        action: "add",
        type: breaking,
        mentions: ["location", "userId", "user/{userId}"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-021",
    title: "AsyncAPI 2 channel parameter definition removed",
    before: "channel user/{userId} with parameters.userId",
    after: "channel user/{userId} without parameter definitions",
    rationale: "clients lose the definition of the values they may use (@asyncapi/diff: breaking)",
    annotation: "names the parameter and the channel",
    sources: [asyncapiDiff("v2.ts /channels/*/parameters/*"), asyncapiDiff("v2.ts /channels/*/parameters")],
    docs: [param2({ schema: { type: "string" } }), aa2({ "user/{userId}": sub() })],
    expect: [
      { at: "channels/*/parameters/**", action: "remove", type: breaking, mentions: ["userId", "user/{userId}"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-022",
    title: "AsyncAPI 2 channel parameter definition added",
    before: "channel user/{userId} without parameter definitions",
    after: "channel user/{userId} with parameters.userId (no schema)",
    rationale: "documenting a previously undocumented parameter without constraints changes nothing for clients",
    annotation: "names the parameter and the channel",
    sources: [asyncapiDiff("v2.ts /channels/*/parameters/*"), asyncapiDiff("v2.ts /channels/*/parameters", "breaking")],
    docs: [aa2({ "user/{userId}": sub() }), param2({ description: "The user id" })],
    expect: [
      { at: "channels/*/parameters/**", action: "add", type: nonBreaking, mentions: ["userId", "user/{userId}"] },
    ],
  },
  // ---- 3.0 parameters
  {
    kind: "doc",
    id: "AA-CH-023",
    title: "AsyncAPI 3 channel parameter enum value removed",
    before: "parameter userId enum [alpha, beta]",
    after: "parameter userId enum [alpha]",
    rationale: "addresses built with the removed value no longer exist",
    annotation: "names the parameter, the channel and the removed value",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/model/coverage_test.go TestCompareParameters_EnumAddedAndRemoved" },
      asyncapiDiff("v3.ts /channels/*/parameters", "breaking"),
    ],
    docs: [param3({ enum: ["alpha", "beta"] }), param3({ enum: ["alpha"] })],
    expect: [
      {
        at: "channels/user/parameters/userId/enum/**",
        action: "remove",
        type: breaking,
        mentions: ["userId", "user", "beta"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CH-024",
    title: "AsyncAPI 3 channel parameter enum value added",
    before: "parameter userId enum [alpha]",
    after: "parameter userId enum [alpha, beta]",
    rationale: "every address valid before is still valid",
    annotation: "names the parameter, the channel and the added value",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/model/coverage_test.go TestCompareParameters_EnumAddedAndRemoved" },
      asyncapiDiff("v3.ts /channels/*/parameters", "breaking"),
    ],
    docs: [param3({ enum: ["alpha"] }), param3({ enum: ["alpha", "beta"] })],
    expect: [
      {
        at: "channels/user/parameters/userId/enum/**",
        action: "add",
        type: nonBreaking,
        mentions: ["userId", "user", "beta"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CH-025",
    title: "AsyncAPI 3 channel parameter enum introduced",
    before: "parameter userId without enum",
    after: "parameter userId enum [alpha]",
    rationale: "restricting a free parameter rejects addresses that were valid",
    annotation: "names the parameter, the channel and enum",
    sources: [asyncapiDiff("v3.ts /channels/*/parameters", "breaking")],
    docs: [param3({}), param3({ enum: ["alpha"] })],
    expect: [
      {
        at: "channels/user/parameters/userId/enum",
        action: "add",
        type: breaking,
        mentions: ["userId", "user", "enum"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-026",
    title: "AsyncAPI 3 channel parameter default changed",
    before: "parameter region default eu",
    after: "parameter region default us",
    rationale:
      "3.0 §Parameter Object: the default is used for substitution when no value is supplied; clients relying on it now reach another address",
    annotation: "names the parameter, the channel and default",
    sources: [asyncapiDiff("v3.ts /channels/*/parameters", "breaking")],
    docs: [param3({ default: "eu" }), param3({ default: "us" })],
    expect: [
      {
        at: "channels/user/parameters/userId/default",
        action: "replace",
        type: breaking,
        mentions: ["userId", "user", "default"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-027",
    title: "AsyncAPI 3 channel parameter default added",
    before: "parameter without default",
    after: "parameter default eu",
    rationale: "clients always supplied a value before; a default only helps new clients",
    annotation: "names the parameter, the channel and default",
    sources: [asyncapiDiff("v3.ts /channels/*/parameters", "breaking")],
    docs: [param3({}), param3({ default: "eu" })],
    expect: [
      {
        at: "channels/user/parameters/userId/default",
        action: "add",
        type: nonBreaking,
        mentions: ["userId", "user", "default"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-028",
    title: "AsyncAPI 3 channel parameter default removed",
    before: "parameter default eu",
    after: "parameter without default",
    rationale: "clients omitting the value relied on the default",
    annotation: "names the parameter, the channel and default",
    sources: [asyncapiDiff("v3.ts /channels/*/parameters")],
    docs: [param3({ default: "eu" }), param3({})],
    expect: [
      {
        at: "channels/user/parameters/userId/default",
        action: "remove",
        type: breaking,
        mentions: ["userId", "user", "default"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-029",
    title: "AsyncAPI 3 channel parameter description and examples added",
    before: "parameter without description / examples",
    after: "parameter with description and examples",
    rationale: "documentation only",
    annotation: "names the parameter, the channel and the field",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/model/coverage_test.go TestCompareParameters_DescriptionNotBreaking" },
      asyncapiDiff("v3.ts /channels/*/parameters", "breaking"),
    ],
    docs: [param3({}), param3({ description: "The user id", examples: ["42"] })],
    expect: [
      {
        at: "channels/user/parameters/userId/description",
        action: "add",
        type: annotation,
        mentions: ["userId", "description"],
      },
      {
        at: "channels/user/parameters/userId/examples",
        action: "add",
        type: annotation,
        mentions: ["userId", "examples"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-030",
    title: "AsyncAPI 3 channel parameter location changed",
    before: "location $message.payload#/user/id",
    after: "location $message.payload#/userId",
    rationale: "clients read or write the parameter value at the declared location",
    annotation: "names the parameter, the channel and location",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/model/coverage_test.go TestCompareParameters_LocationModified" },
      asyncapiDiff("v3.ts /channels/*/parameters"),
    ],
    docs: [param3({ location: "$message.payload#/user/id" }), param3({ location: "$message.payload#/userId" })],
    expect: [
      {
        at: "channels/user/parameters/userId/location",
        action: "replace",
        type: breaking,
        mentions: ["userId", "location"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-031",
    title: "AsyncAPI 3 channel parameter added with its address expression",
    before: "address user, no parameters",
    after: "address user/{userId}, parameters.userId",
    rationale: "the address changes and clients must now supply a value for the new variable",
    annotation: "names the channel, the address and the added parameter",
    sources: [asyncapiDiff("v3.ts /channels/*/parameters"), asyncapiDiff("v3.ts /channels/*/address")],
    docs: [
      aa3({ user: chan("user") }, { onUser: op3("send", "user", ["event"]) }),
      aa3({ user: chan("user/{userId}", { parameters: { userId: {} } }) }, { onUser: op3("send", "user", ["event"]) }),
    ],
    expect: [
      { at: "channels/user/address", action: "replace", type: breaking, mentions: ["address", "user"] },
      { at: "channels/user/parameters/userId", action: "add", type: breaking, mentions: ["userId", "user"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-032",
    title: "AsyncAPI 3 channel parameter removed with its address expression",
    before: "address user/{userId}, parameters.userId",
    after: "address user, no parameters",
    rationale:
      "the address change carries the break; dropping the parameter definition itself asks nothing new of clients",
    annotation: "names the channel, the address and the removed parameter",
    sources: [asyncapiDiff("v3.ts /channels/*/parameters", "breaking"), asyncapiDiff("v3.ts /channels/*/address")],
    docs: [
      aa3({ user: chan("user/{userId}", { parameters: { userId: {} } }) }, { onUser: op3("send", "user", ["event"]) }),
      aa3({ user: chan("user") }, { onUser: op3("send", "user", ["event"]) }),
    ],
    expect: [
      { at: "channels/user/address", action: "replace", type: breaking, mentions: ["address", "user"] },
      { at: "channels/user/parameters/userId", action: "remove", type: nonBreaking, mentions: ["userId", "user"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-033",
    title: "AsyncAPI 3 channel parameter enum value removed through a components/parameters $ref",
    before: "parameters.userId $ref components/parameters/userId (enum [alpha, beta])",
    after: "the same reference, enum [alpha]",
    rationale: "the referenced parameter narrows; the component takes the classification of its usage",
    annotation: "names the parameter and the removed value",
    sources: [
      asyncapiDiff("v3.ts /channels/*/parameters", "breaking"),
      asd("DESIGN_PROPOSALS §11.4 usage-derived components"),
    ],
    docs: [
      param3(
        { $ref: "#/components/parameters/userId" },
        { components: { parameters: { userId: { enum: ["alpha", "beta"] } } } },
      ),
      param3(
        { $ref: "#/components/parameters/userId" },
        { components: { parameters: { userId: { enum: ["alpha"] } } } },
      ),
    ],
    expect: [
      {
        at: ["channels/user/parameters/userId/enum/**", "components/parameters/userId/enum/**"],
        action: "remove",
        type: breaking,
        mentions: ["userId", "beta"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-CH-034",
    title: "AsyncAPI 3 message added to a channel no operation uses",
    before: "channel userSignup with message signup",
    after: "channel userSignup with messages signup and audit (no operation lists audit)",
    rationale:
      "DESIGN_PROPOSALS §11.4: a message no operation references has no usage, so it is unclassified with a description",
    annotation: "names the added message and the channel",
    sources: [
      asyncapiDiff("v3.ts /channels/*/messages/*"),
      asd("test/asyncapi/asyncapi3.test.ts H7 unreferenced channel message is unclassified"),
    ],
    docs: [
      aa3(
        { userSignup: { address: "user/signup", messages: { signup: { payload } } } },
        { onSignup: op3("send", "userSignup", ["signup"]) },
      ),
      aa3(
        { userSignup: { address: "user/signup", messages: { signup: { payload }, audit: { payload } } } },
        { onSignup: op3("send", "userSignup", ["signup"]) },
      ),
    ],
    expect: [
      {
        at: "channels/userSignup/messages/audit",
        action: "add",
        type: unclassified,
        mentions: ["audit", "userSignup"],
      },
    ],
  },
  // ---------------------------------------------------------------------------------------------------------------
  // POLICY-101 (P8c): a channel renamed and changed at once is paired by its reference sites
  {
    kind: "doc",
    id: "AA-CH-035",
    title: "AsyncAPI 3 channel renamed with every reference repointed and a compatible change",
    before: "channel userSignup message event { id }, operation refs #/channels/userSignup",
    after: "channel userRegistration message event { id, name }, operation refs #/channels/userRegistration",
    rationale:
      "POLICY-101: every reference moved to the new key, so the key change is one rename annotation (POLICY-100); the channels are compared on their own: an optional property added to the payload is non-breaking in both directions",
    annotation: "names both channel ids for the rename; the added property with the channel",
    sources: [asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-100 / POLICY-101")],
    docs: (() => {
      const v = (action: "send" | "receive", key: string, extra: Record<string, unknown> = {}) =>
        aa3(
          {
            [key]: {
              address: "user/signup",
              messages: { event: { payload: { ...payload, properties: { ...payload.properties, ...extra } } } },
            },
          },
          { onSignup: op3(action, key, ["event"]) },
        )
      return {
        "3.0-send": [v("send", "userSignup"), v("send", "userRegistration", { name: { type: "string" } })],
        "3.0-receive": [v("receive", "userSignup"), v("receive", "userRegistration", { name: { type: "string" } })],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: [
      { at: "channels", action: "rename", type: annotation, count: 1, mentions: ["userSignup", "userRegistration"] },
      {
        at: "channels/userSignup/messages/event/payload/properties/name",
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["name"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-036",
    title: "AsyncAPI 3 channel renamed with every reference repointed and a breaking change",
    before: "channel userSignup message event { id: string }, operation refs #/channels/userSignup",
    after: "channel userRegistration message event { id: integer }, operation refs #/channels/userRegistration",
    rationale:
      "POLICY-101: the rename is an annotation; the payload property type change breaks the consumers of a sent message and the producers of a received one",
    annotation: "names both channel ids for the rename; the changed property with the channel",
    sources: [asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-100 / POLICY-101")],
    docs: (() => {
      const v = (action: "send" | "receive", key: string, type: string) =>
        aa3(
          {
            [key]: {
              address: "user/signup",
              messages: { event: { payload: { ...payload, properties: { id: { type } } } } },
            },
          },
          { onSignup: op3(action, key, ["event"]) },
        )
      return {
        "3.0-send": [v("send", "userSignup", "string"), v("send", "userRegistration", "integer")],
        "3.0-receive": [v("receive", "userSignup", "string"), v("receive", "userRegistration", "integer")],
      } as Record<string, [unknown, unknown]>
    })(),
    expect: [
      { at: "channels", action: "rename", type: annotation, count: 1, mentions: ["userSignup", "userRegistration"] },
      {
        at: "channels/userSignup/messages/event/payload/properties/id/type",
        action: "replace",
        type: breaking,
        count: 1,
        mentions: ["id", "string", "integer"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-CH-037",
    title: "AsyncAPI 3 channel renamed with only some references repointed is not a rename",
    before: "channel userSignup referenced by operations onSignup and onAudit",
    after: "onSignup refs userRegistration (payload { id, name }), onAudit refs a new channel audit",
    rationale:
      "POLICY-101: the references of userRegistration are not those of userSignup (onAudit moved elsewhere) and the definitions differ, so the channel is removed and two are added; each operation now uses another channel (nominal, breaking)",
    annotation: "names the removed and the added channels and the operations",
    sources: [asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-101")],
    docs: [
      aa3(
        { userSignup: chan("user/signup") },
        { onSignup: op3("receive", "userSignup", ["event"]), onAudit: op3("receive", "userSignup", ["event"]) },
      ),
      aa3(
        {
          userRegistration: {
            address: "user/signup",
            messages: {
              event: { payload: { ...payload, properties: { ...payload.properties, name: { type: "string" } } } },
            },
          },
          audit: chan("audit"),
        },
        { onSignup: op3("receive", "userRegistration", ["event"]), onAudit: op3("receive", "audit", ["event"]) },
      ),
    ],
    expect: [
      { at: "channels/userSignup", action: "remove", type: breaking, count: 1, mentions: ["userSignup"] },
      {
        at: ["channels/userRegistration", "channels/audit"],
        action: "add",
        type: nonBreaking,
        count: 2,
        mentions: [/userRegistration|audit/],
      },
      {
        at: ["operations/*/channel/$ref", "operations/*/messages/0/$ref"],
        action: "replace",
        type: breaking,
        count: 4,
        mentions: [/onSignup|onAudit/],
      },
    ],
  },
  // POLICY-105 decided (P8d): a removed and an added channel are also a rename when more than 50 % of the direct fields
  // of their definitions are equal
  {
    kind: "doc",
    id: "AA-CH-038",
    title: "AsyncAPI 3 channel renamed with only some references repointed and most direct fields kept is a rename",
    before: "channel userSignup (address, description, message event) referenced by operations onSignup and onAudit",
    after:
      "onSignup refs userRegistration (same address and description, payload { id, name }), onAudit refs a new channel audit",
    rationale:
      "POLICY-105: 2 of the 3 direct fields are equal (`address`, `description`; `messages` differs), so userSignup was renamed to userRegistration although onAudit moved elsewhere (POLICY-101 alone: no rename): one rename annotation, the added payload property classified on its own; onAudit now uses another channel (nominal, breaking) and audit is added",
    annotation: "names both channel ids for the rename; the added property with the channel; the retargeted operation",
    sources: [asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-105")],
    docs: [
      aa3(
        { userSignup: chan("user/signup", { description: "Sign-ups" }) },
        { onSignup: op3("receive", "userSignup", ["event"]), onAudit: op3("receive", "userSignup", ["event"]) },
      ),
      aa3(
        {
          userRegistration: {
            address: "user/signup",
            description: "Sign-ups",
            messages: {
              event: { payload: { ...payload, properties: { ...payload.properties, name: { type: "string" } } } },
            },
          },
          audit: chan("audit"),
        },
        { onSignup: op3("receive", "userRegistration", ["event"]), onAudit: op3("receive", "audit", ["event"]) },
      ),
    ],
    expect: [
      { at: "channels", action: "rename", type: annotation, count: 1, mentions: ["userSignup", "userRegistration"] },
      {
        at: "channels/userSignup/messages/event/payload/properties/name",
        action: "add",
        type: nonBreaking,
        count: 1,
        mentions: ["name", "userRegistration"],
      },
      { at: "channels/audit", action: "add", type: nonBreaking, count: 1, mentions: ["audit"] },
      {
        at: ["operations/onAudit/channel/$ref", "operations/onAudit/messages/0/$ref"],
        action: "replace",
        type: breaking,
        count: 2,
        mentions: ["onAudit"],
      },
    ],
  },
]

runCases("asyncapi", "channels", cases, import.meta.filename)
