// AsyncAPI servers: added / removed servers, 2.x url, 3.0 host / pathname, protocol, protocolVersion, variables, security, documentation fields, `$ref` servers and the channel `servers` list. Server bindings are in bindings-traits.test.ts.
//
// POLICY-09 decided (a), for OpenAPI and AsyncAPI alike (decision §11.18): servers are deployment metadata and every server change is an annotation, as ASD 2.0.0 does; @asyncapi/diff classifies connection-relevant fields (its verdict is recorded per case).

import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const aa2 = (servers: unknown, extra: Record<string, unknown> = {}) => ({
  asyncapi: "2.6.0",
  info,
  servers,
  channels: {},
  ...extra,
})
const aa3 = (servers: unknown, extra: Record<string, unknown> = {}) => ({
  asyncapi: "3.0.0",
  info,
  servers,
  channels: {},
  operations: {},
  ...extra,
})
const prod2 = { url: "broker.example.com:9092", protocol: "kafka" }
const dev2 = { url: "dev.example.com:9092", protocol: "kafka" }
const prod3 = { host: "broker.example.com:9092", protocol: "kafka" }
const dev3 = { host: "dev.example.com:9092", protocol: "kafka" }

const asyncapiDiff = (ref: string, verdict?: string) => ({
  tool: "asyncapi-diff",
  ref: `src/standards/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string, verdict?: string) => ({ tool: "asd", ref, ...(verdict ? { verdict } : {}) })
const asdServers = asd("src/asyncapi/asyncapi2.rules.ts / asyncapi3.rules.ts servers: annotation tree")

const secSchemes = { components: { securitySchemes: { user: { type: "userPassword" } } } }

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-SRV-001",
    title: "server removed",
    before: "servers prod and dev",
    after: "server prod only",
    rationale: "clients configured with the dev broker can no longer connect; POLICY-09 (a): servers are annotations",
    annotation: "names the removed server",
    sources: [
      asyncapiDiff("v2.ts /servers/*", "breaking"),
      asyncapiDiff("v3.ts /servers/*", "breaking"),
      asdServers,
      { tool: "fork", ref: "test/asyncapi.firstReferenceKeyMapping.test.ts remove server" },
    ],
    docs: {
      "2.6": [aa2({ prod: prod2, dev: dev2 }), aa2({ prod: prod2 })],
      "3.0": [aa3({ prod: prod3, dev: dev3 }), aa3({ prod: prod3 })],
    },
    expect: [{ at: "servers/dev", action: "remove", type: annotation, mentions: ["dev"] }],
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-002",
    title: "server added",
    before: "server prod",
    after: "servers prod and dev",
    rationale: "existing clients keep their broker; POLICY-09 (a): servers are annotations",
    annotation: "names the added server",
    sources: [
      asyncapiDiff("v2.ts /servers/*", "non-breaking"),
      asyncapiDiff("v3.ts /servers/*", "non-breaking"),
      asdServers,
      { tool: "fork", ref: "test/asyncapi.firstReferenceKeyMapping.test.ts add server" },
    ],
    docs: {
      "2.6": [aa2({ prod: prod2 }), aa2({ prod: prod2, dev: dev2 })],
      "3.0": [aa3({ prod: prod3 }), aa3({ prod: prod3, dev: dev3 })],
    },
    expect: [{ at: "servers/dev", action: "add", type: annotation, mentions: ["dev"] }],
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-003",
    title: "AsyncAPI 2 server url changed",
    before: "url broker.example.com:9092",
    after: "url events.example.com:9092",
    rationale: "clients connect to the documented url; POLICY-09 (a): servers are annotations",
    annotation: "names url, the server and the new url",
    sources: [
      asyncapiDiff("v2.ts /servers/*/url", "breaking"),
      asdServers,
      asd("test/asyncapi/edge-cases.test.ts server add, remove and url change are annotations", "annotation"),
    ],
    docs: [aa2({ prod: prod2 }), aa2({ prod: { ...prod2, url: "events.example.com:9092" } })],
    expect: [
      {
        at: "servers/prod/url",
        action: "replace",
        type: annotation,
        mentions: ["url", "prod", "events.example.com:9092"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-004",
    title: "AsyncAPI 3 server host changed",
    before: "host broker.example.com:9092",
    after: "host events.example.com:9092",
    rationale: "clients connect to the documented host; POLICY-09 (a): servers are annotations",
    annotation: "names host, the server and the new host",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/what_changed_test.go TestCompareDocuments_ServerHostChange",
        verdict: "breaking",
      },
      asyncapiDiff("v3.ts /servers/*/host", "breaking"),
      { tool: "openapi-changes", ref: "sample-specs/asyncapi-original.yaml -> asyncapi.yaml (host broker -> events)" },
      asdServers,
    ],
    docs: [aa3({ prod: prod3 }), aa3({ prod: { ...prod3, host: "events.example.com:9092" } })],
    expect: [
      {
        at: "servers/prod/host",
        action: "replace",
        type: annotation,
        mentions: ["host", "prod", "events.example.com:9092"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-005",
    title: "AsyncAPI 3 server pathname changed",
    before: "pathname /v1",
    after: "pathname /v2",
    rationale: "the connection path is part of the endpoint clients use; POLICY-09 (a): servers are annotations",
    annotation: "names pathname, the server and the new pathname",
    sources: [asyncapiDiff("v3.ts /servers/*/pathname", "breaking"), asdServers],
    docs: [
      aa3({ prod: { ...prod3, protocol: "ws", pathname: "/v1" } }),
      aa3({ prod: { ...prod3, protocol: "ws", pathname: "/v2" } }),
    ],
    expect: [
      { at: "servers/prod/pathname", action: "replace", type: annotation, mentions: ["pathname", "prod", "/v2"] },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-006",
    title: "server protocol changed",
    before: "protocol kafka",
    after: "protocol kafka-secure",
    rationale: "clients speaking the old protocol cannot connect; POLICY-09 (a): servers are annotations",
    annotation: "names protocol, the server and the new protocol",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareServers_ProtocolModifiedBreaking",
        verdict: "breaking",
      },
      asyncapiDiff("v2.ts /servers/*/protocol", "breaking"),
      asyncapiDiff("v3.ts /servers/*/protocol", "breaking"),
      asdServers,
    ],
    docs: {
      "2.6": [aa2({ prod: prod2 }), aa2({ prod: { ...prod2, protocol: "kafka-secure" } })],
      "3.0": [aa3({ prod: prod3 }), aa3({ prod: { ...prod3, protocol: "kafka-secure" } })],
    },
    expect: [
      {
        at: "servers/prod/protocol",
        action: "replace",
        type: annotation,
        mentions: ["protocol", "prod", "kafka-secure"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-007",
    title: "server protocolVersion changed",
    before: "protocolVersion 2.8",
    after: "protocolVersion 3.5",
    rationale:
      "clients built for the old protocol version may not interoperate (@asyncapi/diff breaking); POLICY-09 (a): servers are annotations",
    annotation: "names protocolVersion, the server and the new version",
    sources: [
      asyncapiDiff("v2.ts /servers/*/protocolVersion", "breaking"),
      asyncapiDiff("v3.ts /servers/*/protocolVersion", "breaking"),
      asdServers,
    ],
    docs: {
      "2.6": [aa2({ prod: { ...prod2, protocolVersion: "2.8" } }), aa2({ prod: { ...prod2, protocolVersion: "3.5" } })],
      "3.0": [aa3({ prod: { ...prod3, protocolVersion: "2.8" } }), aa3({ prod: { ...prod3, protocolVersion: "3.5" } })],
    },
    expect: [
      {
        at: "servers/prod/protocolVersion",
        action: "replace",
        type: annotation,
        mentions: ["protocolVersion", "prod", "3.5"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-008",
    title: "server description changed",
    before: "description 'Production'",
    after: "description 'Production cluster'",
    rationale: "documentation only (all tools agree)",
    annotation: "names description and the server",
    sources: [asyncapiDiff("v2.ts /servers/*/description"), asyncapiDiff("v3.ts /servers/*/description")],
    docs: {
      "2.6": [
        aa2({ prod: { ...prod2, description: "Production" } }),
        aa2({ prod: { ...prod2, description: "Production cluster" } }),
      ],
      "3.0": [
        aa3({ prod: { ...prod3, description: "Production" } }),
        aa3({ prod: { ...prod3, description: "Production cluster" } }),
      ],
    },
    expect: [
      { at: "servers/prod/description", action: "replace", type: annotation, mentions: ["description", "prod"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-SRV-009",
    title: "AsyncAPI 3 server title and summary added",
    before: "server without title / summary",
    after: "server with title and summary",
    rationale: "documentation only",
    annotation: "names the field and the server",
    sources: [asyncapiDiff("v3.ts /servers/*/title")],
    docs: [aa3({ prod: prod3 }), aa3({ prod: { ...prod3, title: "Production", summary: "Production broker" } })],
    expect: [
      { at: "servers/prod/title", action: "add", type: annotation, mentions: ["title", "prod"] },
      { at: "servers/prod/summary", action: "add", type: annotation, mentions: ["summary", "prod"] },
    ],
  },
  {
    kind: "doc",
    id: "AA-SRV-010",
    title: "server tags and externalDocs added",
    before: "server without tags / externalDocs",
    after: "server with tags [env:prod] (3.0: and externalDocs)",
    rationale: "documentation only",
    annotation: "names the field and the server",
    sources: [asyncapiDiff("v3.ts /servers/*/tags"), asyncapiDiff("v3.ts /servers/*/externalDocs")],
    docs: {
      "2.6": [aa2({ prod: prod2 }), aa2({ prod: { ...prod2, tags: [{ name: "env:prod" }] } })],
      "3.0": [
        aa3({ prod: prod3 }),
        aa3({ prod: { ...prod3, tags: [{ name: "env:prod" }], externalDocs: { url: "https://docs.example.com" } } }),
      ],
    },
    expect: {
      "2.6": [{ at: "servers/prod/tags", action: "add", type: annotation, mentions: ["tags", "prod"] }],
      "3.0": [
        { at: "servers/prod/tags", action: "add", type: annotation, mentions: ["tags", "prod"] },
        { at: "servers/prod/externalDocs", action: "add", type: annotation, mentions: ["externalDocs", "prod"] },
      ],
    },
  },
  {
    kind: "doc",
    id: "AA-SRV-011",
    title: "server variable enum value removed",
    before: "variable env enum [eu, us]",
    after: "variable env enum [eu]",
    rationale: "clients connecting to the us broker lose it; POLICY-09 (a): servers are annotations",
    annotation: "names the variable, the server and the removed value",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareServerVariables_EnumEntryRemovedBreaking",
        verdict: "breaking",
      },
      asyncapiDiff("v2.ts /servers/*/variables/*/enum/*", "breaking"),
      asyncapiDiff("v3.ts /servers/*/variables/*/enum/*", "breaking"),
      asdServers,
    ],
    docs: {
      "2.6": [
        aa2({
          prod: {
            url: "{env}.example.com:9092",
            protocol: "kafka",
            variables: { env: { enum: ["eu-west", "us-east"], default: "eu-west" } },
          },
        }),
        aa2({
          prod: {
            url: "{env}.example.com:9092",
            protocol: "kafka",
            variables: { env: { enum: ["eu-west"], default: "eu-west" } },
          },
        }),
      ],
      "3.0": [
        aa3({
          prod: {
            host: "{env}.example.com:9092",
            protocol: "kafka",
            variables: { env: { enum: ["eu-west", "us-east"], default: "eu-west" } },
          },
        }),
        aa3({
          prod: {
            host: "{env}.example.com:9092",
            protocol: "kafka",
            variables: { env: { enum: ["eu-west"], default: "eu-west" } },
          },
        }),
      ],
    },
    expect: [
      {
        at: "servers/prod/variables/env/enum/**",
        action: "remove",
        type: annotation,
        mentions: ["env", "prod", "us-east"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-012",
    title: "server variable enum value added",
    before: "variable env enum [eu]",
    after: "variable env enum [eu, us]",
    rationale: "every broker address valid before is still valid; POLICY-09 (a): servers are annotations",
    annotation: "names the variable, the server and the added value",
    sources: [asyncapiDiff("v2.ts /servers/*/variables/*/enum/*", "non-breaking"), asdServers],
    docs: [
      aa2({
        prod: {
          url: "{env}.example.com:9092",
          protocol: "kafka",
          variables: { env: { enum: ["eu-west"], default: "eu-west" } },
        },
      }),
      aa2({
        prod: {
          url: "{env}.example.com:9092",
          protocol: "kafka",
          variables: { env: { enum: ["eu-west", "us-east"], default: "eu-west" } },
        },
      }),
    ],
    expect: [
      {
        at: "servers/prod/variables/env/enum/**",
        action: "add",
        type: annotation,
        mentions: ["env", "prod", "us-east"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-013",
    title: "server variable default changed",
    before: "variable env default eu-west",
    after: "variable env default us-east",
    rationale:
      "clients that substitute the default connect to another broker (@asyncapi/diff breaking); POLICY-09 (a): servers are annotations",
    annotation: "names default, the variable and the server",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareServerVariables_DefaultModifiedBreaking",
        verdict: "breaking",
      },
      asyncapiDiff("v2.ts /servers/*/variables/*/default", "breaking"),
      asyncapiDiff("v3.ts /servers/*/variables/*/default", "breaking"),
      asdServers,
    ],
    docs: {
      "2.6": [
        aa2({ prod: { url: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu-west" } } } }),
        aa2({ prod: { url: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "us-east" } } } }),
      ],
      "3.0": [
        aa3({
          prod: { host: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu-west" } } },
        }),
        aa3({
          prod: { host: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "us-east" } } },
        }),
      ],
    },
    expect: [
      {
        at: "servers/prod/variables/env/default",
        action: "replace",
        type: annotation,
        mentions: ["default", "env", "prod"],
      },
    ],
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-014",
    title: "server variable description and examples added",
    before: "variable env without description / examples",
    after: "variable env with description and examples",
    rationale: "documentation only (all tools agree)",
    annotation: "names the field, the variable and the server",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/coverage_test.go TestCompareServerVariables_ExamplesNotBreaking",
      },
      asyncapiDiff("v2.ts /servers/*/variables/*/description"),
      asyncapiDiff("v2.ts /servers/*/variables/*/examples"),
      asyncapiDiff("v3.ts /servers/*/variables/*/description"),
      asyncapiDiff("v3.ts /servers/*/variables/*/examples"),
    ],
    docs: {
      "2.6": [
        aa2({ prod: { url: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu-west" } } } }),
        aa2({
          prod: {
            url: "{env}.example.com:9092",
            protocol: "kafka",
            variables: { env: { default: "eu-west", description: "Region", examples: ["eu-west"] } },
          },
        }),
      ],
      "3.0": [
        aa3({
          prod: { host: "{env}.example.com:9092", protocol: "kafka", variables: { env: { default: "eu-west" } } },
        }),
        aa3({
          prod: {
            host: "{env}.example.com:9092",
            protocol: "kafka",
            variables: { env: { default: "eu-west", description: "Region", examples: ["eu-west"] } },
          },
        }),
      ],
    },
    expect: [
      {
        at: "servers/prod/variables/env/description",
        action: "add",
        type: annotation,
        mentions: ["description", "env", "prod"],
      },
      {
        at: "servers/prod/variables/env/examples",
        action: "add",
        type: annotation,
        mentions: ["examples", "env", "prod"],
      },
    ],
  },
  {
    kind: "doc",
    id: "AA-SRV-015",
    title: "server security requirement added",
    before: "server without security",
    after: "server requires the user (userPassword) scheme",
    rationale:
      "clients connecting without credentials are rejected (@asyncapi/diff breaking; ASD OpenAPI classifies security requirements)",
    annotation: "names security, the scheme and the server",
    sources: [asyncapiDiff("v2.ts /servers/*/security"), asyncapiDiff("v3.ts /servers/*/security")],
    docs: {
      "2.6": [aa2({ prod: prod2 }, secSchemes), aa2({ prod: { ...prod2, security: [{ user: [] }] } }, secSchemes)],
      "3.0": [
        aa3({ prod: prod3 }, secSchemes),
        aa3({ prod: { ...prod3, security: [{ $ref: "#/components/securitySchemes/user" }] } }, secSchemes),
      ],
    },
    expect: [
      {
        at: ["servers/prod/security", "servers/prod/security/**"],
        action: "add",
        type: breaking,
        mentions: ["security", "user", "prod"],
      },
    ],
    // ISSUE-114 (fixed) (P8-rest); ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-SRV-016",
    title: "server security requirement removed",
    before: "server requires the user scheme",
    after: "server without security",
    rationale: "clients that still send credentials keep connecting (@asyncapi/diff: breaking on any security change)",
    annotation: "names security and the server",
    sources: [
      asyncapiDiff("v2.ts /servers/*/security", "breaking"),
      asyncapiDiff("v3.ts /servers/*/security", "breaking"),
    ],
    docs: {
      "2.6": [aa2({ prod: { ...prod2, security: [{ user: [] }] } }, secSchemes), aa2({ prod: prod2 }, secSchemes)],
      "3.0": [
        aa3({ prod: { ...prod3, security: [{ $ref: "#/components/securitySchemes/user" }] } }, secSchemes),
        aa3({ prod: prod3 }, secSchemes),
      ],
    },
    expect: [
      {
        at: ["servers/prod/security", "servers/prod/security/**"],
        action: "remove",
        type: nonBreaking,
        mentions: ["security", "prod"],
      },
    ],
    // ISSUE-101 (fixed)
  },
  {
    kind: "doc",
    id: "AA-SRV-017",
    title: "AsyncAPI 3 server host changed through a components/servers $ref",
    before: "servers.prod $ref components/servers/prod (host broker.example.com)",
    after: "the same reference, host events.example.com",
    rationale:
      "the referenced server is the one clients use; POLICY-09 (a): servers are annotations; POLICY-57: an annotation-only change inside a component is reported at the component only",
    annotation: "names host and the server",
    sources: [asyncapiDiff("v3.ts /servers/*/host", "breaking"), asdServers],
    docs: [
      aa3({ prod: { $ref: "#/components/servers/prod" } }, { components: { servers: { prod: prod3 } } }),
      aa3(
        { prod: { $ref: "#/components/servers/prod" } },
        { components: { servers: { prod: { ...prod3, host: "events.example.com:9092" } } } },
      ),
    ],
    expect: [
      {
        at: ["servers/prod/host", "components/servers/prod/host"],
        action: "replace",
        type: annotation,
        mentions: ["host", "prod", "events.example.com:9092"],
      },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-018",
    title: "server removed from a channel's servers list",
    before: "channel servers [prod, dev]",
    after: "channel servers [prod]",
    rationale: "clients using the channel on the dev broker lose it; POLICY-09 (a): servers are annotations",
    annotation: "names the removed server and the channel",
    sources: [
      {
        tool: "libasyncapi",
        ref: "what-changed/model/channel_test.go TestCompareChannels_ServerRefAddedAndRemoved",
        verdict: "breaking",
      },
      asyncapiDiff("v3.ts /channels/*/servers/*", "breaking"),
      asdServers,
    ],
    docs: {
      "2.6": [
        aa2(
          { prod: prod2, dev: dev2 },
          {
            channels: {
              "user/signup": { servers: ["prod", "dev"], subscribe: { message: { payload: { type: "string" } } } },
            },
          },
        ),
        aa2(
          { prod: prod2, dev: dev2 },
          {
            channels: { "user/signup": { servers: ["prod"], subscribe: { message: { payload: { type: "string" } } } } },
          },
        ),
      ],
      "3.0": [
        aa3(
          { prod: prod3, dev: dev3 },
          {
            channels: {
              userSignup: { address: "user/signup", servers: [{ $ref: "#/servers/prod" }, { $ref: "#/servers/dev" }] },
            },
          },
        ),
        aa3(
          { prod: prod3, dev: dev3 },
          { channels: { userSignup: { address: "user/signup", servers: [{ $ref: "#/servers/prod" }] } } },
        ),
      ],
    },
    expect: [
      { at: "channels/*/servers/**", action: "remove", type: annotation, mentions: ["dev", /user\/signup|userSignup/] },
    ],
    // ISSUE-114 (fixed) (P8a)
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-019",
    title: "channel restricted to a servers list",
    before: "channel without servers (available on every server)",
    after: "channel servers [prod]",
    rationale:
      "2.6 / 3.0 §Channel: an absent servers list means every server; listing one removes the channel from dev (@asyncapi/diff: add non-breaking); POLICY-09 (a): servers are annotations",
    annotation: "names servers and the channel",
    sources: [asyncapiDiff("v3.ts /channels/*/servers", "non-breaking"), asdServers],
    docs: {
      "2.6": [
        aa2(
          { prod: prod2, dev: dev2 },
          { channels: { "user/signup": { subscribe: { message: { payload: { type: "string" } } } } } },
        ),
        aa2(
          { prod: prod2, dev: dev2 },
          {
            channels: { "user/signup": { servers: ["prod"], subscribe: { message: { payload: { type: "string" } } } } },
          },
        ),
      ],
      "3.0": [
        aa3({ prod: prod3, dev: dev3 }, { channels: { userSignup: { address: "user/signup" } } }),
        aa3(
          { prod: prod3, dev: dev3 },
          { channels: { userSignup: { address: "user/signup", servers: [{ $ref: "#/servers/prod" }] } } },
        ),
      ],
    },
    expect: [
      { at: "channels/*/servers", action: "add", type: annotation, mentions: ["servers", /user\/signup|userSignup/] },
    ],
    // POLICY-09 decided (a)
  },
  {
    kind: "doc",
    id: "AA-SRV-020",
    title: "servers reordered",
    before: "servers prod, dev",
    after: "servers dev, prod",
    rationale: "servers is a map keyed by name; order carries no meaning",
    annotation: "no diff",
    sources: [
      { tool: "fork", ref: "test/asyncapi.firstReferenceKeyMapping.test.ts reordered servers produce no diffs" },
    ],
    docs: {
      "2.6": [aa2({ prod: prod2, dev: dev2 }), aa2({ dev: dev2, prod: prod2 })],
      "3.0": [aa3({ prod: prod3, dev: dev3 }), aa3({ dev: dev3, prod: prod3 })],
    },
    expect: [],
  },
]

runCases("asyncapi", "servers", cases, import.meta.filename)
