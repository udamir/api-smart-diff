import {
  compareGraphApi,
  breaking,
  nonBreaking,
  risky,
  annotation,
  deprecated,
  unclassified,
  type Diff,
} from "../../src"
import { graphapi } from "../helpers"

// Expectations in this file come from GraphQL semantics (what breaks a client), not from current output.
// Tests marked `it.failing` document known defects; the `// ISSUE-NN` comment names the defect.

const metaKey = Symbol("diff")

const sdl = (source: string) => graphapi(Object.assign([source], { raw: [source] }) as unknown as TemplateStringsArray)

const compare = (before: string, after: string) => compareGraphApi(sdl(before), sdl(after), { metaKey })

const pathOf = (diff: Diff) => diff.path.join("/")

const byPath = (diffs: Diff[], path: string) => {
  const diff = diffs.find((d) => pathOf(d) === path)
  expect(diff, `expected a diff at "${path}", got: ${diffs.map(pathOf).join(", ")}`).toBeDefined()
  return diff as Diff
}

// ISSUE-53 (fixed): a GraphApi 0.1.2 usage of a named type is nominal (like a 1.0 `typeDef`), so a change inside a
// named type is reported once, at its declaration under `components`, classified by the scopes that use the type; the
// expectations below formerly looked the change up at the inlined usage site (`queries/<op>/...`)
const declarationDiffs = (diffs: Diff[]) => diffs.filter((d) => d.path[0] === "components")

const hasMeta = (node: unknown): boolean => {
  if (typeof node !== "object" || node === null) return false
  if (Object.getOwnPropertySymbols(node).includes(metaKey)) return true
  return Object.values(node).some(hasMeta)
}

