import {
  annotation,
  breaking,
  compareAsyncApi,
  apiCompare,
  nonBreaking,
  risky,
  unclassified,
  UnsupportedSpecError,
} from "../../src"

// Block H — AsyncAPI 3 profile (DESIGN_PROPOSALS §4.6, decision §11.7): consumer viewpoint (decision §11.17,
// POLICY-01 (a), ISSUE-52 (fixed)): a message the application receives is written by its clients and has request
// semantics, a message it sends is read by its clients and has response semantics, as 2.x `publish` / `subscribe`;
// channels, messages and components are classified by the operations that reference them; no 2 <-> 3 cross-version
// comparison.

const metaKey = Symbol("diff")
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

const s = { type: "string" }
const payload = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  ...(required.length ? { required } : {}),
})

const doc = (action: "send" | "receive", messagePayload: unknown, extra: Record<string, unknown> = {}) => ({
  asyncapi: "3.0.0",
  info: { title: "t", version: "1" },
  channels: {
    user: { address: "user/signedup", messages: { signedUp: { payload: messagePayload } } },
  },
  operations: {
    op: { action, channel: { $ref: "#/channels/user" }, messages: [{ $ref: "#/channels/user/messages/signedUp" }] },
  },
  ...extra,
})

const diffsOf = (before: unknown, after: unknown) => compareAsyncApi(before, after, { metaKey }).diffs

