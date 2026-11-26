import { annotation, breaking, deprecated, nonBreaking } from "../../../src"
import { type CaseSource, type CompatCase, type GraphqlCase, runCases } from "../../helpers/compat"

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

const QUERY = /quer(y|ies)/i

// POLICY-04 decided (a): removing a deprecated element is breaking like any removal (operations still using it fail
// validation; graphql-inspector BREAKING, graphql-js)

const user = (fields: string) => `type Query { profile: User } type User { id: ID! ${fields} }`
const color = (values: string) => `type Query { search(color: Color): [String] } enum Color { ${values} }`
const search = (args: string) => `type Query { search(${args}): [String] }`
const inp = (fields: string) =>
  `type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String ${fields} }`
const R = (reason: string) => `@deprecated(reason: "${reason}")`

// a description change on every kind of definition
const describe = (where: Record<string, string>) => {
  const d = (k: string) => (where[k] ? `"${where[k]}" ` : "")
  return [
    `${d("directive")}directive @limit(${d("directiveArg")}size: Int) on FIELD`,
    `${d("schema")}schema { query: Query }`,
    `${d("query")}type Query { ${d("rootField")}item(${d("arg")}filter: Filter): Item node: Node result: Result }`,
    `${d("scalar")}scalar Date`,
    `${d("object")}type Item implements Node { id: ID! ${d("field")}born: Date color: Color }`,
    `${d("interface")}interface Node { ${d("interfaceField")}id: ID! }`,
    `${d("union")}union Result = Item`,
    `${d("enum")}enum Color { ${d("value")}RED BLUE }`,
    `${d("input")}input Filter { ${d("inputField")}term: String }`,
  ].join("\n")
}

const descCase = (
  id: string,
  title: string,
  key: string,
  entity: string[],
  before: string | undefined,
  after: string | undefined,
  covers: string[],
  sources: CaseSource[],
): CompatCase =>
  gql({
    id,
    title,
    before: before === undefined ? "no description" : `"${before}"`,
    after: after === undefined ? "no description" : `"${after}"`,
    rationale: "descriptions are documentation; operations and responses are unchanged",
    annotation: `names the described element (${entity.join(".")}) and says that its description changed`,
    sources,
    covers,
    sdl: [
      describe(before === undefined ? {} : { [key]: before }),
      describe(after === undefined ? {} : { [key]: after }),
    ],
    expect: [
      {
        at: "**",
        // an emptied description is the same as no description
        action:
          before === undefined
            ? "add"
            : after === undefined
              ? "remove"
              : after === ""
                ? ["replace", "remove"]
                : "replace",
        type: annotation,
        mentions: [...entity, "description"],
      },
    ],
  })