describe("GraphQL classification: operations", () => {
  // ISSUE-25 (fixed): adding a query/mutation/subscription is unclassified (operation root node has no classify rule)
  it("adding a query is non-breaking", () => {
    const { diffs } = compare("type Query { a: String }", "type Query { a: String b: String }")
    expect(diffs).toHaveLength(1)
    expect(byPath(diffs, "queries/b").type).toBe(nonBreaking)
  })

  // ISSUE-25 (fixed): removing an operation is unclassified
  it("removing a query is breaking", () => {
    const { diffs } = compare("type Query { a: String b: String }", "type Query { a: String }")
    expect(diffs).toHaveLength(1)
    expect(byPath(diffs, "queries/b").type).toBe(breaking)
  })

  // ISSUE-25 (fixed): removing an operation is unclassified
  it("removing a mutation is breaking", () => {
    const { diffs } = compare(
      "type Query { a: String } type Mutation { m: String n: String }",
      "type Query { a: String } type Mutation { m: String }",
    )
    expect(byPath(diffs, "mutations/n").type).toBe(breaking)
  })

  // ISSUE-39 (fixed): reversed `/type` rule makes a type *change* non-breaking on outputs; ISSUE-123 (fixed): the
  // GraphQL type of a usage is nominal, one type change at the usage node
  it("changing the return scalar type is breaking", () => {
    const { diffs } = compare("type Query { a: String }", "type Query { a: Int }")
    expect(byPath(diffs, "queries/a").type).toBe(breaking)
  })

  // ISSUE-41 (fixed): structurally identical named types are indistinguishable, only `title` changes (annotation)
  it("changing the return type to another object type is breaking", () => {
    const { diffs } = compare(
      "type Query { a: T } type T { x: String } type U { x: String }",
      "type Query { a: U } type T { x: String } type U { x: String }",
    )
    expect(diffs.some((d) => d.type === breaking)).toBe(true)
  })

  it("making the return type non-null is non-breaking", () => {
    const { diffs } = compare("type Query { a: String }", "type Query { a: String! }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(nonBreaking)
  })

  it("making the return type nullable is breaking", () => {
    const { diffs } = compare("type Query { a: String! }", "type Query { a: String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
  })

  it("making list items nullable is breaking", () => {
    const { diffs } = compare("type Query { a: [String!] }", "type Query { a: [String] }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
  })

  it("changing the description is an annotation", () => {
    const { diffs } = compare('type Query { "x" a: String }', 'type Query { "y" a: String }')
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(annotation)
  })

  it("adding @deprecated is a deprecation", () => {
    const { diffs } = compare("type Query { a: String }", 'type Query { a: String @deprecated(reason: "x") }')
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(deprecated)
  })

  it("changing the deprecation reason is a deprecation", () => {
    const { diffs } = compare(
      'type Query { a: String @deprecated(reason: "x") }',
      'type Query { a: String @deprecated(reason: "y") }',
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(deprecated)
  })
})

describe("GraphQL classification: arguments", () => {
  it("adding an optional argument is non-breaking", () => {
    const { diffs } = compare("type Query { q(a: String): String }", "type Query { q(a: String, b: String): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(nonBreaking)
  })

  // ISSUE-24 (fixed): args inherit reversed (response) semantics
  it("adding a required argument is breaking", () => {
    const { diffs } = compare("type Query { q(a: String): String }", "type Query { q(a: String, b: String!): String }")
    expect(diffs.some((d) => d.type === breaking)).toBe(true)
  })

  // ISSUE-25 (fixed): removing an argument clients may pass is breaking
  it("removing an optional argument is breaking", () => {
    const { diffs } = compare("type Query { q(a: String, b: String): String }", "type Query { q(a: String): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
  })

  // ISSUE-24 (fixed)
  it("making an argument non-null is breaking", () => {
    const { diffs } = compare("type Query { q(a: String): String }", "type Query { q(a: String!): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
  })

  // ISSUE-24 (fixed)
  it("making an argument nullable is non-breaking", () => {
    const { diffs } = compare("type Query { q(a: String!): String }", "type Query { q(a: String): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(nonBreaking)
  })

  // ISSUE-24 (fixed)
  it("adding a default to a required argument is non-breaking", () => {
    const { diffs } = compare("type Query { q(a: Int!): String }", "type Query { q(a: Int! = 1): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(nonBreaking)
  })

  // ISSUE-24 (fixed); POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: operations that omit the argument now get the default, so
  // the change is risky (was non-breaking)
  it("adding a default to an optional argument is risky", () => {
    const { diffs } = compare("type Query { q(a: Int): String }", "type Query { q(a: Int = 1): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(risky)
  })

  // ISSUE-24 (fixed)
  it("removing the default of a required argument is breaking", () => {
    const { diffs } = compare("type Query { q(a: Int! = 1): String }", "type Query { q(a: Int!): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
  })

  // ISSUE-24 (fixed)
  it("changing an argument type is breaking", () => {
    const { diffs } = compare("type Query { q(a: String): String }", "type Query { q(a: Int): String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
  })

  it("changing an argument description is an annotation", () => {
    const { diffs } = compare('type Query { q("x" a: String): String }', 'type Query { q("y" a: String): String }')
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(annotation)
  })

  it("deprecating an argument is a deprecation", () => {
    const { diffs } = compare(
      "type Query { q(a: String): String }",
      'type Query { q(a: String @deprecated(reason: "r")): String }',
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(deprecated)
  })
})

describe("GraphQL classification: object types", () => {
  it("adding a field is non-breaking", () => {
    const { diffs } = compare(
      "type Query { t: T } type T { a: String }",
      "type Query { t: T } type T { a: String b: String }",
    )
    expect(byPath(diffs, "components/objects/T/properties/b").type).toBe(nonBreaking)
  })

  // ISSUE-25 (fixed): clients selecting the removed field fail validation
  it("removing a field is breaking", () => {
    const { diffs } = compare(
      "type Query { t: T } type T { a: String b: String }",
      "type Query { t: T } type T { a: String }",
    )
    expect(byPath(diffs, "components/objects/T/properties/b").type).toBe(breaking)
  })

  // ISSUE-39 (fixed); ISSUE-123 (fixed): one nominal type change at the field
  it("changing a field type is breaking", () => {
    const { diffs } = compare("type Query { t: T } type T { a: String }", "type Query { t: T } type T { a: Int }")
    expect(byPath(diffs, "components/objects/T/properties/a").type).toBe(breaking)
  })

  // ISSUE-41 (fixed): custom scalars are `type: string` + `format`, so String -> Date is only a non-breaking format add
  it("changing a field type from String to a custom scalar is breaking", () => {
    const { diffs } = compare(
      "type Query { t: T } type T { a: String }",
      "scalar Date type Query { t: T } type T { a: Date }",
    )
    expect(declarationDiffs(diffs).some((d) => d.type === breaking)).toBe(true)
  })

  it("making a field nullable is breaking", () => {
    const { diffs } = compare("type Query { t: T } type T { a: String! }", "type Query { t: T } type T { a: String }")
    expect(byPath(diffs, "components/objects/T/required/0").type).toBe(breaking)
  })

  it("making a field non-null is non-breaking", () => {
    const { diffs } = compare("type Query { t: T } type T { a: String }", "type Query { t: T } type T { a: String! }")
    expect(byPath(diffs, "components/objects/T/required/0").type).toBe(nonBreaking)
  })

  // ISSUE-40 (fixed): the `interfaces` node itself has no classify rule, only `interfaces/*`
  it("implementing a first interface is neither breaking nor unclassified", () => {
    const { diffs } = compare(
      "type Query { t: T } interface I { a: String } type T { a: String }",
      "type Query { t: T } interface I { a: String } type T implements I { a: String }",
    )
    expect(diffs.length).toBeGreaterThan(0)
    for (const diff of diffs) {
      expect(diff.type).not.toBe(breaking)
      expect(diff.type).not.toBe(unclassified)
    }
  })

  // POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: clients matching on the interface may get a new concrete type (was an
  // annotation)
  it("implementing an additional interface is risky", () => {
    const { diffs } = compare(
      "type Query { t: T } interface I { a: String } interface J { a: String } type T implements I { a: String }",
      "type Query { t: T } interface I { a: String } interface J { a: String } type T implements I & J { a: String }",
    )
    expect(byPath(diffs, "components/objects/T/interfaces/1").type).toBe(risky)
  })
})

describe("GraphQL classification: input objects", () => {
  it("adding an optional input field is non-breaking", () => {
    const { diffs } = compare(
      "type Query { q(i: I): String } input I { a: String }",
      "type Query { q(i: I): String } input I { a: String b: String }",
    )
    expect(byPath(diffs, "components/inputObjects/I/properties/b").type).toBe(nonBreaking)
  })

  // ISSUE-24 (fixed)
  it("adding a required input field is breaking", () => {
    const { diffs } = compare(
      "type Query { q(i: I): String } input I { a: String }",
      "type Query { q(i: I): String } input I { a: String b: String! }",
    )
    expect(declarationDiffs(diffs).some((d) => d.type === breaking)).toBe(true)
  })

  // ISSUE-25 (fixed)
  it("removing an optional input field is breaking", () => {
    const { diffs } = compare(
      "type Query { q(i: I): String } input I { a: String b: String }",
      "type Query { q(i: I): String } input I { a: String }",
    )
    expect(byPath(diffs, "components/inputObjects/I/properties/b").type).toBe(breaking)
  })

  it("removing a required input field is breaking", () => {
    const { diffs } = compare(
      "type Query { q(i: I): String } input I { a: String b: String! }",
      "type Query { q(i: I): String } input I { a: String }",
    )
    expect(byPath(diffs, "components/inputObjects/I/properties/b").type).toBe(breaking)
  })

  // ISSUE-24 (fixed)
  it("making an input field non-null is breaking", () => {
    const { diffs } = compare(
      "type Query { q(i: I): String } input I { a: String }",
      "type Query { q(i: I): String } input I { a: String! }",
    )
    expect(byPath(diffs, "components/inputObjects/I/required/0").type).toBe(breaking)
  })
})

describe("GraphQL classification: enums", () => {
  // POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: a client with an exhaustive switch may fail on the new value (was breaking)
  it("adding a value to an output enum is risky", () => {
    const { diffs } = compare("type Query { e: E } enum E { A B }", "type Query { e: E } enum E { A B C }")
    expect(byPath(diffs, "components/enums/E/enum/2").type).toBe(risky)
  })

  it("removing a value from an output enum is non-breaking", () => {
    const { diffs } = compare("type Query { e: E } enum E { A B C }", "type Query { e: E } enum E { A B }")
    expect(byPath(diffs, "components/enums/E/enum/2").type).toBe(nonBreaking)
  })

  // ISSUE-24 (fixed)
  it("adding a value to an input-only enum is non-breaking", () => {
    const { diffs } = compare(
      "type Query { q(e: E): String } enum E { A B }",
      "type Query { q(e: E): String } enum E { A B C }",
    )
    expect(byPath(diffs, "components/enums/E/enum/2").type).toBe(nonBreaking)
  })

  // ISSUE-24 (fixed)
  it("removing a value from an input-only enum is breaking", () => {
    const { diffs } = compare(
      "type Query { q(e: E): String } enum E { A B C }",
      "type Query { q(e: E): String } enum E { A B }",
    )
    expect(byPath(diffs, "components/enums/E/enum/2").type).toBe(breaking)
  })

  it("deprecating an enum value is a deprecation", () => {
    const { diffs } = compare(
      "type Query { e: E } enum E { A B }",
      'type Query { e: E } enum E { A B @deprecated(reason: "x") }',
    )
    expect(byPath(diffs, "components/enums/E/values/B/deprecated").type).toBe(deprecated)
  })
})

describe("GraphQL classification: unions", () => {
  const types = "type A { a: String } type B { b: String }"

  // POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed: a client with an exhaustive switch over `__typename` may fail (was breaking)
  it("adding a union member is risky", () => {
    const { diffs } = compare(
      `type Query { u: U } ${types} union U = A`,
      `type Query { u: U } ${types} union U = A | B`,
    )
    expect(byPath(diffs, "components/unions/U/oneOf/1").type).toBe(risky)
  })

  // ISSUE-115 (fixed): operations spreading `... on B` stop validating, so removing a union member is breaking
  // (graphql-inspector UNION_MEMBER_REMOVED BREAKING)
  it("removing a union member is breaking", () => {
    const { diffs } = compare(
      `type Query { u: U } ${types} union U = A | B`,
      `type Query { u: U } ${types} union U = A`,
    )
    expect(byPath(diffs, "components/unions/U/oneOf/1").type).toBe(breaking)
  })
})

describe("GraphQL classification: scalars", () => {
  // ISSUE-25 (fixed): `components/scalars/*` add/remove is unclassified (no classify rule on the schema root)
  it("adding a custom scalar used by a new field is classified", () => {
    const { diffs } = compare(
      "type Query { t: T } type T { a: String }",
      "scalar Date type Query { t: T } type T { a: String d: Date }",
    )
    expect(byPath(diffs, "components/objects/T/properties/d").type).toBe(nonBreaking)
    for (const diff of diffs) {
      expect(diff.type).not.toBe(unclassified)
    }
  })

  it("changing @specifiedBy url is an annotation", () => {
    const { diffs } = compare(
      'scalar Date @specifiedBy(url: "http://a") type Query { d: Date }',
      'scalar Date @specifiedBy(url: "http://b") type Query { d: Date }',
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(annotation)
  })
})

describe("GraphQL classification: directives", () => {
  it("adding a directive definition is non-breaking", () => {
    const { diffs } = compare("type Query { a: String }", "directive @x on FIELD_DEFINITION type Query { a: String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(nonBreaking)
  })

  it("removing a directive definition is breaking", () => {
    const { diffs } = compare("directive @x on FIELD_DEFINITION type Query { a: String }", "type Query { a: String }")
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
  })

  // ISSUE-40 (fixed): `/locations` has an annotation rule but the per-item `/locations/*` diff has none;
  // ISSUE-120 (fixed), POLICY-20 decided (a): a location added is non-breaking (removed: breaking)
  it("adding a directive location is non-breaking", () => {
    const { diffs } = compare(
      "directive @x on FIELD_DEFINITION type Query { a: String }",
      "directive @x on FIELD_DEFINITION | OBJECT type Query { a: String }",
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(nonBreaking)
  })

  it("adding an optional directive argument is non-breaking", () => {
    const { diffs } = compare(
      "directive @x on FIELD_DEFINITION type Query { a: String }",
      "directive @x(v: String) on FIELD_DEFINITION type Query { a: String }",
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(nonBreaking)
  })

  it("adding a required directive argument is breaking", () => {
    const { diffs } = compare(
      "directive @x on FIELD_DEFINITION type Query { a: String }",
      "directive @x(v: String!) on FIELD_DEFINITION type Query { a: String }",
    )
    expect(diffs.some((d) => d.type === breaking)).toBe(true)
  })

  // ISSUE-40 (fixed): applying a directive to a field (`directives/*`) has no classify rule
  it("applying a directive to a field is classified", () => {
    const { diffs } = compare(
      "directive @x on FIELD_DEFINITION type Query { a: String }",
      "directive @x on FIELD_DEFINITION type Query { a: String @x }",
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).not.toBe(unclassified)
  })
})

describe("GraphQL classification: consistency", () => {
  const before = "type Query { q(i: I): String } input I { a: String }"
  const after = "type Query { q(i: I): String } input I { a: String b: String! }"

  // ISSUE-18 (regression guard): the diffs of an argument-only input object take the argument (input) semantics;
  // ISSUE-53 (fixed): they are reported once, at the declaration (the usage under `queries/q/args` is nominal)
  it("components.inputObjects diffs have the same type as the argument usage diffs", () => {
    const { diffs } = compare(before, after)
    expect(diffs.filter((d) => d.path[0] !== "components")).toEqual([])
    expect(byPath(diffs, "components/inputObjects/I/properties/b").type).toBe(breaking)
    expect(byPath(diffs, "components/inputObjects/I/required/0").type).toBe(breaking)
  })

  // ISSUE-18 (fixed): components.inputObjects.* is classified with output (reversed) semantics
  it("components.inputObjects required field addition is breaking", () => {
    const { diffs } = compare(before, after)
    expect(byPath(diffs, "components/inputObjects/I/required/0").type).toBe(breaking)
  })
})

describe("GraphQL classification: robustness", () => {
  const schema = `
    directive @x(v: String) on FIELD_DEFINITION
    scalar Date @specifiedBy(url: "http://a")
    interface N { id: ID! }
    type T implements N { id: ID! a: String @x(v: "1") }
    type V { b: [Date!]! }
    union U = T | V
    enum E { A B @deprecated(reason: "y") }
    input I { a: String b: String! = "x" }
    type Query { q(a: Int = 1, i: I, e: E): U @deprecated(reason: "x") }
    type Mutation { m(i: I!): T! }
    type Subscription { s: E }
  `

  it("identical schemas produce no diffs and no merge meta", () => {
    const { diffs, merged } = compare(schema, schema)
    expect(diffs).toHaveLength(0)
    expect(hasMeta(merged)).toBe(false)
  })

  it("comparing a $ref-free schema with itself leaves merged deep-equal to the input", () => {
    const plain = 'type Query { "d" q(a: Int = 1, b: [String!]): String! @deprecated(reason: "x") }'
    const { merged } = compare(plain, plain)
    expect(JSON.parse(JSON.stringify(merged))).toEqual(JSON.parse(JSON.stringify(sdl(plain))))
  })

  it("does not mutate the input documents", () => {
    const before = sdl(schema)
    const after = sdl(schema.replace("a: String @x", "a: Int @x").replace("B @deprecated", "B C @deprecated"))
    const beforeSnapshot = JSON.stringify(before)
    const afterSnapshot = JSON.stringify(after)
    const { diffs } = compareGraphApi(before, after, { metaKey })
    expect(diffs.length).toBeGreaterThan(0)
    expect(JSON.stringify(before)).toBe(beforeSnapshot)
    expect(JSON.stringify(after)).toBe(afterSnapshot)
  })
})
