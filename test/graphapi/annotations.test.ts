import { compareGraphApi, type Diff } from "../../src"
import { graphapi } from "../helpers"

// Expectations in this file come from GraphQL semantics, not from current output.
// Tests marked `it.failing` document known defects; the `// ISSUE-NN` comment names the defect.

const metaKey = Symbol("diff")

const sdl = (source: string) => graphapi(Object.assign([source], { raw: [source] }) as unknown as TemplateStringsArray)

const compare = (before: string, after: string) => compareGraphApi(sdl(before), sdl(after), { metaKey })

const pathOf = (diff: Diff) => diff.path.join("/")

const usageDiffs = (diffs: Diff[]) => diffs.filter((d) => d.path[0] !== "components")

describe("GraphQL annotations", () => {
  const pairs: [string, string][] = [
    ["type Query { q(a: String): String }", "type Query { q(a: String, b: String): String }"],
    ["type Query { q(a: String): String }", "type Query { q(a: String, b: String!): String }"],
    ["type Query { q(a: String, b: String): String }", "type Query { q(a: String): String }"],
    [
      "type Query { q(e: E): String } enum E { A B }",
      'type Query { q(e: E): String } enum E { A B @deprecated(reason: "x") }',
    ],
    ["type Query { t: T } type T { a: String! }", "type Query { t: T } type T { a: String b: Int }"],
    ["type Query { a: String }", 'type Query { "d" a: String @deprecated(reason: "x") }'],
  ]

  // ISSUE-26 (fixed): operation-level argument descriptions contain "Argument `undefined`"
  it("every non-components diff has a description without `undefined`", () => {
    for (const [before, after] of pairs) {
      const { diffs } = compare(before, after)
      for (const diff of usageDiffs(diffs)) {
        expect(typeof diff.description, pathOf(diff)).toBe("string")
        expect(diff.description, pathOf(diff)).not.toBe("")
        expect(diff.description, pathOf(diff)).not.toContain("undefined")
      }
    }
  })

  // ISSUE-26 (fixed): missing templates yield "[Replaced] " (deprecation reason) and "[Added]  to `a[]`" (list items)
  it("descriptions name the changed element after the action tag", () => {
    const cases = compare(
      'type Query { a: String @deprecated(reason: "x") q(a: String): String }',
      'type Query { a: String @deprecated(reason: "y") q(a: [String]): String }',
    )
    expect(cases.diffs.length).toBeGreaterThan(0)
    for (const diff of cases.diffs) {
      expect(diff.description, pathOf(diff)).not.toMatch(/^\[\w+\]\s*$/)
      expect(diff.description, pathOf(diff)).not.toMatch(/^\[\w+\]\s{2,}/)
    }
  })

  it("directive definition diffs under components have descriptions", () => {
    const { diffs } = compare("type Query { a: String }", "directive @x on FIELD_DEFINITION type Query { a: String }")
    expect(diffs[0].description).toMatch(/directive `@x`/)
  })

  // P8-rest (ISSUE-127 / 128 / 129 / 57, POLICY-90): the changed item is named once with its kind, the element it
  // belongs to separately
  describe("element descriptions", () => {
    const descriptions = (before: string, after: string) =>
      compare(before, after)
        .diffs.map((d) => d.description)
        .sort()
    const expectDescriptions = (before: string, after: string, expected: string[]) => {
      expect(descriptions(before, after)).toEqual([...expected].sort())
    }

    it("E-ANN.1 argument, field and input field added / removed", () => {
      expectDescriptions(
        "type Query { search(term: String): [String] } input F { a: Int }",
        "type Query { search(term: String, limit: Int): [String] } input F { a: Int b: Int }",
        ["[Added] argument `limit` to field `Query.search`", "[Added] input field `b` to input type `F`"],
      )
      expectDescriptions(
        "type Query { me: U } type U { age: Int name: String }",
        "type Query { me: U } type U { name: String }",
        ["[Removed] field `age` from object type `U`"],
      )
    })

    it("E-ANN.2 type, default value and deprecation of an argument", () => {
      expectDescriptions(
        "type Query { search(term: String, limit: Int = 10): [String] }",
        'type Query { search(term: Int, limit: Int = 20 @deprecated(reason: "use first")): [String] }',
        [
          "[Replaced] type of argument `term` of field `Query.search` from `String` to `Int`",
          "[Replaced] default value of argument `limit` of field `Query.search` from `10` to `20`",
          "[Added] deprecation with reason `use first` to argument `limit` of field `Query.search`",
        ],
      )
    })

    it("E-ANN.3 schema description and an applied directive's argument", () => {
      const directive = "directive @tag(name: String) on SCHEMA | OBJECT"
      expectDescriptions(
        `${directive} "The API" schema { query: Query } type Query { a: Item } type Item @tag(name: "x") { b: Int }`,
        `${directive} "The public API" schema { query: Query } type Query { a: Item } type Item @tag(name: "y") { b: Int }`,
        [
          "[Replaced] description of the schema from `The API` to `The public API`",
          "[Replaced] argument `name` of directive `@tag` on object type `Item` from `x` to `y`",
        ],
      )
    })

    it("E-ANN.4 enum value metadata", () => {
      expectDescriptions(
        "type Query { c: Color } enum Color { RED BLUE }",
        'type Query { c: Color } enum Color { "Warm" RED BLUE @deprecated(reason: "navy") }',
        [
          "[Added] description `Warm` to enum value `Color.RED`",
          "[Added] deprecation with reason `navy` to enum value `Color.BLUE`",
        ],
      )
    })

    it("E-ANN.5 list item nullability", () => {
      // GraphApi 1.0 marks non-null list items
      expect(descriptions("type Query { tags: [String] }", "type Query { tags: [String!] }")).toEqual([
        "[Added] non-null status to list items of field `Query.tags`",
      ])
    })

    // POLICY-95 decided (c): descriptions and deprecation reasons list their values shortened, on one line
    it("E-ANN.6 free-text values are shortened", () => {
      const long = "The pets of the store, including the adopted ones.\nSorted by name and then by age"
      expectDescriptions(
        'type Query { "All pets" pets: [String] @deprecated(reason: "use search") }',
        `type Query { """${long}""" pets: [String] @deprecated(reason: "${long.replace("\n", " ")}") }`,
        [
          "[Replaced] description of field `Query.pets` from `All pets` to `The pets of the store, including the adopted ones. Sorted…`",
          "[Replaced] deprecation reason of field `Query.pets` from `use search` to `The pets of the store, including the adopted ones. Sorted…`",
        ],
      )
    })
  })
})
