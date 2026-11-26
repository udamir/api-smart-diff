// AsyncAPI scenarios of the Netcracker fork tests (github.com/Netcracker/qubership-apihub-api-diff, test/) that the
// other asyncapi case tables do not hold: `nullable` in a payload whose schema format does not define it (AsyncAPI
// Schema, JSON Schema draft-07) and a multi-format payload unwrapped into a plain schema together with a type change.
//
// Variants: `3.0-receive` = a message the application consumes (request semantics), `3.0-send` = a message it produces
// (response semantics), docs/BENCHMARK.md §3; the fork's multi-format tests are AsyncAPI 3 only.

import { annotation, breaking } from "../../../src"
import { type CaseSource, type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const fork = (ref: string, verdict?: string): CaseSource => ({
  tool: "fork",
  ref: `test/asyncapi.multiformat-schema.test.ts ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const m3 = (action: "send" | "receive", payload: unknown) => ({
  asyncapi: "3.0.0",
  info,
  channels: { userSignup: { address: "user/signup", messages: { signup: { payload } } } },
  operations: {
    onSignup: {
      action,
      channel: { $ref: "#/channels/userSignup" },
      messages: [{ $ref: "#/channels/userSignup/messages/signup" }],
    },
  },
})
const both = (before: unknown, after: unknown) => ({
  "3.0-send": [m3("send", before), m3("send", after)] as [unknown, unknown],
  "3.0-receive": [m3("receive", before), m3("receive", after)] as [unknown, unknown],
})
const at = (field: string) => [`channels/userSignup/messages/signup/${field}`]
const CH = /user\/signup|userSignup/

const ASYNCAPI_ALIAS = "application/vnd.aai.asyncapi;version=3.0.0"
const DRAFT7 = "application/schema+json;version=draft-07"

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "AA-FRK-001",
    area: "messages",
    title: "`nullable` changed in a payload whose schema format does not define it",
    before:
      "payload { type: string, nullable: false } (plain AsyncAPI schema / multi-format AsyncAPI alias / draft-07)",
    after: "payload { type: string, nullable: true } in the same format",
    rationale:
      "`nullable` is an OpenAPI 3.0 keyword: neither the AsyncAPI Schema Object nor JSON Schema draft-07 define it, so it does not change the valid payloads (POLICY-10 decided (a): a definition without effect is an annotation; fork: unclassified)",
    annotation: "names nullable and the channel",
    sources: [
      fork("asyncapi-format-uses-asyncapi-schema-rules: nullable change is unclassified", "unclassified"),
      fork("asyncapi-format-aliases: alternate asyncapi format string also uses asyncapi schema rules", "unclassified"),
      fork("json-draft7-format-uses-json-schema-rules: nullable change is unclassified", "unclassified"),
    ],
    docs: {
      ...Object.fromEntries(
        Object.entries(both({ type: "string", nullable: false }, { type: "string", nullable: true })).map(([k, v]) => [
          `plain-${k}`,
          v,
        ]),
      ),
      ...Object.fromEntries(
        Object.entries(
          both(
            { schemaFormat: ASYNCAPI_ALIAS, schema: { type: "string", nullable: false } },
            { schemaFormat: ASYNCAPI_ALIAS, schema: { type: "string", nullable: true } },
          ),
        ).map(([k, v]) => [`alias-${k}`, v]),
      ),
      ...Object.fromEntries(
        Object.entries(
          both(
            { schemaFormat: DRAFT7, schema: { type: "string", nullable: false } },
            { schemaFormat: DRAFT7, schema: { type: "string", nullable: true } },
          ),
        ).map(([k, v]) => [`draft-07-${k}`, v]),
      ),
    },
    expect: [
      {
        at: [...at("payload/nullable"), ...at("payload/schema/nullable")],
        type: annotation,
        mentions: ["nullable", CH],
      },
    ],
    // ISSUE-133 (fixed)
  },
  {
    kind: "doc",
    id: "AA-FRK-002",
    area: "messages",
    title: "AsyncAPI 3 multi-format payload unwrapped into a plain schema with a type change",
    before: "payload { schemaFormat: AsyncAPI 3.0.0, schema: { type: integer } }",
    after: "payload { type: string }",
    rationale:
      "the unwrapping alone is a representation change (AA-MSG-021); the type change is breaking in both directions (ISSUE-39 convention; fork breaking)",
    annotation: "names the type change and the channel",
    sources: [
      fork("multiformat-to-schema-with-type-change: multi-format integer → plain string (send scope)", "breaking"),
    ],
    docs: both(
      { schemaFormat: "application/vnd.aai.asyncapi+json;version=3.0.0", schema: { type: "integer" } },
      { type: "string" },
    ),
    expect: [
      {
        at: [...at("payload/type"), ...at("payload/schema/type")],
        action: "replace",
        type: breaking,
        mentions: ["type", CH],
      },
    ],
    // ISSUE-104 (fixed)
  },
]

runCases("asyncapi", "fork-tests", cases, import.meta.filename)
