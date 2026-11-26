import { annotation, breaking, nonBreaking } from "../../../src"
import { type CaseSource, type CompatCase, type GraphqlCase, risky, runCases } from "../../helpers/compat"

const gql = (c: Omit<GraphqlCase, "kind">): CompatCase => ({ kind: "graphql", ...c })
const gi = (ref: string, verdict?: string): CaseSource => ({
  tool: "graphql-inspector",
  ref: `packages/core/__tests__/diff/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const giChange = (ref: string, verdict?: string): CaseSource => ({
  tool: "graphql-inspector",
  ref: `packages/core/src/diff/changes/${ref}`,
  ...(verdict ? { verdict } : {}),
})
// a compat-suites case and the fork's expected verdict for it
const suite = (dir: string, id: string, verdict?: string): CaseSource[] => [
  { tool: "compat-suites", ref: `graphql/${dir}/${id}` },
  { tool: "fork", ref: `test/compatibility-suites/graphql/${dir}.test.ts ${id}`, ...(verdict ? { verdict } : {}) },
]
const asd = (ref: string): CaseSource => ({ tool: "asd", ref })

// POLICY-20 decided (a): the locations of a type-system directive are classified like those of an executable directive
// (location added non-breaking, removed breaking); the same rule node is ISSUE-120

// an executable directive (clients write it in operations)
const exec = (def: string) => `directive @limit${def} type Query { items: [String] }`
const DEF = "components/directives/limit/**"
const DEF_ROOT = "components/directives/limit"

// a type-system directive applied to every kind of schema element
const usage = (on: Record<string, string>) => {
  const u = (k: string) => (on[k] ? ` ${on[k]}` : "")
  return [
    "directive @tag(name: String) repeatable on SCHEMA | SCALAR | OBJECT | FIELD_DEFINITION | ARGUMENT_DEFINITION | INTERFACE | UNION | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION",
    `schema${u("schema")} { query: Query }`,
    `type Query { item(filter: Filter${u("arg")}): Item node: Node result: Result }`,
    `scalar Date${u("scalar")}`,
    `type Item implements Node${u("object")} { id: ID! born: Date color: Color title: String${u("field")} }`,
    `interface Node${u("interface")} { id: ID! }`,
    `union Result${u("union")} = Item`,
    `enum Color${u("enum")} { RED${u("value")} BLUE }`,
    `input Filter${u("input")} { term: String${u("inputField")} }`,
  ].join("\n")
}
const TAG = '@tag(name: "x")'

const usageCase = (
  id: string,
  where: string,
  key: string,
  entity: string,
  covers: string,
  test: string,
): CompatCase[] => [
  gql({
    id: `${id}A`,
    title: `custom directive applied to ${where}`,
    before: `${entity} without @tag`,
    after: `${entity} ${TAG}`,
    rationale:
      "a type-system directive applied to a schema element is server metadata that operations cannot observe (ASD convention: usages are annotations, ISSUE-40); graphql-inspector rates custom usages DANGEROUS, the fork unclassified",
    annotation: `names the element (${entity}) and the directive (@tag)`,
    sources: [
      gi(`directive-usage.test.ts ${test} added directive`, "DANGEROUS"),
      // the compat suites apply a schema directive to every location except the schema itself
      ...(where === "schema"
        ? []
        : suite("directives", `apply-schema-directive-to-${where.replace(/ /g, "-")}`, "unclassified")),
    ],
    covers: [`gi:DIRECTIVE_USAGE_${covers}_ADDED`],
    sdl: [usage({}), usage({ [key]: TAG })],
    expect: [{ at: "**", type: annotation, mentions: [entity, "tag"] }],
  }),
  gql({
    id: `${id}B`,
    title: `custom directive removed from ${where}`,
    before: `${entity} ${TAG}`,
    after: `${entity} without @tag`,
    rationale:
      "a type-system directive applied to a schema element is server metadata that operations cannot observe (ASD convention: usages are annotations, ISSUE-40); graphql-inspector rates custom usages DANGEROUS, the fork unclassified",
    annotation: `names the element (${entity}) and the directive (@tag)`,
    sources: [gi(`directive-usage.test.ts ${test} removed directive`, "DANGEROUS")],
    covers: [`gi:DIRECTIVE_USAGE_${covers}_REMOVED`],
    sdl: [usage({ [key]: TAG }), usage({})],
    expect: [{ at: "**", type: annotation, mentions: [entity, "tag"] }],
  }),
]

const cases: CompatCase[] = [
  gql({
    id: "GQL-DIR-001",
    title: "executable directive definition added",
    before: "(no @limit)",
    after: "directive @limit(offset: Int = 0) on FIELD",
    rationale: "a new directive clients may use; existing operations are unaffected",
    annotation: "names the directive (@limit)",
    sources: [
      gi("directive.test.ts added"),
      giChange("directive.ts DIRECTIVE_ADDED"),
      ...suite("directives", "add-executable-directive-with-no-usage"),
      asd("test/graphapi/graphapi10.test.ts G10.19"),
    ],
    covers: ["gi:DIRECTIVE_ADDED"],
    sdl: ["type Query { items: [String] }", exec("(offset: Int = 0) on FIELD")],
    expect: [{ at: DEF_ROOT, action: "add", type: nonBreaking, mentions: ["limit"] }],
  }),
  gql({
    id: "GQL-DIR-002",
    title: "executable directive definition removed",
    before: "directive @limit(offset: Int = 0) on FIELD",
    after: "(no @limit)",
    rationale: "operations using `@limit` fail validation (unknown directive)",
    annotation: "names the directive (@limit)",
    sources: [
      gi("directive.test.ts removed"),
      giChange("directive.ts DIRECTIVE_REMOVED"),
      ...suite("directives", "delete-executable-directive-with-no-usage"),
    ],
    covers: ["gi:DIRECTIVE_REMOVED"],
    sdl: [exec("(offset: Int = 0) on FIELD"), "type Query { items: [String] }"],
    expect: [{ at: DEF_ROOT, action: "remove", type: breaking, mentions: ["limit"] }],
  }),
  gql({
    id: "GQL-DIR-003",
    title: "type-system directive definition added (not applied)",
    before: "(no @key)",
    after: "directive @key(fields: String) on OBJECT",
    rationale:
      "directive definitions are public surface even when not applied (ASD §12.2, graphql-inspector); the fork reports no diff for unused schema directives",
    annotation: "names the directive (@key)",
    sources: [
      gi("directive.test.ts added"),
      ...suite("directives", "add-schema-directive-with-no-usage", "no diff"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a directive was added",
      },
    ],
    covers: ["gi:DIRECTIVE_ADDED", "gjs:DIRECTIVE_ADDED"],
    sdl: ["type Query { a: String }", "directive @key(fields: String) on OBJECT type Query { a: String }"],
    expect: [{ at: "components/directives/key", action: "add", type: nonBreaking, mentions: ["key"] }],
  }),
  gql({
    id: "GQL-DIR-004",
    title: "type-system directive definition removed (not applied)",
    before: "directive @key(fields: String) on OBJECT",
    after: "(no @key)",
    rationale:
      "directive definitions are public surface even when not applied (ASD §12.2, graphql-inspector); the fork reports no diff for unused schema directives",
    annotation: "names the directive (@key)",
    sources: [
      gi("directive.test.ts removed"),
      ...suite("directives", "delete-schema-directive-with-no-usage", "no diff"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a directive was explicitly removed",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (DirectiveThatIsRemoved)",
      },
    ],
    covers: ["gi:DIRECTIVE_REMOVED", "gjs:DIRECTIVE_REMOVED"],
    sdl: ["directive @key(fields: String) on OBJECT type Query { a: String }", "type Query { a: String }"],
    expect: [{ at: "components/directives/key", action: "remove", type: breaking, mentions: ["key"] }],
  }),
  gql({
    id: "GQL-DIR-005",
    // ISSUE-120 (fixed); POLICY-20 decided (a)
    title: "executable location added to a directive",
    before: "directive @limit on FIELD",
    after: "directive @limit on FIELD | FRAGMENT_SPREAD",
    rationale: "clients may use the directive in more places; existing operations are unaffected",
    annotation: "names the directive (@limit) and the added location (FRAGMENT_SPREAD)",
    sources: [
      gi("directive.test.ts location added"),
      giChange("directive.ts DIRECTIVE_LOCATION_ADDED"),
      ...suite("directives", "add-executable-location-to-directive"),
      asd("test/graphapi/classification.test.ts adding a directive location is an annotation"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a directive adds locations",
      },
    ],
    covers: ["gi:DIRECTIVE_LOCATION_ADDED", "gjs:DIRECTIVE_LOCATION_ADDED"],
    sdl: [exec(" on FIELD"), exec(" on FIELD | FRAGMENT_SPREAD")],
    expect: [{ at: DEF, action: "add", type: nonBreaking, mentions: ["limit", "FRAGMENT_SPREAD"] }],
  }),
  gql({
    id: "GQL-DIR-006",
    // ISSUE-120 (fixed); POLICY-20 decided (a)
    title: "executable location removed from a directive",
    before: "directive @limit on FIELD | FRAGMENT_SPREAD",
    after: "directive @limit on FIELD",
    rationale: "operations using `@limit` on a fragment spread fail validation (directive not allowed here)",
    annotation: "names the directive (@limit) and the removed location (FRAGMENT_SPREAD)",
    sources: [
      gi("directive.test.ts location removed"),
      giChange("directive.ts DIRECTIVE_LOCATION_REMOVED"),
      ...suite("directives", "delete-executable-location-to-directive"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect locations removed from a directive",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (DirectiveName)",
      },
    ],
    covers: ["gi:DIRECTIVE_LOCATION_REMOVED", "gjs:DIRECTIVE_LOCATION_REMOVED"],
    sdl: [exec(" on FIELD | FRAGMENT_SPREAD"), exec(" on FIELD")],
    expect: [{ at: DEF, action: "remove", type: breaking, mentions: ["limit", "FRAGMENT_SPREAD"] }],
  }),
  gql({
    id: "GQL-DIR-007",
    title: "type-system location added to a directive",
    before: "directive @key on OBJECT",
    after: "directive @key on OBJECT | INTERFACE",
    rationale: "only server tooling uses type-system locations; POLICY-20 (a): classified like executable locations",
    annotation: "names the directive (@key) and the added location (INTERFACE)",
    sources: [gi("directive.test.ts location added"), ...suite("directives", "add-new-schema-location-to-directive")],
    covers: ["gi:DIRECTIVE_LOCATION_ADDED"],
    sdl: [
      "directive @key on OBJECT type Query { a: String }",
      "directive @key on OBJECT | INTERFACE type Query { a: String }",
    ],
    expect: [{ at: "components/directives/key/**", action: "add", type: nonBreaking, mentions: ["key", "INTERFACE"] }],
    // ISSUE-120 (fixed); POLICY-20 decided (a)
  }),
  gql({
    id: "GQL-DIR-008",
    title: "type-system location removed from a directive",
    before: "directive @key on OBJECT | INTERFACE",
    after: "directive @key on OBJECT",
    rationale: "only server tooling uses type-system locations; POLICY-20 (a): classified like executable locations",
    annotation: "names the directive (@key) and the removed location (INTERFACE)",
    sources: [
      gi("directive.test.ts location removed"),
      ...suite("directives", "delete-schema-location-in-directive", "non-breaking"),
    ],
    covers: ["gi:DIRECTIVE_LOCATION_REMOVED"],
    sdl: [
      "directive @key on OBJECT | INTERFACE type Query { a: String }",
      "directive @key on OBJECT type Query { a: String }",
    ],
    expect: [{ at: "components/directives/key/**", action: "remove", type: breaking, mentions: ["key", "INTERFACE"] }],
    // ISSUE-120 (fixed); POLICY-20 decided (a)
  }),
  gql({
    id: "GQL-DIR-009",
    title: "directive locations reordered (not a change)",
    before: "directive @limit on FIELD | FRAGMENT_SPREAD",
    after: "directive @limit on FRAGMENT_SPREAD | FIELD",
    rationale: "locations are a set; order is not significant",
    annotation: "no diff",
    sources: [gi("union.test.ts same members but different order")],
    sdl: [exec(" on FIELD | FRAGMENT_SPREAD"), exec(" on FRAGMENT_SPREAD | FIELD")],
    expect: [],
  }),
  gql({
    id: "GQL-DIR-010",
    // ISSUE-127 (fixed) (P8a)
    title: "optional argument added to an executable directive",
    before: "directive @limit(offset: Int) on FIELD",
    after: "directive @limit(offset: Int, size: Int) on FIELD",
    rationale: "operations using `@limit` without `size` stay valid",
    annotation: "names the directive and the added argument (@limit size)",
    sources: [
      gi("directive.test.ts arguments added"),
      giChange("directive.ts DIRECTIVE_ARGUMENT_ADDED"),
      ...suite("directives", "add-argument-for-executable-directive-with-no-usage", "unclassified"),
      asd("test/graphapi/classification.test.ts adding an optional directive argument is non-breaking"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a directive arg gets added",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if an optional directive argument was added (newOptionalArg1)",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_ADDED", "gjs:OPTIONAL_DIRECTIVE_ARG_ADDED"],
    sdl: [exec("(offset: Int) on FIELD"), exec("(offset: Int, size: Int) on FIELD")],
    expect: [{ at: DEF, action: "add", type: nonBreaking, mentions: ["limit", "size"] }],
  }),
  gql({
    id: "GQL-DIR-011",
    // ISSUE-127 (fixed) (P8a)
    title: "required argument added to an executable directive",
    before: "directive @limit(offset: Int) on FIELD",
    after: "directive @limit(offset: Int, size: Int!) on FIELD",
    rationale: "operations using `@limit` without `size` fail validation",
    annotation: "names the directive and the added argument (@limit size)",
    sources: [
      gi("directive.test.ts arguments added"),
      giChange("directive.ts DIRECTIVE_ARGUMENT_ADDED"),
      asd("test/graphapi/graphapi10.test.ts G10.19"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if an optional directive argument was added (newRequiredArg)",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_ADDED", "gjs:REQUIRED_DIRECTIVE_ARG_ADDED"],
    sdl: [exec("(offset: Int) on FIELD"), exec("(offset: Int, size: Int!) on FIELD")],
    expect: [{ at: DEF, action: "add", type: breaking, mentions: ["limit", "size"] }],
  }),
  gql({
    id: "GQL-DIR-012",
    // ISSUE-127 (fixed) (P8a)
    title: "argument removed from an executable directive",
    before: "directive @limit(offset: Int, size: Int) on FIELD",
    after: "directive @limit(offset: Int) on FIELD",
    rationale: "operations passing `size` to `@limit` fail validation (unknown argument)",
    annotation: "names the directive and the removed argument (@limit size)",
    sources: [
      gi("directive.test.ts arguments removed"),
      giChange("directive.ts DIRECTIVE_ARGUMENT_REMOVED"),
      ...suite("directives", "delete-argument-in-executable-directive-with-no-usage"),
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_REMOVED"],
    sdl: [exec("(offset: Int, size: Int) on FIELD"), exec("(offset: Int) on FIELD")],
    expect: [{ at: DEF, action: "remove", type: breaking, mentions: ["limit", "size"] }],
  }),
  gql({
    id: "GQL-DIR-013",
    title: "directive argument type changed (Int to String)",
    before: "directive @limit(size: Int) on FIELD",
    after: "directive @limit(size: String) on FIELD",
    rationale: "integer literals passed to `size` fail validation",
    annotation: "names the directive and the argument (@limit size) and the type change",
    sources: [gi("directive.test.ts arguments changed"), giChange("directive.ts DIRECTIVE_ARGUMENT_TYPE_CHANGED")],
    covers: ["gi:DIRECTIVE_ARGUMENT_TYPE_CHANGED"],
    sdl: [exec("(size: Int) on FIELD"), exec("(size: String) on FIELD")],
    expect: [{ at: DEF, type: breaking, mentions: ["limit", "size"] }],
  }),
  gql({
    id: "GQL-DIR-014",
    title: "directive argument made non-null",
    before: "directive @limit(size: Int) on FIELD",
    after: "directive @limit(size: Int!) on FIELD",
    rationale: "operations using `@limit` without `size` fail validation",
    annotation: "names the directive and the argument (@limit size) and the nullability change",
    sources: [
      giChange("directive.ts DIRECTIVE_ARGUMENT_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a directive argument does a breaking change",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND"],
    sdl: [exec("(size: Int) on FIELD"), exec("(size: Int!) on FIELD")],
    expect: [{ at: DEF, type: breaking, mentions: ["limit", "size"] }],
  }),
  gql({
    id: "GQL-DIR-015",
    title: "directive argument made nullable",
    before: "directive @limit(size: Int!) on FIELD",
    after: "directive @limit(size: Int) on FIELD",
    rationale: "every usage valid before is still valid",
    annotation: "names the directive and the argument (@limit size) and the nullability change",
    sources: [
      giChange("directive.ts DIRECTIVE_ARGUMENT_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a changes argument safely",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND_SAFE"],
    sdl: [exec("(size: Int!) on FIELD"), exec("(size: Int) on FIELD")],
    expect: [{ at: DEF, type: nonBreaking, mentions: ["limit", "size"] }],
  }),
  gql({
    id: "GQL-DIR-016",
    title: "directive argument default changed",
    before: "directive @limit(size: Int = 20) on FIELD",
    after: "directive @limit(size: Int = 30) on FIELD",
    rationale: "operations using `@limit` without `size` silently get another value; POLICY-05: risky",
    annotation: "names the directive and the argument (@limit size) and the default value",
    sources: [
      gi("directive.test.ts default value"),
      giChange("directive.ts DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED"),
      ...suite("directives", "update-argument-default-value-of-executable-directive-with-no-usage", "unclassified"),
      asd("test/graphapi/directives.test.ts should compare schemas with changes in arguments"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a default value is changed in an argument",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should not detect if a directive argument default value does not change",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED", "gjs:ARG_DEFAULT_VALUE_CHANGE"],
    sdl: [exec("(size: Int = 20) on FIELD"), exec("(size: Int = 30) on FIELD")],
    expect: [{ at: DEF, type: risky, mentions: ["limit", "size"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-DIR-017",
    title: "directive argument default added",
    before: "directive @limit(size: Int) on FIELD",
    after: "directive @limit(size: Int = 20) on FIELD",
    rationale:
      "operations using `@limit` without `size` now get 20; no operation becomes invalid; POLICY-05: risky, as for field arguments (GQL-ARG-021)",
    annotation: "names the directive and the argument (@limit size) and the default value",
    sources: [
      giChange("directive.ts DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED"),
      ...suite("directives", "add-argument-default-value-of-executable-directive-with-no-usage", "unclassified"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a default value is added to an argument",
        verdict: "SAFE (ARG_DEFAULT_VALUE_ADDED)",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED", "gjs:ARG_DEFAULT_VALUE_ADDED"],
    sdl: [exec("(size: Int) on FIELD"), exec("(size: Int = 20) on FIELD")],
    expect: [{ at: DEF, type: risky, mentions: ["limit", "size"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-DIR-018",
    title: "directive argument default removed",
    before: "directive @limit(size: Int = 20) on FIELD",
    after: "directive @limit(size: Int) on FIELD",
    rationale: "operations using `@limit` without `size` now send no value instead of 20; POLICY-05: risky",
    annotation: "names the directive and the argument (@limit size) and the default value",
    sources: [
      giChange("directive.ts DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED"),
      ...suite("directives", "delete-argument-default-value-of-executable-directive-with-no-usage", "unclassified"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a default value is removed from an argument",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED", "gjs:ARG_DEFAULT_VALUE_CHANGE"],
    sdl: [exec("(size: Int = 20) on FIELD"), exec("(size: Int) on FIELD")],
    expect: [{ at: DEF, type: risky, mentions: ["limit", "size"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-DIR-019",
    title: "directive description changed",
    before: '"Limits a list" directive @limit on FIELD',
    after: '"Limits the items of a list" directive @limit on FIELD',
    rationale: "descriptions are documentation",
    annotation: "names the directive (@limit) and the description",
    sources: [gi("directive.test.ts description"), giChange("directive.ts DIRECTIVE_DESCRIPTION_CHANGED")],
    covers: ["gi:DIRECTIVE_DESCRIPTION_CHANGED"],
    sdl: [
      '"Limits a list" directive @limit on FIELD type Query { items: [String] }',
      '"Limits the items of a list" directive @limit on FIELD type Query { items: [String] }',
    ],
    expect: [{ at: DEF, type: annotation, mentions: ["limit", "description"] }],
  }),
  gql({
    id: "GQL-DIR-020",
    title: "directive argument description changed",
    before: 'directive @limit("max items" size: Int) on FIELD',
    after: 'directive @limit("maximum number of items" size: Int) on FIELD',
    rationale: "descriptions are documentation",
    annotation: "names the directive and the argument (@limit size) and the description",
    sources: [
      gi("directive.test.ts arguments changed"),
      giChange("directive.ts DIRECTIVE_ARGUMENT_DESCRIPTION_CHANGED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a directive arg changes description",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_DESCRIPTION_CHANGED", "gjs:DESCRIPTION_CHANGED"],
    sdl: [exec('("max items" size: Int) on FIELD'), exec('("maximum number of items" size: Int) on FIELD')],
    expect: [{ at: DEF, type: annotation, mentions: ["limit", "size", "description"] }],
  }),
  gql({
    id: "GQL-DIR-021",
    // ISSUE-121 (fixed)
    title: "directive made repeatable",
    before: "directive @limit on FIELD",
    after: "directive @limit repeatable on FIELD",
    rationale: "operations may now repeat `@limit`; existing operations are unaffected",
    annotation: "names the directive (@limit) and the repeatable flag",
    sources: [
      gi("directive.test.ts repeatable added"),
      giChange("directive.ts DIRECTIVE_REPEATABLE_ADDED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a directive becomes repeatable",
      },
    ],
    covers: ["gi:DIRECTIVE_REPEATABLE_ADDED", "gjs:DIRECTIVE_REPEATABLE_ADDED"],
    sdl: [exec(" on FIELD"), exec(" repeatable on FIELD")],
    expect: [{ at: [DEF_ROOT, DEF], type: nonBreaking, mentions: ["limit", "repeatable"] }],
  }),
  gql({
    id: "GQL-DIR-022",
    // ISSUE-121 (fixed)
    title: "directive no longer repeatable",
    before: "directive @limit repeatable on FIELD",
    after: "directive @limit on FIELD",
    rationale: "operations repeating `@limit` on one location fail validation (graphql-inspector rates it DANGEROUS)",
    annotation: "names the directive (@limit) and the repeatable flag",
    sources: [
      gi("directive.test.ts repeatable removed", "DANGEROUS"),
      gi("directive.test.ts complex remove", "DANGEROUS"),
      giChange("directive.ts DIRECTIVE_REPEATABLE_REMOVED", "DANGEROUS"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect removal of repeatable flag",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (DirectiveThatWasRepeatable)",
      },
    ],
    covers: ["gi:DIRECTIVE_REPEATABLE_REMOVED", "gjs:DIRECTIVE_REPEATABLE_REMOVED"],
    sdl: [exec(" repeatable on FIELD"), exec(" on FIELD")],
    expect: [{ at: [DEF_ROOT, DEF], type: breaking, mentions: ["limit", "repeatable"] }],
  }),
  gql({
    id: "GQL-DIR-023",
    // ISSUE-127 (fixed) (P8a)
    title: "argument added to a type-system directive",
    before: "directive @key(fields: String) on OBJECT",
    after: "directive @key(fields: String, resolvable: Boolean) on OBJECT",
    rationale:
      "directive definitions, including their arguments, are public surface (ASD §12.2, graphql-inspector); the fork reports no diff or non-breaking",
    annotation: "names the directive and the added argument (@key resolvable)",
    sources: [
      gi("directive.test.ts arguments added"),
      ...suite("directives", "add-argument-for-schema-directive-with-no-usage", "no diff"),
      ...suite("directives", "add-argument-for-schema-directive"),
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_ADDED"],
    sdl: [
      "directive @key(fields: String) on OBJECT type Query { a: String }",
      "directive @key(fields: String, resolvable: Boolean) on OBJECT type Query { a: String }",
    ],
    expect: [{ at: "components/directives/key/**", action: "add", type: nonBreaking, mentions: ["key", "resolvable"] }],
  }),
  gql({
    id: "GQL-DIR-024",
    // ISSUE-127 (fixed) (P8a)
    title: "argument removed from a type-system directive",
    before: "directive @key(fields: String, resolvable: Boolean) on OBJECT",
    after: "directive @key(fields: String) on OBJECT",
    rationale:
      "directive definitions, including their arguments, are public surface (ASD §12.2, graphql-inspector); the fork reports no diff or non-breaking",
    annotation: "names the directive and the removed argument (@key resolvable)",
    sources: [
      gi("directive.test.ts arguments removed"),
      ...suite("directives", "delete-argument-for-schema-directive-with-no-usage", "no diff"),
      ...suite("directives", "delete-argument-for-schema-directive", "non-breaking"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a directive argument was removed",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (DirectiveThatRemovesArg)",
      },
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_REMOVED", "gjs:DIRECTIVE_ARG_REMOVED"],
    sdl: [
      "directive @key(fields: String, resolvable: Boolean) on OBJECT type Query { a: String }",
      "directive @key(fields: String) on OBJECT type Query { a: String }",
    ],
    expect: [{ at: "components/directives/key/**", action: "remove", type: breaking, mentions: ["key", "resolvable"] }],
  }),
  gql({
    id: "GQL-DIR-025",
    title: "argument default changed on a type-system directive",
    before: "directive @key(resolvable: Boolean = true) on OBJECT",
    after: "directive @key(resolvable: Boolean = false) on OBJECT",
    rationale:
      "only server tooling reads type-system directives; the default rule of field arguments applies; POLICY-05: risky",
    annotation: "names the directive and the argument (@key resolvable) and the default value",
    sources: [
      ...suite("directives", "update-argument-default-value-of-schema-directive-with-no-usage", "no diff"),
      ...suite("directives", "update-argument-default-value-for-schema-directive", "non-breaking"),
      ...suite("directives", "add-argument-default-value-for-schema-directive", "non-breaking"),
      ...suite("directives", "delete-argument-default-value-for-schema-directive", "non-breaking"),
      ...suite("directives", "add-argument-default-value-of-schema-directive-with-no-usage", "no diff"),
      ...suite("directives", "delete-argument-default-value-of-schema-directive-with-no-usage", "no diff"),
      giChange("directive.ts DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED"),
    ],
    covers: ["gi:DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED"],
    sdl: [
      "directive @key(resolvable: Boolean = true) on OBJECT type Query { a: String }",
      "directive @key(resolvable: Boolean = false) on OBJECT type Query { a: String }",
    ],
    expect: [{ at: "components/directives/key/**", type: risky, mentions: ["key", "resolvable"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...usageCase("GQL-DIR-030", "schema", "schema", "schema", "SCHEMA", "schema directives"),
  ...usageCase("GQL-DIR-031", "scalar", "scalar", "Date", "SCALAR", "scalar-level directives"),
  ...usageCase("GQL-DIR-032", "object", "object", "Item", "OBJECT", "object-level directives"),
  ...usageCase("GQL-DIR-033", "field definition", "field", "title", "FIELD_DEFINITION", "field-level directives"),
  ...usageCase(
    "GQL-DIR-034",
    "argument definition",
    "arg",
    "filter",
    "ARGUMENT_DEFINITION",
    "argument-definition directives",
  ),
  ...usageCase("GQL-DIR-035", "interface", "interface", "Node", "INTERFACE", "interface-level directives"),
  ...usageCase("GQL-DIR-036", "union", "union", "Result", "UNION_MEMBER", "union-level directives"),
  ...usageCase("GQL-DIR-037", "enum", "enum", "Color", "ENUM", "enum-level directives"),
  ...usageCase("GQL-DIR-038", "enum value", "value", "RED", "ENUM_VALUE", "enum-value-level directives"),
  ...usageCase("GQL-DIR-039", "input object", "input", "Filter", "INPUT_OBJECT", "input-object-level directives"),
  ...usageCase(
    "GQL-DIR-040",
    "input field definition",
    "inputField",
    "term",
    "INPUT_FIELD_DEFINITION",
    "input-field-level directives",
  ),
  gql({
    id: "GQL-DIR-041",
    // ISSUE-128 (fixed) (P8-rest); ISSUE-127 (fixed) (P8a)
    title: "argument value of an applied directive changed",
    before: 'type Item @tag(name: "x")',
    after: 'type Item @tag(name: "y")',
    rationale:
      "arguments of an applied type-system directive are server metadata that operations cannot observe (ASD convention, ISSUE-40); graphql-inspector rates it DANGEROUS",
    annotation: "names the element (Item), the directive (@tag) and the argument (name)",
    sources: [gi("directive-usage.test.ts repeatable directives changing arguments of the second usage", "DANGEROUS")],
    covers: ["gi:DIRECTIVE_USAGE_ARGUMENT_ADDED", "gi:DIRECTIVE_USAGE_ARGUMENT_REMOVED"],
    sdl: [usage({ object: '@tag(name: "x")' }), usage({ object: '@tag(name: "y")' })],
    expect: [{ at: "**", type: annotation, mentions: ["Item", "tag", "name"] }],
  }),
  gql({
    id: "GQL-DIR-042",
    // ISSUE-128 (fixed) (P8-rest); ISSUE-127 (fixed) (P8a)
    title: "argument added to an applied directive",
    before: "type Item @tag",
    after: 'type Item @tag(name: "x")',
    rationale:
      "arguments of an applied type-system directive are server metadata that operations cannot observe (ASD convention, ISSUE-40); graphql-inspector rates it DANGEROUS",
    annotation: "names the element (Item), the directive (@tag) and the argument (name)",
    sources: [gi("directive-usage.test.ts repeatable directives adding with different args", "NON_BREAKING")],
    covers: ["gi:DIRECTIVE_USAGE_ARGUMENT_ADDED"],
    sdl: [usage({ object: "@tag" }), usage({ object: '@tag(name: "x")' })],
    expect: [{ at: "**", type: annotation, mentions: ["Item", "tag", "name"] }],
  }),
  gql({
    id: "GQL-DIR-043",
    // ISSUE-126 (fixed): gqlapi 0.6 `repeats`; ISSUE-128 description fixed in P7
    title: "repeatable directive applied a second time",
    before: 'type Item @tag(name: "x")',
    after: 'type Item @tag(name: "x") @tag(name: "y")',
    rationale:
      "applied type-system directives are server metadata that operations cannot observe (ASD convention, ISSUE-40); graphql-inspector rates it DANGEROUS",
    annotation: "names the element (Item) and the directive (@tag)",
    sources: [gi("directive-usage.test.ts repeatable directives adding multiple times", "DANGEROUS")],
    covers: ["gi:DIRECTIVE_USAGE_OBJECT_ADDED"],
    sdl: [usage({ object: '@tag(name: "x")' }), usage({ object: '@tag(name: "x") @tag(name: "y")' })],
    expect: [{ at: "**", type: annotation, mentions: ["Item", "tag"] }],
  }),
  gql({
    id: "GQL-DIR-044",
    // ISSUE-127 (fixed) (P8a); ISSUE-128 description fixed in P7 (directive usage template)
    title: "repeated directive usage removed from the beginning",
    before: 'type Item @tag(name: "x") @tag(name: "y")',
    after: 'type Item @tag(name: "y")',
    rationale:
      "applied type-system directives are server metadata that operations cannot observe (ASD convention, ISSUE-40); graphql-inspector rates it DANGEROUS",
    annotation: "names the element (Item) and the directive (@tag)",
    sources: [gi("directive-usage.test.ts repeatable directives removing in from beginning and end", "DANGEROUS")],
    covers: ["gi:DIRECTIVE_USAGE_OBJECT_REMOVED"],
    sdl: [usage({ object: '@tag(name: "x") @tag(name: "y")' }), usage({ object: '@tag(name: "y")' })],
    expect: [{ at: "**", type: annotation, mentions: ["Item", "tag"] }],
  }),
  gql({
    id: "GQL-DIR-045",
    // ISSUE-129 (fixed) (P8-rest)
    title:
      "directive definition without usages is unchanged while a usage elsewhere is added (missing definitions tolerated)",
    before: "type Query { a: String }",
    after: "type Query { a: String } (schema extended through `extend schema @tag`)",
    rationale:
      "applied type-system directives are server metadata that operations cannot observe (ASD convention, ISSUE-40); graphql-inspector rates it DANGEROUS",
    annotation: "names the schema and the directive (@tag)",
    sources: [
      gi("schema.test.ts adding directive using extend schema", "DANGEROUS"),
      gi("schema.test.ts should work with with missing directive definitions"),
    ],
    covers: ["gi:DIRECTIVE_USAGE_SCHEMA_ADDED"],
    sdl: [
      "directive @tag(name: String) on SCHEMA type Query { a: String }",
      'directive @tag(name: String) on SCHEMA type Query { a: String } extend schema @tag(name: "x")',
    ],
    expect: [{ at: "**", type: annotation, mentions: ["schema", "tag"] }],
  }),
]

// known 2.0.0 defects of the generated cases (one ISSUE-X id per root cause)
const generatedIssues: Record<string, CompatCase["issue"]> = {
  // "GQL-DIR-030A": ISSUE-129 (fixed) (P8-rest)
  // "GQL-DIR-030B": ISSUE-129 (fixed) (P8-rest)
  // "GQL-DIR-031A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-031B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-032A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-032B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-033A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-033B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-034A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-034B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-035A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-035B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-036A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-036B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-037A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-037B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-038A": ISSUE-125 (fixed); ISSUE-128 description fixed in P7
  // "GQL-DIR-038B": ISSUE-125 (fixed); ISSUE-128 description fixed in P7
  // "GQL-DIR-039A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-039B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-040A": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
  // "GQL-DIR-040B": ISSUE-127 / ISSUE-128: directive usage descriptions fixed in P7
}
for (const c of cases) c.issue = generatedIssues[c.id] ?? c.issue
// graphql-schema-diff (a wrapper of graphql-js findBreakingChanges / findDangerousChanges) applies a directive to Query
cases
  .find((c) => c.id === "GQL-DIR-032A")
  ?.sources.push({
    tool: "graphql-schema-diff",
    ref: "src/__tests__/diff.test.ts getDiff schema diffing returns the diff between two schemas with changed directives",
  })

runCases("graphql", "directives", cases, import.meta.filename)
