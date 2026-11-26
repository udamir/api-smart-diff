import { locateDiff } from "protoapi"

import { type Diff } from "../../src"
import { locateProtoApiContainer } from "../../src/protoapi/protoapi.annotate"
import { protoCompare, protoDocs, type ProtoInput } from "../helpers"
import { fieldCases } from "./fixtures/matrix-cases"

// J13 (PROTOAPI_DESIGN §4.12, §9.1): the merged document (the after document with `$diff` meta, original values: the
// shape carrier and the bound carrier are shadow keys, rewritten before names and keys never reach it), the one
// documented artifact (the implicit default, C6), the meta of every keyword merged by `mergeElementDiffs` (PD-25), and
// `locateDiff` (protoapi) giving a location for every record of the J5 fixtures and of the A2 / A5 / S5 / S6 records.

const metaKey = Symbol("diff")

// biome-ignore lint/suspicious/noExplicitAny: merged documents are read by path
type Any = any

const compare = (before: ProtoInput, after: ProtoInput, options = {}) => {
  const docs = protoDocs(before, after)
  const result = protoCompare(docs.before, docs.after, { metaKey, ...options })
  return { ...result, docs, merged: result.merged as Any }
}

const p3 = (body: string, imports = "") => `syntax = "proto3";\npackage p;\n${imports}\n${body}\n`
const validate = `import "buf/validate/validate.proto";`

const located = (diffs: Diff[], docs: ReturnType<typeof protoDocs>) =>
  diffs.map((diff) => ({
    record: `${diff.action} ${diff.path.join("/")}`,
    location: locateDiff(diff, docs.maps.before, docs.maps.after) !== undefined,
  }))

