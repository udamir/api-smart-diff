import { allAnnotation, allBreaking, annotation, breaking, type CompareExtensionRules, risky } from "../../src"
import { protoDocs, protoCompare } from "../helpers"
import { caseTitle, checkCase, edition2023, header, levels, proto2 } from "./fixtures/matrix"
import { optionCases } from "./fixtures/matrix-cases"

// J11 (R-G part, phase Q3): the generic option family of §6.7: every key pattern of L-1 … L-4 gives one generic record,
// risky in FILE / PACKAGE and annotation in WIRE_JSON / WIRE, with no effective comparison; the googleapis keys of
// PD-13 / PD-26 at services, rpcs, messages, fields and files; `google.api.http`, `field_behavior` and `field_info`
// not caught by the prefix; `optionRules` over the built-in keys. The rest of J11 (known options, visibility, unknown
// options) is phase Q4.

const gapi = `import "google/api/client.proto";`
const service = (option: string) => `${header} ${gapi} message A {} service S { ${option} rpc Get(A) returns (A); }`

describe("Block J11 — ProtoApi options (R-G and googleapis family)", () => {
  for (const item of optionCases) {
    it(caseTitle(item), () => checkCase(item, ["FILE"]))
  }

  it("J11.27 R-G has no effective comparison: ctype written with its default value is a record (R-G)", () => {
    // the builder drops `ctype = STRING` (the default); a hand-made document writes it
    const { before, after } = protoDocs(
      `${proto2} message M { optional string s = 1; }`,
      `${proto2} message M { optional string s = 1; }`,
    )
    const edited = structuredClone(after) as any
    edited.components.messages["p.M"].properties.s.options = { ctype: "STRING" }
    for (const compatibility of levels) {
      const { diffs } = protoCompare(before, edited, { compatibility })
      expect(diffs.map((d) => `${d.path.join("/")} ${d.type}`)).toEqual([
        `components/messages/p.M/properties/s/options/ctype ${compatibility === "FILE" || compatibility === "PACKAGE" ? risky : annotation}`,
      ])
    }
  })

  it("J11.28 a language feature set at the file gives no records at the elements that inherit it (R-G)", () => {
    const features = `import "google/protobuf/cpp_features.proto";`
    const body = "message A { string s = 1; bytes b = 2; } enum E { E0 = 0; }"
    const { before, after } = protoDocs(
      `${edition2023} ${features} ${body}`,
      `${edition2023} ${features} option features.(pb.cpp).string_type = CORD; ${body}`,
    )
    const { diffs } = protoCompare(before, after)
    expect(diffs.map((d) => `${d.action} ${d.path.join("/")} ${d.type}`)).toEqual([
      `add files/a.proto/options/features/pb.cpp/string_type ${risky}`,
    ])
  })

  it("J11.29 an exact optionRules key overrides a googleapis option of the prefix family (§4.10, §11)", () => {
    const { before, after } = protoDocs(
      service(`option (google.api.default_host) = "a.example.com";`),
      service(`option (google.api.default_host) = "b.example.com";`),
    )
    const types = (optionRules?: CompareExtensionRules) =>
      protoCompare(before, after, optionRules ? { optionRules } : {}).diffs.map((d) => d.type)
    expect(types()).toEqual([risky])
    expect(types({ "/google.api.default_host": { $: allBreaking } })).toEqual([breaking])
    // a shorter user prefix never shadows the longer built-in prefix
    expect(types({ "/google.*": { $: allAnnotation } })).toEqual([risky])
    // the built-in trees are untouched
    expect(types()).toEqual([risky])
  })

  it("J11.30 a language option keeps its class in a response (not inverted, AD-05)", () => {
    const empty = `import "google/protobuf/empty.proto";`
    const fixture = (option: string) =>
      `${header} ${empty} message M { int64 n = 1 ${option}; } service S { rpc Get(google.protobuf.Empty) returns (M); }`
    const { before, after } = protoDocs(fixture(""), fixture("[jstype = JS_STRING]"))
    for (const compatibility of levels) {
      const { diffs } = protoCompare(before, after, { compatibility })
      expect(diffs.map((d) => d.type)).toEqual([
        compatibility === "FILE" || compatibility === "PACKAGE" ? risky : annotation,
      ])
    }
  })
})

