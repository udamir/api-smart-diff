// The location columns of the portal's result table (docs/.vitepress/theme/location.ts): the API location of every
// diff, derived from its path, origin and scope against the documents of a real comparison, for every specification;
// and the raw YAML view of the diffs (diffsYaml in diff.ts).

import { load } from "js-yaml"

import type { CompareOptions, Diff } from "../../src"
import { analyzeTexts } from "../../docs/.vitepress/theme/analysis"
import { diffsYaml, plainValue, pointer } from "../../docs/.vitepress/theme/diff"
import { EXAMPLES } from "../../docs/.vitepress/theme/examples"
import { type DiffLocation, diffLocation, locationColumns } from "../../docs/.vitepress/theme/location"
import { PRESETS } from "../../docs/.vitepress/theme/presets"
import { buildReport, reportDiff } from "../../docs/.vitepress/theme/report"

/** compares two documents as the portal does and returns every diff pointer with its location */
const locate = (before: string, after: string): Record<string, DiffLocation> => {
  const analysis = analyzeTexts({ before, after })
  const diffs = analysis.comparison?.result?.diffs ?? []
  expect(analysis.locations).toHaveLength(diffs.length)
  return Object.fromEntries(
    diffs.map((diff, index) => [`${diff.action} ${pointer(diff.path)}`, analysis.locations![index]]),
  )
}

const pick = ({ method, target, part }: DiffLocation) => ({ method, target, part })

const OPENAPI_BEFORE = `openapi: 3.1.0
info: {title: Pets, version: "1"}
paths:
  /pets/{id}:
    parameters:
      - {name: id, in: path, required: true, schema: {type: string}}
    get:
      parameters:
        - $ref: '#/components/parameters/Limit'
      responses:
        "200":
          description: ok
          headers: {X-Rate: {schema: {type: integer}}}
          content: {application/json: {schema: {$ref: '#/components/schemas/Pet'}}}
    post:
      requestBody: {content: {application/json: {schema: {$ref: '#/components/schemas/Pet'}}}}
      callbacks:
        onEvent:
          '{$request.body#/url}':
            post:
              requestBody: {content: {application/json: {schema: {type: string}}}}
              responses: {"200": {description: ok}}
      responses: {"204": {description: done}}
webhooks:
  newPet:
    post:
      requestBody: {content: {application/json: {schema: {type: string}}}}
      responses: {"200": {description: ok}}
components:
  parameters:
    Limit: {name: limit, in: query, schema: {type: integer, maximum: 10}}
  schemas:
    Pet:
      type: object
      properties:
        name: {type: string}
`

const OPENAPI_AFTER = OPENAPI_BEFORE.replace(
  "required: true, schema: {type: string}",
  "required: true, schema: {type: integer}",
)
  .replace("maximum: 10", "maximum: 20")
  .replace("X-Rate: {schema: {type: integer}}", "X-Rate: {schema: {type: string}}")
  .replace(/schema: \{type: string\}\}\}\}\n( +)responses: \{"200"/g, 'schema: {type: number}}}}\n$1responses: {"200"')
  .replace("name: {type: string}", "name: {type: string}\n        tag: {type: string}")
  .replace(
    'responses: {"204": {description: done}}',
    'responses: {"204": {description: done}, "404": {description: missing}}',
  )

