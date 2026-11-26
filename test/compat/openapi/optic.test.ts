import { annotation, breaking, nonBreaking } from "../../../src"
import { type CompatCase, type ExpectedChange, type ExpectedType, risky, type SchemaCase } from "../../helpers/compat"
import { runCases } from "../../helpers/compat"
import { NAME, rr } from "../jsonschema/kw"

// Scenarios of Optic's breaking-changes ruleset tests (opticdev/optic, MIT, archived 2025:
// projects/standard-rulesets/src/breaking-changes/__tests__ and helpers/__tests__) that the corpus did not have yet.
// Optic's own verdict (`passed` = no breaking change, `failed` = breaking) is recorded where it differs; the checklist is
// test/compat/coverage/optic-breaking-changes-tests.json. Optic's union-transition helper treats a type removed from a
// response union as breaking and a type added to it as safe (and the reverse in requests); ASD follows the consumer
// viewpoint (DESIGN_PROPOSALS §11): a response may only narrow, a request may only widen.

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const oas = (paths: Record<string, unknown>, i: Record<string, unknown> = info) => ({
  openapi: "3.1.0",
  info: i,
  paths,
})
const op = (o: Record<string, unknown> = {}) => ({ responses: ok, ...o })

const T = "projects/standard-rulesets/src/breaking-changes/__tests__"
const H = "projects/standard-rulesets/src/breaking-changes/helpers/__tests__"
const optic = (file: string, test: string, verdict?: string) => ({
  tool: "optic",
  ref: `${file} ${test}`,
  ...(verdict ? { verdict } : {}),
})
const bc = (test: string, verdict?: string) => optic(`${T}/breaking-changes.test.ts`, test, verdict)
const un = (test: string, verdict?: string) => optic(`${H}/unions.test.ts`, test, verdict)
const covers = (...ids: string[]) => ids.map((id) => `optic:${id}`)

// ---------------------------------------------------------------------------------------------------------------
// parameters in the four locations (Optic test.each over query / cookie / path / header)

type Loc = "query" | "cookie" | "path" | "header"
const LOCS: Loc[] = ["query", "cookie", "path", "header"]
const paramDoc = (loc: Loc, p: Record<string, unknown>) =>
  oas({
    [loc === "path" ? "/users/{test}" : "/users"]: {
      get: op({ parameters: [{ name: "test", in: loc, ...(loc === "path" ? { required: true } : {}), ...p }] }),
    },
  })
const paramPath = (loc: Loc) =>
  loc === "path" ? "paths/~1users~1{test}/get/parameters/0" : "paths/~1users/get/parameters/0"
const perLoc = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  Object.fromEntries(LOCS.map((l) => [l, [paramDoc(l, before), paramDoc(l, after)] as [unknown, unknown]]))
const perLocExpect = (
  at: string,
  type: ExpectedType,
  extra: (string | RegExp)[] = [],
): Record<string, ExpectedChange[]> =>
  Object.fromEntries(
    LOCS.map((l) => [l, [{ at: `${paramPath(l)}/${at}`, type, mentions: [`${l} parameter \`test\``, ...extra] }]]),
  )

