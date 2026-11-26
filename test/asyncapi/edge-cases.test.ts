import {
  compareAsyncApi,
  apiCompare,
  compareJsonSchema,
  breaking,
  nonBreaking,
  risky,
  annotation,
  unclassified,
} from "../../src"
import { discoverCompareEngine } from "../../src/api"
import { yaml } from "../helpers"

const metaKey = Symbol("diff")

const compare = (before: object, after: object) => compareAsyncApi(before, after, { metaKey })

const pathOf = (diff: { path: (string | number)[] }) => diff.path.join("/")

const pubPayload = (payload: object) => ({
  asyncapi: "2.6.0",
  channels: { ch: { publish: { message: { payload } } } },
})

const subPayload = (payload: object) => ({
  asyncapi: "2.6.0",
  channels: { ch: { subscribe: { message: { payload } } } },
})

const pubMessage = (message: object) => ({
  asyncapi: "2.6.0",
  channels: { ch: { publish: { message } } },
})

describe("AsyncApi 2.x edge cases", () => {
  describe("Document level", () => {
    it("info title and version change is an annotation", () => {
      const before = yaml`
        asyncapi: 2.6.0
        info:
          title: Hello
          version: '1.0.0'
        channels: {}
      `
      const after = yaml`
        asyncapi: 2.6.0
        info:
          title: Hello world
          version: '2.0.0'
        channels: {}
      `
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(2)
      expect(diffs.map(pathOf).sort()).toEqual(["info/title", "info/version"])
      for (const diff of diffs) {
        expect(diff).toMatchObject({ action: "replace", type: annotation })
      }
    })

    it("defaultContentType change is breaking", () => {
      const before = yaml`
        asyncapi: 2.6.0
        defaultContentType: application/json
        channels: {}
      `
      const after = yaml`
        asyncapi: 2.6.0
        defaultContentType: application/xml
        channels: {}
      `
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "replace", path: ["defaultContentType"], type: breaking })
    })

    it("server add, remove and url change are annotations", () => {
      const before = yaml`
        asyncapi: 2.6.0
        servers:
          prod:
            url: mqtt://prod.example.com
            protocol: mqtt
          legacy:
            url: mqtt://legacy.example.com
            protocol: mqtt
        channels: {}
      `
      const after = yaml`
        asyncapi: 2.6.0
        servers:
          prod:
            url: mqtt://prod2.example.com
            protocol: mqtt
          dev:
            url: mqtt://dev.example.com
            protocol: mqtt
        channels: {}
      `
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(3)
      expect(diffs).toContainEqual(
        expect.objectContaining({ action: "remove", path: ["servers", "legacy"], type: annotation }),
      )
      expect(diffs).toContainEqual(
        expect.objectContaining({ action: "add", path: ["servers", "dev"], type: annotation }),
      )
      expect(diffs).toContainEqual(
        expect.objectContaining({ action: "replace", path: ["servers", "prod", "url"], type: annotation }),
      )
    })

    // ISSUE-38 (fixed): root "/tags" and "/externalDocs" rules only classify the node itself, children (tags/*, externalDocs/url) fall through to unclassified
    it("root tags item add and externalDocs url change are annotations", () => {
      const before = yaml`
        asyncapi: 2.6.0
        tags:
          - name: user
        externalDocs:
          url: https://docs.example.com/v1
        channels: {}
      `
      const after = yaml`
        asyncapi: 2.6.0
        tags:
          - name: user
          - name: order
        externalDocs:
          url: https://docs.example.com/v2
        channels: {}
      `
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(2)
      expect(diffs).toContainEqual(expect.objectContaining({ action: "add", path: ["tags", 1], type: annotation }))
      expect(diffs).toContainEqual(
        expect.objectContaining({ action: "replace", path: ["externalDocs", "url"], type: annotation }),
      )
    })

    it("identical documents produce no diffs", () => {
      const doc = () => yaml`
        asyncapi: 2.6.0
        info:
          title: Hello
          version: '1.0.0'
        servers:
          prod:
            url: mqtt://prod.example.com
            protocol: mqtt
        channels:
          user/{id}:
            parameters:
              id:
                schema:
                  type: string
            publish:
              message:
                payload:
                  type: object
                  required: [a]
                  properties:
                    a:
                      type: string
      `
      const { diffs } = compare(doc(), doc())
      expect(diffs.length).toEqual(0)
    })

    it("merged document of identical inputs deep-equals the input (ignoring the symbol meta key)", () => {
      const doc = () => yaml`
        asyncapi: 2.6.0
        info:
          title: Hello
          version: '1.0.0'
        channels:
          user/{id}:
            parameters:
              id:
                schema:
                  type: string
            subscribe:
              message:
                contentType: application/json
                payload:
                  type: object
                  properties:
                    a:
                      type: string
      `
      const snapshot = JSON.stringify(doc())
      const { merged } = compare(doc(), doc())
      // JSON.stringify drops symbol keys, so this ignores the meta key
      expect(JSON.parse(JSON.stringify(merged))).toEqual(JSON.parse(snapshot))
    })
  })

  describe("Channels", () => {
    const channel = { publish: { message: { payload: { type: "string" } } } }

    it("adding a channel is non-breaking", () => {
      const before = { asyncapi: "2.6.0", channels: { a: channel } }
      const after = { asyncapi: "2.6.0", channels: { a: channel, b: channel } }
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "add", path: ["channels", "b"], type: nonBreaking })
    })

    it("removing a channel is breaking", () => {
      const before = { asyncapi: "2.6.0", channels: { a: channel, b: channel } }
      const after = { asyncapi: "2.6.0", channels: { a: channel } }
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "remove", path: ["channels", "b"], type: breaking })
    })

    it("adding a publish operation is non-breaking", () => {
      const op = { message: { payload: { type: "string" } } }
      const before = { asyncapi: "2.6.0", channels: { a: { subscribe: op } } }
      const after = { asyncapi: "2.6.0", channels: { a: { subscribe: op, publish: op } } }
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "add", path: ["channels", "a", "publish"], type: nonBreaking })
    })

    it("removing a publish operation is breaking", () => {
      const op = { message: { payload: { type: "string" } } }
      const before = { asyncapi: "2.6.0", channels: { a: { subscribe: op, publish: op } } }
      const after = { asyncapi: "2.6.0", channels: { a: { subscribe: op } } }
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "remove", path: ["channels", "a", "publish"], type: breaking })
    })

    it("adding a subscribe operation is non-breaking", () => {
      const op = { message: { payload: { type: "string" } } }
      const before = { asyncapi: "2.6.0", channels: { a: { publish: op } } }
      const after = { asyncapi: "2.6.0", channels: { a: { publish: op, subscribe: op } } }
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "add", path: ["channels", "a", "subscribe"], type: nonBreaking })
    })

    it("removing a subscribe operation is breaking", () => {
      const op = { message: { payload: { type: "string" } } }
      const before = { asyncapi: "2.6.0", channels: { a: { publish: op, subscribe: op } } }
      const after = { asyncapi: "2.6.0", channels: { a: { publish: op } } }
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "remove", path: ["channels", "a", "subscribe"], type: breaking })
    })

    it("channel description change is an annotation", () => {
      const before = { asyncapi: "2.6.0", channels: { a: { description: "old", ...channel } } }
      const after = { asyncapi: "2.6.0", channels: { a: { description: "new", ...channel } } }
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "replace", path: ["channels", "a", "description"], type: annotation })
    })

    it("channel parameter schema type change is breaking", () => {
      const before = yaml`
        asyncapi: 2.6.0
        channels:
          user/{id}:
            parameters:
              id:
                schema:
                  type: string
            publish:
              message:
                payload:
                  type: string
      `
      const after = yaml`
        asyncapi: 2.6.0
        channels:
          user/{id}:
            parameters:
              id:
                schema:
                  type: integer
            publish:
              message:
                payload:
                  type: string
      `
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({
        action: "replace",
        path: ["channels", "user/{id}", "parameters", "id", "schema", "type"],
        type: breaking,
      })
    })

    it("channel parameter description change is an annotation", () => {
      const before = yaml`
        asyncapi: 2.6.0
        channels:
          user/{id}:
            parameters:
              id:
                description: old
                schema:
                  type: string
      `
      const after = yaml`
        asyncapi: 2.6.0
        channels:
          user/{id}:
            parameters:
              id:
                description: new
                schema:
                  type: string
      `
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({
        action: "replace",
        path: ["channels", "user/{id}", "parameters", "id", "description"],
        type: annotation,
      })
    })
  })

  describe("Publish payload (request semantics)", () => {
    it("adding an optional property is non-breaking", () => {
      const before = pubPayload({ type: "object", properties: { a: { type: "string" } } })
      const after = pubPayload({ type: "object", properties: { a: { type: "string" }, b: { type: "string" } } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "add", type: nonBreaking })
      expect(pathOf(diffs[0])).toEqual("channels/ch/publish/message/payload/properties/b")
    })

    it("adding a required property is breaking", () => {
      const before = pubPayload({ type: "object", properties: { a: { type: "string" } } })
      const after = pubPayload({
        type: "object",
        required: ["b"],
        properties: { a: { type: "string" }, b: { type: "string" } },
      })
      const { diffs } = compare(before, after)
      expect(diffs.length).toBeGreaterThan(0)
      for (const diff of diffs) {
        expect(diff).toMatchObject({ action: "add", type: breaking })
      }
      expect(diffs.map(pathOf)).toContain("channels/ch/publish/message/payload/properties/b")
    })

    // POLICY-03 decided (c), decision §11.14 (ISSUE-130 fixed): a publisher still sending the property may have it
    // silently dropped, so the removal is risky (was non-breaking)
    it("removing a property is risky", () => {
      const before = pubPayload({ type: "object", properties: { a: { type: "string" }, b: { type: "string" } } })
      const after = pubPayload({ type: "object", properties: { a: { type: "string" } } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "remove", type: risky })
    })

    it("property type change is breaking", () => {
      const before = pubPayload({ type: "object", properties: { a: { type: "string" } } })
      const after = pubPayload({ type: "object", properties: { a: { type: "integer" } } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "replace", type: breaking })
      expect(pathOf(diffs[0])).toEqual("channels/ch/publish/message/payload/properties/a/type")
    })

    it("adding an enum value is non-breaking", () => {
      const before = pubPayload({ type: "string", enum: ["a", "b"] })
      const after = pubPayload({ type: "string", enum: ["a", "b", "c"] })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "add", type: nonBreaking })
    })

    it("removing an enum value is breaking", () => {
      const before = pubPayload({ type: "string", enum: ["a", "b", "c"] })
      const after = pubPayload({ type: "string", enum: ["a", "b"] })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "remove", type: breaking })
    })

    it("decreasing maxLength is breaking", () => {
      const before = pubPayload({ type: "string", maxLength: 10 })
      const after = pubPayload({ type: "string", maxLength: 5 })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "replace", type: breaking })
    })

    it("increasing maxLength is non-breaking", () => {
      const before = pubPayload({ type: "string", maxLength: 5 })
      const after = pubPayload({ type: "string", maxLength: 10 })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "replace", type: nonBreaking })
    })
  })

  describe("Subscribe payload (response semantics)", () => {
    it("adding a required property is non-breaking", () => {
      const before = subPayload({ type: "object", properties: { a: { type: "string" } } })
      const after = subPayload({
        type: "object",
        required: ["b"],
        properties: { a: { type: "string" }, b: { type: "string" } },
      })
      const { diffs } = compare(before, after)
      expect(diffs.length).toBeGreaterThan(0)
      for (const diff of diffs) {
        expect(diff).toMatchObject({ action: "add", type: nonBreaking })
      }
    })

    it("removing a required property is breaking", () => {
      const before = subPayload({
        type: "object",
        required: ["a", "b"],
        properties: { a: { type: "string" }, b: { type: "string" } },
      })
      const after = subPayload({ type: "object", required: ["a"], properties: { a: { type: "string" } } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toBeGreaterThan(0)
      for (const diff of diffs) {
        expect(diff).toMatchObject({ action: "remove", type: breaking })
      }
      expect(diffs.map(pathOf)).toContain("channels/ch/subscribe/message/payload/properties/b")
    })

    // ISSUE-39 (fixed): "/type" classify rule is [breaking, nonBreaking, breaking] with no reversed override, so a response-side type replace reverses to non-breaking; a consumer parsing a string that becomes an integer breaks
    it("property type change is breaking", () => {
      const before = subPayload({ type: "object", properties: { a: { type: "string" } } })
      const after = subPayload({ type: "object", properties: { a: { type: "integer" } } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "replace", type: breaking })
      expect(pathOf(diffs[0])).toEqual("channels/ch/subscribe/message/payload/properties/a/type")
    })

    // POLICY-05 decided (b), decision §11.14 (ISSUE-130 fixed): a new value can surprise a subscriber with an
    // exhaustive switch, so it is risky (was breaking)
    it("adding an enum value is risky", () => {
      const before = subPayload({ type: "string", enum: ["a", "b"] })
      const after = subPayload({ type: "string", enum: ["a", "b", "c"] })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "add", type: risky })
    })

    it("removing an enum value is non-breaking", () => {
      const before = subPayload({ type: "string", enum: ["a", "b", "c"] })
      const after = subPayload({ type: "string", enum: ["a", "b"] })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "remove", type: nonBreaking })
    })
  })

  describe("References", () => {
    it("payload $ref to components/schemas is classified at the usage path", () => {
      const doc = (type: string) => ({
        asyncapi: "2.6.0",
        channels: { ch: { publish: { message: { payload: { $ref: "#/components/schemas/S" } } } } },
        components: { schemas: { S: { type } } },
      })
      const { diffs } = compare(doc("string"), doc("integer"))
      expect(diffs).toContainEqual(
        expect.objectContaining({
          action: "replace",
          path: ["channels", "ch", "publish", "message", "payload", "type"],
          type: breaking,
        }),
      )
    })

    // ISSUE-23 (fixed): message $ref to components/messages is not resolved; the only diff is at components/messages/M/payload/type and it is unclassified
    it("message $ref to components/messages is classified at the usage path", () => {
      const doc = (type: string) => ({
        asyncapi: "2.6.0",
        channels: { ch: { publish: { message: { $ref: "#/components/messages/M" } } } },
        components: { messages: { M: { payload: { type } } } },
      })
      const { diffs } = compare(doc("string"), doc("integer"))
      expect(diffs).toContainEqual(
        expect.objectContaining({
          action: "replace",
          path: ["channels", "ch", "publish", "message", "payload", "type"],
          type: breaking,
        }),
      )
      for (const diff of diffs) {
        expect(diff.type).not.toEqual(unclassified)
      }
    })

    // ISSUE-23 (fixed): message trait $ref to components/messageTraits is not resolved; the only diff is at components/messageTraits/T/contentType and it is unclassified
    it("message trait $ref to components/messageTraits is classified at the usage path", () => {
      const doc = (contentType: string) => ({
        asyncapi: "2.6.0",
        channels: {
          ch: {
            publish: {
              message: { traits: [{ $ref: "#/components/messageTraits/T" }], payload: { type: "string" } },
            },
          },
        },
        components: { messageTraits: { T: { contentType } } },
      })
      const { diffs } = compare(doc("application/json"), doc("application/xml"))
      expect(diffs).toContainEqual(
        expect.objectContaining({
          action: "replace",
          path: ["channels", "ch", "publish", "message", "traits", 0, "contentType"],
          type: breaking,
        }),
      )
      for (const diff of diffs) {
        expect(diff.type).not.toEqual(unclassified)
      }
    })
  })

  describe("Message", () => {
    it("contentType change is breaking", () => {
      const before = pubMessage({ contentType: "application/json", payload: { type: "string" } })
      const after = pubMessage({ contentType: "application/xml", payload: { type: "string" } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({
        action: "replace",
        path: ["channels", "ch", "publish", "message", "contentType"],
        type: breaking,
      })
    })

    it("schemaFormat change is breaking", () => {
      const before = pubMessage({
        schemaFormat: "application/vnd.aai.asyncapi;version=2.6.0",
        payload: { type: "string" },
      })
      const after = pubMessage({
        schemaFormat: "application/vnd.apache.avro;version=1.9.0",
        payload: { type: "string" },
      })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({
        action: "replace",
        path: ["channels", "ch", "publish", "message", "schemaFormat"],
        type: breaking,
      })
    })

    it("name, title, summary and description changes are not breaking", () => {
      const before = pubMessage({ name: "a", title: "a", summary: "a", description: "a", payload: { type: "string" } })
      const after = pubMessage({ name: "b", title: "b", summary: "b", description: "b", payload: { type: "string" } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(4)
      for (const diff of diffs) {
        expect(diff.action).toEqual("replace")
        expect([nonBreaking, annotation]).toContain(diff.type)
      }
      expect(diffs.find((d) => pathOf(d).endsWith("/title"))?.type).toEqual(annotation)
      expect(diffs.find((d) => pathOf(d).endsWith("/summary"))?.type).toEqual(annotation)
      expect(diffs.find((d) => pathOf(d).endsWith("/description"))?.type).toEqual(annotation)
    })

    // ISSUE-23 (fixed): message headers are "allUnclassified" by rule, so a header property type change in a publish message is not reported as breaking
    it("headers property type change is breaking", () => {
      const before = pubMessage({
        headers: { type: "object", properties: { h: { type: "string" } } },
        payload: { type: "string" },
      })
      const after = pubMessage({
        headers: { type: "object", properties: { h: { type: "integer" } } },
        payload: { type: "string" },
      })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({
        action: "replace",
        path: ["channels", "ch", "publish", "message", "headers", "properties", "h", "type"],
        type: breaking,
      })
    })

    it("adding a oneOf message is non-breaking", () => {
      const before = pubMessage({ oneOf: [{ payload: { type: "string" } }] })
      const after = pubMessage({ oneOf: [{ payload: { type: "string" } }, { payload: { type: "number" } }] })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "add", type: nonBreaking })
    })

    it("removing a oneOf message is breaking", () => {
      const before = pubMessage({ oneOf: [{ payload: { type: "string" } }, { payload: { type: "number" } }] })
      const after = pubMessage({ oneOf: [{ payload: { type: "string" } }] })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({ action: "remove", type: breaking })
    })

    it("correlationId location change is breaking", () => {
      const before = pubMessage({ correlationId: { location: "$message.header#/a" }, payload: { type: "string" } })
      const after = pubMessage({ correlationId: { location: "$message.header#/b" }, payload: { type: "string" } })
      const { diffs } = compare(before, after)
      expect(diffs.length).toEqual(1)
      expect(diffs[0]).toMatchObject({
        action: "replace",
        path: ["channels", "ch", "publish", "message", "correlationId", "location"],
        type: breaking,
      })
    })
  })

  describe("Descriptions", () => {
    // ISSUE-23 (fixed): compareAsyncApi has no annotate hook, so no diff ever carries a human-readable description
    it("every diff has a non-empty description", () => {
      const pairs: [object, object][] = [
        [
          pubPayload({ type: "object", properties: { a: { type: "string" } } }),
          pubPayload({
            type: "object",
            required: ["b"],
            properties: { a: { type: "string" }, b: { type: "integer" } },
          }),
        ],
        [
          {
            asyncapi: "2.6.0",
            info: { title: "A", version: "1.0.0" },
            channels: { a: { description: "x", publish: { message: { payload: { type: "string" } } } } },
          },
          {
            asyncapi: "2.6.0",
            info: { title: "B", version: "1.0.1" },
            channels: { b: { description: "y", subscribe: { message: { payload: { type: "string" } } } } },
          },
        ],
      ]
      let total = 0
      for (const [before, after] of pairs) {
        const { diffs } = compare(before, after)
        total += diffs.length
        for (const diff of diffs) {
          expect(diff).toHaveProperty("description")
          expect(typeof diff.description).toEqual("string")
          expect(diff.description).not.toEqual("")
        }
      }
      expect(total).toBeGreaterThan(0)
    })
  })

  describe("Input mutation", () => {
    // ISSUE-03 (fixed): compareAsyncApi mutates its inputs (createFields transform adds "parameters: {}", jsonSchema transforms add "required: []")
    it("compareAsyncApi does not mutate before or after documents", () => {
      const before = yaml`
        asyncapi: 2.6.0
        channels:
          ch:
            publish:
              message:
                payload:
                  type: object
                  properties:
                    a:
                      type: string
      `
      const after = yaml`
        asyncapi: 2.6.0
        channels:
          ch:
            parameters:
              id:
                schema:
                  type: string
            publish:
              message:
                payload:
                  type: object
                  required: [a]
                  properties:
                    a:
                      type: string
      `
      const beforeSnapshot = JSON.stringify(before)
      const afterSnapshot = JSON.stringify(after)
      compare(before, after)
      expect(JSON.stringify(before)).toEqual(beforeSnapshot)
      expect(JSON.stringify(after)).toEqual(afterSnapshot)
    })
  })

  describe("Versions", () => {
    it("compareAsyncApi compares AsyncAPI 3.x documents with the 3.x profile (DESIGN_PROPOSALS §11.7)", () => {
      const doc = { asyncapi: "3.0.0", channels: {} }
      expect(compare(doc, { ...doc }).diffs).toEqual([])
    })

    it("compareAsyncApi throws when major versions differ", () => {
      const before = { asyncapi: "2.6.0", channels: {} }
      const after = { asyncapi: "3.0.0", channels: {} }
      expect(() => compare(before, after)).toThrow(/Unsupported version/)
    })

    // ISSUE-29 (fixed, DESIGN_PROPOSALS §11.3): AsyncAPI 3.x documents are routed to the AsyncAPI engine
    it("discoverCompareEngine routes AsyncAPI 3.x to the AsyncAPI engine", () => {
      const before = { asyncapi: "3.0.0", channels: {} }
      expect(discoverCompareEngine(before)).toBe(compareAsyncApi)
    })
  })
})

