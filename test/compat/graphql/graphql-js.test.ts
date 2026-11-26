import { breaking, nonBreaking } from "../../../src"
import { type CaseSource, type CompatCase, type GraphqlCase, risky, runCases } from "../../helpers/compat"

// Scenarios of graphql-js `findSchemaChanges` (src/utilities/__tests__/findBreakingChanges-test.ts and
// findSchemaChanges-test.ts) and of graphql-schema-diff (src/__tests__/diff.test.ts, a wrapper of graphql-js) that are
// not already in the corpus. graphql-js has no `risky` class: DANGEROUS agrees with ASD's `risky` where decision §11.14
// lists the change; everywhere else its verdict is recorded in `sources[].verdict` when it differs from ASD's.

const gql = (c: Omit<GraphqlCase, "kind">): CompatCase => ({ kind: "graphql", ...c })
const gjs = (file: string, test: string, verdict?: string): CaseSource => ({
  tool: "graphql-js",
  ref: `src/utilities/__tests__/${file} ${test}`,
  ...(verdict ? { verdict } : {}),
})
const brk = (test: string, verdict?: string) =>
  gjs("findBreakingChanges-test.ts", `findBreakingChanges ${test}`, verdict)
const dng = (test: string, verdict?: string) =>
  gjs("findBreakingChanges-test.ts", `findDangerousChanges ${test}`, verdict)
const sch = (test: string, verdict?: string) => gjs("findSchemaChanges-test.ts", `findSchemaChanges ${test}`, verdict)
const gsd = (test: string, verdict?: string): CaseSource => ({
  tool: "graphql-schema-diff",
  ref: `src/__tests__/diff.test.ts ${test}`,
  ...(verdict ? { verdict } : {}),
})

const QUERY = /quer(y|ies)/i

// an output field of an object type reachable from the query root
const out = (type: string) => `type Query { profile: User } type User { id: ID! ids: ${type} }`
const OUT = ["components/objects/User/**", "queries/profile/**"]
// a root query field argument
const arg = (type: string) => `type Query { search(ids: ${type}): [String] }`
const ARG = ["queries/search/args/**"]
// a field of an input type used by a root query argument
const inp = (type: string) =>
  `type Query { search(filter: SearchFilter): [String] } input SearchFilter { term: String ids: ${type} }`
const INP = ["queries/search/args/**", "components/inputObjects/SearchFilter/**"]

const wrapper = (
  id: string,
  area: "fields" | "arguments" | "inputs",
  from: string,
  to: string,
  type: typeof breaking | typeof nonBreaking,
  rationale: string,
  sources: CaseSource[],
  covers: string[],
  extra: Partial<Omit<GraphqlCase, "kind">> = {},
): CompatCase => {
  const [sdl, at, where, mentions] =
    area === "fields"
      ? [out, OUT, "output field", ["User", "ids"]]
      : area === "arguments"
        ? [arg, ARG, "argument", [QUERY, "search", "ids"]]
        : [inp, INP, "input field", ["SearchFilter", "ids"]]
  return gql({
    id,
    area,
    title: `${where} type ${from} to ${to}`,
    before: area === "fields" ? `User.ids: ${from}` : area === "arguments" ? `search(ids: ${from})` : `ids: ${from}`,
    after: area === "fields" ? `User.ids: ${to}` : area === "arguments" ? `search(ids: ${to})` : `ids: ${to}`,
    rationale,
    annotation: `names the ${where} (${area === "fields" ? "User.ids" : area === "arguments" ? "Query.search ids" : "SearchFilter.ids"}) and the type change`,
    sources,
    covers,
    sdl: [sdl(from), sdl(to)],
    expect: [{ at, type, mentions }],
    // ISSUE-127 (fixed) (P8a)
    ...extra,
  })
}

