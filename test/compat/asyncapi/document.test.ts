// AsyncAPI document-level fields: asyncapi version, id, info, root tags / externalDocs, defaultContentType and `x-*` vendor extensions anywhere in the document (POLICY-06).

import { annotation, breaking, unclassified } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const payload = { type: "object", properties: { id: { type: "string" } } }
const aa2 = (extra: Record<string, unknown> = {}, channels: unknown = {}) => ({
  asyncapi: "2.6.0",
  info,
  channels,
  ...extra,
})
const aa3 = (extra: Record<string, unknown> = {}, channels: unknown = {}, operations: unknown = {}) => ({
  asyncapi: "3.0.0",
  info,
  channels,
  operations,
  ...extra,
})
const ch2 = (extra: Record<string, unknown> = {}) => ({
  "user/signup": { subscribe: { message: { payload } }, ...extra },
})
const ch3 = (extra: Record<string, unknown> = {}) => ({
  userSignup: { address: "user/signup", messages: { signup: { payload } }, ...extra },
})
const ops3 = (extra: Record<string, unknown> = {}) => ({
  onSignup: {
    action: "send",
    channel: { $ref: "#/channels/userSignup" },
    messages: [{ $ref: "#/channels/userSignup/messages/signup" }],
    ...extra,
  },
})

