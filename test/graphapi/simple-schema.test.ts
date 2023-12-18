import { graphapi } from "../helpers"
import { compareGraphApi } from "../../src"

const metaKey = Symbol('diff')

// TODO:
// operations
// graphschema
// arguments
// directives

describe("Compare simple GraphQL schemas", () => {

  it("should compare schemas with changes in arguments", () => {
    const before = graphapi`
      type Query {
        "A Query with 1 required argument and 1 optional argument"
        todo(
          id: ID!
          isCompleted: Boolean
        ): String
      }
    `

    const after = graphapi`
      type Query {
        "A Query with 2 required argument and 0 optional argument"
        todo(
          id: ID!
      
          "A default value of false"
          isCompleted: Boolean! = false
        ): String!
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    expect(diffs.length).toEqual(5)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })
    
  })

  it("should be nullable query for Scalar result", () => {
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

    expect(diffs.length).toEqual(2)
  })
})
