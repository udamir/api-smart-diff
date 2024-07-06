import { compareAsyncApi, nonBreaking } from "../../src"
import { yaml } from "../helpers"

const metaKey = Symbol("diff")

describe("Compare simple AsyncApi documents", () => {
  it("should compare simple AsyncApi documents", () => {
    const before = yaml`
      asyncapi: 2.6.0
      info:
        title: Hello world
        version: '0.1.0'
      channels:
        hello:
          publish:
            message:
              payload:
                type: string
    `

    const after = yaml`
      asyncapi: 2.6.0
      info:
        title: Hello world application
        version: '0.1.1'
      channels:
        hello:
          publish:
            message:
              payload:
                type: string
                pattern: '^hello .+$'
    `

    const { diffs, merged } = compareAsyncApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
    // diffs.forEach((diff) => {
    //   expect(diff).toHaveProperty("description")
    //   expect(diff.description).not.toEqual("")
    //   expect(diff.type).not.toEqual("unclassified")
    // })
  })

  it("should compare combinary message in AsyncApi documents", () => {
    const before = yaml`
      asyncapi: 2.6.0
      channels:
        hello:
          publish:
            message:
              oneOf:
                - payload:
                    type: string
                - payload:
                    type: number
    `

    const after = yaml`
      asyncapi: 2.6.0
      channels:
        hello:
          publish:
            message:
              oneOf:
              - payload:
                  type: string
              - payload:
                  type: object
              - payload:
                  type: number
    `

    const { diffs, merged } = compareAsyncApi(before, after, { metaKey })

    expect(diffs.length).toEqual(1)
    expect(diffs[0]).toMatchObject({ action: "add", type: nonBreaking })
    // diffs.forEach((diff) => {
    //   expect(diff).toHaveProperty("description")
    //   expect(diff.description).not.toEqual("")
    //   expect(diff.type).not.toEqual("unclassified")
    // })
  })

  it("should be nullable query for Scalar result", () => {
    const before = yaml`
      asyncapi: 2.5.0
      info:
        title: Example
        version: 0.1.0
      channels:
        user/signedup:
          subscribe:
            message:
              description: An event describing that a user signed up.
              payload:
                type: object
                properties:
                  fullName:
                    type: string
                  email:
                    type: string
                    format: email

    `

    const after = yaml`
      asyncapi: 2.5.0
      info:
        title: Example
        version: 0.1.0
      channels:
        user/signedup:
          subscribe:
            message:
              description: An event describing that a user just signed up.
              payload:
                type: object
                additionalProperties: false
                properties:
                  fullName:
                    type: string
                  email:
                    type: string
                    format: email
                  age:
                    type: integer
                    minimum: 18
    `

    const { diffs, merged } = compareAsyncApi(before, after, { metaKey })

    expect(diffs.length).toEqual(3)
  })
})
