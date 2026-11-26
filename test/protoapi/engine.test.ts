import {
  allAnnotation,
  allBreaking,
  annotation,
  apiCompare,
  breaking,
  compare,
  compareJsonSchema,
  compareProtoApi,
  detectSpec,
  nonBreaking,
  risky,
  unclassified,
  UnsupportedSpecError,
  type CompareRules,
  type ProtoApiCompatibility,
} from "../../src"
import { discoverCompareEngine } from "../../src/api"
import { proto, protoDiffs, protoDocs, protoCompare } from "../helpers"

const levels: ProtoApiCompatibility[] = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]

// a document that touches every part of the format the Q1 tree knows: files (a bundled WKT included), services with
// streaming and options, messages with every field shape, oneofs, reserved ranges and names, extension ranges, enums,
// extensions of a custom option and of a message, annotation keywords
const richSources = {
  "shop/v1/pet.proto": `syntax = "proto2";
package shop.v1;
import "google/protobuf/descriptor.proto";
import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";
option java_package = "com.example.shop";

// Kind of pet.
enum Kind {
  KIND_UNSPECIFIED = 0;
  DOG = 1;
  CAT = 2 [deprecated = true];
}

extend google.protobuf.FieldOptions { optional int32 audit = 50001; }

// A pet.
message Pet {
  required string id = 1;
  optional Kind kind = 2 [deprecated = true, (audit) = 3];
  repeated int64 tags = 3;
  map<string, int32> counts = 4;
  optional google.protobuf.Timestamp born = 5;
  oneof owner { string person = 6; int32 shelter = 7; }
  optional Pet parent = 8;
  extensions 100 to 199;
  reserved 20, 21 to 25;
  reserved "legacy";
}

extend Pet { optional string note = 100; }

service PetService {
  option deprecated = true;
  rpc Get(Pet) returns (Pet) { option idempotency_level = NO_SIDE_EFFECTS; }
  rpc Watch(Pet) returns (stream Pet);
  rpc Ping(google.protobuf.Empty) returns (google.protobuf.Empty);
}
`,
}

const fileRemovedPair = () =>
  protoDocs(
    {
      "a.proto": `syntax = "proto3"; package p; message A {}`,
      "b.proto": `syntax = "proto3"; package p; message B {}`,
    },
    { "a.proto": `syntax = "proto3"; package p; message A {}` },
  )

const fileOf = (diffs: { path: unknown[]; action: string; type: string }[], path: string) =>
  diffs.filter((d) => d.path.join("/") === path).map((d) => `${d.action} ${d.type}`)

