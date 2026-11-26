import fs from "node:fs"
import path from "node:path"
import YAML from "js-yaml"

import { breaking, deprecated, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

// Cross-cutting cases: diff volume (usage-site expansion), the TBAPI release-series pattern that the benchmark
// consensus mis-flagged, and identical-document checks over every repository fixture.

const info = { title: "compat", version: "1.0.0" }

// S0 -> (left, right) -> S1 -> ... -> Sn: 2^n reference paths from the operation to Sn
const dag = (n: number, leaf: Record<string, unknown>) => {
  const schemas: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    schemas[`S${i}`] = {
      type: "object",
      properties: {
        left: { $ref: `#/components/schemas/S${i + 1}` },
        right: { $ref: `#/components/schemas/S${i + 1}` },
      },
    }
  }
  schemas[`S${n}`] = { type: "object", ...leaf }
  return {
    openapi: "3.0.3",
    info,
    paths: {
      "/reports": {
        get: {
          responses: {
            200: {
              description: "ok",
              content: { "application/json": { schema: { $ref: "#/components/schemas/S0" } } },
            },
          },
        },
      },
    },
    components: { schemas },
  }
}

// a ring of object types T0 -> T1 -> ... -> T(k-1) -> T0 with `fan` fields to the following types
const ring = (k: number, fan: number, drop?: number) =>
  [
    "type Query { root: T0 }",
    ...Array.from({ length: k }, (_, i) => {
      const fields = Array.from({ length: fan }, (_, j) => `f${j}: T${(i + j + 1) % k}`).join(" ")
      return `type T${i} { id: ID! ${i === drop ? "" : "extra: Int "}${fields} }`
    }),
  ].join("\n")

const resources = path.join(import.meta.dirname, "..", "..", "resources")
const loadResource = (file: string): unknown => {
  const text = fs.readFileSync(path.join(resources, file), "utf8")
  return file.endsWith(".json") ? JSON.parse(text) : YAML.load(text)
}

