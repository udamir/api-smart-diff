import { breaking, nonBreaking } from "../../../src"
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

const QUERY = /quer(y|ies)/i

const types = "type Photo { url: String } type Video { url: String }"

const cases: CompatCase[] = [
  gql({
    id: "GQL-TYP-001",
    // ISSUE-127 (fixed) (P8a)
    title: "object type added together with the root field that returns it",
    before: "type Query { a: String }",
    after: "type Query { a: String photo: Photo } type Photo { url: String }",
    rationale: "a new type and a new root field; existing operations are unaffected",
    annotation: "names the added root field (Query.photo) and the added type (Photo)",
    sources: [
      gi("object.test.ts added"),
      giChange("type.ts TYPE_ADDED"),
      ...suite("root-type-general", "add-new-root-type"),
    ],
    covers: ["gi:TYPE_ADDED"],
    sdl: ["type Query { a: String }", "type Query { a: String photo: Photo } type Photo { url: String }"],
    expect: [
      { at: "queries/photo", action: "add", type: nonBreaking, mentions: [QUERY, "photo"] },
      { at: "components/objects/Photo", action: "add", type: nonBreaking, mentions: ["Photo"] },
    ],
  }),
  gql({
    id: "GQL-TYP-002",
    // ISSUE-127 (fixed) (P8a)
    title: "object type removed together with the root field that returned it",
    before: "type Query { a: String photo: Photo } type Photo { url: String }",
    after: "type Query { a: String }",
    rationale: "queries selecting Query.photo and fragments on Photo fail validation",
    annotation: "names the removed root field (Query.photo) and the removed type (Photo)",
    sources: [giChange("type.ts TYPE_REMOVED"), ...suite("root-type-general", "delete-root-type")],
    covers: ["gi:TYPE_REMOVED"],
    sdl: ["type Query { a: String photo: Photo } type Photo { url: String }", "type Query { a: String }"],
    expect: [
      { at: "queries/photo", action: "remove", type: breaking, mentions: [QUERY, "photo"] },
      { at: "components/objects/Photo", action: "remove", type: breaking, mentions: ["Photo"] },
    ],
  }),
  gql({
    id: "GQL-TYP-003",
    // ISSUE-127 (fixed) (P8a)
    title: "object type added as the type of a new field of an existing type",
    before: "type User { id: ID! }",
    after: "type User { id: ID! home: Address } type Address { city: String }",
    rationale: "a new type and a new field; existing queries are unaffected",
    annotation: "names the added field (User.home) and the added type (Address)",
    sources: [giChange("type.ts TYPE_ADDED"), gi("object.test.ts added")],
    covers: ["gi:TYPE_ADDED", "gi:FIELD_ADDED"],
    sdl: [
      "type Query { profile: User } type User { id: ID! }",
      "type Query { profile: User } type User { id: ID! home: Address } type Address { city: String }",
    ],
    expect: [
      {
        at: ["queries/profile/**/home", "components/objects/User/**/home"],
        action: "add",
        type: nonBreaking,
        mentions: ["User", "home"],
      },
      { at: "components/objects/Address", action: "add", type: nonBreaking, mentions: ["Address"] },
    ],
  }),
  gql({
    id: "GQL-TYP-004",
    // ISSUE-127 (fixed) (P8a)
    title: "interface type added together with the root field that returns it",
    before: "type Query { a: String }",
    after: "type Query { a: String node: Node } interface Node { id: ID! }",
    rationale: "a new type and a new root field; existing operations are unaffected",
    annotation: "names the added root field (Query.node) and the added interface (Node)",
    sources: [giChange("type.ts TYPE_ADDED")],
    covers: ["gi:TYPE_ADDED"],
    sdl: ["type Query { a: String }", "type Query { a: String node: Node } interface Node { id: ID! }"],
    expect: [
      { at: "queries/node", action: "add", type: nonBreaking, mentions: [QUERY, "node"] },
      { at: "components/interfaces/Node", action: "add", type: nonBreaking, mentions: ["Node"] },
    ],
  }),
  gql({
    id: "GQL-TYP-005",
    // ISSUE-127 (fixed) (P8a)
    title: "interface type removed together with the root field that returned it",
    before: "type Query { a: String node: Node } interface Node { id: ID! }",
    after: "type Query { a: String }",
    rationale: "queries selecting Query.node and fragments on Node fail validation",
    annotation: "names the removed root field (Query.node) and the removed interface (Node)",
    sources: [giChange("type.ts TYPE_REMOVED")],
    covers: ["gi:TYPE_REMOVED"],
    sdl: ["type Query { a: String node: Node } interface Node { id: ID! }", "type Query { a: String }"],
    expect: [
      { at: "queries/node", action: "remove", type: breaking, mentions: [QUERY, "node"] },
      { at: "components/interfaces/Node", action: "remove", type: breaking, mentions: ["Node"] },
    ],
  }),
  gql({
    id: "GQL-TYP-006",
    // ISSUE-127 (fixed) (P8a)
    title: "union type added together with the root field that returns it",
    before: "type Query { a: String } type Photo / Video (unused)",
    after: "type Query { a: String search: SearchResult } union SearchResult = Photo | Video",
    rationale: "a new type and a new root field; existing operations are unaffected",
    annotation: "names the added root field (Query.search) and the added union (SearchResult)",
    sources: [giChange("type.ts TYPE_ADDED")],
    covers: ["gi:TYPE_ADDED"],
    sdl: [
      `type Query { a: String photo: Photo video: Video } ${types}`,
      `type Query { a: String photo: Photo video: Video search: SearchResult } union SearchResult = Photo | Video ${types}`,
    ],
    expect: [
      { at: "queries/search", action: "add", type: nonBreaking, mentions: [QUERY, "search"] },
      { at: "components/unions/SearchResult", action: "add", type: nonBreaking, mentions: ["SearchResult"] },
    ],
  }),
  gql({
    id: "GQL-TYP-007",
    // ISSUE-127 (fixed) (P8a)
    title: "union type removed together with the root field that returned it",
    before: "type Query { search: SearchResult } union SearchResult = Photo | Video",
    after: "type Query { }",
    rationale: "queries selecting Query.search fail validation",
    annotation: "names the removed root field (Query.search) and the removed union (SearchResult)",
    sources: [giChange("type.ts TYPE_REMOVED")],
    covers: ["gi:TYPE_REMOVED"],
    sdl: [
      `type Query { a: String photo: Photo video: Video search: SearchResult } union SearchResult = Photo | Video ${types}`,
      `type Query { a: String photo: Photo video: Video } ${types}`,
    ],
    expect: [
      { at: "queries/search", action: "remove", type: breaking, mentions: [QUERY, "search"] },
      { at: "components/unions/SearchResult", action: "remove", type: breaking, mentions: ["SearchResult"] },
    ],
  }),
  gql({
    id: "GQL-TYP-008",
    // ISSUE-127 (fixed) (P8a)
    title: "enum type added together with the output field that returns it",
    before: "type User { id: ID! }",
    after: "type User { id: ID! role: Role } enum Role { ADMIN GUEST }",
    rationale: "a new type and a new field; existing queries are unaffected",
    annotation: "names the added field (User.role) and the added enum (Role)",
    sources: [giChange("type.ts TYPE_ADDED"), gi("enum.test.ts added")],
    covers: ["gi:TYPE_ADDED"],
    sdl: [
      "type Query { profile: User } type User { id: ID! }",
      "type Query { profile: User } type User { id: ID! role: Role } enum Role { ADMIN GUEST }",
    ],
    expect: [
      {
        at: ["queries/profile/**/role", "components/objects/User/**/role"],
        action: "add",
        type: nonBreaking,
        mentions: ["User", "role"],
      },
      { at: "components/enums/Role", action: "add", type: nonBreaking, mentions: ["Role"] },
    ],
  }),
  gql({
    id: "GQL-TYP-009",
    // ISSUE-127 (fixed) (P8a)
    title: "enum type removed together with the output field that returned it",
    before: "type User { id: ID! role: Role } enum Role { ADMIN GUEST }",
    after: "type User { id: ID! }",
    rationale: "queries selecting User.role fail validation",
    annotation: "names the removed field (User.role) and the removed enum (Role)",
    sources: [giChange("type.ts TYPE_REMOVED")],
    covers: ["gi:TYPE_REMOVED"],
    sdl: [
      "type Query { profile: User } type User { id: ID! role: Role } enum Role { ADMIN GUEST }",
      "type Query { profile: User } type User { id: ID! }",
    ],
    expect: [
      {
        at: ["queries/profile/**/role", "components/objects/User/**/role"],
        action: "remove",
        type: breaking,
        mentions: ["User", "role"],
      },
      { at: "components/enums/Role", action: "remove", type: breaking, mentions: ["Role"] },
    ],
  }),
  gql({
    id: "GQL-TYP-010",
    // ISSUE-127 (fixed) (P8a)
    title: "input type added together with the optional argument that uses it",
    before: "type Query { search: [String] }",
    after: "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String }",
    rationale: "a new optional argument and its type; existing operations do not supply it and stay valid",
    annotation: "names the added argument (Query.search filter) and the added input type (SearchFilter)",
    sources: [giChange("type.ts TYPE_ADDED"), ...suite("input-type-argument-of-root-type", "add-input-type-argument")],
    covers: ["gi:TYPE_ADDED", "gi:FIELD_ARGUMENT_ADDED"],
    sdl: [
      "type Query { search: [String] }",
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String }",
    ],
    expect: [
      { at: "queries/search/**", action: "add", type: nonBreaking, mentions: ["search", "filter"] },
      { at: "components/inputObjects/SearchFilter", action: "add", type: nonBreaking, mentions: ["SearchFilter"] },
    ],
  }),
  gql({
    id: "GQL-TYP-011",
    // ISSUE-127 (fixed) (P8a)
    title: "input type removed together with the argument that used it",
    before: "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String }",
    after: "type Query { search: [String] }",
    rationale: "operations supplying `filter` (or declaring `$f: SearchFilter`) fail validation",
    annotation: "names the removed argument (Query.search filter) and the removed input type (SearchFilter)",
    sources: [
      giChange("type.ts TYPE_REMOVED"),
      ...suite("input-type-argument-of-root-type", "remove-input-type-argument"),
    ],
    covers: ["gi:TYPE_REMOVED", "gi:FIELD_ARGUMENT_REMOVED"],
    sdl: [
      "type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String }",
      "type Query { search: [String] }",
    ],
    expect: [
      { at: "queries/search/**", action: "remove", type: breaking, mentions: ["search", "filter"] },
      { at: "components/inputObjects/SearchFilter", action: "remove", type: breaking, mentions: ["SearchFilter"] },
    ],
  }),
  gql({
    id: "GQL-TYP-012",
    // ISSUE-118 (fixed)
    title: "type kind changed: object to interface (same name and fields)",
    before: "type Query { item: Media } type Media { title: String }",
    after: "type Query { item: Media } interface Media { title: String } type Book implements Media { title: String }",
    rationale:
      "the kind change is reported as the old definition removed (breaking) plus a new definition added; the selection on `item` is now abstract; generated clients and fragments typed against the object type break (graphql-inspector TYPE_KIND_CHANGED)",
    annotation: "names the type (Media) and the kind change",
    sources: [
      giChange("type.ts TYPE_KIND_CHANGED"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should detect all breaking changes (TypeThatChangesType)",
      },
    ],
    covers: ["gi:TYPE_KIND_CHANGED", "gjs:TYPE_CHANGED_KIND"],
    sdl: [
      "type Query { item: Media } type Media { title: String }",
      "type Query { item: Media } interface Media { title: String } type Book implements Media { title: String }",
    ],
    expect: [
      { at: "queries/item/**", type: breaking, mentions: ["item"] },
      { at: "components/objects/Media", action: "remove", type: breaking, mentions: ["Media"] },
      { at: "components/interfaces/Media", action: "add", type: nonBreaking, mentions: ["Media"] },
      { at: "components/objects/Book", action: "add", type: nonBreaking, mentions: ["Book"], optional: true },
    ],
  }),
  gql({
    id: "GQL-TYP-013",
    // ISSUE-123 (fixed)
    title: "type kind changed: enum to scalar (same name)",
    before: "type User { status: Status } enum Status { ACTIVE BLOCKED }",
    after: "type User { status: Status } scalar Status",
    rationale: "clients switching over the enum values receive an opaque scalar",
    annotation: "names the type (Status) and the kind change",
    sources: [giChange("type.ts TYPE_KIND_CHANGED")],
    covers: ["gi:TYPE_KIND_CHANGED"],
    sdl: [
      "type Query { profile: User } type User { id: ID! status: Status } enum Status { ACTIVE BLOCKED }",
      "type Query { profile: User } type User { id: ID! status: Status } scalar Status",
    ],
    expect: [
      { at: ["queries/profile/**", "components/objects/User/**"], type: breaking, mentions: ["status"] },
      { at: "components/enums/Status", action: "remove", type: breaking, mentions: ["Status"] },
      { at: "components/scalars/Status", action: "add", type: nonBreaking, mentions: ["Status"] },
    ],
  }),
  gql({
    id: "GQL-TYP-014",
    // ISSUE-123 (fixed)
    title: "type kind changed: input object to scalar (same name)",
    before: "type Query { search(filter: Filter): [String] } input Filter { term: String }",
    after: "type Query { search(filter: Filter): [String] } scalar Filter",
    rationale:
      "the argument's type changed nominally; variables and literals written for the input object are no longer validated against it",
    annotation: "names the type (Filter) and the kind change",
    sources: [giChange("type.ts TYPE_KIND_CHANGED")],
    covers: ["gi:TYPE_KIND_CHANGED"],
    sdl: [
      "type Query { search(filter: Filter): [String] } input Filter { term: String }",
      "type Query { search(filter: Filter): [String] } scalar Filter",
    ],
    expect: [
      { at: "queries/search/**", type: breaking, mentions: ["filter"] },
      { at: "components/inputObjects/Filter", action: "remove", type: breaking, mentions: ["Filter"] },
      { at: "components/scalars/Filter", action: "add", type: nonBreaking, mentions: ["Filter"] },
    ],
  }),
  gql({
    id: "GQL-TYP-015",
    title: "type kind changed: object to union (same name)",
    before: "type Query { result: Result } type Result { url: String }",
    after: "type Query { result: Result } union Result = Photo | Video",
    rationale: "direct field selections on `result` become invalid (a union has no fields)",
    annotation: "names the type (Result) and the kind change",
    sources: [giChange("type.ts TYPE_KIND_CHANGED")],
    covers: ["gi:TYPE_KIND_CHANGED"],
    sdl: [
      `type Query { result: Result photo: Photo video: Video } type Result { url: String } ${types}`,
      `type Query { result: Result photo: Photo video: Video } union Result = Photo | Video ${types}`,
    ],
    expect: [
      { at: "queries/result/**", type: breaking, mentions: ["result"] },
      { at: "components/objects/Result", action: "remove", type: breaking, mentions: ["Result"] },
      { at: "components/unions/Result", action: "add", type: nonBreaking, mentions: ["Result"] },
    ],
  }),
  gql({
    id: "GQL-TYP-016",
    // ISSUE-116 (fixed)
    title: "type kind changed: interface to object (same name)",
    before: "type Query { item: Media } interface Media { title: String } type Book implements Media",
    after: "type Query { item: Media } type Media { title: String } type Book",
    rationale: "fragments `... on Book` inside `item` become invalid (Book is no longer a possible type)",
    annotation: "names the type (Media) and the kind change",
    sources: [giChange("type.ts TYPE_KIND_CHANGED")],
    covers: ["gi:TYPE_KIND_CHANGED"],
    sdl: [
      "type Query { item: Media book: Book } interface Media { title: String } type Book implements Media { title: String }",
      "type Query { item: Media book: Book } type Media { title: String } type Book { title: String }",
    ],
    expect: [
      { at: "queries/item/**", type: breaking, mentions: ["item"] },
      { at: "components/interfaces/Media", action: "remove", type: breaking, mentions: ["Media"] },
      { at: "components/objects/Media", action: "add", type: nonBreaking, mentions: ["Media"] },
      // Book no longer implements Media: fragments `... on Media` inside a Book selection become invalid
      { at: ["queries/book/**", "components/objects/Book/**"], type: breaking, mentions: ["Book", "Media"] },
    ],
  }),
  gql({
    id: "GQL-TYP-017",
    title: "object type renamed (the field now returns the renamed type)",
    before: "type Query { profile: User } type User { id: ID! }",
    after: "type Query { profile: Account } type Account { id: ID! }",
    rationale: "GraphQL has no rename: fragments `... on User` and `__typename` checks fail; the old type is removed",
    annotation: "names the root field (Query.profile), the removed type (User) and the added type (Account)",
    sources: [giChange("type.ts TYPE_REMOVED / TYPE_ADDED"), gi("schema.test.ts huge test")],
    covers: ["gi:TYPE_REMOVED", "gi:TYPE_ADDED"],
    sdl: [
      "type Query { profile: User } type User { id: ID! }",
      "type Query { profile: Account } type Account { id: ID! }",
    ],
    expect: [
      { at: "queries/profile/**", type: breaking, mentions: ["profile"] },
      { at: "components/objects/User", action: "remove", type: breaking, mentions: ["User"] },
      { at: "components/objects/Account", action: "add", type: nonBreaking, mentions: ["Account"] },
    ],
  }),
  gql({
    id: "GQL-TYP-018",
    title: "identical schemas written differently (type order, extend type, block vs plain descriptions)",
    before: "type Query { a: String b: Int } type T ... (one order)",
    after: "same definitions in another order, Query split with `extend type Query`",
    rationale: "definition order and type extensions are presentation; the schema is the same",
    annotation: "no diff",
    sources: [
      gi("schema.test.ts same schema"),
      gi("schema.test.ts schema from an introspection result should be the same"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findBreakingChanges-test.ts findBreakingChanges should not flag args with the same type signature as breaking",
      },
    ],
    sdl: [
      'type Query { a: String b: Photo } """Photo""" type Photo { url: String }',
      '"Photo" type Photo { url: String } type Query { a: String } extend type Query { b: Photo }',
    ],
    expect: [],
  }),
]

runCases("graphql", "types", cases, import.meta.filename)