const docCases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-OPT-001",
    area: "operations",
    title: "operation removed while info.version gets a new major version",
    before: "info.version 1.0.0, GET /users",
    after: "info.version 2.0.0 (or Optic's empty spec 0.0.0), no paths",
    rationale:
      "a major version bump announces breaking changes but does not make them safe: clients of GET /users fail; the version itself is metadata (Optic skips its checks when skip_when_major_version_changes is set)",
    annotation: "names the removed operation; the version change is an annotation",
    sources: [
      optic(
        `${T}/breaking-changes.test.ts`,
        "fromOpticConfig > does not throw breaking change if semvar has updated",
        "passed",
      ),
      optic(`${T}/breaking-changes.test.ts`, "fromOpticConfig > does throws breaking change if semvar flag false"),
    ],
    covers: covers(
      "breaking-changes::fromOpticConfig > does not throw breaking change if semvar has updated",
      "breaking-changes::fromOpticConfig > does throws breaking change if semvar flag false",
    ),
    docs: {
      major: [oas({ "/users": { get: op() } }), oas({}, { ...info, version: "2.0.0" })],
      empty: [oas({ "/users": { get: op() } }), oas({}, { title: "Empty", version: "0.0.0" })],
    },
    expect: {
      major: [
        { at: "paths/~1users/get", action: "remove", type: breaking, mentions: ["GET /users"] },
        { at: "info/version", type: annotation },
      ],
      empty: [
        { at: "paths/~1users/get", action: "remove", type: breaking, mentions: ["GET /users"] },
        { at: "info/version", type: annotation },
        { at: "info/title", type: annotation },
      ],
    },
  },
  {
    kind: "doc",
    id: "OAS-OPT-002",
    area: "operations",
    title: "several compatible changes in one operation (Optic 'valid changes')",
    before:
      "GET /users: required query `required`, optional query `optional`, cookie enum [1, 2], header enum [1, 2]; request { id } required [id]; response { id, name } required [id]",
    after:
      "query `required` optional, `optional` removed, cookie enum [1, 2, 3], header enum dropped; request { id, anotherId } nothing required; response { id, name, hello } required [id, name, hello]",
    rationale:
      "each change widens the request or narrows the response, except the removed optional query parameter: clients still sending it lose its effect (OAS-PARAM-008, breaking; Optic passes it)",
    annotation: "one description per change naming the parameter or the property",
    sources: [bc("breaking changes ruleset > valid changes", "passed")],
    covers: covers("breaking-changes::breaking changes ruleset > valid changes"),
    docs: [
      oas({
        "/users": {
          get: {
            parameters: [
              { name: "required", in: "query", required: true, schema: { type: "string" } },
              { name: "optional", in: "query", schema: { type: "string" } },
              { name: "required", in: "header", required: true, schema: { type: "string" } },
              { name: "enum-widening", in: "cookie", schema: { type: "number", enum: [1, 2] } },
              { name: "enum-removal", in: "header", schema: { type: "number", enum: [1, 2] } },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
                },
              },
            },
            responses: {
              200: {
                description: "ok",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" }, name: { type: "string" } },
                      required: ["id"],
                    },
                  },
                },
              },
            },
          },
        },
      }),
      oas({
        "/users": {
          get: {
            parameters: [
              { name: "required", in: "query", schema: { type: "string" } },
              { name: "required", in: "header", required: true, schema: { type: "string" } },
              { name: "enum-widening", in: "cookie", schema: { type: "number", enum: [1, 2, 3] } },
              { name: "enum-removal", in: "header", schema: { type: "number" } },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: { type: "object", properties: { id: { type: "string" }, anotherId: { type: "number" } } },
                },
              },
            },
            responses: {
              200: {
                description: "ok",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { id: { type: "string" }, name: { type: "string" }, hello: { type: "number" } },
                      required: ["id", "name", "hello"],
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ],
    expect: [
      { at: "paths/~1users/get/parameters/0/required", type: nonBreaking, mentions: ["query parameter `required`"] },
      {
        at: "paths/~1users/get/parameters/1",
        action: "remove",
        type: breaking,
        mentions: ["query parameter `optional`"],
      },
      {
        at: "paths/~1users/get/parameters/3/schema/enum/*",
        action: "add",
        type: nonBreaking,
        mentions: ["cookie parameter `enum-widening`"],
      },
      {
        at: ["paths/~1users/get/parameters/4/schema/enum", "paths/~1users/get/parameters/4/schema/enum/*"],
        action: "remove",
        type: nonBreaking,
        mentions: ["header parameter `enum-removal`"],
      },
      {
        at: "paths/~1users/get/requestBody/content/application~1json/schema/properties/anotherId",
        action: "add",
        type: nonBreaking,
        mentions: ["anotherId"],
      },
      {
        at: "paths/~1users/get/requestBody/content/application~1json/schema/required/*",
        action: "remove",
        type: nonBreaking,
      },
      {
        at: "paths/~1users/get/responses/200/content/application~1json/schema/properties/hello",
        action: "add",
        type: nonBreaking,
        mentions: ["hello"],
      },
      {
        at: "paths/~1users/get/responses/200/content/application~1json/schema/required/*",
        action: "add",
        type: nonBreaking,
      },
    ],
    // ISSUE-87 (fixed): removing the enum keyword is one non-breaking keyword diff; the cookie value added still reads
    // "[Replaced]" (ISSUE-57)
    // ISSUE-57 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-OPT-003",
    area: "parameters",
    title: "parameter schema type changed (string -> number) in each location",
    before: "query / cookie / path / header parameter test: string",
    after: "test: number",
    rationale: "clients sending non-numeric values are rejected; neither type contains the other",
    annotation: "names the parameter and the type change",
    sources: [
      optic(`${T}/parameter-type-breaking-changes.test.ts`, "%p parameter type change"),
      { tool: "oasdiff", ref: "checker/check_request_parameter_type_changed.go request-parameter-type-changed" },
    ],
    covers: covers(
      "parameter-type-breaking-changes::breaking changes ruleset - parameter type change > %p parameter type change",
    ),
    docs: perLoc({ schema: { type: "string" } }, { schema: { type: "number" } }),
    expect: perLocExpect("schema/type", breaking),
  },
  {
    kind: "doc",
    id: "OAS-OPT-004",
    area: "parameters",
    title: "enum added to a parameter in each location (became enum)",
    before: "query / cookie / path / header parameter test: string",
    after: "test: string, enum [a, b]",
    rationale: "values outside the enum are now rejected: breaking for the request",
    annotation: "names the parameter and the new enum",
    sources: [optic(`${T}/enum-breaking-changes.test.ts`, "enum added to %p parameter")],
    covers: covers(
      "enum-breaking-changes::breaking changes ruleset - parameter enum change > enum added to %p parameter",
    ),
    docs: perLoc({ schema: { type: "string" } }, { schema: { type: "string", enum: ["a", "b"] } }),
    expect: Object.fromEntries(
      LOCS.map((l) => [
        l,
        [
          {
            at: [`${paramPath(l)}/schema/enum`, `${paramPath(l)}/schema/enum/*`],
            action: "add",
            type: breaking,
            mentions: [`${l} parameter \`test\``],
          },
        ],
      ]),
    ),
    // ISSUE-87 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-OPT-005",
    area: "parameters",
    title: "parameter enum narrowed in each location",
    before: "query / cookie / path / header parameter test: enum [a, b]",
    after: "enum [b]",
    rationale: "clients sending a are rejected",
    annotation: "names the parameter and the removed value",
    sources: [optic(`${T}/enum-breaking-changes.test.ts`, "%p parameter enum narrowing")],
    covers: covers(
      "enum-breaking-changes::breaking changes ruleset - parameter enum change > %p parameter enum narrowing",
    ),
    docs: perLoc({ schema: { type: "string", enum: ["a", "b"] } }, { schema: { type: "string", enum: ["b"] } }),
    expect: Object.fromEntries(
      LOCS.map((l) => [
        l,
        [
          {
            at: `${paramPath(l)}/schema/enum/*`,
            action: "remove",
            type: breaking,
            mentions: [`${l} parameter \`test\``, "a"],
          },
        ],
      ]),
    ),
    // ISSUE-57 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-OPT-006",
    area: "parameters",
    title: "parameter const rewritten as the equivalent single-value enum in each location",
    before: "query / cookie / path / header parameter test: string, const a",
    after: "test: string, enum [a]",
    rationale: "both forms accept exactly the value a (JS-ENUM-022 for a body property)",
    annotation: "no diff",
    sources: [optic(`${T}/enum-breaking-changes.test.ts`, "enum converted to const %p parameter")],
    covers: covers(
      "enum-breaking-changes::breaking changes ruleset - parameter enum change > enum converted to const %p parameter",
    ),
    docs: perLoc({ schema: { type: "string", const: "a" } }, { schema: { type: "string", enum: ["a"] } }),
    expect: [],
  },
  {
    kind: "doc",
    id: "OAS-OPT-007",
    area: "parameters",
    title: "parameter const changed in each location",
    before: "query / cookie / path / header parameter test: string, const a",
    after: "test: string, const b",
    rationale: "the only accepted value changes: clients sending a are rejected",
    annotation: "names the parameter and the new value",
    sources: [optic(`${T}/enum-breaking-changes.test.ts`, "const changes picked up as breaking %p parameter")],
    covers: covers(
      "enum-breaking-changes::breaking changes ruleset - parameter enum change > const changes picked up as breaking %p parameter",
    ),
    docs: perLoc({ schema: { type: "string", const: "a" } }, { schema: { type: "string", const: "b" } }),
    expect: perLocExpect("schema/const", breaking),
  },
  {
    kind: "doc",
    id: "OAS-OPT-008",
    area: "parameters",
    title: "cookie parameter became required",
    before: "optional cookie parameter version",
    after: "required cookie parameter version",
    rationale: "clients that do not send the cookie are rejected (query and header: OAS-PARAM-011 / 012)",
    annotation: "names the parameter and that it became required",
    sources: [optic(`${T}/parameter-requirement-breaking-changes.test.ts`, "%p parameter optional to required")],
    covers: covers(
      "parameter-requirement-breaking-changes::breaking changes ruleset - parameter requirement change > %p parameter optional to required",
    ),
    docs: [
      oas({ "/users": { get: op({ parameters: [{ name: "version", in: "cookie", schema: { type: "string" } }] }) } }),
      oas({
        "/users": {
          get: op({ parameters: [{ name: "version", in: "cookie", required: true, schema: { type: "string" } }] }),
        },
      }),
    ],
    expect: [
      {
        at: "paths/~1users/get/parameters/0/required",
        type: breaking,
        mentions: ["cookie parameter `version`", "required"],
      },
    ],
  },
  {
    kind: "doc",
    id: "OAS-OPT-009",
    area: "request-body",
    title: "nested multi-type schemas compared with an identical copy",
    before:
      "property nested: type [object, string, array] (or oneOf [string, object, array]) with properties and items",
    after: "the same schema",
    rationale: "no change: no diff (Optic checks that its union matcher finds no transition)",
    annotation: "no diff",
    sources: [
      un("computeUnionTransition > %s > transitions > type array to type array > valid overlap with object and arrays"),
      un("computeUnionTransition > %s > transitions > oneOf to oneOf > valid overlap with objects and arrays"),
    ],
    covers: covers(
      "unions::computeUnionTransition > %s > transitions > type array to type array > valid overlap with object and arrays",
      "unions::computeUnionTransition > %s > transitions > oneOf to oneOf > valid overlap with objects and arrays",
    ),
    docs: {
      typeArray: [bodyDoc(typeArrayNested()), bodyDoc(typeArrayNested())],
      oneOf: [bodyDoc(oneOfNested()), bodyDoc(oneOfNested())],
    },
    expect: [],
  },
]

// ---------------------------------------------------------------------------------------------------------------
// schemas (request body and response): Optic's union-transition fixtures

function bodyDoc(schema: unknown) {
  return oas({
    "/users": { post: op({ requestBody: { content: { "application/json": { schema } } } }) },
  })
}

/** Optic's `typeArrays.nested`: a property that is an object, a string or an array */
function typeArrayNested(o: { street?: boolean; itemTypes?: string[] } = {}) {
  return {
    type: "object",
    properties: {
      nested: typeArrayNestedValue(o),
    },
  }
}
function typeArrayNestedValue(o: { street?: boolean; itemTypes?: string[] } = {}) {
  return {
    type: ["object", "string", "array"],
    properties: {
      id: { type: "string" },
      address: {
        type: "object",
        properties: { street: { type: "string" } },
        ...(o.street ? { required: ["street"] } : {}),
      },
    },
    required: ["id"],
    items: { type: o.itemTypes ?? ["boolean", "number"] },
  }
}
/** Optic's `oneOf.nested`: the same value space written as oneOf */
function oneOfNested(o: { street?: boolean; itemTypes?: string[] } = {}) {
  return { type: "object", properties: { nested: oneOfNestedValue(o) } }
}
function oneOfNestedValue(o: { street?: boolean; itemTypes?: string[] } = {}) {
  return {
    oneOf: [
      { type: "string" },
      {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          address: {
            type: "object",
            properties: { street: { type: "string" } },
            ...(o.street ? { required: ["street"] } : {}),
          },
        },
      },
      { type: "array", items: { oneOf: (o.itemTypes ?? ["boolean", "number"]).map((type) => ({ type })) } },
    ],
  }
}