describe("docs portal / location", () => {
  it("D-LOC-001 location columns per engine (OpenAPI without the request / response column)", () => {
    const labels = (engine: string) => locationColumns(engine)?.map((column) => `${column.key}:${column.label}`)
    expect(labels("openapi")).toEqual(["method:Method", "target:Endpoint"])
    expect(labels("asyncapi")).toEqual(["method:Operation", "target:Channel", "part:Message"])
    expect(labels("graphapi")).toEqual(["method:Operation", "target:Field", "part:Arguments / Output"])
    expect(locationColumns("jsonschema")).toBeUndefined()
    expect(locationColumns(undefined)).toBeUndefined()
  })

  it("D-LOC-002 OpenAPI: method, endpoint and request / response part", () => {
    const locations = locate(OPENAPI_BEFORE, OPENAPI_AFTER)
    // the path-level parameter is moved into the operations by the transform: the merged document names it
    expect(pick(locations["replace /paths/~1pets~1{id}/get/parameters/1/schema/type"])).toEqual({
      method: "GET",
      target: "/pets/{id}",
      part: "parameter path id",
    })
    expect(pick(locations["replace /paths/~1pets~1{id}/post/parameters/0/schema/type"])).toEqual({
      method: "POST",
      target: "/pets/{id}",
      part: "parameter path id",
    })
    // a $ref parameter is resolved to its name
    const limit = locations["replace /paths/~1pets~1{id}/get/parameters/0/schema/maximum"]
    expect(limit.text).toBe("GET /pets/{id} · parameter query limit (via parameter Limit)")
    expect(limit.via).toBe("parameter Limit")
    expect(locations["replace /paths/~1pets~1{id}/get/responses/200/headers/X-Rate/schema/type"].text).toBe(
      "GET /pets/{id} · response 200 · header X-Rate",
    )
    expect(
      locations["add /paths/~1pets~1{id}/get/responses/200/content/application~1json/schema/properties/tag"].text,
    ).toBe("GET /pets/{id} · response 200 application/json (via schema Pet)")
    expect(
      locations["add /paths/~1pets~1{id}/post/requestBody/content/application~1json/schema/properties/tag"].text,
    ).toBe("POST /pets/{id} · request body application/json (via schema Pet)")
    expect(locations["add /paths/~1pets~1{id}/post/responses/404"].text).toBe("POST /pets/{id} · response 404")
  })

  it("D-LOC-003 OpenAPI: callbacks and webhooks", () => {
    const locations = locate(OPENAPI_BEFORE, OPENAPI_AFTER)
    const callback =
      locations[
        "replace /paths/~1pets~1{id}/post/callbacks/onEvent/{$request.body#~1url}/post/requestBody/content/application~1json/schema/type"
      ]
    expect(pick(callback)).toEqual({
      method: "POST",
      target: "/pets/{id}",
      part: "callback onEvent · POST {$request.body#/url} · request body application/json",
    })
    expect(pick(locations["replace /webhooks/newPet/post/requestBody/content/application~1json/schema/type"])).toEqual({
      method: "POST",
      target: "webhook newPet",
      part: "request body application/json",
    })
  })

  it("D-LOC-004 OpenAPI: a component lists the usages the engine reports", () => {
    const locations = locate(OPENAPI_BEFORE, OPENAPI_AFTER)
    const pet = locations["add /components/schemas/Pet/properties/tag"]
    expect(pick(pet)).toEqual({ method: "", target: "schema Pet", part: "" })
    expect(pet.usages).toEqual([
      "GET /pets/{id} · response 200 application/json",
      "POST /pets/{id} · request body application/json",
    ])
    expect(pet.text).toBe(
      "schema Pet · used in GET /pets/{id} · response 200 application/json; POST /pets/{id} · request body application/json",
    )
    expect(locations["replace /components/parameters/Limit/schema/maximum"].usages).toEqual([
      "GET /pets/{id} · parameter query limit",
    ])
  })

  it("D-LOC-005 OpenAPI: renames, document sections, the curated examples", () => {
    const example = (id: string) => EXAMPLES.find((item) => item.id === id)!
    const removed = example("openapi-operation-removed")
    const paths = locate(removed.before, removed.after)
    expect(paths["rename /paths"].target).toBe("/pets/{id} → /pets/{petId}")
    expect(paths["remove /paths/~1pets~1{id}/delete"].text).toBe("DELETE /pets/{id}")
    const renamed = example("openapi-component-rename")
    expect(locate(renamed.before, renamed.after)["rename /components/schemas"].text).toBe("schema Pet → Animal")
    const required = example("openapi-required-parameter")
    expect(locate(required.before, required.after)["add /paths/~1pets/get/parameters/0"].text).toBe(
      "GET /pets · parameter query owner",
    )
    const preset = PRESETS.find((item) => item.id === "openapi")!
    expect(pick(locate(preset.before, preset.after)["replace /info/version"])).toEqual({
      method: "",
      target: "info",
      part: "version",
    })
  })

  it("D-LOC-006 AsyncAPI 2.x: publish / subscribe, channel and message", () => {
    const preset = PRESETS.find((item) => item.id === "asyncapi2")!
    const locations = locate(preset.before, preset.after)
    expect(pick(locations["remove /channels/order~1created/subscribe/message/payload/required/1"])).toEqual({
      method: "subscribe",
      target: "order/created",
      part: "message OrderCreated · payload",
    })
    expect(locations["add /channels/order~1cancel/publish/message/payload/properties/requestedBy"].text).toBe(
      "publish · channel order/cancel · message payload",
    )
    expect(locations["remove /components/messages/OrderCreated/payload/required/1"].usages).toEqual([
      "subscribe · channel order/created · message OrderCreated · payload",
    ])
  })

  it("D-LOC-007 AsyncAPI 3.0: the operations of a channel, operations, renames", () => {
    const example = EXAMPLES.find((item) => item.id === "asyncapi3-operations")!
    const locations = locate(example.before, example.after)
    expect(pick(locations["add /channels/orderCancel/messages/CancelOrder/payload/properties/requestedBy"])).toEqual({
      method: "receive cancelOrder",
      target: "orderCancel",
      part: "message CancelOrder · payload",
    })
    expect(locations["remove /components/messages/OrderCreated/payload/properties/total"].usages).toEqual([
      "send onOrderCreated · channel orderCreated · message OrderCreated · payload",
    ])
    const preset = PRESETS.find((item) => item.id === "asyncapi3")!
    expect(locate(preset.before, preset.after)["add /operations/onOrderCreated/summary"].text).toBe(
      "send onOrderCreated · channel orderCreated",
    )
    const rename = EXAMPLES.find((item) => item.id === "asyncapi3-channel-rename")!
    expect(locate(rename.before, rename.after)["rename /channels"].text).toBe(
      "send onSignup · channel userSignup → userRegistration",
    )
  })

  it("D-LOC-008 GraphApi: operation kind, field, arguments vs output, components", () => {
    const preset = PRESETS.find((item) => item.id === "graphapi")!
    const locations = locate(preset.before, preset.after)
    expect(pick(locations["replace /queries/books/args/first/default"])).toEqual({
      method: "query",
      target: "books",
      part: "argument first",
    })
    expect(locations["add /queries/authorById"].text).toBe("query authorById")
    expect(locations["add /queries/author/deprecation"].text).toBe("query author · deprecation")
    expect(locations["replace /components/objects/Book/methods/year/type"].text).toBe(
      "object Book · field year · output",
    )
    expect(locations["remove /components/enums/Genre/values/HISTORY"].text).toBe("enum Genre · value HISTORY")
    expect(locations["add /components/unions/SearchResult/oneOf/2"].text).toBe("union SearchResult · member Magazine")

    const mutation = (type: string) => `graphapi: '1.0'
mutationTypeName: Mutation
mutations:
  addBook:
    args:
      title: {type: String, nonNull: true}
    type: ${type}
`
    const changed = locate(mutation("String"), mutation("Int"))
    expect(Object.values(changed).map((location) => location.text)).toEqual(["mutation addBook · output"])
  })

  it("D-LOC-009 JSON Schema: the pointer only", () => {
    const preset = PRESETS.find((item) => item.id === "jsonschema")!
    const locations = locate(preset.before, preset.after)
    expect(pick(locations["replace /properties/name/maxLength"])).toEqual({
      method: "",
      target: "/properties/name/maxLength",
      part: "",
    })
    const root: Diff = { type: "breaking", action: "replace", path: [], scope: "root", before: "a", after: "b" }
    expect(diffLocation(root, { engine: "jsonschema" }).text).toBe("/")
  })

  it("D-LOC-010 every example and preset gets a location for every diff, without documents too", () => {
    for (const item of [...EXAMPLES, ...PRESETS]) {
      const analysis = analyzeTexts({
        before: item.before,
        after: item.after,
        options: "options" in item ? (item.options as CompareOptions) : undefined,
      })
      const diffs = analysis.comparison!.result!.diffs
      expect(analysis.locations, item.id).toHaveLength(diffs.length)
      for (const location of analysis.locations!) {
        expect(location.text, item.id).toBeTruthy()
      }
      // without the documents (an index cannot be resolved) the location still has the path parts
      for (const diff of diffs) {
        expect(() => diffLocation(diff, { engine: analysis.engine! })).not.toThrow()
      }
    }
  })

  it("D-LOC-011 the report names the location of the reported diff and of the listed diffs", () => {
    const diff = reportDiff({
      type: "breaking",
      action: "replace",
      path: ["paths", "/pets", "get", "responses", "200"],
      scope: "response",
      description: "changed",
      location: "GET /pets · response 200",
    })
    expect(diff.location).toBe("GET /pets · response 200")
    expect(reportDiff({ type: "breaking", action: "add", path: [], scope: "root" })).not.toHaveProperty("location")
    const report = buildReport({
      kind: "classification",
      version: "2.0.0",
      origin: "online demo",
      spec: "OpenAPI 3.1.0",
      snippet: "apiCompare(before, after)",
      diff,
      diffs: [diff],
      before: { text: "a: 1", language: "yaml" },
      after: { text: "a: 2", language: "yaml" },
      userAgent: "test",
    })
    expect(report.fields.diffs).toContain(
      "- **breaking** replace `/paths/~1pets/get/responses/200` (response) at GET /pets · response 200: changed",
    )
  })
})

