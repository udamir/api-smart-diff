import { annotation, breaking, compareOpenApi, deprecated, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol("diff")

const doc = (params: unknown[], components: Record<string, unknown> = {}) => ({
  openapi: "3.0.0",
  paths: { "/a": { get: { parameters: params, responses: { 200: { description: "ok" } } } } },
  ...(Object.keys(components).length ? { components } : {}),
})
const q = (extra: Record<string, unknown> = {}) => ({ name: "q", in: "query", schema: { type: "string" }, ...extra })
const diffsOf = (before: unknown[], after: unknown[]) => compareOpenApi(doc(before), doc(after), { metaKey }).diffs

describe("Block C3 — OpenAPI parameters", () => {
  it("C3.1 adding a parameter: optional non-breaking, required breaking, required-with-default non-breaking", () => {
    expect(diffsOf([], [q()])).toMatchObject([{ action: "add", type: nonBreaking }])
    expect(diffsOf([], [q({ required: true })])).toMatchObject([{ action: "add", type: breaking }])
    expect(diffsOf([], [q({ required: true, schema: { type: "string", default: "x" } })])).toMatchObject([
      { type: nonBreaking },
    ])
  })

  it("C3.2 removing a parameter is breaking", () => {
    expect(diffsOf([q()], [])).toMatchObject([{ action: "remove", type: breaking }])
  })

  it("C3.3 required flag changes", () => {
    expect(diffsOf([q()], [q({ required: true })])).toMatchObject([
      { path: expect.arrayContaining(["required"]), type: breaking },
    ])
    expect(diffsOf([q({ required: true })], [q()])).toMatchObject([{ type: nonBreaking }])
    expect(diffsOf([q({ required: false })], [q()])).toEqual([])
  })

  // ISSUE-46 (fixed): the add slot of `parameterRequiredClassifyRule` is a plain `breaking`; only the replace slot checks for a
  // schema default, so `required: true` + `default` added together is breaking while `required: false -> true` with
  // the same default is non-breaking.
  it("C3.3b marking a parameter required together with a default is non-breaking", () => {
    const diffs = diffsOf([q()], [q({ required: true, schema: { type: "string", default: "x" } })])
    expect(diffs.every((d) => d.type === nonBreaking)).toBe(true)
  })

  it("C3.4 changing the location is a remove + add", () => {
    const diffs = diffsOf([q()], [{ ...q(), in: "header" }])
    expect(diffs).toHaveLength(2)
    expect(diffs).toContainEqual(expect.objectContaining({ action: "remove", type: breaking }))
    expect(diffs).toContainEqual(expect.objectContaining({ action: "add", type: nonBreaking }))
  })

  it("C3.5 renaming a query parameter is a remove + add, not a rename", () => {
    const diffs = diffsOf([q()], [{ ...q(), name: "q2" }])
    expect(diffs.map((d) => d.action).sort()).toEqual(["add", "remove"])
  })

  it("C3.6 header parameter schema type change is breaking", () => {
    const h = (type: string) => ({ name: "h", in: "header", schema: { type } })
    expect(diffsOf([h("string")], [h("integer")])).toMatchObject([{ type: breaking }])
  })

  // ISSUE-44 (fixed): `paramSchemaTypeClassifyRule` treats any scalar type change of a form-style query parameter as
  // non-breaking; a client sending "abc" for a parameter that is now an integer is rejected.
  it("C3.7 query parameter scalar type change (string -> integer) is breaking", () => {
    expect(diffsOf([q()], [q({ schema: { type: "integer" } })])).toMatchObject([{ type: breaking }])
  })

  it("C3.8 query parameter string <-> array follows form-style serialization rules", () => {
    expect(
      diffsOf([q()], [q({ schema: { type: "array", items: { type: "string" } } })]).every((d) => d.type !== breaking),
    ).toBe(true)
    expect(diffsOf([q({ schema: { type: "array", items: { type: "string" } } })], [q()])).toContainEqual(
      expect.objectContaining({ type: breaking }),
    )
  })

  it("C3.9 schema validators inside a parameter use request semantics", () => {
    expect(
      diffsOf([q({ schema: { type: "string", maxLength: 10 } })], [q({ schema: { type: "string", maxLength: 5 } })]),
    ).toMatchObject([{ type: breaking }])
    expect(
      diffsOf([q({ schema: { type: "string", enum: ["a"] } })], [q({ schema: { type: "string", enum: ["a", "b"] } })]),
    ).toMatchObject([{ type: nonBreaking }])
  })

  it("C3.10 style changes are breaking", () => {
    expect(diffsOf([q({ style: "form" })], [q({ style: "spaceDelimited" })])).toMatchObject([{ type: breaking }])
  })

  // ISSUE-14 (fixed): `transformParameterItem` forces `explode = true` whenever style is form and both sides define explode,
  // so an explicit change of explode is invisible.
  // POLICY-10 decided (a), ISSUE-133 (fixed): `explode` has no effect on a primitive value (annotation), so the
  // breaking case uses an array parameter
  it("C3.11 changing explode on a form-style parameter is breaking", () => {
    const arr = { schema: { type: "array", items: { type: "string" } } }
    expect(
      diffsOf([q({ style: "form", explode: false, ...arr })], [q({ style: "form", explode: true, ...arr })]),
    ).toMatchObject([{ type: breaking }])
    expect(
      diffsOf([q({ style: "form", explode: true, ...arr })], [q({ style: "form", explode: false, ...arr })]),
    ).toMatchObject([{ type: breaking }])
    expect(diffsOf([q({ style: "form", explode: true })], [q({ style: "form", explode: false })])).toMatchObject([
      { type: annotation },
    ])
  })

  // ISSUE-14 (fixed): the default value of explode (true for style=form) is not applied when only one side specifies it.
  it("C3.12 specifying the default explode value explicitly is not a change", () => {
    expect(diffsOf([q({ style: "form" })], [q({ style: "form", explode: true })])).toEqual([])
    expect(diffsOf([q()], [q({ style: "form", explode: true })])).toEqual([])
  })

  it("C3.13 description is an annotation, deprecated is 'deprecated'", () => {
    expect(diffsOf([q()], [q({ description: "d" })])).toMatchObject([{ type: annotation }])
    expect(diffsOf([q()], [q({ deprecated: true })])).toMatchObject([{ type: deprecated }])
    expect(diffsOf([q({ deprecated: false })], [q()])).toEqual([])
  })

  // ISSUE-17 (fixed): parameter fields without an explicit rule fall through to unclassified.
  it("C3.14 example/examples/allowEmptyValue/allowReserved changes are classified", () => {
    expect(diffsOf([q({ example: "a" })], [q({ example: "b" })])).toMatchObject([{ type: annotation }])
    expect(diffsOf([q()], [q({ examples: { one: { value: "a" } } })])).toMatchObject([{ type: annotation }])
    expect(diffsOf([q({ allowEmptyValue: true })], [q({ allowEmptyValue: false })])).toMatchObject([{ type: breaking }])
    expect(diffsOf([q({ allowReserved: true })], [q({ allowReserved: false })])).toMatchObject([{ type: breaking }])
  })

  // ISSUE-17 (fixed): parameters described with `content` instead of `schema` have no rules.
  it("C3.15 content-based parameter schema changes are classified", () => {
    const c = (type: string) => ({ name: "f", in: "query", content: { "application/json": { schema: { type } } } })
    const diffs = diffsOf([c("string")], [c("integer")])
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).not.toBe(unclassified)
  })

  it("C3.16 $ref parameters are resolved and classified at the usage site", () => {
    const mk = (required: boolean) =>
      compareOpenApi(
        doc([{ $ref: "#/components/parameters/Q" }], { parameters: { Q: q() } }),
        doc([{ $ref: "#/components/parameters/Q" }], { parameters: { Q: q({ required }) } }),
        { metaKey },
      ).diffs
    const usage = mk(true).filter((d) => d.path[0] === "paths")
    expect(usage).toMatchObject([{ path: ["paths", "/a", "get", "parameters", 0, "required"], type: breaking }])
    expect(usage[0].description).toContain("query parameter `q`")
  })

  it("C3.17 cookie parameters are supported", () => {
    expect(diffsOf([], [{ name: "c", in: "cookie", schema: { type: "string" } }])).toMatchObject([
      { type: nonBreaking },
    ])
  })

  it("C3.18 every parameter diff carries a description naming the parameter", () => {
    const diffs = diffsOf(
      [q(), { name: "h", in: "header", schema: { type: "string" } }],
      [q({ required: true, description: "d" })],
    )
    expect(diffs.length).toBeGreaterThanOrEqual(3)
    for (const d of diffs) {
      expect(d.description).toMatch(/parameter `(q|h)`/)
    }
  })
})
