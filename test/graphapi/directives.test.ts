import { graphapi } from "../helpers"
import { DiffAction, compareGraphApi, deprecated, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol('diff')

describe("Compare GraphQL schemas with directives change", () => {

  it("should compare schemas with changes in arguments", () => {
    const before = graphapi`
      directive @limit(offset: Int = 0, limit: Int = 20) on FIELD | FIELD_DEFINITION

      type Object {
        id: ID!
        count: Int @limit
      }
      
      type Query {
        "A Query with 1 required argument and 1 optional argument"
        todo(
          id: ID!
  
          "A default value of false"
          isCompleted: Boolean = false
        ): Object
      }
    `

    const after = graphapi`
      directive @limit(offset: Int = 0, limit: Int = 20) on FIELD | FIELD_DEFINITION

      type Object {
        id: ID!
        count: Int
      }
      
      type Query {
        "A Query with 1 required argument and 1 optional argument"
        todo(
          id: ID!
  
          "A default value of false"
          isCompleted: Boolean = false @deprecated(reason: "not used")
        ): Object!
      }
    `

    const { diffs, merged } = compareGraphApi(before, after, { metaKey })

    expect(diffs.length).toEqual(4)
    diffs.forEach((diff) => {
      if (diff.type !== "unclassified") {
        expect(diff).toHaveProperty("description")
        expect(diff.description).not.toEqual("")
      }
    })
    
    expect(merged.queries.todo[metaKey]).toMatchObject({
      nullable: { type: nonBreaking, action: DiffAction.remove }
    })
    expect(merged.queries.todo.properties.count.directives[metaKey]).toMatchObject({
      limit: { type: unclassified, action: DiffAction.remove }
    })
    expect(merged.queries.todo.args.properties.isCompleted[metaKey]).toMatchObject({
      deprecated: { type: deprecated, action: DiffAction.add }
    })

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

    expect(diffs.length).toEqual(10)
  })
})
