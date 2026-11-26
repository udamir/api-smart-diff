// JSON Schema string keywords: minLength, maxLength, pattern, contentMediaType / contentEncoding / contentSchema.

import { breaking, nonBreaking } from "../../../src"
import type { SchemaCase } from "../../helpers/compat"
import { body, both, kwRe, property, rr, seq, withJsd } from "./kw"

const id = seq("STR")
const cs = (name: string, verdict?: string) => [
  { tool: "compat-suites", ref: `schemas/json-schema/${name}` },
  {
    tool: "fork",
    ref: `test/compatibility-suites/schemas/schema-test-runner-general.ts ${name}`,
    ...(verdict ? { verdict } : {}),
  },
]
const str = (extra: Record<string, unknown> = {}) => ({ type: "string", ...extra })

const own: SchemaCase[] = [
  ...both({
    id: id(2),
    title: "maxLength set",
    before: "string",
    after: "string, maxLength 10",
    rationale:
      "request: longer values that were valid are rejected; response: clients only receive values they already accept",
    annotation: "names the keyword (maxLength) and the location",
    sources: cs("add-max-length-for-string-property"),
    stems: ["max-length-set"],
    schema: [str(), str({ maxLength: 10 })],
    expect: [{ at: "maxLength", action: "add", type: rr(breaking, nonBreaking), mentions: ["maxLength"] }],
  }),
  ...both({
    id: id(2),
    title: "maxLength unset",
    before: "string, maxLength 10",
    after: "string",
    rationale:
      "request: accepts more values; response: clients that rely on the length limit (buffers, columns) receive longer values",
    annotation: "names the keyword (maxLength) and the location",
    sources: cs("remove-max-length-for-string-property"),
    stems: ["max-length-unset"],
    schema: [str({ maxLength: 10 }), str()],
    expect: [{ at: "maxLength", action: "remove", type: rr(nonBreaking, breaking), mentions: ["maxLength"] }],
  }),
  ...both({
    id: id(2),
    title: "maxLength increased",
    before: "string, maxLength 5",
    after: "string, maxLength 10",
    rationale: "request: accepts more values; response: values longer than the old limit can be returned",
    annotation: "names the keyword (maxLength) and the location",
    sources: [
      ...cs("increase-max-length-for-string-property"),
      { tool: "asd", ref: "test/jsonSchema/simple-schema.test.ts" },
    ],
    stems: ["max-length-increased"],
    schema: [str({ maxLength: 5 }), str({ maxLength: 10 })],
    expect: [{ at: "maxLength", action: "replace", type: rr(nonBreaking, breaking), mentions: ["maxLength"] }],
  }),
  ...both({
    id: id(2),
    title: "maxLength decreased",
    before: "string, maxLength 10",
    after: "string, maxLength 5",
    rationale: "request: values of length 6..10 become invalid; response: clients receive only shorter values",
    annotation: "names the keyword (maxLength) and the location",
    sources: [
      ...cs("decrease-max-length-for-string-property"),
      { tool: "asd", ref: "test/compat/jsonschema/keywords.test.ts JS-STR-001 (seed)" },
    ],
    stems: ["max-length-decreased"],
    schema: [str({ maxLength: 10 }), str({ maxLength: 5 })],
    expect: [{ at: "maxLength", action: "replace", type: rr(breaking, nonBreaking), mentions: ["maxLength"] }],
  }),
  ...both({
    id: id(2),
    title: "minLength set",
    before: "string",
    after: "string, minLength 3",
    rationale:
      "request: short values that were valid are rejected (oasdiff treats the absent bound as 0, so this is its min-length-increased); response: only longer values are returned",
    annotation: "names the keyword (minLength) and the location",
    sources: cs("add-min-length-for-string-property"),
    stems: ["min-length-increased"],
    schema: [str(), str({ minLength: 3 })],
    expect: [{ at: "minLength", action: "add", type: rr(breaking, nonBreaking), mentions: ["minLength"] }],
  }),
  ...both({
    id: id(2),
    title: "minLength unset",
    before: "string, minLength 3",
    after: "string",
    rationale:
      "request: accepts more values; response: clients may receive empty or short values they never handled (oasdiff: min-length-decreased to 0)",
    annotation: "names the keyword (minLength) and the location",
    sources: cs("remove-min-length-for-string-property"),
    stems: ["min-length-decreased"],
    schema: [str({ minLength: 3 }), str()],
    expect: [{ at: "minLength", action: "remove", type: rr(nonBreaking, breaking), mentions: ["minLength"] }],
  }),
  ...both({
    id: id(2),
    title: "minLength increased",
    before: "string, minLength 1",
    after: "string, minLength 3",
    rationale: "request: values of length 1..2 become invalid; response: only longer values are returned",
    annotation: "names the keyword (minLength) and the location",
    sources: cs("increase-min-length-for-string-property"),
    stems: ["min-length-increased"],
    schema: [str({ minLength: 1 }), str({ minLength: 3 })],
    expect: [{ at: "minLength", action: "replace", type: rr(breaking, nonBreaking), mentions: ["minLength"] }],
  }),
  ...both({
    id: id(2),
    title: "minLength decreased",
    before: "string, minLength 3",
    after: "string, minLength 1",
    rationale: "request: accepts more values; response: shorter values than before can be returned",
    annotation: "names the keyword (minLength) and the location",
    sources: cs("decrease-min-length-for-string-property"),
    stems: ["min-length-decreased"],
    schema: [str({ minLength: 3 }), str({ minLength: 1 })],
    expect: [{ at: "minLength", action: "replace", type: rr(nonBreaking, breaking), mentions: ["minLength"] }],
  }),
  ...both({
    id: id(2),
    title: "pattern added",
    before: "string",
    after: "string, pattern ^[a-z]+$",
    rationale:
      "request: values not matching the pattern become invalid; response: returned values are a subset of the old ones",
    annotation: "names the keyword (pattern) and the location",
    sources: cs("add-pattern-for-string-property"),
    stems: ["pattern-added"],
    schema: [str(), str({ pattern: "^[a-z]+$" })],
    expect: [{ at: "pattern", action: "add", type: rr(breaking, nonBreaking), mentions: ["pattern"] }],
  }),
  ...both({
    id: id(2),
    title: "pattern removed",
    before: "string, pattern ^[a-z]+$",
    after: "string",
    rationale: "request: accepts more values; response: clients relying on the pattern receive arbitrary strings",
    annotation: "names the keyword (pattern) and the location",
    sources: cs("remove-pattern-for-string-property"),
    stems: ["pattern-removed"],
    schema: [str({ pattern: "^[a-z]+$" }), str()],
    expect: [{ at: "pattern", action: "remove", type: rr(nonBreaking, breaking), mentions: ["pattern"] }],
  }),
  ...both({
    id: id(2),
    title: "pattern changed",
    before: "string, pattern ^[a-z]+$",
    after: "string, pattern ^[0-9]+$",
    rationale:
      "ASD convention (ISSUE-39): a replaced pattern is breaking in both directions, since the value sets differ and neither contains the other in general",
    annotation: "names the keyword (pattern) and the location",
    sources: cs("update-pattern-for-string-property"),
    stems: ["pattern-changed"],
    schema: [str({ pattern: "^[a-z]+$" }), str({ pattern: "^[0-9]+$" })],
    expect: [{ at: "pattern", action: "replace", type: breaking, mentions: ["pattern"] }],
  }),
  property({
    id: id(),
    title: "pattern generalized (to match anything)",
    before: "name: string, pattern ^[a-z]+$",
    after: "name: string, pattern .*",
    rationale:
      "the new pattern accepts every value of the old one (oasdiff recognizes only the generalization to `.*`): non-breaking in a request by set inclusion (POLICY-41 decided (b), changed from the proposal); a response client may receive values the old pattern excluded (breaking)",
    annotation: "names the keyword (pattern) and the property",
    sources: [],
    stems: ["pattern-generalized", "pattern-changed"],
    schema: [str({ pattern: "^[a-z]+$" }), str({ pattern: ".*" })],
    expect: [{ at: "pattern", action: "replace", type: rr(nonBreaking, breaking), mentions: ["pattern"] }],
  }),
  body({
    id: id(),
    title: "query parameter pattern generalized (to match anything)",
    before: "p: string, pattern ^[a-z]+$",
    after: "p: string, pattern .*",
    rationale:
      "the new pattern accepts every value of the old one (oasdiff INFO request-parameter-pattern-generalized): non-breaking for a request parameter (POLICY-41 decided (b), set inclusion)",
    annotation: "names the keyword (pattern) and the parameter",
    sources: [
      {
        tool: "oasdiff",
        ref: "checker/check_request_parameter_pattern_added_or_changed_test.go TestRequestParameterPatternGeneralized",
        verdict: "INFO",
      },
    ],
    covers: ["oasdiff:request-parameter-pattern-generalized"],
    placements: ["param"],
    schema: [str({ pattern: "^[a-z]+$" }), str({ pattern: ".*" })],
    // POLICY-41 decided (b)
    expect: [{ at: "pattern", action: "replace", type: nonBreaking, mentions: ["pattern"] }],
  }),
  ...both({
    id: id(2),
    title: "contentSchema added",
    before: "string, contentMediaType application/json",
    after: "string, contentMediaType application/json, contentSchema { type: object }",
    rationale: "request: encoded documents that are not objects become invalid; response: clients receive a subset",
    annotation: "names the keyword (content schema) and the location",
    sources: [],
    stems: ["content-schema-added"],
    schema: [
      str({ contentMediaType: "application/json" }),
      str({ contentMediaType: "application/json", contentSchema: { type: "object" } }),
    ],
    expect: [
      { at: "contentSchema", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("contentSchema")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "contentSchema removed",
    before: "string, contentMediaType application/json, contentSchema { type: object }",
    after: "string, contentMediaType application/json",
    rationale: "request: accepts more encoded documents; response: clients may receive documents of any shape",
    annotation: "names the keyword (content schema) and the location",
    sources: [],
    stems: ["content-schema-removed"],
    schema: [
      str({ contentMediaType: "application/json", contentSchema: { type: "object" } }),
      str({ contentMediaType: "application/json" }),
    ],
    expect: [
      { at: "contentSchema", action: "remove", type: rr(nonBreaking, breaking), mentions: [kwRe("contentSchema")] },
    ],
  }),
  property({
    id: id(),
    title: "contentSchema changed",
    before: "name: string, contentSchema { type: object }",
    after: "name: string, contentSchema { type: array }",
    rationale: "the decoded document type is replaced: breaking in both directions like any type replacement",
    annotation: "names the changed keyword inside the content schema and the property",
    sources: [],
    schema: [
      str({ contentMediaType: "application/json", contentSchema: { type: "object" } }),
      str({ contentMediaType: "application/json", contentSchema: { type: "array" } }),
    ],
    expect: [{ at: "contentSchema/type", action: "replace", type: breaking, mentions: ["type"] }],
  }),
  property({
    id: id(),
    title: "contentMediaType changed",
    before: "name: string, contentMediaType image/png",
    after: "name: string, contentMediaType image/jpeg",
    rationale: "the encoded content is a different media type: producers and consumers of the old one fail",
    annotation: "names the keyword (content media type) and the property",
    sources: [],
    stems: ["content-media-type-changed"],
    schema: [
      str({ contentEncoding: "base64", contentMediaType: "image/png" }),
      str({ contentEncoding: "base64", contentMediaType: "image/jpeg" }),
    ],
    expect: [{ at: "contentMediaType", action: "replace", type: breaking, mentions: [kwRe("contentMediaType")] }],
  }),
  property({
    id: id(),
    title: "contentEncoding changed",
    before: "name: string, contentEncoding base64",
    after: "name: string, contentEncoding base32",
    rationale: "the string must be decoded differently: producers and consumers of the old encoding fail",
    annotation: "names the keyword (content encoding) and the property",
    sources: [],
    stems: ["content-encoding-changed"],
    schema: [str({ contentEncoding: "base64" }), str({ contentEncoding: "base32" })],
    expect: [{ at: "contentEncoding", action: "replace", type: breaking, mentions: [kwRe("contentEncoding")] }],
  }),
]

// Atlassian json-schema-diff test cases (checklist jsd) represented by the cases above
const S = "diff-schemas-type-string"
export const cases = withJsd(own, {
  "JS-STR-005": [
    [S, "string length range is expanded in both directions"],
    [S, "string length range shifted so new range partially overlaps"],
    [S, "string length range shifted so new range doesnt overlap"],
  ],
  "JS-STR-007": [
    [S, "string with maxLength constraint has maxLength made more restrictive"],
    [S, "string length range is restricted in both directions"],
  ],
  "JS-STR-009": [[S, "default min string length is set during complement operation"]],
  "JS-STR-013": [
    [S, "string length range is restricted in both directions"],
    [S, "string length range shifted so new range partially overlaps"],
    [S, "string length range shifted so new range doesnt overlap"],
  ],
  "JS-STR-015": [
    [S, "string with minLength constraint has minLength made less restrictive"],
    [S, "string length range is expanded in both directions"],
  ],
})
