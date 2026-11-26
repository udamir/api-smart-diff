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
const bench = (ref: string, verdict?: string): CaseSource => ({
  tool: "bench",
  ref: `bench/fixtures/graphql.js ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const asd = (ref: string): CaseSource => ({ tool: "asd", ref })

const QUERY = /quer(y|ies)/i

const MUTATION = /mutation/i
const SUBSCRIPTION = /subscription/i

const cases: CompatCase[] = [
  gql({
    id: "GQL-ROOT-001",
    // ISSUE-127 (fixed) (P8a)
    title: "root query field added",
    before: "type Query { me: String }",
    after: "type Query { me: String version: String }",
    rationale: "a new operation entry point; existing operations are unaffected",
    annotation: "names the root type and the added field (Query.version)",
    sources: [
      gi("schema.test.ts new field and field changed"),
      asd("test/graphapi/classification.test.ts adding a query is non-breaking"),
      {
        tool: "graphql-js",
        ref: "src/utilities/__tests__/findSchemaChanges-test.ts findSchemaChanges should detect if a field was added",
      },
    ],
    covers: ["gi:FIELD_ADDED", "gjs:FIELD_ADDED"],
    sdl: ["type Query { me: String }", "type Query { me: String version: String }"],
    expect: [{ at: "queries/version", action: "add", type: nonBreaking, mentions: [QUERY, "version"] }],
  }),
  gql({
    id: "GQL-ROOT-002",
    // ISSUE-127 (fixed) (P8a)
    title: "root query field removed",
    before: "type Query { me: String notificationsMeta: Meta }",
    after: "type Query { me: String }",
    rationale: "operations selecting Query.notificationsMeta fail validation",
    annotation: "names the root type and the removed field (Query.notificationsMeta)",
    sources: [bench("Q11"), bench("R7"), asd("test/graphapi/classification.test.ts removing a query is breaking")],
    covers: ["gi:FIELD_REMOVED"],
    sdl: ["type Query { me: String notificationsMeta: Meta } type Meta { count: Int }", "type Query { me: String }"],
    expect: [
      { at: "queries/notificationsMeta", action: "remove", type: breaking, mentions: [QUERY, "notificationsMeta"] },
      // Meta was only reachable through the removed field
      { at: "components/objects/Meta", action: "remove", type: breaking, mentions: ["Meta"] },
    ],
  }),
  gql({
    id: "GQL-ROOT-003",
    // ISSUE-127 (fixed) (P8a)
    title: "mutation field added",
    before: "type Mutation { createPost(title: String): ID }",
    after: "type Mutation { createPost(title: String): ID deletePost(id: ID!): Boolean }",
    rationale: "a new operation entry point; existing operations are unaffected",
    annotation: "names the root type and the added field (Mutation.deletePost)",
    sources: [bench("Q12")],
    covers: ["gi:FIELD_ADDED"],
    sdl: [
      "type Query { me: String } type Mutation { createPost(title: String): ID }",
      "type Query { me: String } type Mutation { createPost(title: String): ID deletePost(id: ID!): Boolean }",
    ],
    expect: [{ at: "mutations/deletePost", action: "add", type: nonBreaking, mentions: [MUTATION, "deletePost"] }],
  }),
  gql({
    id: "GQL-ROOT-004",
    // ISSUE-127 (fixed) (P8a)
    title: "mutation field removed",
    before: "type Mutation { createPost: ID deletePost: Boolean }",
    after: "type Mutation { createPost: ID }",
    rationale: "operations calling Mutation.deletePost fail validation",
    annotation: "names the root type and the removed field (Mutation.deletePost)",
    sources: [asd("test/graphapi/classification.test.ts removing a mutation is breaking")],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [
      "type Query { me: String } type Mutation { createPost(title: String): ID deletePost(id: ID!): Boolean }",
      "type Query { me: String } type Mutation { createPost(title: String): ID }",
    ],
    expect: [{ at: "mutations/deletePost", action: "remove", type: breaking, mentions: [MUTATION, "deletePost"] }],
  }),
  gql({
    id: "GQL-ROOT-005",
    // ISSUE-127 (fixed) (P8a)
    title: "subscription field added",
    before: "type Subscription { onPost: ID }",
    after: "type Subscription { onPost: ID onComment: ID }",
    rationale: "a new operation entry point; existing operations are unaffected",
    annotation: "names the root type and the added field (Subscription.onComment)",
    sources: [giChange("field.ts FIELD_ADDED")],
    covers: ["gi:FIELD_ADDED"],
    sdl: [
      "type Query { me: String } type Subscription { onPost: ID }",
      "type Query { me: String } type Subscription { onPost: ID onComment: ID }",
    ],
    expect: [
      { at: "subscriptions/onComment", action: "add", type: nonBreaking, mentions: [SUBSCRIPTION, "onComment"] },
    ],
  }),
  gql({
    id: "GQL-ROOT-006",
    // ISSUE-127 (fixed) (P8a)
    title: "subscription field removed",
    before: "type Subscription { onPost: ID onComment: ID }",
    after: "type Subscription { onPost: ID }",
    rationale: "operations subscribing to Subscription.onComment fail validation",
    annotation: "names the root type and the removed field (Subscription.onComment)",
    sources: [giChange("field.ts FIELD_REMOVED")],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [
      "type Query { me: String } type Subscription { onPost: ID onComment: ID }",
      "type Query { me: String } type Subscription { onPost: ID }",
    ],
    expect: [
      { at: "subscriptions/onComment", action: "remove", type: breaking, mentions: [SUBSCRIPTION, "onComment"] },
    ],
  }),
  gql({
    id: "GQL-ROOT-007",
    // ISSUE-129 (fixed) (P8a); ISSUE-129 fixed for 1.0 (root type name description, P7)
    title: "mutation root type added",
    before: "type Query { me: String }",
    after: "type Query { me: String } type Mutation { createPost(title: String): ID }",
    rationale:
      "new operation entry points; existing operations are unaffected (graphql-inspector: no previous mutation type means NON_BREAKING)",
    annotation: "names the mutation root and its field (Mutation.createPost)",
    sources: [
      gi("schema.test.ts adding root type should not be breaking"),
      giChange("schema.ts SCHEMA_MUTATION_TYPE_CHANGED"),
      ...suite("root-type-general", "add-new-root-type"),
    ],
    covers: ["gi:SCHEMA_MUTATION_TYPE_CHANGED", "gi:TYPE_ADDED"],
    sdl: ["type Query { me: String }", "type Query { me: String } type Mutation { createPost(title: String): ID }"],
    expect: [
      { at: ["mutations", "mutations/createPost"], action: "add", type: nonBreaking, mentions: [MUTATION] },
      { at: "mutationTypeName", type: annotation, optional: true },
    ],
  }),
  gql({
    id: "GQL-ROOT-008",
    // ISSUE-129 (fixed) (P8a); ISSUE-129 fixed for 1.0 (root type name description, P7)
    title: "mutation root type removed",
    before: "type Query { me: String } type Mutation { createPost(title: String): ID }",
    after: "type Query { me: String }",
    rationale: "every mutation operation fails validation",
    annotation: "names the mutation root and its field (Mutation.createPost)",
    sources: [giChange("schema.ts SCHEMA_MUTATION_TYPE_CHANGED"), ...suite("root-type-general", "delete-root-type")],
    covers: ["gi:SCHEMA_MUTATION_TYPE_CHANGED", "gi:TYPE_REMOVED"],
    sdl: ["type Query { me: String } type Mutation { createPost(title: String): ID }", "type Query { me: String }"],
    expect: [
      { at: ["mutations", "mutations/createPost"], action: "remove", type: breaking, mentions: [MUTATION] },
      { at: "mutationTypeName", type: annotation, optional: true },
    ],
  }),
  gql({
    id: "GQL-ROOT-009",
    // ISSUE-129 (fixed) (P8a); ISSUE-129 fixed for 1.0 (root type name description, P7)
    title: "subscription root type added",
    before: "type Query { me: String }",
    after: "type Query { me: String } type Subscription { onPost: ID }",
    rationale: "new operation entry points; existing operations are unaffected",
    annotation: "names the subscription root and its field (Subscription.onPost)",
    sources: [giChange("schema.ts SCHEMA_SUBSCRIPTION_TYPE_CHANGED"), gi("schema.test.ts null old schema")],
    covers: ["gi:SCHEMA_SUBSCRIPTION_TYPE_CHANGED", "gi:TYPE_ADDED"],
    sdl: ["type Query { me: String }", "type Query { me: String } type Subscription { onPost: ID }"],
    expect: [
      { at: ["subscriptions", "subscriptions/onPost"], action: "add", type: nonBreaking, mentions: [SUBSCRIPTION] },
      { at: "subscriptionTypeName", type: annotation, optional: true },
    ],
  }),
  gql({
    id: "GQL-ROOT-010",
    // ISSUE-129 (fixed) (P8a); ISSUE-129 fixed for 1.0 (root type name description, P7)
    title: "subscription root type removed",
    before: "type Query { me: String } type Subscription { onPost: ID }",
    after: "type Query { me: String }",
    rationale: "every subscription operation fails validation",
    annotation: "names the subscription root and its field (Subscription.onPost)",
    sources: [giChange("schema.ts SCHEMA_SUBSCRIPTION_TYPE_CHANGED"), gi("schema.test.ts null new schema")],
    covers: ["gi:SCHEMA_SUBSCRIPTION_TYPE_CHANGED", "gi:TYPE_REMOVED"],
    sdl: ["type Query { me: String } type Subscription { onPost: ID }", "type Query { me: String }"],
    expect: [
      { at: ["subscriptions", "subscriptions/onPost"], action: "remove", type: breaking, mentions: [SUBSCRIPTION] },
      { at: "subscriptionTypeName", type: annotation, optional: true },
    ],
  }),
  gql({
    id: "GQL-ROOT-011",
    // ISSUE-122 (fixed)
    title: "query root type renamed (schema { query: Root })",
    before: "type Query { me: String }",
    after: "schema { query: Root } type Root { me: String }",
    rationale:
      "root fields are unchanged, but operations with fragments `on Query` (and `__typename` checks on the root) fail validation (graphql-inspector SCHEMA_QUERY_TYPE_CHANGED: BREAKING)",
    annotation: "names the old and the new query root type (Query, Root)",
    sources: [giChange("schema.ts SCHEMA_QUERY_TYPE_CHANGED"), gi("schema.test.ts renamed query")],
    covers: ["gi:SCHEMA_QUERY_TYPE_CHANGED"],
    sdl: ["type Query { me: String }", "schema { query: Root } type Root { me: String }"],
    expect: [{ at: "queryTypeName", type: breaking, mentions: ["Root"] }],
  }),
  gql({
    id: "GQL-ROOT-012",
    // ISSUE-122 (fixed)
    title: "mutation root type renamed",
    before: "type Mutation { createPost: ID }",
    after: "schema { query: Query mutation: Commands } type Commands { createPost: ID }",
    rationale:
      "root fields are unchanged, but operations with fragments `on Mutation` fail validation (graphql-inspector SCHEMA_MUTATION_TYPE_CHANGED: BREAKING)",
    annotation: "names the old and the new mutation root type (Mutation, Commands)",
    sources: [giChange("schema.ts SCHEMA_MUTATION_TYPE_CHANGED")],
    covers: ["gi:SCHEMA_MUTATION_TYPE_CHANGED"],
    sdl: [
      "type Query { me: String } type Mutation { createPost(title: String): ID }",
      "schema { query: Query mutation: Commands } type Query { me: String } type Commands { createPost(title: String): ID }",
    ],
    expect: [{ at: "mutationTypeName", type: breaking, mentions: ["Commands"] }],
  }),
  gql({
    id: "GQL-ROOT-013",
    title: "explicit schema definition with the default root names (not a change)",
    before: "type Query { me: String } type Mutation { m: ID }",
    after: "schema { query: Query mutation: Mutation } (same types)",
    rationale: "the default root type names make both schemas identical",
    annotation: "no diff",
    sources: [gi("schema.test.ts same schema")],
    sdl: [
      "type Query { me: String } type Mutation { m: ID }",
      "schema { query: Query mutation: Mutation } type Query { me: String } type Mutation { m: ID }",
    ],
    expect: [],
  }),
  gql({
    id: "GQL-ROOT-014",
    // ISSUE-127 (fixed) (P8a)
    title: "root query field result type changed",
    before: "type Query { count: Int }",
    after: "type Query { count: String }",
    rationale: "clients parsing a number receive a string",
    annotation: "names the root field (Query.count) and the type change",
    sources: [
      gi("schema.test.ts new field and field changed"),
      asd("test/graphapi/classification.test.ts changing the return scalar type is breaking"),
      {
        tool: "graphql-schema-diff",
        ref: "src/__tests__/diff.test.ts getDiff schema diffing returns breaking changes",
      },
    ],
    covers: ["gi:FIELD_TYPE_CHANGED", "gjs:FIELD_CHANGED_KIND"],
    sdl: ["type Query { count: Int }", "type Query { count: String }"],
    expect: [{ at: "queries/count/**", type: breaking, mentions: [QUERY, "count"] }],
  }),
  gql({
    id: "GQL-ROOT-015",
    // ISSUE-127 (fixed) (P8-rest)
    title: "root query field result made nullable",
    before: "type Query { count: Int! }",
    after: "type Query { count: Int }",
    rationale: "clients relying on the non-null result receive null",
    annotation: "names the root field (Query.count) and the nullability change",
    sources: [
      ...suite("scalar-output-type-of-root-type", "mark-mandatory-output-type-as-optional"),
      gi("schema.test.ts Query fields becoming nullable is a breaking change"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: ["type Query { count: Int! }", "type Query { count: Int }"],
    expect: [{ at: "queries/count/**", type: breaking, mentions: [QUERY, "count"] }],
  }),
  gql({
    id: "GQL-ROOT-016",
    // ISSUE-127 (fixed) (P8-rest)
    title: "root query field result made non-null",
    before: "type Query { count: Int }",
    after: "type Query { count: Int! }",
    rationale: "a non-null result is a subset of what clients already handle",
    annotation: "names the root field (Query.count) and the nullability change",
    sources: [
      ...suite("scalar-output-type-of-root-type", "mark-optional-output-type-as-mandatory"),
      asd("test/graphapi/classification.test.ts making the return type non-null is non-breaking"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: ["type Query { count: Int }", "type Query { count: Int! }"],
    expect: [{ at: "queries/count/**", type: nonBreaking, mentions: [QUERY, "count"] }],
  }),
  gql({
    id: "GQL-ROOT-017",
    // ISSUE-127 (fixed) (P8a)
    title: "root query field renamed",
    before: "type Query { fieldA: String }",
    after: "type Query { fieldB: String }",
    rationale: "operations selecting `fieldA` fail; `fieldB` is an addition",
    annotation: "names the root type and both fields (Query.fieldA removed, fieldB added)",
    sources: [gi("schema.test.ts renamed query")],
    covers: ["gi:FIELD_REMOVED", "gi:FIELD_ADDED"],
    sdl: ["type Query { fieldA: String }", "type Query { fieldB: String }"],
    expect: [
      { at: "queries/fieldA", action: "remove", type: breaking, mentions: [QUERY, "fieldA"] },
      { at: "queries/fieldB", action: "add", type: nonBreaking, mentions: [QUERY, "fieldB"] },
    ],
  }),
  gql({
    id: "GQL-ROOT-018",
    title: "root fields reordered (not a change)",
    before: "type Query { a: String b: Int }",
    after: "type Query { b: Int a: String }",
    rationale: "field order is not significant",
    annotation: "no diff",
    sources: [
      gi("object.test.ts fields order changed"),
      {
        tool: "graphql-schema-diff",
        ref: "src/__tests__/diff.test.ts getDiff schema sorting returns diff between two unsorted, but otherwise equal schemas, when sorting not enabled",
      },
      {
        tool: "graphql-schema-diff",
        ref: "src/__tests__/diff.test.ts getDiff schema sorting returns nothing between two unsorted, but otherwise equal schemas, when sorting enabled",
      },
    ],
    sdl: ["type Query { a: String b: Int }", "type Query { b: Int a: String }"],
    expect: [],
  }),
  gql({
    id: "GQL-ROOT-019",
    // ISSUE-127 (fixed) (P8a)
    title: "root query field added through `extend type Query`",
    before: "type Query { me: String }",
    after: "type Query { me: String } extend type Query { version: String }",
    rationale: "a new operation entry point; existing operations are unaffected",
    annotation: "names the root type and the added field (Query.version)",
    sources: [gi("schema.test.ts adding directive using extend schema")],
    covers: ["gi:FIELD_ADDED"],
    sdl: ["type Query { me: String }", "type Query { me: String } extend type Query { version: String }"],
    expect: [{ at: "queries/version", action: "add", type: nonBreaking, mentions: [QUERY, "version"] }],
  }),
  gql({
    id: "GQL-ROOT-020",
    // ISSUE-127 (fixed) (P8a)
    title: "field removed from an object returned only by a mutation",
    before: "type Mutation { createPost: Post } type Post { id: ID! slug: String }",
    after: "type Post { id: ID! }",
    rationale: "mutations selecting Post.slug fail validation",
    annotation: "names the type and the removed field (Post.slug)",
    sources: [giChange("field.ts FIELD_REMOVED")],
    covers: ["gi:FIELD_REMOVED"],
    sdl: [
      "type Query { me: String } type Mutation { createPost(title: String): Post } type Post { id: ID! slug: String }",
      "type Query { me: String } type Mutation { createPost(title: String): Post } type Post { id: ID! }",
    ],
    expect: [{ at: "**/slug", action: "remove", type: breaking, mentions: ["Post", "slug"] }],
  }),
  gql({
    id: "GQL-ROOT-021",
    // ISSUE-127 (fixed) (P8-rest)
    title: "mutation result made nullable",
    before: "type Mutation { createPost(title: String): ID! }",
    after: "type Mutation { createPost(title: String): ID }",
    rationale: "clients relying on a returned id receive null",
    annotation: "names the mutation (Mutation.createPost) and the nullability change",
    sources: [giChange("field.ts FIELD_TYPE_CHANGED")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [
      "type Query { me: String } type Mutation { createPost(title: String): ID! }",
      "type Query { me: String } type Mutation { createPost(title: String): ID }",
    ],
    expect: [{ at: "mutations/createPost/**", type: breaking, mentions: [MUTATION, "createPost"] }],
  }),
]

runCases("graphql", "schema-roots", cases, import.meta.filename)
