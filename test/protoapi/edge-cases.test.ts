import { buildFromDescriptorSet, buildFromProto, locateDiff } from "protoapi"

import { type Diff, type ProtoApiCompareOptions, type ProtoApiCompatibility } from "../../src"
import { diffElement } from "../../src/protoapi/protoapi.utils"
import { type ProtoBuildOptions, type ProtoInput, protoCompare, protoDocs } from "../helpers"

// J14 (PROTOAPI_DESIGN §7.3): the edge cases. Each test asserts the records (`<action> <path> <type>` at FILE unless
// stated) and, where §7.3 names it, the description; every description passes the R-D lint (`protoCompare`).

const p3 = (body: string, imports = "") => `syntax = "proto3";\npackage p;\n${imports}\n${body}\n`
const p2 = (body: string) => `syntax = "proto2";\npackage p;\n${body}\n`
const e23 = (body: string, imports = "") => `edition = "2023";\npackage p;\n${imports}\n${body}\n`
const M = "components/messages/p.M/properties"

const records = (
  before: ProtoInput,
  after: ProtoInput,
  options: ProtoApiCompareOptions = {},
  build: ProtoBuildOptions = {},
): string[] => {
  const docs = protoDocs(before, after, build)
  return protoCompare(docs.before, docs.after, options).diffs.map(
    (diff) =>
      `${diff.action} ${diff.path.join("/")}${diff.action === "rename" ? ` ${String(diff.before)}->${String(diff.after)}` : ""} ${diff.type}`,
  )
}

const diffsOf = (before: ProtoInput, after: ProtoInput, options: ProtoApiCompareOptions = {}): Diff[] => {
  const docs = protoDocs(before, after)
  return protoCompare(docs.before, docs.after, options).diffs
}

const descriptions = (before: ProtoInput, after: ProtoInput, options: ProtoApiCompareOptions = {}) =>
  diffsOf(before, after, options).map((diff) => diff.description)

const at = (level: ProtoApiCompatibility) => ({ compatibility: level })

