import { annotation, breaking, compareOpenApi, nonBreaking, unclassified } from "../../src"

const metaKey = Symbol("diff")
const base = { openapi: "3.0.0", paths: {} }
const diffsOf = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  compareOpenApi({ ...base, ...before }, { ...base, ...after }, { metaKey }).diffs

describe("Block C1 — OpenAPI document level", () => {
  it("C1.1 openapi version and info changes are annotations", () => {
    expect(diffsOf({ openapi: "3.0.0" }, { openapi: "3.0.3" })).toMatchObject([{ type: annotation }])
    const info = diffsOf(
      { info: { title: "a", version: "1", license: { name: "MIT" }, contact: { email: "a@b" } } },
      {
        info: { title: "b", version: "2", license: { name: "Apache" }, contact: { email: "c@d" }, termsOfService: "x" },
      },
    )
    expect(info).toHaveLength(5)
    expect(info.every((d) => d.type === annotation && d.description)).toBe(true)
  })

  it("C1.2 servers and server variables are annotations", () => {
    expect(diffsOf({}, { servers: [{ url: "https://a" }] })).toMatchObject([{ type: annotation }])
    expect(diffsOf({ servers: [{ url: "https://a" }] }, { servers: [{ url: "https://b" }] })).toMatchObject([
      { type: annotation },
    ])
    const vars = diffsOf(
      { servers: [{ url: "https://{env}.a", variables: { env: { default: "dev", enum: ["dev"] } } }] },
      { servers: [{ url: "https://{env}.a", variables: { env: { default: "prod", enum: ["dev", "prod"] } } }] },
    )
    expect(vars.every((d) => d.type === annotation)).toBe(true)
  })

  // ISSUE-38 (fixed): `/tags` and `/externalDocs` only classify the node itself; their children fall through to unclassified.
  it("C1.3 tag and externalDocs changes are annotations", () => {
    expect(diffsOf({ tags: [{ name: "t" }] }, { tags: [{ name: "t", description: "d" }] })).toMatchObject([
      { type: annotation },
    ])
    expect(diffsOf({ tags: [{ name: "t" }] }, { tags: [{ name: "t" }, { name: "u" }] })).toMatchObject([
      { type: annotation },
    ])
    expect(diffsOf({ externalDocs: { url: "a" } }, { externalDocs: { url: "b" } })).toMatchObject([
      { type: annotation },
    ])
  })

  it("C1.4 adding/removing the whole tags or externalDocs object is an annotation", () => {
    expect(diffsOf({}, { tags: [{ name: "t" }] })).toMatchObject([{ type: annotation }])
    expect(diffsOf({ externalDocs: { url: "a" } }, {})).toMatchObject([{ type: annotation }])
  })

  // POLICY-06 decided (d), decision §11.15 (ISSUE-131 fixed): an extension no prefix rule configures is an annotation
  // naming the key (was unclassified)
  it("C1.5 root vendor extensions are annotations naming the key", () => {
    const diffs = diffsOf({ "x-a": 1 }, { "x-a": 2 })
    expect(diffs).toMatchObject([{ type: annotation }])
    expect(diffs[0].description).toContain("x-a")
  })

  describe("global security", () => {
    const scheme = {
      components: {
        securitySchemes: { k: { type: "apiKey", in: "header", name: "X" }, b: { type: "http", scheme: "basic" } },
      },
    }

    it("C1.6 adding a global requirement to an unsecured API is breaking, removing it is non-breaking", () => {
      expect(diffsOf(scheme, { ...scheme, security: [{ k: [] }] })).toMatchObject([{ type: breaking }])
      expect(diffsOf({ ...scheme, security: [{ k: [] }] }, scheme)).toMatchObject([{ type: nonBreaking }])
    })

    it("C1.7 adding an alternative requirement is non-breaking", () => {
      expect(
        diffsOf({ ...scheme, security: [{ k: [] }] }, { ...scheme, security: [{ k: [] }, { b: [] }] }),
      ).toMatchObject([{ type: nonBreaking }])
    })

    // ISSUE-45 (fixed): `globalSecurityItemClassifyRule` classifies removing one of several alternatives as non-breaking while
    // the operation-level rule (`operationSecurityItemClassifyRule`) classifies the same change as breaking; clients
    // authenticating with the removed alternative break in both cases.
    it("C1.8 removing one of several global alternatives is breaking", () => {
      expect(
        diffsOf({ ...scheme, security: [{ k: [] }, { b: [] }] }, { ...scheme, security: [{ k: [] }] }),
      ).toMatchObject([{ type: breaking }])
    })

    // ISSUE-45 (fixed): requirement objects are compared key by key (`security/0/k` removed, `security/0/b` added) and no rule
    // exists below `/security/*`, so swapping the scheme is unclassified.
    it("C1.9 replacing the only requirement with an unrelated scheme is breaking", () => {
      const diffs = diffsOf({ ...scheme, security: [{ k: [] }] }, { ...scheme, security: [{ b: [] }] })
      expect(diffs.length).toBeGreaterThan(0)
      expect(diffs.every((d) => d.type !== unclassified)).toBe(true)
      expect(diffs.some((d) => d.type === breaking)).toBe(true)
    })

    it("C1.10 making the API public with an empty requirement is non-breaking", () => {
      expect(diffsOf({ ...scheme, security: [{ k: [] }] }, { ...scheme, security: [{ k: [] }, {}] })).toMatchObject([
        { type: nonBreaking },
      ])
    })
  })

  it("C1.11 identical complex documents produce no diffs", () => {
    const d = {
      info: { title: "t", version: "1" },
      servers: [{ url: "https://a" }],
      tags: [{ name: "t" }],
      security: [{ k: [] }],
      components: { securitySchemes: { k: { type: "apiKey", in: "header", name: "X" } } },
      paths: { "/a": { get: { responses: { 200: { description: "ok" } } } } },
    }
    expect(diffsOf(d, JSON.parse(JSON.stringify(d)))).toEqual([])
  })
})