describe("Block H — AsyncAPI 3 profile", () => {
  it("H1 routing: 3.x documents are compared, 2 <-> 3 is rejected", () => {
    const d = doc("send", s)
    expect(apiCompare(d, clone(d), { metaKey }).diffs).toEqual([])
    expect(() => compareAsyncApi({ asyncapi: "2.6.0" }, d)).toThrow(UnsupportedSpecError)
    expect(() => compareAsyncApi({ asyncapi: "2.6.0" }, d)).toThrow(/Unsupported version/)
  })

  it("H2 identical documents produce no diffs and merged equals the input", () => {
    const d = doc("receive", payload({ a: s, b: { type: "integer" } }, ["a"]), {
      servers: { prod: { host: "mqtt.example.com", protocol: "mqtt" } },
      components: { schemas: { S: s }, messages: { M: { payload: { $ref: "#/components/schemas/S" } } } },
    })
    const { diffs, merged } = compareAsyncApi(d, clone(d), { metaKey })
    expect(diffs).toEqual([])
    expect(JSON.parse(JSON.stringify(merged))).toEqual(d)
  })

  it("H3 channels: adding is non-breaking, removing is breaking, the address is breaking, description is an annotation", () => {
    const base = doc("send", s)
    const added = clone(base)
    added.channels = { ...added.channels, other: { address: "other" } } as any
    expect(diffsOf(base, added)).toMatchObject([{ path: ["channels", "other"], action: "add", type: nonBreaking }])
    expect(diffsOf(added, base)).toMatchObject([{ path: ["channels", "other"], action: "remove", type: breaking }])

    const moved = clone(base)
    moved.channels.user.address = "user/signed-up"
    expect(diffsOf(base, moved)).toMatchObject([{ path: ["channels", "user", "address"], type: breaking }])

    const described = clone(base)
    ;(described.channels.user as any).description = "d"
    expect(diffsOf(base, described)).toMatchObject([{ type: annotation }])
  })

  // ISSUE-52 (fixed), decision §11.17 / POLICY-01 (a): the receive scope takes request semantics (was send)
  it("H4 a message received by the application follows request semantics", () => {
    const before = doc("receive", payload({ a: s }))
    const after = doc("receive", payload({ a: s, b: s }, ["b"]))
    const diffs = diffsOf(before, after)
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.every((d) => d.type === breaking && d.scope === "components")).toBe(true)
    expect(diffs.map((d) => d.path.join("/"))).toContain("channels/user/messages/signedUp/payload/properties/b")

    const typeChange = diffsOf(doc("receive", payload({ a: s })), doc("receive", payload({ a: { type: "integer" } })))
    expect(typeChange).toMatchObject([{ type: breaking }])
    // POLICY-03 decided (c), decision §11.14 (ISSUE-130 fixed): an optional property removed with request semantics is
    // risky (was non-breaking)
    expect(diffsOf(doc("receive", payload({ a: s, b: s })), doc("receive", payload({ a: s })))).toMatchObject([
      { type: risky },
    ])
  })

  // ISSUE-52 (fixed), decision §11.17 / POLICY-01 (a): the send scope takes response semantics (was receive)
  it("H5 a message sent by the application follows response semantics", () => {
    const before = doc("send", payload({ a: s }))
    const after = doc("send", payload({ a: s, b: s }, ["b"]))
    expect(diffsOf(before, after).every((d) => d.type === nonBreaking)).toBe(true)
    expect(diffsOf(after, before).some((d) => d.type === breaking)).toBe(true)
    expect(diffsOf(doc("send", payload({ a: s })), doc("send", payload({ a: { type: "integer" } })))).toMatchObject([
      { type: breaking },
    ])
    const enumAdded = diffsOf(
      doc("send", { type: "string", enum: ["a"] }),
      doc("send", { type: "string", enum: ["a", "b"] }),
    )
    // POLICY-05 decided (b), decision §11.14 (ISSUE-130 fixed): an enum value added with response semantics is risky
    expect(enumAdded).toMatchObject([{ type: risky }])
  })

  it("H6 a message used by a send and a receive operation is breaking when either direction breaks", () => {
    const both = (p: unknown) => {
      const d = doc("send", p)
      ;(d.operations as any).rx = {
        action: "receive",
        channel: { $ref: "#/channels/user" },
        messages: [{ $ref: "#/channels/user/messages/signedUp" }],
      }
      return d
    }
    // adding a required property breaks the sender's clients, removing a required one breaks the receivers
    const diffs = diffsOf(both(payload({ a: s })), both(payload({ a: s, b: s }, ["b"])))
    expect(diffs.some((d) => d.type === breaking)).toBe(true)
    const removed = diffsOf(both(payload({ a: s, b: s }, ["b"])), both(payload({ a: s })))
    expect(removed.some((d) => d.type === breaking)).toBe(true)
    // an optional property removed is harmless for the receivers and risky for the senders' clients (POLICY-03 decided
    // (c), decision §11.14, ISSUE-130 fixed: was non-breaking in both directions)
    const optional = diffsOf(both(payload({ a: s, b: s })), both(payload({ a: s })))
    expect(optional.every((d) => d.type === risky)).toBe(true)
  })

  it("H7 a channel message no operation references is unclassified and described", () => {
    const orphan = (p: unknown) => ({
      asyncapi: "3.0.0",
      channels: { user: { address: "u", messages: { m: { payload: p } } } },
    })
    const diffs = diffsOf(orphan(s), orphan({ type: "integer" }))
    expect(diffs).toMatchObject([{ type: unclassified, scope: "components" }])
    expect(diffs[0].description).toBeTruthy()
  })

  it("H8 operations: action and channel changes are breaking, the message list follows the direction", () => {
    const base = doc("send", s)
    const flipped = clone(base)
    flipped.operations.op.action = "receive"
    expect(diffsOf(base, flipped)).toMatchObject([{ path: ["operations", "op", "action"], type: breaking }])

    const rechanneled = clone(base)
    rechanneled.channels = {
      ...rechanneled.channels,
      other: { address: "o", messages: { signedUp: { payload: s } } },
    } as any
    rechanneled.operations.op.channel = { $ref: "#/channels/other" }
    rechanneled.operations.op.messages = [{ $ref: "#/channels/other/messages/signedUp" }]
    const diffs = diffsOf(base, rechanneled)
    expect(diffs.filter((d) => d.path.includes("channel"))).toMatchObject([{ type: breaking }])
    expect(diffs.filter((d) => d.path.includes("messages") && d.path[0] === "operations").length).toBeGreaterThan(0)

    const withExtraMessage = (action: "send" | "receive") => {
      const d = doc(action, s)
      ;(d.channels.user.messages as any).other = { payload: s }
      return d
    }
    const moreSent = clone(withExtraMessage("send"))
    moreSent.operations.op.messages.push({ $ref: "#/channels/user/messages/other" })
    // POLICY-05 decided (b), decision §11.14 (ISSUE-130 fixed) with the consumer viewpoint (decision §11.17, ISSUE-52
    // fixed): the clients of a sending application may get a message kind they do not know, so the new message is
    // risky; a new message the application accepts is harmless for the clients that send to it
    expect(diffsOf(withExtraMessage("send"), moreSent).filter((d) => d.path[0] === "operations")).toMatchObject([
      { action: "add", type: risky, scope: "send" },
    ])
    const moreReceived = clone(withExtraMessage("receive"))
    moreReceived.operations.op.messages.push({ $ref: "#/channels/user/messages/other" })
    expect(diffsOf(withExtraMessage("receive"), moreReceived).filter((d) => d.path[0] === "operations")).toMatchObject([
      { action: "add", type: nonBreaking, scope: "receive" },
    ])
  })

  it("H9 reply: adding a reply is non-breaking, changing its channel is breaking", () => {
    const base = doc("send", s)
    const withReply = clone(base)
    ;(withReply.operations.op as any).reply = { channel: { $ref: "#/channels/user" } }
    expect(diffsOf(base, withReply)).toMatchObject([
      { path: ["operations", "op", "reply"], action: "add", type: nonBreaking },
    ])
    const otherReply = clone(withReply)
    otherReply.channels = { ...otherReply.channels, r: { address: "r" } } as any
    ;(otherReply.operations.op as any).reply = { channel: { $ref: "#/channels/r" } }
    expect(diffsOf(withReply, otherReply).filter((d) => d.path.includes("reply"))).toMatchObject([{ type: breaking }])
  })

  // ISSUE-52 (fixed), decision §11.17: response semantics come from a send operation (was receive)
  it("H10 components are classified by usage through $ref: a schema used by a send operation", () => {
    const mk = (type: string) =>
      doc(
        "send",
        { $ref: "#/components/schemas/S" },
        { components: { schemas: { S: { type: "string", enum: type === "a" ? ["a"] : ["a", "b"] } } } },
      )
    const diffs = diffsOf(mk("a"), mk("b"))
    const usage = diffs.filter((d) => d.path[0] === "channels")
    // POLICY-05 decided (b), decision §11.14 (ISSUE-130 fixed): an enum value added with response semantics is risky
    expect(usage).toMatchObject([
      { path: ["channels", "user", "messages", "signedUp", "payload", "enum", 1], type: risky },
    ])
    const component = diffs.filter((d) => d.path[0] === "components")
    expect(component).toMatchObject([{ type: risky, scope: "components" }])
  })

  it("H11 channel parameters and servers", () => {
    const withParam = (schema: Record<string, unknown>) => {
      const d = doc("send", s)
      ;(d.channels.user as any).address = "user/{id}"
      ;(d.channels.user as any).parameters = { id: schema }
      return d
    }
    expect(diffsOf(withParam({}), withParam({ enum: ["a"] }))).toMatchObject([{ type: breaking }])
    expect(diffsOf(withParam({ description: "a" }), withParam({ description: "b" }))).toMatchObject([
      { type: annotation },
    ])

    const servers = (host: string) => doc("send", s, { servers: { prod: { host, protocol: "mqtt" } } })
    expect(diffsOf(servers("a"), servers("b"))).toMatchObject([{ path: ["servers", "prod", "host"], type: annotation }])
  })

  it("H12 a payload in a non-JSON schema format is compared as an opaque value", () => {
    const avro = (schema: string) => doc("send", { schemaFormat: "application/vnd.apache.avro;version=1.9.0", schema })
    const diffs = diffsOf(avro('{"type":"record"}'), avro('{"type":"enum"}'))
    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toMatchObject({ action: "replace", type: unclassified })
    expect(diffs[0].description).toBeTruthy()
    expect(diffsOf(avro("x"), avro("x"))).toEqual([])
  })

  it("H13 every AsyncAPI 3 diff carries a description", () => {
    const before = doc("send", payload({ a: s }))
    const after = doc("receive", payload({ a: s, b: s }, ["b"]), { info: { title: "x", version: "2" } })
    const { diffs } = compareAsyncApi(before, after, { metaKey })
    expect(diffs.length).toBeGreaterThan(2)
    for (const diff of diffs) {
      expect(typeof diff.description).toBe("string")
      expect(diff.description).not.toBe("")
      expect(diff.description).not.toContain("undefined")
    }
  })

  it("H14 `x-*` keys inside channels, operations and components maps are entries, not extensions (POLICY-46)", () => {
    const info = { title: "t", version: "1" }
    const message = { payload: s }
    const v3 = (present: boolean) => ({
      asyncapi: "3.0.0",
      info,
      channels: present ? { "x-ch": { address: "a", messages: { "x-m": message } } } : {},
      operations: present ? { "x-op": { action: "send", channel: { $ref: "#/channels/x-ch" } } } : {},
      components: { messages: present ? { "x-msg": message } : {}, ...(present ? { "x-note": "n" } : {}) },
    })
    const byPath = (diffs: { path: (string | number)[]; type: string; description?: string }[]) =>
      Object.fromEntries(diffs.map((d) => [d.path.join("/"), d]))
    const diffs3 = byPath(diffsOf(v3(true), v3(false)))
    expect(diffs3["channels/x-ch"]).toMatchObject({ type: breaking })
    expect(diffs3["operations/x-op"]).toMatchObject({ type: breaking })
    // an unreferenced component message (decision §11.4), not an extension
    expect(diffs3["components/messages/x-msg"]).toMatchObject({ type: unclassified })
    expect(diffs3["components/messages/x-msg"].description).not.toContain("extension")
    // an `x-*` key of the components object itself is an extension (POLICY-06)
    expect(diffs3["components/x-note"]).toMatchObject({ type: annotation })
    expect(diffs3["components/x-note"].description).toContain("extension")

    const v2 = (present: boolean) => ({
      asyncapi: "2.6.0",
      info,
      channels: present ? { "x-ch": { subscribe: { message } } } : {},
      components: { schemas: present ? { "x-s": s } : {} },
    })
    const diffs2 = byPath(diffsOf(v2(true), v2(false)))
    expect(diffs2["channels/x-ch"]).toMatchObject({ type: breaking })
    expect(diffs2["components/schemas/x-s"]).toMatchObject({ type: unclassified })
  })
})