// J11 (rest, phase Q4): known options without an API effect, unknown and custom options at every element (U, C7), a
// repeated option value as one value (ISSUE-375), `optionRules` precedence and `annotate` (§4.10, §7.1), and the
// option descriptions (R-D: extension options in parentheses, sub-paths, statements for added / removed options).

const descriptor = `import "google/protobuf/descriptor.proto";`
const custom = `${descriptor}
extend google.protobuf.FileOptions { string file_tag = 50000; }
extend google.protobuf.ServiceOptions { string tier = 50001; }
extend google.protobuf.MethodOptions { int64 quota = 50002; }
extend google.protobuf.MessageOptions { repeated string labels = 50003; }
extend google.protobuf.EnumOptions { bool legacy = 50004; }
extend google.protobuf.EnumValueOptions { string alias_of = 50005; }
extend google.protobuf.OneofOptions { bool exclusive = 50006; }
extend google.protobuf.FieldOptions { Meta meta = 50007; }
message Meta { string owner = 1; int32 level = 2; }`

const opts = (
  file = "",
  service = "",
  method = "",
  message = "",
  enumeration = "",
  value = "",
  oneof = "",
  field = "",
) =>
  `${header}
${custom}
${file}
message M { ${message} oneof o { ${oneof} string a = 1; } string f = 2 ${field}; }
enum E { ${enumeration} E0 = 0 ${value}; }
service S { ${service} rpc Get(M) returns (M) { ${method} } }`

const optionRecords = (before: string, after: string, options = {}) =>
  protoCompare(protoDocs(before, after).before, protoDocs(before, after).after, options).diffs.map(
    (d) => `${d.type} | ${d.description}`,
  )

