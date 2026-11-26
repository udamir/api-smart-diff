import { compareAsyncApi, compareGraphApi, compareJsonSchema, compareOpenApi, jsonSchemaRules } from "../../src"
import { graphapi, yaml } from "../helpers"

const snapshot = (v: unknown) => JSON.stringify(v)
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

// ISSUE-03: the core hook writes transformed child nodes back into the parent (`bNode[bkey] = before`), so every
// transform that returns a shallow copy leaks into the caller's document whenever the parent was not itself copied.
// JSON Schema with allOf-merge enabled survives only because allof-merge deep-clones the root subtree first.
describe("Block A2 — compare must not mutate its inputs", () => {
  it("A2.1 compareJsonSchema (default rules) leaves both documents untouched", () => {
    const before = {
      type: "object",
      properties: { a: { type: "number", maximum: 10, exclusiveMaximum: true, example: 1 } },
    }
    const after = {
      type: "object",
      properties: { a: { type: "number", maximum: 5, exclusiveMaximum: true, examples: [1] } },
    }
    const [b0, a0] = [snapshot(before), snapshot(after)]

    compareJsonSchema(before, after)

    expect(snapshot(before)).toBe(b0)
    expect(snapshot(after)).toBe(a0)
  })

  it("A2.2 compareJsonSchema with notMergeAllOf leaves both documents untouched", () => {
    const before = { type: "object", properties: { a: { type: "number", maximum: 10, exclusiveMaximum: true } } }
    const after = clone(before)
    const b0 = snapshot(before)

    compareJsonSchema(before, after, { rules: jsonSchemaRules({ notMergeAllOf: true }) })

    expect(snapshot(before)).toBe(b0)
  })

  it("A2.3 compareOpenApi leaves both documents untouched (operation level)", () => {
    const doc = yaml`
      openapi: 3.0.0
      paths:
        /p:
          get:
            deprecated: false
            responses:
              '200':
                description: ok
    `
    const d0 = snapshot(doc)
    compareOpenApi(doc, clone(doc))
    expect(snapshot(doc)).toBe(d0)
  })

  it("A2.4 compareOpenApi leaves both documents untouched (schema level)", () => {
    const doc = yaml`
      openapi: 3.0.0
      paths:
        /p:
          get:
            responses:
              '200':
                description: ok
                content:
                  application/json:
                    schema:
                      type: number
                      maximum: 10
                      exclusiveMaximum: true
    `
    const d0 = snapshot(doc)
    compareOpenApi(doc, clone(doc))
    expect(snapshot(doc)).toBe(d0)
  })

  it("A2.5 compareAsyncApi leaves both documents untouched", () => {
    const before = yaml`
      asyncapi: 2.6.0
      channels:
        ch:
          publish:
            message:
              payload:
                type: string
    `
    const after = yaml`
      asyncapi: 2.6.0
      channels:
        ch:
          parameters: {}
          publish:
            message:
              payload:
                type: string
    `
    const b0 = snapshot(before)
    compareAsyncApi(before, after)
    expect(snapshot(before)).toBe(b0)
  })

  it("A2.6 compareGraphApi leaves both documents untouched", () => {
    const before = graphapi`type Query { q: E } enum E { A }`
    const after = graphapi`type Query { q: E } enum E { A B }`
    const [b0, a0] = [snapshot(before), snapshot(after)]

    compareGraphApi(before, after)

    expect(snapshot(before)).toBe(b0)
    expect(snapshot(after)).toBe(a0)
  })

  it("A2.7 the merged document does not alias the after document's containers", () => {
    const after = { a: { b: { c: 1 } } }
    const { merged } = compareJsonSchema({ a: { b: { c: 0 } } }, after)

    merged.a.b.c = 42
    expect(after.a.b.c).toBe(1)
  })
})
