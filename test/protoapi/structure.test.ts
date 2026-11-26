import { breaking, nonBreaking, risky, unclassified, type Diff } from "../../src"
import { diffElement } from "../../src/protoapi/protoapi.utils"
import { recordsByElement } from "../../src/protoapi/protoapi.merge"
import { protoDiffs, protoDocs, protoCompare } from "../helpers"

// J2: nominal references, usage scopes from the rpc sides, transitive propagation through field types, `items` and map
// values, unreferenced components, `components: "unclassified"`, AD-05 (Q1); one record per rpc side (S5), the field
// shape as one value (DG-01) with its validators folded (PD-16), the streaming toggles of DG-02, the oneof move of
// DG-23, the A4 merge and the extension usage through `impliedReferences` / `inheritUsage` (Q2).

const header = `syntax = "proto3"; package p;`
const proto2 = `syntax = "proto2"; package p;`

// an enum `E` reached from the rpc sides through `reach` (the message types between the rpc and the enum); the after
// side adds a value to `E`, a change classified by its usage scopes (V-1: request non-breaking, response risky)
const enumValueAdded = (services: string, messages: string) =>
  protoDiffs(
    `${header} enum E { E_UNSPECIFIED = 0; } ${messages} ${services}`,
    `${header} enum E { E_UNSPECIFIED = 0; E_NEW = 1; } ${messages} ${services}`,
  ).diffs

const valueAdded = (diffs: Diff[]) =>
  diffs.filter((d) => d.path.join("/") === "components/enums/p.E/values/E_NEW").map((d) => d.type)

const paths = (diffs: Diff[]) => diffs.map((d) => `${d.action} ${d.path.join("/")}`)

