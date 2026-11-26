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
const bench = (ref: string, verdict?: string): CaseSource => ({
  tool: "bench",
  ref: `bench/fixtures/graphql.js ${ref}`,
  ...(verdict ? { verdict } : {}),
})

const QUERY = /quer(y|ies)/i

// POLICY-02 decided (a) (decision §11.16): types unreachable from the root operation types are classified as if
// reachable: output semantics for object, interface and union types, argument semantics for input types, both for enums
// and scalars; decision §11.4 (unreferenced components unclassified) does not apply to GraphQL types

// Region is defined but no root field reaches it
const unreachable = (body: string) => `type Query { me: String } ${body}`

const cases: CompatCase[] = [
  gql({
    id: "GQL-RCH-001",
    title: "unreachable object type added",
    before: "type Query { me: String }",
    after: "type Query { me: String } type BenchNewType { benchNewTypeField: String }",
    rationale: "a new type no operation can reach yet; POLICY-02 (a): an added type is non-breaking",
    annotation: "names the added type (BenchNewType)",
    sources: [
      bench("Q18 (optional)"),
      giChange("type.ts TYPE_ADDED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a type was added",
      },
    ],
    covers: ["gi:TYPE_ADDED", "gjs:TYPE_ADDED"],
    sdl: [unreachable(""), unreachable("type BenchNewType { benchNewTypeField: String }")],
    expect: [{ at: "components/objects/BenchNewType", action: "add", type: nonBreaking, mentions: ["BenchNewType"] }],
  }),
  gql({
    id: "GQL-RCH-002",
    title: "unreachable object type removed",
    before: "type Query { me: String } type Region { name: String }",
    after: "type Query { me: String }",
    rationale:
      "fragments on Region in operation documents fail validation even though no root field returns it; POLICY-02 (a)",
    annotation: "names the removed type (Region)",
    sources: [
      giChange("type.ts TYPE_REMOVED"),
      gi("rules/safe-unreachable.test.ts removed type", "NON_BREAKING with safeUnreachable"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a type was removed or not",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (TypeThatGetsRemoved)",
      },
    ],
    covers: ["gi:TYPE_REMOVED", "gjs:TYPE_REMOVED"],
    sdl: [unreachable("type Region { name: String }"), unreachable("")],
    expect: [{ at: "components/objects/Region", action: "remove", type: breaking, mentions: ["Region"] }],
  }),
  gql({
    id: "GQL-RCH-003",
    title: "field added to an unreachable object type",
    before: "type Region { name: String }",
    after: "type Region { name: String code: ID }",
    rationale: "POLICY-02 (a): output semantics, an added field is non-breaking",
    annotation: "names the type and the added field (Region.code)",
    sources: [giChange("field.ts FIELD_ADDED")],
    covers: ["gi:FIELD_ADDED"],
    sdl: [unreachable("type Region { name: String }"), unreachable("type Region { name: String code: ID }")],
    expect: [{ at: "components/objects/Region/**", action: "add", type: nonBreaking, mentions: ["Region", "code"] }],
  }),
  gql({
    id: "GQL-RCH-004",
    title: "field removed from an unreachable object type",
    before: "type Region { name: String code: ID }",
    after: "type Region { name: String }",
    rationale: "POLICY-02 (a): output semantics, a removed field is breaking",
    annotation: "names the type and the removed field (Region.code)",
    sources: [
      giChange("field.ts FIELD_REMOVED"),
      gi("rules/safe-unreachable.test.ts removed field", "NON_BREAKING with safeUnreachable"),
    ],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [unreachable("type Region { name: String code: ID }"), unreachable("type Region { name: String }")],
    expect: [{ at: "components/objects/Region/**", action: "remove", type: breaking, mentions: ["Region", "code"] }],
  }),
  gql({
    id: "GQL-RCH-005",
    title: "list field of an unreachable type made nullable ([Continent]! to [Continent])",
    before: "type Query2 { continents: [Continent]! }",
    after: "type Query2 { continents: [Continent] }",
    rationale: "Query2 is not the query root; POLICY-02 (a): output semantics, a nullable result is breaking",
    annotation: "names the type and the field (Query2.continents)",
    sources: [bench("R1")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      unreachable("type Query2 { continents: [Continent]! } type Continent { code: ID }"),
      unreachable("type Query2 { continents: [Continent] } type Continent { code: ID }"),
    ],
    expect: [{ at: "components/objects/Query2/**", type: breaking, mentions: ["Query2", "continents"] }],
  }),
  gql({
    id: "GQL-RCH-006",
    title: "ID field of an unreachable type changed to String",
    before: "type Country { code: ID } (reached only from the unreachable Query2)",
    after: "type Country { code: String }",
    rationale: "POLICY-02 (a): output semantics, a nominal scalar change is breaking",
    annotation: "names the type and the field (Country.code)",
    sources: [bench("R2"), bench("R4")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      unreachable("type Query2 { country: Country } type Country { name: String code: ID }"),
      unreachable("type Query2 { country: Country } type Country { name: String code: String }"),
    ],
    expect: [{ at: "components/objects/Country/**", type: breaking, mentions: ["Country", "code"] }],
  }),
  gql({
    id: "GQL-RCH-007",
    title: "field description of an unreachable type changed",
    before: '"""some text""" states: [State]',
    after: '"""other text""" states: [State]',
    rationale: "descriptions are documentation whatever the reachability; under (a) and (c) an annotation",
    annotation: "names the type and the field (Country.states) and the description",
    sources: [bench("R3")],
    covers: ["gi:FIELD_DESCRIPTION_CHANGED"],
    sdl: [
      unreachable('type Country { """some text""" states: [String] }'),
      unreachable('type Country { """other text""" states: [String] }'),
    ],
    expect: [{ at: "components/objects/Country/**", type: annotation, mentions: ["Country", "states", "description"] }],
  }),
  gql({
    id: "GQL-RCH-008",
    title: "required field added to an unreachable input type",
    before: "input RegionFilter { name: String }",
    after: "input RegionFilter { name: String code: ID! }",
    rationale: "POLICY-02 (a): argument semantics, a required input field is breaking",
    annotation: "names the input type and the added field (RegionFilter.code)",
    sources: [giChange("input.ts INPUT_FIELD_ADDED")],
    covers: ["gi:INPUT_FIELD_ADDED"],
    sdl: [
      unreachable("input RegionFilter { name: String }"),
      unreachable("input RegionFilter { name: String code: ID! }"),
    ],
    expect: [
      {
        at: "components/inputObjects/RegionFilter/**",
        action: "add",
        type: breaking,
        mentions: ["RegionFilter", "code"],
      },
    ],
  }),
  gql({
    id: "GQL-RCH-009",
    title: "optional field added to an unreachable input type",
    before: "input RegionFilter { name: String }",
    after: "input RegionFilter { name: String code: ID }",
    rationale: "POLICY-02 (a): argument semantics, an optional input field is non-breaking",
    annotation: "names the input type and the added field (RegionFilter.code)",
    sources: [giChange("input.ts INPUT_FIELD_ADDED")],
    covers: ["gi:INPUT_FIELD_ADDED"],
    sdl: [
      unreachable("input RegionFilter { name: String }"),
      unreachable("input RegionFilter { name: String code: ID }"),
    ],
    expect: [
      {
        at: "components/inputObjects/RegionFilter/**",
        action: "add",
        type: nonBreaking,
        mentions: ["RegionFilter", "code"],
      },
    ],
  }),
  gql({
    id: "GQL-RCH-010",
    title: "enum value removed from an unreachable enum",
    before: "enum Continent { EUROPE ASIA }",
    after: "enum Continent { EUROPE }",
    rationale:
      "POLICY-02 (a): an enum that may be used in either direction is breaking if breaking in any (input semantics)",
    annotation: "names the enum and the removed value (Continent.ASIA)",
    sources: [
      giChange("enum.ts ENUM_VALUE_REMOVED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a value was removed from an enum type",
      },
    ],
    covers: ["gi:ENUM_VALUE_REMOVED", "gjs:VALUE_REMOVED_FROM_ENUM"],
    sdl: [unreachable("enum Continent { EUROPE ASIA }"), unreachable("enum Continent { EUROPE }")],
    expect: [
      { at: "components/enums/Continent/**", action: "remove", type: breaking, mentions: ["Continent", "ASIA"] },
    ],
  }),
  gql({
    id: "GQL-RCH-011",
    title: "unreachable custom scalar added",
    before: "type Query { me: String }",
    after: "type Query { me: String } scalar JSON",
    rationale: "a new type; POLICY-02 (a): non-breaking",
    annotation: "names the added scalar (JSON)",
    sources: [giChange("type.ts TYPE_ADDED")],
    covers: ["gi:TYPE_ADDED"],
    sdl: [unreachable(""), unreachable("scalar JSON")],
    expect: [{ at: "components/scalars/JSON", action: "add", type: nonBreaking, mentions: ["JSON"] }],
  }),
  gql({
    id: "GQL-RCH-012",
    title: "unreachable custom scalar removed",
    before: "type Query { me: String } scalar JSON",
    after: "type Query { me: String }",
    rationale: "operations declaring variables `$v: JSON` fail validation; POLICY-02 (a): breaking",
    annotation: "names the removed scalar (JSON)",
    sources: [
      gi("rules/safe-unreachable.test.ts removed scalar", "NON_BREAKING with safeUnreachable"),
      giChange("type.ts TYPE_REMOVED"),
    ],
    covers: ["gi:TYPE_REMOVED"],
    sdl: [unreachable("scalar JSON"), unreachable("")],
    expect: [{ at: "components/scalars/JSON", action: "remove", type: breaking, mentions: ["JSON"] }],
  }),
  gql({
    id: "GQL-RCH-013",
    title: "member added to an unreachable union",
    before: "union Place = City",
    after: "union Place = City | Town",
    rationale:
      "POLICY-02 (a): output semantics as for a reachable union; a member added on the output side is risky (POLICY-05 (b))",
    annotation: "names the union and the added member (Place, Town)",
    sources: [
      giChange("union.ts UNION_MEMBER_ADDED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a type was added to a union type",
      },
    ],
    covers: ["gi:UNION_MEMBER_ADDED", "gjs:TYPE_ADDED_TO_UNION"],
    sdl: [
      unreachable("union Place = City type City { name: String } type Town { name: String }"),
      unreachable("union Place = City | Town type City { name: String } type Town { name: String }"),
    ],
    expect: [
      { at: "components/unions/Place/**", action: "add", type: risky, mentions: ["Place", "Town"] },
      { at: "components/objects/Town", action: "add", type: nonBreaking, mentions: ["Town"], optional: true },
    ],
  }),
  gql({
    id: "GQL-RCH-014",
    // ISSUE-127 (fixed) (P8a)
    title: "type becomes unreachable when the only field returning it is removed",
    before: "type Query { me: String region: Region } type Region { name: String }",
    after: "type Query { me: String } type Region { name: String }",
    rationale: "the removed root field is breaking; the type itself is unchanged",
    annotation: "names the removed root field (Query.region)",
    sources: [giChange("field.ts FIELD_REMOVED")],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [
      "type Query { me: String region: Region } type Region { name: String }",
      "type Query { me: String } type Region { name: String }",
    ],
    expect: [{ at: "queries/region", action: "remove", type: breaking, mentions: [QUERY, "region"] }],
  }),
  gql({
    id: "GQL-RCH-015",
    // ISSUE-127 (fixed) (P8a)
    title: "unreachable type becomes reachable through a new root field",
    before: "type Query { me: String } type Region { name: String }",
    after: "type Query { me: String region: Region } type Region { name: String }",
    rationale: "a new root field; the type itself is unchanged",
    annotation: "names the added root field (Query.region)",
    sources: [giChange("field.ts FIELD_ADDED")],
    covers: ["gi:FIELD_ADDED"],
    sdl: [
      "type Query { me: String } type Region { name: String }",
      "type Query { me: String region: Region } type Region { name: String }",
    ],
    expect: [
      { at: "queries/region", action: "add", type: nonBreaking, mentions: [QUERY, "region"] },
      { at: "components/objects/Region", action: "add", type: nonBreaking, mentions: ["Region"], optional: true },
    ],
  }),
]

for (const c of cases) {
  // the last two cases change reachability through a root field and do not depend on POLICY-02
  if (c.id === "GQL-RCH-014" || c.id === "GQL-RCH-015") continue
  // GQL-RCH-013 also needed the `risky` class (ISSUE-130, fixed in P1)
  // ISSUE-132 (fixed) (P8a): POLICY-02 decided (a); ISSUE-127 / ISSUE-57 (fixed) (P8a)
  c.issue = undefined
}

runCases("graphql", "reachability", cases, import.meta.filename)
