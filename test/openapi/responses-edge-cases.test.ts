import { annotation, breaking, compareOpenApi, nonBreaking, risky, unclassified } from "../../src"

const metaKey = Symbol("diff")

const doc = (responses: Record<string, unknown>, components: Record<string, unknown> = {}) => ({
  openapi: "3.0.0",
  paths: { "/a": { get: { responses } } },
  ...(Object.keys(components).length ? { components } : {}),
})
const json = (schema: unknown, extra: Record<string, unknown> = {}) => ({
  description: "ok",
  content: { "application/json": { schema } },
  ...extra,
})
const diffsOf = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  compareOpenApi(doc(before), doc(after), { metaKey }).diffs
const s = { type: "string" }

describe("Block C5 — OpenAPI responses", () => {
  // POLICY-13 decided (b), ISSUE-134 (fixed): removing a success response is breaking, a non-success one non-breaking
  it("C5.1 adding a response is non-breaking, removing one is breaking, description is an annotation", () => {
    expect(diffsOf({ 200: json(s) }, { 200: json(s), 404: { description: "nf" } })).toMatchObject([
      { action: "add", type: nonBreaking },
    ])
    expect(diffsOf({ 200: json(s), 201: { description: "c" } }, { 200: json(s) })).toMatchObject([
      { action: "remove", type: breaking },
    ])
    expect(diffsOf({ 200: json(s), 404: { description: "nf" } }, { 200: json(s) })).toMatchObject([
      { action: "remove", type: nonBreaking },
    ])
    expect(diffsOf({ 200: { description: "a" } }, { 200: { description: "b" } })).toMatchObject([{ type: annotation }])
  })

  it("C5.2 the default response is compared like any other", () => {
    expect(diffsOf({ default: json(s) }, { default: json({ type: "number" }) })).toHaveLength(1)
  })

  // ISSUE-01 (fixed): `caseInsensitiveKeyMappingResolver` lowercases the before key in the mapping, so a response code that
  // contains uppercase letters ("4XX", "5XX") is never matched with itself and its subtree is silently skipped.
  it("C5.3 changes inside a range response (5XX) are detected", () => {
    const { diffs, merged } = compareOpenApi(
      doc({ "5XX": { description: "a" } }),
      doc({ "5XX": { description: "b" } }),
      { metaKey },
    )

    expect(diffs).toMatchObject([{ path: ["paths", "/a", "get", "responses", "5XX", "description"], type: annotation }])
    expect(merged.paths["/a"].get.responses["5XX"].description).toBe("b")
  })

  it("C5.4 a content schema change inside a 4XX response is detected and breaking", () => {
    const diffs = diffsOf({ "4XX": json(s) }, { "4XX": json({ type: "number" }) })
    expect(diffs).toMatchObject([{ type: breaking }])
  })

  it("C5.5 5XX -> 5xx is not a semantic change", () => {
    const { diffs, merged } = compareOpenApi(
      doc({ "5XX": { description: "a" } }),
      doc({ "5xx": { description: "a" } }),
      { metaKey },
    )
    expect(diffs.filter((d) => d.type === breaking)).toEqual([])
    expect(merged.paths["/a"].get.responses["5xx"] ?? merged.paths["/a"].get.responses["5XX"]).toBeDefined()
  })

  it("C5.6 response schema changes use response semantics", () => {
    const obj = (props: Record<string, unknown>, required: string[] = []) => ({
      type: "object",
      properties: props,
      required,
    })
    expect(
      diffsOf({ 200: json(obj({ a: s })) }, { 200: json(obj({ a: s, b: s }, ["b"])) }).every(
        (d) => d.type === nonBreaking,
      ),
    ).toBe(true)
    expect(diffsOf({ 200: json(obj({ a: s, b: s }, ["b"])) }, { 200: json(obj({ a: s })) })).toContainEqual(
      expect.objectContaining({ type: breaking }),
    )
    // POLICY-05 decided (b), decision §11.14 (ISSUE-130 fixed): an enum value added to a response is risky (was breaking)
    expect(
      diffsOf({ 200: json({ type: "string", enum: ["a"] }) }, { 200: json({ type: "string", enum: ["a", "b"] }) }),
    ).toMatchObject([{ type: risky }])
  })

  // ISSUE-39 (fixed)
  it("C5.7 a response property type change is breaking", () => {
    expect(diffsOf({ 200: json(s) }, { 200: json({ type: "number" }) })).toMatchObject([{ type: breaking }])
  })

  // ISSUE-61 (fixed): header rules follow the direction. In a response the client reads the header: removing an
  // optional header and adding `required` (a stronger guarantee) are non-breaking (oasdiff).
  it("C5.8 response headers: add non-breaking, optional header removed non-breaking, required added non-breaking", () => {
    const h = (extra: Record<string, unknown> = {}) => ({ schema: s, ...extra })
    expect(
      diffsOf({ 200: { description: "ok" } }, { 200: { description: "ok", headers: { "X-H": h() } } }),
    ).toMatchObject([{ type: nonBreaking }])
    expect(
      diffsOf({ 200: { description: "ok", headers: { "X-H": h() } } }, { 200: { description: "ok" } }),
    ).toMatchObject([{ type: nonBreaking }])
    expect(
      diffsOf(
        { 200: { description: "ok", headers: { "X-H": h() } } },
        { 200: { description: "ok", headers: { "X-H": h({ required: true }) } } },
      ),
    ).toMatchObject([{ type: nonBreaking }])
  })

  // ISSUE-17 (fixed): `headersRules` has no `/schema` rule, so header schema changes are unclassified and undescribed.
  it("C5.9 response header schema changes are classified", () => {
    const diffs = diffsOf(
      { 200: { description: "ok", headers: { "X-H": { schema: s } } } },
      { 200: { description: "ok", headers: { "X-H": { schema: { type: "integer" } } } } },
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).toBe(breaking)
    expect(diffs[0].description).toBeTruthy()
  })

  // ISSUE-47 (fixed): HTTP header names are case-insensitive (and OAS says so for the `headers` map) but `headersRules` uses the
  // default case-sensitive object mapping, so `x-h` -> `X-H` is a breaking remove + add.
  it("C5.10 header names are matched case-insensitively", () => {
    const diffs = diffsOf(
      { 200: { description: "ok", headers: { "x-h": { schema: s } } } },
      { 200: { description: "ok", headers: { "X-H": { schema: s } } } },
    )
    expect(diffs.filter((d) => d.type === breaking)).toEqual([])
  })

  it("C5.11 content types: add non-breaking, remove breaking", () => {
    const two = { description: "ok", content: { "application/json": { schema: s }, "text/plain": { schema: s } } }
    expect(diffsOf({ 200: json(s) }, { 200: two })).toMatchObject([{ action: "add", type: nonBreaking }])
    expect(diffsOf({ 200: two }, { 200: json(s) })).toMatchObject([{ action: "remove", type: breaking }])
  })

  it("C5.12 $ref responses are resolved and reported at the usage site", () => {
    const mk = (type: string) =>
      doc(
        { 200: { $ref: "#/components/responses/R" } },
        { responses: { R: json({ type: "string", enum: type === "a" ? ["a"] : ["a", "b"] }) } },
      )
    const diffs = compareOpenApi(mk("a"), mk("b"), { metaKey }).diffs.filter((d) => d.path[0] === "paths")

    expect(diffs).toMatchObject([
      { path: ["paths", "/a", "get", "responses", "200", "content", "application/json", "schema", "enum", 1] },
    ])
    expect(diffs[0].description).toContain("Response 200")
  })

  // ISSUE-48 (fixed): the `/content/*/schema` rule picks response vs request semantics from the *crawl path*
  // (`isResponseSchema(path)`); inside the $ref sub-compare that path is relative to the response object, so the
  // schema of a `$ref` response (and of every `components.responses.*`) is classified with request semantics.
  it("C5.13 schema changes inside a $ref response use response semantics", () => {
    const mk = (values: string[]) =>
      doc({ 200: { $ref: "#/components/responses/R" } }, { responses: { R: json({ type: "string", enum: values }) } })
    const diffs = compareOpenApi(mk(["a"]), mk(["a", "b"]), { metaKey }).diffs.filter((d) => d.path[0] === "paths")
    // response semantics: an added enum value is risky (POLICY-05 decided (b), decision §11.14, ISSUE-130 fixed)
    expect(diffs).toMatchObject([{ type: risky }])
  })

  // ISSUE-17 (fixed): response `links` have no rules.
  it("C5.14 response link changes are classified", () => {
    const diffs = diffsOf(
      { 200: { description: "ok", links: { next: { operationId: "a" } } } },
      { 200: { description: "ok", links: { next: { operationId: "b" } } } },
    )
    expect(diffs).toHaveLength(1)
    expect(diffs[0].type).not.toBe(unclassified)
  })

  it("C5.15 response examples are annotations", () => {
    expect(
      diffsOf(
        { 200: json(s, {}) },
        { 200: { description: "ok", content: { "application/json": { schema: s, example: "x" } } } },
      ),
    ).toMatchObject([{ type: annotation }])
  })

  it("C5.16 every response diff carries a description mentioning the response code", () => {
    const diffs = diffsOf(
      { 200: json(s), 404: { description: "nf" } },
      { 200: json({ type: "string", enum: ["a"] }, { description: "changed" }), 500: { description: "e" } },
    )
    expect(diffs.length).toBeGreaterThanOrEqual(4)
    for (const d of diffs) {
      expect(d.description).toMatch(/Response (200|404|500)/)
    }
  })
})
