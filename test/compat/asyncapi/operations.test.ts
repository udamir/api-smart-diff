// AsyncAPI operations: 2.x publish / subscribe (operationId, documentation, security, message alternatives) and 3.0 operations (action, channel, messages list, reply, security, documentation). Traits and bindings are in bindings-traits.test.ts.
//
// Direction convention (docs/BENCHMARK.md §3): messages the application consumes (2.x publish, 3.0 receive) are written by clients (request semantics); messages it produces (2.x subscribe, 3.0 send) are read by clients (response semantics). Until P2, 2.0.0 inverted this for 3.0 (ISSUE-52 (fixed), POLICY-01).

import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, risky, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const signup = { name: "signup", payload: { type: "object", properties: { userId: { type: "string" } } } }
const deleted = { name: "deleted", payload: { type: "object", properties: { reason: { type: "string" } } } }

const aa2 = (channels: unknown, extra: Record<string, unknown> = {}) => ({
  asyncapi: "2.6.0",
  info,
  channels,
  ...extra,
})
const ch2 = (ops: Record<string, unknown>) => aa2({ "user/events": ops })
const aa3 = (operations: unknown, extra: Record<string, unknown> = {}, channels: Record<string, unknown> = {}) => ({
  asyncapi: "3.0.0",
  info,
  channels: {
    userEvents: { address: "user/events", messages: { signup, deleted } },
    auditEvents: { address: "audit/events", messages: { signup } },
    userReplies: { address: "user/replies", messages: { signup, deleted } },
    ...channels,
  },
  operations,
  ...extra,
})
const op3 = (
  action: "send" | "receive",
  messages: string[] = ["signup"],
  extra: Record<string, unknown> = {},
  channel = "userEvents",
) => ({
  action,
  channel: { $ref: `#/channels/${channel}` },
  messages: messages.map((m) => ({ $ref: `#/channels/${channel}/messages/${m}` })),
  ...extra,
})
const reply = (messages: string[] = ["signup"], channel = "userReplies") => ({
  channel: { $ref: `#/channels/${channel}` },
  messages: messages.map((m) => ({ $ref: `#/channels/${channel}/messages/${m}` })),
})

const asyncapiDiff = (ref: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string) => ({ tool: "asd", ref })
const fork = (ref: string, verdict?: string) => ({ tool: "fork", ref, ...(verdict ? { verdict } : {}) })

const secSchemes = {
  components: {
    securitySchemes: {
      user: { type: "userPassword" },
      cert: { type: "X509" },
      oauth: {
        type: "oauth2",
        flows: {
          clientCredentials: {
            tokenUrl: "https://auth.example.com/token",
            availableScopes: { read: "read", write: "write" },
          },
        },
      },
    },
  },
}