describe("AsyncApi traits (POLICY-81)", () => {
  // a 3.0 message whose second trait supplies `headers` / `correlationId` over the first one (later traits win)
  const doc = (first: Record<string, unknown>, shadowed = true) => ({
    asyncapi: "3.0.0",
    info: { title: "t", version: "1" },
    channels: {
      c: {
        address: "c",
        messages: {
          m: {
            payload: { type: "string" },
            traits: shadowed
              ? [
                  first,
                  {
                    headers: { type: "object", properties: { a: { type: "string" } } },
                    correlationId: { location: "$message.header#/b" },
                  },
                ]
              : [first],
          },
        },
      },
    },
    operations: {
      o: { action: "send", channel: { $ref: "#/channels/c" }, messages: [{ $ref: "#/channels/c/messages/m" }] },
    },
  })

  it("H15 a change inside a trait field the effective message does not use is an annotation", () => {
    const { diffs } = compare(
      doc({ correlationId: { location: "$message.header#/a" } }),
      doc({ correlationId: { location: "$message.header#/x" } }),
    )
    expect(diffs).toMatchObject([
      { path: ["channels", "c", "messages", "m", "traits", 0, "correlationId", "location"], type: annotation },
    ])
  })

  // ISSUE-260 (fixed) (P8-rest): POLICY-81 reaches schema-valued trait fields (`headers`, lazily built schema rules), so
  // a change in a shadowed trait's headers is an annotation (the effective message keeps the second trait's headers)
  it("H16 a change inside schema-valued trait headers the effective message does not use is an annotation", () => {
    const headers = (type: string) => ({ headers: { type: "object", properties: { a: { type } } } })
    const { diffs } = compare(doc(headers("string")), doc(headers("integer")))
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.every((d) => d.type === annotation)).toBe(true)
  })

  it("H17 a change inside the trait headers the effective message uses keeps its schema classification", () => {
    const { diffs } = compare(
      doc({ headers: { type: "object", properties: { a: { type: "string" } } } }, false),
      doc({ headers: { type: "object", properties: { a: { type: "integer" } } } }, false),
    )
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.some((d) => d.type !== annotation)).toBe(true)
  })
})

