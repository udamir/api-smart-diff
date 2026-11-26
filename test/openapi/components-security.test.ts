import { annotation, breaking, compareOpenApi, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol("diff")
const s = { type: "string" }
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

const doc = (paths: Record<string, unknown>, components: Record<string, unknown>) => ({
  openapi: "3.0.0",
  paths,
  components,
})
const resp = (schema: unknown) => ({
  responses: { 200: { description: "ok", content: { "application/json": { schema } } } },
})
const req = (schema: unknown) => ({
  requestBody: { content: { "application/json": { schema } } },
  responses: { 200: { description: "ok" } },
})
const pet = (required: string[]) => ({
  type: "object",
  required,
  properties: { id: s, ...(required.includes("name") ? { name: s } : {}) },
})

describe("Block C6 — components", () => {
  // ISSUE-18 (fixed): `components.schemas.*` are classified with request semantics regardless of where they are used, so the
  // same change is reported twice with contradictory types (non-breaking at the response usage, breaking under
  // components) and a changelog built from `diffs` shows a false breaking change.
  it("C6.1 a schema used only in responses does not produce breaking component diffs when a required property is added", () => {
    const mk = (required: string[]) => doc({ "/a": { get: resp(ref("Pet")) } }, { schemas: { Pet: pet(required) } })
    const { diffs } = compareOpenApi(mk(["id"]), mk(["id", "name"]), { metaKey })

    expect(diffs.filter((d) => d.path[0] === "paths").every((d) => d.type === nonBreaking)).toBe(true)
    expect(diffs.filter((d) => d.type === breaking)).toEqual([])
  })

  it("C6.2 a schema used in both a request and a response is classified per usage", () => {
    const mk = (required: string[]) =>
      doc({ "/a": { post: { ...req(ref("Pet")), ...resp(ref("Pet")) } } }, { schemas: { Pet: pet(required) } })
    const { diffs } = compareOpenApi(mk(["id"]), mk(["id", "name"]), { metaKey })

    const request = diffs.filter((d) => d.path[3] === "requestBody")
    const response = diffs.filter((d) => d.path[3] === "responses")
    expect(request.length).toBeGreaterThan(0)
    expect(response.length).toBeGreaterThan(0)
    expect(request.every((d) => d.type === breaking)).toBe(true)
    expect(response.every((d) => d.type === nonBreaking)).toBe(true)
  })

  // DESIGN_PROPOSALS §11.4: components are classified by the scopes that reference them; an unreferenced component
  // is `unclassified` (and described), `options.components: "unclassified"` opts out of usage-derived classification
  it("C6.3 removing an unreferenced schema is unclassified and described", () => {
    const { diffs } = compareOpenApi(doc({}, { schemas: { Unused: s } }), doc({}, { schemas: {} }), { metaKey })
    expect(diffs).toMatchObject([
      { path: ["components", "schemas", "Unused"], action: "remove", type: unclassified, scope: "components" },
    ])
    expect(diffs[0].description).toBeTruthy()
  })

  it("C6.3b options.components: 'unclassified' leaves every component diff unclassified", () => {
    const mk = (required: string[]) => doc({ "/a": { get: resp(ref("Pet")) } }, { schemas: { Pet: pet(required) } })
    const { diffs } = compareOpenApi(mk(["id"]), mk(["id", "name"]), { metaKey, components: "unclassified" })
    expect(diffs.filter((d) => d.path[0] === "components").every((d) => d.type === unclassified)).toBe(true)
    expect(diffs.filter((d) => d.path[0] === "paths").every((d) => d.type === nonBreaking)).toBe(true)
  })

  it("C6.4 nested $refs between components are followed from the usage site", () => {
    const mk = (type: string) =>
      doc(
        { "/a": { post: req(ref("Order")) } },
        {
          schemas: {
            Order: { type: "object", properties: { pet: ref("Pet") } },
            Pet: { type: "object", properties: { id: { type } } },
          },
        },
      )
    const diffs = compareOpenApi(mk("string"), mk("integer"), { metaKey }).diffs.filter((d) => d.path[0] === "paths")

    expect(diffs).toMatchObject([
      {
        path: [
          "paths",
          "/a",
          "post",
          "requestBody",
          "content",
          "application/json",
          "schema",
          "properties",
          "pet",
          "properties",
          "id",
          "type",
        ],
        type: breaking,
      },
    ])
  })

  describe("securitySchemes", () => {
    // the global requirement references the scheme: an unreferenced scheme is unclassified (POLICY-11 decided (a),
    // ISSUE-69 (fixed))
    const sec = (scheme: Record<string, unknown>) => ({
      ...doc({}, { securitySchemes: { k: scheme } }),
      security: [{ k: [] }],
    })

    it("C6.5 type/name/in/scheme changes are breaking, description and bearerFormat are annotations", () => {
      expect(
        compareOpenApi(
          sec({ type: "apiKey", in: "header", name: "X" }),
          sec({ type: "apiKey", in: "query", name: "X" }),
          { metaKey },
        ).diffs,
      ).toMatchObject([{ type: breaking }])
      expect(
        compareOpenApi(
          sec({ type: "apiKey", in: "header", name: "X" }),
          sec({ type: "apiKey", in: "header", name: "Y" }),
          { metaKey },
        ).diffs,
      ).toMatchObject([{ type: breaking }])
      expect(
        compareOpenApi(sec({ type: "http", scheme: "basic" }), sec({ type: "http", scheme: "bearer" }), { metaKey })
          .diffs,
      ).toMatchObject([{ type: breaking }])
      expect(
        compareOpenApi(
          sec({ type: "http", scheme: "bearer" }),
          sec({ type: "http", scheme: "bearer", bearerFormat: "JWT", description: "d" }),
          { metaKey },
        ).diffs.every((d) => d.type === annotation),
      ).toBe(true)
    })

    // ISSUE-17 (fixed): `/flows` is classified as a whole but has no child rules.
    it("C6.6 oauth2 flow details (urls, scopes) are classified", () => {
      const oauth = (scopes: Record<string, string>, url = "https://auth") =>
        sec({ type: "oauth2", flows: { authorizationCode: { authorizationUrl: url, tokenUrl: "https://t", scopes } } })
      const scopeAdded = compareOpenApi(oauth({ read: "r" }), oauth({ read: "r", write: "w" }), { metaKey }).diffs
      expect(scopeAdded).toHaveLength(1)
      expect(scopeAdded[0].type).not.toBe(unclassified)

      const urlChanged = compareOpenApi(oauth({ read: "r" }), oauth({ read: "r" }, "https://auth2"), { metaKey }).diffs
      expect(urlChanged).toHaveLength(1)
      expect(urlChanged[0].type).not.toBe(unclassified)
    })
  })
})

describe("Block C7 — operation security", () => {
  const schemes = {
    securitySchemes: {
      k: { type: "apiKey", in: "header", name: "X" },
      o: { type: "oauth2", flows: { implicit: { authorizationUrl: "https://a", scopes: { read: "r", write: "w" } } } },
    },
  }
  const opDoc = (security?: unknown[], global?: unknown[]) => ({
    openapi: "3.0.0",
    ...(global ? { security: global } : {}),
    paths: { "/a": { get: { responses: { 200: { description: "ok" } }, ...(security ? { security } : {}) } } },
    components: schemes,
  })

  it("C7.1 opening up a secured operation is non-breaking", () => {
    expect(compareOpenApi(opDoc([{ k: [] }]), opDoc([]), { metaKey }).diffs).toMatchObject([{ type: nonBreaking }])
  })

  // ISSUE-45 (fixed): `includeSecurity(value, undefined)` is vacuously true, so adding security to an operation of an API
  // without a global `security` list is classified non-breaking although every existing unauthenticated call breaks.
  it("C7.1b securing a previously public operation (no global security) is breaking", () => {
    expect(compareOpenApi(opDoc(), opDoc([{ k: [] }]), { metaKey }).diffs).toMatchObject([{ type: breaking }])
  })

  it("C7.2 an operation requirement equal to the global default is non-breaking", () => {
    expect(
      compareOpenApi(opDoc(undefined, [{ k: [] }]), opDoc([{ k: [] }], [{ k: [] }]), { metaKey }).diffs,
    ).toMatchObject([{ type: nonBreaking }])
  })

  it("C7.3 alternatives: adding one is non-breaking, removing one of several is breaking", () => {
    expect(compareOpenApi(opDoc([{ k: [] }]), opDoc([{ k: [] }, { o: ["read"] }]), { metaKey }).diffs).toMatchObject([
      { type: nonBreaking },
    ])
    expect(compareOpenApi(opDoc([{ k: [] }, { o: ["read"] }]), opDoc([{ k: [] }]), { metaKey }).diffs).toMatchObject([
      { type: breaking },
    ])
  })

  // ISSUE-45 (fixed): scopes use `addNonBreaking` (`[nonBreaking, breaking, breaking]`), but requiring an *additional* scope
  // rejects tokens that were valid before, while dropping a required scope accepts a superset of tokens.
  it("C7.4 requiring an additional scope is breaking, dropping a scope is non-breaking", () => {
    expect(
      compareOpenApi(opDoc([{ o: ["read"] }]), opDoc([{ o: ["read", "write"] }]), { metaKey }).diffs,
    ).toMatchObject([{ type: breaking }])
    expect(
      compareOpenApi(opDoc([{ o: ["read", "write"] }]), opDoc([{ o: ["read"] }]), { metaKey }).diffs,
    ).toMatchObject([{ type: nonBreaking }])
  })

  it("C7.5 reordering scopes is not a change", () => {
    expect(
      compareOpenApi(opDoc([{ o: ["read", "write"] }]), opDoc([{ o: ["write", "read"] }]), { metaKey }).diffs,
    ).toEqual([])
  })

  it("C7.6 operation security diffs carry a description", () => {
    const { diffs } = compareOpenApi(opDoc(), opDoc([{ k: [] }]), { metaKey })
    expect(diffs[0].description).toBeTruthy()
  })
})