const cases: CompatCase[] = [
  // ---- 2.x publish / subscribe
  {
    kind: "doc",
    id: "AA-OP-001",
    title: "AsyncAPI 2 publish operation removed",
    before: "channel user/events with publish and subscribe",
    after: "channel user/events with subscribe only",
    rationale: "clients that publish to the channel are no longer served",
    annotation: "names publish and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/publish"),
      asd("test/asyncapi/edge-cases.test.ts removing a publish operation is breaking"),
    ],
    docs: [
      ch2({ publish: { message: signup }, subscribe: { message: deleted } }),
      ch2({ subscribe: { message: deleted } }),
    ],
    expect: [
      { at: "channels/user~1events/publish", action: "remove", type: breaking, mentions: ["publish", "user/events"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-002",
    title: "AsyncAPI 2 subscribe operation removed",
    before: "channel user/events with publish and subscribe",
    after: "channel user/events with publish only",
    rationale: "subscribed clients stop receiving messages",
    annotation: "names subscribe and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe"),
      asd("test/asyncapi/edge-cases.test.ts removing a subscribe operation is breaking"),
    ],
    docs: [
      ch2({ publish: { message: signup }, subscribe: { message: deleted } }),
      ch2({ publish: { message: signup } }),
    ],
    expect: [
      {
        at: "channels/user~1events/subscribe",
        action: "remove",
        type: breaking,
        mentions: ["subscribe", "user/events"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-003",
    title: "AsyncAPI 2 publish operation added",
    before: "channel user/events with subscribe",
    after: "channel user/events with publish and subscribe",
    rationale: "existing clients never publish to the new operation",
    annotation: "names publish and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/publish"),
      asd("test/asyncapi/edge-cases.test.ts adding a publish operation is non-breaking"),
    ],
    docs: [
      ch2({ subscribe: { message: deleted } }),
      ch2({ publish: { message: signup }, subscribe: { message: deleted } }),
    ],
    expect: [
      { at: "channels/user~1events/publish", action: "add", type: nonBreaking, mentions: ["publish", "user/events"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-004",
    title: "AsyncAPI 2 subscribe operation added",
    before: "channel user/events with publish",
    after: "channel user/events with publish and subscribe",
    rationale: "existing clients are not subscribed to the new operation",
    annotation: "names subscribe and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe"),
      asd("test/asyncapi/edge-cases.test.ts adding a subscribe operation is non-breaking"),
    ],
    docs: [
      ch2({ publish: { message: signup } }),
      ch2({ publish: { message: signup }, subscribe: { message: deleted } }),
    ],
    expect: [
      {
        at: "channels/user~1events/subscribe",
        action: "add",
        type: nonBreaking,
        mentions: ["subscribe", "user/events"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-005",
    title: "AsyncAPI 2 operationId changed",
    before: "subscribe.operationId onUserEvent",
    after: "subscribe.operationId handleUserEvent",
    rationale:
      "operationId is the stable identifier tools and generated clients use (ASD OpenAPI classifies an operationId change as breaking; @asyncapi/diff too)",
    annotation: "names operationId, the operation and the channel",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/operationId"),
      asd("src/openapi/openapi3.rules.ts /operationId replace breaking"),
    ],
    docs: [
      ch2({ subscribe: { operationId: "onUserEvent", message: signup } }),
      ch2({ subscribe: { operationId: "handleUserEvent", message: signup } }),
    ],
    expect: [
      {
        at: "channels/*/subscribe/operationId",
        action: "replace",
        type: breaking,
        mentions: ["operationId", "subscribe", "user/events"],
      },
    ],
    // ISSUE-112 (fixed)
  },
  {
    kind: "doc",
    id: "AA-OP-006",
    title: "operation summary changed and description added",
    before: "summary 'User events'",
    after: "summary 'Account events', description set (3.0: title changed too)",
    rationale: "documentation only",
    annotation: "names the field and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/summary"),
      asyncapiDiff("v2.ts /channels/*/subscribe/description"),
      asyncapiDiff("v3.ts /operations/*/summary"),
      asyncapiDiff("v3.ts /operations/*/title"),
      asyncapiDiff("v3.ts /operations/*/description"),
    ],
    docs: {
      "2.6": [
        ch2({ subscribe: { summary: "User events", message: signup } }),
        ch2({ subscribe: { summary: "Account events", description: "All account events", message: signup } }),
      ],
      "3.0": [
        aa3({ onUserEvent: op3("send", ["signup"], { title: "User", summary: "User events" }) }),
        aa3({
          onUserEvent: op3("send", ["signup"], {
            title: "Account",
            summary: "Account events",
            description: "All account events",
          }),
        }),
      ],
    },
    expect: {
      "2.6": [
        {
          at: "channels/*/subscribe/summary",
          action: "replace",
          type: annotation,
          mentions: ["summary", "subscribe", "user/events"],
        },
        {
          at: "channels/*/subscribe/description",
          action: "add",
          type: annotation,
          mentions: ["description", "subscribe", "user/events"],
        },
      ],
      "3.0": [
        {
          at: "operations/onUserEvent/summary",
          action: "replace",
          type: annotation,
          mentions: ["summary", "onUserEvent"],
        },
        {
          at: "operations/onUserEvent/description",
          action: "add",
          type: annotation,
          mentions: ["description", "onUserEvent"],
        },
        { at: "operations/onUserEvent/title", action: "replace", type: annotation, mentions: ["title", "onUserEvent"] },
      ],
    },
  },
  {
    kind: "doc",
    id: "AA-OP-007",
    title: "operation tag added",
    before: "tags [users]",
    after: "tags [users, accounts]",
    rationale: "tags group operations for documentation only",
    annotation: "names the added tag and the operation",
    sources: [asyncapiDiff("v2.ts /channels/*/subscribe/tags/*"), asyncapiDiff("v3.ts /operations/*/tags/*")],
    docs: {
      "2.6": [
        ch2({ subscribe: { tags: [{ name: "users" }], message: signup } }),
        ch2({ subscribe: { tags: [{ name: "users" }, { name: "accounts" }], message: signup } }),
      ],
      "3.0": [
        aa3({ onUserEvent: op3("send", ["signup"], { tags: [{ name: "users" }] }) }),
        aa3({ onUserEvent: op3("send", ["signup"], { tags: [{ name: "users" }, { name: "accounts" }] }) }),
      ],
    },
    expect: [
      {
        at: ["channels/*/subscribe/tags/**", "operations/onUserEvent/tags/**"],
        action: "add",
        type: annotation,
        mentions: ["accounts"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-008",
    title: "operation externalDocs url changed",
    before: "externalDocs https://a.example.com",
    after: "externalDocs https://b.example.com",
    rationale: "external documentation link only",
    annotation: "names externalDocs and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/externalDocs"),
      asyncapiDiff("v3.ts /operations/*/externalDocs"),
    ],
    docs: {
      "2.6": [
        ch2({ subscribe: { externalDocs: { url: "https://a.example.com" }, message: signup } }),
        ch2({ subscribe: { externalDocs: { url: "https://b.example.com" }, message: signup } }),
      ],
      "3.0": [
        aa3({ onUserEvent: op3("send", ["signup"], { externalDocs: { url: "https://a.example.com" } }) }),
        aa3({ onUserEvent: op3("send", ["signup"], { externalDocs: { url: "https://b.example.com" } }) }),
      ],
    },
    expect: [
      {
        at: ["channels/*/subscribe/externalDocs/url", "operations/onUserEvent/externalDocs/url"],
        action: "replace",
        type: annotation,
        mentions: ["externalDocs", /subscribe|onUserEvent/],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-009",
    title: "operation security requirement added",
    before: "operation without security",
    after: "operation requires the user (userPassword) scheme",
    rationale:
      "clients that connect without credentials are rejected (ASD OpenAPI: adding a security requirement is breaking)",
    annotation: "names security, the scheme and the operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*/security"),
      asd("src/openapi/openapi3.classify.ts operationSecurityClassifyRule"),
    ],
    docs: {
      "2.6": [
        aa2({ "user/events": { publish: { message: signup } } }, secSchemes),
        aa2({ "user/events": { publish: { security: [{ user: [] }], message: signup } } }, secSchemes),
      ],
      "3.0": [
        aa3({ onUserEvent: op3("receive") }, secSchemes),
        aa3(
          { onUserEvent: op3("receive", ["signup"], { security: [{ $ref: "#/components/securitySchemes/user" }] }) },
          secSchemes,
        ),
      ],
    },
    expect: [
      {
        at: ["channels/*/publish/security", "operations/onUserEvent/security"],
        action: "add",
        type: breaking,
        mentions: ["security", "user", /publish|onUserEvent/],
      },
    ],
    // ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-OP-010",
    title: "operation security requirement removed",
    before: "operation requires the user scheme",
    after: "operation without security",
    rationale: "clients that still send credentials keep working",
    annotation: "names security and the operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*/security", "breaking"),
      asd("src/openapi/openapi3.classify.ts operationSecurityClassifyRule"),
    ],
    docs: {
      "2.6": [
        aa2({ "user/events": { publish: { security: [{ user: [] }], message: signup } } }, secSchemes),
        aa2({ "user/events": { publish: { message: signup } } }, secSchemes),
      ],
      "3.0": [
        aa3(
          { onUserEvent: op3("receive", ["signup"], { security: [{ $ref: "#/components/securitySchemes/user" }] }) },
          secSchemes,
        ),
        aa3({ onUserEvent: op3("receive") }, secSchemes),
      ],
    },
    expect: [
      {
        at: ["channels/*/publish/security", "operations/onUserEvent/security"],
        action: "remove",
        type: nonBreaking,
        mentions: ["security", /publish|onUserEvent/],
      },
    ],
    // ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-OP-011",
    title: "AsyncAPI 2 operation security scope added to a requirement",
    before: "security [{ oauth: [read] }]",
    after: "security [{ oauth: [read, write] }]",
    rationale: "tokens granted only the read scope are rejected",
    annotation: "names the scope, the scheme and the operation",
    sources: [asd("src/openapi/openapi3.classify.ts securityScopeClassifyRule")],
    docs: [
      aa2({ "user/events": { publish: { security: [{ oauth: ["read"] }], message: signup } } }, secSchemes),
      aa2({ "user/events": { publish: { security: [{ oauth: ["read", "write"] }], message: signup } } }, secSchemes),
    ],
    expect: [{ at: "channels/*/publish/security/**", action: "add", type: breaking, mentions: ["write", "oauth"] }],
    // ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-OP-012",
    title: "AsyncAPI 3 operation security scheme switched",
    before: "security [$ref user (userPassword)]",
    after: "security [$ref cert (X509)]",
    rationale: "clients authenticating with a password are rejected",
    annotation: "names the security change and the operation",
    sources: [asyncapiDiff("v3.ts /operations/*/security/*")],
    docs: [
      aa3(
        { onUserEvent: op3("receive", ["signup"], { security: [{ $ref: "#/components/securitySchemes/user" }] }) },
        secSchemes,
      ),
      aa3(
        { onUserEvent: op3("receive", ["signup"], { security: [{ $ref: "#/components/securitySchemes/cert" }] }) },
        secSchemes,
      ),
    ],
    expect: [{ at: "operations/onUserEvent/security/**", type: breaking, mentions: ["security", "onUserEvent"] }],
    // ISSUE-101 (fixed)
  },
  // ---- 2.x message alternatives (oneOf)
  {
    kind: "doc",
    id: "AA-OP-013",
    title: "AsyncAPI 2 message alternative added to a publish operation",
    before: "publish.message.oneOf [signup]",
    after: "publish.message.oneOf [signup, deleted]",
    rationale: "clients may keep publishing signup messages; the application now also accepts deleted",
    annotation: "names the added message and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/publish/message", "breaking"),
      asd("test/asyncapi/edge-cases.test.ts adding a oneOf message is non-breaking"),
    ],
    docs: [
      ch2({ publish: { message: { oneOf: [signup] } } }),
      ch2({ publish: { message: { oneOf: [signup, deleted] } } }),
    ],
    expect: [
      { at: "channels/*/publish/message/oneOf/**", action: "add", type: nonBreaking, mentions: ["deleted", "publish"] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-014",
    title: "AsyncAPI 2 message alternative added to a subscribe operation",
    before: "subscribe.message.oneOf [signup]",
    after: "subscribe.message.oneOf [signup, deleted]",
    rationale:
      "subscribers may now receive a message kind they do not know (POLICY-05: risky, the response-side reading of a new oneOf branch)",
    annotation: "names the added message and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message", "breaking"),
      { tool: "graphql-inspector", ref: "UNION_MEMBER_ADDED (analogue)" },
    ],
    docs: [
      ch2({ subscribe: { message: { oneOf: [signup] } } }),
      ch2({ subscribe: { message: { oneOf: [signup, deleted] } } }),
    ],
    expect: [
      {
        at: "channels/*/subscribe/message/oneOf/**",
        action: "add",
        type: risky,
        mentions: ["deleted", "subscribe"],
      },
    ],
    // ISSUE-114 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); the description does not name the message
  },
  {
    kind: "doc",
    id: "AA-OP-015",
    title: "AsyncAPI 2 message alternative removed from a publish operation",
    before: "publish.message.oneOf [signup, deleted]",
    after: "publish.message.oneOf [signup]",
    rationale: "clients publishing deleted messages are no longer understood",
    annotation: "names the removed message and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/publish/message"),
      asd("test/asyncapi/edge-cases.test.ts removing a oneOf message is breaking"),
    ],
    docs: [
      ch2({ publish: { message: { oneOf: [signup, deleted] } } }),
      ch2({ publish: { message: { oneOf: [signup] } } }),
    ],
    expect: [
      { at: "channels/*/publish/message/oneOf/**", action: "remove", type: breaking, mentions: ["deleted", "publish"] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-016",
    title: "AsyncAPI 2 message alternative removed from a subscribe operation",
    before: "subscribe.message.oneOf [signup, deleted]",
    after: "subscribe.message.oneOf [signup]",
    rationale:
      "subscribers relying on deleted messages lose them, as when a subscribe operation is removed: a message kind is a capability, not a payload value (@asyncapi/diff, ASD 2.x and 3.0 send agree)",
    annotation: "names the removed message and the operation",
    sources: [
      asyncapiDiff("v2.ts /channels/*/subscribe/message"),
      { tool: "fork", ref: "receive-scope message removal", verdict: "risky" },
    ],
    docs: [
      ch2({ subscribe: { message: { oneOf: [signup, deleted] } } }),
      ch2({ subscribe: { message: { oneOf: [signup] } } }),
    ],
    expect: [
      {
        at: "channels/*/subscribe/message/oneOf/**",
        action: "remove",
        type: breaking,
        mentions: ["deleted", "subscribe"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-017",
    title: "AsyncAPI 2 single message turned into oneOf containing it",
    before: "publish.message signup",
    after: "publish.message.oneOf [signup, deleted]",
    rationale: "the signup message is still accepted unchanged; only the deleted alternative is new",
    annotation: "names the added message alternative",
    sources: [{ tool: "fork", ref: "test/asyncapi.diff.test.ts combiner matching by ref origin (analogue)" }],
    docs: [ch2({ publish: { message: signup } }), ch2({ publish: { message: { oneOf: [signup, deleted] } } })],
    expect: [{ at: "channels/*/publish/message/**", action: "add", type: nonBreaking, mentions: ["deleted"] }],
    // ISSUE-114 (fixed) (P8a); ISSUE-113 (fixed)
  },
  {
    kind: "doc",
    id: "AA-OP-018",
    title: "AsyncAPI 2 message alternatives reordered",
    before: "subscribe.message.oneOf [signup, deleted]",
    after: "subscribe.message.oneOf [deleted, signup]",
    rationale: "oneOf is a set of alternatives; order carries no meaning",
    annotation: "no diff",
    sources: [fork("test/asyncapi.firstReferenceKeyMapping.test.ts reordered operation messages produce no diffs")],
    docs: [
      ch2({ subscribe: { message: { oneOf: [signup, deleted] } } }),
      ch2({ subscribe: { message: { oneOf: [deleted, signup] } } }),
    ],
    expect: [],
  },
  // ---- 3.0 operations
  {
    kind: "doc",
    id: "AA-OP-019",
    title: "AsyncAPI 3 operation removed",
    before: "operations onSignup (send) and onAudit",
    after: "operation onSignup only",
    rationale: "clients of the removed operation lose it, whatever its action",
    annotation: "names the removed operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*"),
      fork("test/asyncapi.firstReferenceKeyMapping.test.ts remove operation"),
    ],
    docs: {
      send: [
        aa3({ onSignup: op3("send"), onAudit: op3("send", ["signup"], {}, "auditEvents") }),
        aa3({ onSignup: op3("send") }),
      ],
      receive: [
        aa3({ onSignup: op3("send"), onAudit: op3("receive", ["signup"], {}, "auditEvents") }),
        aa3({ onSignup: op3("send") }),
      ],
    },
    expect: [{ at: "operations/onAudit", action: "remove", type: breaking, mentions: ["onAudit"] }],
  },
  {
    kind: "doc",
    id: "AA-OP-020",
    title: "AsyncAPI 3 operation added",
    before: "operation onSignup",
    after: "operations onSignup and onAudit",
    rationale: "existing clients never use the new operation",
    annotation: "names the added operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*"),
      fork("test/asyncapi.diff.test.ts classifies adding a send / receive operation as non-breaking"),
    ],
    docs: {
      send: [
        aa3({ onSignup: op3("send") }),
        aa3({ onSignup: op3("send"), onAudit: op3("send", ["signup"], {}, "auditEvents") }),
      ],
      receive: [
        aa3({ onSignup: op3("send") }),
        aa3({ onSignup: op3("send"), onAudit: op3("receive", ["signup"], {}, "auditEvents") }),
      ],
    },
    expect: [{ at: "operations/onAudit", action: "add", type: nonBreaking, mentions: ["onAudit"] }],
  },
  {
    kind: "doc",
    id: "AA-OP-021",
    title: "AsyncAPI 3 operation key renamed",
    before: "operation onSignup",
    after: "the same operation as onRegistration",
    rationale:
      "the operation key is the operation's id in 3.0 (the 2.x operationId): tools and generated clients address it by that id",
    annotation: "names the removed and the added operation",
    sources: [fork("test/asyncapi.firstReferenceKeyMapping.test.ts operations mapped by key")],
    docs: [aa3({ onSignup: op3("receive") }), aa3({ onRegistration: op3("receive") })],
    expect: [
      { at: "operations/onSignup", action: "remove", type: breaking, mentions: ["onSignup"] },
      { at: "operations/onRegistration", action: "add", type: nonBreaking, mentions: ["onRegistration"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-022",
    title: "AsyncAPI 3 operations reordered",
    before: "operations onSignup, onAudit",
    after: "operations onAudit, onSignup",
    rationale: "operations is a map; order carries no meaning",
    annotation: "no diff",
    sources: [fork("test/asyncapi.firstReferenceKeyMapping.test.ts reordered operations produce no diffs")],
    docs: [
      aa3({ onSignup: op3("send"), onAudit: op3("receive", ["signup"], {}, "auditEvents") }),
      aa3({ onAudit: op3("receive", ["signup"], {}, "auditEvents"), onSignup: op3("send") }),
    ],
    expect: [],
  },
  {
    kind: "doc",
    id: "AA-OP-023",
    title: "AsyncAPI 3 operation action changed",
    before: "onSignup action send",
    after: "onSignup action receive",
    rationale: "the application now consumes instead of producing: every client role is inverted",
    annotation: "names action, the operation and the new action",
    sources: [
      asyncapiDiff("v3.ts /operations/*/action"),
      { tool: "openapi-changes", ref: "sample-specs/asyncapi-original.yaml -> asyncapi.yaml (action receive -> send)" },
      asd("test/asyncapi/asyncapi3.test.ts H8 action change is breaking"),
    ],
    docs: [aa3({ onSignup: op3("send") }), aa3({ onSignup: op3("receive") })],
    expect: [
      {
        at: "operations/onSignup/action",
        action: "replace",
        type: breaking,
        mentions: ["action", "onSignup", "receive"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-024",
    title: "AsyncAPI 3 operation moved to another channel",
    before: "onSignup on channel userEvents (messages userEvents/signup)",
    after: "onSignup on channel auditEvents (messages auditEvents/signup)",
    rationale:
      "the channel reference is nominal: the operation now talks on another address; the message references that follow the channel are part of the same change",
    annotation: "names the operation and the channel change",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/what_changed_test.go TestCompareDocuments_OperationChanges mqtt-operation channel $ref",
      },
      asyncapiDiff("v3.ts /operations/*/channel"),
      asd("test/asyncapi/asyncapi3.test.ts H8 channel change is breaking"),
    ],
    docs: [aa3({ onSignup: op3("send") }), aa3({ onSignup: op3("send", ["signup"], {}, "auditEvents") })],
    expect: [
      {
        at: ["operations/onSignup/channel/**", "operations/onSignup/messages/**"],
        type: breaking,
        mentions: ["onSignup"],
      },
    ],
    // ISSUE-106 (fixed)
  },
  {
    kind: "doc",
    id: "AA-OP-025",
    title: "AsyncAPI 3 message added to a receive operation",
    before: "onUserEvent (receive) messages [signup]",
    after: "onUserEvent (receive) messages [signup, deleted]",
    rationale:
      "the application now also accepts deleted; clients keep sending signup (request widening). POLICY-01: consumed messages take request semantics, as 2.x publish",
    annotation: "names the added message and the operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*/messages/*"),
      asd("test/asyncapi/asyncapi3.test.ts H8 the message list follows the direction"),
      fork("test/compatibility-suites/asyncapi (send = request semantics)", "breaking"),
    ],
    docs: [
      aa3({ onUserEvent: op3("receive", ["signup"]) }),
      aa3({ onUserEvent: op3("receive", ["signup", "deleted"]) }),
    ],
    expect: [
      {
        at: "operations/onUserEvent/messages/**",
        action: "add",
        type: nonBreaking,
        mentions: ["deleted", "onUserEvent"],
      },
    ],
    // ISSUE-52 (fixed): classified by direction; the description does not name the message (ISSUE-114)
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-026",
    title: "AsyncAPI 3 message added to a send operation",
    before: "onUserEvent (send) messages [signup]",
    after: "onUserEvent (send) messages [signup, deleted]",
    rationale: "consumers may now receive a message kind they do not know (POLICY-05: risky)",
    annotation: "names the added message and the operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*/messages/*", "breaking"),
      fork("test/compatibility-suites/asyncapi (send = request semantics)", "non-breaking"),
    ],
    docs: [aa3({ onUserEvent: op3("send", ["signup"]) }), aa3({ onUserEvent: op3("send", ["signup", "deleted"]) })],
    expect: [
      { at: "operations/onUserEvent/messages/**", action: "add", type: risky, mentions: ["deleted", "onUserEvent"] },
    ],
    // ISSUE-130 (fixed): POLICY-05 decided (b); ISSUE-52 (fixed): the 3.0 send scope; the description is ISSUE-114
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-027",
    title: "AsyncAPI 3 message removed from a send operation",
    before: "onUserEvent (send) messages [signup, deleted]",
    after: "onUserEvent (send) messages [signup]",
    rationale:
      "consumers relying on deleted messages lose them, as when the operation is removed: a message kind is a capability, not a payload value (same verdict as 2.x subscribe, AA-OP-016)",
    annotation: "names the removed message and the operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*/messages/*"),
      fork("test/compatibility-suites/asyncapi (send = request semantics)"),
    ],
    docs: [aa3({ onUserEvent: op3("send", ["signup", "deleted"]) }), aa3({ onUserEvent: op3("send", ["signup"]) })],
    expect: [
      {
        at: "operations/onUserEvent/messages/**",
        action: "remove",
        type: breaking,
        mentions: ["deleted", "onUserEvent"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-028",
    title: "AsyncAPI 3 message removed from a receive operation",
    before: "onUserEvent (receive) messages [signup, deleted]",
    after: "onUserEvent (receive) messages [signup]",
    rationale: "clients sending deleted messages are no longer understood (request narrowing; POLICY-01)",
    annotation: "names the removed message and the operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*/messages/*"),
      fork("test/compatibility-suites/asyncapi (send = request semantics)", "non-breaking"),
    ],
    docs: [
      aa3({ onUserEvent: op3("receive", ["signup", "deleted"]) }),
      aa3({ onUserEvent: op3("receive", ["signup"]) }),
    ],
    expect: [
      {
        at: "operations/onUserEvent/messages/**",
        action: "remove",
        type: breaking,
        mentions: ["deleted", "onUserEvent"],
      },
    ],
    // ISSUE-52 (fixed): classified by direction; the description does not name the message (ISSUE-114)
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-029",
    title: "AsyncAPI 3 operation messages reordered",
    before: "messages [signup, deleted]",
    after: "messages [deleted, signup]",
    rationale: "the message list is a set of references; order carries no meaning",
    annotation: "no diff",
    sources: [fork("test/asyncapi.firstReferenceKeyMapping.test.ts reordered operation messages produce no diffs")],
    docs: [
      aa3({ onUserEvent: op3("receive", ["signup", "deleted"]) }),
      aa3({ onUserEvent: op3("receive", ["deleted", "signup"]) }),
    ],
    expect: [],
  },
  // ---- 3.0 reply
  {
    kind: "doc",
    id: "AA-OP-030",
    title: "AsyncAPI 3 reply added",
    before: "operation without reply",
    after: "operation with a reply on userReplies",
    rationale:
      "a new reply asks nothing of existing clients: requesters may ignore replies (receive), responders are not obliged by the before contract (send)",
    annotation: "names reply and the operation",
    sources: [
      asyncapiDiff("v3.ts /operations/*/reply"),
      asd("test/asyncapi/asyncapi3.test.ts H9 adding a reply is non-breaking"),
    ],
    docs: {
      receive: [
        aa3({ onUserEvent: op3("receive") }),
        aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply() }) }),
      ],
      send: [aa3({ onUserEvent: op3("send") }), aa3({ onUserEvent: op3("send", ["signup"], { reply: reply() }) })],
    },
    expect: [
      { at: "operations/onUserEvent/reply", action: "add", type: nonBreaking, mentions: ["reply", "onUserEvent"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-031",
    title: "AsyncAPI 3 reply removed from a receive operation",
    before: "receive operation replying on userReplies",
    after: "receive operation without reply",
    rationale: "requesters waiting for the reply never get it",
    annotation: "names reply and the operation",
    sources: [asyncapiDiff("v3.ts /operations/*/reply")],
    docs: [aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply() }) }), aa3({ onUserEvent: op3("receive") })],
    expect: [
      { at: "operations/onUserEvent/reply", action: "remove", type: breaking, mentions: ["reply", "onUserEvent"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-032",
    title: "AsyncAPI 3 reply channel changed",
    before: "reply.channel userReplies",
    after: "reply.channel auditEvents",
    rationale:
      "requesters listen for replies on the old reply channel; the message references that follow the channel are part of the same change",
    annotation: "names the reply channel change and the operation",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/model/coverage_test.go TestCompareOperationReply_ChannelRefSwapped" },
      asyncapiDiff("v3.ts /operations/*/reply/channel", "unclassified"),
      asd("test/asyncapi/asyncapi3.test.ts H9 changing the reply channel is breaking"),
    ],
    docs: [
      aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply() }) }),
      aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply(["signup"], "auditEvents") }) }),
    ],
    expect: [{ at: "operations/onUserEvent/reply/**", type: breaking, mentions: ["onUserEvent"] }],
    // ISSUE-106 (fixed)
  },
  {
    kind: "doc",
    id: "AA-OP-033",
    title: "AsyncAPI 3 reply address location changed",
    before: "reply.address.location $message.header#/replyTo",
    after: "reply.address.location $message.header#/replyAddress, description added",
    rationale: "requesters put the reply address where the before document said; the responder now reads it elsewhere",
    annotation: "names location and the reply address of the operation",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareOperationReplyAddress_LocationModifiedBreaking",
      },
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareOperationReply_AddressLocationChangeIsGranular",
      },
      asyncapiDiff("v3.ts /operations/*/reply/address/location"),
      asyncapiDiff("v3.ts /operations/*/reply/address/description"),
    ],
    docs: [
      aa3({
        onUserEvent: op3("receive", ["signup"], {
          reply: {
            address: { location: "$message.header#/replyTo" },
            messages: [{ $ref: "#/channels/userEvents/messages/signup" }],
          },
        }),
      }),
      aa3({
        onUserEvent: op3("receive", ["signup"], {
          reply: {
            address: { location: "$message.header#/replyAddress", description: "Where to reply" },
            messages: [{ $ref: "#/channels/userEvents/messages/signup" }],
          },
        }),
      }),
    ],
    expect: [
      {
        at: "operations/onUserEvent/reply/address/location",
        action: "replace",
        type: breaking,
        mentions: ["location", "onUserEvent"],
      },
      {
        at: "operations/onUserEvent/reply/address/description",
        action: "add",
        type: annotation,
        mentions: ["description", "onUserEvent"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-OP-034",
    title: "AsyncAPI 3 reply message added to a send operation",
    before: "send operation, reply messages [signup]",
    after: "send operation, reply messages [signup, deleted]",
    rationale:
      "the application receives the reply: responders (clients) may keep replying with signup (request widening)",
    annotation: "names the added reply message and the operation",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareOperationReply_MessagesRefAddedAndRemoved message ref added",
        verdict: "breaking",
      },
      asyncapiDiff("v3.ts /operations/*/reply/messages/*", "unclassified"),
      fork("test/asyncapi.multiformat-schema.test.ts reply-of-send-operation-uses-receive-scope"),
    ],
    docs: [
      aa3({ onUserEvent: op3("send", ["signup"], { reply: reply(["signup"]) }) }),
      aa3({ onUserEvent: op3("send", ["signup"], { reply: reply(["signup", "deleted"]) }) }),
    ],
    expect: [
      {
        at: "operations/onUserEvent/reply/messages/**",
        action: "add",
        type: nonBreaking,
        mentions: ["deleted", "onUserEvent"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-035",
    title: "AsyncAPI 3 reply message added to a receive operation",
    before: "receive operation, reply messages [signup]",
    after: "receive operation, reply messages [signup, deleted]",
    rationale:
      "the application sends the reply: requesters may receive a reply kind they do not know (POLICY-05: risky)",
    annotation: "names the added reply message and the operation",
    sources: [asyncapiDiff("v3.ts /operations/*/reply/messages/*", "unclassified")],
    docs: [
      aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply(["signup"]) }) }),
      aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply(["signup", "deleted"]) }) }),
    ],
    expect: [
      {
        at: "operations/onUserEvent/reply/messages/**",
        action: "add",
        type: risky,
        mentions: ["deleted", "onUserEvent"],
      },
    ],
    // ISSUE-114 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); the description does not name the message
  },
  {
    kind: "doc",
    id: "AA-OP-036",
    title: "AsyncAPI 3 reply message removed from a send operation",
    before: "send operation, reply messages [signup, deleted]",
    after: "send operation, reply messages [signup]",
    rationale: "responders replying with deleted are no longer understood (request narrowing)",
    annotation: "names the removed reply message and the operation",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareOperationReply_MessagesRefAddedAndRemoved message ref removed",
      },
      asyncapiDiff("v3.ts /operations/*/reply/messages/*", "unclassified"),
    ],
    docs: [
      aa3({ onUserEvent: op3("send", ["signup"], { reply: reply(["signup", "deleted"]) }) }),
      aa3({ onUserEvent: op3("send", ["signup"], { reply: reply(["signup"]) }) }),
    ],
    expect: [
      {
        at: "operations/onUserEvent/reply/messages/**",
        action: "remove",
        type: breaking,
        mentions: ["deleted", "onUserEvent"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-OP-037",
    title: "AsyncAPI 3 reply message removed from a receive operation",
    before: "receive operation, reply messages [signup, deleted]",
    after: "receive operation, reply messages [signup]",
    rationale:
      "the application sends the reply: requesters relying on deleted replies lose them (a message kind is a capability, as in AA-OP-027); 2.0.0 inverts the message list in the receive scope (POLICY-01)",
    annotation: "names the removed reply message and the operation",
    sources: [asyncapiDiff("v3.ts /operations/*/reply/messages/*", "unclassified")],
    docs: [
      aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply(["signup", "deleted"]) }) }),
      aa3({ onUserEvent: op3("receive", ["signup"], { reply: reply(["signup"]) }) }),
    ],
    expect: [
      {
        at: "operations/onUserEvent/reply/messages/**",
        action: "remove",
        type: breaking,
        mentions: ["deleted", "onUserEvent"],
      },
    ],
    // ISSUE-52 (fixed): classified by direction; the description does not name the message (ISSUE-114)
    // ISSUE-114 (fixed) (P8a)
  },
  // POLICY-120 decided (a): an AsyncAPI 3.0 operation without a `messages` list covers every message of its channel;
  // those messages take the operation's direction and are classified like an explicit list (ISSUE-340)
  {
    kind: "doc",
    id: "AA-OP-038",
    title: "AsyncAPI 3 operation without messages: required property added to its channel's only message",
    before: "operation (send / receive) on channel userEvents without a messages list; message signup {userId}",
    after: "signup gains the required property email",
    rationale:
      "the operation covers every message of its channel (POLICY-120): a sent message gains a guaranteed field (non-breaking for its readers), a received one demands a new field from its senders (breaking)",
    annotation: "names the property and the channel",
    sources: [asd("usage index: implied references of an operation without messages (POLICY-120)")],
    docs: (() => {
      const doc = (action: "send" | "receive", changed: boolean) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userEvents: {
            address: "user/events",
            messages: {
              signup: {
                name: "signup",
                payload: changed
                  ? {
                      type: "object",
                      properties: { userId: { type: "string" }, email: { type: "string" } },
                      required: ["email"],
                    }
                  : { type: "object", properties: { userId: { type: "string" } } },
              },
            },
          },
        },
        operations: { onUserEvent: { action, channel: { $ref: "#/channels/userEvents" } } },
      })
      return {
        send: [doc("send", false), doc("send", true)] as [unknown, unknown],
        receive: [doc("receive", false), doc("receive", true)] as [unknown, unknown],
      }
    })(),
    expect: [
      {
        at: "channels/userEvents/messages/signup/payload/properties/email",
        action: "add",
        type: { send: nonBreaking, receive: breaking },
        mentions: ["email", "userEvents"],
      },
      {
        at: "channels/userEvents/messages/signup/payload/required/**",
        action: "add",
        type: { send: nonBreaking, receive: breaking },
        mentions: ["email", "userEvents"],
      },
    ],
    // ISSUE-340 (fixed): was unclassified (no operation referenced the message)
  },
  {
    kind: "doc",
    id: "AA-OP-039",
    title: "AsyncAPI 3 operation without messages: changes in two messages of its channel",
    before: "operation (send / receive) on channel userEvents without a messages list; messages signup and deleted",
    after: "signup.userId string -> integer; deleted gains the required property at",
    rationale:
      "every message of the channel takes the operation's direction (POLICY-120): the type change breaks both directions, the new required field breaks only senders of a received message",
    annotation: "names the property and the channel",
    sources: [asd("usage index: implied references of an operation without messages (POLICY-120)")],
    docs: (() => {
      const doc = (action: "send" | "receive", changed: boolean) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userEvents: {
            address: "user/events",
            messages: {
              signup: {
                name: "signup",
                payload: { type: "object", properties: { userId: { type: changed ? "integer" : "string" } } },
              },
              deleted: {
                name: "deleted",
                payload: changed
                  ? { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] }
                  : { type: "object", properties: { reason: { type: "string" } } },
              },
            },
          },
        },
        operations: { onUserEvent: { action, channel: { $ref: "#/channels/userEvents" } } },
      })
      return {
        send: [doc("send", false), doc("send", true)] as [unknown, unknown],
        receive: [doc("receive", false), doc("receive", true)] as [unknown, unknown],
      }
    })(),
    expect: [
      {
        at: "channels/userEvents/messages/signup/payload/properties/userId/type",
        action: "replace",
        type: breaking,
        mentions: ["userId", "userEvents"],
      },
      {
        at: "channels/userEvents/messages/deleted/payload/required/**",
        action: "add",
        type: { send: nonBreaking, receive: breaking },
        mentions: ["reason", "userEvents"],
      },
    ],
    // ISSUE-340 (fixed): was unclassified (no operation referenced the messages)
  },
  {
    kind: "doc",
    id: "AA-OP-040",
    title: "AsyncAPI 3 operation without messages: channel message referencing a component message",
    before:
      "operation (send / receive) on channel userEvents without a messages list; channel message signup = $ref components/messages/Signup {userId}",
    after: "components.messages.Signup gains the required property email",
    rationale:
      "the component is used by the channel message, which the operation covers (POLICY-120): the component and its usage in the channel take the operation's direction",
    annotation: "names the property and the message",
    sources: [asd("usage index: implied references of an operation without messages (POLICY-120)")],
    docs: (() => {
      const doc = (action: "send" | "receive", changed: boolean) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userEvents: {
            address: "user/events",
            messages: { signup: { $ref: "#/components/messages/Signup" } },
          },
        },
        operations: { onUserEvent: { action, channel: { $ref: "#/channels/userEvents" } } },
        components: {
          messages: {
            Signup: {
              name: "signup",
              payload: changed
                ? {
                    type: "object",
                    properties: { userId: { type: "string" }, email: { type: "string" } },
                    required: ["email"],
                  }
                : { type: "object", properties: { userId: { type: "string" } } },
            },
          },
        },
      })
      return {
        send: [doc("send", false), doc("send", true)] as [unknown, unknown],
        receive: [doc("receive", false), doc("receive", true)] as [unknown, unknown],
      }
    })(),
    expect: [
      {
        at: [
          "channels/userEvents/messages/signup/payload/properties/email",
          "components/messages/Signup/payload/properties/email",
        ],
        action: "add",
        type: { send: nonBreaking, receive: breaking },
        mentions: ["email", /userEvents|Signup/],
      },
      {
        at: [
          "channels/userEvents/messages/signup/payload/required/**",
          "components/messages/Signup/payload/required/**",
        ],
        action: "add",
        type: { send: nonBreaking, receive: breaking },
        mentions: ["email", /userEvents|Signup/],
      },
    ],
    // ISSUE-340 (fixed): was unclassified (no operation referenced the message)
  },
  {
    kind: "doc",
    id: "AA-OP-041",
    title: "AsyncAPI 3 channel used by a send and a receive operation, both without messages",
    before:
      "operations onSend (send) and onReceive (receive) on channel userEvents, neither with a messages list; message signup {userId}",
    after: "signup gains the required property email and the optional property note",
    rationale:
      "the message is used in both directions (POLICY-120): a change is as severe as in the stricter direction, so the new required field breaks (senders of the received message), the new optional field is harmless in both",
    annotation: "names the property and the channel",
    sources: [asd("usage index: implied references of an operation without messages (POLICY-120)")],
    docs: (() => {
      const doc = (changed: boolean) => ({
        asyncapi: "3.0.0",
        info,
        channels: {
          userEvents: {
            address: "user/events",
            messages: {
              signup: {
                name: "signup",
                payload: changed
                  ? {
                      type: "object",
                      properties: { userId: { type: "string" }, email: { type: "string" }, note: { type: "string" } },
                      required: ["email"],
                    }
                  : { type: "object", properties: { userId: { type: "string" } } },
              },
            },
          },
        },
        operations: {
          onSend: { action: "send", channel: { $ref: "#/channels/userEvents" } },
          onReceive: { action: "receive", channel: { $ref: "#/channels/userEvents" } },
        },
      })
      return [doc(false), doc(true)] as [unknown, unknown]
    })(),
    expect: [
      {
        at: "channels/userEvents/messages/signup/payload/properties/email",
        action: "add",
        type: breaking,
        mentions: ["email", "userEvents"],
      },
      {
        at: "channels/userEvents/messages/signup/payload/required/**",
        action: "add",
        type: breaking,
        mentions: ["email", "userEvents"],
      },
      {
        at: "channels/userEvents/messages/signup/payload/properties/note",
        action: "add",
        type: nonBreaking,
        mentions: ["note", "userEvents"],
      },
    ],
    // ISSUE-340 (fixed): was unclassified (no operation referenced the message)
  },
  // POLICY-125 decided (b): an operation reply without a `messages` list does not cover the messages of its reply
  // channel (POLICY-120 covers operations only); only explicitly listed reply messages count as used
  {
    kind: "doc",
    id: "AA-OP-042",
    title: "AsyncAPI 3 operation reply without messages: required property added to a message of the reply channel",
    before:
      "operation (send / receive) on userEvents with messages [signup] and reply { channel: userReplies } without a messages list; userReplies message ack {userId}",
    after: "ack gains the required property email",
    rationale:
      "a reply without a messages list names no message of its channel (POLICY-125 decided (b)): ack is used by no operation, so its change is unclassified like a change in an unreferenced component",
    annotation: "names the property and the reply channel",
    sources: [asd("usage index: no implied references for a reply without messages (POLICY-125)")],
    docs: (() => {
      const doc = (action: "send" | "receive", changed: boolean) =>
        aa3(
          { onUserEvent: op3(action, ["signup"], { reply: { channel: { $ref: "#/channels/userReplies" } } }) },
          {},
          {
            userReplies: {
              address: "user/replies",
              messages: {
                ack: {
                  name: "ack",
                  payload: changed
                    ? {
                        type: "object",
                        properties: { userId: { type: "string" }, email: { type: "string" } },
                        required: ["email"],
                      }
                    : { type: "object", properties: { userId: { type: "string" } } },
                },
              },
            },
          },
        )
      return {
        send: [doc("send", false), doc("send", true)] as [unknown, unknown],
        receive: [doc("receive", false), doc("receive", true)] as [unknown, unknown],
      }
    })(),
    expect: [
      {
        at: "channels/userReplies/messages/ack/payload/properties/email",
        action: "add",
        type: unclassified,
        mentions: ["email", "userReplies"],
      },
      {
        at: "channels/userReplies/messages/ack/payload/required/**",
        action: "add",
        type: unclassified,
        mentions: ["email", "userReplies"],
      },
    ],
  },
]

runCases("asyncapi", "operations", cases, import.meta.filename)
