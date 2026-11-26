import { annotation, breaking, nonBreaking } from "../../../src"
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
const fork = (ref: string, verdict?: string): CaseSource => ({ tool: "fork", ref, ...(verdict ? { verdict } : {}) })
const bench = (ref: string, verdict?: string): CaseSource => ({
  tool: "bench",
  ref: `bench/fixtures/graphql.js ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string): CaseSource => ({ tool: "asd", ref })

const QUERY = /quer(y|ies)/i

const user = (fields: string) => `type Query { profile: User } type User { id: ID! ${fields} }`
const node = (fields: string) =>
  `type Query { node: Node } interface Node { id: ID! ${fields} } type Item implements Node { id: ID! ${fields} }`
const union = (photo: string) =>
  `type Query { search: [SearchResult] } union SearchResult = Photo | Video type Photo { url: String ${photo} } type Video { url: String }`

const cases: CompatCase[] = [
  gql({
    id: "GQL-FLD-001",
    // ISSUE-127 (fixed) (P8a)
    title: "output field removed",
    before: "type User { id: ID! age: Int }",
    after: "type User { id: ID! }",
    rationale: "queries selecting User.age fail validation",
    annotation: "names the type and the removed field (User.age)",
    sources: [
      giChange("field.ts FIELD_REMOVED"),
      gi("object.test.ts fields removed"),
      ...suite("object-output-type-of-root-type", "remove-field-from-output-object-type"),
      bench("Q1"),
    ],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [user("age: Int"), user("")],
    expect: [{ at: "**/age", action: "remove", type: breaking, mentions: ["User", "age"] }],
  }),
  gql({
    id: "GQL-FLD-002",
    // ISSUE-127 (fixed) (P8a)
    title: "output field added",
    before: "type User { id: ID! }",
    after: "type User { id: ID! age: Int }",
    rationale: "a new output field is only returned when a client selects it; existing queries are unaffected",
    annotation: "names the type and the added field (User.age)",
    sources: [
      giChange("field.ts FIELD_ADDED"),
      gi("object.test.ts fields added"),
      ...suite("object-output-type-of-root-type", "add-new-field-in-output-object-type"),
      bench("Q2"),
    ],
    covers: ["gi:FIELD_ADDED"],
    sdl: [user(""), user("age: Int")],
    expect: [{ at: "**/age", action: "add", type: nonBreaking, mentions: ["User", "age"] }],
  }),
  gql({
    id: "GQL-FLD-003",
    // ISSUE-127 (fixed) (P8a)
    title: "output field nullable to non-null",
    before: "type User { name: String }",
    after: "type User { name: String! }",
    rationale: "a non-null result is a subset of the nullable results a client already handles",
    annotation: "names the type and the field (User.name) and the nullability change",
    sources: [
      gi("object.test.ts fields type changed"),
      gi("schema.test.ts Query fields becoming non-nullable is a non-breaking change"),
      ...suite("object-output-type-of-root-type", "mark-optional-field-of-output-object-type-as-mandatory"),
      bench("Q5"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field8)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND_SAFE"],
    sdl: [user("name: String"), user("name: String!")],
    expect: [{ at: "**/name/**", type: nonBreaking, mentions: ["User", "name"] }],
  }),
  gql({
    id: "GQL-FLD-004",
    // ISSUE-127 (fixed) (P8a)
    title: "output field non-null to nullable",
    before: "type User { name: String! }",
    after: "type User { name: String }",
    rationale: "clients that rely on the non-null guarantee receive null",
    annotation: "names the type and the field (User.name) and the nullability change",
    sources: [
      gi("schema.test.ts Query fields becoming nullable is a breaking change"),
      ...suite("object-output-type-of-root-type", "mark-mandatory-field-of-output-object-type-as-optional"),
      bench("Q6"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field9)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [user("name: String!"), user("name: String")],
    expect: [{ at: "**/name/**", type: breaking, mentions: ["User", "name"] }],
  }),
  gql({
    id: "GQL-FLD-005",
    // ISSUE-127 (fixed) (P8a)
    title: "output field scalar String to Int",
    before: "type User { code: String }",
    after: "type User { code: Int }",
    rationale: "clients parsing a string receive a number",
    annotation: "names the type and the field (User.code) and the type change",
    sources: [
      gi("object.test.ts fields type changed"),
      ...suite("object-output-type-of-root-type", "change-field-type-of-output-object-type"),
      ...suite("scalar-output-type-of-root-type", "change-output-type"),
      bench("Q17"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [user("code: String"), user("code: Int")],
    expect: [{ at: "**/code/**", type: breaking, mentions: ["User", "code"] }],
  }),
  gql({
    id: "GQL-FLD-006",
    // ISSUE-127 (fixed) (P8a)
    title: "output field scalar String to ID",
    before: "type User { code: String }",
    after: "type User { code: ID }",
    rationale:
      "GraphQL types are nominal: a client typed against String now receives the ID scalar (findBreakingChanges FIELD_CHANGED_KIND)",
    annotation: "names the type and the field (User.code) and the type change",
    sources: [giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [user("code: String"), user("code: ID")],
    expect: [{ at: "**/code/**", type: breaking, mentions: ["User", "code"] }],
  }),
  gql({
    id: "GQL-FLD-007",
    // ISSUE-127 (fixed) (P8a)
    title: "output field scalar ID to String",
    before: "type Country { code: ID }",
    after: "type Country { code: String }",
    rationale: "a nominal scalar change of a selected field; generated clients typed against ID break",
    annotation: "names the type and the field (Country.code) and the type change",
    sources: [bench("R2 / R4 (re-authored on a reachable type)"), giChange("field.ts FIELD_TYPE_CHANGED")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      "type Query { country: Country } type Country { name: String code: ID }",
      "type Query { country: Country } type Country { name: String code: String }",
    ],
    expect: [{ at: "**/code/**", type: breaking, mentions: ["Country", "code"] }],
  }),
  gql({
    id: "GQL-FLD-008",
    // ISSUE-127 (fixed) (P8a)
    title: "output field scalar Int to Float",
    before: "type User { score: Int }",
    after: "type User { score: Float }",
    rationale: "clients expecting integers may receive fractional numbers",
    annotation: "names the type and the field (User.score) and the type change",
    sources: [giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [user("score: Int"), user("score: Float")],
    expect: [{ at: "**/score/**", type: breaking, mentions: ["User", "score"] }],
  }),
  gql({
    id: "GQL-FLD-009",
    // ISSUE-127 (fixed) (P8a)
    title: "output field named type swapped T to U (structurally identical)",
    before: "type User { home: Address }",
    after: "type User { home: Location }",
    rationale:
      "GraphQL types are nominal: fragments `... on Address` inside the selection become invalid even though the fields are the same",
    annotation: "names the type and the field (User.home) and the type change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED"),
      fork("test/graphapi.diff.test.ts new types in output: object -> another object"),
      asd("test/graphapi/graphapi10.test.ts G10.5"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field4)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [
      "type Query { profile: User } type User { home: Address } type Address { city: String } type Location { city: String }",
      "type Query { profile: User } type User { home: Location } type Address { city: String } type Location { city: String }",
    ],
    expect: [{ at: "**/home/**", type: breaking, mentions: ["User", "home"] }],
  }),
  gql({
    id: "GQL-FLD-010",
    // ISSUE-127 (fixed) (P8a)
    title: "output field wrapped in a list (String to [String])",
    before: "type User { tags: String }",
    after: "type User { tags: [String] }",
    rationale: "a client reading a scalar receives a list",
    annotation: "names the type and the field (User.tags) and the type change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField"),
      ...suite("scalar-output-type-of-root-type", "add-list-type-for-output-type"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field6, field11)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [user("tags: String"), user("tags: [String]")],
    expect: [{ at: "**/tags/**", type: breaking, mentions: ["User", "tags"] }],
  }),
  gql({
    id: "GQL-FLD-011",
    // ISSUE-127 (fixed) (P8a)
    title: "output field list unwrapped ([String] to String)",
    before: "type User { tags: [String] }",
    after: "type User { tags: String }",
    rationale: "a client iterating a list receives a scalar",
    annotation: "names the type and the field (User.tags) and the type change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field7)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [user("tags: [String]"), user("tags: String")],
    expect: [{ at: "**/tags/**", type: breaking, mentions: ["User", "tags"] }],
  }),
  gql({
    id: "GQL-FLD-012",
    // ISSUE-127 (fixed) (P8a)
    title: "output list items nullable to non-null ([String] to [String!])",
    before: "type User { tags: [String] }",
    after: "type User { tags: [String!] }",
    rationale: "non-null items are a subset of the nullable items a client already handles",
    annotation: "names the type and the field (User.tags) and the item nullability change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field12)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND_SAFE"],
    sdl: [user("tags: [String]"), user("tags: [String!]")],
    expect: [{ at: "**/tags/**", type: nonBreaking, mentions: ["User", "tags"] }],
  }),
  gql({
    id: "GQL-FLD-013",
    // ISSUE-127 (fixed) (P8a)
    title: "output list items non-null to nullable ([String!] to [String])",
    before: "type User { tags: [String!] }",
    after: "type User { tags: [String] }",
    rationale: "clients relying on non-null items receive null items",
    annotation: "names the type and the field (User.tags) and the item nullability change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField"),
      asd("test/graphapi/classification.test.ts making list items nullable is breaking"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field13)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [user("tags: [String!]"), user("tags: [String]")],
    expect: [{ at: "**/tags/**", type: breaking, mentions: ["User", "tags"] }],
  }),
  gql({
    id: "GQL-FLD-014",
    // ISSUE-127 (fixed) (P8a)
    title: "output non-null list to nullable list ([Continent]! to [Continent])",
    before: "type Region { continents: [Continent]! }",
    after: "type Region { continents: [Continent] }",
    rationale: "clients relying on the list being present receive null",
    annotation: "names the type and the field (Region.continents) and the nullability change",
    sources: [
      bench("R1 (re-authored on a reachable type)"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field10)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [
      "type Query { region: Region } type Region { name: String continents: [Continent]! } type Continent { code: ID }",
      "type Query { region: Region } type Region { name: String continents: [Continent] } type Continent { code: ID }",
    ],
    expect: [{ at: "**/continents/**", type: breaking, mentions: ["Region", "continents"] }],
  }),
  gql({
    id: "GQL-FLD-015",
    // ISSUE-127 (fixed) (P8a)
    title: "output nullable list to non-null list ([String] to [String]!)",
    before: "type User { tags: [String] }",
    after: "type User { tags: [String]! }",
    rationale: "a guaranteed list is a subset of the nullable results a client already handles",
    annotation: "names the type and the field (User.tags) and the nullability change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field17)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND_SAFE"],
    sdl: [user("tags: [String]"), user("tags: [String]!")],
    expect: [{ at: "**/tags/**", type: nonBreaking, mentions: ["User", "tags"] }],
  }),
  gql({
    id: "GQL-FLD-016",
    // ISSUE-127 (fixed) (P8a)
    title: "output list nested in another list ([String] to [[String]])",
    before: "type User { tags: [String] }",
    after: "type User { tags: [[String]] }",
    rationale: "clients reading list items as scalars receive lists",
    annotation: "names the type and the field (User.tags) and the type change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field14)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [user("tags: [String]"), user("tags: [[String]]")],
    expect: [{ at: "**/tags/**", type: breaking, mentions: ["User", "tags"] }],
  }),
  gql({
    id: "GQL-FLD-017",
    // ISSUE-127 (fixed) (P8a); ISSUE-123 (fixed): one nominal type change
    title: "output field enum to String",
    before: "type User { role: Role } enum Role { ADMIN GUEST }",
    after: "type User { role: String }",
    rationale: "clients switching over the enum values receive arbitrary strings; the nominal type changed",
    annotation: "names the type and the field (User.role) and the type change",
    sources: [
      ...suite("object-output-type-of-root-type", "change-field-type-of-output-object-type-from-enum-to-string"),
      ...suite("scalar-output-type-of-root-type", "change-output-type-from-enum-to-string"),
      ...suite("interface-output-type-of-root-type", "change-field-type-of-output-interface-from-enum-to-string"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [user("role: Role } enum Role { ADMIN GUEST"), user("role: String")],
    expect: [
      { at: "**/role/**", type: breaking, mentions: ["User", "role"] },
      // the enum is no longer used anywhere: its definition disappears with the change
      { at: "components/enums/Role", action: "remove", type: breaking, mentions: ["Role"], optional: true },
    ],
  }),
  gql({
    id: "GQL-FLD-018",
    // ISSUE-127 (fixed) (P8a)
    title: "output field String to enum",
    before: "type User { role: String }",
    after: "type User { role: Role } enum Role { ADMIN GUEST }",
    rationale:
      "GraphQL types are nominal; findBreakingChanges reports FIELD_CHANGED_KIND and generated clients typed against String break",
    annotation: "names the type and the field (User.role) and the type change",
    sources: [
      giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField"),
      fork("test/graphapi.diff.test.ts new types in output: built-in scalar -> enum"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [user("role: String"), user("role: Role } enum Role { ADMIN GUEST")],
    expect: [
      { at: "**/role/**", type: breaking, mentions: ["User", "role"] },
      { at: "components/enums/Role", action: "add", type: nonBreaking, mentions: ["Role"], optional: true },
    ],
  }),
  gql({
    id: "GQL-FLD-019",
    // ISSUE-127 (fixed) (P8a)
    title: "root field result changed from an object to an interface it implements",
    before: "type Query { item: Book }",
    after: "type Query { item: Media } (Book implements Media)",
    rationale: "selections of Book-only fields directly on `item` become invalid (they need `... on Book`)",
    annotation: "names the root field (Query.item) and the type change",
    sources: [giChange("field.ts FIELD_TYPE_CHANGED safeChangeForField")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      "type Query { item: Book } interface Media { title: String } type Book implements Media { title: String pages: Int }",
      "type Query { item: Media } interface Media { title: String } type Book implements Media { title: String pages: Int }",
    ],
    expect: [{ at: "queries/item/**", type: breaking, mentions: [QUERY, "item"] }],
  }),
  gql({
    id: "GQL-FLD-020",
    // ISSUE-118 (fixed): the implementing type is classified by the interface's usage
    // ISSUE-127 (fixed) (P8a)
    title: "interface field added",
    before: "interface Node { id: ID! }",
    after: "interface Node { id: ID! label: String } (and the implementing type)",
    rationale: "a new selectable field on the interface; existing queries are unaffected",
    annotation: "names the interface and the added field (Node.label)",
    sources: [
      gi("interface.test.ts fields added"),
      ...suite("interface-output-type-of-root-type", "add-new-field-in-output-interface"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "add-new-field-in-interface-type",
        "no diff",
      ),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field5)",
      },
    ],
    covers: ["gi:FIELD_ADDED", "gjs:FIELD_ADDED"],
    sdl: [node(""), node("label: String")],
    expect: [
      {
        at: ["queries/node/**", "components/interfaces/Node/**"],
        action: "add",
        type: nonBreaking,
        mentions: ["Node", "label"],
      },
      // the implementing type declares the field too
      { at: "components/objects/Item/**", action: "add", type: nonBreaking, mentions: ["Item", "label"] },
    ],
  }),
  gql({
    id: "GQL-FLD-021",
    // ISSUE-118 (fixed): the implementing type is classified by the interface's usage
    // ISSUE-127 (fixed) (P8a)
    title: "interface field removed",
    before: "interface Node { id: ID! label: String }",
    after: "interface Node { id: ID! }",
    rationale: "queries selecting Node.label fail validation",
    annotation: "names the interface and the removed field (Node.label)",
    sources: [
      gi("interface.test.ts fields removed"),
      ...suite("interface-output-type-of-root-type", "remove-field-from-output-interface"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "remove-field-from-interface-type",
        "no diff",
      ),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field2)",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (TypeThatHasBreakingFieldChanges.field1)",
      },
    ],
    covers: ["gi:FIELD_REMOVED", "gjs:FIELD_REMOVED"],
    sdl: [node("label: String"), node("")],
    expect: [
      {
        at: ["queries/node/**", "components/interfaces/Node/**"],
        action: "remove",
        type: breaking,
        mentions: ["Node", "label"],
      },
      // the implementing type declares the field too
      { at: "components/objects/Item/**", action: "remove", type: breaking, mentions: ["Item", "label"] },
    ],
  }),
  gql({
    id: "GQL-FLD-022",
    // ISSUE-118 (fixed): the implementing type is classified by the interface's usage
    // ISSUE-127 (fixed) (P8a)
    title: "interface field type changed",
    before: "interface Node { id: ID! rank: Int }",
    after: "interface Node { id: ID! rank: String }",
    rationale: "clients parsing a number receive a string",
    annotation: "names the interface and the field (Node.rank) and the type change",
    sources: [
      gi("interface.test.ts fields type changed"),
      ...suite("interface-output-type-of-root-type", "change-field-type-of-output-interface"),
      ...suite("object-output-type-of-root-type-that-implements-interface", "change-field-type-of-interface-type"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect if a field on a type was deleted or changed type (field3)",
      },
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (TypeThatHasBreakingFieldChanges.field2)",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: [node("rank: Int"), node("rank: String")],
    expect: [
      { at: ["queries/node/**", "components/interfaces/Node/**"], type: breaking, mentions: ["Node", "rank"] },
      // the implementing type declares the field too
      { at: "components/objects/Item/**", type: breaking, mentions: ["Item", "rank"] },
    ],
  }),
  gql({
    id: "GQL-FLD-023",
    // ISSUE-118 (fixed): the implementing type is classified by the interface's usage
    // ISSUE-127 (fixed) (P8a)
    title: "interface field nullable to non-null",
    before: "interface Node { id: ID! rank: Int }",
    after: "interface Node { id: ID! rank: Int! }",
    rationale: "a non-null result is a subset of what clients already handle",
    annotation: "names the interface and the field (Node.rank) and the nullability change",
    sources: [
      ...suite("interface-output-type-of-root-type", "mark-optional-field-of-output-interface-as-mandatory"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "mark-optional-field-of-interface-type-as-mandatory",
      ),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [node("rank: Int"), node("rank: Int!")],
    expect: [
      { at: ["queries/node/**", "components/interfaces/Node/**"], type: nonBreaking, mentions: ["Node", "rank"] },
      // the implementing type declares the field too
      { at: "components/objects/Item/**", type: nonBreaking, mentions: ["Item", "rank"] },
    ],
  }),
  gql({
    id: "GQL-FLD-024",
    // ISSUE-118 (fixed): the implementing type is classified by the interface's usage
    // ISSUE-127 (fixed) (P8a)
    title: "interface field non-null to nullable",
    before: "interface Node { id: ID! rank: Int! }",
    after: "interface Node { id: ID! rank: Int }",
    rationale: "clients relying on the non-null guarantee receive null",
    annotation: "names the interface and the field (Node.rank) and the nullability change",
    sources: [
      ...suite("interface-output-type-of-root-type", "mark-mandatory-field-of-output-interface-as-optional"),
      ...suite(
        "object-output-type-of-root-type-that-implements-interface",
        "mark-mandatory-field-of-interface-type-as-optional",
      ),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [node("rank: Int!"), node("rank: Int")],
    expect: [
      { at: ["queries/node/**", "components/interfaces/Node/**"], type: breaking, mentions: ["Node", "rank"] },
      // the implementing type declares the field too
      { at: "components/objects/Item/**", type: breaking, mentions: ["Item", "rank"] },
    ],
  }),
  gql({
    id: "GQL-FLD-025",
    title: "field order changed (not a change)",
    before: "type User { id: ID! name: String age: Int }",
    after: "type User { age: Int id: ID! name: String }",
    rationale: "field order is not significant in GraphQL; a diff here would be spurious",
    annotation: "no diff",
    sources: [
      gi("object.test.ts fields order changed"),
      gi("interface.test.ts fields order changed"),
      bench("gql-repo-pair field reorders (0.1.2 precision 89 %)"),
    ],
    sdl: [user("name: String age: Int"), "type Query { profile: User } type User { age: Int id: ID! name: String }"],
    expect: [],
  }),
  gql({
    id: "GQL-FLD-026",
    title: "comment-only edit (not a change)",
    before: "# The tweet text. No more than 150 characters!",
    after: "# The tweet text. No more than 140 characters!",
    rationale: "`#` comments are ignored tokens in GraphQL; they are not part of the schema",
    annotation: "no diff",
    sources: [bench("gql-repo-pair comment edits (0.1.2 precision 89 %)")],
    sdl: [
      "type Query { tweet: Tweet }\ntype Tweet {\n  id: ID!\n  # The tweet text. No more than 150 characters!\n  body: String\n}",
      "type Query { tweet: Tweet }\ntype Tweet {\n  id: ID!\n  # The tweet text. No more than 140 characters!\n  body: String\n}",
    ],
    expect: [],
  }),
  gql({
    id: "GQL-FLD-027",
    // ISSUE-127 (fixed) (P8a)
    title: "field removed from an object reached only through a union",
    before: "type Photo { url: String width: Int } (member of SearchResult)",
    after: "type Photo { url: String }",
    rationale: "queries selecting `... on Photo { width }` fail validation",
    annotation: "names the type and the removed field (Photo.width)",
    sources: [...suite("union-output-type-of-root-type", "remove-field-in-object-type-from-union-type")],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [union("width: Int"), union("")],
    expect: [{ at: "**/width", action: "remove", type: breaking, mentions: ["Photo", "width"] }],
  }),
  gql({
    id: "GQL-FLD-028",
    // ISSUE-127 (fixed) (P8a)
    title: "field added to an object reached only through a union",
    before: "type Photo { url: String } (member of SearchResult)",
    after: "type Photo { url: String width: Int }",
    rationale: "a new selectable field; existing queries are unaffected",
    annotation: "names the type and the added field (Photo.width)",
    sources: [...suite("union-output-type-of-root-type", "add-new-field-in-object-type-from-union-type")],
    covers: ["gi:FIELD_ADDED"],
    sdl: [union(""), union("width: Int")],
    expect: [{ at: "**/width", action: "add", type: nonBreaking, mentions: ["Photo", "width"] }],
  }),
  gql({
    id: "GQL-FLD-029",
    // ISSUE-127 (fixed) (P8a)
    title: "field type changed in an object reached only through a union",
    before: "type Photo { width: Int } (member of SearchResult)",
    after: "type Photo { width: String }",
    rationale: "clients parsing a number receive a string",
    annotation: "names the type and the field (Photo.width) and the type change",
    sources: [...suite("union-output-type-of-root-type", "change-field-type-in-object-type-from-union-type")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [union("width: Int"), union("width: String")],
    expect: [{ at: "**/width/**", type: breaking, mentions: ["Photo", "width"] }],
  }),
  gql({
    id: "GQL-FLD-030",
    // ISSUE-127 (fixed) (P8a)
    title: "field made non-null in an object reached only through a union",
    before: "type Photo { width: Int } (member of SearchResult)",
    after: "type Photo { width: Int! }",
    rationale: "a non-null result is a subset of what clients already handle",
    annotation: "names the type and the field (Photo.width) and the nullability change",
    sources: [
      ...suite("union-output-type-of-root-type", "mark-optional-field-as-mandatory-in-object-type-from-union-type"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [union("width: Int"), union("width: Int!")],
    expect: [{ at: "**/width/**", type: nonBreaking, mentions: ["Photo", "width"] }],
  }),
  gql({
    id: "GQL-FLD-031",
    // ISSUE-127 (fixed) (P8a)
    title: "field made nullable in an object reached only through a union",
    before: "type Photo { width: Int! } (member of SearchResult)",
    after: "type Photo { width: Int }",
    rationale: "clients relying on the non-null guarantee receive null",
    annotation: "names the type and the field (Photo.width) and the nullability change",
    sources: [
      ...suite("union-output-type-of-root-type", "mark-mandatory-field-as-optional-in-object-type-from-union-type"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [union("width: Int!"), union("width: Int")],
    expect: [{ at: "**/width/**", type: breaking, mentions: ["Photo", "width"] }],
  }),
  gql({
    id: "GQL-FLD-032",
    // ISSUE-127 (fixed) (P8a)
    title: "field added to a nested object type (two levels below the root)",
    before: "type Tweet { stats: Stat } type Stat { likes: Int }",
    after: "type Stat { likes: Int responses: Int }",
    rationale: "a new selectable field; existing queries are unaffected",
    annotation: "names the type and the added field (Stat.responses)",
    sources: [bench("R6")],
    covers: ["gi:FIELD_ADDED"],
    sdl: [
      "type Query { tweet: Tweet } type Tweet { id: ID! stats: Stat } type Stat { likes: Int }",
      "type Query { tweet: Tweet } type Tweet { id: ID! stats: Stat } type Stat { likes: Int responses: Int }",
    ],
    expect: [{ at: "**/responses", action: "add", type: nonBreaking, mentions: ["Stat", "responses"] }],
  }),
  gql({
    id: "GQL-FLD-033",
    // ISSUE-127 (fixed) (P8a)
    title: "non-null field of a type shared by query and mutation results becomes nullable",
    before: "type Tweet { id: ID! } returned by Query.tweet and Mutation.createTweet",
    after: "type Tweet { id: ID }",
    rationale: "clients relying on a present id receive null from every operation returning Tweet",
    annotation: "names the type and the field (Tweet.id) and the nullability change",
    sources: [bench("R5")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      "type Query { tweet: Tweet } type Mutation { createTweet(body: String): Tweet } type Tweet { id: ID! body: String }",
      "type Query { tweet: Tweet } type Mutation { createTweet(body: String): Tweet } type Tweet { id: ID body: String }",
    ],
    expect: [{ at: "**/id/**", type: breaking, mentions: ["Tweet", "id"] }],
  }),
  gql({
    id: "GQL-FLD-034",
    // ISSUE-127 (fixed) (P8a)
    title: "output field renamed",
    before: "type User { age: Int }",
    after: "type User { years: Int }",
    rationale: "GraphQL has no rename: queries selecting `age` fail; the new field is an addition",
    annotation: "names the type and both fields (User.age removed, User.years added)",
    sources: [gi("schema.test.ts renamed query")],
    covers: ["gi:FIELD_REMOVED", "gi:FIELD_ADDED"],
    sdl: [user("age: Int"), user("years: Int")],
    expect: [
      { at: "**/age", action: "remove", type: breaking, mentions: ["User", "age"] },
      { at: "**/years", action: "add", type: nonBreaking, mentions: ["User", "years"] },
    ],
  }),
  gql({
    id: "GQL-FLD-035",
    // ISSUE-127 (fixed) (P8a)
    title: "field removed from a self-referencing type",
    before: "type User { friends: [User] age: Int }",
    after: "type User { friends: [User] }",
    rationale: "queries selecting User.age (at any depth) fail validation",
    annotation: "names the type and the removed field (User.age)",
    sources: [gi("object.test.ts fields removed")],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [user("friends: [User] age: Int"), user("friends: [User]")],
    expect: [{ at: "**/age", action: "remove", type: breaking, mentions: ["User", "age"] }],
  }),
  gql({
    id: "GQL-FLD-036",
    // ISSUE-127 (fixed) (P8a)
    title: "object field changed from an object to a list of it",
    before: "type User { home: Address }",
    after: "type User { home: [Address] }",
    rationale: "a client reading an object receives a list",
    annotation: "names the type and the field (User.home) and the type change",
    sources: [
      fork("test/graphapi.diff.test.ts new types in output: object -> array of the same object"),
      giChange("field.ts FIELD_TYPE_CHANGED"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      "type Query { profile: User } type User { home: Address } type Address { city: String }",
      "type Query { profile: User } type User { home: [Address] } type Address { city: String }",
    ],
    expect: [{ at: "**/home/**", type: breaking, mentions: ["User", "home"] }],
  }),
  gql({
    id: "GQL-FLD-037",
    // ISSUE-127 (fixed) (P8a)
    title: "root field result changed from an object to a union containing it",
    before: "type Query { find: Photo }",
    after: "type Query { find: Media } union Media = Photo | Video",
    rationale: "direct selections of Photo fields on `find` become invalid (they need `... on Photo`)",
    annotation: "names the root field (Query.find) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in output: object -> union of objects (has the same object)")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      "type Query { find: Photo } type Photo { url: String } type Video { url: String }",
      "type Query { find: Media } union Media = Photo | Video type Photo { url: String } type Video { url: String }",
    ],
    expect: [
      { at: "queries/find/**", type: breaking, mentions: [QUERY, "find"] },
      { at: ["components/unions/Media", "components/objects/Video"], action: "add", type: nonBreaking, optional: true },
    ],
  }),
]

runCases("graphql", "fields", cases, import.meta.filename)