describe("Block J2 — ProtoApi structure and scopes", () => {
  it("J2.1 a reference with siblings is compared as a keyword, never expanded or turned into allOf (DG-01)", () => {
    const before = `${header} enum K { K_UNSPECIFIED = 0; } message A { K kind = 1; A next = 2; }
      service S { rpc M(A) returns (A); }`
    const after = `${header} enum K { K_UNSPECIFIED = 0; } message A { K kind = 1 [deprecated = true]; A next = 2; }
      service S { rpc M(A) returns (A); }`
    const { diffs, merged } = protoDiffs(before, after)
    expect(paths(diffs)).toEqual(["add components/messages/p.A/properties/kind/deprecation"])
    expect(JSON.stringify(merged)).not.toContain("allOf")
    expect(merged.components.messages["p.A"].properties.kind).toMatchObject({
      $ref: "#/components/enums/p.K",
      number: 1,
      deprecation: {},
    })
  })

  it("J2.2 a change inside a message is reported once, at the component, whatever uses it (R11, R-1)", () => {
    const uses = `message Wrap { Item item = 1; repeated Item items = 2; map<string, Item> byId = 3; }
      service S { rpc A(Item) returns (Item); rpc B(Wrap) returns (stream Item); rpc C(stream Wrap) returns (Wrap); }`
    const { diffs } = protoDiffs(
      `${header} message Item { string id = 1; int32 qty = 2; } ${uses}`,
      `${header} message Item { string id = 1; } ${uses}`,
    )
    expect(paths(diffs)).toEqual(["remove components/messages/p.Item/properties/qty"])
    expect(diffs[0]).toMatchObject({ type: breaking, scope: "components" })
    expect(diffs.every((d) => !("origin" in d))).toBe(true)
  })

  it("J2.3 a component used only by requests is classified in the request scope", () => {
    const diffs = enumValueAdded(`service S { rpc M(Req) returns (Res); }`, `message Req { E e = 1; } message Res {}`)
    expect(valueAdded(diffs)).toEqual([nonBreaking])
  })

  it("J2.4 a component used only by responses is classified in the response scope", () => {
    const diffs = enumValueAdded(`service S { rpc M(Req) returns (Res); }`, `message Req {} message Res { E e = 1; }`)
    expect(valueAdded(diffs)).toEqual([risky])
  })

  it("J2.5 a component used both ways takes the more severe class", () => {
    const diffs = enumValueAdded(
      `service S { rpc M(Req) returns (Res); rpc N(Res) returns (Req); }`,
      `message Req {} message Res { E e = 1; }`,
    )
    expect(valueAdded(diffs)).toEqual([risky])
    // the same with one message as request and response of one rpc
    expect(valueAdded(enumValueAdded(`service S { rpc M(Res) returns (Res); }`, `message Res { E e = 1; }`))).toEqual([
      risky,
    ])
  })

  it("J2.6 a component nothing references is classified as used both ways", () => {
    expect(valueAdded(enumValueAdded("", ""))).toEqual([risky])
    expect(valueAdded(enumValueAdded("", `message Lone { E e = 1; }`))).toEqual([risky])
  })

  it("J2.7 usage scopes propagate transitively through field types, repeated items and map values", () => {
    const chains = [
      `message Req { Mid mid = 1; } message Mid { Leaf leaf = 1; } message Leaf { E e = 1; } message Res {}`,
      `message Req { repeated Mid mid = 1; } message Mid { map<string, Leaf> leaves = 1; } message Leaf { repeated E e = 1; } message Res {}`,
      `message Req { map<int32, E> byId = 1; } message Res {}`,
    ]
    for (const chain of chains) {
      expect(valueAdded(enumValueAdded(`service S { rpc M(Req) returns (Res); }`, chain))).toEqual([nonBreaking])
      // the same chain reached from the response side
      expect(valueAdded(enumValueAdded(`service S { rpc M(Res) returns (Req); }`, chain))).toEqual([risky])
    }
  })

  it("J2.8 usage scopes are taken from the rpc sides' schema references in both documents", () => {
    // before: Res is unreferenced; after: the response is retargeted to it
    const { diffs } = protoDiffs(
      `${header} enum E { E_UNSPECIFIED = 0; } message Req {} message Res { E e = 1; } service S { rpc M(Req) returns (Req); }`,
      `${header} enum E { E_UNSPECIFIED = 0; E_NEW = 1; } message Req {} message Res { E e = 1; } service S { rpc M(Req) returns (Res); }`,
    )
    expect(valueAdded(diffs)).toEqual([risky])
    // the retarget itself is one diff of the rpc side (S5), in the response scope (TC-2: risky)
    expect(diffs.filter((d) => d.path[0] === "services")).toMatchObject([
      {
        action: "replace",
        path: ["services", "p.S", "methods", "M", "response"],
        type: risky,
        scope: "response",
      },
    ])
  })

  it('J2.9 components: "unclassified" leaves component changes unclassified, rpc changes keep their class', () => {
    const { before, after } = protoDocs(
      `${header} message Req { int32 a = 1; } service S { rpc M(Req) returns (Req); rpc N(Req) returns (Req); }`,
      `${header} message Req {} service S { rpc M(Req) returns (Req); }`,
    )
    const types = (components?: "usage" | "unclassified") =>
      protoCompare(before, after, { components }).diffs.map((d) => `${d.path.join("/")} ${d.type}`)
    expect(types("unclassified")).toEqual([
      `services/p.S/methods/N ${breaking}`,
      `components/messages/p.Req/properties/a ${unclassified}`,
    ])
    expect(types()).toEqual([
      `services/p.S/methods/N ${breaking}`,
      `components/messages/p.Req/properties/a ${breaking}`,
    ])
  })

  it("J2.10 structural rules keep their meaning in the response scope (AD-05)", () => {
    const service = `service S { rpc M(Req) returns (Res); }`
    const removed = protoDiffs(
      `${header} message Req {} message Res { int32 a = 1; } ${service}`,
      `${header} message Req {} message Res {} ${service}`,
    ).diffs
    expect(removed).toMatchObject([
      { action: "remove", path: ["components", "messages", "p.Res", "properties", "a"], type: breaking },
    ])
    // proto2 `required` field added to a response message: breaking for old writers and readers alike (F-2, Q5)
    const required = protoDiffs(
      `syntax = "proto2"; package p; message Req {} message Res {} ${service}`,
      `syntax = "proto2"; package p; message Req {} message Res { required int32 a = 1; } ${service}`,
    ).diffs
    expect(required).toMatchObject([{ action: "add", type: breaking }])
    // an optional field added is non-breaking in both directions (F-1, TC-3)
    for (const [req, res] of [
      ["int32 a = 1;", ""],
      ["", "int32 a = 1;"],
    ]) {
      const added = protoDiffs(
        `${header} message Req {} message Res {} ${service}`,
        `${header} message Req { ${req} } message Res { ${res} } ${service}`,
      ).diffs
      expect(added).toMatchObject([{ action: "add", type: nonBreaking }])
    }
  })

  it("J2.11 services, rpcs and components added or removed", () => {
    const types = (before: string, after: string) =>
      protoDiffs(`${header} ${before}`, `${header} ${after}`).diffs.map(
        (d) => `${d.action} ${d.path.join("/")} ${d.type}`,
      )
    const service = `service S { rpc M(A) returns (A); }`
    expect(types(`message A {}`, `message A {} ${service}`)).toEqual([`add services/p.S ${nonBreaking}`])
    expect(types(`message A {} ${service}`, `message A {}`)).toEqual([`remove services/p.S ${breaking}`])
    expect(types(`message A {} service S {}`, `message A {} ${service}`)).toEqual([
      `add services/p.S/methods/M ${nonBreaking}`,
    ])
    expect(types(`message A {} ${service}`, `message A {} service S {}`)).toEqual([
      `remove services/p.S/methods/M ${breaking}`,
    ])
    // a message, enum or extension removed is risky (G1, PD-5), added non-breaking
    expect(types(`message A {} message B {}`, `message A {}`)).toEqual([`remove components/messages/p.B ${risky}`])
    expect(types(`message A {}`, `message A {} enum F { F_UNSPECIFIED = 0; }`)).toEqual([
      `add components/enums/p.F ${nonBreaking}`,
    ])
    expect(types(`message A {} enum F { F_UNSPECIFIED = 0; }`, `message A {}`)).toEqual([
      `remove components/enums/p.F ${risky}`,
    ])
  })

  it("J2.12 a bundled file or declaration appearing or disappearing is an annotation (U3)", () => {
    const { diffs } = protoDiffs(
      `${header} message A {} service S { rpc M(A) returns (A); }`,
      `${header} import "google/protobuf/empty.proto"; message A {} service S { rpc M(A) returns (google.protobuf.Empty); }`,
    )
    expect(diffs.map((d) => `${d.action} ${d.path.join("/")} ${d.type}`)).toEqual([
      // the import statement itself (P-6)
      "add files/a.proto/imports/0 annotation",
      "add files/google/protobuf/empty.proto annotation",
      "replace services/p.S/methods/M/response risky",
      "add components/messages/google.protobuf.Empty annotation",
    ])
  })

  it("J2.13 a field's type is one value: one record at the field, no `protoType` or `$ref` records (DG-01)", () => {
    const service = `service S { rpc M(A) returns (A); }`
    const pairs: [string, string, string][] = [
      ["int32 f = 1;", "string f = 1;", "type"],
      ["int32 f = 1;", "B f = 1;", "$ref"],
      ["B f = 1;", "int32 f = 1;", "type"],
      ["B f = 1;", "C f = 1;", "$ref"],
      ["int32 f = 1;", "repeated int32 f = 1;", "type"],
      ["repeated int32 f = 1;", "map<string, int32> f = 1;", "type"],
      ["map<string, int32> f = 1;", "map<int64, int32> f = 1;", "type"],
      ["map<string, B> f = 1;", "map<string, C> f = 1;", "type"],
    ]
    for (const [from, to, carrier] of pairs) {
      const { diffs, merged } = protoDiffs(
        `${header} message B {} message C {} message A { ${from} } ${service}`,
        `${header} message B {} message C {} message A { ${to} } ${service}`,
      )
      expect(paths(diffs)).toEqual([`replace components/messages/p.A/properties/f/${carrier}`])
      expect(JSON.stringify(merged)).not.toContain("allOf")
    }
    // the carrier holds the canonical spellings; `merged` holds the original field
    const { diffs, merged } = protoDiffs(
      `${header} message A { repeated int32 f = 1; } ${service}`,
      `${header} message A { map<string, int32> f = 1; } ${service}`,
    )
    expect(diffs[0]).toMatchObject({ before: "repeated int32", after: "map<string, int32>" })
    expect(merged.components.messages["p.A"].properties.f).toMatchObject({
      type: "object",
      propertyNames: { type: "string" },
      additionalProperties: { type: "int32" },
    })
  })

  it("J2.14 the validators of a field whose shape changed fold into the shape record (PD-16, PD-27)", () => {
    const head = `${header} import "buf/validate/validate.proto";`
    const service = `service S { rpc M(Order) returns (Order); }`
    const { diffs } = protoDiffs(
      `${head} message Order { int32 qty = 3 [(buf.validate.field).int32.gt = 0]; string note = 4; } ${service}`,
      `${head} message Order { string qty = 3 [(buf.validate.field).string.min_len = 1]; string note = 4; } ${service}`,
    )
    expect(paths(diffs)).toEqual(["replace components/messages/p.Order/properties/qty/type"])
    // a description change at the same time keeps its own record (PD-27)
    const described = protoDiffs(
      `${head} message Order { int32 qty = 3 [(buf.validate.field).int32.gt = 0]; } ${service}`,
      `${head} message Order {
        // Quantity.
        string qty = 3 [(buf.validate.field).string.min_len = 1];
      } ${service}`,
    ).diffs
    expect(paths(described)).toEqual([
      "replace components/messages/p.Order/properties/qty/type",
      "add components/messages/p.Order/properties/qty/description",
    ])
    // without a shape change the validator is a record of its own
    const alone = protoDiffs(
      `${head} message Order { int32 qty = 3 [(buf.validate.field).int32.gt = 0]; } ${service}`,
      `${head} message Order { int32 qty = 3 [(buf.validate.field).int32.gt = 1]; } ${service}`,
    ).diffs
    expect(paths(alone)).toEqual(["replace components/messages/p.Order/properties/qty/exclusiveMinimum"])
  })

  it("J2.15 each rpc side is one value: one record per side for type and streaming (S5, DG-02)", () => {
    const messages = `message A {} message B {}`
    const rpc = (signature: string) =>
      protoDiffs(
        `${header} ${messages} service S { rpc M(A) returns (A); }`,
        `${header} ${messages} service S { rpc M${signature}; }`,
      ).diffs
    const records = (diffs: Diff[]) => diffs.map((d) => `${d.path.slice(4).join("/")} ${d.type} ${d.scope}`)
    // streaming toggled (R-5, R-6): breaking, with or without a retarget
    expect(records(rpc("(stream A) returns (A)"))).toEqual([`request ${breaking} request`])
    expect(records(rpc("(A) returns (stream A)"))).toEqual([`response ${breaking} response`])
    expect(records(rpc("(A) returns (stream B)"))).toEqual([`response ${breaking} response`])
    expect(records(rpc("(stream B) returns (stream B)"))).toEqual([
      `request ${breaking} request`,
      `response ${breaking} response`,
    ])
    // a retarget alone (R-3, R-4, TC-2): risky
    expect(records(rpc("(B) returns (A)"))).toEqual([`request ${risky} request`])
    // the record carries the original values; `merged` the after side
    const { diffs, merged } = protoDiffs(
      `${header} ${messages} service S { rpc M(A) returns (A); }`,
      `${header} ${messages} service S { rpc M(A) returns (stream B); }`,
    )
    expect(diffs[0]).toMatchObject({
      action: "replace",
      before: { schema: { $ref: "#/components/messages/p.A" } },
      after: { schema: { $ref: "#/components/messages/p.B" }, stream: true },
    })
    expect(merged.services["p.S"].methods.M.response).toMatchObject({
      schema: { $ref: "#/components/messages/p.B" },
      stream: true,
    })
  })

  it("J2.16 an extension is used where its extendee is (impliedReferences, inheritUsage)", () => {
    const doc = (extendee: string, values: string, service = "service S { rpc R(Req) returns (Res); }") =>
      `syntax = "proto2"; package p; enum E { E0 = 0; ${values} }
      message Req { extensions 100 to 199; } message Res { extensions 100 to 199; }
      extend ${extendee} { optional E e = 100; } ${service}`
    const valueAdded = (extendee: string, service?: string) =>
      protoDiffs(doc(extendee, "", service), doc(extendee, "E1 = 1;", service)).diffs.map((d) => d.type)
    // the enum is reached only through the extension: its usage is the extendee's
    expect(valueAdded("Req")).toEqual([nonBreaking])
    expect(valueAdded("Res")).toEqual([risky])
    // an unreferenced extendee: used both ways
    expect(valueAdded("Req", "")).toEqual([risky])
  })

  it("J2.17 a field joining or leaving a oneof is one oneof record, no presence record (DG-23)", () => {
    const service = `service S { rpc M(A) returns (A); }`
    const moves: [string, string][] = [
      ["optional string n = 3; oneof o { string a = 1; }", "oneof o { string a = 1; string n = 3; }"],
      ["oneof o { string a = 1; string n = 3; }", "optional string n = 3; oneof o { string a = 1; }"],
    ]
    for (const [from, to] of moves) {
      const { diffs } = protoDiffs(
        `${header} message A { ${from} } ${service}`,
        `${header} message A { ${to} } ${service}`,
      )
      expect(paths(diffs).map((p) => p.replace(/^(add|remove) /, ""))).toEqual([
        "components/messages/p.A/properties/n/oneof",
      ])
    }
    // edition 2023 fields have explicit presence by default
    const { diffs } = protoDiffs(
      `edition = "2023"; package p; message A { int32 n = 9; oneof o { int32 a = 1; } } ${service}`,
      `edition = "2023"; package p; message A { oneof o { int32 a = 1; int32 n = 9; } } ${service}`,
    )
    expect(paths(diffs)).toEqual(["add components/messages/p.A/properties/n/oneof"])
  })

  it("J2.18 one cause, one record per element: a syntax change merges the resolved keywords of an element (A4)", () => {
    const { diffs } = protoDiffs(
      `syntax = "proto2"; package p; message M { map<string, string> m = 1; optional string s = 2; }`,
      `syntax = "proto3"; package p; message M { map<string, string> m = 1; optional string s = 2; }`,
    )
    const counts = Object.fromEntries(recordsByElement(diffs))
    expect(counts).toEqual({
      "#/files/a.proto": 1,
      "#/components/messages/p.M": 1,
      "#/components/messages/p.M/properties/m": 1,
      "#/components/messages/p.M/properties/s": 1,
    })
    // the merged record of the map field stands for both positions; `merged` keeps the meta of both
    const record = diffs.find((d) => diffElement(d) === "#/components/messages/p.M/properties/m") as Diff
    expect(record).toMatchObject({ action: "remove", before: false })
    const field = protoDiffs(
      `syntax = "proto2"; package p; message M { map<string, string> m = 1; }`,
      `syntax = "proto3"; package p; message M { map<string, string> m = 1; }`,
      { metaKey: "$diff" },
    ).merged.components.messages["p.M"].properties.m
    expect(field.propertyNames.$diff).toMatchObject({ utf8Validation: { action: "remove" } })
    expect(field.additionalProperties.$diff).toMatchObject({ utf8Validation: { action: "remove" } })
  })

  // ISSUE-370 (fixed): a reordering of enum values leaves the documents equal for the unchanged-subtree check (it
  // compares objects without their key order), so the implicit default change was never reported
  it("J2.19 a closed enum's first value changed: one default record per enum field without a default (C6, F-32)", () => {
    const doc = (values: string) =>
      `${proto2} enum Color { ${values} } message Order { optional Color a = 1; optional Color b = 2 [default = RED]; repeated Color c = 3; }`
    const { diffs, merged } = protoDiffs(doc("RED = 1; GREEN = 2;"), doc("GREEN = 2; RED = 1;"), { metaKey: "$diff" })
    expect(paths(diffs)).toEqual(["remove components/messages/p.Order/properties/a/default"])
    expect(diffs[0]).toMatchObject({ before: "RED" })
    // `merged` shows the removed implicit default with its meta (the one documented artifact)
    expect(merged.components.messages["p.Order"].properties.a).toMatchObject({
      default: "RED",
      $diff: { default: { action: "remove" } },
    })
    // an open enum's default is the value numbered 0: reordering the others changes nothing
    expect(
      protoDiffs(
        `${header} enum E { E0 = 0; A = 1; B = 2; } message M { E e = 1; }`,
        `${header} enum E { E0 = 0; B = 2; A = 1; } message M { E e = 1; }`,
      ).diffs,
    ).toEqual([])
  })

  // a reference chain of `n` messages from the rpc sides down to `p.M0`, whose field `x` has the type `type`
  const chain = (n: number, type: string) => ({
    protoapi: "0.1",
    files: { "a.proto": { syntax: "proto3", package: "p" } },
    services: {
      "p.S": {
        title: "S",
        file: "a.proto",
        methods: {
          Call: {
            request: { schema: { $ref: `#/components/messages/p.M${n - 1}` } },
            response: { schema: { $ref: `#/components/messages/p.M${n - 1}` } },
          },
        },
      },
    },
    components: {
      messages: Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `p.M${i}`,
          {
            title: `M${i}`,
            file: "a.proto",
            type: "object",
            properties:
              i === 0 ? { x: { number: 1, type } } : { next: { number: 1, $ref: `#/components/messages/p.M${i - 1}` } },
          },
        ]),
      ),
    },
  })

  // ISSUE-410 (fixed): the usage index followed the component-to-component references recursively, one call frame per
  // component, so a component at the end of a long reference chain (about 10 000 messages under node with the default
  // stack) overflowed the call stack and its changes were reported unclassified with a classification error (the
  // unchanged-subtree check, which has its own depth problem, ISSUE-411, is off here)
  it("J2.20 usage scopes propagate through a 20 000-message reference chain", () => {
    const { diffs, errors } = protoCompare(chain(20_000, "string"), chain(20_000, "bytes"), { compareUnchanged: true })
    expect(errors ?? []).toEqual([])
    expect(diffs.map((d) => [d.path.join("/"), d.type])).toEqual([
      ["components/messages/p.M0/properties/x/type", breaking],
    ])
  })

  // ISSUE-411 (fixed): the unchanged-subtree check followed `$ref` targets recursively without a bound (its depth limit
  // counts object nesting only and restarts at every target), so checking the message at the top of a long chain
  // overflowed the call stack and `compareProtoApi` threw `RangeError`; ISSUE-412 (fixed): the way to the difference it
  // hands to the walk ran through every target of the chain, so a chain compared in quadratic time (16 s here)
  it("J2.21 a 20 000-message reference chain with a change at its end compares without exceeding the call stack", () => {
    const { diffs, errors } = protoCompare(chain(20_000, "string"), chain(20_000, "bytes"))
    expect(errors ?? []).toEqual([])
    expect(diffs.map((d) => [d.path.join("/"), d.type])).toEqual([
      ["components/messages/p.M0/properties/x/type", breaking],
    ])
  })
})
