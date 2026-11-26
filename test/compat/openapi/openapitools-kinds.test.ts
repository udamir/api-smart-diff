// Cases harvested from the OpenAPITools openapi-diff test classes (core/src/test/java/org/openapitools/openapidiff/core)
// for the scenarios that the corpus did not hold yet; the change kinds themselves (`BackwardIncompatibleProp`) are mapped
// to existing cases in test/compat/coverage/openapitools-change-kinds.json.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, runCases } from "../../helpers/compat"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const od = (ref: string, verdict?: string) => ({
  tool: "openapi-diff",
  ref: `core/src/test/java/org/openapitools/openapidiff/core/${ref}`,
  ...(verdict ? { verdict } : {}),
})

/** 3.0 document: GET /a responds with the schema / POST /a accepts it, plus the given schema components */
const res = (schema: unknown, schemas: Record<string, unknown>) => ({
  openapi: "3.0.3",
  info,
  paths: { "/a": { get: { responses: { 200: { description: "ok", content: { "application/json": { schema } } } } } } },
  components: { schemas },
})
const req = (schema: unknown, schemas: Record<string, unknown>) => ({
  openapi: "3.0.3",
  info,
  paths: { "/a": { post: { requestBody: { content: { "application/json": { schema } } }, responses: ok } } },
  components: { schemas },
})
const RQ = "paths/~1a/post/requestBody/content/application~1json/schema"
const RS = "paths/~1a/get/responses/200/content/application~1json/schema"

/** array of objects with the property `value` of the given type */
const valuations = (type: string) => ({ type: "array", items: { type: "object", properties: { value: { type } } } })
const direct = (type: string) => ({ type: "object", properties: { valuations: valuations(type) } })
const wrapped = { type: "object", properties: { valuations: { allOf: [{ $ref: "#/components/schemas/Valuations" }] } } }

/** discriminated oneOf component Foo (issue-317) */
const foo = {
  Foo: {
    oneOf: [{ $ref: "#/components/schemas/Bar" }, { $ref: "#/components/schemas/Baz" }],
    discriminator: {
      propertyName: "type",
      mapping: { Bar: "#/components/schemas/Bar", Baz: "#/components/schemas/Baz" },
    },
  },
  Bar: { type: "object", properties: { type: str } },
  Baz: { type: "object", properties: { type: str } },
}
const resource = (assignment: unknown) => ({ type: "object", properties: { assignment } })
const fooRef = { $ref: "#/components/schemas/Foo" }