// ISSUE-78 (fixed) (P8-rest), POLICY-100 / POLICY-101 decided (P8c): a channel / channel message / component whose
// references all moved to a new key is one rename annotation at its map; its content is compared old against new
describe("AsyncApi renamed entries (ISSUE-78, POLICY-100 / 101)", () => {
  const doc = (channel: string, operationRef: string) => ({
    asyncapi: "3.0.0",
    info: { title: "t", version: "1" },
    channels: { [channel]: { address: "user/signup", messages: { event: { payload: { type: "string" } } } } },
    operations: {
      onSignup: {
        action: "send",
        channel: { $ref: `#/channels/${operationRef}` },
        messages: [{ $ref: `#/channels/${operationRef}/messages/event` }],
      },
    },
  })

  it("H18 a channel key renamed with every reference repointed is one rename annotation naming both keys", () => {
    const { diffs, merged } = compare(doc("userSignup", "userSignup"), doc("userRegistration", "userRegistration"))
    expect(diffs.map((d) => [d.action, d.type, d.path.join("/"), d.description])).toEqual([
      ["rename", annotation, "channels", "[Renamed] channel `userSignup` to `userRegistration`"],
    ])
    // the merged document carries the rename on the new key
    expect((merged as any).channels[metaKey].userRegistration).toMatchObject({ action: "rename", type: annotation })
  })

  // POLICY-101 decided (P8c): the former expectation was "not a rename" (a breaking removal plus an addition)
  it("H19 a renamed channel whose definition changed is a rename plus the change, classified on its own", () => {
    const after = doc("userRegistration", "userRegistration")
    after.channels.userRegistration.address = "user/register"
    const { diffs } = compare(doc("userSignup", "userSignup"), after)
    expect(diffs.map((d) => [d.action, d.type, d.path.join("/")])).toEqual([
      ["rename", annotation, "channels"],
      ["replace", breaking, "channels/userSignup/address"],
    ])
  })

  it("H21 a changed channel to which only some references moved is not a rename", () => {
    const before = doc("userSignup", "userSignup")
    const after = doc("userRegistration", "userRegistration")
    after.channels.userRegistration.address = "user/register"
    ;(before.operations as any).onAudit = { action: "send", channel: { $ref: "#/channels/userSignup" } }
    ;(after.channels as any).audit = { address: "audit" }
    ;(after.operations as any).onAudit = { action: "send", channel: { $ref: "#/channels/audit" } }
    const { diffs } = compare(before, after)
    expect(diffs.some((d) => d.action === "rename")).toBe(false)
    expect(diffs.some((d) => d.action === "remove" && d.path.join("/") === "channels/userSignup")).toBe(true)
  })
})

