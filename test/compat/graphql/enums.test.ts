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

const out = (values: string) =>
  `type Query { profile: User } type User { id: ID! color: Color } enum Color { ${values} }`
const inp = (values: string) => `type Query { search(color: Color): [String] } enum Color { ${values} }`
const both = (values: string) =>
  `type Query { profile(color: Color): User } type User { id: ID! color: Color } enum Color { ${values} }`
const V = (value: string) => ["Color", value]

const cases: CompatCase[] = [
  gql({
    id: "GQL-ENM-001",
    title: "enum value added to an output-only enum",
    before: "enum Color { RED BLUE } (returned by User.color)",
    after: "enum Color { RED BLUE GREEN }",
    rationale:
      "clients switching over the returned value may receive GREEN; no operation becomes invalid; POLICY-05: risky",
    annotation: "names the enum and the added value (Color.GREEN)",
    sources: [
      gi("enum.test.ts value added"),
      giChange("enum.ts ENUM_VALUE_ADDED"),
      ...suite("object-output-type-of-root-type", "add-enum-value-of-field-in-output-object-type", "risky"),
      ...suite("interface-output-type-of-root-type", "add-enum-value-of-field-in-output-interface", "risky"),
      ...suite("scalar-output-type-of-root-type", "add-enum-value-in-output-type", "risky"),
      asd("test/graphapi/classification.test.ts adding a value to an output enum is breaking"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should find all dangerous changes (EnumType1)",
      },
    ],
    covers: ["gi:ENUM_VALUE_ADDED", "gjs:VALUE_ADDED_TO_ENUM"],
    sdl: [out("RED BLUE"), out("RED BLUE GREEN")],
    expect: [{ at: "**", action: "add", type: risky, mentions: V("GREEN") }],
    // ISSUE-57 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-ENM-002",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value added to an input-only enum",
    before: "enum Color { RED BLUE } (argument of Query.search)",
    after: "enum Color { RED BLUE GREEN }",
    rationale:
      "the input domain widens; every operation valid before is still valid (graphql-inspector's DANGEROUS reason is about output enums)",
    annotation: "names the enum and the added value (Color.GREEN)",
    sources: [
      gi("enum.test.ts value added", "DANGEROUS"),
      ...suite("scalar-type-argument-of-root-type", "add-enum-value-in-enum-argument"),
      ...suite("input-type-argument-of-root-type", "add-enum-value-of-field-in-input-type-argument"),
      asd("test/graphapi/graphapi10.test.ts G10.17"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findDangerousChanges should detect if a value was added to an enum type",
        verdict: "DANGEROUS (VALUE_ADDED_TO_ENUM, regardless of usage)",
      },
    ],
    covers: ["gi:ENUM_VALUE_ADDED", "gjs:VALUE_ADDED_TO_ENUM"],
    sdl: [inp("RED BLUE"), inp("RED BLUE GREEN")],
    expect: [{ at: "**", action: "add", type: nonBreaking, mentions: V("GREEN") }],
  }),
  gql({
    id: "GQL-ENM-003",
    title: "enum value added to an enum used as input and output",
    before: "enum Color { RED BLUE } (argument and result)",
    after: "enum Color { RED BLUE GREEN }",
    rationale:
      "the output usage may surprise clients; a change is breaking if it is breaking in any usage; POLICY-05: risky",
    annotation: "names the enum and the added value (Color.GREEN)",
    sources: [gi("enum.test.ts value added"), bench("Q10", "risky"), asd("test/graphapi/graphapi10.test.ts G10.18")],
    covers: ["gi:ENUM_VALUE_ADDED"],
    sdl: [both("RED BLUE"), both("RED BLUE GREEN")],
    expect: [{ at: "**", action: "add", type: risky, mentions: V("GREEN") }],
    // ISSUE-57 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-ENM-004",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value removed from an output-only enum",
    before: "enum Color { RED BLUE GREEN } (returned by User.color)",
    after: "enum Color { RED BLUE }",
    rationale:
      "an output value that can no longer be returned breaks no client: output enum values cannot appear in operations (graphql-inspector and graphql-js report BREAKING regardless of usage)",
    annotation: "names the enum and the removed value (Color.GREEN)",
    sources: [
      gi("enum.test.ts value removed", "BREAKING"),
      ...suite("object-output-type-of-root-type", "remove-enum-value-of-field-in-output-object-type"),
      ...suite("interface-output-type-of-root-type", "remove-enum-value-of-field-in-output-interface"),
      ...suite("scalar-output-type-of-root-type", "remove-enum-value-in-output-type"),
      asd("test/graphapi/classification.test.ts removing a value from an output enum is non-breaking"),
      bench("Q9 (accepts non-breaking)"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a value was removed from an enum type",
        verdict: "BREAKING (VALUE_REMOVED_FROM_ENUM, regardless of usage)",
      },
    ],
    covers: ["gi:ENUM_VALUE_REMOVED", "gjs:VALUE_REMOVED_FROM_ENUM"],
    sdl: [out("RED BLUE GREEN"), out("RED BLUE")],
    expect: [{ at: "**", action: "remove", type: nonBreaking, mentions: V("GREEN") }],
  }),
  gql({
    id: "GQL-ENM-005",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value removed from an input-only enum",
    before: "enum Color { RED BLUE GREEN } (argument of Query.search)",
    after: "enum Color { RED BLUE }",
    rationale: "operations passing GREEN fail validation",
    annotation: "names the enum and the removed value (Color.GREEN)",
    sources: [
      gi("enum.test.ts value removed"),
      giChange("enum.ts ENUM_VALUE_REMOVED"),
      ...suite("scalar-type-argument-of-root-type", "remove-enum-value-in-enum-argument"),
      ...suite("input-type-argument-of-root-type", "remove-enum-value-of-field-in-input-type-argument"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (EnumTypeThatLosesAValue)",
      },
    ],
    covers: ["gi:ENUM_VALUE_REMOVED", "gjs:VALUE_REMOVED_FROM_ENUM"],
    sdl: [inp("RED BLUE GREEN"), inp("RED BLUE")],
    expect: [{ at: "**", action: "remove", type: breaking, mentions: V("GREEN") }],
  }),
  gql({
    id: "GQL-ENM-006",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value removed from an enum used as input and output",
    before: "enum Color { RED BLUE GREEN } (argument and result)",
    after: "enum Color { RED BLUE }",
    rationale: "operations passing GREEN as an argument fail validation",
    annotation: "names the enum and the removed value (Color.GREEN)",
    sources: [gi("enum.test.ts value removed"), bench("Q9")],
    covers: ["gi:ENUM_VALUE_REMOVED"],
    sdl: [both("RED BLUE GREEN"), both("RED BLUE")],
    expect: [{ at: "**", action: "remove", type: breaking, mentions: V("GREEN") }],
  }),
  gql({
    id: "GQL-ENM-007",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value added to an enum used by an input field",
    before: "input SearchFilter { color: Color } enum Color { RED BLUE }",
    after: "enum Color { RED BLUE GREEN }",
    rationale: "the input domain widens; every operation valid before is still valid",
    annotation: "names the enum and the added value (Color.GREEN)",
    sources: [...suite("input-type-argument-of-root-type", "add-enum-value-of-field-in-input-type-argument")],
    covers: ["gi:ENUM_VALUE_ADDED"],
    sdl: [
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { color: Color } enum Color { RED BLUE }",
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { color: Color } enum Color { RED BLUE GREEN }",
    ],
    expect: [{ at: "**", action: "add", type: nonBreaking, mentions: V("GREEN") }],
  }),
  gql({
    id: "GQL-ENM-008",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value removed from an enum used by an input field",
    before: "input SearchFilter { color: Color } enum Color { RED BLUE GREEN }",
    after: "enum Color { RED BLUE }",
    rationale: "operations passing GREEN in the filter fail validation",
    annotation: "names the enum and the removed value (Color.GREEN)",
    sources: [...suite("input-type-argument-of-root-type", "remove-enum-value-of-field-in-input-type-argument")],
    covers: ["gi:ENUM_VALUE_REMOVED"],
    sdl: [
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { color: Color } enum Color { RED BLUE GREEN }",
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { color: Color } enum Color { RED BLUE }",
    ],
    expect: [{ at: "**", action: "remove", type: breaking, mentions: V("GREEN") }],
  }),
  gql({
    id: "GQL-ENM-009",
    title: "enum value added to an enum returned in a list",
    before: "type User { colors: [Color!]! } enum Color { RED BLUE }",
    after: "enum Color { RED BLUE GREEN }",
    rationale: "clients switching over returned items may receive GREEN; POLICY-05: risky",
    annotation: "names the enum and the added value (Color.GREEN)",
    sources: [giChange("enum.ts ENUM_VALUE_ADDED")],
    covers: ["gi:ENUM_VALUE_ADDED"],
    sdl: [
      "type Query { profile: User } type User { id: ID! colors: [Color!]! } enum Color { RED BLUE }",
      "type Query { profile: User } type User { id: ID! colors: [Color!]! } enum Color { RED BLUE GREEN }",
    ],
    expect: [{ at: "**", action: "add", type: risky, mentions: V("GREEN") }],
    // ISSUE-57 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-ENM-010",
    title: "enum value added to an enum returned by an interface field",
    before: "interface Node { color: Color } enum Color { RED BLUE }",
    after: "enum Color { RED BLUE GREEN }",
    rationale: "clients switching over the returned value may receive GREEN; POLICY-05: risky",
    annotation: "names the enum and the added value (Color.GREEN)",
    sources: [...suite("interface-output-type-of-root-type", "add-enum-value-of-field-in-output-interface", "risky")],
    covers: ["gi:ENUM_VALUE_ADDED"],
    sdl: [
      "type Query { node: Node } interface Node { id: ID! color: Color } enum Color { RED BLUE }",
      "type Query { node: Node } interface Node { id: ID! color: Color } enum Color { RED BLUE GREEN }",
    ],
    expect: [{ at: "**", action: "add", type: risky, mentions: V("GREEN") }],
    // ISSUE-57 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  gql({
    id: "GQL-ENM-011",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value added to an enum used by an executable directive argument",
    before: "directive @format(case: Case) on FIELD enum Case { UPPER LOWER }",
    after: "enum Case { UPPER LOWER TITLE }",
    rationale: "operations write directive arguments: the input domain widens and every operation stays valid",
    annotation: "names the enum and the added value (Case.TITLE)",
    sources: [giChange("enum.ts ENUM_VALUE_ADDED", "DANGEROUS")],
    covers: ["gi:ENUM_VALUE_ADDED"],
    sdl: [
      "directive @format(case: Case) on FIELD type Query { a: String } enum Case { UPPER LOWER }",
      "directive @format(case: Case) on FIELD type Query { a: String } enum Case { UPPER LOWER TITLE }",
    ],
    expect: [{ at: "**", action: "add", type: nonBreaking, mentions: ["Case", "TITLE"] }],
  }),
  gql({
    id: "GQL-ENM-012",
    title: "enum values reordered (not a change)",
    before: "enum Color { RED BLUE GREEN }",
    after: "enum Color { GREEN RED BLUE }",
    rationale: "enum values are a set; order is not significant",
    annotation: "no diff",
    sources: [gi("union.test.ts same members but different order")],
    sdl: [both("RED BLUE GREEN"), both("GREEN RED BLUE")],
    expect: [],
  }),
  gql({
    id: "GQL-ENM-013",
    // ISSUE-57 (fixed) (P8a)
    title: "enum value renamed in an input-only enum",
    before: "enum Color { RED BLUE }",
    after: "enum Color { RED NAVY }",
    rationale: "operations passing BLUE fail validation; NAVY is an addition",
    annotation: "names the enum and both values (Color.BLUE removed, Color.NAVY added)",
    sources: [giChange("enum.ts ENUM_VALUE_REMOVED / ENUM_VALUE_ADDED")],
    covers: ["gi:ENUM_VALUE_REMOVED", "gi:ENUM_VALUE_ADDED"],
    sdl: [inp("RED BLUE"), inp("RED NAVY")],
    expect: [
      // an index-mapped enum array may report the rename as one replace of the value
      { at: "**", action: ["remove", "replace"], type: breaking, mentions: V("BLUE") },
      { at: "**", action: "add", type: nonBreaking, mentions: V("NAVY"), optional: true },
    ],
  }),
  gql({
    id: "GQL-ENM-014",
    // ISSUE-57 (fixed) (P8a)
    title: "value added to a newly added enum",
    before: "type User { id: ID! }",
    after: "type User { id: ID! color: Color } enum Color { RED }",
    rationale: "the enum is new; only the field and the type are additions",
    annotation: "names the added field (User.color) and the added enum (Color)",
    sources: [gi("enum.test.ts added")],
    covers: ["gi:TYPE_ADDED"],
    sdl: ["type Query { profile: User } type User { id: ID! }", out("RED")],
    expect: [
      {
        at: ["queries/profile/**/color", "components/objects/User/**/color"],
        action: "add",
        type: nonBreaking,
        mentions: ["User", "color"],
      },
      { at: "components/enums/Color", action: "add", type: nonBreaking, mentions: ["Color"] },
    ],
  }),
]

runCases("graphql", "enums", cases, import.meta.filename)