describe("docs portal / diffs as YAML", () => {
  it("D-YAML-001 the YAML is the diffs array of the comparison, nothing added", () => {
    const preset = PRESETS.find((item) => item.id === "openapi")!
    const analysis = analyzeTexts({ before: preset.before, after: preset.after })
    const diffs = analysis.comparison!.result!.diffs
    const text = diffsYaml(diffs)
    expect(load(text)).toEqual(JSON.parse(JSON.stringify(diffs)))
    // the fields in the order of the Diff type, JSON paths on one line
    expect(text.startsWith("- type: ")).toBe(true)
    expect(text).toContain('  path: ["paths", "/pets/{id}", "get", "parameters", 0, "name"]\n')
    expect(text).toMatch(/ {2}origin:\n {4}before: \["components", "schemas", "Pet", "required", 1\]\n/)
    expect(diffsYaml([])).toBe("[]\n")
  })

  it("D-YAML-002 values that are not plain JSON do not break the view", () => {
    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular
    const value = {
      fn: function named() {},
      sym: Symbol("meta"),
      big: BigInt(10),
      nan: Number.NaN,
      missing: undefined,
      list: [undefined, 1],
      date: new Date("2026-01-02T03:04:05Z"),
      circular,
      [Symbol("key")]: "hidden",
    }
    expect(plainValue(value)).toEqual({
      fn: "[function named]",
      sym: "Symbol(meta)",
      big: "10n",
      nan: "NaN",
      list: [null, 1],
      date: "2026-01-02T03:04:05.000Z",
      circular: { a: 1, self: "[circular]" },
    })
    const diff = { type: "annotation", action: "add", path: ["x"], scope: "root", after: value } as unknown as Diff
    const text = diffsYaml([diff])
    expect(text).toContain("fn: '[function named]'")
    expect(load(text)).toEqual([
      { type: "annotation", action: "add", path: ["x"], after: plainValue(value), scope: "root" },
    ])
  })
})