// POLICY-95 decided (c): free-text values (descriptions, summaries, titles) are listed shortened, on one line
describe("AsyncApi free-text values (POLICY-95)", () => {
  it("H20 a changed description, summary or tag description lists its values shortened", () => {
    const long = "Published when a user signs up, after the e-mail address was verified.\nCarries the profile."
    const doc = (description: string, summary: string, tag: string) => ({
      asyncapi: "2.6.0",
      info: { title: "t", version: "1" },
      channels: { "user/signup": { description, subscribe: { summary, message: { payload: { type: "string" } } } } },
      tags: [{ name: "users", description: tag }],
    })
    const { diffs } = compare(doc("Sign-ups", "On sign-up", "Users"), doc(long, "On every sign-up", long))
    expect(diffs.map((d) => d.description).sort()).toEqual(
      [
        "[Replaced] `description` of channel `user/signup` from `Sign-ups` to `Published when a user signs up, after the e-mail address…`",
        "[Replaced] `summary` of subscribe operation of channel `user/signup` from `On sign-up` to `On every sign-up`",
        "[Replaced] `description` of tag `users` from `Users` to `Published when a user signs up, after the e-mail address…`",
      ].sort(),
    )
  })
})

// ISSUE-300 (fixed): the property path of a schema change and the container of the schema were read from key names,
// so a channel, message, parameter, component or property named like a schema keyword or an AsyncAPI field was read as
// one ("type definition of `[].id`", "in message payload of channel `payload`"); the schema root and the containers are
// now known from the rules (`kind`)
describe("AsyncApi keyword-like names (ISSUE-300)", () => {
  const names = [
    "items",
    "properties",
    "patternProperties",
    "additionalProperties",
    "allOf",
    "enum",
    "type",
    "if",
    "not",
    "schema",
    "payload",
    "headers",
    "messages",
    "channels",
  ]
  const object = (type: string) => ({ type: "object", properties: { id: { type } } })

  it("H22 2.6: channel, parameter, message, header property and schema component names", () => {
    const doc = (type: string, name: string) => ({
      asyncapi: "2.6.0",
      info: { title: "t", version: "1" },
      channels: {
        [name]: {
          parameters: { [name]: { schema: object(type) } },
          subscribe: { message: { $ref: `#/components/messages/${name}` } },
        },
      },
      components: {
        messages: {
          [name]: {
            headers: { type: "object", properties: { [name]: object(type) } },
            payload: { $ref: `#/components/schemas/${name}` },
          },
        },
        schemas: { [name]: object(type) },
      },
    })
    for (const name of names) {
      const texts = compare(doc("string", name), doc("integer", name)).diffs.map((d) => d.description)
      const change = "[Replaced] type definition of `id` from `string` to `integer`"
      const nested = `[Replaced] type definition of \`${name}.id\` from \`string\` to \`integer\``
      expect(texts).toEqual([
        `${change} in parameter \`${name}\` of channel \`${name}\``,
        `${nested} in subscribe message headers of channel \`${name}\``,
        `${change} in subscribe message payload of channel \`${name}\``,
        `${nested} in message \`${name}\``,
        `${change} in schema component \`${name}\``,
      ])
    }
  })

  it("H23 3.0: channel and message names, a Multi Format Schema Object payload", () => {
    const doc = (type: string, name: string) => ({
      asyncapi: "3.0.0",
      info: { title: "t", version: "1" },
      channels: {
        [name]: {
          address: "a",
          messages: {
            [name]: { payload: object(type) },
            wrapped: {
              payload: {
                schemaFormat: "application/schema+json;version=draft-07",
                schema: { type: "object", properties: { [name]: object(type) } },
              },
            },
          },
        },
      },
      operations: {
        op: {
          action: "send",
          channel: { $ref: `#/channels/${name}` },
          messages: [{ $ref: `#/channels/${name}/messages/${name}` }, { $ref: `#/channels/${name}/messages/wrapped` }],
        },
      },
    })
    for (const name of names) {
      const texts = compare(doc("string", name), doc("integer", name)).diffs.map((d) => d.description)
      expect(texts).toEqual([
        `[Replaced] type definition of \`id\` from \`string\` to \`integer\` in message payload of channel \`${name}\``,
        `[Replaced] type definition of \`${name}.id\` from \`string\` to \`integer\` in message payload of channel \`${name}\``,
      ])
    }
  })
})