const pathParam = (name: string) => ({ name, in: "path", required: true, schema: { type: "integer" } })

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-OTK-001",
    area: "refs-components",
    title: "array property wrapped in a single-branch allOf of an array component and unwrapped again",
    before: "valuations: array of { value: string } / allOf [$ref Valuations]",
    after: "valuations: allOf [$ref Valuations] (the same array) / the inline array",
    rationale:
      "a single-branch allOf of a `$ref` accepts exactly the instances of the referenced schema: the response is unchanged in both directions (the component exists on both sides)",
    annotation: "no diff",
    sources: [
      od("Issue887Test.java testAllOfArrayToDirectArrayAreEquals"),
      od("Issue887Test.java testDirectArrayToAllOfArrayAreEquals"),
    ],
    docs: {
      toAllOf: [
        res(direct("string"), { Valuations: valuations("string") }),
        res(wrapped, { Valuations: valuations("string") }),
      ],
      toInline: [
        res(wrapped, { Valuations: valuations("string") }),
        res(direct("string"), { Valuations: valuations("string") }),
      ],
    },
    expect: { toAllOf: [], toInline: [] },
  },
  {
    kind: "doc",
    id: "OAS-OTK-002",
    area: "refs-components",
    title: "inline array replaced by an allOf-wrapped array component whose item property type differs",
    before: "valuations: array of { value: string } (component Valuations has value: integer, unused)",
    after: "valuations: allOf [$ref Valuations]",
    rationale:
      "the item property `value` changes from string to integer behind the wrapper: the comparison must look through the allOf (request: callers sending strings are rejected; response: clients reading strings receive integers)",
    annotation: "names `valuations[].value`, the type change and the body location",
    sources: [
      od("Issue920Test.java testDirectArrayToAllOfArrayDetectsChangedItemType", "incompatible"),
      od("Issue920Test.java testAllOfArrayToDirectArrayDetectsChangedItemType", "incompatible"),
    ],
    covers: ["oatd:SCHEMA_TYPE_CHANGED"],
    docs: {
      request: [
        req(direct("string"), { Valuations: valuations("integer") }),
        req(wrapped, { Valuations: valuations("integer") }),
      ],
      response: [
        res(direct("string"), { Valuations: valuations("integer") }),
        res(wrapped, { Valuations: valuations("integer") }),
      ],
      "response-unwrapped": [
        res(wrapped, { Valuations: valuations("integer") }),
        res(direct("string"), { Valuations: valuations("integer") }),
      ],
    },
    expect: {
      request: [
        {
          at: `${RQ}/properties/valuations/items/properties/value/type`,
          action: "replace",
          type: breaking,
          mentions: ["valuations", "value", "Request Body"],
        },
      ],
      response: [
        {
          at: `${RS}/properties/valuations/items/properties/value/type`,
          action: "replace",
          type: breaking,
          mentions: ["valuations", "value", "Response 200"],
        },
      ],
      "response-unwrapped": [
        {
          at: `${RS}/properties/valuations/items/properties/value/type`,
          action: "replace",
          type: breaking,
          mentions: ["valuations", "value", "Response 200"],
        },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-OTK-003",
    area: "refs-components",
    title: "$ref to a discriminated oneOf component wrapped in allOf together with a default",
    before: "assignment: $ref Foo (oneOf Bar / Baz, discriminator type)",
    after: "assignment: { default: { type: Bar }, allOf: [$ref Foo] } / allOf [$ref Foo] without a default",
    rationale:
      "the wrapper is equivalent; the only change is the default of `assignment` (POLICY-23 (c): request add non-breaking, response annotation). The discriminator stays where it was: it is not copied into the branches",
    annotation: "names the default of `assignment` and the body location",
    sources: [od("AllOfOneOfDiffTest.java allOfReferringToOneOfSchemasAreSupported", "core unchanged")],
    docs: {
      request: [req(resource(fooRef), foo), req(resource({ default: { type: "Bar" }, allOf: [fooRef] }), foo)],
      response: [res(resource(fooRef), foo), res(resource({ default: { type: "Bar" }, allOf: [fooRef] }), foo)],
      "wrap-only": [req(resource(fooRef), foo), req(resource({ allOf: [fooRef] }), foo)],
    },
    expect: {
      request: [
        {
          at: `${RQ}/properties/assignment/default`,
          action: "add",
          type: nonBreaking,
          mentions: ["default", "assignment", "Request Body"],
        },
      ],
      response: [
        {
          at: `${RS}/properties/assignment/default`,
          action: "add",
          type: annotation,
          mentions: ["default", "assignment", "Response 200"],
        },
      ],
      "wrap-only": [],
    },
    // ISSUE-149 (fixed) (P5)
  },
  {
    kind: "doc",
    id: "OAS-OTK-004",
    area: "paths",
    title: "operation added under a path that differs from an existing one only by the template name",
    before: "/pet/{petId} GET",
    after: "/pet/{petId} GET and /pet/{petId2} POST",
    rationale:
      "the paths are the same template (OAS: templated paths that differ only in parameter names are identical); the new POST operation is an addition, existing callers are unaffected",
    annotation: "names the added POST operation and its path",
    sources: [od("PathDiffTest.java testSameTemplateDifferentMethods", "compatible (new endpoint deletePet)")],
    docs: [
      {
        openapi: "3.1.0",
        info,
        paths: { "/pet/{petId}": { get: { parameters: [pathParam("petId")], responses: ok } } },
      },
      {
        openapi: "3.1.0",
        info,
        paths: {
          "/pet/{petId}": { get: { parameters: [pathParam("petId")], responses: ok } },
          "/pet/{petId2}": {
            post: {
              operationId: "deletePet",
              parameters: [pathParam("petId2")],
              responses: { 405: { description: "invalid input" } },
            },
          },
        },
      },
    ],
    expect: [{ at: ["paths/*/post", "paths/*"], action: "add", type: nonBreaking, mentions: ["POST"] }],
  },
  {
    kind: "doc",
    id: "OAS-OTK-005",
    area: "security",
    title: "operation security references an undeclared scheme; an unrelated response description changes",
    before: "GET /a security [{ undeclared }] without components.securitySchemes, 200 description ok",
    after: "the same, 200 description done",
    rationale:
      "an unresolved scheme name must neither abort the comparison (openapi-diff throws) nor produce spurious security diffs; only the response description changed",
    annotation: "names the description of response 200",
    sources: [od("SecurityDiffTest.java testWithUnknownSecurityScheme", "throws IllegalArgumentException")],
    docs: [
      {
        openapi: "3.1.0",
        info,
        paths: { "/a": { get: { security: [{ undeclared: [] }], responses: { 200: { description: "ok" } } } } },
      },
      {
        openapi: "3.1.0",
        info,
        paths: { "/a": { get: { security: [{ undeclared: [] }], responses: { 200: { description: "done" } } } } },
      },
    ],
    expect: [
      {
        at: "paths/~1a/get/responses/200/description",
        action: "replace",
        type: annotation,
        mentions: ["200", "description"],
      },
    ],
  },
]

runCases("openapi", "openapitools-kinds", cases, import.meta.filename)