describe("Block J13 — ProtoApi merged document and locations", () => {
  it("J13.1 a keyword record leaves its `$diff` meta on its field", () => {
    const { merged } = compare(
      p3("message M { string s = 1 [(buf.validate.field).string.max_len = 50]; }", validate),
      p3("message M { string s = 1 [(buf.validate.field).string.max_len = 30]; }", validate),
    )
    const field = merged.components.messages["p.M"].properties.s
    expect(field.maxLength).toBe(30)
    expect(field[metaKey]).toEqual({ maxLength: { action: "replace", type: "breaking", replaced: 50 } })
  })

  it("J13.2 the shape carrier is a shadow key: merged holds the original after field", () => {
    const { merged, docs } = compare(p3("message M { int32 n = 1; }"), p3("message M { repeated string n = 1; }"))
    const field = merged.components.messages["p.M"].properties.n
    const original = (docs.after as Any).components.messages["p.M"].properties.n
    // symbol keys (the meta) are not part of the JSON value
    expect(JSON.parse(JSON.stringify(field))).toEqual(original)
    expect(field[metaKey].type).toMatchObject({ action: "replace", type: "breaking" })
  })

  it("J13.3 the bound carrier keeps the original keywords in merged; the meta names the carrier key (S3)", () => {
    const { merged, diffs } = compare(
      p3("message M { int64 n = 1 [(buf.validate.field).int64.gt = 0]; }", validate),
      p3("message M { int64 n = 1 [(buf.validate.field).int64.gte = 0]; }", validate),
    )
    const field = merged.components.messages["p.M"].properties.n
    expect(diffs).toHaveLength(1)
    expect(field.minimum).toBe("0")
    expect(field.exclusiveMinimum).toBeUndefined()
    expect(field[metaKey].minimum).toMatchObject({ action: "replace", replaced: "> 0" })
  })

  it("J13.4 a package change (A2): merged has the after keys only, the package meta on the file", () => {
    const { merged, diffs } = compare(
      { "a.proto": 'syntax = "proto3";\npackage shop.v1;\nmessage Pet { string name = 1; }\n' },
      { "a.proto": 'syntax = "proto3";\npackage shop.v2;\nmessage Pet { string name = 1; }\n' },
    )
    expect(diffs.map((diff) => diff.path.join("/"))).toEqual(["files/a.proto/package"])
    expect(Object.keys(merged.components.messages)).toEqual(["shop.v2.Pet"])
    expect(merged.files["a.proto"][metaKey]).toEqual({
      package: { action: "replace", type: "breaking", replaced: "shop.v1" },
    })
  })

  it("J13.5 the implicit default artifact (C6): merged shows the removed implicit default with its meta", () => {
    const { merged } = compare(
      {
        "a.proto": 'syntax = "proto2";\npackage p;\nenum C { RED = 1; GREEN = 2; }\nmessage M { optional C c = 1; }\n',
      },
      {
        "a.proto": 'syntax = "proto2";\npackage p;\nenum C { GREEN = 2; RED = 1; }\nmessage M { optional C c = 1; }\n',
      },
    )
    const field = merged.components.messages["p.M"].properties.c
    expect(field.default).toBe("RED")
    expect(field[metaKey]).toEqual({ default: { action: "remove", type: "breaking" } })
  })

  it("J13.6 keywords merged by mergeElementDiffs keep their meta in merged (PD-25)", () => {
    const { merged, diffs } = compare(
      { "a.proto": 'syntax = "proto2";\npackage p;\nmessage M { optional string s = 1; }\n' },
      { "a.proto": 'syntax = "proto3";\npackage p;\nmessage M { string s = 1; }\n' },
    )
    expect(diffs.filter((diff) => diff.path.includes("s"))).toHaveLength(1)
    const meta = merged.components.messages["p.M"].properties.s[metaKey]
    expect(Object.keys(meta).sort()).toEqual(["presence", "utf8Validation"])
  })

  it("J13.7 the PD-16 shape fold keeps the meta of the folded validators", () => {
    const { merged, diffs } = compare(
      p3("message M { int32 q = 3 [(buf.validate.field).int32.gt = 0]; }", validate),
      p3("message M { string q = 3 [(buf.validate.field).string.min_len = 1]; }", validate),
    )
    expect(diffs).toHaveLength(1)
    const meta = merged.components.messages["p.M"].properties.q[metaKey]
    expect(Object.keys(meta).sort()).toEqual(["exclusiveMinimum", "minLength", "type"])
  })

  it('J13.8 `merged: "normalized"` shows the shadow values (the shape carrier spelling)', () => {
    const { merged } = compare(p3("message M { int32 n = 1; }"), p3("message M { int64 n = 1; }"), {
      merged: "normalized",
    })
    expect(merged.components.messages["p.M"].properties.n.type).toBe("int64")
  })

  it("J13.9 locateDiff gives a location for every record of the J5 fixtures", () => {
    for (const item of fieldCases) {
      const docs = protoDocs(item.before, item.after, item.build)
      if (item.edit) {
        continue
      }
      const { diffs } = protoCompare(docs.before, docs.after, item.options)
      for (const entry of located(diffs, docs)) {
        expect({ case: item.id, ...entry }).toEqual({ case: item.id, record: entry.record, location: true })
      }
    }
  })

  it("J13.10 locateDiff gives a location for the A2, A5, S5 and S6 records", () => {
    const pairs: [ProtoInput, ProtoInput][] = [
      [
        { "a.proto": 'syntax = "proto3";\npackage shop.v1;\nmessage Pet {}\n' },
        { "a.proto": 'syntax = "proto3";\npackage shop.v2;\nmessage Pet {}\n' },
      ],
      [
        { "pet.proto": 'syntax = "proto3";\npackage p;\nmessage Pet {}\n' },
        { "shop/pet.proto": 'syntax = "proto3";\npackage p;\nmessage Pet {}\n' },
      ],
      [
        p3("message A {}\nservice S { rpc Get(A) returns (A); }"),
        p3("message A {}\nservice S { rpc Get(A) returns (stream A); }"),
      ],
      [
        p3(
          'message A {}\nservice S { rpc Get(A) returns (A) { option (google.api.http) = { get: "/a" }; } }',
          `import "google/api/annotations.proto";`,
        ),
        p3(
          'message A {}\nservice S { rpc Get(A) returns (A) { option (google.api.http) = { post: "/a" body: "*" }; } }',
          `import "google/api/annotations.proto";`,
        ),
      ],
    ]
    for (const [before, after] of pairs) {
      const docs = protoDocs(before, after)
      const { diffs } = protoCompare(docs.before, docs.after)
      expect(diffs).toHaveLength(1)
      expect(located(diffs, docs)).toEqual([
        { record: `${diffs[0].action} ${diffs[0].path.join("/")}`, location: true },
      ])
    }
  })

  it("J13.11 locateProtoApiContainer names the element of a record with its container", () => {
    const docs = protoDocs(p3("message M { string s = 1; }"), p3("message M { string s = 1 [deprecated = true]; }"))
    const containers: unknown[] = []
    protoCompare(docs.before, docs.after, {
      annotateHook: (diff, ctx) => {
        containers.push(locateProtoApiContainer(diff, ctx))
        return ""
      },
    })
    expect(containers).toEqual([{ name: "field `s` (1) in message `p.M`", length: 5 }])
  })

  it("J13.12 every record of a comparison carries a description (the hook covers every path)", () => {
    const docs = protoDocs(
      p3("message M { string s = 1; int32 n = 2; }\nenum E { E0 = 0; }"),
      p3("message M { int64 s = 1; reserved 2; }\nenum E { E0 = 0; E1 = 1; }"),
    )
    const { diffs } = protoCompare(docs.before, docs.after)
    expect(diffs.length).toBeGreaterThan(1)
    expect(diffs.every((diff) => typeof diff.description === "string" && diff.description.length > 0)).toBe(true)
  })
})
