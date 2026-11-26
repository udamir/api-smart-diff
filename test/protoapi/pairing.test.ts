import { annotation, breaking, nonBreaking, risky, type CompareContext, type Diff } from "../../src"
import { fieldNumberMappingResolver } from "../../src/protoapi/protoapi.mapping"
import { recordsByElement } from "../../src/protoapi/protoapi.merge"
import { protoDiffs, protoDocs, type ProtoInput, protoCompare } from "../helpers"

// J3 (Q2): pairing of fields by number, enum values per number, oneofs by member set, HTTP bindings by method + path
// then position (S7), interval sets by coverage (Q12), extension range options and declarations, extensions by
// extendee + number (A3), files by declared element set (A5), packages by relative name (A2), group messages through
// their field (A6).

const header = `syntax = "proto3"; package p;`
const proto2 = `syntax = "proto2"; package p;`

const records = (diffs: Diff[]) => diffs.map((d) => `${d.action} ${d.path.join("/")} ${d.type}`)

const compareInputs = (before: ProtoInput, after: ProtoInput, options = {}) => protoDiffs(before, after, options).diffs

describe("Block J3 — ProtoApi pairing", () => {
  it("J3.1 fields pair by number: two fields that swap numbers are two renames, no identity shortcut (R4)", () => {
    const diffs = compareInputs(
      `${header} message M { int32 a = 1; int32 b = 2; }`,
      `${header} message M { int32 a = 2; int32 b = 1; }`,
    )
    expect(diffs).toMatchObject([
      { action: "rename", path: ["components", "messages", "p.M", "properties"], before: "a", after: "b" },
      { action: "rename", path: ["components", "messages", "p.M", "properties"], before: "b", after: "a" },
    ])
    // with different types the renames are joined by the shape records of the after keys' fields
    const typed = compareInputs(
      `${header} message M { int32 a = 1; string b = 2; }`,
      `${header} message M { int32 a = 2; string b = 1; }`,
    )
    expect(records(typed).filter((r) => r.startsWith("replace"))).toEqual([
      // int32 ↔ string: different type groups at every level (F-14)
      "replace components/messages/p.M/properties/a/type breaking",
      "replace components/messages/p.M/properties/b/type breaking",
    ])
  })

  it("J3.2 a field renamed with its number kept is one rename record, classified by its JSON names (F-8, F-9)", () => {
    expect(
      records(compareInputs(`${header} message M { int32 a = 1; }`, `${header} message M { int32 b = 1; }`)),
    ).toEqual([`rename components/messages/p.M/properties ${breaking}`])
    // the JSON name kept through `json_name`: the `jsonName` diff is folded into the rename (S9, PD-20)
    const kept = compareInputs(
      `${header} message M { int32 user_id = 1; }`,
      `${header} message M { int32 account_id = 1 [json_name = "userId"]; }`,
    )
    expect(records(kept)).toEqual([`rename components/messages/p.M/properties ${risky}`])
    // at WIRE_JSON a kept JSON name is non-breaking, at WIRE every rename (U2)
    const { before, after } = protoDocs(
      `${header} message M { int32 user_id = 1; }`,
      `${header} message M { int32 account_id = 1 [json_name = "userId"]; }`,
    )
    expect(protoCompare(before, after, { compatibility: "WIRE_JSON" }).diffs.map((d) => d.type)).toEqual([nonBreaking])
  })

  it("J3.3 a field renumbered and renamed at once pairs with nothing: remove + add", () => {
    expect(
      records(compareInputs(`${header} message M { int32 a = 1; }`, `${header} message M { int32 b = 2; }`)),
    ).toEqual([
      `remove components/messages/p.M/properties/a ${breaking}`,
      `add components/messages/p.M/properties/b ${nonBreaking}`,
    ])
  })

  it("J3.4 duplicate numbers: the first declaration wins (IN-11); entries without a number pair by key", () => {
    const before = { a: { number: 1 }, b: { number: 1 }, extra: { title: "x" } }
    const after = { c: { number: 1 }, extra: { title: "y" } }
    const result = fieldNumberMappingResolver(before, after, {} as CompareContext)
    expect(result).toEqual({ added: [], removed: ["b"], mapped: { a: "c", extra: "extra" } })
  })

  it("J3.5 `x-*` keys of a hand-made `properties` object are paired by name, never by number (excludeExtensions)", () => {
    const doc = (properties: Record<string, unknown>) => ({
      protoapi: "0.1",
      components: { messages: { "p.M": { type: "object", properties } } },
    })
    const { diffs } = protoCompare(
      doc({ a: { number: 1, type: "int32" }, "x-note": { number: 2 } }),
      doc({ b: { number: 2, type: "int32" }, "x-note": { number: 1 } }),
    )
    expect(records(diffs)).toEqual([
      `remove components/messages/p.M/properties/a ${breaking}`,
      `replace components/messages/p.M/properties/x-note/number ${annotation}`,
      `add components/messages/p.M/properties/b ${nonBreaking}`,
    ])
  })

  it("J3.6 enum values pair per number: an alias added is an addition, an alias removed a removal (V-2, V-3)", () => {
    const e = (values: string) => `${header} enum E { option allow_alias = true; A = 0; ${values} }`
    // an alias of a number the before enum has is non-breaking in both scopes (V-2)
    expect(records(compareInputs(e("B = 1;"), e("B = 1; C = 1;")))).toEqual([
      `add components/enums/p.E/values/C ${nonBreaking}`,
    ])
    expect(records(compareInputs(e("B = 1; C = 1;"), e("B = 1;")))).toEqual([
      `remove components/enums/p.E/values/C ${breaking}`,
    ])
  })

  it("J3.7 enum values renamed with their number kept are renames, positionally within one number (V-8)", () => {
    const e = (values: string) => `${header} enum E { option allow_alias = true; A = 0; ${values} }`
    expect(compareInputs(e("B = 1; C = 1;"), e("X = 1; Y = 1;"))).toMatchObject([
      { action: "rename", path: ["components", "enums", "p.E", "values"], before: "B", after: "X", type: breaking },
      { action: "rename", path: ["components", "enums", "p.E", "values"], before: "C", after: "Y", type: breaking },
    ])
    // the name kept: no record however the values are reordered
    expect(compareInputs(e("B = 1; C = 2;"), e("C = 2; B = 1;"))).toEqual([])
  })

  it("J3.8 a oneof renamed with the same members is one rename record, no member records (G3, M-7)", () => {
    const m = (name: string) => `${header} message M { oneof ${name} { string a = 1; string b = 2; } int32 c = 3; }`
    expect(records(compareInputs(m("contact"), m("reach")))).toEqual([`rename components/messages/p.M/oneofs ${risky}`])
    const { before, after } = protoDocs(m("contact"), m("reach"))
    expect(protoCompare(before, after, { compatibility: "WIRE" }).diffs.map((d) => d.type)).toEqual([annotation])
  })

  it("J3.9 oneofs with different member sets do not pair: the members' moves carry the change (S8)", () => {
    const diffs = compareInputs(
      `${header} message M { oneof a { string x = 1; string y = 2; } }`,
      `${header} message M { oneof b { string x = 1; } string y = 2; }`,
    )
    expect(records(diffs).map((r) => r.replace(/ \S+$/, ""))).toEqual([
      "replace components/messages/p.M/properties/x/oneof",
      "remove components/messages/p.M/properties/y/oneof",
    ])
    // an entry that carries its own description is a record of its own (M-5)
    const described = compareInputs(
      `${header} message M { string x = 1; }`,
      `${header} message M {
        // Choice.
        oneof b { string x = 1; }
      }`,
    )
    expect(records(described).map((r) => r.replace(/ \S+$/, ""))).toEqual([
      "add components/messages/p.M/properties/x/oneof",
      "add components/messages/p.M/oneofs/b",
    ])
  })

  const http = (rule: string) =>
    `${header} import "google/api/annotations.proto"; message A {} service S { rpc M(A) returns (A) { option (google.api.http) = { ${rule} }; } }`

  it("J3.10 additional HTTP bindings pair by method + path: reordering them gives no record (S7)", () => {
    expect(
      compareInputs(
        http(`get: "/a" additional_bindings { get: "/b" } additional_bindings { post: "/c" body: "*" }`),
        http(`get: "/a" additional_bindings { post: "/c" body: "*" } additional_bindings { get: "/b" }`),
      ),
    ).toEqual([])
    // a binding inserted in front is one addition
    expect(
      records(
        compareInputs(
          http(`get: "/a" additional_bindings { get: "/b" }`),
          http(`get: "/a" additional_bindings { get: "/x" } additional_bindings { get: "/b" }`),
        ),
      ),
    ).toEqual([`add services/p.S/methods/M/http/additionalBindings/0 ${nonBreaking}`])
  })

  it("J3.11 additional HTTP bindings without a match pair by position: one record per changed binding (S6, S7)", () => {
    const diffs = compareInputs(
      http(`get: "/a" additional_bindings { get: "/b" } additional_bindings { get: "/c" }`),
      http(`get: "/a" additional_bindings { get: "/b2" } additional_bindings { put: "/c2" body: "*" }`),
    )
    expect(diffs).toMatchObject([
      { action: "replace", path: ["services", "p.S", "methods", "M", "http", "additionalBindings", 0], type: breaking },
      { action: "replace", path: ["services", "p.S", "methods", "M", "http", "additionalBindings", 1], type: breaking },
    ])
    expect(diffs[1]).toMatchObject({
      before: { method: "GET", path: "/c" },
      after: { method: "PUT", path: "/c2", body: "*" },
    })
  })

  it("J3.12 the primary HTTP binding is one value: verb, path and body changed together are one record (S6)", () => {
    const diffs = compareInputs(
      http(`get: "/a" additional_bindings { get: "/b" }`),
      http(`post: "/a2" body: "*" additional_bindings { get: "/b" }`),
    )
    expect(diffs).toMatchObject([
      {
        action: "replace",
        path: ["services", "p.S", "methods", "M", "http"],
        before: { method: "GET", path: "/a" },
        after: { method: "POST", path: "/a2", body: "*" },
        type: breaking,
      },
    ])
    // the rule added or removed as a whole (R-9, R-10); WIRE: annotation (PD-2)
    const plain = `${header} import "google/api/annotations.proto"; message A {} service S { rpc M(A) returns (A); }`
    expect(records(compareInputs(http(`get: "/a"`), plain))).toEqual([`remove services/p.S/methods/M/http ${breaking}`])
    expect(records(compareInputs(plain, http(`get: "/a"`)))).toEqual([`add services/p.S/methods/M/http ${nonBreaking}`])
    const { before, after } = protoDocs(http(`get: "/a"`), http(`get: "/b"`))
    expect(protoCompare(before, after, { compatibility: "WIRE" }).diffs.map((d) => d.type)).toEqual([annotation])
  })

  it("J3.13 reserved numbers are compared by coverage: a split is one record at the before index (Q12)", () => {
    const diffs = compareInputs(
      `${header} message M { reserved 5 to 9; }`,
      `${header} message M { reserved 5 to 6, 8 to 9; }`,
    )
    expect(diffs).toMatchObject([
      {
        action: "remove",
        path: ["components", "messages", "p.M", "reserved", "numbers", 0],
        before: [[7, 7]],
        type: risky,
      },
    ])
  })

  it("J3.14 a merge of reserved ranges is one record at the after index; a pure rewrite none (Q12)", () => {
    expect(
      compareInputs(`${header} message M { reserved 5, 7 to 9; }`, `${header} message M { reserved 5 to 9; }`),
    ).toMatchObject([
      {
        action: "add",
        path: ["components", "messages", "p.M", "reserved", "numbers", 0],
        after: [[6, 6]],
        type: nonBreaking,
      },
    ])
    expect(compareInputs(`${header} message M { reserved 5, 6; }`, `${header} message M { reserved 5 to 6; }`)).toEqual(
      [],
    )
    const merged = protoDiffs(
      `${header} message M { reserved 5, 7 to 9; }`,
      `${header} message M { reserved 5 to 9; }`,
      {
        metaKey: "$diff",
      },
    ).merged
    expect(merged.components.messages["p.M"].reserved).toMatchObject({
      numbers: [[5, 9]],
      $diff: { numbers: { array: { 0: { action: "add", type: nonBreaking } } } },
    })
  })

  it("J3.15 reserved coverage lost is breaking when an after field reuses it, else risky (PD-4)", () => {
    expect(
      records(compareInputs(`${header} message M { reserved 5, 7; }`, `${header} message M { int32 a = 5; }`)),
    ).toEqual([
      `add components/messages/p.M/properties/a ${nonBreaking}`,
      `remove components/messages/p.M/reserved/numbers/0 ${breaking}`,
      `remove components/messages/p.M/reserved/numbers/1 ${risky}`,
    ])
    // enum reserved numbers likewise (E-7)
    expect(
      records(compareInputs(`${header} enum E { E0 = 0; reserved 5, 7; }`, `${header} enum E { E0 = 0; X = 5; }`)),
    ).toEqual([
      `add components/enums/p.E/values/X ${risky}`,
      `remove components/enums/p.E/reserved/numbers/0 ${breaking}`,
      `remove components/enums/p.E/reserved/numbers/1 ${risky}`,
    ])
  })

  it("J3.16 reserved names are a set; a removed name reused is breaking, annotation in WIRE (PD-4, PD-29)", () => {
    expect(
      compareInputs(`${header} message M { reserved "a", "b"; }`, `${header} message M { reserved "b", "a"; }`),
    ).toEqual([])
    expect(
      records(
        compareInputs(
          `${header} message M { reserved "a", "b"; }`,
          `${header} message M { reserved "b"; string a = 1; }`,
        ),
      ),
    ).toEqual([
      `add components/messages/p.M/properties/a ${nonBreaking}`,
      `remove components/messages/p.M/reserved/names/0 ${breaking}`,
    ])
    const { before, after } = protoDocs(`${header} message M { reserved "a"; }`, `${header} message M {}`)
    expect(protoCompare(before, after).diffs.map((d) => d.type)).toEqual([risky])
    expect(protoCompare(before, after, { compatibility: "WIRE" }).diffs.map((d) => d.type)).toEqual([annotation])
  })

  it("J3.17 extension ranges are compared by coverage (M-15, M-16)", () => {
    const m = (ranges: string) => `${proto2} message M { ${ranges} }`
    expect(
      records(compareInputs(m("extensions 100 to 199;"), m("extensions 100 to 199; extensions 300 to 399;"))),
    ).toEqual([`add components/messages/p.M/extensions/1 ${nonBreaking}`])
    expect(records(compareInputs(m("extensions 100 to 199;"), m("extensions 100 to 149;")))).toEqual([
      `remove components/messages/p.M/extensions/0 ${risky}`,
    ])
    expect(compareInputs(m("extensions 100 to 149, 150 to 199;"), m("extensions 100 to 199;"))).toEqual([])
  })

  it("J3.18 extension range options pair by range; a range extended keeps its options (POLICY-136)", () => {
    const m = (ranges: string) => `${proto2} message M { extensions 1 to 9; ${ranges} }`
    // the options of a range changed: one record (M-17)
    expect(
      records(compareInputs(m("extensions 500 to 599;"), m("extensions 500 to 599 [verification = UNVERIFIED];"))),
    ).toEqual([`add components/messages/p.M/extensionOptions/0 ${risky}`])
    // the range extended: only the coverage record
    expect(
      records(
        compareInputs(
          m("extensions 500 to 599 [verification = UNVERIFIED];"),
          m("extensions 500 to 649 [verification = UNVERIFIED];"),
        ),
      ),
    ).toEqual([`add components/messages/p.M/extensions/1 ${nonBreaking}`])
    // a range added with its options: only the coverage record
    expect(records(compareInputs(m(""), m("extensions 500 to 599 [verification = UNVERIFIED];")))).toEqual([
      `add components/messages/p.M/extensions/1 ${nonBreaking}`,
    ])
  })

  it("J3.19 extension declarations pair by number within their range; a range extended keeps them (POLICY-136)", () => {
    const decl = (number: number, name: string) =>
      `declaration = { number: ${number}, full_name: ".p.${name}", type: "int32" }`
    const m = (range: string, declarations: string[]) =>
      `edition = "2023"; package p; message M { extensions ${range} [${declarations.join(", ")}]; }`
    // reordered declarations: no record
    expect(
      compareInputs(
        m("100 to 199", [decl(100, "a"), decl(101, "b")]),
        m("100 to 199", [decl(101, "b"), decl(100, "a")]),
      ),
    ).toEqual([])
    // one declaration added: one record (M-18)
    expect(
      records(compareInputs(m("100 to 199", [decl(100, "a")]), m("100 to 199", [decl(100, "a"), decl(101, "b")]))),
    ).toEqual([`add components/messages/p.M/options/extension_declarations/100-199/1 ${nonBreaking}`])
    // the range extended: the coverage record and the changed declaration at the after range
    expect(records(compareInputs(m("100 to 199", [decl(100, "a")]), m("100 to 299", [decl(100, "b")])))).toEqual([
      `add components/messages/p.M/extensions/0 ${nonBreaking}`,
      `replace components/messages/p.M/options/extension_declarations/100-299/0/full_name ${risky}`,
    ])
  })

  it("J3.20 extensions pair by key, then by extendee + number: a renamed extension is one record (A3, X-6)", () => {
    const doc = (name: string, number = 100) =>
      `${proto2} message M { extensions 100 to 199; } extend M { optional int32 ${name} = ${number}; }`
    expect(compareInputs(doc("label"), doc("display_label"))).toMatchObject([
      {
        action: "rename",
        path: ["components", "extensions"],
        before: "p.label",
        after: "p.display_label",
        type: breaking,
      },
    ])
    const { before, after } = protoDocs(doc("label"), doc("display_label"))
    expect(protoCompare(before, after, { compatibility: "WIRE" }).diffs.map((d) => d.type)).toEqual([nonBreaking])
    // the number replaced under the same key (X-3)
    expect(records(compareInputs(doc("label"), doc("label", 150)))).toEqual([
      `replace components/extensions/p.label/number ${breaking}`,
    ])
    // another number and another name: remove + add
    expect(records(compareInputs(doc("label"), doc("other", 150))).map((r) => r.split(" ")[0])).toEqual([
      "remove",
      "add",
    ])
  })

  it("J3.21 a file renamed with its declared element set unchanged is one rename record (A5, P-20)", () => {
    const diffs = compareInputs(
      { "a.proto": `${header} import public "m.proto"; message A { M m = 1; }`, "m.proto": `${header} message M {}` },
      {
        "a.proto": `${header} import public "money.proto"; message A { M m = 1; }`,
        "money.proto": `${header} message M {}`,
      },
    )
    expect(records(diffs)).toEqual([`rename files ${risky}`])
    expect(diffs[0]).toMatchObject({ before: "m.proto", after: "money.proto" })
    const { before, after } = protoDocs(
      { "m.proto": `${header} message M {}` },
      { "n.proto": `${header} message M {}` },
    )
    expect(protoCompare(before, after, { compatibility: "PACKAGE" }).diffs.map((d) => d.type)).toEqual([annotation])
    expect(protoCompare(before, after, { files: "ignore" }).diffs.map((d) => d.type)).toEqual([annotation])
  })

  it("J3.22 an empty file renamed does not pair: removal and addition (A5)", () => {
    const diffs = compareInputs(
      { "a.proto": `${header} import "e.proto"; message A {}`, "e.proto": header },
      { "a.proto": `${header} import "f.proto"; message A {}`, "f.proto": header },
    )
    expect(records(diffs).filter((r) => !r.includes("/imports/"))).toEqual([
      `remove files/e.proto ${risky}`,
      `add files/f.proto ${nonBreaking}`,
    ])
  })

  it("J3.23 a renamed file whose declared element set changed does not pair: its declarations move (A5, P-18)", () => {
    const diffs = compareInputs(
      { "a.proto": `${header} message A {}`, "m.proto": `${header} message M {}` },
      { "a.proto": `${header} message A {}`, "n.proto": `${header} message M {} message N {}` },
    )
    expect(records(diffs)).toEqual([
      `remove files/m.proto ${risky}`,
      `add files/n.proto ${nonBreaking}`,
      `replace components/messages/p.M/file ${risky}`,
      `add components/messages/p.N ${nonBreaking}`,
    ])
  })

  it("J3.24 a package change is one record; declarations pair by their name relative to the package (A2, P-5)", () => {
    const pet = (pkg: string, extra = "") =>
      `syntax = "proto3"; package ${pkg}; message Pet { string id = 1; Kind kind = 2; ${extra} } enum Kind { K0 = 0; }
      service S { rpc G(Pet) returns (Pet); }`
    const box = (pkg: string) =>
      `syntax = "proto3"; package other; import "a.proto"; message Box { ${pkg}.Pet pet = 1; }`
    const diffs = compareInputs(
      { "a.proto": pet("shop.v1"), "b.proto": box("shop.v1") },
      { "a.proto": pet("shop.v2", "int32 age = 3;"), "b.proto": box("shop.v2") },
    )
    // the change inside a re-keyed declaration is reported at its after key; references to it give no records
    expect(records(diffs)).toEqual([
      `replace files/a.proto/package ${breaking}`,
      `add components/messages/shop.v2.Pet/properties/age ${nonBreaking}`,
    ])
    // the package record is kept with `files: "ignore"` (PD-21)
    const { before, after } = protoDocs({ "a.proto": pet("shop.v1") }, { "a.proto": pet("shop.v2") })
    expect(records(protoCompare(before, after, { files: "ignore" }).diffs)).toEqual([
      `replace files/a.proto/package ${breaking}`,
    ])
  })

  it("J3.25 without `files` data a package change cannot pair: removals and additions (PD-21)", () => {
    const diffs = protoDiffs(
      `syntax = "proto3"; package a.v1; message Pet {}`,
      `syntax = "proto3"; package a.v2; message Pet {}`,
      {},
      {
        files: false,
      },
    ).diffs
    expect(records(diffs)).toEqual([
      `remove components/messages/a.v1.Pet ${risky}`,
      `add components/messages/a.v2.Pet ${nonBreaking}`,
    ])
  })

  it("J3.26 a proto2 group renamed is one field rename: the group message pairs through its field (A6)", () => {
    const order = (group: string, extra = "") =>
      `${proto2} message Order { optional group ${group} = 9 { optional string address = 1; ${extra} } }`
    expect(records(compareInputs(order("Shipping"), order("Delivery")))).toEqual([
      `rename components/messages/p.Order/properties ${breaking}`,
    ])
    // a change inside the renamed group is reported at its after key
    const diffs = compareInputs(order("Shipping"), order("Delivery", "optional string city = 2;"))
    expect(Object.fromEntries(recordsByElement(diffs))).toEqual({
      "#/components/messages/p.Order/properties/shipping": 1,
      "#/components/messages/p.Order.Delivery/properties/city": 1,
    })
  })

  it("J3.27 an import added or removed with its modifier is one record, classified by the modifier (POLICY-137)", () => {
    const files = (imports: string) => ({
      "a.proto": `${header} ${imports} message A {}`,
      "x.proto": `${header} message X {}`,
    })
    expect(records(compareInputs(files(""), files(`import public "x.proto";`)))).toEqual([
      `add files/a.proto/imports/0 ${nonBreaking}`,
    ])
    expect(records(compareInputs(files(`import public "x.proto";`), files("")))).toEqual([
      `remove files/a.proto/imports/0 ${risky}`,
    ])
    expect(records(compareInputs(files(""), files(`import weak "x.proto";`)))).toEqual([
      `add files/a.proto/imports/0 ${annotation}`,
    ])
    expect(records(compareInputs(files(""), files(`import "x.proto";`)))).toEqual([
      `add files/a.proto/imports/0 ${annotation}`,
    ])
  })
})