describe("Block J1 — ProtoApi engine", () => {
  it("J1.1 documents with protoapi 0.1 / 0.1.0 are detected as ProtoApi", () => {
    expect(detectSpec({ protoapi: "0.1" })).toEqual({ engine: "protoapi", version: "0.1" })
    expect(detectSpec({ protoapi: "0.1.0" })).toEqual({ engine: "protoapi", version: "0.1.0" })
    expect(detectSpec({ protoapi: 0.1 })).toEqual({ engine: "protoapi", version: "0.1" })
    expect(detectSpec(proto`syntax = "proto3"; message A {}`)).toEqual({ engine: "protoapi", version: "0.1" })
    expect(discoverCompareEngine({ protoapi: "0.1" })).toBe(compareProtoApi)
    // a falsy marker is not a specification marker (as for `graphapi`)
    expect(detectSpec({ protoapi: "" })).toEqual({ engine: "jsonschema" })
  })

  it("J1.2 unsupported ProtoApi versions are rejected with UnsupportedSpecError", () => {
    for (const version of ["1.0", "1", "0", "0.1.0.1", "v0.1", "0.x"]) {
      expect(() => detectSpec({ protoapi: version })).toThrow(UnsupportedSpecError)
    }
    expect(() => apiCompare({ protoapi: "1.0" }, { protoapi: "1.0" })).toThrow(/Unsupported ProtoApi version: 1.0/)
  })

  it("J1.3 apiCompare routes ProtoApi documents to compareProtoApi", () => {
    const { before, after } = protoDocs(
      `syntax = "proto3"; package p; message A { string a = 1; }`,
      `syntax = "proto3"; package p; message A { string a = 1; int32 b = 2; }`,
    )
    const metaKey = Symbol("diff")
    const viaApi = apiCompare(before, after, { metaKey })
    const direct = protoCompare(before, after, { metaKey })
    expect(viaApi.diffs).toEqual(direct.diffs)
    expect(viaApi.merged).toEqual(direct.merged)
    expect(viaApi.diffs).toMatchObject([{ action: "add", path: ["components", "messages", "p.A", "properties", "b"] }])
  })

  it("J1.4 a ProtoApi document is never compared with a document of another specification", () => {
    const doc = proto`syntax = "proto3"; message A {}`
    expect(() => apiCompare(doc, { openapi: "3.0.0" })).toThrow(UnsupportedSpecError)
    expect(() => apiCompare({ graphapi: "1.0" }, doc)).toThrow(/Cannot compare a graphapi document with a protoapi/)
    expect(() => apiCompare(doc, { type: "object" })).toThrow(/Cannot compare a protoapi document with a jsonschema/)
  })

  it("J1.5 options.engine forces the ProtoApi engine or another one", () => {
    const { before, after } = protoDocs(
      `syntax = "proto3"; message A {}`,
      `syntax = "proto3"; message A {} message B {}`,
    )
    expect(apiCompare(before, after, { engine: "protoapi" }).diffs).toEqual(protoCompare(before, after).diffs)
    // forced JSON Schema: the document is plain JSON, the ProtoApi rules do not apply
    expect(apiCompare(before, after, { engine: "jsonschema" }).diffs).toEqual(compareJsonSchema(before, after).diffs)
    // a hand-made document without a marker can be forced onto the ProtoApi engine only when it is a ProtoApi document
    expect(() => apiCompare({ a: 1 }, { a: 2 }, { engine: "protoapi" })).toThrow(UnsupportedSpecError)
  })

  // AD-11: both documents of a comparison come from one format version; the engine knows only format 0.1
  // POLICY-133 (agent-decided, awaiting user review): `detectSpec` accepts every `0.<minor>[.<patch>]` (DG-40), the
  // engine compares only 0.1 and rejects other 0.x versions with UnsupportedSpecError instead of reading them as 0.1
  it("J1.6 different or unknown format versions are rejected by the engine (AD-11)", () => {
    const doc = { protoapi: "0.1", services: {} }
    expect(protoCompare({ ...doc, protoapi: "0.1" }, { ...doc, protoapi: "0.1.0" }).diffs).toMatchObject([
      { action: "replace", path: ["protoapi"], type: annotation },
    ])
    expect(detectSpec({ protoapi: "0.2" })).toEqual({ engine: "protoapi", version: "0.2" })
    expect(() => apiCompare({ ...doc, protoapi: "0.2" }, doc)).toThrow(/Unsupported ProtoApi version: 0.2/)
    expect(() => apiCompare(doc, { ...doc, protoapi: "0.2" })).toThrow(/Unsupported ProtoApi version: 0.2/)
    expect(() => protoCompare({ ...doc, protoapi: "0.2" }, { ...doc, protoapi: "0.2" })).toThrow(UnsupportedSpecError)
    expect(() => protoCompare({ openapi: "3.0.0" }, doc)).toThrow(UnsupportedSpecError)
  })

  it("J1.7 the rule tree follows options.compatibility (one cached tree per level)", () => {
    const { before, after } = fileRemovedPair()
    const expected: Record<ProtoApiCompatibility, string> = {
      FILE: risky,
      PACKAGE: annotation,
      WIRE_JSON: annotation,
      WIRE: annotation,
    }
    // alternate the levels twice: each call gets the tree of its own level, never the tree of the previous call
    for (const compatibility of [...levels, ...levels.slice().reverse()]) {
      const { diffs } = protoCompare(before, after, { compatibility })
      expect(fileOf(diffs, "files/b.proto")).toEqual([`remove ${expected[compatibility]}`])
    }
    // the default level is FILE (U4)
    expect(fileOf(protoCompare(before, after).diffs, "files/b.proto")).toEqual([`remove ${risky}`])
    // a file added (P-1): non-breaking in FILE / PACKAGE, annotation in WIRE_JSON / WIRE
    const added = levels.map((compatibility) =>
      fileOf(protoCompare(after, before, { compatibility }).diffs, "files/b.proto"),
    )
    expect(added).toEqual([
      [`add ${nonBreaking}`],
      [`add ${nonBreaking}`],
      [`add ${annotation}`],
      [`add ${annotation}`],
    ])
    expect(() => protoCompare(before, after, { compatibility: "CSR" as ProtoApiCompatibility })).toThrow(TypeError)
  })

  it("J1.8 the rule tree follows options.files (one cached tree per level and files mode)", () => {
    const removed = fileRemovedPair()
    const pkg = protoDocs(
      `syntax = "proto3"; package p.v1; message A {}`,
      `syntax = "proto3"; package p.v2; message A {}`,
    )
    for (const compatibility of levels) {
      // files: "ignore": file rows are annotations (P-19), the package keeps its class (PD-21)
      const ignored = protoCompare(removed.before, removed.after, { compatibility, files: "ignore" }).diffs
      expect(fileOf(ignored, "files/b.proto")).toEqual([`remove ${annotation}`])
      const pkgIgnored = protoCompare(pkg.before, pkg.after, { compatibility, files: "ignore" }).diffs
      expect(fileOf(pkgIgnored, "files/a.proto/package")).toEqual([`replace ${breaking}`])
    }
    // the default mode again after the "ignore" trees
    expect(fileOf(protoCompare(removed.before, removed.after).diffs, "files/b.proto")).toEqual([`remove ${risky}`])
    expect(fileOf(protoCompare(removed.before, removed.after, { files: "compare" }).diffs, "files/b.proto")).toEqual([
      `remove ${risky}`,
    ])
    expect(() => protoCompare(removed.before, removed.after, { files: "drop" as "ignore" })).toThrow(TypeError)
  })

  it("J1.9 optionRules build a tree of their own; the cached trees stay untouched", () => {
    const { before, after } = protoDocs(
      `syntax = "proto3"; package p; import "google/protobuf/descriptor.proto";
       extend google.protobuf.MessageOptions { optional string audit = 50001; optional string owner = 50002; }
       message A { option (audit) = "x"; option (owner) = "a"; }`,
      `syntax = "proto3"; package p; import "google/protobuf/descriptor.proto";
       extend google.protobuf.MessageOptions { optional string audit = 50001; optional string owner = 50002; }
       message A { option (audit) = "y"; option (owner) = "b"; }`,
    )
    const optionDiffs = (diffs: { path: unknown[]; type: string }[]) =>
      Object.fromEntries(
        diffs.filter((d) => d.path.includes("options")).map((d) => [String(d.path[d.path.length - 1]), d.type]),
      )
    // unknown and custom options are unclassified by default (C7)
    expect(optionDiffs(protoCompare(before, after).diffs)).toEqual({
      "p.audit": unclassified,
      "p.owner": unclassified,
    })
    // an exact key and a prefix key (exact > longest prefix > `/*`)
    const custom = protoCompare(before, after, {
      optionRules: { "/p.audit": { $: allBreaking }, "/p.*": { $: allAnnotation } },
    })
    expect(optionDiffs(custom.diffs)).toEqual({ "p.audit": breaking, "p.owner": annotation })
    expect(optionDiffs(protoCompare(before, after).diffs)).toEqual({
      "p.audit": unclassified,
      "p.owner": unclassified,
    })
  })

  it("J1.10 custom extensions build a tree of their own; x-* keys are annotations by default", () => {
    const before = { protoapi: "0.1", components: { messages: { "p.A": { type: "object", properties: {} } } } }
    const after = {
      protoapi: "0.1",
      components: { messages: { "p.A": { type: "object", properties: {}, "x-owner": "team-a" } } },
    }
    const types = (options = {}) =>
      protoCompare(before, after, options).diffs.map((d) => `${d.path.join("/")} ${d.type}`)
    expect(types()).toEqual([`components/messages/p.A/x-owner ${annotation}`])
    expect(types({ extensions: { "/x-owner": { $: allBreaking } } })).toEqual([
      `components/messages/p.A/x-owner ${breaking}`,
    ])
    expect(types()).toEqual([`components/messages/p.A/x-owner ${annotation}`])
  })

  it("J1.11 identical documents give no diff at every level and in both files modes", () => {
    for (const compatibility of levels) {
      for (const files of ["compare", "ignore"] as const) {
        const { diffs, before } = protoDiffs(richSources, richSources, { compatibility, files })
        expect(diffs).toEqual([])
        expect(Object.keys(before.files ?? {})).toContain("google/protobuf/timestamp.proto")
      }
    }
    // the same document object on both sides, and a copy built with `files: false`
    const doc = proto`syntax = "proto3"; package p; message A { string a = 1; } service S { rpc M(A) returns (A); }`
    expect(protoCompare(doc, doc).diffs).toEqual([])
    const noFiles = protoDocs(richSources, richSources, { files: false })
    expect(noFiles.before.files).toBeUndefined()
    expect(protoCompare(noFiles.before, noFiles.after).diffs).toEqual([])
  })

  it("J1.12 a comparison never mutates its inputs", () => {
    const changed = {
      "shop/v1/pet.proto": richSources["shop/v1/pet.proto"]
        .replace("repeated int64 tags = 3;", "repeated string tags = 3;")
        .replace("rpc Watch(Pet) returns (stream Pet);", "rpc Watch(stream Pet) returns (Pet);")
        .replace("CAT = 2 [deprecated = true];", "CAT = 2; BIRD = 3;")
        .replace('option java_package = "com.example.shop";', ""),
      "shop/v1/extra.proto": `syntax = "proto3"; package shop.v1; message Extra { string x = 1; }`,
    }
    const { before, after } = protoDocs(richSources, changed)
    const snapshot = JSON.stringify([before, after])
    for (const compatibility of levels) {
      const result = protoCompare(before, after, { compatibility })
      expect(result.diffs.length).toBeGreaterThan(0)
      protoCompare(after, before, { compatibility })
    }
    expect(JSON.stringify([before, after])).toBe(snapshot)
  })

  // the unchanged-subtree check skips equal subtrees only when both documents agree on the profile keys
  // (`core/unchanged.ts`); `protoapi` is one of them
  it("J1.13 protoapi is a profile key of the unchanged-subtree check", () => {
    const calls: unknown[] = []
    const rules: CompareRules = {
      "/protoapi": { $: allAnnotation },
      "/services": {
        "/*": {
          compare: (ctx) => {
            calls.push(ctx.before.path.join("/"))
            return { diffs: [], merged: ctx.after.value }
          },
        },
      },
    }
    const doc = { services: { "p.S": { methods: {} } } }
    compare({ protoapi: "0.1", ...doc }, { protoapi: "0.1", ...doc }, { rules })
    expect(calls).toEqual([])
    compare({ protoapi: "0.1", ...doc }, { protoapi: "0.1.0", ...doc }, { rules })
    expect(calls).toEqual(["services/p.S"])
  })

  it("J1.14 scalar positions carry the protobuf scalar in `type` (ProtoApi 0.1 as published): validators apply by it", () => {
    // protoapi 0.1.0 writes `{ type: int64 }` / `{ type: bytes }` at a scalar position (no JSON Schema type)
    const { before, after } = protoDocs(
      {
        "a.proto": `syntax = "proto3"; package p; import "buf/validate/validate.proto";
service S { rpc M(A) returns (A); }
message A {
  bytes data = 1 [(buf.validate.field).bytes.max_len = 10];
  int64 size = 2 [(buf.validate.field).int64.lte = 100];
}`,
      },
      {
        "a.proto": `syntax = "proto3"; package p; import "buf/validate/validate.proto";
service S { rpc M(A) returns (A); }
message A {
  bytes data = 1 [(buf.validate.field).bytes.max_len = 5];
  int64 size = 2 [(buf.validate.field).int64.lte = 50];
}`,
      },
    )
    const fields = (before as any).components.messages["p.A"].properties
    expect(fields.data).toMatchObject({ type: "bytes", maxLength: 10 })
    expect(fields.size).toMatchObject({ type: "int64", maximum: "100" })
    expect(fields.data).not.toHaveProperty("protoType")
    const { diffs } = compareProtoApi(before, after)
    // a tightened bound of a message used both ways is breaking (request side), not an annotation
    expect(
      diffs.map((diff) => `${diff.path[diff.path.length - 1]} ${diff.type}`).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["maximum breaking", "maxLength breaking"])
    // a validator of another scalar type has no effect: an annotation
    const mismatched = (document: unknown, value: number) => {
      const copy = structuredClone(document) as any
      copy.components.messages["p.A"].properties.size.maxLength = value
      return copy
    }
    const result = compareProtoApi(mismatched(before, 10), mismatched(before, 5))
    expect(result.diffs.map((diff) => `${diff.path[diff.path.length - 1]} ${diff.type}`)).toEqual([
      "maxLength annotation",
    ])
  })
})