const cases: CompatCase[] = [
  gql({
    id: "GQL-GJS-001",
    // ISSUE-127 (fixed) (P8a)
    area: "scalars",
    title: "output field Float to String (the standard scalar Float is no longer referenced)",
    before: "type Query { foo: Float }",
    after: "type Query { foo: String }",
    rationale:
      "the field's result type changed; a standard scalar is always available to operations, so its disappearance from the type map is not a change of its own",
    annotation: "names the root field (Query.foo) and the type change",
    sources: [
      brk(
        "should detect if a standard scalar was removed",
        "BREAKING: TYPE_REMOVED (standard scalar Float) + FIELD_CHANGED_KIND",
      ),
    ],
    covers: ["gjs:FIELD_CHANGED_KIND"],
    sdl: ["type Query { foo: Float }", "type Query { foo: String }"],
    expect: [{ at: "queries/foo/**", type: breaking, mentions: [QUERY, "foo"] }],
  }),
  gql({
    id: "GQL-GJS-002",
    // ISSUE-127 (fixed) (P8a)
    area: "arguments",
    title: "argument Float to String (the standard scalar Float is no longer referenced)",
    before: "type Query { field1(id: Float): String }",
    after: "type Query { field1(id: String): String }",
    rationale:
      "operations passing a Float literal or a `$v: Float` variable fail validation; the standard scalar's disappearance from the type map is not a change of its own",
    annotation: "names the field and the argument (Query.field1 id) and the type change",
    sources: [
      brk(
        "should detect all breaking changes (ArgThatChanges)",
        "BREAKING: TYPE_REMOVED (standard scalar Float) + ARG_CHANGED_KIND",
      ),
    ],
    covers: ["gjs:ARG_CHANGED_KIND"],
    sdl: ["type Query { field1(id: Float): String }", "type Query { field1(id: String): String }"],
    expect: [{ at: "queries/field1/args/**", type: breaking, mentions: [QUERY, "field1", "id"] }],
  }),
  gql({
    id: "GQL-GJS-003",
    // ISSUE-123 (fixed)
    area: "types",
    title: "type kind changed: scalar to enum (same name)",
    before: "type Query { status: Status } scalar Status",
    after: "type Query { status: Status } enum Status { ACTIVE BLOCKED }",
    rationale: "the field's result type changed nominally (codegen and introspection-based clients see another kind)",
    annotation: "names the type (Status) and the kind change",
    sources: [brk("should detect if a type changed its type (TypeWasScalarBecomesEnum)")],
    covers: ["gjs:TYPE_CHANGED_KIND"],
    sdl: [
      "type Query { status: Status } scalar Status",
      "type Query { status: Status } enum Status { ACTIVE BLOCKED }",
    ],
    expect: [
      { at: "queries/status/**", type: breaking, mentions: ["status"] },
      { at: "components/scalars/Status", action: "remove", type: breaking, mentions: ["Status"] },
      { at: "components/enums/Status", action: "add", type: nonBreaking, mentions: ["Status"] },
    ],
  }),
  gql({
    id: "GQL-GJS-004",
    // ISSUE-116 (fixed)
    area: "types",
    title: "type kind changed: interface to union (same name)",
    before: "type Query { node: Node } interface Node { id: ID! } type Item implements Node { id: ID! }",
    after: "type Query { node: Node } union Node = Item type Item { id: ID! }",
    rationale:
      "selections of interface fields directly on `node` (`node { id }`) fail validation; Item no longer implements Node",
    annotation: "names the type (Node) and the kind change",
    sources: [brk("should detect if a type changed its type (TypeWasInterfaceBecomesUnion)")],
    covers: ["gjs:TYPE_CHANGED_KIND"],
    sdl: [
      "type Query { node: Node } interface Node { id: ID! } type Item implements Node { id: ID! }",
      "type Query { node: Node } union Node = Item type Item { id: ID! }",
    ],
    expect: [
      { at: "queries/node/**", type: breaking, mentions: ["node"] },
      { at: "components/interfaces/Node", action: "remove", type: breaking, mentions: ["Node"] },
      { at: "components/unions/Node", action: "add", type: nonBreaking, mentions: ["Node"] },
      { at: "components/objects/Item/**", type: breaking, mentions: ["Item"] },
    ],
  }),
  gql({
    id: "GQL-GJS-005",
    // ISSUE-132 (fixed): POLICY-02 decided (a)
    area: "types",
    title: "type kind changed: object to input object (same name, unreachable)",
    before: "type Query { me: String } type Point { x: Int }",
    after: "type Query { me: String } input Point { x: Int }",
    rationale:
      "POLICY-02 (a): classified as if reachable; the object type is gone (fragments `on Point` fail) and an input type is added",
    annotation: "names the type (Point) and the kind change",
    sources: [brk("should detect if a type changed its type (TypeWasObjectBecomesInputObject)")],
    covers: ["gjs:TYPE_CHANGED_KIND"],
    sdl: ["type Query { me: String } type Point { x: Int }", "type Query { me: String } input Point { x: Int }"],
    expect: [
      { at: "components/objects/Point", action: "remove", type: breaking, mentions: ["Point"] },
      { at: "components/inputObjects/Point", action: "add", type: nonBreaking, mentions: ["Point"] },
    ],
  }),

  // ---- output field wrappers (findBreakingChanges "should detect if a field on a type was deleted or changed type")
  wrapper(
    "GQL-GJS-006",
    "fields",
    "Int!",
    "[Int]!",
    breaking,
    "clients reading a number receive a list",
    [brk("should detect if a field on a type was deleted or changed type (field16)")],
    ["gjs:FIELD_CHANGED_KIND"],
  ),
  wrapper(
    "GQL-GJS-007",
    "fields",
    "[[Int]]",
    "[Int]",
    breaking,
    "clients reading list items as lists receive numbers",
    [brk("should detect if a field on a type was deleted or changed type (field15)")],
    ["gjs:FIELD_CHANGED_KIND"],
  ),
  wrapper(
    "GQL-GJS-008",
    "fields",
    "[[Int!]!]",
    "[[Int!]]",
    breaking,
    "items of the outer list may now be null; clients that rely on non-null inner lists break",
    [brk("should detect if a field on a type was deleted or changed type (field18)")],
    ["gjs:FIELD_CHANGED_KIND"],
  ),

  // ---- input field wrappers (findBreakingChanges "should detect if fields on input types changed kind or were removed")
  wrapper(
    "GQL-GJS-009",
    "inputs",
    "[String]",
    "String",
    breaking,
    "list literals and `$v: [String]` variables fail validation",
    [brk("should detect if fields on input types changed kind or were removed (field3)")],
    ["gjs:FIELD_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-010",
    "inputs",
    "[Int]",
    "[Int]!",
    breaking,
    "operations that omit the field or pass null fail validation",
    [brk("should detect if fields on input types changed kind or were removed (field6)")],
    ["gjs:FIELD_CHANGED_KIND"],
  ),
  wrapper(
    "GQL-GJS-011",
    "inputs",
    "[Int]!",
    "[Int]",
    nonBreaking,
    "every value accepted before is still accepted",
    [brk("should detect if fields on input types changed kind or were removed (field7)")],
    ["gjs:FIELD_CHANGED_KIND_SAFE"],
  ),
  wrapper(
    "GQL-GJS-012",
    "inputs",
    "[Int]",
    "[[Int]]",
    breaking,
    "literals still coerce, but variables declared `$v: [Int]` no longer match",
    [brk("should detect if fields on input types changed kind or were removed (field11)")],
    ["gjs:FIELD_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-013",
    "inputs",
    "[[Int]]",
    "[Int]",
    breaking,
    "nested list literals and `$v: [[Int]]` variables fail validation",
    [brk("should detect if fields on input types changed kind or were removed (field12)")],
    ["gjs:FIELD_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-014",
    "inputs",
    "Int!",
    "[Int]!",
    breaking,
    "literals still coerce, but variables declared `$v: Int!` no longer match",
    [brk("should detect if fields on input types changed kind or were removed (field13)")],
    ["gjs:FIELD_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-015",
    "inputs",
    "[[Int]!]",
    "[[Int]]",
    nonBreaking,
    "the inner lists may now be null; every value accepted before is still accepted",
    [brk("should detect if fields on input types changed kind or were removed (field14)")],
    ["gjs:FIELD_CHANGED_KIND_SAFE"],
  ),
  wrapper(
    "GQL-GJS-016",
    "inputs",
    "[[Int]!]",
    "[[Int!]!]",
    breaking,
    "inner lists containing null and `$v: [[Int]!]` variables fail validation",
    [brk("should detect if fields on input types changed kind or were removed (field15)")],
    ["gjs:FIELD_CHANGED_KIND"],
  ),

  // ---- argument wrappers (findBreakingChanges "should detect if a field argument has changed type")
  wrapper(
    "GQL-GJS-017",
    "arguments",
    "[String]",
    "String",
    breaking,
    "list literals and `$v: [String]` variables fail validation",
    [brk("should detect if a field argument has changed type (arg3)")],
    ["gjs:ARG_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-018",
    "arguments",
    "Int",
    "[Int]!",
    breaking,
    "operations that omit the argument fail validation, and `$v: Int` variables no longer match",
    [brk("should detect if a field argument has changed type (arg8)")],
    ["gjs:ARG_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-019",
    "arguments",
    "[Int]",
    "[[Int]]",
    breaking,
    "literals still coerce, but variables declared `$v: [Int]` no longer match",
    [brk("should detect if a field argument has changed type (arg11)")],
    ["gjs:ARG_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-020",
    "arguments",
    "[[Int]]",
    "[Int]",
    breaking,
    "nested list literals and `$v: [[Int]]` variables fail validation",
    [brk("should detect if a field argument has changed type (arg12)")],
    ["gjs:ARG_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-021",
    "arguments",
    "Int!",
    "[Int]!",
    breaking,
    "literals still coerce, but variables declared `$v: Int!` no longer match",
    [brk("should detect if a field argument has changed type (arg13)")],
    ["gjs:ARG_CHANGED_KIND"],
    {}, // ISSUE-123 (fixed): one nominal type change; ISSUE-127 (fixed) (P8a)
  ),
  wrapper(
    "GQL-GJS-022",
    "arguments",
    "[[Int]!]",
    "[[Int]]",
    nonBreaking,
    "the inner lists may now be null; every value accepted before is still accepted",
    [brk("should detect if a field argument has changed type (arg14)")],
    ["gjs:ARG_CHANGED_KIND_SAFE"],
  ),
  wrapper(
    "GQL-GJS-023",
    "arguments",
    "[[Int]!]",
    "[[Int!]!]",
    breaking,
    "inner lists containing null and `$v: [[Int]!]` variables fail validation",
    [brk("should detect if a field argument has changed type (arg15)")],
    ["gjs:ARG_CHANGED_KIND"],
  ),
  wrapper(
    "GQL-GJS-024",
    "arguments",
    "String!",
    "Int",
    breaking,
    "the argument became optional but its type changed: String literals and `$v: String!` variables fail validation",
    [brk("should detect if a field argument has changed type (arg5)")],
    ["gjs:ARG_CHANGED_KIND"],
    {
      // the nullability part (non-null to nullable, non-breaking on its own) and the named-type part (String to Int,
      // breaking) are separate diffs
      expect: [
        {
          at: "queries/search/args/ids/nonNull",
          type: nonBreaking,
          mentions: [QUERY, "search", "ids"],
        },
        { at: ARG, type: breaking, mentions: [QUERY, "search", "ids"] },
      ],
    },
  ),
  wrapper(
    "GQL-GJS-025",
    "arguments",
    "String!",
    "Int!",
    breaking,
    "String literals and `$v: String!` variables fail validation",
    [brk("should detect if a field argument has changed type (arg6)")],
    ["gjs:ARG_CHANGED_KIND"],
  ),

  gql({
    id: "GQL-GJS-026",
    // ISSUE-116 (fixed)
    area: "unions-interfaces",
    title: "interface stops implementing another interface",
    before: "interface Node { id: ID! } interface Resource implements Node { id: ID! url: String }",
    after: "interface Node { id: ID! } interface Resource { id: ID! url: String }",
    rationale:
      "Resource is no longer a subtype of Node: fields returning Resource can no longer be used where Node is expected, and spreads relying on the relation may fail",
    annotation: "names the interface and the removed interface (Resource, Node)",
    sources: [brk("should detect interfaces removed from interfaces")],
    covers: ["gjs:IMPLEMENTED_INTERFACE_REMOVED"],
    sdl: [
      "type Query { node: Node resource: Resource } interface Node { id: ID! } interface Resource implements Node { id: ID! url: String }",
      "type Query { node: Node resource: Resource } interface Node { id: ID! } interface Resource { id: ID! url: String }",
    ],
    expect: [
      { at: ["queries/resource/**", "components/interfaces/**"], type: breaking, mentions: ["Resource", "Node"] },
    ],
  }),
  gql({
    id: "GQL-GJS-027",
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b)
    area: "directives",
    title: "non-null argument with a default added to an executable directive",
    before: "directive @limit on FIELD",
    after: "directive @limit(size: Int! = 0) on FIELD",
    rationale:
      "existing usages stay valid; usages that omit `size` now run with the default; decision §11.14 (arguments added with a default): risky",
    annotation: "names the directive and the added argument (@limit size)",
    sources: [
      brk(
        "should detect if an optional directive argument was added (newOptionalArg2)",
        "SAFE (OPTIONAL_DIRECTIVE_ARG_ADDED)",
      ),
    ],
    covers: ["gjs:OPTIONAL_DIRECTIVE_ARG_ADDED"],
    sdl: [
      "directive @limit on FIELD type Query { items: [String] }",
      "directive @limit(size: Int! = 0) on FIELD type Query { items: [String] }",
    ],
    expect: [{ at: "components/directives/limit/**", action: "add", type: risky, mentions: ["limit", "size"] }],
  }),
  gql({
    id: "GQL-GJS-028",
    // 1.0: input-object and list defaults are compared item by item without a rule (ISSUE-140)
    // ISSUE-127 (fixed) (P8a); ISSUE-130 (fixed): POLICY-05 decided (b); ISSUE-140 (fixed)
    area: "arguments",
    title: "input-object default of an argument changed",
    before: "search(filter: Filter = { ids: [1, 2, 3] })",
    after: "search(filter: Filter = { ids: [3, 2, 1] })",
    rationale: "operations that omit `filter` silently get a different value; POLICY-05: risky",
    annotation: "names the field and the argument (Query.search filter) and the default value",
    sources: [dng("should detect if a defaultValue changed on an argument (complexObject)")],
    covers: ["gjs:ARG_DEFAULT_VALUE_CHANGE"],
    sdl: [
      "type Query { search(filter: Filter = { ids: [1, 2, 3] }): [String] } input Filter { ids: [Int] }",
      "type Query { search(filter: Filter = { ids: [3, 2, 1] }): [String] } input Filter { ids: [Int] }",
    ],
    expect: [{ at: "queries/search/args/**", type: risky, mentions: [QUERY, "search", "filter"] }],
  }),
  gql({
    id: "GQL-GJS-029",
    area: "arguments",
    title: "input-object default written with its fields in another order (not a change)",
    before: 'search(filter: Filter = { a: "a", b: "b", c: "c" })',
    after: 'search(filter: Filter = { c: "c", b: "b", a: "a" })',
    rationale: "an input object value is unordered; the default is the same value",
    annotation: "no diff",
    sources: [dng("should ignore changes in field order of defaultValue")],
    sdl: [
      'type Query { search(filter: Filter = { a: "a", b: "b", c: "c" }): [String] } input Filter { a: String b: String c: String }',
      'type Query { search(filter: Filter = { c: "c", b: "b", a: "a" }): [String] } input Filter { a: String b: String c: String }',
    ],
    expect: [],
  }),
  gql({
    id: "GQL-GJS-030",
    // ISSUE-57 (fixed) (P8a); ISSUE-132 (fixed): POLICY-02 decided (a)
    area: "reachability",
    title: "enum value added to an unreachable enum",
    before: "enum TestEnum { FIRST_VALUE } (not used by any field)",
    after: "enum TestEnum { FIRST_VALUE SECOND_VALUE }",
    rationale:
      "POLICY-02 (a): an unreachable enum is classified for both directions; the output reading of an added value is risky (POLICY-05 (b))",
    annotation: "names the enum and the added value (TestEnum.SECOND_VALUE)",
    sources: [
      dng("should detect if a value was added to an enum type"),
      gsd("getDiff schema diffing returns dangerous changes"),
      gsd("getDiff schema diffing returns the exact diff between two schemas"),
    ],
    covers: ["gjs:VALUE_ADDED_TO_ENUM"],
    sdl: [
      "enum TestEnum { FIRST_VALUE } type Query { test: String }",
      "enum TestEnum { FIRST_VALUE SECOND_VALUE } type Query { test: String }",
    ],
    expect: [
      { at: "components/enums/TestEnum/**", action: "add", type: risky, mentions: ["TestEnum", "SECOND_VALUE"] },
    ],
  }),
  gql({
    id: "GQL-GJS-031",
    // ISSUE-127 (fixed) (P8a)
    area: "directives",
    title: "required argument added to a type-system directive",
    before: "directive @key on FIELD_DEFINITION",
    after: "directive @key(fields: String!) on FIELD_DEFINITION",
    rationale:
      "directive definitions are public surface (ASD §12.2): every application of @key in a schema built against this definition must now supply `fields`",
    annotation: "names the directive and the added argument (@key fields)",
    sources: [brk("should detect all breaking changes (NonNullDirectiveAdded)")],
    covers: ["gjs:REQUIRED_DIRECTIVE_ARG_ADDED"],
    sdl: [
      "directive @key on FIELD_DEFINITION type Query { a: String }",
      "directive @key(fields: String!) on FIELD_DEFINITION type Query { a: String }",
    ],
    expect: [{ at: "components/directives/key/**", action: "add", type: breaking, mentions: ["key", "fields"] }],
  }),
]

runCases("graphql", "graphql-js", cases, import.meta.filename)
