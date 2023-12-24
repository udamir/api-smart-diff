import { compareGraphApi } from "../../src"
import { graphapi } from "../helpers"

const metaKey = Symbol('diff')

describe("GraphQL directives", () => {

  it("should compare schemas with changes in arguments", () => {
    const before = graphapi`
      directive @limit(offset: Int = 0, limit: Int = 20) on FIELD | FIELD_DEFINITION

      input Filter {
        id: [ID!]

        "A default value of false"
        isCompleted: Boolean = false
      }
      
      type Query {
        todos(
          filters: [Filter!]
        ): [String!] @limit
      }
    `

    const after = graphapi`
      directive @limit(offset: Int = 0, limit: Int = 30) on FIELD | FIELD_DEFINITION
      directive @example(value: String) on FIELD_DEFINITION | INPUT_FIELD_DEFINITION

      input Filter {
        id: [ID!] @example(value: ["1", "2"])

        "A default value of false"
        isCompleted: Boolean = false 
      }
      
      type Query {
        todos(
          filters: [Filter!] @deprecated(reason: "not used")
        ): [String!] @limit
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    expect(diffs.length).toEqual(5)
    diffs.forEach((diff) => {
      if (diff.type !== "unclassified") {
        expect(diff).toHaveProperty("description")
        expect(diff.description).not.toEqual("")
      }
    })
  })

  it("should ", () => {
    const before = graphapi`
      directive @example(value: String) on FIELD_DEFINITION
      
      type Query {
        todo: Object!
      }

      type Object {
        """Id of the object"""
        id: ID
        name: String @example(value: "dog")
      }
    `

    const after = graphapi`
      directive @example(value: String) on FIELD | FIELD_DEFINITION
      
      type Query {
        todo: Object!
      }

      type Object {
        """Id of the object"""
        id: ID
        name: String @example(value: "cat")
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
  })

  it("should ", () => {
    const before = graphapi`
      directive @example(value: String) on FIELD_DEFINITION
      directive @test(value: String) on FIELD | FIELD_DEFINITION
      
      type Query {
        todo: Object!
      }

      type Object {
        """Id of the object"""
        id: ID
        name: String @example(value: "dog") @test(value: "foo")
      }
    `

    const after = graphapi`
      directive @example(value: String) on FIELD | FIELD_DEFINITION
      directive @test2(value: String) on QUERY | FIELD_DEFINITION
      
      type Query {
        todo: Object!
      }

      type Object {
        """Id of the object"""
        id: ID
        name: String @example(value: "cat") @test2(value: "foo")
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    expect(diffs.length).toEqual(9)
  })
})
