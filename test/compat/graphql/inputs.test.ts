import { breaking, nonBreaking } from "../../../src"
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
const bench = (ref: string, verdict?: string): CaseSource => ({
  tool: "bench",
  ref: `bench/fixtures/graphql.js ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string): CaseSource => ({ tool: "asd", ref })

// an input object used by a root query argument
const inp = (fields: string) =>
  `type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String ${fields} }`
const SITES = ["queries/search/args/**", "components/inputObjects/SearchFilter/**"]
const F = (name: string) => ["SearchFilter", name]

const cases: CompatCase[] = [
  gql({
    id: "GQL-INP-001",
    // ISSUE-127 (fixed) (P8a)
    title: "optional input field (nullable, no default) added",
    before: "input SearchFilter { term: String }",
    after: "input SearchFilter { term: String limit: Int }",
    rationale: "existing operations do not supply it and stay valid",
    annotation: "names the input type and the added field (SearchFilter.limit)",
    sources: [
      gi("input.test.ts fields added"),
      giChange("input.ts INPUT_FIELD_ADDED"),
      ...suite("input-type-argument-of-root-type", "add-new-field-in-input-type-argument"),
      bench("Q16"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if an optional field was added to an input",
        verdict: "DANGEROUS (OPTIONAL_INPUT_FIELD_ADDED)",
      },
    ],
    covers: ["gi:INPUT_FIELD_ADDED", "gjs:OPTIONAL_INPUT_FIELD_ADDED"],
    sdl: [inp(""), inp("limit: Int")],
    expect: [{ at: SITES, action: "add", type: nonBreaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-002",
    // ISSUE-127 (fixed) (P8a)
    title: "required input field (non-null, no default) added",
    before: "input SearchFilter { term: String }",
    after: "input SearchFilter { term: String limit: Int! }",
    rationale: "operations that build SearchFilter without `limit` fail validation",
    annotation: "names the input type and the added required field (SearchFilter.limit)",
    sources: [
      gi("input.test.ts fields added"),
      giChange("input.ts INPUT_FIELD_ADDED"),
      bench("Q15"),
      asd("test/graphapi/graphapi10.test.ts G10.16"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a required field is added to an input type (requiredField)",
      },
    ],
    covers: ["gi:INPUT_FIELD_ADDED", "gjs:REQUIRED_INPUT_FIELD_ADDED"],
    sdl: [inp(""), inp("limit: Int!")],
    expect: [{ at: SITES, action: "add", type: breaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-003",
    title: "non-null input field with a default added",
    before: "input SearchFilter { term: String }",
    after: "input SearchFilter { term: String limit: Int! = 10 }",
    rationale:
      "the default makes the field optional, so no operation becomes invalid; clients that omit it now send 10 (graphql-inspector DANGEROUS); POLICY-05: risky",
    annotation: "names the input type and the added field (SearchFilter.limit)",
    sources: [
      gi("input.test.ts added with a default value"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a required field is added to an input type (optionalField2)",
      },
    ],
    covers: ["gi:INPUT_FIELD_ADDED", "gjs:OPTIONAL_INPUT_FIELD_ADDED"],
    sdl: [inp(""), inp("limit: Int! = 10")],
    expect: [{ at: SITES, action: "add", type: risky, mentions: F("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-INP-004",
    title: "nullable input field with a default added",
    before: "input SearchFilter { term: String }",
    after: "input SearchFilter { term: String limit: Int = 10 }",
    rationale:
      "no operation becomes invalid; clients that omit it now send 10 (graphql-inspector DANGEROUS); POLICY-05: risky",
    annotation: "names the input type and the added field (SearchFilter.limit)",
    sources: [giChange("input.ts INPUT_FIELD_ADDED")],
    covers: ["gi:INPUT_FIELD_ADDED"],
    sdl: [inp(""), inp("limit: Int = 10")],
    expect: [{ at: SITES, action: "add", type: risky, mentions: F("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-INP-005",
    // ISSUE-127 (fixed) (P8a)
    title: "input field added to a newly added input type",
    before: "type Query { search: [String] }",
    after: "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String! }",
    rationale:
      "the input type is new, so no existing operation uses it; only the optional argument and the type are added",
    annotation: "names the added argument (Query.search filter) and the added input type (SearchFilter)",
    sources: [gi("input.test.ts added to an added input")],
    covers: ["gi:INPUT_FIELD_ADDED"],
    sdl: [
      "type Query { search: [String] }",
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String! }",
    ],
    expect: [
      { at: "queries/search/args/**", action: "add", type: nonBreaking, mentions: ["search", "filter"] },
      { at: "components/inputObjects/SearchFilter", action: "add", type: nonBreaking, mentions: ["SearchFilter"] },
    ],
  }),
  gql({
    id: "GQL-INP-006",
    // ISSUE-127 (fixed) (P8a)
    title: "optional input field removed",
    before: "input SearchFilter { term: String limit: Int }",
    after: "input SearchFilter { term: String }",
    rationale: "operations supplying `limit` fail validation (unknown input field)",
    annotation: "names the input type and the removed field (SearchFilter.limit)",
    sources: [
      gi("input.test.ts fields removed"),
      giChange("input.ts INPUT_FIELD_REMOVED"),
      ...suite("input-type-argument-of-root-type", "remove-field-from-input-type-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if fields on input types changed kind or were removed (field2)",
      },
    ],
    covers: ["gi:INPUT_FIELD_REMOVED", "gjs:FIELD_REMOVED"],
    sdl: [inp("limit: Int"), inp("")],
    expect: [{ at: SITES, action: "remove", type: breaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-007",
    // ISSUE-127 (fixed) (P8a); ISSUE-123 (fixed): one nominal type change
    title: "required input field removed",
    before: "input SearchFilter { term: String limit: Int! }",
    after: "input SearchFilter { term: String }",
    rationale: "every operation supplies `limit` and now fails validation (unknown input field)",
    annotation: "names the input type and the removed field (SearchFilter.limit)",
    sources: [
      gi("input.test.ts field removed"),
      asd("test/graphapi/classification.test.ts removing a required input field is breaking"),
    ],
    covers: ["gi:INPUT_FIELD_REMOVED"],
    sdl: [inp("limit: Int!"), inp("")],
    expect: [{ at: SITES, action: "remove", type: breaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-008",
    // ISSUE-127 (fixed) (P8a)
    title: "input field made non-null",
    before: "input SearchFilter { limit: Int }",
    after: "input SearchFilter { limit: Int! }",
    rationale: "operations omitting `limit` or passing null fail validation",
    annotation: "names the input type and the field (SearchFilter.limit) and the nullability change",
    sources: [
      gi("input.test.ts field made non-optional"),
      gi("schema.test.ts Input fields becoming non-nullable is a breaking change"),
      giChange("input.ts INPUT_FIELD_TYPE_CHANGED"),
      ...suite("input-type-argument-of-root-type", "mark-optional-field-of-input-type-argument-as-mandatory"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if fields on input types changed kind or were removed (field5)",
      },
    ],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [inp("limit: Int"), inp("limit: Int!")],
    expect: [{ at: SITES, type: breaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-009",
    // ISSUE-127 (fixed) (P8a)
    title: "input field made nullable",
    before: "input SearchFilter { limit: Int! }",
    after: "input SearchFilter { limit: Int }",
    rationale: "every value valid before is still valid",
    annotation: "names the input type and the field (SearchFilter.limit) and the nullability change",
    sources: [
      gi("input.test.ts field made optional"),
      gi("schema.test.ts Input fields becoming nullable is a non-breaking change"),
      ...suite("input-type-argument-of-root-type", "mark-mandatory-field-of-input-type-argument-as-optional"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if fields on input types changed kind or were removed (field4)",
      },
    ],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND_SAFE"],
    sdl: [inp("limit: Int!"), inp("limit: Int")],
    expect: [{ at: SITES, type: nonBreaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-010",
    // ISSUE-127 (fixed) (P8a)
    title: "input field scalar type changed (Int to String)",
    before: "input SearchFilter { limit: Int }",
    after: "input SearchFilter { limit: String }",
    rationale: "integer literals and `$l: Int` variables fail validation",
    annotation: "names the input type and the field (SearchFilter.limit) and the type change",
    sources: [
      gi("input.test.ts type changed"),
      ...suite("input-type-argument-of-root-type", "change-type-of-field-in-input-type-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if fields on input types changed kind or were removed (field1)",
      },
    ],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [inp("limit: Int"), inp("limit: String")],
    expect: [{ at: SITES, type: breaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-011",
    // ISSUE-127 (fixed) (P8a); ISSUE-123 (fixed): one nominal type change
    title: "input field wrapped in a list",
    before: "input SearchFilter { tag: String }",
    after: "input SearchFilter { tag: [String] }",
    rationale: "variables declared `$t: String` for `tag` no longer match the field type",
    annotation: "names the input type and the field (SearchFilter.tag) and the type change",
    sources: [
      giChange("input.ts INPUT_FIELD_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if fields on input types changed kind or were removed (field8)",
      },
    ],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [inp("tag: String"), inp("tag: [String]")],
    expect: [{ at: SITES, type: breaking, mentions: F("tag") }],
  }),
  gql({
    id: "GQL-INP-012",
    // ISSUE-127 (fixed) (P8a)
    title: "input list items made nullable ([String!] to [String])",
    before: "input SearchFilter { tags: [String!] }",
    after: "input SearchFilter { tags: [String] }",
    rationale: "every value valid before is still valid",
    annotation: "names the input type and the field (SearchFilter.tags) and the item nullability change",
    sources: [
      giChange("input.ts INPUT_FIELD_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if fields on input types changed kind or were removed (field10)",
      },
    ],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND_SAFE"],
    sdl: [inp("tags: [String!]"), inp("tags: [String]")],
    expect: [{ at: SITES, type: nonBreaking, mentions: F("tags") }],
  }),
  gql({
    id: "GQL-INP-013",
    // ISSUE-127 (fixed) (P8a)
    title: "input list items made non-null ([String] to [String!])",
    before: "input SearchFilter { tags: [String] }",
    after: "input SearchFilter { tags: [String!] }",
    rationale: "lists containing null fail validation",
    annotation: "names the input type and the field (SearchFilter.tags) and the item nullability change",
    sources: [
      giChange("input.ts INPUT_FIELD_TYPE_CHANGED safeChangeForInputValue"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if fields on input types changed kind or were removed (field9)",
      },
    ],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [inp("tags: [String]"), inp("tags: [String!]")],
    expect: [{ at: SITES, type: breaking, mentions: F("tags") }],
  }),
  gql({
    id: "GQL-INP-014",
    title: "default added to an optional input field",
    before: "input SearchFilter { limit: Int }",
    after: "input SearchFilter { limit: Int = 10 }",
    rationale:
      "clients that omit `limit` now send 10 instead of no value; no operation becomes invalid; POLICY-05: risky",
    annotation: "names the input type and the field (SearchFilter.limit) and the default value",
    sources: [
      gi("input.test.ts default value added"),
      giChange("input.ts INPUT_FIELD_DEFAULT_VALUE_CHANGED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a defaultValue changed on an input field (withoutDefaultValue)",
        verdict: "SAFE (INPUT_FIELD_DEFAULT_VALUE_ADDED)",
      },
    ],
    covers: ["gi:INPUT_FIELD_DEFAULT_VALUE_CHANGED", "gjs:INPUT_FIELD_DEFAULT_VALUE_ADDED"],
    sdl: [inp("limit: Int"), inp("limit: Int = 10")],
    expect: [{ at: SITES, type: risky, mentions: F("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-INP-015",
    title: "default of an input field changed",
    before: "input SearchFilter { limit: Int = 10 }",
    after: "input SearchFilter { limit: Int = 20 }",
    rationale: "clients that omit `limit` silently send another value; POLICY-05: risky",
    annotation: "names the input type and the field (SearchFilter.limit) and the default value",
    sources: [
      giChange("input.ts INPUT_FIELD_DEFAULT_VALUE_CHANGED"),
      gi("input.test.ts detects a changed programmatic default value"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a defaultValue changed on an input field (stringField)",
      },
    ],
    covers: ["gi:INPUT_FIELD_DEFAULT_VALUE_CHANGED", "gjs:INPUT_FIELD_DEFAULT_VALUE_CHANGE"],
    sdl: [inp("limit: Int = 10"), inp("limit: Int = 20")],
    expect: [{ at: SITES, type: risky, mentions: F("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-INP-016",
    title: "default of an optional input field removed",
    before: "input SearchFilter { limit: Int = 10 }",
    after: "input SearchFilter { limit: Int }",
    rationale: "clients that omit `limit` now send no value instead of 10; POLICY-05: risky",
    annotation: "names the input type and the field (SearchFilter.limit) and the default value",
    sources: [
      gi("input.test.ts default value removed"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a defaultValue changed on an input field (withDefaultValue)",
      },
    ],
    covers: ["gi:INPUT_FIELD_DEFAULT_VALUE_CHANGED", "gjs:INPUT_FIELD_DEFAULT_VALUE_CHANGE"],
    sdl: [inp("limit: Int = 10"), inp("limit: Int")],
    expect: [{ at: SITES, type: risky, mentions: F("limit") }],
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-INP-017",
    // ISSUE-127 (fixed) (P8a)
    title: "default removed from a required input field",
    before: "input SearchFilter { limit: Int! = 10 }",
    after: "input SearchFilter { limit: Int! }",
    rationale: "operations that relied on the default omit a now required field and fail validation",
    annotation: "names the input type and the field (SearchFilter.limit) and the default value",
    sources: [gi("input.test.ts default value removed", "DANGEROUS")],
    covers: ["gi:INPUT_FIELD_DEFAULT_VALUE_CHANGED"],
    sdl: [inp("limit: Int! = 10"), inp("limit: Int!")],
    expect: [{ at: SITES, type: breaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-018",
    // ISSUE-127 (fixed) (P8a)
    title: "default added to a required input field",
    before: "input SearchFilter { limit: Int! }",
    after: "input SearchFilter { limit: Int! = 10 }",
    rationale: "existing operations always supply `limit`; the field becomes optional",
    annotation: "names the input type and the field (SearchFilter.limit) and the default value",
    sources: [gi("input.test.ts default value added", "DANGEROUS")],
    covers: ["gi:INPUT_FIELD_DEFAULT_VALUE_CHANGED"],
    sdl: [inp("limit: Int!"), inp("limit: Int! = 10")],
    expect: [{ at: SITES, type: nonBreaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-019",
    title: "list default of an input field changed",
    before: 'input SearchFilter { tags: [String] = ["a"] }',
    after: 'input SearchFilter { tags: [String] = ["a", "b"] }',
    rationale: "clients that omit `tags` silently send another value; POLICY-05: risky",
    annotation: "names the input type and the field (SearchFilter.tags) and the default value",
    sources: [
      gi("schema.test.ts array as default value in input (different)"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a defaultValue changed on an input field (emptyArray)",
      },
    ],
    covers: ["gi:INPUT_FIELD_DEFAULT_VALUE_CHANGED", "gjs:INPUT_FIELD_DEFAULT_VALUE_CHANGE"],
    sdl: [inp('tags: [String] = ["a"]'), inp('tags: [String] = ["a", "b"]')],
    expect: [{ at: SITES, type: risky, mentions: F("tags") }],
    // POLICY-05 decided (b); 1.0 also compares the list default item by item without a rule (primary cause)
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); ISSUE-140 (fixed)
  }),
  gql({
    id: "GQL-INP-020",
    title: "equal list default of an input field (not a change)",
    before: 'input SearchFilter { tags: [String] = ["a"] }',
    after: 'input SearchFilter { tags: [String] = [ "a" ] }',
    rationale: "equal default values are not a change",
    annotation: "no diff",
    sources: [gi("schema.test.ts array as default value in input (same)")],
    sdl: [inp('tags: [String] = ["a"]'), inp('tags: [String] = [ "a" ]')],
    expect: [],
  }),
  gql({
    id: "GQL-INP-021",
    title: "input field order changed (not a change)",
    before: "input SearchFilter { term: String limit: Int }",
    after: "input SearchFilter { limit: Int term: String }",
    rationale: "input fields are passed by name; order is not significant",
    annotation: "no diff",
    sources: [
      gi("input.test.ts fields order changed"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should ignore changes in field definitions order",
      },
    ],
    sdl: [
      inp("limit: Int"),
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { limit: Int term: String }",
    ],
    expect: [],
  }),
  gql({
    id: "GQL-INP-022",
    // ISSUE-127 (fixed) (P8a)
    title: "required field added to a nested input type",
    before: "input SearchFilter { range: Range } input Range { from: Int }",
    after: "input Range { from: Int to: Int! }",
    rationale: "operations that build a Range without `to` fail validation",
    annotation: "names the input type and the added field (Range.to)",
    sources: [giChange("input.ts INPUT_FIELD_ADDED")],
    covers: ["gi:INPUT_FIELD_ADDED"],
    sdl: [inp("range: Range } input Range { from: Int"), inp("range: Range } input Range { from: Int to: Int!")],
    expect: [
      {
        at: ["queries/search/args/**", "components/inputObjects/SearchFilter/**", "components/inputObjects/Range/**"],
        action: "add",
        type: breaking,
        mentions: ["Range", "to"],
      },
    ],
  }),
  gql({
    id: "GQL-INP-023",
    // ISSUE-127 (fixed) (P8a)
    title: "required field added to an input type used by a query and a mutation",
    before: "input SearchFilter { term: String } used by Query.search and Mutation.saveSearch",
    after: "input SearchFilter { term: String owner: ID! }",
    rationale: "every operation that builds SearchFilter without `owner` fails validation",
    annotation: "names the input type and the added field (SearchFilter.owner)",
    sources: [giChange("input.ts INPUT_FIELD_ADDED"), asd("test/graphapi/classification.test.ts consistency")],
    covers: ["gi:INPUT_FIELD_ADDED"],
    sdl: [
      "type Query { search(filter: SearchFilter): [String] } type Mutation { saveSearch(filter: SearchFilter!): ID } input SearchFilter { term: String }",
      "type Query { search(filter: SearchFilter): [String] } type Mutation { saveSearch(filter: SearchFilter!): ID } input SearchFilter { term: String owner: ID! }",
    ],
    expect: [
      {
        at: ["queries/search/args/**", "mutations/saveSearch/args/**", "components/inputObjects/SearchFilter/**"],
        action: "add",
        type: breaking,
        mentions: ["SearchFilter", "owner"],
      },
    ],
  }),
  gql({
    id: "GQL-INP-024",
    // ISSUE-127 (fixed) (P8a)
    title: "optional field added to a self-referencing input type",
    before: "input SearchFilter { term: String and: [SearchFilter] }",
    after: "input SearchFilter { term: String and: [SearchFilter] limit: Int }",
    rationale: "existing operations do not supply it and stay valid",
    annotation: "names the input type and the added field (SearchFilter.limit)",
    sources: [giChange("input.ts INPUT_FIELD_ADDED")],
    covers: ["gi:INPUT_FIELD_ADDED"],
    sdl: [inp("and: [SearchFilter]"), inp("and: [SearchFilter] limit: Int")],
    expect: [{ at: SITES, action: "add", type: nonBreaking, mentions: F("limit") }],
  }),
  gql({
    id: "GQL-INP-025",
    // ISSUE-127 (fixed) (P8a)
    title: "input field renamed",
    before: "input SearchFilter { term: String }",
    after: "input SearchFilter { query: String }",
    rationale: "input fields are passed by name: operations supplying `term` fail; the new field is an addition",
    annotation: "names the input type and both fields (SearchFilter.term removed, query added)",
    sources: [giChange("input.ts INPUT_FIELD_REMOVED / INPUT_FIELD_ADDED")],
    covers: ["gi:INPUT_FIELD_REMOVED", "gi:INPUT_FIELD_ADDED"],
    sdl: [
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String }",
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { query: String }",
    ],
    expect: [
      {
        at: ["queries/search/args/**/term", "components/inputObjects/SearchFilter/**/term"],
        action: "remove",
        type: breaking,
        mentions: F("term"),
      },
      {
        at: ["queries/search/args/**/query", "components/inputObjects/SearchFilter/**/query"],
        action: "add",
        type: nonBreaking,
        mentions: F("query"),
      },
    ],
  }),
  gql({
    id: "GQL-INP-026",
    // ISSUE-117 (fixed)
    title: "@oneOf added to an input type",
    before: "input SearchFilter { term: String tag: String }",
    after: "input SearchFilter @oneOf { term: String tag: String }",
    rationale: "operations that supply several fields (or none) fail validation once exactly one field is required",
    annotation: "names the input type (SearchFilter) and the @oneOf directive",
    sources: [
      gi("directive-usage.test.ts union-level directives added oneOf directive", "BREAKING"),
      giChange("directive-usage.ts addedSpecialDirective oneOf"),
    ],
    covers: ["gi:DIRECTIVE_USAGE_INPUT_OBJECT_ADDED"],
    sdl: [
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String tag: String }",
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter @oneOf { term: String tag: String }",
    ],
    expect: [{ at: SITES, action: "add", type: breaking, mentions: ["SearchFilter", "oneOf"] }],
  }),
  gql({
    id: "GQL-INP-027",
    // ISSUE-117 (fixed)
    title: "@oneOf removed from an input type",
    before: "input SearchFilter @oneOf { term: String tag: String }",
    after: "input SearchFilter { term: String tag: String }",
    rationale: "every operation valid under @oneOf (exactly one field) is still valid",
    annotation: "names the input type (SearchFilter) and the @oneOf directive",
    sources: [
      gi("directive-usage.test.ts union-level directives removed oneOf directive"),
      giChange("directive-usage.ts removedSpecialDirective oneOf"),
    ],
    covers: ["gi:DIRECTIVE_USAGE_INPUT_OBJECT_REMOVED"],
    sdl: [
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter @oneOf { term: String tag: String }",
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String tag: String }",
    ],
    expect: [{ at: SITES, action: "remove", type: nonBreaking, mentions: ["SearchFilter", "oneOf"] }],
  }),
  // POLICY-47 decided (DESIGN_PROPOSALS §12.8, TASK §3.0a): an input field with a default is optional for operations
  // whether or not it is non-null, so making it non-null only rejects an explicit `null`
  gql({
    id: "GQL-INP-028",
    // ISSUE-127 (fixed) (P8a)
    title: "input field with a default made non-null",
    before: "input SearchFilter { limit: Int = 10 }",
    after: "input SearchFilter { limit: Int! = 10 }",
    rationale:
      "operations that omit `limit` still get the default; only an explicit `null` is now rejected; POLICY-47 decided: non-breaking",
    annotation: "names the input type and the field (SearchFilter.limit)",
    sources: [
      asd("docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-47 (decided: non-breaking)"),
      { tool: "graphql-js", ref: "src/utilities/findBreakingChanges.ts FIELD_CHANGED_KIND", verdict: "BREAKING" },
    ],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED"],
    sdl: [inp("limit: Int = 10"), inp("limit: Int! = 10")],
    expect: [{ at: SITES, type: nonBreaking, mentions: F("limit") }],
  }),
]

runCases("graphql", "inputs", cases, import.meta.filename)