describe("Block J14 — ProtoApi edge cases (§7.3)", () => {
  it("J14.1 a field renumbered and renamed at once is remove + add", () => {
    expect(records(p3("message M { string a = 1; }"), p3("message M { string b = 2; }"))).toEqual([
      `remove ${M}/a breaking`,
      `add ${M}/b non-breaking`,
    ])
  })

  it("J14.2 two fields that swap numbers are two renames, plus shape records when the types differ", () => {
    expect(
      records(p3("message M { string a = 1; string b = 2; }"), p3("message M { string b = 1; string a = 2; }")),
    ).toEqual([`rename ${M} a->b breaking`, `rename ${M} b->a breaking`])
    expect(
      records(p3("message M { string a = 1; int32 b = 2; }"), p3("message M { int32 b = 1; string a = 2; }")).length,
    ).toBe(4)
  })

  it("J14.3 a field moved to another message is remove + add", () => {
    expect(
      records(p3("message M { string a = 1; }\nmessage N {}"), p3("message M {}\nmessage N { string a = 1; }")),
    ).toEqual([`remove ${M}/a breaking`, "add components/messages/p.N/properties/a non-breaking"])
  })

  it("J14.4 a message moved to another package: component removed and added, the usage retargeted (TC-2)", () => {
    const before = {
      "a.proto": p3('import "b.proto";\nmessage Pet {}\nmessage U { Pet pet = 1; }'),
      "b.proto": 'syntax = "proto3";\npackage q;\n',
    }
    const after = {
      "a.proto": p3('import "b.proto";\nmessage U { q.Pet pet = 1; }'),
      "b.proto": 'syntax = "proto3";\npackage q;\nmessage Pet {}\n',
    }
    expect(records(before, after)).toEqual([
      "remove components/messages/p.Pet risky",
      "replace components/messages/p.U/properties/pet/$ref risky",
      "add components/messages/q.Pet non-breaking",
    ])
  })

  it("J14.5 a message moved to another file of the package: the declaring file, FILE risky, other levels annotation", () => {
    const before = { "a.proto": p3("message Pet {}"), "b.proto": p3("message Other {}") }
    const after = { "a.proto": p3(""), "b.proto": p3("message Other {}\nmessage Pet {}") }
    expect(records(before, after)).toEqual(["replace components/messages/p.Pet/file risky"])
    expect(records(before, after, at("PACKAGE"))).toEqual(["replace components/messages/p.Pet/file annotation"])
  })

  it('J14.6 a file renamed with unchanged content is one rename (A5); `files: "ignore"` makes it an annotation', () => {
    const before = { "pet.proto": p3("message Pet {}") }
    const after = { "shop/pet.proto": p3("message Pet {}") }
    expect(records(before, after)).toEqual(["rename files pet.proto->shop/pet.proto risky"])
    expect(records(before, after, at("PACKAGE"))).toEqual(["rename files pet.proto->shop/pet.proto annotation"])
    expect(records(before, after, { files: "ignore" })).toEqual(["rename files pet.proto->shop/pet.proto annotation"])
  })

  it("J14.7 an alias added (V-2) or removed (V-3) while the number stays", () => {
    const base = "enum E { option allow_alias = true; Z = 0; A = 1;"
    expect(records(p3(`${base} }`), p3(`${base} B = 1; }`))).toEqual(["add components/enums/p.E/values/B non-breaking"])
    expect(records(p3(`${base} B = 1; }`), p3(`${base} }`))).toEqual(["remove components/enums/p.E/values/B breaking"])
  })

  it("J14.8 `json_name` set to its default gives no diff (rule J)", () => {
    expect(
      records(p3("message M { string user_id = 1; }"), p3('message M { string user_id = 1 [json_name = "userId"]; }')),
    ).toEqual([])
  })

  it("J14.9 proto3 `optional` on a scalar is explicit presence (F-23); on a message field no change", () => {
    expect(records(p3("message M { string s = 1; }"), p3("message M { optional string s = 1; }"))).toEqual([
      `add ${M}/s/presence risky`,
    ])
    expect(
      records(p3("message M { N n = 1; }\nmessage N {}"), p3("message M { optional N n = 1; }\nmessage N {}")),
    ).toEqual([])
  })

  it("J14.10 a hand-written repeated entry message versus a map is a cardinality change (F-19)", () => {
    const before = p3(`message M { map<string, int32> m = 1; }`)
    const after = p3(`message M { repeated E m = 1; message E { string key = 1; int32 value = 2; } }`)
    const result = records(before, after)
    expect(result.filter((item) => item.startsWith(`replace ${M}/m/type`))).toEqual([`replace ${M}/m/type breaking`])
  })

  it("J14.11 comments reflowed across lines: description replaced (A); whitespace inside a line: no diff (D15)", () => {
    expect(
      records(
        p3("message M {\n  // One two.\n  string s = 1;\n}"),
        p3("message M {\n  // One\n  // two.\n  string s = 1;\n}"),
      ),
    ).toEqual([`replace ${M}/s/description annotation`])
    expect(
      records(
        p3("message M {\n  // One two.\n  string s = 1;\n}"),
        p3("message M {\n  // One   two.\n  string s = 1;\n}"),
      ),
    ).toEqual([])
  })

  it("J14.12 `deprecated = true` without a `Deprecated:` line, and the reverse, both deprecate without a conflict", () => {
    const flag = protoDocs(p3("message M { string s = 1 [deprecated = true]; }"), p3("message M {}")).before as any
    const line = protoDocs(p3("message M {\n  // Deprecated: use t\n  string s = 1;\n}"), p3("message M {}"))
      .before as any
    expect(flag.components.messages["p.M"].properties.s.deprecation).toEqual({})
    expect(line.components.messages["p.M"].properties.s.deprecation).toEqual({ reason: "use t" })
    expect(line.components.messages["p.M"].properties.s["x-annotation-conflicts"]).toBeUndefined()
  })

  it("J14.13 a renamed field carrying `required: true` is one rename record (S1 / S2)", () => {
    expect(
      records(
        p3("message M {\n  // @Required\n  string a = 1;\n}"),
        p3("message M {\n  // @Required\n  string b = 1;\n}"),
      ),
    ).toEqual([`rename ${M} a->b breaking`])
  })

  it("J14.14 a field added or removed with `required: true` is one record, a required field (F-46 / F-47)", () => {
    const req = p3("message M {\n  // @Required\n  string a = 1;\n}")
    expect(descriptions(p3("message M {}"), req)).toEqual(["[Added] required field `a` (1) to message `p.M`"])
    expect(descriptions(req, p3("message M {}"))).toEqual([
      "[Removed] required field `a` (1) from message `p.M` without reserving the number",
    ])
  })

  it("J14.15 `field_behavior` OPTIONAL → REQUIRED is one K-14 record (PD-19, AN-04)", () => {
    const imp = `import "google/api/field_behavior.proto";`
    expect(
      records(
        p3("message M { string a = 1 [(google.api.field_behavior) = OPTIONAL]; }", imp),
        p3("message M { string a = 1 [(google.api.field_behavior) = REQUIRED]; }", imp),
      ),
    ).toEqual([`add ${M}/a/required breaking`])
  })

  it("J14.16 a oneof renamed with the same members is one M-7 record", () => {
    expect(
      records(p3("message M { oneof a { string x = 1; } }"), p3("message M { oneof b { string x = 1; } }")),
    ).toEqual(["rename components/messages/p.M/oneofs a->b risky"])
  })

  it("J14.17 a field moved into an existing oneof is one F-25 record (DG-23)", () => {
    expect(
      records(
        p3("message M { string s = 1; oneof o { string t = 2; } }"),
        p3("message M { oneof o { string s = 1; string t = 2; } }"),
      ),
    ).toEqual([`add ${M}/s/oneof breaking`])
  })

  it("J14.18 an enum value renamed that is a field default: V-8 at the value, F-33 (annotation) at the field", () => {
    expect(
      records(
        p2("enum C { RED = 1; GREEN = 2; }\nmessage M { optional C c = 1 [default = RED]; }"),
        p2("enum C { CRIMSON = 1; GREEN = 2; }\nmessage M { optional C c = 1 [default = CRIMSON]; }"),
      ),
    ).toEqual([`replace ${M}/c/default annotation`, "rename components/enums/p.C/values RED->CRIMSON breaking"])
  })

  it("J14.19 a closed enum's values reordered, field without explicit default: F-32 through the implicit default", () => {
    expect(
      records(
        p2("enum C { RED = 1; GREEN = 2; }\nmessage M { optional C c = 1; }"),
        p2("enum C { GREEN = 2; RED = 1; }\nmessage M { optional C c = 1; }"),
      ),
    ).toEqual([`remove ${M}/c/default breaking`])
  })

  it("J14.20 `reserved 5, 7 to 9` → `reserved 5 to 9` is one coverage-gained record (6), non-breaking", () => {
    const diffs = diffsOf(p3("message M { reserved 5, 7 to 9; }"), p3("message M { reserved 5 to 9; }"))
    expect(diffs.map((diff) => `${diff.action} ${diff.type} ${diff.description}`)).toEqual([
      "add non-breaking [Added] reserved number `6` to message `p.M`",
    ])
  })

  it("J14.21 a package renamed is one P-5 record; with the builder's `files: false` removals and additions (PD-21)", () => {
    const before = { "a.proto": 'syntax = "proto3";\npackage shop.v1;\nmessage Pet {}\n' }
    const after = { "a.proto": 'syntax = "proto3";\npackage shop.v2;\nmessage Pet {}\n' }
    expect(records(before, after)).toEqual(["replace files/a.proto/package breaking"])
    expect(records(before, after, {}, { files: false })).toEqual([
      "remove components/messages/shop.v1.Pet risky",
      "add components/messages/shop.v2.Pet non-breaking",
    ])
  })

  it("J14.22 proto2 → proto3: the syntax record at the file and one record per affected element (A4)", () => {
    const diffs = diffsOf(
      p2("message M { optional string s = 1; repeated int32 r = 2; }\nenum E { A = 1; }"),
      p3("message M { string s = 1; repeated int32 r = 2; }\nenum E { A0 = 0; A = 1; }"),
    )
    const byElement = new Map<string, number>()
    for (const diff of diffs) {
      byElement.set(diffElement(diff), (byElement.get(diffElement(diff)) ?? 0) + 1)
    }
    expect([...byElement.values()].every((count) => count === 1)).toBe(true)
    expect(diffs.find((diff) => diff.path.join("/") === "files/a.proto/syntax")?.type).toBe("risky")
  })

  it("J14.23 validation tightened on a message used as request and response takes the more severe class", () => {
    const body = (n: number) =>
      `message M {\n  // @MaxLength ${n}\n  string s = 1;\n}\nservice S { rpc Get(M) returns (M); }`
    expect(records(p3(body(10)), p3(body(20)))).toEqual([`replace ${M}/s/maxLength breaking`])
  })

  it("J14.24 a field's shape and validators changed together is one record; a behaviour keeps its own record", () => {
    const imp = `import "buf/validate/validate.proto";\nimport "google/api/field_behavior.proto";`
    expect(
      records(
        p3("message M { int32 q = 1 [(buf.validate.field).int32.gt = 0]; }", imp),
        p3(
          "message M { string q = 1 [(buf.validate.field).string.min_len = 1, (google.api.field_behavior) = IMMUTABLE]; }",
          imp,
        ),
      ),
    ).toEqual([`replace ${M}/q/type breaking`, `add ${M}/q/immutable breaking`])
  })

  it("J14.25 `int32` → `int64` with the same rule is one type record (S4, W-16)", () => {
    const imp = `import "buf/validate/validate.proto";`
    expect(
      records(
        p3("message M { int32 q = 1 [(buf.validate.field).int32.gt = 0]; }", imp),
        p3("message M { int64 q = 1 [(buf.validate.field).int64.gt = 0]; }", imp),
      ),
    ).toEqual([`replace ${M}/q/type breaking`])
  })

  it("J14.26 `gt: 0` → `gte: 0` is one minimum-value record (S3, W-25)", () => {
    const imp = `import "buf/validate/validate.proto";`
    expect(
      records(
        p3("message M { int32 q = 1 [(buf.validate.field).int32.gt = 0]; }", imp),
        p3("message M { int32 q = 1 [(buf.validate.field).int32.gte = 0]; }", imp),
      ),
    ).toEqual([`replace ${M}/q/minimum risky`])
  })

  it("J14.27 response type and streaming changed together is one R-6 record (S5)", () => {
    expect(
      records(
        p3("message A {}\nmessage B {}\nservice S { rpc Get(A) returns (A); }"),
        p3("message A {}\nmessage B {}\nservice S { rpc Get(A) returns (stream B); }"),
      ),
    ).toEqual(["replace services/p.S/methods/Get/response breaking"])
  })

  it("J14.28 HTTP verb and path changed together is one record; a changed additional binding one record each (S6, S7)", () => {
    const imp = `import "google/api/annotations.proto";`
    const rpc = (rule: string) =>
      p3(`message A {}\nservice S { rpc Get(A) returns (A) { option (google.api.http) = { ${rule} }; } }`, imp)
    expect(records(rpc('get: "/a"'), rpc('post: "/b" body: "*"'))).toEqual([
      "replace services/p.S/methods/Get/http breaking",
    ])
    expect(
      records(
        rpc('get: "/a" additional_bindings { get: "/b" } additional_bindings { get: "/c" }'),
        rpc('get: "/a" additional_bindings { post: "/b" body: "*" } additional_bindings { get: "/c" }'),
      ),
    ).toEqual(["replace services/p.S/methods/Get/http/additionalBindings/0 breaking"])
  })

  it("J14.29 additional bindings reordered give no record (pairing by method + path, S7)", () => {
    const imp = `import "google/api/annotations.proto";`
    const rpc = (rule: string) =>
      p3(`message A {}\nservice S { rpc Get(A) returns (A) { option (google.api.http) = { ${rule} }; } }`, imp)
    expect(
      records(
        rpc('get: "/a" additional_bindings { get: "/b" } additional_bindings { get: "/c" }'),
        rpc('get: "/a" additional_bindings { get: "/c" } additional_bindings { get: "/b" }'),
      ),
    ).toEqual([])
  })

  it("J14.30 a oneof added with existing fields moved into it: one record per member, no oneof record (S8)", () => {
    expect(
      records(
        p3("message M { string a = 1; string b = 2; }"),
        p3("message M { oneof o { string a = 1; string b = 2; } }"),
      ),
    ).toEqual([`add ${M}/a/oneof breaking`, `add ${M}/b/oneof breaking`])
  })

  it("J14.31 a proto2 group renamed is one field rename (A6)", () => {
    expect(
      records(
        p2("message M { optional group Header = 1 { optional int32 a = 1; } }"),
        p2("message M { optional group Hdr = 1 { optional int32 a = 1; } }"),
      ),
    ).toEqual([`rename ${M} header->hdr breaking`])
  })

  it("J14.32 an extension renamed with the same extendee and number is one X-6 record (A3)", () => {
    expect(
      records(
        p2("message M { extensions 100 to 199; }\nextend M { optional int32 a = 100; }"),
        p2("message M { extensions 100 to 199; }\nextend M { optional int32 b = 100; }"),
      ),
    ).toEqual(["rename components/extensions p.a->p.b breaking"])
  })

  it("J14.33 an option change that also changes an annotation conflict entry is one record (A7)", () => {
    const imp = `import "protoc-gen-openapiv2/options/annotations.proto";`
    const field = (title: string) =>
      p3(
        `message M {\n  // @Title Dropped\n  int32 n = 1 [(grpc.gateway.protoc_gen_openapiv2.options.openapiv2_field) = { title: "${title}" }];\n}`,
        imp,
      )
    expect(records(field("Kept"), field("Kept2"))).toEqual([`replace ${M}/n/title annotation`])
  })

  it("J14.34 `java_string_check_utf8` or `features.(pb.java).utf8_validation` at the file is one record at the file (R-G)", () => {
    expect(
      records(
        p3("message M { string s = 1; }"),
        p3("option java_string_check_utf8 = true;\nmessage M { string s = 1; }"),
      ),
    ).toEqual(["add files/a.proto/options/java_string_check_utf8 risky"])
    const java = `import "google/protobuf/java_features.proto";`
    expect(
      records(
        e23("message M { string s = 1; }", java),
        e23("option features.(pb.java).utf8_validation = VERIFY;\nmessage M { string s = 1; }", java),
      ),
    ).toEqual(["add files/a.proto/options/features/pb.java/utf8_validation risky"])
  })

  it("J14.35 `ctype = CORD` → `features.(pb.cpp).string_type = CORD` is two records, one per option (R-G)", () => {
    const cpp = `import "google/protobuf/cpp_features.proto";`
    expect(
      records(
        e23("message M { string s = 1 [ctype = CORD]; }", cpp),
        e23("message M { string s = 1 [features.(pb.cpp).string_type = CORD]; }", cpp),
      ),
    ).toEqual([`remove ${M}/s/options/ctype risky`, `add ${M}/s/options/features/pb.cpp/string_type risky`])
  })

  it("J14.36 emission closure (U3): a bundled type that starts being referenced is annotation; the field carries the class", () => {
    const imp = `import "google/protobuf/timestamp.proto";`
    expect(
      records(p3("message M { string at = 1; }", imp), p3("message M { google.protobuf.Timestamp at = 1; }", imp)),
    ).toEqual([
      "add files/google/protobuf/timestamp.proto annotation",
      `replace ${M}/at/$ref breaking`,
      "add components/messages/google.protobuf.Timestamp annotation",
    ])
  })

  it("J14.37 an unresolved import in both documents: references compared nominally (C8)", () => {
    const build = { issues: ["missing-import", "unresolved-type"] } as ProtoBuildOptions
    const before = p3('import "missing.proto";\nmessage M { x.Y y = 1; }')
    const after = p3('import "missing.proto";\nmessage M { x.Z y = 1; }')
    expect(records(before, before, {}, build)).toEqual([])
    expect(records(before, after, {}, build)).toHaveLength(1)
  })

  it("J14.38 the same API from text and from a descriptor set gives identical documents (PB-2), 0 diffs", () => {
    const text = buildFromProto(
      { "a.proto": 'syntax = "proto3";\npackage p;\nmessage M { string s = 1; int64 n = 2; }\n' },
      { imports: "user" },
    )
    const set = buildFromDescriptorSet(
      {
        file: [
          {
            name: "a.proto",
            package: "p",
            syntax: "proto3",
            messageType: [
              {
                name: "M",
                field: [
                  { name: "s", number: 1, label: "LABEL_OPTIONAL", type: "TYPE_STRING", jsonName: "s" },
                  { name: "n", number: 2, label: "LABEL_OPTIONAL", type: "TYPE_INT64", jsonName: "n" },
                ],
              },
            ],
          },
        ],
      } as never,
      { imports: "user" } as never,
    )
    expect(protoCompare(text.document, set.document).diffs).toEqual([])
    // J14.39: a descriptor set without SourceCodeInfo has an empty source map: locateDiff gives no location
    const diffs = protoCompare(set.document, { ...set.document, protoapi: "0.1.0" }).diffs
    expect(diffs.map((diff) => locateDiff(diff, set.sourceMap, set.sourceMap))).toEqual([undefined])
  })

  it("J14.40 documents of one build mode compare cleanly; the helpers build both sides with the same options (invariant 16)", () => {
    const text = p3('import "google/protobuf/timestamp.proto";\nmessage M { google.protobuf.Timestamp at = 1; }')
    expect(records(text, text)).toEqual([])
  })

  // ISSUE-400 (fixed): found by the buf oracle (Q5, module breaking_field_same_default): a default the type change only
  // respells (string `"abc"` ↔ bytes `"abc"`, bool `true` → int32 `1`, enum `ABC` → its number) is the same wire value, so the type record is
  // the only record of the field (R-1); a default that really changes keeps its own record
  it("J14.41 a default respelled by a field type change gives no record of its own (R-1) [ISSUE-400 (fixed)]", () => {
    const string = 'optional string s = 1 [default = "abc"];'
    expect(records(p2(`message M { ${string} }`), p2('message M { optional bytes s = 1 [default = "abc"]; }'))).toEqual(
      [`replace ${M}/s/type breaking`],
    )
    expect(
      records(
        p2('message M { optional bytes s = 1 [default = "a\\001"]; }'),
        p2('message M { optional string s = 1 [default = "a\\001"]; }'),
      ),
    ).toEqual([`replace ${M}/s/type breaking`])
    expect(
      records(
        p2("message M { optional bool b = 1 [default = true]; }"),
        p2("message M { optional int32 b = 1 [default = 1]; }"),
      ),
    ).toEqual([`replace ${M}/b/type breaking`])
    const e = "enum E { E_ZERO = 0; ABC = 1; }"
    expect(
      records(
        p2(`${e} message M { optional E e = 1 [default = ABC]; }`),
        p2(`${e} message M { optional int32 e = 1 [default = 1]; }`),
      ),
    ).toEqual([`replace ${M}/e/type breaking`])
    expect(records(p2(`message M { ${string} }`), p2('message M { optional bytes s = 1 [default = "xyz"]; }'))).toEqual(
      [`replace ${M}/s/default breaking`, `replace ${M}/s/type breaking`],
    )
  })

  // ISSUE-401 (fixed): found by the buf oracle (Q5): the default of a field whose type changed was rendered without the type of
  // its side, so a bytes default read as its base64 document spelling (`"eHl6"`) instead of a `.proto` literal (R-D)
  it("J14.42 a default changed together with the type reads as the literal of each side's type [ISSUE-401 (fixed)]", () => {
    expect(
      descriptions(
        p2('message M { optional string s = 1 [default = "abc"]; }'),
        p2('message M { optional bytes s = 1 [default = "xyz"]; }'),
      ),
    ).toContain('[Replaced] default value of field `s` (1) in message `p.M` from `"abc"` to `"xyz"`')
  })

  // ISSUE-402 (fixed): found by the buf oracle (Q5, module breaking_field_same_cardinality): a string field made repeated in a
  // file whose syntax changes at the same time (proto2 → edition 2023) lost the UTF-8 validation the syntax turns on,
  // because the shape transform aligned the keyword of the moved string position; the validation is compared across
  // the move (field → items, field → map value), so the element keeps the syntax-caused record next to the shape record
  it("J14.43 UTF-8 validation is compared across a cardinality change of a string field [ISSUE-402 (fixed)]", () => {
    expect(records(p2("message M { optional string s = 1; }"), e23("message M { repeated string s = 1; }"))).toContain(
      `remove ${M}/s/items/utf8Validation risky`,
    )
    expect(
      records(p2("message M { optional string s = 1; }"), e23("message M { map<int32, string> s = 1; }")),
    ).toContain(`remove ${M}/s/additionalProperties/utf8Validation risky`)
    expect(records(p2("message M { optional string s = 1; }"), p2("message M { repeated string s = 1; }"))).toEqual([
      `replace ${M}/s/type breaking`,
    ])
  })

  // ISSUE-403 (fixed): found by the compat family (Q5, PB-MSG-012): `max` in a range of a MessageSet message is 2147483646, in
  // any other message 536870911, so dropping `message_set_wire_format` also gave a lost extension range record for the
  // unchanged `extensions 4 to max;` statement: two records at the message for one change (R-1)
  it("J14.44 `message_set_wire_format` toggled: `to max` ranges keep their meaning, one record [ISSUE-403 (fixed)]", () => {
    const body = (option: string) => `message M {\n${option}  extensions 4 to max;\n  reserved 100 to max;\n}`
    expect(records(p2(body("  option message_set_wire_format = true;\n")), p2(body("")))).toEqual([
      "remove components/messages/p.M/options/message_set_wire_format breaking",
    ])
    expect(records(p2(body("")), p2(body("  option message_set_wire_format = true;\n")))).toEqual([
      "add components/messages/p.M/options/message_set_wire_format breaking",
    ])
  })
})
