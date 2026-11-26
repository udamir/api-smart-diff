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
const fork = (ref: string, verdict?: string): CaseSource => ({ tool: "fork", ref, ...(verdict ? { verdict } : {}) })
const bench = (ref: string, verdict?: string): CaseSource => ({
  tool: "bench",
  ref: `bench/fixtures/graphql.js ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string): CaseSource => ({ tool: "asd", ref })

const QUERY = /quer(y|ies)/i

// a root query field with arguments
const q = (args: string) => `type Query { search${args ? `(${args})` : ""}: [String] }`
// an object field with arguments
const o = (args: string) =>
  `type Query { profile: User } type User { id: ID! posts${args ? `(${args})` : ""}: [String] }`
const ARG = (name: string) => [QUERY, "search", name]

const cases: CompatCase[] = [
  gql({
    id: "GQL-ARG-001",
    // ISSUE-127 (fixed) (P8a)
    title: "optional argument (nullable, no default) added",
    before: "search: [String]",
    after: "search(limit: Int): [String]",
    rationale: "existing operations do not supply it and stay valid",
    annotation: "names the field and the added argument (Query.search limit)",
    sources: [
      gi("argument.test.ts added nullable without default value"),
      ...suite("scalar-type-argument-of-root-type", "add-optional-argument"),
      bench("Q4"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a required field argument was added (newOptionalArg1)",
        verdict: "DANGEROUS (OPTIONAL_ARG_ADDED)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_ADDED", "gjs:OPTIONAL_ARG_ADDED"],
    sdl: [q(""), q("limit: Int")],
    expect: [{ at: "queries/search/args/**", action: "add", type: nonBreaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-002",
    // ISSUE-127 (fixed) (P8a)
    title: "second optional argument added",
    before: "search(term: String)",
    after: "search(term: String, limit: Int)",
    rationale: "existing operations do not supply it and stay valid",
    annotation: "names the field and the added argument (Query.search limit)",
    sources: [
      ...suite("scalar-type-argument-of-root-type", "add-second-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if an optional field argument was added",
        verdict: "DANGEROUS (OPTIONAL_ARG_ADDED)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_ADDED", "gjs:OPTIONAL_ARG_ADDED"],
    sdl: [q("term: String"), q("term: String, limit: Int")],
    expect: [{ at: "queries/search/args/**", action: "add", type: nonBreaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-003",
    // ISSUE-127 (fixed) (P8a)
    title: "required argument (non-null, no default) added",
    before: "search: [String]",
    after: "search(limit: Int!): [String]",
    rationale: "operations that do not supply the new required argument fail validation",
    annotation: "names the field and the added required argument (Query.search limit)",
    sources: [gi("argument.test.ts added non-nullable without default value"), bench("Q3")],
    covers: ["gi:FIELD_ARGUMENT_ADDED"],
    sdl: [q(""), q("limit: Int!")],
    expect: [{ at: "queries/search/args/**", action: "add", type: breaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-004",
    title: "non-null argument with a default added",
    before: "search: [String]",
    after: "search(limit: Int! = 10): [String]",
    rationale:
      "the default makes the argument optional, so no operation becomes invalid; operations that omit it now run with limit 10 (graphql-inspector DANGEROUS); POLICY-05: risky",
    annotation: "names the field and the added argument (Query.search limit)",
    sources: [
      gi("argument.test.ts added non-nullable with default value"),
      asd("test/graphapi/graphapi10.test.ts G10.12"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a required field argument was added (newOptionalArg2)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_ADDED", "gjs:OPTIONAL_ARG_ADDED"],
    sdl: [q(""), q("limit: Int! = 10")],
    expect: [{ at: "queries/search/args/**", action: "add", type: risky, mentions: ARG("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); 0.1.2 description
  }),
  gql({
    id: "GQL-ARG-005",
    title: "nullable argument with a default added",
    before: "search: [String]",
    after: "search(limit: Int = 10): [String]",
    rationale:
      "no operation becomes invalid; operations that omit it now run with limit 10 (graphql-inspector DANGEROUS); POLICY-05: risky",
    annotation: "names the field and the added argument (Query.search limit)",
    sources: [gi("argument.test.ts added nullable with default value")],
    covers: ["gi:FIELD_ARGUMENT_ADDED"],
    sdl: [q(""), q("limit: Int = 10")],
    expect: [{ at: "queries/search/args/**", action: "add", type: risky, mentions: ARG("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); 0.1.2 description
  }),
  gql({
    id: "GQL-ARG-006",
    // ISSUE-127 (fixed) (P8a)
    title: "required argument added to a newly added field",
    before: "type User { id: ID! }",
    after: "type User { id: ID! posts(first: Int!): [String] }",
    rationale: "the field is new, so no existing query uses it; only the field addition is a change",
    annotation: "names the type and the added field (User.posts)",
    sources: [
      gi("argument.test.ts added to a new field"),
      gi("directive-usage.test.ts added directive on added field"),
    ],
    covers: ["gi:FIELD_ADDED", "gi:FIELD_ARGUMENT_ADDED"],
    sdl: ["type Query { profile: User } type User { id: ID! }", o("first: Int!")],
    expect: [{ at: "**/posts", action: "add", type: nonBreaking, mentions: ["User", "posts"] }],
  }),
  gql({
    id: "GQL-ARG-007",
    // ISSUE-127 (fixed) (P8a)
    title: "only argument removed",
    before: "search(term: String): [String]",
    after: "search: [String]",
    rationale: "operations supplying `term` fail validation (unknown argument)",
    annotation: "names the field and the removed argument (Query.search term)",
    sources: [
      gi("object.test.ts arguments removed"),
      giChange("field.ts FIELD_ARGUMENT_REMOVED"),
      ...suite("scalar-type-argument-of-root-type", "remove-argument"),
    ],
    covers: ["gi:FIELD_ARGUMENT_REMOVED"],
    sdl: [q("term: String"), q("")],
    expect: [{ at: "queries/search/args/**", action: "remove", type: breaking, mentions: ARG("term") }],
  }),
  gql({
    id: "GQL-ARG-008",
    // ISSUE-127 (fixed) (P8a)
    title: "one of two arguments removed",
    before: "search(term: String, limit: Int)",
    after: "search(term: String)",
    rationale: "operations supplying `limit` fail validation (unknown argument)",
    annotation: "names the field and the removed argument (Query.search limit)",
    sources: [
      ...suite("scalar-type-argument-of-root-type", "remove-one-argument"),
      bench("Q8"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument was removed (Interface1.field1 arg1, objectArg)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_REMOVED", "gjs:ARG_REMOVED"],
    sdl: [q("term: String, limit: Int"), q("term: String")],
    expect: [{ at: "queries/search/args/**", action: "remove", type: breaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-009",
    // ISSUE-127 (fixed) (P8a)
    title: "argument made non-null (Int to Int!)",
    before: "search(limit: Int)",
    after: "search(limit: Int!)",
    rationale: "operations omitting `limit` or passing a nullable variable fail validation",
    annotation: "names the field and the argument (Query.search limit) and the nullability change",
    sources: [
      gi("object.test.ts arguments type changed"),
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED"),
      ...suite("scalar-type-argument-of-root-type", "mark-optional-argument-as-mandatory"),
      bench("Q7"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument has changed type (arg4)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND"],
    sdl: [q("limit: Int"), q("limit: Int!")],
    expect: [{ at: ["queries/search/args/**"], type: breaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-010",
    // ISSUE-127 (fixed) (P8a)
    title: "argument made nullable (Int! to Int)",
    before: "search(limit: Int!)",
    after: "search(limit: Int)",
    rationale: "every value valid before is still valid; operations may now omit it",
    annotation: "names the field and the argument (Query.search limit) and the nullability change",
    sources: [
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED safeChangeForInputValue"),
      ...suite("scalar-type-argument-of-root-type", "mark-mandatory-argument-as-optional"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if an arg value changes safely",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should consider args that move away from NonNull as non-breaking",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND_SAFE"],
    sdl: [q("limit: Int!"), q("limit: Int")],
    expect: [{ at: ["queries/search/args/**"], type: nonBreaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-011",
    // ISSUE-127 (fixed) (P8a)
    title: "argument scalar type changed (String to Int)",
    before: "search(term: String)",
    after: "search(term: Int)",
    rationale: "string literals and `$t: String` variables fail validation",
    annotation: "names the field and the argument (Query.search term) and the type change",
    sources: [
      gi("object.test.ts arguments type changed"),
      ...suite("scalar-type-argument-of-root-type", "change-type-of-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument has changed type (arg1)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND"],
    sdl: [q("term: String"), q("term: Int")],
    expect: [{ at: ["queries/search/args/**"], type: breaking, mentions: ARG("term") }],
  }),
  gql({
    id: "GQL-ARG-012",
    // ISSUE-127 (fixed) (P8a); ISSUE-123 (fixed): one nominal type change; 0.1.2 description
    title: "argument scalar Int to Float",
    before: "search(limit: Int)",
    after: "search(limit: Float)",
    rationale: "integer literals coerce to Float, but variables declared `$l: Int` no longer match the argument type",
    annotation: "names the field and the argument (Query.search limit) and the type change",
    sources: [giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED safeChangeForInputValue")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [q("limit: Int"), q("limit: Float")],
    expect: [{ at: ["queries/search/args/**"], type: breaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-013",
    // ISSUE-127 (fixed) (P8a)
    title: "argument scalar ID to String",
    before: "search(id: ID)",
    after: "search(id: String)",
    rationale: "integer literals and variables declared `$id: ID` fail validation",
    annotation: "names the field and the argument (Query.search id) and the type change",
    sources: [giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED safeChangeForInputValue")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [q("id: ID"), q("id: String")],
    expect: [{ at: ["queries/search/args/**"], type: breaking, mentions: ARG("id") }],
  }),
  gql({
    id: "GQL-ARG-014",
    // ISSUE-127 (fixed) (P8a); ISSUE-123 (fixed): one nominal type change; 0.1.2 description
    title: "argument wrapped in a list (Int to [Int])",
    before: "search(tag: String)",
    after: "search(tag: [String])",
    rationale: "literals still coerce to a one-item list, but variables declared `$t: String` no longer match",
    annotation: "names the field and the argument (Query.search tag) and the type change",
    sources: [
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument has changed type (arg2)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND"],
    sdl: [q("tag: String"), q("tag: [String]")],
    expect: [{ at: ["queries/search/args/**"], type: breaking, mentions: ARG("tag") }],
  }),
  gql({
    id: "GQL-ARG-015",
    // ISSUE-127 (fixed) (P8a)
    title: "argument list items made non-null ([String] to [String!])",
    before: "search(tags: [String])",
    after: "search(tags: [String!])",
    rationale: "lists containing null and variables declared `$t: [String]` fail validation",
    annotation: "names the field and the argument (Query.search tags) and the item nullability change",
    sources: [
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument has changed type (arg9)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND"],
    sdl: [q("tags: [String]"), q("tags: [String!]")],
    expect: [{ at: ["queries/search/args/**"], type: breaking, mentions: ARG("tags") }],
  }),
  gql({
    id: "GQL-ARG-016",
    // ISSUE-127 (fixed) (P8a)
    title: "argument list items made nullable ([String!] to [String])",
    before: "search(tags: [String!])",
    after: "search(tags: [String])",
    rationale: "every value valid before is still valid",
    annotation: "names the field and the argument (Query.search tags) and the item nullability change",
    sources: [
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument has changed type (arg10)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND_SAFE"],
    sdl: [q("tags: [String!]"), q("tags: [String]")],
    expect: [{ at: ["queries/search/args/**"], type: nonBreaking, mentions: ARG("tags") }],
  }),
  gql({
    id: "GQL-ARG-017",
    // ISSUE-127 (fixed) (P8a)
    title: "non-null list argument made nullable ([String]! to [String])",
    before: "search(tags: [String]!)",
    after: "search(tags: [String])",
    rationale: "every value valid before is still valid; operations may now omit it",
    annotation: "names the field and the argument (Query.search tags) and the nullability change",
    sources: [
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument has changed type (arg7)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED", "gjs:ARG_CHANGED_KIND_SAFE"],
    sdl: [q("tags: [String]!"), q("tags: [String]")],
    expect: [{ at: ["queries/search/args/**"], type: nonBreaking, mentions: ARG("tags") }],
  }),
  gql({
    id: "GQL-ARG-018",
    // ISSUE-127 (fixed) (P8a)
    title: "argument input type swapped (FilterA to FilterB, structurally identical)",
    before: "search(filter: FilterA)",
    after: "search(filter: FilterB)",
    rationale: "GraphQL types are nominal: variables declared `$f: FilterA` fail validation",
    annotation: "names the field and the argument (Query.search filter) and the type change",
    sources: [
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED"),
      ...suite("input-type-argument-of-root-type", "change-type-of-field-in-input-type-argument"),
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [
      "type Query { search(filter: FilterA): [String] } input FilterA { term: String } input FilterB { term: String }",
      "type Query { search(filter: FilterB): [String] } input FilterA { term: String } input FilterB { term: String }",
    ],
    expect: [
      { at: ["queries/search/args/**"], type: breaking, mentions: ARG("filter") },
      { at: "components/inputObjects/FilterA", action: "remove", type: breaking, optional: true },
      { at: "components/inputObjects/FilterB", action: "add", type: nonBreaking, optional: true },
    ],
  }),
  gql({
    id: "GQL-ARG-019",
    // ISSUE-127 (fixed) (P8a); ISSUE-123 (fixed): one nominal type change; 0.1.2 description
    title: "argument changed from String to an enum",
    before: "search(sort: String)",
    after: "search(sort: Order) enum Order { ASC DESC }",
    rationale: "string literals and `$s: String` variables fail validation against an enum",
    annotation: "names the field and the argument (Query.search sort) and the type change",
    sources: [
      fork("test/graphapi.diff.test.ts new types in arguments: built-in scalar -> enum"),
      giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED"),
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [q("sort: String"), "type Query { search(sort: Order): [String] } enum Order { ASC DESC }"],
    expect: [
      { at: "queries/search/args/**/title", type: annotation, optional: true },
      { at: ["queries/search/args/**"], type: breaking, mentions: ARG("sort") },
      { at: "components/enums/Order", action: "add", type: nonBreaking, optional: true },
    ],
  }),
  gql({
    id: "GQL-ARG-020",
    // ISSUE-127 (fixed) (P8a); ISSUE-123 (fixed): one nominal type change; 0.1.2 description
    title: "argument changed from String to an input object",
    before: "search(filter: String)",
    after: "search(filter: SearchFilter) input SearchFilter { term: String }",
    rationale: "string literals and `$f: String` variables fail validation",
    annotation: "names the field and the argument (Query.search filter) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in arguments: built-in scalar -> object")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [
      q("filter: String"),
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String }",
    ],
    expect: [
      { at: "queries/search/args/**/title", type: annotation, optional: true },
      { at: ["queries/search/args/**"], type: breaking, mentions: ARG("filter") },
      { at: "components/inputObjects/SearchFilter", action: "add", type: nonBreaking, optional: true },
    ],
  }),
  gql({
    id: "GQL-ARG-021",
    title: "default added to an optional argument",
    before: "search(limit: Int)",
    after: "search(limit: Int = 10)",
    rationale:
      "operations that omit `limit` now get 10 instead of no value (graphql-inspector DANGEROUS); no operation becomes invalid; POLICY-05: risky",
    annotation: "names the field and the argument (Query.search limit) and the default value",
    sources: [
      gi("argument.test.ts default value added"),
      ...suite("scalar-type-argument-of-root-type", "add-default-value-of-argument", "breaking"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a default value was added",
        verdict: "SAFE (ARG_DEFAULT_VALUE_ADDED)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_DEFAULT_CHANGED", "gjs:ARG_DEFAULT_VALUE_ADDED"],
    sdl: [q("limit: Int"), q("limit: Int = 10")],
    expect: [{ at: ["queries/search/args/**"], type: risky, mentions: ARG("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); 0.1.2 description
  }),
  gql({
    id: "GQL-ARG-022",
    title: "default of an optional argument changed",
    before: "search(limit: Int = 10)",
    after: "search(limit: Int = 20)",
    rationale: "operations that omit `limit` silently get a different value; POLICY-05: risky",
    annotation: "names the field and the argument (Query.search limit) and the default value",
    sources: [
      gi("argument.test.ts default value changed"),
      giChange("argument.ts FIELD_ARGUMENT_DEFAULT_CHANGED"),
      ...suite("scalar-type-argument-of-root-type", "change-default-value-of-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a defaultValue changed on an argument (stringArg)",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should find all dangerous changes (argThatChangesDefaultValue)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_DEFAULT_CHANGED", "gjs:ARG_DEFAULT_VALUE_CHANGE"],
    sdl: [q("limit: Int = 10"), q("limit: Int = 20")],
    expect: [{ at: ["queries/search/args/**"], type: risky, mentions: ARG("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); 0.1.2 description
  }),
  gql({
    id: "GQL-ARG-023",
    title: "default of an optional argument removed",
    before: "search(limit: Int = 10)",
    after: "search(limit: Int)",
    rationale: "operations that omit `limit` now send no value instead of 10; POLICY-05: risky",
    annotation: "names the field and the argument (Query.search limit) and the default value",
    sources: [
      gi("argument.test.ts detects removal of a falsy default"),
      ...suite("scalar-type-argument-of-root-type", "remove-default-value-of-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a defaultValue changed on an argument (withDefaultValue)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_DEFAULT_CHANGED", "gjs:ARG_DEFAULT_VALUE_CHANGE"],
    sdl: [q("limit: Int = 10"), q("limit: Int")],
    expect: [{ at: ["queries/search/args/**"], type: risky, mentions: ARG("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); 0.1.2 description
  }),
  gql({
    id: "GQL-ARG-024",
    // ISSUE-127 (fixed) (P8a)
    title: "default added to a required argument",
    before: "search(limit: Int!)",
    after: "search(limit: Int! = 10)",
    rationale: "existing operations always supply `limit`, so nothing changes for them; the argument becomes optional",
    annotation: "names the field and the argument (Query.search limit) and the default value",
    sources: [
      ...suite("scalar-type-argument-of-root-type", "add-default-value-of-required-argument"),
      asd("test/graphapi/graphapi10.test.ts G10.14"),
      gi("argument.test.ts default value added", "DANGEROUS"),
    ],
    covers: ["gi:FIELD_ARGUMENT_DEFAULT_CHANGED"],
    sdl: [q("limit: Int!"), q("limit: Int! = 10")],
    expect: [{ at: ["queries/search/args/**"], type: nonBreaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-025",
    // ISSUE-127 (fixed) (P8a)
    title: "default removed from a required argument",
    before: "search(limit: Int! = 10)",
    after: "search(limit: Int!)",
    rationale: "operations that relied on the default omit a now required argument and fail validation",
    annotation: "names the field and the argument (Query.search limit) and the default value",
    sources: [
      asd("test/graphapi/graphapi10.test.ts G10.14"),
      gi("argument.test.ts detects removal of a falsy default", "DANGEROUS"),
      ...suite("scalar-type-argument-of-root-type", "remove-default-value-of-required-argument", "non-breaking"),
    ],
    covers: ["gi:FIELD_ARGUMENT_DEFAULT_CHANGED"],
    sdl: [q("limit: Int! = 10"), q("limit: Int!")],
    expect: [{ at: ["queries/search/args/**"], type: breaking, mentions: ARG("limit") }],
  }),
  gql({
    id: "GQL-ARG-026",
    title: "default of a required argument changed",
    before: "search(limit: Int! = 10)",
    after: "search(limit: Int! = 20)",
    rationale: "operations that omit `limit` silently get a different value; POLICY-05: risky",
    annotation: "names the field and the argument (Query.search limit) and the default value",
    sources: [
      ...suite("scalar-type-argument-of-root-type", "change-default-value-of-required-argument", "non-breaking"),
      giChange("argument.ts FIELD_ARGUMENT_DEFAULT_CHANGED"),
    ],
    covers: ["gi:FIELD_ARGUMENT_DEFAULT_CHANGED"],
    sdl: [q("limit: Int! = 10"), q("limit: Int! = 20")],
    expect: [{ at: ["queries/search/args/**"], type: risky, mentions: ARG("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); 0.1.2 description
  }),
  gql({
    id: "GQL-ARG-027",
    title: "list default value changed",
    before: 'search(tags: [String] = ["a"])',
    after: 'search(tags: [String] = ["a", "b"])',
    rationale: "operations that omit `tags` silently get a different value; POLICY-05: risky",
    annotation: "names the field and the argument (Query.search tags) and the default value",
    sources: [
      gi("schema.test.ts array as default value in argument (different)"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a defaultValue changed on an argument (emptyArray, valueArray)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_DEFAULT_CHANGED", "gjs:ARG_DEFAULT_VALUE_CHANGE"],
    sdl: [q('tags: [String] = ["a"]'), q('tags: [String] = ["a", "b"]')],
    expect: [{ at: ["queries/search/args/**"], type: risky, mentions: ARG("tags") }],
    // POLICY-05 decided (b); 1.0 also compares the list default item by item without a rule (primary cause)
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); 0.1.2 description; 1.0: ISSUE-140 (fixed)
  }),
  gql({
    id: "GQL-ARG-028",
    title: "equal list and input-object defaults (not a change)",
    before: 'search(tags: [String] = ["a"], filter: F = { term: "x" })',
    after: "same defaults written with different whitespace",
    rationale: "equal default values are not a change",
    annotation: "no diff",
    sources: [
      gi("schema.test.ts array as default value in argument (same)"),
      gi("schema.test.ts input as default value (same)"),
      gi("argument.test.ts treats equivalent literal and programmatic defaults as equal"),
    ],
    sdl: [
      'type Query { search(tags: [String] = ["a"], filter: F = { term: "x" }): [String] } input F { term: String }',
      'type Query { search(tags: [String] = [ "a" ],filter: F = {term:"x"}): [String] } input F { term: String }',
    ],
    expect: [],
  }),
  gql({
    id: "GQL-ARG-029",
    title: "argument order changed (not a change)",
    before: "search(term: String, limit: Int)",
    after: "search(limit: Int, term: String)",
    rationale: "arguments are passed by name; order is not significant",
    annotation: "no diff",
    sources: [gi("input.test.ts fields order changed")],
    sdl: [q("term: String, limit: Int"), q("limit: Int, term: String")],
    expect: [],
  }),
  gql({
    id: "GQL-ARG-030",
    // ISSUE-127 (fixed) (P8a)
    title: "argument renamed",
    before: "search(term: String)",
    after: "search(query: String)",
    rationale: "arguments are passed by name: operations supplying `term` fail; the new argument is an addition",
    annotation: "names the field and both arguments (Query.search term removed, query added)",
    sources: [giChange("field.ts FIELD_ARGUMENT_REMOVED / FIELD_ARGUMENT_ADDED")],
    covers: ["gi:FIELD_ARGUMENT_REMOVED", "gi:FIELD_ARGUMENT_ADDED"],
    sdl: [q("term: String"), q("query: String")],
    expect: [
      { at: "queries/search/args/**/term", action: "remove", type: breaking, mentions: ARG("term") },
      { at: "queries/search/args/**/query", action: "add", type: nonBreaking, mentions: ARG("query") },
    ],
  }),
  gql({
    id: "GQL-ARG-031",
    // ISSUE-127 (fixed) (P8a)
    title: "required argument added to an object type field",
    before: "type User { posts: [String] }",
    after: "type User { posts(first: Int!): [String] }",
    rationale: "queries selecting User.posts without `first` fail validation",
    annotation: "names the type, the field and the argument (User.posts first)",
    sources: [
      gi("object.test.ts arguments added"),
      giChange("field.ts FIELD_ARGUMENT_ADDED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a required field argument was added (newRequiredArg)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_ADDED", "gjs:REQUIRED_ARG_ADDED"],
    sdl: [o(""), o("first: Int!")],
    expect: [{ at: ["**/posts/**"], action: "add", type: breaking, mentions: ["User", "posts", "first"] }],
  }),
  gql({
    id: "GQL-ARG-032",
    // ISSUE-127 (fixed) (P8a)
    title: "optional argument added to an object type field",
    before: "type User { posts: [String] }",
    after: "type User { posts(first: Int): [String] }",
    rationale: "existing queries do not supply it and stay valid",
    annotation: "names the type, the field and the argument (User.posts first)",
    sources: [gi("object.test.ts arguments added")],
    covers: ["gi:FIELD_ARGUMENT_ADDED"],
    sdl: [o(""), o("first: Int")],
    expect: [{ at: ["**/posts/**"], action: "add", type: nonBreaking, mentions: ["User", "posts", "first"] }],
  }),
  gql({
    id: "GQL-ARG-033",
    // ISSUE-127 (fixed) (P8a)
    title: "argument removed from an object type field",
    before: "type User { posts(first: Int): [String] }",
    after: "type User { posts: [String] }",
    rationale: "queries supplying `first` fail validation (unknown argument)",
    annotation: "names the type, the field and the argument (User.posts first)",
    sources: [
      gi("object.test.ts arguments removed"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field argument was removed (Type1.field1 name)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_REMOVED", "gjs:ARG_REMOVED"],
    sdl: [o("first: Int"), o("")],
    expect: [{ at: ["**/posts/**"], action: "remove", type: breaking, mentions: ["User", "posts", "first"] }],
  }),
  gql({
    id: "GQL-ARG-034",
    // ISSUE-127 (fixed) (P8a)
    title: "argument type changed on an object type field",
    before: "type User { posts(first: Int): [String] }",
    after: "type User { posts(first: String): [String] }",
    rationale: "integer literals and `$n: Int` variables fail validation",
    annotation: "names the type, the field and the argument (User.posts first) and the type change",
    sources: [gi("object.test.ts arguments type changed")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [o("first: Int"), o("first: String")],
    expect: [{ at: ["**/posts/**"], type: breaking, mentions: ["User", "posts", "first"] }],
  }),
  gql({
    id: "GQL-ARG-035",
    // ISSUE-127 (fixed) (P8a)
    title: "argument made non-null on an interface field",
    before: "interface Node { children(first: Int): [Node] }",
    after: "interface Node { children(first: Int!): [Node] }",
    rationale: "queries omitting `first` on Node.children fail validation",
    annotation: "names the interface, the field and the argument (Node.children first)",
    sources: [gi("interface.test.ts fields type changed"), giChange("argument.ts FIELD_ARGUMENT_TYPE_CHANGED")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [
      "type Query { node: Node } interface Node { id: ID! children(first: Int): [Node] }",
      "type Query { node: Node } interface Node { id: ID! children(first: Int!): [Node] }",
    ],
    expect: [{ at: ["**/children/**"], type: breaking, mentions: ["Node", "children", "first"] }],
  }),
  gql({
    id: "GQL-ARG-036",
    // ISSUE-127 (fixed) (P8a)
    title: "required argument added to a mutation",
    before: "type Mutation { createPost(title: String): String }",
    after: "type Mutation { createPost(title: String, body: String!): String }",
    rationale: "mutations that do not supply `body` fail validation",
    annotation: "names the mutation and the argument (Mutation.createPost body)",
    sources: [giChange("field.ts FIELD_ARGUMENT_ADDED")],
    covers: ["gi:FIELD_ARGUMENT_ADDED"],
    sdl: [
      "type Query { a: String } type Mutation { createPost(title: String): String }",
      "type Query { a: String } type Mutation { createPost(title: String, body: String!): String }",
    ],
    expect: [
      {
        at: "mutations/createPost/args/**",
        action: "add",
        type: breaking,
        mentions: [/mutation/i, "createPost", "body"],
      },
    ],
  }),
  gql({
    id: "GQL-ARG-037",
    // ISSUE-127 (fixed) (P8a)
    title: "argument removed from a subscription",
    before: "type Subscription { onPost(channel: String): String }",
    after: "type Subscription { onPost: String }",
    rationale: "subscriptions supplying `channel` fail validation",
    annotation: "names the subscription and the argument (Subscription.onPost channel)",
    sources: [giChange("field.ts FIELD_ARGUMENT_REMOVED")],
    covers: ["gi:FIELD_ARGUMENT_REMOVED"],
    sdl: [
      "type Query { a: String } type Subscription { onPost(channel: String): String }",
      "type Query { a: String } type Subscription { onPost: String }",
    ],
    expect: [
      {
        at: "subscriptions/onPost/args/**",
        action: "remove",
        type: breaking,
        mentions: [/subscription/i, "onPost", "channel"],
      },
    ],
  }),
  // POLICY-47 decided (DESIGN_PROPOSALS §12.8, TASK §3.0a): an argument with a default is optional for operations
  // whether or not it is non-null, so making it non-null only rejects an explicit `null`
  gql({
    id: "GQL-ARG-038",
    // ISSUE-127 (fixed) (P8a)
    title: "argument with a default made non-null",
    before: "search(limit: Int = 10)",
    after: "search(limit: Int! = 10)",
    rationale:
      "operations that omit `limit` still get the default; only an explicit `null` is now rejected; POLICY-47 decided: non-breaking",
    annotation: "names the field and the argument (Query.search limit)",
    sources: [
      asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-47 (decided: non-breaking)"),
      { tool: "graphql-js", ref: "src/utilities/findBreakingChanges.ts ARG_CHANGED_KIND", verdict: "BREAKING" },
    ],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [q("limit: Int = 10"), q("limit: Int! = 10")],
    expect: [{ at: ["queries/search/args/**"], type: nonBreaking, mentions: ARG("limit") }],
  }),
]

runCases("graphql", "arguments", cases, import.meta.filename)