const cases: CompatCase[] = [
  gql({
    id: "GQL-DEP-001",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "output field deprecated without a reason",
    before: "type User { age: Int }",
    after: "type User { age: Int @deprecated }",
    rationale: "deprecation announces a future removal; operations keep working",
    annotation: "names the type and the field (User.age) and says it is deprecated",
    sources: [
      gi("object.test.ts fields deprecation added / removed"),
      giChange("field.ts FIELD_DEPRECATION_ADDED", "NON_BREAKING"),
      ...suite("directives", "add-default-deprecated-directive-for-field-definition"),
    ],
    covers: ["gi:FIELD_DEPRECATION_ADDED", "gi:DIRECTIVE_USAGE_FIELD_DEFINITION_ADDED"],
    sdl: [user("age: Int"), user("age: Int @deprecated")],
    expect: [{ at: "**/age/**", action: "add", type: deprecated, mentions: ["User", "age", "deprecat"] }],
  }),
  gql({
    id: "GQL-DEP-002",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "output field deprecated with a reason",
    before: "type User { age: Int }",
    after: 'type User { age: Int @deprecated(reason: "use birthday") }',
    rationale: "deprecation announces a future removal; operations keep working",
    annotation: "names the type and the field (User.age) and says it is deprecated",
    sources: [
      gi("interface.test.ts deprecation added w/reason"),
      ...suite("directives", "add-deprecated-directive-with-reason-for-field-definition"),
      bench("Q13"),
    ],
    covers: ["gi:FIELD_DEPRECATION_ADDED"],
    sdl: [user("age: Int"), user(`age: Int ${R("use birthday")}`)],
    expect: [{ at: "**/age/**", action: "add", type: deprecated, mentions: ["User", "age", "deprecat"] }],
  }),
  gql({
    id: "GQL-DEP-003",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "output field deprecation removed",
    before: 'type User { age: Int @deprecated(reason: "use birthday") }',
    after: "type User { age: Int }",
    rationale: "the field stays; the removal announcement is withdrawn",
    annotation: "names the type and the field (User.age) and says the deprecation was removed",
    sources: [
      gi("object.test.ts fields deprecation added / removed"),
      giChange("field.ts FIELD_DEPRECATION_REMOVED", "NON_BREAKING"),
      ...suite("directives", "remove-deprecated-directive-with-reason-in-field-definition"),
      ...suite("directives", "remove-default-deprecated-directive-for-field-definition"),
    ],
    covers: ["gi:FIELD_DEPRECATION_REMOVED", "gi:DIRECTIVE_USAGE_FIELD_DEFINITION_REMOVED"],
    sdl: [user(`age: Int ${R("use birthday")}`), user("age: Int")],
    expect: [{ at: "**/age/**", action: "remove", type: deprecated, mentions: ["User", "age", "deprecat"] }],
  }),
  gql({
    id: "GQL-DEP-004",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "deprecation reason of an output field changed",
    before: '@deprecated(reason: "use birthday")',
    after: '@deprecated(reason: "use dateOfBirth")',
    rationale:
      "documentation of an existing deprecation (ASD convention: deprecation changes are `deprecated`; the fork reports an annotation)",
    annotation: "names the type and the field (User.age) and the deprecation reason",
    sources: [
      gi("object.test.ts fields deprecation reason changed / added / removed"),
      giChange("field.ts FIELD_DEPRECATION_REASON_CHANGED", "NON_BREAKING"),
      ...suite("directives", "update-reason-for-deprecated-directive-in-field-definition", "annotation"),
      asd("test/graphapi/classification.test.ts changing the deprecation reason is a deprecation"),
    ],
    covers: ["gi:FIELD_DEPRECATION_REASON_CHANGED"],
    sdl: [user(`age: Int ${R("use birthday")}`), user(`age: Int ${R("use dateOfBirth")}`)],
    expect: [{ at: "**/age/**", type: deprecated, mentions: ["User", "age", "reason"] }],
  }),
  gql({
    id: "GQL-DEP-005",
    // ISSUE-127 (fixed) (P8-rest); ISSUE-119 (fixed) for 1.0
    title: "deprecation reason added to a deprecated output field",
    before: "type User { age: Int @deprecated }",
    after: 'type User { age: Int @deprecated(reason: "use birthday") }',
    rationale: "documentation of an existing deprecation",
    annotation: "names the type and the field (User.age) and the deprecation reason",
    sources: [
      gi("object.test.ts fields deprecation reason changed / added / removed"),
      giChange("field.ts FIELD_DEPRECATION_REASON_ADDED", "NON_BREAKING"),
      ...suite("directives", "add-reason-of-deprecated-directive-in-field-definition", "annotation"),
    ],
    covers: ["gi:FIELD_DEPRECATION_REASON_ADDED"],
    sdl: [user("age: Int @deprecated"), user(`age: Int ${R("use birthday")}`)],
    expect: [{ at: "**/age/**", type: deprecated, mentions: ["User", "age", "reason"] }],
  }),
  gql({
    id: "GQL-DEP-006",
    // ISSUE-127 (fixed) (P8-rest); ISSUE-119 (fixed) for 1.0
    title: "deprecation reason removed from a deprecated output field",
    before: 'type User { age: Int @deprecated(reason: "use birthday") }',
    after: "type User { age: Int @deprecated }",
    rationale: "documentation of an existing deprecation",
    annotation: "names the type and the field (User.age) and the deprecation reason",
    sources: [
      gi("object.test.ts fields deprecation reason changed / added / removed"),
      giChange("field.ts FIELD_DEPRECATION_REASON_REMOVED", "NON_BREAKING"),
      ...suite("directives", "remove-reason-of-deprecated-directive-in-field-definition", "annotation"),
    ],
    covers: ["gi:FIELD_DEPRECATION_REASON_REMOVED"],
    sdl: [user(`age: Int ${R("use birthday")}`), user("age: Int @deprecated")],
    expect: [{ at: "**/age/**", type: deprecated, mentions: ["User", "age", "reason"] }],
  }),
  gql({
    id: "GQL-DEP-007",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "deprecation reason with escaped quotes changed",
    before: "@deprecated(reason: \"use 'birthday'\")",
    after: "@deprecated(reason: \"use 'dateOfBirth'\")",
    rationale: "documentation of an existing deprecation",
    annotation: "names the type and the field (User.age) and the deprecation reason",
    sources: [gi("enum.test.ts string escaping deprecation reason changed with escaped single quotes")],
    covers: ["gi:FIELD_DEPRECATION_REASON_CHANGED"],
    sdl: [user(`age: Int ${R("use 'birthday'")}`), user(`age: Int ${R("use 'dateOfBirth'")}`)],
    expect: [{ at: "**/age/**", type: deprecated, mentions: ["User", "age", "reason"] }],
  }),
  gql({
    id: "GQL-DEP-008",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "interface field deprecated",
    before: "interface Node { id: ID! }",
    after: 'interface Node { id: ID! @deprecated(reason: "use key") }',
    rationale: "deprecation announces a future removal; operations keep working",
    annotation: "names the interface and the field (Node.id) and says it is deprecated",
    sources: [gi("interface.test.ts deprecation added / removed")],
    covers: ["gi:FIELD_DEPRECATION_ADDED"],
    sdl: [
      "type Query { node: Node } interface Node { key: ID id: ID! }",
      `type Query { node: Node } interface Node { key: ID id: ID! ${R("use key")} }`,
    ],
    expect: [{ at: "**/id/**", action: "add", type: deprecated, mentions: ["Node", "id", "deprecat"] }],
  }),
  gql({
    id: "GQL-DEP-009",
    // ISSUE-127 (fixed) (P8-rest); ISSUE-119 (fixed) for 1.0
    title: "root query field deprecated",
    before: "type Query { me: String }",
    after: 'type Query { me: String @deprecated(reason: "use viewer") viewer: String }',
    rationale: "deprecation announces a future removal; the new field is an addition",
    annotation: "names the root field (Query.me) and says it is deprecated",
    sources: [asd("test/graphapi/classification.test.ts adding @deprecated is a deprecation")],
    covers: ["gi:FIELD_DEPRECATION_ADDED", "gi:FIELD_ADDED"],
    sdl: ["type Query { me: String }", `type Query { me: String ${R("use viewer")} viewer: String }`],
    expect: [
      { at: "queries/me/**", action: "add", type: deprecated, mentions: [QUERY, "me", "deprecat"] },
      { at: "queries/viewer", action: "add", type: nonBreaking, mentions: [QUERY, "viewer"] },
    ],
  }),
  gql({
    id: "GQL-DEP-010",
    // ISSUE-57 (fixed) (P8-rest); ISSUE-119 (fixed) for 1.0
    title: "enum value deprecated",
    before: "enum Color { RED BLUE }",
    after: 'enum Color { RED BLUE @deprecated(reason: "use NAVY") }',
    rationale: "deprecation announces a future removal; operations keep working",
    annotation: "names the enum and the value (Color.BLUE) and says it is deprecated",
    sources: [
      gi("enum.test.ts deprecation reason added"),
      giChange("enum.ts ENUM_VALUE_DEPRECATION_REASON_ADDED", "NON_BREAKING"),
      ...suite("directives", "add-deprecated-directive-with-reason-for-enum-value"),
      ...suite("directives", "add-default-deprecated-directive-for-enum-value"),
      asd("test/graphapi/classification.test.ts deprecating an enum value is a deprecation"),
    ],
    covers: ["gi:ENUM_VALUE_DEPRECATION_REASON_ADDED", "gi:DIRECTIVE_USAGE_ENUM_VALUE_ADDED"],
    sdl: [color("RED BLUE"), color(`RED BLUE ${R("use NAVY")}`)],
    expect: [{ at: "**/BLUE/**", action: "add", type: deprecated, mentions: ["Color", "BLUE", "deprecat"] }],
  }),
  gql({
    id: "GQL-DEP-011",
    // ISSUE-57 (fixed) (P8-rest); ISSUE-119 (fixed) for 1.0
    title: "enum value deprecation removed",
    before: 'enum Color { RED BLUE @deprecated(reason: "use NAVY") }',
    after: "enum Color { RED BLUE }",
    rationale: "the value stays; the removal announcement is withdrawn",
    annotation: "names the enum and the value (Color.BLUE) and says the deprecation was removed",
    sources: [
      gi("enum.test.ts deprecation reason removed"),
      giChange("enum.ts ENUM_VALUE_DEPRECATION_REASON_REMOVED", "NON_BREAKING"),
      ...suite("directives", "remove-deprecated-directive-with-reason-from-enum-value"),
      ...suite("directives", "remove-deprecated-directive-from-enum-value"),
    ],
    covers: ["gi:ENUM_VALUE_DEPRECATION_REASON_REMOVED", "gi:DIRECTIVE_USAGE_ENUM_VALUE_REMOVED"],
    sdl: [color(`RED BLUE ${R("use NAVY")}`), color("RED BLUE")],
    expect: [{ at: "**/BLUE/**", action: "remove", type: deprecated, mentions: ["Color", "BLUE", "deprecat"] }],
  }),
  gql({
    id: "GQL-DEP-012",
    // ISSUE-57 (fixed) (P8-rest); ISSUE-119 (fixed) for 1.0
    title: "enum value deprecation reason changed",
    before: '@deprecated(reason: "use NAVY")',
    after: '@deprecated(reason: "use INDIGO")',
    rationale: "documentation of an existing deprecation (the fork reports an annotation)",
    annotation: "names the enum and the value (Color.BLUE) and the deprecation reason",
    sources: [
      gi("enum.test.ts deprecation reason changed"),
      giChange("enum.ts ENUM_VALUE_DEPRECATION_REASON_CHANGED", "NON_BREAKING"),
      ...suite("directives", "update-reason-for-deprecated-directive", "annotation"),
      ...suite("directives", "add-reason-for-deprecated-directive", "annotation"),
      ...suite("directives", "remove-reason-for-deprecated-directive", "annotation"),
    ],
    covers: ["gi:ENUM_VALUE_DEPRECATION_REASON_CHANGED"],
    sdl: [color(`RED BLUE ${R("use NAVY")}`), color(`RED BLUE ${R("use INDIGO")}`)],
    expect: [{ at: "**/BLUE/**", type: deprecated, mentions: ["Color", "BLUE", "reason"] }],
  }),
  gql({
    id: "GQL-DEP-013",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "argument deprecated",
    before: "search(limit: Int)",
    after: 'search(limit: Int @deprecated(reason: "use first"), first: Int)',
    rationale: "deprecation announces a future removal; the new argument is an addition",
    annotation: "names the field and the argument (Query.search limit) and says it is deprecated",
    sources: [
      asd("test/graphapi/classification.test.ts deprecating an argument is a deprecation"),
      giChange("directive-usage.ts DIRECTIVE_USAGE_ARGUMENT_DEFINITION_ADDED (@deprecated)", "NON_BREAKING"),
      {
        tool: "graphql-schema-diff",
        ref: "src/__tests__/diff.test.ts getDiff input arg deprecation introspection sees deprecated input args when inputValueDeprecation specified",
      },
    ],
    covers: ["gi:DIRECTIVE_USAGE_ARGUMENT_DEFINITION_ADDED"],
    sdl: [search("limit: Int"), search(`limit: Int ${R("use first")}, first: Int`)],
    expect: [
      {
        at: "queries/search/args/**/limit/**",
        action: "add",
        type: deprecated,
        mentions: ["search", "limit", "deprecat"],
      },
      { at: "queries/search/args/**/first", action: "add", type: nonBreaking, mentions: ["search", "first"] },
    ],
  }),
  gql({
    id: "GQL-DEP-014",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    title: "input field deprecated",
    before: "input SearchFilter { term: String tag: String }",
    after: 'input SearchFilter { term: String tag: String @deprecated(reason: "use term") }',
    rationale: "deprecation announces a future removal; operations keep working",
    annotation: "names the input type and the field (SearchFilter.tag) and says it is deprecated",
    sources: [
      giChange("directive-usage.ts DIRECTIVE_USAGE_INPUT_FIELD_DEFINITION_ADDED (@deprecated)", "NON_BREAKING"),
    ],
    covers: ["gi:DIRECTIVE_USAGE_INPUT_FIELD_DEFINITION_ADDED"],
    sdl: [inp("tag: String"), inp(`tag: String ${R("use term")}`)],
    expect: [
      {
        at: ["queries/search/args/**/tag/**", "components/inputObjects/SearchFilter/**/tag/**"],
        action: "add",
        type: deprecated,
        mentions: ["SearchFilter", "tag", "deprecat"],
      },
    ],
  }),
  gql({
    id: "GQL-DEP-015",
    title: "deprecated output field removed",
    before: 'type User { age: Int @deprecated(reason: "use birthday") }',
    after: "type User { }",
    rationale:
      "operations still selecting the field fail validation; POLICY-04 (a): breaking regardless of the deprecation",
    annotation: "names the type and the removed field (User.age)",
    sources: [
      gi("object.test.ts fields removal of a deprecated field"),
      gi("rules/suppress-removal-of-deprecated-fields.test.ts", "DANGEROUS"),
    ],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [user(`age: Int ${R("use birthday")}`), user("")],
    expect: [{ at: "**/age", action: "remove", type: breaking, mentions: ["User", "age"] }],
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0; POLICY-04 decided (a)
  }),
  gql({
    id: "GQL-DEP-016",
    title: "deprecated enum value removed from an input-only enum",
    before: 'enum Color { RED BLUE @deprecated(reason: "use NAVY") }',
    after: "enum Color { RED }",
    rationale: "operations still passing BLUE fail validation; POLICY-04 (a): breaking regardless of the deprecation",
    annotation: "names the enum and the removed value (Color.BLUE)",
    sources: [gi("enum.test.ts removal of a deprecated field")],
    covers: ["gi:ENUM_VALUE_REMOVED"],
    sdl: [color(`RED BLUE ${R("use NAVY")}`), color("RED")],
    expect: [{ at: "**", action: "remove", type: breaking, mentions: ["Color", "BLUE"] }],
    // ISSUE-57 (fixed) (P8a); ISSUE-119 (fixed); POLICY-04 decided (a); 0.1.2 enum value description
  }),
  gql({
    id: "GQL-DEP-017",
    title: "deprecated input field removed",
    before: 'input SearchFilter { term: String tag: String @deprecated(reason: "use term") }',
    after: "input SearchFilter { term: String }",
    rationale:
      "operations still supplying `tag` fail validation; POLICY-04 (a): breaking regardless of the deprecation",
    annotation: "names the input type and the removed field (SearchFilter.tag)",
    sources: [gi("input.test.ts removal of a deprecated field")],
    covers: ["gi:INPUT_FIELD_REMOVED"],
    sdl: [inp(`tag: String ${R("use term")}`), inp("")],
    expect: [
      {
        at: ["queries/search/args/**", "components/inputObjects/SearchFilter/**"],
        action: "remove",
        type: breaking,
        mentions: ["SearchFilter", "tag"],
      },
    ],
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0; POLICY-04 decided (a)
  }),
  gql({
    id: "GQL-DEP-018",
    title: "deprecated argument removed",
    before: 'search(limit: Int @deprecated(reason: "use first"), first: Int)',
    after: "search(first: Int)",
    rationale:
      "operations still supplying `limit` fail validation; POLICY-04 (a): breaking regardless of the deprecation",
    annotation: "names the field and the removed argument (Query.search limit)",
    sources: [
      giChange("field.ts FIELD_ARGUMENT_REMOVED"),
      {
        tool: "graphql-schema-diff",
        ref: "src/__tests__/diff.test.ts getDiff input arg deprecation introspection misses deprecated input args fields by default",
        verdict: "ARG_REMOVED (introspection without inputValueDeprecation drops the deprecated argument)",
      },
    ],
    covers: ["gi:FIELD_ARGUMENT_REMOVED"],
    sdl: [search(`limit: Int ${R("use first")}, first: Int`), search("first: Int")],
    expect: [{ at: "queries/search/args/**", action: "remove", type: breaking, mentions: ["search", "limit"] }],
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0; POLICY-04 decided (a)
  }),
  descCase(
    "GQL-DSC-001",
    "object type description added",
    "object",
    ["Item"],
    undefined,
    "A thing",
    ["gi:TYPE_DESCRIPTION_ADDED", "gjs:DESCRIPTION_CHANGED"],
    [
      gi("object.test.ts fields description changed / added / removed"),
      giChange("type.ts TYPE_DESCRIPTION_ADDED"),
      ...suite("object-output-type-of-root-type", "add-description-for-output-object-type"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect a type changing description",
      },
    ],
  ),
  descCase(
    "GQL-DSC-002",
    "object type description changed",
    "object",
    ["Item"],
    "A thing",
    "An item",
    ["gi:TYPE_DESCRIPTION_CHANGED"],
    [
      giChange("type.ts TYPE_DESCRIPTION_CHANGED"),
      ...suite("object-output-type-of-root-type", "update-description-of-output-object-type"),
    ],
  ),
  descCase(
    "GQL-DSC-003",
    "object type description removed",
    "object",
    ["Item"],
    "A thing",
    undefined,
    ["gi:TYPE_DESCRIPTION_REMOVED"],
    [
      giChange("type.ts TYPE_DESCRIPTION_REMOVED"),
      ...suite("object-output-type-of-root-type", "delete-description-of-output-object-type"),
    ],
  ),
  descCase(
    "GQL-DSC-004",
    "interface description changed",
    "interface",
    ["Node"],
    "Has an id",
    "Identified by id",
    ["gi:TYPE_DESCRIPTION_CHANGED"],
    [
      ...suite("interface-output-type-of-root-type", "update-description-of-output-interface"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "update-description-for-interface-type",
        "no diff",
      ),
    ],
  ),
  descCase(
    "GQL-DSC-005",
    "interface description added",
    "interface",
    ["Node"],
    undefined,
    "Has an id",
    ["gi:TYPE_DESCRIPTION_ADDED"],
    [
      ...suite("interface-output-type-of-root-type", "add-description-for-output-interface"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "add-description-for-interface-type",
        "no diff",
      ),
    ],
  ),
  descCase(
    "GQL-DSC-006",
    "interface description removed",
    "interface",
    ["Node"],
    "Has an id",
    undefined,
    ["gi:TYPE_DESCRIPTION_REMOVED"],
    [
      ...suite("interface-output-type-of-root-type", "delete-description-of-output-interface"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "delete-description-for-interface-type",
        "no diff",
      ),
    ],
  ),
  descCase(
    "GQL-DSC-007",
    "union description changed",
    "union",
    ["Result"],
    "Any result",
    "Search results",
    ["gi:TYPE_DESCRIPTION_CHANGED"],
    [giChange("type.ts TYPE_DESCRIPTION_CHANGED")],
  ),
  descCase(
    "GQL-DSC-008",
    "enum description added",
    "enum",
    ["Color"],
    undefined,
    "Colors",
    ["gi:TYPE_DESCRIPTION_ADDED"],
    [...suite("scalar-type-argument-of-root-type", "add-description-for-enum-type")],
  ),
  descCase(
    "GQL-DSC-009",
    "enum description changed",
    "enum",
    ["Color"],
    "Colors",
    "Palette",
    ["gi:TYPE_DESCRIPTION_CHANGED"],
    [...suite("scalar-type-argument-of-root-type", "change-description-for-enum-type")],
  ),
  descCase(
    "GQL-DSC-010",
    "enum description removed",
    "enum",
    ["Color"],
    "Colors",
    undefined,
    ["gi:TYPE_DESCRIPTION_REMOVED"],
    [...suite("scalar-type-argument-of-root-type", "delete-description-for-enum-type")],
  ),
  descCase(
    "GQL-DSC-011",
    "input type description changed",
    "input",
    ["Filter"],
    "Filter",
    "Search filter",
    ["gi:TYPE_DESCRIPTION_CHANGED"],
    [giChange("type.ts TYPE_DESCRIPTION_CHANGED")],
  ),
  descCase(
    "GQL-DSC-012",
    "scalar description changed",
    "scalar",
    ["Date"],
    "A date",
    "An ISO date",
    ["gi:TYPE_DESCRIPTION_CHANGED"],
    [giChange("type.ts TYPE_DESCRIPTION_CHANGED")],
  ),
  descCase(
    "GQL-DSC-013",
    "object field description added",
    "field",
    ["Item", "born"],
    undefined,
    "Birth date",
    ["gi:FIELD_DESCRIPTION_ADDED", "gjs:DESCRIPTION_CHANGED"],
    [
      gi("object.test.ts fields description changed / added / removed"),
      giChange("field.ts FIELD_DESCRIPTION_ADDED"),
      ...suite("object-output-type-of-root-type", "add-description-for-field-of-output-object-type"),
      ...suite("union-output-type-of-root-type", "add-field-description-in-object-type-from-union-type"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect a field changing description",
      },
    ],
  ),
  descCase(
    "GQL-DSC-014",
    "object field description changed",
    "field",
    ["Item", "born"],
    "Birth date",
    "Date of birth",
    ["gi:FIELD_DESCRIPTION_CHANGED"],
    [
      giChange("field.ts FIELD_DESCRIPTION_CHANGED"),
      ...suite("object-output-type-of-root-type", "update-description-for-field-of-output-object-type"),
      ...suite("union-output-type-of-root-type", "update-field-description-in-object-type-from-union-type"),
      bench("Q14"),
    ],
  ),
  descCase(
    "GQL-DSC-015",
    "object field description removed",
    "field",
    ["Item", "born"],
    "Birth date",
    undefined,
    ["gi:FIELD_DESCRIPTION_REMOVED"],
    [
      giChange("field.ts FIELD_DESCRIPTION_REMOVED"),
      ...suite("object-output-type-of-root-type", "delete-description-for-field-of-output-object-type"),
      ...suite("union-output-type-of-root-type", "delete-field-description-in-object-type-from-union-type"),
    ],
  ),
  descCase(
    "GQL-DSC-016",
    "object field description emptied",
    "field",
    ["Item", "born"],
    " some text ",
    "",
    ["gi:FIELD_DESCRIPTION_CHANGED"],
    [bench("R3 (re-authored on a reachable type)")],
  ),
  descCase(
    "GQL-DSC-017",
    "interface field description changed",
    "interfaceField",
    ["Node", "id"],
    "The id",
    "Global id",
    ["gi:FIELD_DESCRIPTION_CHANGED"],
    [
      gi("interface.test.ts description changed / added / removed"),
      ...suite("interface-output-type-of-root-type", "update-description-for-field-of-output-interface"),
      ...suite("interface-output-type-of-root-type", "add-description-for-field-of-output-interface"),
      ...suite("interface-output-type-of-root-type", "delete-description-for-field-of-output-interface"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "update-description-for-field-of-interface-type",
        "no diff",
      ),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "add-description-for-field-of-interface-type",
        "no diff",
      ),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "delete-description-for-field-of-interface-type",
        "no diff",
      ),
    ],
  ),
  descCase(
    "GQL-DSC-018",
    "root field description changed",
    "rootField",
    ["item"],
    "Find one",
    "Find an item",
    ["gi:FIELD_DESCRIPTION_CHANGED"],
    [asd("test/graphapi/classification.test.ts changing the description is an annotation")],
  ),
  descCase(
    "GQL-DSC-019",
    "argument description added",
    "arg",
    ["item", "filter"],
    undefined,
    "Narrows the result",
    ["gi:FIELD_ARGUMENT_DESCRIPTION_CHANGED", "gjs:DESCRIPTION_CHANGED"],
    [
      ...suite("scalar-type-argument-of-root-type", "add-description-for-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if an arg value changes description",
      },
    ],
  ),
  descCase(
    "GQL-DSC-020",
    "argument description changed",
    "arg",
    ["item", "filter"],
    "Narrows the result",
    "Filters the result",
    ["gi:FIELD_ARGUMENT_DESCRIPTION_CHANGED"],
    [
      giChange("argument.ts FIELD_ARGUMENT_DESCRIPTION_CHANGED"),
      ...suite("scalar-type-argument-of-root-type", "update-description-of-argument"),
      asd("test/graphapi/classification.test.ts changing an argument description is an annotation"),
    ],
  ),
  descCase(
    "GQL-DSC-021",
    "argument description removed",
    "arg",
    ["item", "filter"],
    "Narrows the result",
    undefined,
    ["gi:FIELD_ARGUMENT_DESCRIPTION_CHANGED"],
    [...suite("scalar-type-argument-of-root-type", "delete-description-of-argument")],
  ),
  descCase(
    "GQL-DSC-022",
    "input field description added",
    "inputField",
    ["Filter", "term"],
    undefined,
    "Search term",
    ["gi:INPUT_FIELD_DESCRIPTION_ADDED", "gjs:DESCRIPTION_CHANGED"],
    [
      gi("input.test.ts description changed / added / removed"),
      giChange("input.ts INPUT_FIELD_DESCRIPTION_ADDED"),
      ...suite("input-type-argument-of-root-type", "add-description-for-field-of-input-type-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if an input field changes description",
      },
    ],
  ),
  descCase(
    "GQL-DSC-023",
    "input field description changed",
    "inputField",
    ["Filter", "term"],
    "Search term",
    "Full-text term",
    ["gi:INPUT_FIELD_DESCRIPTION_CHANGED"],
    [
      giChange("input.ts INPUT_FIELD_DESCRIPTION_CHANGED"),
      ...suite("input-type-argument-of-root-type", "update-description-for-field-of-input-type-argument"),
    ],
  ),
  descCase(
    "GQL-DSC-024",
    "input field description removed",
    "inputField",
    ["Filter", "term"],
    "Search term",
    undefined,
    ["gi:INPUT_FIELD_DESCRIPTION_REMOVED"],
    [
      giChange("input.ts INPUT_FIELD_DESCRIPTION_REMOVED"),
      ...suite("input-type-argument-of-root-type", "delete-description-for-field-of-input-type-argument"),
    ],
  ),
  descCase(
    "GQL-DSC-025",
    "enum value description added",
    "value",
    ["Color", "RED"],
    undefined,
    "Warm",
    ["gi:ENUM_VALUE_DESCRIPTION_CHANGED", "gjs:DESCRIPTION_CHANGED"],
    [
      ...suite("scalar-type-argument-of-root-type", "add-description-for-enum-value"),
      ...suite("scalar-output-type-of-root-type", "add-description-for-enum-value-in-output-type"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if an enum member changes description",
      },
    ],
  ),
  descCase(
    "GQL-DSC-026",
    "enum value description changed",
    "value",
    ["Color", "RED"],
    "Warm",
    "Warm color",
    ["gi:ENUM_VALUE_DESCRIPTION_CHANGED"],
    [
      gi("enum.test.ts description changed"),
      giChange("enum.ts ENUM_VALUE_DESCRIPTION_CHANGED"),
      ...suite("scalar-type-argument-of-root-type", "change-description-for-enum-value"),
      ...suite("scalar-output-type-of-root-type", "change-description-for-enum-value-in-output-type"),
    ],
  ),
  descCase(
    "GQL-DSC-027",
    "enum value description removed",
    "value",
    ["Color", "RED"],
    "Warm",
    undefined,
    ["gi:ENUM_VALUE_DESCRIPTION_CHANGED"],
    [
      ...suite("scalar-type-argument-of-root-type", "delete-description-for-enum-value"),
      ...suite("scalar-output-type-of-root-type", "delete-description-for-enum-value-in-output-type"),
    ],
  ),
  descCase(
    "GQL-DSC-028",
    "schema description added",
    "schema",
    ["schema"],
    undefined,
    "The API",
    [],
    [gi("schema.test.ts huge test")],
  ),
  descCase(
    "GQL-DSC-029",
    "schema description changed",
    "schema",
    ["schema"],
    "The API",
    "The public API",
    [],
    [gi("schema.test.ts huge test")],
  ),
  descCase(
    "GQL-DSC-030",
    "query root type description added",
    "query",
    ["Query"],
    undefined,
    "Entry points",
    ["gi:TYPE_DESCRIPTION_ADDED"],
    [...suite("root-type-general", "add-description-for-root-type")],
  ),
  descCase(
    "GQL-DSC-031",
    "query root type description changed",
    "query",
    ["Query"],
    "Entry points",
    "Read entry points",
    ["gi:TYPE_DESCRIPTION_CHANGED"],
    [...suite("root-type-general", "change-description-for-root-type")],
  ),
  descCase(
    "GQL-DSC-032",
    "query root type description removed",
    "query",
    ["Query"],
    "Entry points",
    undefined,
    ["gi:TYPE_DESCRIPTION_REMOVED"],
    [...suite("root-type-general", "delete-description-for-root-type")],
  ),
  descCase(
    "GQL-DSC-033",
    "directive description added",
    "directive",
    ["limit"],
    undefined,
    "Limits a list",
    ["gi:DIRECTIVE_DESCRIPTION_CHANGED", "gjs:DESCRIPTION_CHANGED"],
    [
      gi("directive.test.ts description"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a directive changes description",
      },
    ],
  ),
  descCase(
    "GQL-DSC-034",
    "directive argument description removed",
    "directiveArg",
    ["limit", "size"],
    "max items",
    undefined,
    ["gi:DIRECTIVE_ARGUMENT_DESCRIPTION_CHANGED"],
    [gi("directive.test.ts arguments changed")],
  ),
  gql({
    id: "GQL-DSC-035",
    title: "description written as a block string instead of a plain string (not a change)",
    before: '"A thing" type Item',
    after: '"""A thing""" type Item',
    rationale: "both literals denote the same description",
    annotation: "no diff",
    sources: [gi("schema.test.ts same schema")],
    sdl: [describe({ object: "A thing" }), describe({}).replace("type Item", '"""A thing""" type Item')],
    expect: [],
  }),
]