// ISSUE-312 (fixed) (P8e): the extension of an object named by its container (a channel message, a 2.x operation
// message, a component, a server, the info object) was described by its path ("of channels.c.subscribe.message")
describe("AsyncApi extension containers (ISSUE-312)", () => {
  it("H24 an extension names its container", () => {
    const doc = (v: number) => ({
      asyncapi: "2.6.0",
      info: { title: "t", version: "1", "x-a": v },
      servers: { prod: { url: "a", protocol: "kafka", "x-r": v } },
      channels: { c: { subscribe: { message: { payload: { type: "string" }, "x-k": v } } } },
      components: { messages: { M: { payload: { type: "string" }, "x-m": v } } },
    })
    expect(compare(doc(0), doc(1)).diffs.map((d) => d.description)).toEqual([
      "[Replaced] extension `x-a` of document info",
      "[Replaced] extension `x-r` of server `prod`",
      "[Replaced] extension `x-k` of message of subscribe operation of channel `c`",
      "[Replaced] extension `x-m` of message component `M`",
    ])
  })
})

// ISSUE-313 (fixed) (P8e): the schema of a 2.x parameter component and the headers of a message trait component were
// described by the generic fallback ("[Replaced] `type` of schema in parameter component `P` …")
describe("AsyncApi parameter and message trait components (ISSUE-313)", () => {
  it("H25 a parameter component schema and message trait component headers are named as such", () => {
    const type = (v: number) => ({ type: v ? "integer" : "string" })
    const doc = (v: number) => ({
      asyncapi: "2.6.0",
      info: { title: "t", version: "1" },
      channels: {},
      components: {
        parameters: { P: { schema: type(v) } },
        messageTraits: { T: { headers: { type: "object", properties: { a: type(v) } } } },
      },
    })
    expect(compare(doc(0), doc(1)).diffs.map((d) => d.description)).toEqual([
      "[Replaced] type definition from `string` to `integer` in parameter component `P`",
      "[Replaced] type definition of `a` from `string` to `integer` in headers of message trait component `T`",
    ])
  })
})