const identicalCases: CompatCase[] = fs
  .readdirSync(resources)
  .filter((file) => /\.(ya?ml|json)$/.test(file))
  .sort()
  .map((file, i) => ({
    kind: "doc",
    id: `X-IDENT-${String(i + 1).padStart(3, "0")}`,
    area: "identical",
    title: `repository fixture ${file} compared with itself`,
    before: file,
    after: "the same document (deep copy)",
    rationale: "an unchanged document has no changes; every tool in the benchmark reports 0 diffs on identical inputs",
    annotation: "no diff, hence no description",
    sources: [
      { tool: "asd", ref: `test/resources/${file}` },
      { tool: "bench", ref: "docs/BENCHMARK.md §4.6 identical documents" },
    ],
    docs: [loadResource(file), loadResource(file)] as [unknown, unknown],
    expect: [],
  }))

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "X-VOL-001",
    area: "volume",
    title: "a change in a component reached through a DAG of nested $refs is reported once per component declaration",
    before: "GET /reports 200 -> S0 -> {left,right} -> S1 -> ... -> S4 { code: string }",
    after: "S4.code: integer",
    rationale:
      "the usage sites inside the response (left.left...code, one per payload location) are distinct locations a client reads, but under `components` the change belongs to the declaration S4 only; re-expanding it inside S0..S3 once per reference path is exponential (2^(n+1) - 1 component diffs for depth n) and is what inflates real documents (TBAPI order-management: 20 762 diffs for 362 structural differences)",
    annotation:
      "type change of `code` (with its payload path at usage sites; in schema component `S4` at the declaration)",
    sources: [
      { tool: "bench", ref: "docs/BENCHMARK.md §4.9 finding (4) diff volume, tbapi-order-management" },
      { tool: "fork", ref: "one diff per declaration (beforeDeclarationPaths)", verdict: "1 diff" },
      {
        tool: "oasdiff",
        ref: "checker/check_response_property_type_changed.go response-property-type-changed",
        verdict: "1 per operation",
      },
    ],
    covers: ["oasdiff:response-property-type-changed"],
    docs: [dag(4, { properties: { code: { type: "string" } } }), dag(4, { properties: { code: { type: "integer" } } })],
    expect: [
      {
        at: "paths/~1reports/get/responses/200/content/application~1json/schema/**/code/type",
        type: breaking,
        mentions: ["code", "Response 200"],
        // one per payload location: 2^4 reference paths from the operation to S4
        count: 16,
      },
      // once at the declaration, never re-expanded inside S0..S3
      { at: "components/schemas/S4/properties/code/type", type: breaking, mentions: ["code", "S4"], count: 1 },
    ],
    // ISSUE-53 (fixed): 17 diffs (16 usage locations + 1 declaration) instead of 47; the declaration diff is still
    // described without its component ("[Replaced] of code"), ISSUE-56
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "X-VOL-002",
    area: "volume",
    title: "a vendor extension change inside a shared schema",
    before: "S4 { x-owner: team-a } reached through the same DAG",
    after: "S4 { x-owner: team-b }",
    rationale:
      "an `x-*` value is not part of the payload contract; reported once per usage site and `unclassified` it was 11 294 of 20 762 diffs on tbapi-order-management; POLICY-06 (d): annotation; POLICY-57 (decided after P3): an annotation-only change inside a component is reported at its declaration only, not at every usage site (non-annotation changes keep their per-usage diffs, X-VOL-001)",
    annotation: "names the extension key and the schema / payload location",
    sources: [
      { tool: "bench", ref: "docs/BENCHMARK.md §4.9 noise note (x-* inside schemas)" },
      {
        tool: "fork",
        ref: "test/openapi.specificationExtensions.test.ts",
        verdict: "unclassified, once per declaration",
      },
      { tool: "openapi-changes", ref: "extension changes", verdict: "non-breaking" },
    ],
    docs: [
      dag(2, { "x-owner": "team-a", properties: { code: { type: "string" } } }),
      dag(2, { "x-owner": "team-b", properties: { code: { type: "string" } } }),
    ],
    expect: [
      // POLICY-57 decided: annotation-only, so once at the declaration and not at the 2^2 payload locations
      { at: "components/schemas/S2/x-owner", type: "annotation" as const, mentions: ["x-owner", "S2"], count: 1 },
    ],
    // POLICY-06 decided (d); the second cause (the x-* change unclassified, ISSUE-131) is fixed since P1; ISSUE-53
    // (fixed): 5 diffs instead of 11; ISSUE-190 (fixed, P3b): 1 diff, the 4 usage-site annotation diffs are no longer
    // reported. Remaining cause: the declaration diff does not name its component S2, ISSUE-56
    // ISSUE-56 (fixed) (P8a)
  },
  {
    kind: "graphql",
    id: "X-VOL-003",
    area: "volume",
    title: "an output field removed from one type of a cyclic type graph",
    before: "Query.root: T0; ring T0..T7, each type with 2 fields to the next types and `extra: Int`",
    after: "T7.extra removed",
    rationale:
      "one declaration changed; GraphApi 0.1.2 inlines object types at every usage, so the change is re-reported inside every type on every acyclic path to T7 (hundreds of diffs for 8 types, growing exponentially; the GitHub schema does not finish), while the 1.0 encoding reports it once",
    annotation: "names the type and the field (T7, extra)",
    sources: [
      {
        tool: "bench",
        ref: "docs/BENCHMARK.md §4.5 / §7.2 GraphApi 0.1.2 does not scale (gql-github timeout, > 15 min, 3 GB)",
      },
      { tool: "graphql-inspector", ref: "FIELD_REMOVED", verdict: "1 change" },
    ],
    sdl: [ring(8, 2), ring(8, 2, 7)],
    // plan P3 / ISSUE-53: GraphApi 0.1.2 usages are nominal like 1.0 `typeDef`s (the walk stops at a named type), so
    // the change is reported once, at the declaration, in both encodings; the former 0.1.2 expectation also listed the
    // inlined usage sites under `queries/root/**`
    expect: [
      { at: "components/objects/T7/**/extra", action: "remove", type: breaking, mentions: ["T7", "extra"], count: 1 },
    ],
    // ISSUE-53 (fixed): 1 diff instead of 88; the 0.1.2 description reads "annotation (extra)" without the type, ISSUE-127
    // ISSUE-127 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "X-TBAPI-001",
    area: "tbapi-patterns",
    title: "inline property schema refactored into allOf [$ref, { deprecated, x-* }] with an equivalent target",
    before: "items.value: { type: number, description }",
    after:
      "items.value: { allOf: [ { $ref: Money } , { deprecated: true, x-policy: soft } ] }, Money = { type: number, description }",
    rationale:
      "the merged allOf is the same schema plus a deprecation, so the only contract change is the deprecation (the 4 consensus breaking operations 2.0.0 missed on the TBAPI release series are this pattern; oasdiff without --flatten-allof and openapi-changes over-report it)",
    annotation: "deprecation of `items[].value` (and the extension as an annotation)",
    sources: [
      {
        tool: "bench",
        ref: "bench/results/tbapi-spotcheck.json category 'inline schema refactored into allOf' (two consecutive release pairs)",
      },
      { tool: "oasdiff", ref: "response-required-property-removed (default options)", verdict: "ERR" },
      { tool: "openapi-changes", ref: "extension added", verdict: "breaking" },
      { tool: "fork", ref: "allOf merged", verdict: "deprecated" },
    ],
    docs: [
      {
        openapi: "3.0.3",
        info,
        paths: {
          "/discounts": {
            get: {
              responses: {
                200: {
                  description: "ok",
                  content: {
                    "application/json": {
                      schema: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["value"],
                          properties: { value: { type: "number", description: "amount" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        openapi: "3.0.3",
        info,
        paths: {
          "/discounts": {
            get: {
              responses: {
                200: {
                  description: "ok",
                  content: {
                    "application/json": {
                      schema: {
                        type: "array",
                        items: {
                          type: "object",
                          required: ["value"],
                          properties: {
                            value: {
                              allOf: [{ $ref: "#/components/schemas/Money" }, { deprecated: true, "x-policy": "soft" }],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: { schemas: { Money: { type: "number", description: "amount" } } },
      },
    ],
    expect: [
      { at: "paths/**/items/properties/value/deprecated", action: "add", type: deprecated, mentions: ["value"] },
      {
        at: "paths/**/items/properties/value/x-policy",
        action: "add",
        type: "annotation" as const,
        mentions: ["x-policy"],
      },
      // POLICY-75 decided (a): the added component is usage-derived like every component change; the after document
      // references it from a response, so its addition is non-breaking (as OAS-REF-013 / OAS-SEC-024)
      { at: "components/schemas/Money", action: "add", type: nonBreaking, mentions: ["Money"] },
    ],
    // POLICY-06 decided (d), ISSUE-131 (fixed): the extension is an annotation; ISSUE-160 (fixed): the `components`
    // section added is reported per component since P4; POLICY-75 decided (a) (P8a): expectation rewritten from
    // unclassified to non-breaking
  },
  ...identicalCases,
]

runCases("core", "cross-cutting", cases, import.meta.filename)
