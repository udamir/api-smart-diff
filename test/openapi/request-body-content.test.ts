import { annotation, breaking, compareOpenApi, nonBreaking, risky } from "../../src"

const metaKey = Symbol("diff")
const s = { type: "string" }

const doc = (operation: Record<string, unknown>, components: Record<string, unknown> = {}) => ({
  openapi: "3.0.0",
  paths: { "/a": { post: { responses: { 200: { description: "ok" } }, ...operation } } },
  ...(Object.keys(components).length ? { components } : {}),
})
const body = (schema: unknown, extra: Record<string, unknown> = {}, mediaType = "application/json") => ({
  requestBody: { content: { [mediaType]: { schema } }, ...extra },
})
const diffsOf = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  compareOpenApi(doc(before), doc(after), { metaKey }).diffs

describe("Block C4 — OpenAPI request bodies and media types", () => {
  it("C4.1 adding an optional request body is non-breaking, removing a request body is breaking", () => {
    expect(diffsOf({}, body(s))).toMatchObject([{ action: "add", type: nonBreaking }])
    expect(diffsOf(body(s), {})).toMatchObject([{ action: "remove", type: breaking }])
  })

  // ISSUE-49 (fixed): `requestBodiesRules.$` is `[nonBreaking, breaking, breaking]` regardless of `required`; an operation that
  // suddenly requires a body rejects every existing client call.
  it("C4.2 adding a required request body is breaking", () => {
    expect(diffsOf({}, body(s, { required: true }))).toMatchObject([{ action: "add", type: breaking }])
  })

  it("C4.3 required flag: false -> true breaking, true -> false non-breaking", () => {
    expect(diffsOf(body(s), body(s, { required: true }))).toMatchObject([{ type: breaking }])
    expect(diffsOf(body(s, { required: true }), body(s))).toMatchObject([{ type: nonBreaking }])
  })

  it("C4.4 media types: add non-breaking, remove breaking", () => {
    const two = { requestBody: { content: { "application/json": { schema: s }, "text/plain": { schema: s } } } }
    expect(diffsOf(body(s), two)).toMatchObject([{ action: "add", type: nonBreaking }])
    expect(diffsOf(two, body(s))).toMatchObject([{ action: "remove", type: breaking }])
  })

  it("C4.5 media type parameters are ignored when matching", () => {
    const diffs = diffsOf(body(s, {}, "application/json;charset=utf-8"), body(s))
    expect(diffs.filter((d) => d.type === breaking)).toEqual([])
    expect(diffs.filter((d) => d.action === "remove" || d.action === "add")).toEqual([])
  })

  // ISSUE-21 (fixed)
  it("C4.6 reordering media types that include a wildcard produces no diffs", () => {
    const a = { requestBody: { content: { "application/json": { schema: s }, "application/*": { schema: s } } } }
    const b = { requestBody: { content: { "application/*": { schema: s }, "application/json": { schema: s } } } }
    expect(diffsOf(a, b)).toEqual([])
  })

  it("C4.7 request schemas use request semantics", () => {
    const obj = (props: Record<string, unknown>, required: string[] = []) => ({
      type: "object",
      properties: props,
      required,
    })
    expect(diffsOf(body(obj({ a: s })), body(obj({ a: s, b: s }, ["b"]))).every((d) => d.type === breaking)).toBe(true)
    // POLICY-03 decided (c), decision §11.14 (ISSUE-130 fixed): an optional request property removed is risky
    expect(diffsOf(body(obj({ a: s, b: s })), body(obj({ a: s })))).toMatchObject([{ type: risky }])
    expect(diffsOf(body({ type: "string", enum: ["a"] }), body({ type: "string", enum: ["a", "b"] }))).toMatchObject([
      { type: nonBreaking },
    ])
    expect(diffsOf(body(s), body({ type: "number" }))).toMatchObject([{ type: breaking }])
  })

  it("C4.8 encoding changes", () => {
    const enc = (contentType: string, extra: Record<string, unknown> = {}) => ({
      requestBody: {
        content: {
          "multipart/form-data": {
            schema: { type: "object", properties: { f: s } },
            encoding: { f: { contentType, ...extra } },
          },
        },
      },
    })
    expect(diffsOf(enc("text/plain"), enc("application/json"))).toMatchObject([{ type: breaking }])
    // ISSUE-70 (fixed): `style: form` is the Encoding Object default (no diff); an explicit non-default style is
    // non-breaking (POLICY-17 decided (b))
    expect(diffsOf(enc("text/plain"), enc("text/plain", { style: "form" }))).toEqual([])
    expect(diffsOf(enc("text/plain"), enc("text/plain", { style: "spaceDelimited" }))).toMatchObject([
      { type: nonBreaking },
    ])
    expect(diffsOf(enc("text/plain"), enc("text/plain", { headers: { "X-H": { schema: s } } }))).toMatchObject([
      { type: nonBreaking },
    ])
  })

  it("C4.9 description, example and examples are annotations", () => {
    expect(diffsOf(body(s), body(s, { description: "d" }))).toMatchObject([{ type: annotation }])
    const ex = { requestBody: { content: { "application/json": { schema: s, example: "x" } } } }
    expect(diffsOf(body(s), ex)).toMatchObject([{ type: annotation }])
    const exs = { requestBody: { content: { "application/json": { schema: s, examples: { one: { value: "x" } } } } } }
    expect(diffsOf(body(s), exs)).toMatchObject([{ type: annotation }])
  })

  it("C4.10 $ref request bodies are resolved and classified at the usage site", () => {
    const mk = (required: boolean) =>
      doc(
        { requestBody: { $ref: "#/components/requestBodies/B" } },
        { requestBodies: { B: { required, content: { "application/json": { schema: s } } } } },
      )
    const diffs = compareOpenApi(mk(false), mk(true), { metaKey }).diffs.filter((d) => d.path[0] === "paths")

    expect(diffs).toMatchObject([{ path: ["paths", "/a", "post", "requestBody", "required"], type: breaking }])
    expect(diffs[0].description).toContain("Request Body")
  })

  it("C4.11 every request body diff carries a description mentioning the request body", () => {
    const diffs = diffsOf(body(s), {
      requestBody: {
        required: true,
        description: "d",
        content: { "application/json": { schema: { type: "string", maxLength: 3 } }, "text/plain": { schema: s } },
      },
    })
    expect(diffs.length).toBeGreaterThanOrEqual(4)
    for (const d of diffs) {
      expect(d.description).toContain("Request Body")
    }
  })

  // POLICY-50 decided: in OpenAPI 3.1 `required` of a readOnly property applies to requests (3.1 dropped the 3.0 rule
  // "required applies to responses only"); a change inside a read-only request property stays non-breaking
  it("C4.12 required on a readOnly request property: 3.0 responses only, 3.1 requests too", () => {
    const mk = (openapi: string, required: string[], id: Record<string, unknown> = {}) => ({
      ...doc(body({ type: "object", properties: { id: { type: "integer", readOnly: true, ...id } }, required })),
      openapi,
    })
    const typesOf = (before: unknown, after: unknown) =>
      compareOpenApi(before, after, { metaKey }).diffs.map((d) => d.type)
    expect(typesOf(mk("3.0.3", []), mk("3.0.3", ["id"]))).toEqual([nonBreaking])
    expect(typesOf(mk("3.1.0", []), mk("3.1.0", ["id"]))).toEqual([breaking])
    expect(typesOf(mk("3.1.0", ["id"]), mk("3.1.0", ["id"], { maximum: 5 }))).toEqual([nonBreaking])
  })
})
