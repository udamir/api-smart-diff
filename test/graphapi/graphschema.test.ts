import { compareGraphApi } from "../../src"
import { graphapi } from "../helpers"

const metaKey = Symbol("diff")

describe("GraphQL schema", () => {
  it("should compare schemas with changes in enum", () => {
    const before = graphapi`
      type Query {
        episode(id: ID!): Episode
      }
      
      enum Episode {
          """episode 1"""
          NEWHOPE
          """episode 2"""
          EMPIRE @deprecated (reason: "was deleted")
          JEDI
          NEWEPISOE
      }
    `

    const after = graphapi`
      type Query {
        episode(id: ID!): Episode
      }
      
      enum Episode {
        """episode #1"""
        NEWHOPE
        """episode 2"""
        EMPIRE @deprecated (reason: "was deleted with really long reason which can explain why it was deleted")
        JEDI
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    // ISSUE-53 (fixed): usages of a named type are nominal; the change is reported once, at the declaration
    expect(diffs.length).toEqual(3)
    diffs.forEach((diff, i) => {
      if (i > 2) {
        return
      }
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })
  })

  it("should compare schemas with changes in union", () => {
    const before = graphapi`
      type Query {
        "A Query with 1 required argument and 1 optional argument"
        todo(
            id: ID!
    
            "A default value of false"
            isCompleted: Boolean = false
        ): Response
      }
      
      union Response = StringResponse | NumberResponse
      
      type StringResponse {
          title: String
      }
      
      type NumberResponse {
          index: Int
      }
    `

    const after = graphapi`
      type Query {
        "A Query with 1 required argument and 1 optional argument"
        todo(
            id: ID!
    
            "A default value of false"
            isCompleted: Boolean = false
        ): Response
      }
      
      union Response = StringResponse | NumberResponse | BooleanResponse
      
      type StringResponse {
          title: String
      }
      
      type NumberResponse {
          index: Int
      }
      
      type BooleanResponse {
          flag: Boolean
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    // ISSUE-53 (fixed): usages of a named type are nominal; the change is reported once, at the declaration
    expect(diffs.length).toEqual(2)
  })
})