// known 2.0.0 defects of the generated cases (one ISSUE-X id per root cause)
const generatedIssues: Record<string, CompatCase["issue"]> = {
  // "GQL-DSC-001": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-002": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-003": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-004": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-005": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-006": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-007": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-008": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-009": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-010": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-011": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-012": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-013": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-014": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-015": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-016": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-017": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-018": ISSUE-127 (fixed) (P8-rest)
  // "GQL-DSC-022": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-023": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-024": ISSUE-127 (fixed) (P8a)
  // "GQL-DSC-025": ISSUE-57 (fixed) (P8-rest)
  // "GQL-DSC-026": ISSUE-57 (fixed) (P8-rest)
  // "GQL-DSC-027": ISSUE-57 (fixed) (P8-rest)
  // "GQL-DSC-028": ISSUE-129 (fixed) (P8-rest)
  // "GQL-DSC-029": ISSUE-129 (fixed) (P8-rest)
  // "GQL-DSC-030": ISSUE-129: root type rules and descriptions (P7, gqlapi 0.6 rootTypes)
  // "GQL-DSC-031": ISSUE-129: root type rules and descriptions (P7, gqlapi 0.6 rootTypes)
  // "GQL-DSC-032": ISSUE-129: root type rules and descriptions (P7, gqlapi 0.6 rootTypes)
}
for (const c of cases) c.issue = generatedIssues[c.id] ?? c.issue

runCases("graphql", "deprecation-descriptions", cases, import.meta.filename)
