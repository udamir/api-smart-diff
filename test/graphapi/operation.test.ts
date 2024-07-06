import { compareGraphApi } from "../../src"
import { graphapi } from "../helpers"

const metaKey = Symbol("diff")

describe("GraphQL operations", () => {
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
          isCompleted: Boolean!
        ): String!
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    diffs.forEach((diff) => {
      expect(diff).toHaveProperty("description")
      expect(diff.description).not.toEqual("")
      expect(diff.type).not.toEqual("unclassified")
    })
  })
})