const obj = (properties: Record<string, unknown>, required?: string[]) => ({
  type: "object",
  properties,
  ...(required ? { required } : {}),
})
const s = { type: "string" }
const status = (values: string[]) => ({ type: "string", enum: values })

const schemaCases: SchemaCase[] = [
  {
    kind: "schema",
    id: "OAS-OPT-010",
    area: "request-body",
    title: "root body schema object -> string",
    before: "object { id }",
    after: "string",
    rationale: "neither shape accepts the other: breaking for writers and for readers",
    annotation: "names the type change of the body",
    sources: [bc("breaking changes ruleset > root request body type change")],
    covers: covers("breaking-changes::breaking changes ruleset > root request body type change"),
    schema: [obj({ id: s }), s],
    expect: [
      { at: "type", action: "replace", type: breaking },
      { at: ["properties", "properties/**"], optional: true, type: rr(nonBreaking, nonBreaking) },
    ],
  },
  {
    kind: "schema",
    id: "OAS-OPT-011",
    area: "request-body",
    title: "single-branch oneOf dissolved into its branch",
    before: "oneOf [object { id } required [id]]",
    after: "object { id } required [id]",
    rationale: "a oneOf with one branch accepts exactly that branch: no change in either direction",
    annotation: "no diff (or annotations)",
    sources: [bc("breaking changes ruleset > valid request union type transition", "passed")],
    covers: covers("breaking-changes::breaking changes ruleset > valid request union type transition"),
    schema: [{ oneOf: [obj({ id: s }, ["id"])] }, obj({ id: s }, ["id"])],
    expect: [{ at: "**", type: annotation, optional: true }],
  },
  {
    kind: "schema",
    id: "OAS-OPT-012",
    area: "responses",
    title: "object wrapped in oneOf with a new number branch and a new required property",
    before: "object { id }",
    after: "oneOf [number, object { id, name } required [id, name]]",
    rationale:
      "response: readers now receive numbers (breaking; Optic passes it); the new required name is additive for readers; request: a new branch widens, a new required property narrows",
    annotation: "names the new branch and the new required property",
    sources: [bc("breaking changes ruleset > valid response union type transition", "passed (response)")],
    covers: covers("breaking-changes::breaking changes ruleset > valid response union type transition"),
    schema: [obj({ id: s }), { oneOf: [{ type: "number" }, obj({ id: s, name: s }, ["id", "name"])] }],
    expect: [
      { at: ["oneOf/0", "oneOf/0/**"], action: "add", type: rr(nonBreaking, breaking) },
      { at: ["oneOf/1/properties/name", "oneOf/1/required/*"], action: "add", type: rr(breaking, nonBreaking) },
    ],
    // ISSUE-150 (fixed) (P5): the object is paired with the object branch; ISSUE-211 (fixed) (P5): the diffs inside
    // the pair are reported at the branch's merged (after) position `oneOf/1` (decision §11.2)
  },
  {
    kind: "schema",
    id: "OAS-OPT-013",
    area: "responses",
    title: "oneOf branch removed that a remaining branch does not cover",
    before: "oneOf [number, object { id } required [id], object { id, name } required [id, name]]",
    after: "oneOf [number, object { id, name } required [id, name]]",
    rationale:
      "response: readers see a subset of the former values (non-breaking); request: writers sending { id } alone are rejected (breaking)",
    annotation: "names the removed branch",
    sources: [bc("breaking changes ruleset > valid union type refactor", "passed")],
    covers: covers("breaking-changes::breaking changes ruleset > valid union type refactor"),
    schema: [
      { oneOf: [{ type: "number" }, obj({ id: s }, ["id"]), obj({ id: s, name: s }, ["id", "name"])] },
      { oneOf: [{ type: "number" }, obj({ id: s, name: s }, ["id", "name"])] },
    ],
    expect: [{ at: ["oneOf/*", "oneOf/*/**"], type: rr(breaking, nonBreaking) }],
  },
  {
    kind: "schema",
    id: "OAS-OPT-014",
    area: "responses",
    title: "type array [number, object] rewritten as oneOf while the object loses its required properties",
    before: "type [number, object] { id, name } required [id, name]",
    after: "oneOf [number, object { id, name }]",
    rationale: "the rewrite is equivalent; required removed: risky for readers (POLICY-05), non-breaking for writers",
    annotation: "names the properties that became optional",
    sources: [bc("breaking changes ruleset > invalid union type transition", "failed")],
    covers: covers("breaking-changes::breaking changes ruleset > invalid union type transition"),
    schema: [
      { type: ["number", "object"], properties: { id: s, name: s }, required: ["id", "name"] },
      { oneOf: [{ type: "number" }, obj({ id: s, name: s })] },
    ],
    expect: [
      { at: ["required", "required/*", "oneOf/*/required", "oneOf/*/required/*"], type: rr(nonBreaking, risky) },
      { at: "**", type: annotation, optional: true },
    ],
    // ISSUE-98 (fixed) (P5)
  },
  {
    kind: "schema",
    id: "OAS-OPT-015",
    area: "request-body",
    title: "type array [number, object] rewritten as oneOf while an enum value is removed",
    before: "type [number, object] { id, status enum [online, offline] }",
    after: "oneOf [number, object { id, status enum [online] }]",
    rationale: "the rewrite is equivalent; the removed enum value breaks writers, readers see fewer values",
    annotation: "names the removed enum value",
    sources: [bc("breaking changes ruleset > invalid union type enum transition in request", "failed")],
    covers: covers("breaking-changes::breaking changes ruleset > invalid union type enum transition in request"),
    schema: [
      { type: ["number", "object"], properties: { id: s, status: status(["online", "offline"]) } },
      { oneOf: [{ type: "number" }, obj({ id: s, status: status(["online"]) })] },
    ],
    expect: [
      {
        at: ["**/status/enum/*", "**/status/enum"],
        action: "remove",
        type: rr(breaking, nonBreaking),
        mentions: ["offline"],
      },
      { at: "**", type: annotation, optional: true },
    ],
    // ISSUE-98 (fixed) (P5): the type list is compared as the oneOf of single-type branches; remaining cause: the enum
    // description, ISSUE-57
    // ISSUE-57 (fixed) (P8a)
  },
  {
    kind: "schema",
    id: "OAS-OPT-016",
    area: "responses",
    title: "type array [number, object] rewritten as oneOf while an enum value is added",
    before: "type [number, object] { id, status enum [online] }",
    after: "oneOf [number, object { id, status enum [online, offline] }]",
    rationale: "the rewrite is equivalent; a new enum value is risky for readers (POLICY-05) and widens writers",
    annotation: "names the added enum value",
    sources: [bc("breaking changes ruleset > invalid union type enum transition in response", "failed")],
    covers: covers("breaking-changes::breaking changes ruleset > invalid union type enum transition in response"),
    schema: [
      { type: ["number", "object"], properties: { id: s, status: status(["online"]) } },
      { oneOf: [{ type: "number" }, obj({ id: s, status: status(["online", "offline"]) })] },
    ],
    expect: [
      {
        at: ["**/status/enum/*", "**/status/enum"],
        action: "add",
        type: rr(nonBreaking, risky),
        mentions: ["offline"],
      },
      { at: "**", type: annotation, optional: true },
    ],
    // ISSUE-98 (fixed) (P5): the type list is compared as the oneOf of single-type branches; remaining cause: the enum
    // description, ISSUE-57
    // ISSUE-57 (fixed) (P8a)
  },
  {
    kind: "schema",
    id: "OAS-OPT-017",
    area: "request-body",
    title: "type array member replaced ([string, number] -> [string, boolean])",
    before: "name: type [string, number]",
    after: "name: type [string, boolean]",
    rationale: "number removed: breaking for writers; boolean added: breaking for readers",
    annotation: "names the removed and the added type",
    sources: [optic(`${H}/type-change.test.ts`, "computeEffectiveTypeChange > non-identical sets")],
    covers: covers("type-change::computeEffectiveTypeChange > non-identical sets"),
    schema: [obj({ name: { type: ["string", "number"] } }), obj({ name: { type: ["string", "boolean"] } })],
    // ASD compares type arrays by position: the member at index 1 is replaced, breaking in both directions (the net
    // effect of number removed + boolean added); a set-based report as remove + add is accepted as well
    expect: [
      { at: "properties/name/type/*", action: "replace", type: breaking, mentions: [NAME, "number"] },
      { at: "properties/name/type/*", action: "remove", type: rr(breaking, nonBreaking), optional: true },
      { at: "properties/name/type/*", action: "add", type: rr(nonBreaking, breaking), optional: true },
    ],
  },
  {
    kind: "schema",
    id: "OAS-OPT-018",
    area: "request-body",
    title: "multi-type property (object | string | array): a nested property became required",
    before: "nested: type [object, string, array], address { street }",
    after: "address { street } required [street]",
    rationale: "writers sending an address without street are rejected; readers always get street",
    annotation: "names the nested property that became required",
    sources: [
      un(
        "computeUnionTransition > %s > transitions > type array to type array > invalid overlap with object and arrays",
        "request failed, response passed",
      ),
    ],
    covers: covers(
      "unions::computeUnionTransition > %s > transitions > type array to type array > invalid overlap with object and arrays",
    ),
    schema: [typeArrayNested(), typeArrayNested({ street: true })],
    expect: [
      {
        at: "properties/nested/properties/address/required/*",
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["street"],
      },
    ],
  },
  {
    kind: "schema",
    id: "OAS-OPT-019",
    area: "request-body",
    title: "multi-type property (object | string | array): item type array widened",
    before: "nested: type [object, string, array], items type [boolean, number]",
    after: "items type [boolean, number, string]",
    rationale:
      "writers may send strings in the array (non-breaking); readers receive them (breaking; Optic inverts it)",
    annotation: "names the added item type",
    sources: [
      un(
        "computeUnionTransition > %s > transitions > type array to type array > invalid overlap with object and arrays",
        "request failed, response passed",
      ),
    ],
    covers: covers(
      "unions::computeUnionTransition > %s > transitions > type array to type array > invalid overlap with object and arrays",
      "unions::computeUnionTransition > %s > transitions > type array to type array > type primitives",
    ),
    schema: [typeArrayNested(), typeArrayNested({ itemTypes: ["boolean", "number", "string"] })],
    expect: [
      {
        at: "properties/nested/items/type/*",
        action: "add",
        type: rr(nonBreaking, breaking),
        mentions: ["string"],
      },
    ],
  },
  {
    kind: "schema",
    id: "OAS-OPT-020",
    area: "request-body",
    title: "oneOf property (string | object | array): a property of the object branch became required",
    before: "nested: oneOf [string, object { id, address { street } }, array]",
    after: "address { street } required [street]",
    rationale: "writers sending an address without street are rejected; readers always get street",
    annotation: "names the nested property that became required",
    sources: [
      un(
        "computeUnionTransition > %s > transitions > oneOf to oneOf > invalid overlap with objects and arrays",
        "request failed, response passed",
      ),
    ],
    covers: covers(
      "unions::computeUnionTransition > %s > transitions > oneOf to oneOf > invalid overlap with objects and arrays",
    ),
    schema: [oneOfNested(), oneOfNested({ street: true })],
    expect: [
      {
        at: "properties/nested/oneOf/1/properties/address/required/*",
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["street"],
      },
    ],
  },
  {
    kind: "schema",
    id: "OAS-OPT-021",
    area: "request-body",
    title: "oneOf property (string | object | array): a oneOf branch added to the items",
    before: "nested: oneOf [string, object, array of oneOf [boolean, number]]",
    after: "array items oneOf [boolean, number, string]",
    rationale:
      "writers may send strings in the array (non-breaking); readers receive them (breaking; Optic inverts it)",
    annotation: "names the added branch",
    sources: [
      un(
        "computeUnionTransition > %s > transitions > oneOf to oneOf > invalid overlap with objects and arrays",
        "request failed, response passed",
      ),
    ],
    covers: covers(
      "unions::computeUnionTransition > %s > transitions > oneOf to oneOf > invalid overlap with objects and arrays",
      "unions::computeUnionTransition > %s > transitions > oneOf to oneOf > type primitives",
    ),
    schema: [oneOfNested(), oneOfNested({ itemTypes: ["boolean", "number", "string"] })],
    expect: [
      {
        at: ["properties/nested/oneOf/2/items/oneOf/2", "properties/nested/oneOf/2/items/oneOf/2/**"],
        action: "add",
        type: rr(nonBreaking, breaking),
      },
    ],
  },
  {
    kind: "schema",
    id: "OAS-OPT-022",
    area: "request-body",
    title: "oneOf of single types rewritten as the equivalent type array",
    before: "name: oneOf [{ type: string }, { type: number }]",
    after: "name: type [string, number]",
    rationale: "both forms accept exactly the same values (JS-TYP-023 for anyOf)",
    annotation: "no diff (or annotations)",
    sources: [
      un("computeUnionTransition > %s > transitions > type array to oneOf > type primitives", "passed"),
      optic(`${H}/type-change.test.ts`, "computeEffectiveTypeChange > identical sets"),
    ],
    covers: covers("unions::computeUnionTransition > %s > transitions > type array to oneOf > type primitives"),
    schema: [
      obj({ name: { oneOf: [{ type: "string" }, { type: "number" }] } }),
      obj({ name: { type: ["string", "number"] } }),
    ],
    expect: [{ at: "**", type: annotation, optional: true }],
    // ISSUE-98 (fixed) (P5)
  },
  {
    kind: "schema",
    id: "OAS-OPT-023",
    area: "request-body",
    title: "oneOf of single types rewritten as a narrower type array",
    before: "name: oneOf [{ type: string }, { type: number }]",
    after: "name: type [string]",
    rationale: "number removed: breaking for writers, a narrower response for readers",
    annotation: "names the removed type",
    sources: [
      un(
        "computeUnionTransition > %s > transitions > type array to oneOf > type primitives",
        "request passed, response failed",
      ),
    ],
    covers: covers("unions::computeUnionTransition > %s > transitions > type array to oneOf > type primitives"),
    schema: [obj({ name: { oneOf: [{ type: "string" }, { type: "number" }] } }), obj({ name: { type: ["string"] } })],
    expect: [{ at: ["properties/name/**", "properties/name"], type: rr(breaking, nonBreaking), mentions: [NAME] }],
  },
  {
    kind: "schema",
    id: "OAS-OPT-024",
    area: "request-body",
    title: "nested oneOf (string | object | array) rewritten as the equivalent type array",
    before: "nested: oneOf [string, object { id, address }, array of oneOf [boolean, number]]",
    after: "nested: type [object, string, array] with the same properties and items type [boolean, number]",
    rationale: "both forms accept exactly the same values",
    annotation: "no diff (or annotations)",
    sources: [
      un(
        "computeUnionTransition > %s > transitions > type array to oneOf > valid overlap with objects and arrays",
        "passed",
      ),
    ],
    covers: covers(
      "unions::computeUnionTransition > %s > transitions > type array to oneOf > valid overlap with objects and arrays",
    ),
    schema: [oneOfNested(), typeArrayNested()],
    expect: [{ at: "**", type: annotation, optional: true }],
    // ISSUE-98 (fixed) (P5)
  },
  {
    kind: "schema",
    id: "OAS-OPT-025",
    area: "request-body",
    title: "oneOf (string | object | array) rewritten as a type array while a nested property became required",
    before: "oneOf [string, object { id, address { street } }, array of oneOf [boolean, number]] (schema root)",
    after: "type [object, string, array], address required [street]",
    rationale: "the rewrite is equivalent; the new required street breaks writers and is additive for readers",
    annotation: "names the nested property that became required",
    sources: [
      un("computeUnionTransition > %s > oneOf to type array at root schema", "request failed, response passed"),
      un(
        "computeUnionTransition > %s > transitions > type array to oneOf > invalid overlap with objects and arrays",
        "request failed, response passed",
      ),
    ],
    covers: covers(
      "unions::computeUnionTransition > %s > oneOf to type array at root schema",
      "unions::computeUnionTransition > %s > transitions > type array to oneOf > invalid overlap with objects and arrays",
    ),
    schema: [oneOfNestedValue(), typeArrayNestedValue({ street: true })],
    expect: [
      {
        at: ["**/address/required/*", "**/address/required"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["street"],
      },
      { at: "**", type: annotation, optional: true },
    ],
    // ISSUE-98 (fixed) (P5)
  },
  {
    kind: "schema",
    id: "OAS-OPT-026",
    area: "request-body",
    title: "two levels of oneOf rewritten as type arrays while a nested property became required",
    before: "oneOf [object { nested: oneOf [string, object, array] }, string]",
    after: "type [object, string] { nested: type [object, string, array], address required [street] }",
    rationale: "the rewrites are equivalent; the new required street breaks writers and is additive for readers",
    annotation: "names the nested property that became required",
    sources: [un("computeUnionTransition > %s > nested oneOf and type arrays", "request failed, response passed")],
    covers: covers("unions::computeUnionTransition > %s > nested oneOf and type arrays"),
    schema: [
      { oneOf: [{ type: "object", properties: { nested: oneOfNested() } }, { type: "string" }] },
      { type: ["object", "string"], properties: { nested: typeArrayNested({ street: true }) } },
    ],
    expect: [
      {
        at: ["**/address/required/*", "**/address/required"],
        action: "add",
        type: rr(breaking, nonBreaking),
        mentions: ["street"],
      },
      { at: "**", type: annotation, optional: true },
    ],
    // ISSUE-98 (fixed) (P5)
  },
]

runCases("openapi", "operations", [...docCases, ...schemaCases], import.meta.filename)