// POLICY-119 decided (changed, P8f): validator changes list their values like other scalar keywords (AA-CH-018 read
// "[Replaced] maxLength validator in parameter component `userId`")
describe("AsyncApi validator values (POLICY-119)", () => {
  it("H26 validators of parameters, payloads and headers list their values", () => {
    const doc = (v: number) => ({
      asyncapi: "2.6.0",
      info: { title: "t", version: "1" },
      channels: {
        "user/{userId}": {
          parameters: { userId: { $ref: "#/components/parameters/userId" } },
          subscribe: {
            message: {
              headers: { type: "object", properties: { trace: { type: "string", ...(v ? { minLength: 8 } : {}) } } },
              payload: { type: "object", properties: { age: { type: "integer", maximum: v ? 150 : 200 } } },
            },
          },
        },
      },
      components: { parameters: { userId: { schema: { type: "string", maxLength: v ? 30 : 50 } } } },
    })
    expect(
      compare(doc(0), doc(1))
        .diffs.map((d) => d.description)
        .sort(),
    ).toEqual([
      "[Added] minLength validator with value `8` to `trace` in subscribe message headers of channel `user/{userId}`",
      "[Replaced] maxLength validator from `50` to `30` in parameter `userId` of channel `user/{userId}`",
      "[Replaced] maxLength validator from `50` to `30` in parameter component `userId`",
      "[Replaced] maximum validator of `age` from `200` to `150` in subscribe message payload of channel `user/{userId}`",
    ])
  })
})