describe("Block J11 — ProtoApi options (known, unknown, optionRules)", () => {
  it("J11.31 a custom option at every element is one unclassified record with its `.proto` name", () => {
    const records = optionRecords(
      opts(),
      opts(
        'option (p.file_tag) = "core";',
        'option (p.tier) = "gold";',
        "option (p.quota) = 9007199254740993;",
        'option (p.labels) = "a";',
        "option (p.legacy) = true;",
        ' [(p.alias_of) = "X"]',
        "option (p.exclusive) = true;",
        ' [(p.meta) = { owner: "team" level: 2 }]',
      ),
    )
    expect(records.sort()).toEqual(
      [
        'unclassified | [Added] option `(p.file_tag) = "core"` to file `a.proto`',
        'unclassified | [Added] option `(p.tier) = "gold"` to service `p.S`',
        "unclassified | [Added] option `(p.quota) = 9007199254740993` to rpc `Get` in service `p.S`",
        'unclassified | [Added] option `(p.labels) = ["a"]` to message `p.M`',
        "unclassified | [Added] option `(p.legacy) = true` to enum `p.E`",
        'unclassified | [Added] option `(p.alias_of) = "X"` to value `E0` (0) in enum `p.E`',
        "unclassified | [Added] option `(p.exclusive) = true` to oneof `o` in message `p.M`",
        'unclassified | [Added] option `(p.meta) = { owner: "team", level: 2 }` to field `f` (2) in message `p.M`',
      ].sort(),
    )
  })

  it("J11.32 a sub-path of an aggregate option is one record named `(option).path` (W-37)", () => {
    expect(
      optionRecords(
        opts("", "", "", "", "", "", "", ' [(p.meta) = { owner: "team" level: 2 }]'),
        opts("", "", "", "", "", "", "", ' [(p.meta) = { owner: "team" level: 3 }]'),
      ),
    ).toEqual(["unclassified | [Replaced] option `(p.meta).level` of field `f` (2) in message `p.M` from `2` to `3`"])
  })

  it("J11.33 a repeated custom option value is compared as one value (ISSUE-375 (fixed))", () => {
    expect(
      optionRecords(
        opts("", "", "", 'option (p.labels) = "a"; option (p.labels) = "b";'),
        opts("", "", "", 'option (p.labels) = "z"; option (p.labels) = "a"; option (p.labels) = "b";'),
      ),
    ).toEqual(['unclassified | [Replaced] option `(p.labels)` of message `p.M` from `["a", "b"]` to `["z", "a", "b"]`'])
  })

  it("J11.34 a 64-bit custom option value is written as digits (R-D)", () => {
    expect(
      optionRecords(opts("", "", "option (p.quota) = 1;"), opts("", "", "option (p.quota) = 9007199254740993;")),
    ).toEqual([
      "unclassified | [Replaced] option `(p.quota)` of rpc `Get` in service `p.S` from `1` to `9007199254740993`",
    ])
  })

  it("J11.35 a known option without an API effect is an annotation (F-42: `debug_redact`)", () => {
    expect(optionRecords(opts(), opts("", "", "", "", "", "", "", " [debug_redact = true]"))).toEqual([
      "annotation | [Added] option `debug_redact = true` to field `f` (2) in message `p.M`",
    ])
  })

  it("J11.36 optionRules: a prefix promotes every custom option under it; an exact key wins over the prefix", () => {
    const before = opts("", 'option (p.tier) = "gold";', "option (p.quota) = 1;")
    const after = opts("", 'option (p.tier) = "silver";', "option (p.quota) = 2;")
    const types = (optionRules: CompareExtensionRules) =>
      protoCompare(protoDocs(before, after).before, protoDocs(before, after).after, { optionRules })
        .diffs.map((d) => `${d.path[d.path.length - 1]} ${d.type}`)
        .sort()
    expect(types({ "/p.*": { $: allBreaking } })).toEqual(["p.quota breaking", "p.tier breaking"])
    expect(types({ "/p.*": { $: allBreaking }, "/p.quota": { $: allAnnotation } })).toEqual([
      "p.quota annotation",
      "p.tier breaking",
    ])
  })

  it("J11.37 optionRules may set `annotate`: its template replaces the description (§7.1)", () => {
    const before = opts("", 'option (p.tier) = "gold";')
    const after = opts("", 'option (p.tier) = "silver";')
    const docs = protoDocs(before, after)
    const { diffs } = protoCompare(docs.before, docs.after, {
      optionRules: {
        "/p.tier": {
          $: allBreaking,
          annotate: (diff) => ({
            template: "[Replaced] service tier from {{from}} to {{to}}",
            params: { from: String(diff.before), to: String(diff.after) },
          }),
        },
      },
    })
    expect(diffs.map((d) => d.description)).toEqual(["[Replaced] service tier from gold to silver"])
  })

  it("J11.38 an exact optionRules key overrides a built-in option key (google.api.method_signature)", () => {
    const gapiService = (signature: string) =>
      `${header} import "google/api/client.proto"; message A {} service S { rpc Get(A) returns (A) { option (google.api.method_signature) = "${signature}"; } }`
    const docs = protoDocs(gapiService("name"), gapiService("name,view"))
    expect(protoCompare(docs.before, docs.after).diffs.map((d) => d.type)).toEqual([risky])
    expect(
      protoCompare(docs.before, docs.after, {
        optionRules: { "/google.api.method_signature": { $: allBreaking } },
      }).diffs.map((d) => d.type),
    ).toEqual([breaking])
  })

  it("J11.39 an option of an extension range is named with its range (POLICY-136)", () => {
    const before = `${proto2} message M { optional int32 a = 1; extensions 100 to 199; }`
    const after = `${proto2} message M { optional int32 a = 1; extensions 100 to 199 [verification = UNVERIFIED]; }`
    expect(optionRecords(before, after)).toEqual([
      "risky | [Added] option `verification = UNVERIFIED` to extension range `100 to 199` of message `p.M`",
    ])
  })
})
