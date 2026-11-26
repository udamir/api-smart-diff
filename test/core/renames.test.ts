import { apiCompare } from "../../src"
import {
  directFieldShare,
  findRenames,
  localReferenceSites,
  type RenameableMap,
  renamesIn,
  type StringReference,
} from "../../src/core"

// ISSUE-78, POLICY-100 / POLICY-101 decided (P8c): renamed entries are paired by their reference sites
describe("Block A10 — rename detection by reference sites", () => {
  const map = (before: Record<string, unknown>, after: Record<string, unknown>) => ({
    path: ["components", "schemas"],
    before,
    after,
  })
  const refs = (...pairs: [string, string][]) => pairs.map(([site, ref]) => ({ site, ref }))
  const s = { type: "string" }
  const n = { type: "number" }

  it("A10.1 every reference moved to the new key: a rename, also with a changed definition", () => {
    const renames = findRenames(
      [map({ Old: s }, { New: n })],
      refs(["#/paths/a", "#/components/schemas/Old"]),
      refs(["#/paths/a", "#/components/schemas/New"]),
    )
    expect([...renames]).toEqual([["#/components/schemas/Old", "#/components/schemas/New"]])
    expect([...renamesIn(renames, ["components", "schemas"])]).toEqual([["Old", "New"]])
    expect(renamesIn(renames, ["components", "responses"]).size).toBe(0)
  })

  it("A10.2 only some references moved and the definition changed: not a rename", () => {
    const renames = findRenames(
      [map({ Old: s }, { New: n })],
      refs(["#/paths/a", "#/components/schemas/Old"], ["#/paths/b", "#/components/schemas/Old"]),
      refs(["#/paths/a", "#/components/schemas/New"]),
    )
    expect(renames.size).toBe(0)
  })

  it("A10.3 an identical definition whose references all left the old key is a rename (ISSUE-78)", () => {
    const renames = findRenames(
      [map({ Old: s }, { New: s })],
      refs(["#/paths/a", "#/components/schemas/Old"], ["#/paths/b", "#/components/schemas/Old"]),
      refs(["#/paths/a", "#/components/schemas/New"]),
    )
    expect(renames.size).toBe(1)
  })

  it("A10.4 the old key still referenced, the new key referenced before, or no reference: not a rename", () => {
    const old = refs(["#/paths/a", "#/components/schemas/Old"])
    const moved = refs(["#/paths/a", "#/components/schemas/New"])
    expect(findRenames([map({ Old: s }, { New: s })], old, [...moved, ...old]).size).toBe(0)
    expect(
      findRenames([map({ Old: s }, { New: s })], [...old, ...refs(["#/x", "#/components/schemas/New"])], moved).size,
    ).toBe(0)
    // POLICY-111 decided (changed, P8e): without references an identical definition is a rename (was: none)
    expect(findRenames([map({ Old: s }, { New: s })], [], []).size).toBe(1)
  })

  it("A10.5 two candidates either way: not a rename", () => {
    const renames = findRenames(
      [map({ A: s, B: s }, { C: s, D: s })],
      refs(["#/paths/a", "#/components/schemas/A"], ["#/paths/b", "#/components/schemas/B"]),
      refs(["#/paths/c", "#/components/schemas/C"], ["#/paths/d", "#/components/schemas/D"]),
    )
    expect(renames.size).toBe(0)
  })

  it("A10.6 sites inside renamed entries and self-references are rewritten (nested renames in a later pass)", () => {
    const before = {
      channels: { a: { messages: { m: { $ref: "#/components/messages/M" } } } },
      operations: { o: { channel: { $ref: "#/channels/a" } } },
      components: { messages: { M: { payload: s, self: { $ref: "#/components/messages/M" } } } },
    }
    const after = {
      channels: { b: { messages: { m: { $ref: "#/components/messages/N" } } } },
      operations: { o: { channel: { $ref: "#/channels/b" } } },
      components: { messages: { N: { payload: n, self: { $ref: "#/components/messages/N" } } } },
    }
    const renames = findRenames(
      [
        { path: ["channels"], before: before.channels, after: after.channels },
        { path: ["components", "messages"], before: before.components.messages, after: after.components.messages },
      ],
      () => localReferenceSites(before),
      () => localReferenceSites(after),
    )
    expect(Object.fromEntries(renames)).toEqual({
      "#/channels/a": "#/channels/b",
      "#/components/messages/M": "#/components/messages/N",
    })
  })

  // POLICY-105 decided (changed, P8d): besides the reference sites, a removed and an added entry are a rename when more
  // than 50 % of the direct fields of their definitions are equal (equal direct keys / union of direct keys; nested
  // fields are not counted separately); one-to-one, best score first
  describe("POLICY-105 partially updated renames", () => {
    const def = (fields: Record<string, unknown>) => fields
    const partial = [
      refs(["#/paths/a", "#/components/schemas/Old"], ["#/paths/b", "#/components/schemas/Old"]),
      refs(["#/paths/a", "#/components/schemas/New"]),
    ] as const
    const pair = (before: Record<string, unknown>, after: Record<string, unknown>) =>
      Object.fromEntries(findRenames([map(before, after)], partial[0], partial[1]))

    it("A10.8 more than 50 % of the direct fields equal: a rename although only some references moved", () => {
      // 2 of 3 direct keys equal
      expect(
        pair(
          { Old: def({ type: "object", required: ["id"], properties: { id: s } }) },
          {
            New: def({ type: "object", required: ["id"], properties: { id: s, name: s } }),
          },
        ),
      ).toEqual({ "#/components/schemas/Old": "#/components/schemas/New" })
      // a deep-equal definition is 100 %
      expect(Object.keys(pair({ Old: s }, { New: s }))).toHaveLength(1)
    })

    it("A10.9 exactly 50 % is not a rename; the share is taken over the union of the keys of both definitions", () => {
      expect(
        pair({ Old: { type: "object", properties: { id: s } } }, { New: { type: "object", properties: {} } }),
      ).toEqual({})
      // `a` equal, `b` only before, `c` only after: 1 of 3
      expect(pair({ Old: { a: 1, b: 2 } }, { New: { a: 1, c: 2 } })).toEqual({})
      // 2 of 4 (keys only after count): not a rename; 3 of 5 and 3 of 4: a rename
      expect(pair({ Old: { a: 1, b: 2 } }, { New: { a: 1, b: 2, c: 3, d: 4 } })).toEqual({})
      expect(Object.keys(pair({ Old: { a: 1, b: 2, c: 3, d: 4 } }, { New: { a: 1, b: 2, c: 3, e: 4 } }))).toHaveLength(
        1,
      )
      expect(Object.keys(pair({ Old: { a: 1, b: 2, c: 3, d: 4 } }, { New: { a: 1, b: 2, c: 3, d: 5 } }))).toHaveLength(
        1,
      )
    })

    it("A10.10 below 50 %, and nested fields that are mostly equal, are not a rename", () => {
      expect(pair({ Old: { a: 1, b: 2, c: 3 } }, { New: { a: 1, b: 0, c: 0 } })).toEqual({})
      // one direct field differs in a nested key, the other differs: 0 of 2 although most nested fields are equal
      const nested = { x: 1, y: 2, z: 3 }
      expect(pair({ Old: { a: nested, b: 1 } }, { New: { a: { ...nested, z: 4 }, b: 2 } })).toEqual({})
    })

    it("A10.11 competing candidates: one-to-one, the best score first", () => {
      const before = {
        O1: { a: 1, b: 2, c: 3, d: 4, e: 5 },
        O2: { a: 1, b: 2, c: 3, f: 6 },
      }
      const after = {
        // O1: 4 of 5; O2: 3 of 6
        N1: { a: 1, b: 2, c: 3, d: 4, e: 0 },
        // O1: 3 of 6; O2: 3 of 4
        N2: { a: 1, b: 2, c: 3, f: 0 },
      }
      const renames = findRenames(
        [map(before, after)],
        refs(["#/paths/a", "#/components/schemas/O1"], ["#/paths/b", "#/components/schemas/O2"]),
        refs(["#/paths/c", "#/components/schemas/N1"]),
      )
      expect(Object.fromEntries(renames)).toEqual({
        "#/components/schemas/O1": "#/components/schemas/N1",
        "#/components/schemas/O2": "#/components/schemas/N2",
      })
      // a removed entry similar to two added ones takes the more similar one, the other stays an addition
      expect(
        pair(
          { Old: { a: 1, b: 2, c: 3, d: 4 } },
          { New: { a: 1, b: 2, c: 3, d: 0 }, Other: { a: 1, b: 2, c: 0, d: 0 } },
        ),
      ).toEqual({ "#/components/schemas/Old": "#/components/schemas/New" })
      const best = findRenames(
        [
          map(
            { Old: { a: 1, b: 2, c: 3, d: 4 } },
            { A: { a: 1, b: 2, c: 0, d: 4 }, B: { a: 1, b: 2, c: 3, d: 4, e: 5 } },
          ),
        ],
        partial[0],
        partial[1],
      )
      expect(Object.fromEntries(best)).toEqual({ "#/components/schemas/Old": "#/components/schemas/B" })
    })

    it("A10.12 equal best scores either way are ambiguous: not a rename", () => {
      expect(pair({ Old: { a: 1, b: 2, c: 3 } }, { New: { a: 1, b: 2, c: 0 }, Other: { a: 1, b: 0, c: 3 } })).toEqual(
        {},
      )
    })

    it("A10.13 a reference-site match wins over a more similar definition", () => {
      const renames = findRenames(
        [map({ Old: { a: 1, b: 2 } }, { Moved: { z: 0 }, Same: { a: 1, b: 2 } })],
        refs(["#/paths/a", "#/components/schemas/Old"]),
        refs(["#/paths/a", "#/components/schemas/Moved"], ["#/paths/b", "#/components/schemas/Same"]),
      )
      expect(Object.fromEntries(renames)).toEqual({ "#/components/schemas/Old": "#/components/schemas/Moved" })
    })

    it("A10.14 the reference conditions still apply: a still referenced old key is not renamed", () => {
      const similar = [{ Old: { a: 1, b: 2, c: 3 } }, { New: { a: 1, b: 2, c: 0 } }] as const
      // POLICY-111 decided (changed, P8e): an unreferenced pair is judged by its fields too (was: never renamed)
      expect(findRenames([map(...similar)], [], []).size).toBe(1)
      expect(
        findRenames([map(...similar)], partial[0], [...partial[1], ...refs(["#/paths/b", "#/components/schemas/Old"])])
          .size,
      ).toBe(0)
    })
  })

  it("A10.7 localReferenceSites lists local `$ref`s with the pointer of their holder", () => {
    expect(
      localReferenceSites({ a: [{ $ref: "#/x" }], "b/c": { $ref: "#/y" }, d: { $ref: "https://example.com/z" } }),
    ).toEqual([
      { site: "#/a/0", ref: "#/x" },
      { site: "#/b~1c", ref: "#/y" },
    ])
  })

  // POLICY-114 decided (changed, P8e): a container named by its content (a parameter by its `name`, a 3.0 channel
  // message's payload by its channel) inside a renamed entry is named with the entry's key and the rename note
  describe("POLICY-114 content-named containers inside a renamed entry", () => {
    const described = (before: unknown, after: unknown) =>
      apiCompare(before, after).diffs.map((d) => `${d.path.join("/")} | ${d.description}`)

    it("A10.25 OpenAPI: parameters, encodings, callbacks, path items and media type components", () => {
      const r = (kind: string, name: string) => ({ $ref: `#/components/${kind}/${name}` })
      const doc = (n: string, v: number) => {
        const type = { type: v ? "integer" : "string" }
        return {
          openapi: "3.2.0",
          info: { title: "t", version: "1" },
          paths: {
            "/a": {
              get: {
                parameters: [r("parameters", `P${n}`)],
                requestBody: r("requestBodies", `B${n}`),
                callbacks: { cb: r("callbacks", `C${n}`) },
                responses: {
                  200: r("responses", `R${n}`),
                  201: { description: "x", content: { "application/json": r("mediaTypes", `M${n}`) } },
                },
              },
            },
            "/p": r("pathItems", `I${n}`),
          },
          components: {
            parameters: { [`P${n}`]: { name: "q", in: "query", schema: type, description: v ? "b" : "a" } },
            requestBodies: {
              [`B${n}`]: {
                description: v ? "b" : "a",
                content: {
                  "multipart/form-data": {
                    schema: { type: "object" },
                    encoding: {
                      part: { contentType: v ? "text/plain" : "image/png", headers: { Y: { schema: type } } },
                    },
                  },
                },
              },
            },
            responses: { [`R${n}`]: { description: v ? "b" : "a", headers: { X: { description: v ? "b" : "a" } } } },
            callbacks: {
              [`C${n}`]: {
                "{$request.body#/url}": {
                  post: {
                    parameters: [{ name: "z", in: "query", schema: type }],
                    responses: { 200: { description: "ok" } },
                  },
                },
              },
            },
            mediaTypes: { [`M${n}`]: { schema: type, example: v } },
            pathItems: {
              [`I${n}`]: {
                get: {
                  parameters: [{ name: "w", in: "header", schema: type }],
                  responses: { 200: { description: "ok" } },
                },
              },
            },
          },
        }
      }
      const texts = described(doc("Old", 0), doc("New", 1)).filter(
        (t) => t.startsWith("components/") && !t.includes("[Renamed]"),
      )
      expect(texts).toEqual([
        "components/parameters/POld/schema/type | [Replaced] type definition from `string` to `integer` in query parameter `q` of parameter component `PNew` (renamed from `POld`)",
        "components/parameters/POld/description | [Replaced] annotation (description) of query parameter `q` of parameter component `PNew` (renamed from `POld`) from `a` to `b`",
        "components/requestBodies/BOld/description | [Replaced] annotation (description) of Request Body `BNew` (renamed from `BOld`) from `a` to `b`",
        "components/requestBodies/BOld/content/multipart/form-data/encoding/part/contentType | [Replaced] `contentType` of encoding `part` in Request Body `BNew` (renamed from `BOld`) content (multipart/form-data) from `image/png` to `text/plain`",
        "components/requestBodies/BOld/content/multipart/form-data/encoding/part/headers/Y/schema/type | [Replaced] type definition from `string` to `integer` in header `Y` of encoding `part` in Request Body `BNew` (renamed from `BOld`) content (multipart/form-data)",
        "components/responses/ROld/description | [Replaced] annotation (description) of Response RNew (renamed from `ROld`) from `a` to `b`",
        "components/responses/ROld/headers/X/description | [Replaced] annotation (description) of Response RNew (renamed from `ROld`) header `X` from `a` to `b`",
        "components/callbacks/COld/{$request.body#/url}/post/parameters/0/schema/type | [Replaced] type definition from `string` to `integer` in query parameter `z` of callback component `CNew` (renamed from `COld`)",
        // ISSUE-311 (fixed): a media type component is named as such (was "media type `example` of Request Body")
        "components/mediaTypes/MOld/schema/type | [Replaced] type definition from `string` to `integer` in media type component `MNew` (renamed from `MOld`)",
        "components/mediaTypes/MOld/example | [Replaced] annotation (example) of media type component `MNew` (renamed from `MOld`) from `0` to `1`",
        "components/pathItems/IOld/get/parameters/0/schema/type | [Replaced] type definition from `string` to `integer` in header parameter `w` of path item component `INew` (renamed from `IOld`)",
      ])
      // not renamed: the content-named containers keep their texts
      expect(described(doc("Old", 0), doc("Old", 1)).filter((t) => t.startsWith("components/parameters/"))).toEqual([
        "components/parameters/POld/schema/type | [Replaced] type definition from `string` to `integer` in query parameter `q`",
        "components/parameters/POld/description | [Replaced] annotation (description) of query parameter `q` from `a` to `b`",
      ])
    })

    it("A10.26 AsyncAPI: 3.0 channel messages (payload, headers, bindings, extensions) and component schemas", () => {
      const doc = (channel: string, message: string, v: number) => {
        const type = { type: v ? "integer" : "string" }
        return {
          asyncapi: "3.0.0",
          info: { title: "t", version: "1" },
          channels: {
            [channel]: {
              address: "a",
              description: "d",
              messages: {
                [message]: {
                  payload: { type: "object", properties: { id: type } },
                  headers: { type: "object", properties: { h: type } },
                  bindings: { kafka: { key: type } },
                  "x-k": v,
                },
              },
            },
          },
          operations: {
            o: {
              action: "send",
              channel: { $ref: `#/channels/${channel}` },
              messages: [{ $ref: `#/channels/${channel}/messages/${message}` }],
            },
          },
        }
      }
      expect(described(doc("c", "signup", 0), doc("c", "registration", 1))).toEqual([
        "channels/c/messages | [Renamed] message `signup` to `registration` in channel `c`",
        "channels/c/messages/signup/payload/properties/id/type | [Replaced] type definition of `id` from `string` to `integer` in payload of message `registration` (renamed from `signup`) in channel `c`",
        "channels/c/messages/signup/headers/properties/h/type | [Replaced] type definition of `h` from `string` to `integer` in headers of message `registration` (renamed from `signup`) in channel `c`",
        "channels/c/messages/signup/bindings/kafka/key/type | [Replaced] type definition from `string` to `integer` in `key` of the kafka binding of message `registration` (renamed from `signup`) of channel `c`",
        // ISSUE-312 (fixed): the extension of a channel message names the message (was "of channels.c.messages.signup")
        "channels/c/messages/signup/x-k | [Replaced] extension `x-k` of message `registration` (renamed from `signup`) of channel `c`",
      ])
      // the channel renamed too (2 of its 3 direct fields kept, POLICY-105): both notes
      expect(described(doc("userSignup", "signup", 0), doc("userRegistration", "registration", 1))[2]).toBe(
        "channels/userSignup/messages/signup/payload/properties/id/type | [Replaced] type definition of `id` from `string` to `integer` in payload of message `registration` (renamed from `signup`) in channel `userRegistration` (renamed from `userSignup`)",
      )
      // not renamed: the payload keeps its text, the extension names the message
      expect(described(doc("c", "signup", 0), doc("c", "signup", 1))).toEqual([
        "channels/c/messages/signup/payload/properties/id/type | [Replaced] type definition of `id` from `string` to `integer` in message payload of channel `c`",
        "channels/c/messages/signup/headers/properties/h/type | [Replaced] type definition of `h` from `string` to `integer` in message headers of channel `c`",
        "channels/c/messages/signup/bindings/kafka/key/type | [Replaced] type definition from `string` to `integer` in `key` of the kafka binding of message `signup` of channel `c`",
        "channels/c/messages/signup/x-k | [Replaced] extension `x-k` of message `signup` of channel `c`",
      ])
    })
  })

  // ISSUE-310 (fixed) (P8e): a reference that closes its cycle on one side only (an inline copy of a renamed recursive
  // component) was compared as a plain node: "[Replaced] `$ref` of `next`" (unclassified)
  it("A10.27 an inline copy of a renamed recursive component is no change", () => {
    const r = (name: string) => ({ $ref: `#/components/schemas/${name}` })
    const node = (to: string) => ({ title: "a", description: "d", properties: { next: r(to) } })
    const json = (schema: unknown) => ({ content: { "application/json": { schema } } })
    const doc = (name: string, inline: boolean) => ({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/a": { get: { responses: { 200: { description: "ok", ...json(r(name)) } } } },
        "/b": { post: { requestBody: json(inline ? node(name) : r(name)), responses: { 200: { description: "ok" } } } },
      },
      components: { schemas: { [name]: node(name) } },
    })
    expect(apiCompare(doc("A", false), doc("A2", true)).diffs.map((d) => d.description)).toEqual([
      "[Renamed] schema component `A` to `A2`",
    ])
  })

  // ISSUE-301 (fixed) (P8d): a map inside a renamed entry has another path in the after document (`afterPath`); sites
  // are rewritten by the longest renamed entry they point into
  it("A10.18 entries of a map inside a renamed entry are paired across both renames", () => {
    const before = {
      channels: { a: { messages: { m: s } } },
      operations: { o: { m: { $ref: "#/channels/a/messages/m" } } },
    }
    const after = {
      channels: { b: { messages: { n: s } } },
      operations: { o: { m: { $ref: "#/channels/b/messages/n" } } },
    }
    const renames = findRenames(
      [
        {
          path: ["channels", "a", "messages"],
          afterPath: ["channels", "b", "messages"],
          before: before.channels.a.messages,
          after: after.channels.b.messages,
        },
      ],
      () => localReferenceSites(before),
      () => localReferenceSites(after),
    )
    expect(Object.fromEntries(renames)).toEqual({ "#/channels/a/messages/m": "#/channels/b/messages/n" })
    const both = new Map([...renames, ["#/channels/a", "#/channels/b"]])
    expect([...renamesIn(both, ["channels", "a", "messages"])]).toEqual([["m", "n"]])
  })

  // POLICY-111 decided (changed, P8e): the similarity rule applies to unreferenced entries too
  it("A10.19 unreferenced entries more than 50 % equal are a rename; the other reference conditions still apply", () => {
    const similar = map({ Old: { a: 1, b: 2, c: 3 } }, { New: { a: 1, b: 2, c: 0 } })
    expect(Object.fromEntries(findRenames([similar], [], []))).toEqual({
      "#/components/schemas/Old": "#/components/schemas/New",
    })
    // exactly 50 %: not a rename
    expect(findRenames([map({ Old: { a: 1, b: 2 } }, { New: { a: 1, b: 0 } })], [], []).size).toBe(0)
    // the old key unreferenced, the new key referenced in the after document only: a rename by its fields
    expect(findRenames([similar], [], refs(["#/paths/a", "#/components/schemas/New"])).size).toBe(1)
    // the old key still referenced in the after document, or the new key already referenced before: none
    expect(findRenames([similar], [], refs(["#/paths/a", "#/components/schemas/Old"])).size).toBe(0)
    expect(findRenames([similar], refs(["#/paths/a", "#/components/schemas/New"]), []).size).toBe(0)
    // unreferenced identical definitions with two candidates either way: ambiguous (POLICY-112)
    expect(findRenames([map({ A: s, B: s }, { C: s, D: s })], [], []).size).toBe(0)
  })

  // POLICY-113 decided (changed, P8e): fields are compared with the renames found so far applied (cascading renames),
  // iterated to a fixed point with one-to-one pairing
  describe("POLICY-113 cascading renames", () => {
    const r = (name: string) => ({ $ref: `#/components/schemas/${name}` })
    const holder = (to: string) => ({ type: "object", properties: { next: r(to) } })
    const leaf = { type: "object", title: "leaf", properties: { id: n } }
    const renames = (before: Record<string, unknown>, after: Record<string, unknown>) =>
      Object.fromEntries(
        [...findRenames([map(before, after)], [], [])].map(([from, to]) => [
          from.slice(from.lastIndexOf("/") + 1),
          to.slice(to.lastIndexOf("/") + 1),
        ]),
      )

    it("A10.20 a schema renamed together with the schema it references", () => {
      // A alone: `type` equal, `properties` differs by the reference (1 of 2); with B -> B2 applied: 2 of 2
      expect(directFieldShare(holder("B"), holder("B2"))).toBe(0.5)
      expect(renames({ A: holder("B"), B: leaf }, { A2: holder("B2"), B2: leaf })).toEqual({ A: "A2", B: "B2" })
      // the referenced schema renamed to another name than the reference names: A stays a removal
      expect(renames({ A: holder("B"), B: leaf }, { A2: holder("X"), B2: leaf })).toEqual({ B: "B2" })
    })

    it("A10.21 a chain of three renamed together, found pass by pass", () => {
      expect(
        renames({ A: holder("B"), B: holder("C"), C: leaf }, { A2: holder("B2"), B2: holder("C2"), C2: leaf }),
      ).toEqual({ A: "A2", B: "B2", C: "C2" })
      // references into a renamed entry (`#/components/schemas/C/properties/id`) are rewritten too
      const into = (to: string) => ({
        type: "object",
        properties: { id: { $ref: `#/components/schemas/${to}/properties/id` } },
      })
      expect(renames({ A: into("C"), C: leaf }, { A2: into("C2"), C2: leaf })).toEqual({ A: "A2", C: "C2" })
    })

    it("A10.22 entries that reference each other are renamed together (cycle); a symmetric cycle is ambiguous", () => {
      const titled = (title: string, to: string) => ({ title, properties: { next: r(to) } })
      expect(
        renames({ A: titled("a", "B"), B: titled("b", "A") }, { A2: titled("a", "B2"), B2: titled("b", "A2") }),
      ).toEqual({ A: "A2", B: "B2" })
      // a self-reference counts the candidate itself
      expect(renames({ A: titled("a", "A") }, { A2: titled("a", "A2") })).toEqual({ A: "A2" })
      // A -> A2, B -> B2 and A -> B2, B -> A2 are equally consistent: no rename (POLICY-112)
      expect(renames({ A: holder("B"), B: holder("A") }, { A2: holder("B2"), B2: holder("A2") })).toEqual({})
    })

    it("A10.23 equal best scores after a cascading rename are still no rename (POLICY-112)", () => {
      expect(renames({ A: holder("B"), B: leaf }, { A2: holder("B2"), A3: holder("B2"), B2: leaf })).toEqual({
        B: "B2",
      })
    })
  })

  it("A10.24 directFieldShare with a reference comparison counts fields that differ only by references", () => {
    const same = (b: string, a: string) => b.replace("/Old", "/New") === a
    const before = { type: "object", properties: { a: { $ref: "#/x/Old" } }, items: [{ $ref: "#/x/Old" }] }
    const after = { type: "object", properties: { a: { $ref: "#/x/New" } }, items: [{ $ref: "#/x/New" }] }
    expect(directFieldShare(before, after)).toBeCloseTo(1 / 3)
    expect(directFieldShare(before, after, same)).toBe(1)
    // a field that differs otherwise too stays unequal
    expect(directFieldShare({ a: { $ref: "#/x/Old", b: 1 } }, { a: { $ref: "#/x/New", b: 2 } }, same)).toBe(0)
    // a definition that is itself a reference
    expect(directFieldShare({ $ref: "#/x/Old" }, { $ref: "#/x/New" }, same)).toBe(1)
  })

  it("A10.15 directFieldShare counts equal direct fields over the union of the direct keys", () => {
    expect(directFieldShare({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(1)
    expect(directFieldShare({ a: 1, b: 2 }, { a: 1, c: 2 })).toBeCloseTo(1 / 3)
    expect(directFieldShare({}, {})).toBe(1)
    expect(directFieldShare({ a: 1 }, {})).toBe(0)
    expect(directFieldShare("x", "x")).toBe(1)
    expect(directFieldShare([1, 2], [1, 3])).toBe(0)
  })

  // POLICY-107 decided (changed, P8d): a change inside a renamed entry names the container by its new key and the key
  // it was renamed from, for every container kind
  describe("POLICY-107 descriptions of changes inside a renamed entry", () => {
    const described = (before: unknown, after: unknown) =>
      apiCompare(before, after).diffs.map((d) => `${d.path.join("/")} | ${d.description}`)

    it("A10.16 OpenAPI components of every kind name the new and the old key", () => {
      const r = (kind: string, name: string) => ({ $ref: `#/components/${kind}/${name}` })
      const doc = (n: string, v: number) => {
        const type = { type: v ? "integer" : "string" }
        return {
          openapi: "3.1.0",
          info: { title: "t", version: "1" },
          security: [{ [`K${n}`]: [] }],
          paths: {
            "/a": {
              get: {
                parameters: [r("parameters", `P${n}`)],
                requestBody: r("requestBodies", `B${n}`),
                responses: {
                  200: r("responses", `R${n}`),
                  201: {
                    description: "x",
                    headers: { X: r("headers", `H${n}`) },
                    content: {
                      "application/json": { schema: r("schemas", `S${n}`), examples: { e: r("examples", `E${n}`) } },
                    },
                  },
                },
              },
            },
          },
          components: {
            schemas: { [`S${n}`]: { type: "object", required: ["id"], properties: { id: type } } },
            responses: { [`R${n}`]: { description: "ok", content: { "application/json": { schema: type } } } },
            parameters: { [`P${n}`]: { name: "q", in: "query", schema: type } },
            requestBodies: { [`B${n}`]: { content: { "application/json": { schema: type } } } },
            headers: { [`H${n}`]: { description: "h", schema: type } },
            examples: { [`E${n}`]: { summary: "s", value: v ? 2 : 1 } },
            securitySchemes: { [`K${n}`]: { type: "apiKey", in: "header", name: v ? "X-B" : "X-A" } },
          },
        }
      }
      const texts = described(doc("Old", 0), doc("New", 1)).filter(
        (t) => t.startsWith("components/") && !t.includes("[Renamed]"),
      )
      expect(texts).toEqual([
        "components/schemas/SOld/properties/id/type | [Replaced] type definition of `id` from `string` to `integer` in schema component `SNew` (renamed from `SOld`)",
        "components/responses/ROld/content/application/json/schema/type | [Replaced] type definition from `string` to `integer` in Response RNew (renamed from `ROld`) content (application/json)",
        // a parameter is named by its `name` field; POLICY-114 decided (changed, P8e): with the component's new and old
        // key (was "in query parameter `q`")
        "components/parameters/POld/schema/type | [Replaced] type definition from `string` to `integer` in query parameter `q` of parameter component `PNew` (renamed from `POld`)",
        "components/requestBodies/BOld/content/application/json/schema/type | [Replaced] type definition from `string` to `integer` in Request Body `BNew` (renamed from `BOld`) content (application/json)",
        "components/headers/HOld/schema/type | [Replaced] type definition from `string` to `integer` in header `HNew` (renamed from `HOld`)",
        "components/examples/EOld/value | [Replaced] `value` of example component `ENew` (renamed from `EOld`) from `1` to `2`",
        "components/securitySchemes/KOld/name | [Replaced] `name` of security scheme component `KNew` (renamed from `KOld`) from `X-A` to `X-B`",
      ])
    })

    it("A10.17 AsyncAPI channels and components name the new and the old key", () => {
      const doc3 = (channel: string, v: number) => ({
        asyncapi: "3.0.0",
        info: { title: "t", version: "1" },
        channels: {
          [channel]: {
            address: "user/signup",
            "x-team": v ? "b" : "a",
            bindings: { kafka: { topic: v ? "t2" : "t1" } },
            messages: {
              signup: { payload: { type: "object", properties: { id: { type: v ? "integer" : "string" } } } },
            },
          },
        },
        operations: {
          onSignup: {
            action: "send",
            channel: { $ref: `#/channels/${channel}` },
            messages: [{ $ref: `#/channels/${channel}/messages/signup` }],
          },
        },
      })
      expect(described(doc3("userSignup", 0), doc3("userRegistration", 1))).toEqual([
        "channels | [Renamed] channel `userSignup` to `userRegistration`",
        "channels/userSignup/x-team | [Replaced] extension `x-team` of channel `userRegistration` (renamed from `userSignup`)",
        "channels/userSignup/bindings/kafka/topic | [Replaced] `topic` of bindings.kafka in channel `userRegistration` (renamed from `userSignup`) from `t1` to `t2`",
        "channels/userSignup/messages/signup/payload/properties/id/type | [Replaced] type definition of `id` from `string` to `integer` in message payload of channel `userRegistration` (renamed from `userSignup`)",
      ])
      const doc2 = (schema: string, message: string, v: number) => ({
        asyncapi: "2.6.0",
        info: { title: "t", version: "1" },
        channels: {
          "user/signup": { subscribe: { message: { $ref: `#/components/messages/${message}` } } },
          "user/audit": { publish: { message: { payload: { $ref: `#/components/schemas/${schema}` } } } },
        },
        components: {
          messages: {
            [message]: { payload: { type: "object", properties: { id: { type: v ? "integer" : "string" } } } },
          },
          schemas: { [schema]: { type: "object", properties: { at: { type: v ? "integer" : "string" } } } },
        },
      })
      expect(
        described(doc2("Audit", "SignupV1", 0), doc2("AuditV2", "SignupV2", 1)).filter((t) =>
          t.startsWith("components/"),
        ),
      ).toEqual([
        "components/messages | [Renamed] message component `SignupV1` to `SignupV2`",
        "components/messages/SignupV1/payload/properties/id/type | [Replaced] type definition of `id` from `string` to `integer` in message `SignupV2` (renamed from `SignupV1`)",
        "components/schemas | [Renamed] schema component `Audit` to `AuditV2`",
        "components/schemas/Audit/properties/at/type | [Replaced] type definition of `at` from `string` to `integer` in schema component `AuditV2` (renamed from `Audit`)",
      ])
    })
  })
})

// POLICY-116 decided (changed, P8f): a field that differs only by string references (POLICY-106) repointed through the
// renames found so far, or by the keys of a nested renameable map renamed together with the entry, counts as equal for
// the direct field share; pairing stays one-to-one and iterated to a fixed point, ties are no rename
describe("Block A10 — POLICY-116 repointed string references and nested maps", () => {
  const map = (before: Record<string, unknown>, after: Record<string, unknown>) => ({
    path: ["components", "schemas"],
    before,
    after,
  })
  const names = (renames: Map<string, string>) =>
    Object.fromEntries(
      [...renames].map(([from, to]) => [from.slice(from.lastIndexOf("/") + 1), to.slice(to.lastIndexOf("/") + 1)]),
    )
  // a discriminator mapping value as a string reference (a local pointer)
  const mapping: StringReference = (_key, value, holder) =>
    holder[holder.length - 1] === "mapping" && value.startsWith("#") ? value : undefined
  const strings = { strings: { before: mapping, after: mapping } }
  const leaf = { type: "object", properties: { id: { type: "integer" } } }
  const poly = (to: string) => ({
    oneOf: [{ $ref: `#/components/schemas/${to}` }],
    discriminator: { propertyName: "kind", mapping: { x: `#/components/schemas/${to}` } },
  })

  it("A10.28 a mapping value repointed through a rename counts as equal", () => {
    // without the string references the discriminator differs (1 of 2 direct fields): only the leaf is renamed
    expect(names(findRenames([map({ P: poly("C"), C: leaf }, { P2: poly("C2"), C2: leaf })], [], []))).toEqual({
      C: "C2",
    })
    expect(names(findRenames([map({ P: poly("C"), C: leaf }, { P2: poly("C2"), C2: leaf })], [], [], strings))).toEqual(
      {
        C: "C2",
        P: "P2",
      },
    )
    // a mapping value retargeted to an entry that was not renamed still differs
    expect(
      names(findRenames([map({ P: poly("C"), C: leaf, D: leaf }, { P2: poly("D"), D: leaf })], [], [], strings)),
    ).toEqual({})
    // two equally similar candidates: no rename for P (POLICY-112), the leaf is still renamed
    expect(
      names(
        findRenames([map({ P: poly("C"), C: leaf }, { P2: poly("C2"), P3: poly("C2"), C2: leaf })], [], [], strings),
      ),
    ).toEqual({ C: "C2" })
  })

  it("A10.29 string references are read with their holder path from the document root", () => {
    const seen: string[] = []
    const spy: StringReference = (key, value, holder) => {
      seen.push(`${holder.join("/")}|${key}`)
      return mapping(key, value, holder)
    }
    findRenames([map({ P: poly("C"), C: leaf }, { P2: poly("C2"), C2: leaf })], [], [], {
      strings: { before: spy, after: spy },
    })
    expect(seen).toContain("components/schemas/P/discriminator/mapping|x")
    expect(seen).toContain("components/schemas/P2/discriminator/mapping|x")
  })

  // a 3.0-like channel map whose entries hold a nested `messages` map
  const channels = (before: Record<string, unknown>, after: Record<string, unknown>) => ({
    path: ["channels"],
    before,
    after,
  })
  // the hook is called for every candidate map, nested ones included
  const nested = (outer: RenameableMap, oldKey: string, newKey: string): RenameableMap[] =>
    outer.path.length !== 1
      ? []
      : [
          {
            path: ["channels", oldKey, "messages"],
            afterPath: ["channels", newKey, "messages"],
            before: (outer.before[oldKey] as { messages: Record<string, unknown> }).messages,
            after: (outer.after[newKey] as { messages: Record<string, unknown> }).messages,
          },
        ]
  const m = { payload: { type: "string" } }
  const other = { payload: { type: "integer" }, contentType: "a/b" }

  it("A10.30 a nested map key renamed with the entry counts as equal; the nested entry is renamed too", () => {
    const before = { a: { address: "x", messages: { m } } }
    const after = { b: { address: "x", messages: { n: m } } }
    // without the nested maps: 1 of 2 direct fields, exactly 50 %
    expect(names(findRenames([channels(before, after)], [], []))).toEqual({})
    expect(names(findRenames([channels(before, after)], [], [], { nested }))).toEqual({ a: "b", m: "n" })
    // a message kept with its key next to the renamed one
    expect(
      names(
        findRenames(
          [
            channels(
              { a: { address: "x", messages: { m, k: other } } },
              { b: { address: "x", messages: { n: m, k: other } } },
            ),
          ],
          [],
          [],
          { nested },
        ),
      ),
    ).toEqual({ a: "b", m: "n" })
    // the nested entry is not a rename (it changed entirely): the key differs, the entry is not renamed
    expect(
      names(findRenames([channels(before, { b: { address: "x", messages: { n: other } } })], [], [], { nested })),
    ).toEqual({})
  })

  it("A10.31 nested maps follow one-to-one pairing and ties", () => {
    // two channels equally similar to the renamed one: ambiguous, neither the channel nor its message is renamed
    const before = { a: { address: "x", messages: { m } } }
    const after = { b: { address: "x", messages: { n: m } }, c: { address: "x", messages: { o: m } } }
    expect(names(findRenames([channels(before, after)], [], [], { nested }))).toEqual({})
    // with a reference-site match the nested map is compared once the channel is renamed (ISSUE-301)
    const renames = findRenames(
      [channels({ a: { messages: { m } } }, { b: { messages: { n: m } }, c: { messages: { o: other } } })],
      [
        { site: "#/operations/o/channel", ref: "#/channels/a" },
        { site: "#/operations/o/messages/0", ref: "#/channels/a/messages/m" },
      ],
      [
        { site: "#/operations/o/channel", ref: "#/channels/b" },
        { site: "#/operations/o/messages/0", ref: "#/channels/b/messages/n" },
      ],
      { nested },
    )
    expect(names(renames)).toEqual({ a: "b", m: "n" })
  })
})
