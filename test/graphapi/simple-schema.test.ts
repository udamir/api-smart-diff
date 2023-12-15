import { graphapi } from "../helpers"
import { compareGraphApi } from "../../src"

const metaKey = Symbol('diff')

describe("Build GraphApi", () => {

  it("should be nullable query for Scalar result", () => {
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
  })
})
