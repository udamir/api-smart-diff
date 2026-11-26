import { compareGraphApi } from "../../src"
import { graphapi } from "../helpers"

const metaKey = Symbol("diff")

describe("GraphQL arguments", () => {
  it("should compare schemas with changes in operation arguments", () => {
    const before = graphapi`
      type Query {
        todo(
          id: ID!
          isCompleted: Boolean
        ): String
      }
    `

    const after = graphapi`
      type Query {
        todo(
          id: ID!
      
          "A default value of false"
          isCompleted: Boolean! = false

          newArgument: String
        ): String
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    expect(diffs.length).toEqual(4)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })
  })

  it("should compare schemas with changes in type arguments", () => {
    const before = graphapi`
      type Query {
        company(id: ID!): Company
      }

      type Company {
        id: ID!
        name: String
        offices(limit: Int!, after: ID): Office
      }

      type Office {
        id: ID!
        name: String
      }
    `

    const after = graphapi`
      type Query {
        company(id: ID!): Company
      }

      type Company {
        id: ID!
        name: String
        offices(limit: Int, after: ID): Office
      }

      type Office {
        id: ID!
        name: String
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    // ISSUE-53 (fixed): GraphApi 0.1.2 usages of a named type are nominal; the change is reported once, at the declaration (the count included the inlined usage site)
    expect(diffs.length).toEqual(1)
  })
})