const asyncapiDiff = (ref: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${ref}`,
  ...(verdict ? { verdict } : {}),
})

const extSources = (ref: string) => [
  { tool: "fork", ref: `test/asyncapi.extensions.test.ts ${ref}`, verdict: "unclassified" },
  { tool: "asd", ref: "DESIGN_PROPOSALS §12.2 vendor extensions" },
]

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-DOC-001",
    title: "info.title changed",
    before: "info.title compat",
    after: "info.title renamed",
    rationale: "the title is documentation only; no message on the wire changes",
    annotation: "names info title",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/what_changed_test.go TestCompareDocuments_InfoChange" },
      { tool: "libasyncapi", ref: "what-changed/model/proof_test.go TestProof_ScalarChangeDetected" },
      {
        tool: "libasyncapi",
        ref: "what-changed/model/document_config_test.go TestCompareDocumentsWithConfig_IsScopedAndRestoresGlobalRules (custom rule plumbing)",
      },
      asyncapiDiff("v2.ts /info/title"),
      asyncapiDiff("v3.ts /info/title"),
    ],
    docs: {
      "2.6": [aa2(), aa2({ info: { ...info, title: "Renamed" } })],
      "3.0": [aa3(), aa3({ info: { ...info, title: "Renamed" } })],
    },
    expect: [{ at: "info/title", action: "replace", type: annotation, mentions: ["title", "info"] }],
  },
  {
    kind: "doc",
    id: "AA-DOC-002",
    title: "info.version changed",
    before: "info.version 1.0.0",
    after: "info.version 2.0.0",
    rationale: "the document version is metadata; a client that follows the before document keeps working",
    annotation: "names info version",
    sources: [asyncapiDiff("v2.ts /info/version", "breaking"), asyncapiDiff("v3.ts /info/version", "breaking")],
    docs: {
      "2.6": [aa2(), aa2({ info: { ...info, version: "2.0.0" } })],
      "3.0": [aa3(), aa3({ info: { ...info, version: "2.0.0" } })],
    },
    expect: [{ at: "info/version", action: "replace", type: annotation, mentions: ["version", "info"] }],
  },
  {
    kind: "doc",
    id: "AA-DOC-003",
    title: "info.description added",
    before: "no info.description",
    after: "info.description set",
    rationale: "documentation only",
    annotation: "names info description",
    sources: [asyncapiDiff("v2.ts /info/description"), asyncapiDiff("v3.ts /info/description")],
    docs: {
      "2.6": [aa2(), aa2({ info: { ...info, description: "Signup events" } })],
      "3.0": [aa3(), aa3({ info: { ...info, description: "Signup events" } })],
    },
    expect: [{ at: "info/description", action: "add", type: annotation, mentions: ["description", "info"] }],
  },
  {
    kind: "doc",
    id: "AA-DOC-004",
    title: "info.termsOfService changed",
    before: "termsOfService https://a.example.com/tos",
    after: "termsOfService https://b.example.com/tos",
    rationale: "legal metadata; no message or connection changes",
    annotation: "names termsOfService",
    sources: [
      asyncapiDiff("v2.ts /info/termsOfService", "breaking"),
      asyncapiDiff("v3.ts /info/termsOfService", "breaking"),
    ],
    docs: {
      "2.6": [
        aa2({ info: { ...info, termsOfService: "https://a.example.com/tos" } }),
        aa2({ info: { ...info, termsOfService: "https://b.example.com/tos" } }),
      ],
      "3.0": [
        aa3({ info: { ...info, termsOfService: "https://a.example.com/tos" } }),
        aa3({ info: { ...info, termsOfService: "https://b.example.com/tos" } }),
      ],
    },
    expect: [{ at: "info/termsOfService", action: "replace", type: annotation, mentions: ["termsOfService"] }],
  },
  {
    kind: "doc",
    id: "AA-DOC-005",
    title: "info.contact email changed and contact name added",
    before: "contact.email a@example.com",
    after: "contact.email b@example.com, contact.name Team",
    rationale: "contact data is documentation only",
    annotation: "names the contact field",
    sources: [
      { tool: "libasyncapi", ref: "what-changed/model/contact_license_test.go TestCompareContact" },
      {
        tool: "libasyncapi",
        ref: "what-changed/model/contact_license_test.go TestCompareContact_CustomRuleHonored (custom rule plumbing)",
      },
      asyncapiDiff("v2.ts /info/contact/email"),
      asyncapiDiff("v3.ts /info/contact/email"),
      asyncapiDiff("v2.ts /info/contact/name"),
      asyncapiDiff("v3.ts /info/contact/name"),
    ],
    docs: {
      "2.6": [
        aa2({ info: { ...info, contact: { email: "a@example.com" } } }),
        aa2({ info: { ...info, contact: { email: "b@example.com", name: "Team" } } }),
      ],
      "3.0": [
        aa3({ info: { ...info, contact: { email: "a@example.com" } } }),
        aa3({ info: { ...info, contact: { email: "b@example.com", name: "Team" } } }),
      ],
    },
    expect: [
      { at: "info/contact/email", action: "replace", type: annotation, mentions: ["email", "contact"] },
      { at: "info/contact/name", action: "add", type: annotation, mentions: ["name", "contact"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-DOC-006",
    title: "info.license name changed and license url removed",
    before: "license MIT with url",
    after: "license Apache-2.0 without url",
    rationale: "licensing metadata does not change any message or channel",
    annotation: "names the license field",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/contact_license_test.go TestCompareLicense (identifier: not an AsyncAPI field)",
      },
      asyncapiDiff("v2.ts /info/license/name", "breaking"),
      asyncapiDiff("v3.ts /info/license/name", "breaking"),
      asyncapiDiff("v2.ts /info/license/url"),
      asyncapiDiff("v3.ts /info/license/url"),
    ],
    docs: {
      "2.6": [
        aa2({ info: { ...info, license: { name: "MIT", url: "https://opensource.org/licenses/MIT" } } }),
        aa2({ info: { ...info, license: { name: "Apache-2.0" } } }),
      ],
      "3.0": [
        aa3({ info: { ...info, license: { name: "MIT", url: "https://opensource.org/licenses/MIT" } } }),
        aa3({ info: { ...info, license: { name: "Apache-2.0" } } }),
      ],
    },
    expect: [
      { at: "info/license/name", action: "replace", type: annotation, mentions: ["name", "license"] },
      { at: "info/license/url", action: "remove", type: annotation, mentions: ["url", "license"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-DOC-007",
    title: "AsyncAPI 3 info.tags tag added",
    before: "info.tags [users]",
    after: "info.tags [users, billing]",
    rationale: "tags group operations for documentation only",
    annotation: "names the added tag",
    sources: [asyncapiDiff("v3.ts /info/tags/*")],
    docs: [
      aa3({ info: { ...info, tags: [{ name: "users" }] } }),
      aa3({ info: { ...info, tags: [{ name: "users" }, { name: "billing" }] } }),
    ],
    expect: [{ at: "info/tags/**", action: "add", type: annotation, mentions: ["billing"] }],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-DOC-008",
    title: "AsyncAPI 3 info.externalDocs url changed",
    before: "info.externalDocs https://a.example.com",
    after: "info.externalDocs https://b.example.com",
    rationale: "external documentation link only",
    annotation: "names externalDocs url",
    sources: [asyncapiDiff("v3.ts /info/externalDocs")],
    docs: [
      aa3({ info: { ...info, externalDocs: { url: "https://a.example.com" } } }),
      aa3({ info: { ...info, externalDocs: { url: "https://b.example.com" } } }),
    ],
    expect: [{ at: "info/externalDocs/url", action: "replace", type: annotation, mentions: ["url", "externalDocs"] }],
  },
  {
    kind: "doc",
    id: "AA-DOC-009",
    title: "AsyncAPI 2 root tag added",
    before: "tags [users]",
    after: "tags [users, billing]",
    rationale: "root tags are documentation only",
    annotation: "names the added tag",
    sources: [asyncapiDiff("v2.ts /tags"), { tool: "asd", ref: "test/asyncapi/edge-cases.test.ts root tags item add" }],
    docs: [
      aa2({ tags: [{ name: "users" }] }),
      aa2({ tags: [{ name: "users" }, { name: "billing", description: "Billing" }] }),
    ],
    expect: [{ at: "tags/**", action: "add", type: annotation, mentions: ["billing"] }],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-DOC-010",
    title: "AsyncAPI 2 root tag description changed",
    before: "tag users described 'Users'",
    after: "tag users described 'User accounts'",
    rationale: "documentation only",
    annotation: "names the tag and its description",
    sources: [asyncapiDiff("v2.ts /tags")],
    docs: [
      aa2({ tags: [{ name: "users", description: "Users" }] }),
      aa2({ tags: [{ name: "users", description: "User accounts" }] }),
    ],
    expect: [{ at: "tags/0/description", action: "replace", type: annotation, mentions: ["description", "users"] }],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-DOC-011",
    title: "AsyncAPI 2 root tags reordered",
    before: "tags [users, billing]",
    after: "tags [billing, users]",
    rationale: "tags are a set identified by name; reordering is not a change",
    annotation: "no diff",
    sources: [{ tool: "fork", ref: "test/asyncapi.firstReferenceKeyMapping.test.ts reordered ... produce no diffs" }],
    docs: [
      aa2({ tags: [{ name: "users" }, { name: "billing" }] }),
      aa2({ tags: [{ name: "billing" }, { name: "users" }] }),
    ],
    expect: [],
    // ISSUE-111 (fixed)
  },
  {
    kind: "doc",
    id: "AA-DOC-012",
    title: "AsyncAPI 2 root externalDocs url changed",
    before: "externalDocs https://a.example.com",
    after: "externalDocs https://b.example.com",
    rationale: "external documentation link only",
    annotation: "names externalDocs url",
    sources: [
      asyncapiDiff("v2.ts /externalDocs"),
      { tool: "asd", ref: "test/asyncapi/edge-cases.test.ts externalDocs url change" },
    ],
    docs: [
      aa2({ externalDocs: { url: "https://a.example.com" } }),
      aa2({ externalDocs: { url: "https://b.example.com" } }),
    ],
    expect: [{ at: "externalDocs/url", action: "replace", type: annotation, mentions: ["url", "externalDocs"] }],
  },
  {
    kind: "doc",
    id: "AA-DOC-013",
    title: "id changed",
    before: "id urn:example:signup",
    after: "id urn:example:accounts",
    rationale: "the application identifier is metadata; messages and connections do not change",
    annotation: "names id",
    sources: [asyncapiDiff("v2.ts /id"), asyncapiDiff("v3.ts /id", "breaking")],
    docs: {
      "2.6": [aa2({ id: "urn:example:signup" }), aa2({ id: "urn:example:accounts" })],
      "3.0": [aa3({ id: "urn:example:signup" }), aa3({ id: "urn:example:accounts" })],
    },
    expect: [{ at: "id", action: "replace", type: annotation, mentions: ["`id`"] }],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-DOC-014",
    title: "asyncapi minor version bumped",
    before: "asyncapi 2.0.0 / 3.0.0",
    after: "asyncapi 2.6.0 / 3.1.0",
    rationale: "a minor specification version is backward compatible by the AsyncAPI versioning policy",
    annotation: "names the asyncapi field",
    sources: [asyncapiDiff("v2.ts /asyncapi", "breaking"), asyncapiDiff("v3.ts /asyncapi", "breaking")],
    docs: {
      "2.x": [{ ...aa2(), asyncapi: "2.0.0" }, aa2()],
      "3.x": [aa3(), { ...aa3(), asyncapi: "3.1.0" }],
    },
    expect: [{ at: "asyncapi", action: "replace", type: annotation, mentions: ["asyncapi"] }],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-DOC-015",
    title: "defaultContentType changed",
    before: "defaultContentType application/json",
    after: "defaultContentType application/avro",
    rationale:
      "every message without its own contentType is now encoded differently; existing producers and consumers cannot decode it",
    annotation: "names defaultContentType and the new media type",
    sources: [
      asyncapiDiff("v2.ts /defaultContentType"),
      asyncapiDiff("v3.ts /defaultContentType"),
      { tool: "asd", ref: "test/asyncapi/edge-cases.test.ts defaultContentType change is breaking" },
    ],
    docs: {
      "2.6": [
        aa2({ defaultContentType: "application/json" }, ch2()),
        aa2({ defaultContentType: "application/avro" }, ch2()),
      ],
      "3.0": [
        aa3({ defaultContentType: "application/json" }, ch3(), ops3()),
        aa3({ defaultContentType: "application/avro" }, ch3(), ops3()),
      ],
    },
    expect: [
      {
        at: "defaultContentType",
        action: "replace",
        type: breaking,
        mentions: ["defaultContentType", "application/avro"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-DOC-016",
    title: "defaultContentType added",
    before: "no defaultContentType",
    after: "defaultContentType application/avro",
    rationale:
      "messages without a contentType now declare an encoding they did not have; @asyncapi/diff and ASD treat any defaultContentType change as breaking",
    annotation: "names defaultContentType and the media type",
    sources: [asyncapiDiff("v2.ts /defaultContentType"), asyncapiDiff("v3.ts /defaultContentType")],
    docs: {
      "2.6": [aa2({}, ch2()), aa2({ defaultContentType: "application/avro" }, ch2())],
      "3.0": [aa3({}, ch3(), ops3()), aa3({ defaultContentType: "application/avro" }, ch3(), ops3())],
    },
    expect: [
      { at: "defaultContentType", action: "add", type: breaking, mentions: ["defaultContentType", "application/avro"] },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "AA-DOC-017",
    title: "defaultContentType removed",
    before: "defaultContentType application/json",
    after: "no defaultContentType",
    rationale: "messages without a contentType lose their declared encoding",
    annotation: "names defaultContentType and the removed media type",
    sources: [asyncapiDiff("v2.ts /defaultContentType"), asyncapiDiff("v3.ts /defaultContentType")],
    docs: {
      "2.6": [aa2({ defaultContentType: "application/json" }, ch2()), aa2({}, ch2())],
      "3.0": [aa3({ defaultContentType: "application/json" }, ch3(), ops3()), aa3({}, ch3(), ops3())],
    },
    expect: [
      {
        at: "defaultContentType",
        action: "remove",
        type: breaking,
        mentions: ["defaultContentType", "application/json"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
  },
  // vendor extensions (POLICY-06 decided (d)): an x-* key no prefix rule configures is an annotation everywhere, with a description
  {
    kind: "doc",
    id: "AA-DOC-018",
    title: "root x-* extension value changed",
    before: "x-owner team-a",
    after: "x-owner team-b",
    rationale:
      "an extension has no meaning in the specification; POLICY-06 (d): annotation, as for every family (the fork and ASD at the root say unclassified)",
    annotation: "names the extension",
    sources: extSources("string value replaced"),
    docs: {
      "2.6": [aa2({ "x-owner": "team-a" }), aa2({ "x-owner": "team-b" })],
      "3.0": [aa3({ "x-owner": "team-a" }), aa3({ "x-owner": "team-b" })],
    },
    expect: [{ at: "x-owner", action: "replace", type: annotation, mentions: ["x-owner"] }],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-019",
    title: "info x-* extension value changed",
    before: "info.x-audience internal",
    after: "info.x-audience public",
    rationale:
      "POLICY-06 (d): annotation like every other extension (ASD 2.0.0 already reports annotation here because info is an annotation tree)",
    annotation: "names the extension and info",
    sources: extSources("string value replaced"),
    docs: {
      "2.6": [aa2({ info: { ...info, "x-audience": "internal" } }), aa2({ info: { ...info, "x-audience": "public" } })],
      "3.0": [aa3({ info: { ...info, "x-audience": "internal" } }), aa3({ info: { ...info, "x-audience": "public" } })],
    },
    expect: [{ at: "info/x-audience", action: "replace", type: annotation, mentions: ["x-audience", "info"] }],
    // POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-020",
    title: "channel x-* extension string replaced by an array",
    before: "channel x-team 'value'",
    after: "channel x-team ['value']",
    rationale: "POLICY-06 (d): annotation; the change is reported once at the extension",
    annotation: "names the extension and the channel",
    sources: extSources("string-to-array"),
    docs: {
      "2.6": [aa2({}, ch2({ "x-team": "value" })), aa2({}, ch2({ "x-team": ["value"] }))],
      "3.0": [aa3({}, ch3({ "x-team": "value" }), ops3()), aa3({}, ch3({ "x-team": ["value"] }), ops3())],
    },
    expect: [
      {
        at: "channels/*/x-team",
        action: "replace",
        type: annotation,
        mentions: ["x-team", /user\/signup|userSignup/],
      },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-021",
    title: "channel x-* extension string replaced by an object",
    before: "channel x-team 'value'",
    after: "channel x-team { key: value }",
    rationale: "POLICY-06 (d): annotation",
    annotation: "names the extension and the channel",
    sources: extSources("string-to-object"),
    docs: [aa3({}, ch3({ "x-team": "value" }), ops3()), aa3({}, ch3({ "x-team": { key: "value" } }), ops3())],
    expect: [
      { at: "channels/userSignup/x-team", action: "replace", type: annotation, mentions: ["x-team", "userSignup"] },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-022",
    title: "nested property removed inside a channel x-* extension",
    before: "x-team { nested: { property: value } }",
    after: "x-team { nested: {} }",
    rationale: "POLICY-06 (d): annotation; the nested change is located inside the extension",
    annotation: "names the nested key and the extension",
    sources: extSources("delete-any-property-from-json"),
    docs: [
      aa3({}, ch3({ "x-team": { nested: { property: "value" } } }), ops3()),
      aa3({}, ch3({ "x-team": { nested: {} } }), ops3()),
    ],
    expect: [
      { at: "channels/userSignup/x-team/**", action: "remove", type: annotation, mentions: ["property", "x-team"] },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-023",
    title: "nested property added inside a channel x-* extension",
    before: "x-team { nested: {} }",
    after: "x-team { nested: { property: value } }",
    rationale: "POLICY-06 (d): annotation",
    annotation: "names the nested key and the extension",
    sources: extSources("add-any-property-to-json"),
    docs: [
      aa3({}, ch3({ "x-team": { nested: {} } }), ops3()),
      aa3({}, ch3({ "x-team": { nested: { property: "value" } } }), ops3()),
    ],
    expect: [
      { at: "channels/userSignup/x-team/**", action: "add", type: annotation, mentions: ["property", "x-team"] },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-024",
    title: "channel x-* extension object replaced by a JSON-Schema-like object",
    before: "x-team { key: value }",
    after: "x-team { type: object, required: [id], properties: { id } }",
    rationale:
      "an extension is opaque JSON: JSON Schema keywords inside it must not be classified with schema rules; POLICY-06 (d): annotation",
    annotation: "names each changed key and the extension",
    sources: extSources("object-to-json-schema"),
    docs: [
      aa3({}, ch3({ "x-team": { key: "value" } }), ops3()),
      aa3({}, ch3({ "x-team": { type: "object", required: ["id"], properties: { id: { type: "string" } } } }), ops3()),
    ],
    expect: [{ at: "channels/userSignup/x-team/*", type: annotation, mentions: ["x-team"] }],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-025",
    title: "operation x-* extension value changed",
    before: "operation x-rate 10",
    after: "operation x-rate 20",
    rationale: "POLICY-06 (d): annotation",
    annotation: "names the extension and the operation",
    sources: extSources("operation-level extension (re-authored)"),
    docs: {
      "2.6": [
        aa2({}, { "user/signup": { subscribe: { "x-rate": 10, message: { payload } } } }),
        aa2({}, { "user/signup": { subscribe: { "x-rate": 20, message: { payload } } } }),
      ],
      "3.0": [aa3({}, ch3(), ops3({ "x-rate": 10 })), aa3({}, ch3(), ops3({ "x-rate": 20 }))],
    },
    expect: [
      {
        at: ["channels/*/subscribe/x-rate", "operations/onSignup/x-rate"],
        action: "replace",
        type: annotation,
        mentions: ["x-rate", /subscribe|onSignup/],
      },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-026",
    title: "message x-* extension value changed",
    before: "message x-schema-id 1",
    after: "message x-schema-id 2",
    rationale: "POLICY-06 (d): annotation",
    annotation: "names the extension and the message context",
    sources: extSources("message-level extension (re-authored)"),
    docs: {
      "2.6": [
        aa2({}, { "user/signup": { subscribe: { message: { "x-schema-id": 1, payload } } } }),
        aa2({}, { "user/signup": { subscribe: { message: { "x-schema-id": 2, payload } } } }),
      ],
      "3.0": [
        aa3(
          {},
          { userSignup: { address: "user/signup", messages: { signup: { "x-schema-id": 1, payload } } } },
          ops3(),
        ),
        aa3(
          {},
          { userSignup: { address: "user/signup", messages: { signup: { "x-schema-id": 2, payload } } } },
          ops3(),
        ),
      ],
    },
    expect: [
      {
        at: "channels/**/x-schema-id",
        action: "replace",
        type: annotation,
        mentions: ["x-schema-id", /user\/signup|userSignup/],
      },
    ],
    // ISSUE-131 (fixed): POLICY-06 decided (d)
  },
  {
    kind: "doc",
    id: "AA-DOC-027",
    title: "server x-* extension value changed",
    before: "server x-region eu",
    after: "server x-region us",
    rationale: "POLICY-06 (d): annotation",
    annotation: "names the extension and the server",
    sources: extSources("server-level extension (re-authored)"),
    docs: {
      "2.6": [
        aa2({ servers: { prod: { url: "broker.example.com:9092", protocol: "kafka", "x-region": "eu" } } }),
        aa2({ servers: { prod: { url: "broker.example.com:9092", protocol: "kafka", "x-region": "us" } } }),
      ],
      "3.0": [
        aa3({ servers: { prod: { host: "broker.example.com:9092", protocol: "kafka", "x-region": "eu" } } }),
        aa3({ servers: { prod: { host: "broker.example.com:9092", protocol: "kafka", "x-region": "us" } } }),
      ],
    },
    expect: [{ at: "servers/prod/x-region", action: "replace", type: annotation, mentions: ["x-region", "prod"] }],
    // POLICY-06 decided (d)
  },
]

runCases("asyncapi", "document", cases, import.meta.filename)
