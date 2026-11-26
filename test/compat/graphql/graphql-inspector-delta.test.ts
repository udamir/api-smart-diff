import { annotation, breaking, nonBreaking } from "../../../src"
import { type CaseSource, type CompatCase, type GraphqlCase, risky, runCases } from "../../helpers/compat"

// graphql-inspector diff tests added after the first harvest (clone 502aa589, packages/core/__tests__/diff): the
// `simplifyChanges` rule tests (changes nested in an added / removed node are folded into it; changes of an existing
// node are all kept) and `removing directive using extend schema`. The ChangeType list is unchanged (80 types).

const gql = (c: Omit<GraphqlCase, "kind">): CompatCase => ({ kind: "graphql", ...c })
const gi = (ref: string, verdict?: string): CaseSource => ({
  tool: "graphql-inspector",
  ref: `packages/core/__tests__/diff/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const simplify = (test: string, verdict?: string) =>
  gi(`rules/simplify-changes.test.ts simplifyChanges rule ${test}`, verdict)

const QUERY = /quer(y|ies)/i
const DEPRECATED_FIELD = 'a(b: String): String! @deprecated(reason: "As a test")'
const ENUM_B =
  '"""Here is a new enum named B""" enum B { """It has newly added values""" C @deprecated(reason: "With deprecations") D }'

const cases: CompatCase[] = [
  gql({
    id: "GQL-GID-001",
    // ISSUE-129 (fixed) (P8-rest)
    area: "directives",
    title: "directive removed from the schema where it was applied through `extend schema`",
    before: "directive @foo on SCHEMA type Query { foo: String } extend schema @foo",
    after: "directive @foo on SCHEMA type Query { foo: String }",
    rationale:
      "applied type-system directives are server metadata that operations cannot observe (ASD convention, ISSUE-40); graphql-inspector rates it DANGEROUS",
    annotation: "names the directive (@foo) and says it was removed from the schema",
    sources: [gi("schema.test.ts removing directive using extend schema", "DANGEROUS")],
    covers: ["gi:DIRECTIVE_USAGE_SCHEMA_REMOVED"],
    sdl: [
      "directive @foo on SCHEMA type Query { foo: String } extend schema @foo",
      "directive @foo on SCHEMA type Query { foo: String }",
    ],
    expect: [{ at: "**", action: "remove", type: annotation, mentions: ["foo", "schema"] }],
  }),
  gql({
    id: "GQL-GID-002",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    area: "types",
    title: "object type with a deprecated field taking an argument added with the root field that returns it",
    before: "type Query { me: String }",
    after: `type Query { me: String foo: Foo } type Foo { ${DEPRECATED_FIELD} }`,
    rationale:
      "a new root field and its new type; the field, argument and deprecation inside the new type are part of the addition, not changes of their own",
    annotation: "names the added root field (Query.foo) and the added type (Foo)",
    sources: [simplify("added field on new object")],
    covers: ["gi:TYPE_ADDED"],
    sdl: ["type Query { me: String }", `type Query { me: String foo: Foo } type Foo { ${DEPRECATED_FIELD} }`],
    expect: [
      { at: "queries/foo", action: "add", type: nonBreaking, mentions: [QUERY, "foo"] },
      { at: "components/objects/Foo", action: "add", type: nonBreaking, mentions: ["Foo"], optional: true },
    ],
  }),
  gql({
    id: "GQL-GID-003",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    area: "types",
    title: "object type with a deprecated field taking an argument removed with the root field that returned it",
    before: `type Query { me: String foo: Foo } type Foo { ${DEPRECATED_FIELD} }`,
    after: "type Query { me: String }",
    rationale:
      "operations selecting Query.foo fail validation; the contents of the removed type are part of the removal",
    annotation: "names the removed root field (Query.foo) and the removed type (Foo)",
    sources: [simplify("removed field on a removed object")],
    covers: ["gi:TYPE_REMOVED"],
    sdl: [`type Query { me: String foo: Foo } type Foo { ${DEPRECATED_FIELD} }`, "type Query { me: String }"],
    expect: [
      { at: "queries/foo", action: "remove", type: breaking, mentions: [QUERY, "foo"] },
      { at: "components/objects/Foo", action: "remove", type: breaking, mentions: ["Foo"], optional: true },
    ],
  }),
  gql({
    id: "GQL-GID-004",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    area: "types",
    title: "interface with a deprecated field taking an argument added with the root field that returns it",
    before: "type Query { me: String }",
    after: `type Query { me: String foo: Foo } interface Foo { ${DEPRECATED_FIELD} }`,
    rationale:
      "a new root field and its new interface; the field, argument and deprecation inside it are part of the addition",
    annotation: "names the added root field (Query.foo) and the added interface (Foo)",
    sources: [simplify("added field on new interface")],
    covers: ["gi:TYPE_ADDED"],
    sdl: ["type Query { me: String }", `type Query { me: String foo: Foo } interface Foo { ${DEPRECATED_FIELD} }`],
    expect: [
      { at: "queries/foo", action: "add", type: nonBreaking, mentions: [QUERY, "foo"] },
      { at: "components/interfaces/Foo", action: "add", type: nonBreaking, mentions: ["Foo"], optional: true },
    ],
  }),
  gql({
    id: "GQL-GID-005",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    area: "enums",
    title: "described enum with a deprecated value added with the root field that returns it",
    before: "type Query { me: String }",
    after: `type Query { me: String b: B } ${ENUM_B}`,
    rationale: "a new root field and its new enum; the values, descriptions and deprecation are part of the addition",
    annotation: "names the added root field (Query.b) and the added enum (B)",
    sources: [simplify("added value on new enum")],
    covers: ["gi:TYPE_ADDED"],
    sdl: ["type Query { me: String }", `type Query { me: String b: B } ${ENUM_B}`],
    expect: [
      { at: "queries/b", action: "add", type: nonBreaking, mentions: [QUERY, "b"] },
      { at: "components/enums/B", action: "add", type: nonBreaking, mentions: ["B"], optional: true },
    ],
  }),
  gql({
    id: "GQL-GID-006",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    area: "enums",
    title: "described enum with a deprecated value removed with the root field that returned it",
    before: `type Query { me: String b: B } ${ENUM_B}`,
    after: "type Query { me: String }",
    rationale: "operations selecting Query.b fail validation; the values of the removed enum are part of the removal",
    annotation: "names the removed root field (Query.b) and the removed enum (B)",
    sources: [simplify("removed value on removed enum")],
    covers: ["gi:TYPE_REMOVED"],
    sdl: [`type Query { me: String b: B } ${ENUM_B}`, "type Query { me: String }"],
    expect: [
      { at: "queries/b", action: "remove", type: breaking, mentions: [QUERY, "b"] },
      { at: "components/enums/B", action: "remove", type: breaking, mentions: ["B"], optional: true },
    ],
  }),
  gql({
    id: "GQL-GID-007",
    // ISSUE-127 (fixed) (P8a); ISSUE-119 (fixed) for 1.0
    area: "fields",
    title: "deprecated field taking an argument added to an existing type",
    before: "type Foo { a: String! }",
    after: 'type Foo { a: String! b(b: String): String! @deprecated(reason: "As a test") }',
    rationale:
      "a new field is non-breaking; its argument and its deprecation are part of the addition, not changes of their own",
    annotation: "names the type and the added field (Foo.b)",
    sources: [simplify("added argument / directive / deprecation / reason on new field")],
    covers: ["gi:FIELD_ADDED"],
    sdl: [
      "type Query { foo: Foo } type Foo { a: String! }",
      'type Query { foo: Foo } type Foo { a: String! b(b: String): String! @deprecated(reason: "As a test") }',
    ],
    expect: [
      { at: ["components/objects/Foo/**", "queries/foo/**"], action: "add", type: nonBreaking, mentions: ["Foo", "b"] },
    ],
  }),
  gql({
    id: "GQL-GID-008",
    // ISSUE-127 (fixed) (P8a)
    area: "unions-interfaces",
    title:
      "union with an applied directive added with its member type, its directive and the root field that returns it",
    before: "type Query { me: String }",
    after:
      'type Query { me: String search: FooUnion } directive @special(reason: String) on UNION type Foo { a: String! } union FooUnion @special(reason: "As a test") = Foo',
    rationale:
      "a new root field, its new union and member type and a new directive definition; the directive applied to the new union is part of its addition",
    annotation:
      "names the added root field (Query.search), the added types (FooUnion, Foo) and the added directive (@special)",
    sources: [simplify("added type / directive / directive argument on new union")],
    covers: ["gi:TYPE_ADDED", "gi:DIRECTIVE_ADDED"],
    sdl: [
      "type Query { me: String }",
      'type Query { me: String search: FooUnion } directive @special(reason: String) on UNION type Foo { a: String! } union FooUnion @special(reason: "As a test") = Foo',
    ],
    expect: [
      { at: "queries/search", action: "add", type: nonBreaking, mentions: [QUERY, "search"] },
      { at: "components/directives/special", action: "add", type: nonBreaking, mentions: ["special"] },
      { at: "components/unions/FooUnion", action: "add", type: nonBreaking, mentions: ["FooUnion"], optional: true },
      { at: "components/objects/Foo", action: "add", type: nonBreaking, mentions: ["Foo"], optional: true },
    ],
  }),
  gql({
    id: "GQL-GID-009",
    // ISSUE-57 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
    area: "fields",
    title: "several changes in one type and in the enum it returns",
    before: "enum UserRole { ADMIN EDITOR } type User { id: ID! name: String! email: String! role: UserRole }",
    after: "enum UserRole { ADMIN EDITOR VIEWER } type User { id: ID! name: String! address: String role: UserRole! }",
    rationale:
      "each change of an existing node is reported on its own: an output enum value added (POLICY-05: risky), a field removed (breaking), a field added and a field made non-null (non-breaking)",
    annotation: "names the enum value (UserRole.VIEWER) and the fields (User.email, User.address, User.role)",
    sources: [simplify("same node contains multiple changes", "DANGEROUS, BREAKING, NON_BREAKING, NON_BREAKING")],
    covers: ["gi:ENUM_VALUE_ADDED", "gi:FIELD_REMOVED", "gi:FIELD_ADDED", "gi:FIELD_TYPE_CHANGED"],
    sdl: [
      "type Query { users: [User!] } enum UserRole { ADMIN EDITOR } type User { id: ID! name: String! email: String! role: UserRole }",
      "type Query { users: [User!] } enum UserRole { ADMIN EDITOR VIEWER } type User { id: ID! name: String! address: String role: UserRole! }",
    ],
    expect: [
      { at: "**/values/VIEWER", action: "add", type: risky, mentions: ["UserRole", "VIEWER"] },
      { at: "**/methods/email", action: "remove", type: breaking, mentions: ["User", "email"] },
      { at: "**/methods/address", action: "add", type: nonBreaking, mentions: ["User", "address"] },
      { at: "**/role/nonNull", action: "add", type: nonBreaking, mentions: ["User", "role"] },
    ],
  }),
  gql({
    id: "GQL-GID-010",
    // ISSUE-127 (fixed) (P8-rest)
    area: "arguments",
    title: "required argument added to a root field whose description was added",
    before: "type Query { foo: String }",
    after: 'type Query { "Describes foo" foo(a: String!): String }',
    rationale: "operations selecting foo without `a` fail validation; the description is documentation",
    annotation: "names the field and the added argument (Query.foo a), and the field whose description was added",
    sources: [simplify("argument added to an existing field whose description was added")],
    covers: ["gi:FIELD_ARGUMENT_ADDED", "gi:FIELD_DESCRIPTION_ADDED"],
    sdl: ["type Query { foo: String }", 'type Query { "Describes foo" foo(a: String!): String }'],
    expect: [
      { at: "queries/foo/description", action: "add", type: annotation, mentions: [QUERY, "foo", "description"] },
      { at: "queries/foo/args/**", action: "add", type: breaking, mentions: [QUERY, "foo", "a"] },
    ],
  }),
  gql({
    id: "GQL-GID-011",
    // ISSUE-127 (fixed) (P8-rest)
    area: "fields",
    title: "root field type changed and its description added",
    before: "type Query { foo: String }",
    after: 'type Query { "Describes foo" foo: Int }',
    rationale: "clients reading a String receive an Int; the description is documentation",
    annotation: "names the root field (Query.foo), the type change and the added description",
    sources: [simplify("type changed on an existing field whose description was added")],
    covers: ["gi:FIELD_TYPE_CHANGED", "gi:FIELD_DESCRIPTION_ADDED"],
    sdl: ["type Query { foo: String }", 'type Query { "Describes foo" foo: Int }'],
    expect: [
      { at: "queries/foo/description", action: "add", type: annotation, mentions: [QUERY, "foo", "description"] },
      { at: "queries/foo/**", type: breaking, mentions: [QUERY, "foo"] },
    ],
  }),
  gql({
    id: "GQL-GID-012",
    // ISSUE-127 (fixed) (P8a)
    area: "inputs",
    title: "input field type changed and its description added",
    before: "input Filter { name: String }",
    after: 'input Filter { "Describes name" name: Int }',
    rationale:
      "String literals and `$v: String` variables passed as `name` fail validation; the description is documentation",
    annotation: "names the input field (Filter.name), the type change and the added description",
    sources: [simplify("type changed on an existing input field whose description was added")],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED", "gi:INPUT_FIELD_DESCRIPTION_ADDED"],
    sdl: [
      "input Filter { name: String } type Query { search(filter: Filter): String }",
      'input Filter { "Describes name" name: Int } type Query { search(filter: Filter): String }',
    ],
    expect: [
      { at: "**/name/description", action: "add", type: annotation, mentions: ["Filter", "name", "description"] },
      { at: ["components/inputObjects/Filter/**", "queries/search/**"], type: breaking, mentions: ["Filter", "name"] },
    ],
  }),
  gql({
    id: "GQL-GID-013",
    // ISSUE-127 (fixed) (P8a); ISSUE-141 (fixed): gqlapi 0.6 rootTypes interfaces
    area: "unions-interfaces",
    title: "query root type starts implementing an interface while a root field is removed and another added",
    before: "interface Node { id: ID } type Query { foo: String bar: String }",
    after: "interface Node { id: ID } type Query implements Node { id: ID foo: String }",
    rationale:
      "Query becomes a possible type of Node (POLICY-05: risky); operations selecting Query.bar fail validation; Query.id is new",
    annotation:
      "names the root type and the implemented interface (Query implements Node) and the root fields (bar, id)",
    sources: [
      simplify("fields changed on an existing type that gained an interface", "DANGEROUS, BREAKING, NON_BREAKING"),
    ],
    covers: ["gi:OBJECT_TYPE_INTERFACE_ADDED", "gi:FIELD_REMOVED", "gi:FIELD_ADDED"],
    sdl: [
      "interface Node { id: ID } type Query { foo: String bar: String }",
      "interface Node { id: ID } type Query implements Node { id: ID foo: String }",
    ],
    expect: [
      { at: "queries/bar", action: "remove", type: breaking, mentions: [QUERY, "bar"] },
      { at: "queries/id", action: "add", type: nonBreaking, mentions: [QUERY, "id"] },
      { at: ["**/interfaces", "**/interfaces/**", "**/implementedBy/**"], type: risky, mentions: ["Query", "Node"] },
    ],
  }),
  gql({
    id: "GQL-GID-014",
    // ISSUE-120 (fixed); POLICY-20 decided (a)
    area: "directives",
    title: "type-system directive location replaced (FIELD_DEFINITION to OBJECT)",
    before: "directive @special on FIELD_DEFINITION",
    after: "directive @special on OBJECT",
    rationale:
      "POLICY-20 (a): a location added is non-breaking, a location removed is breaking (applications on field definitions become invalid); a replace in place is breaking",
    annotation: "names the directive (@special) and the removed and added locations",
    sources: [simplify("location removed from an existing directive that gained a location")],
    covers: ["gi:DIRECTIVE_LOCATION_ADDED", "gi:DIRECTIVE_LOCATION_REMOVED"],
    sdl: [
      "directive @special on FIELD_DEFINITION type Query { foo: String }",
      "directive @special on OBJECT type Query { foo: String }",
    ],
    expect: [
      {
        at: "components/directives/special/locations/**",
        action: ["remove", "replace"],
        type: breaking,
        mentions: ["special", "FIELD_DEFINITION"],
      },
      {
        at: "components/directives/special/locations/**",
        action: "add",
        type: nonBreaking,
        mentions: ["special", "OBJECT"],
        optional: true,
      },
    ],
  }),
  gql({
    id: "GQL-GID-015",
    // ISSUE-127 (fixed) (P8a)
    area: "directives",
    title: "directive argument type changed while another argument is added",
    before: "directive @special(a: Int) on FIELD_DEFINITION",
    after: "directive @special(a: String, b: Int) on FIELD_DEFINITION",
    rationale: "applications passing an Int to `a` fail validation; the optional argument `b` is non-breaking",
    annotation: "names the directive and the arguments (@special a, @special b) and the type change",
    sources: [simplify("type changed on an existing directive argument when another argument was added")],
    covers: ["gi:DIRECTIVE_ARGUMENT_TYPE_CHANGED", "gi:DIRECTIVE_ARGUMENT_ADDED"],
    sdl: [
      "directive @special(a: Int) on FIELD_DEFINITION type Query { foo: String }",
      "directive @special(a: String, b: Int) on FIELD_DEFINITION type Query { foo: String }",
    ],
    expect: [
      { at: "**/args/b", action: "add", type: nonBreaking, mentions: ["special", "b"] },
      { at: "components/directives/special/args/**", type: breaking, mentions: ["special", "a"] },
    ],
  }),
]

runCases("graphql", "graphql-inspector-delta", cases, import.meta.filename)
