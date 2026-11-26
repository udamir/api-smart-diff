import { type Diff } from "../../src"
import {
  formatHttpBinding,
  formatOptionName,
  formatProtoValue,
  formatRange,
  formatRanges,
  formatSyntax,
  protoBytesLiteral,
  protoStringLiteral,
} from "../../src/protoapi/protoapi.annotate"
import { protoCompare, protoDocs, protoWordingIssues } from "../helpers"
import { weakDescription } from "../helpers/compat"
import { catalogueCases } from "./fixtures/catalogue"
import { singleEditDocuments } from "./fixtures/single-edit-documents"
import { singleEdits } from "./fixtures/single-edits"

// J16 (PROTOAPI_DESIGN §9.1, R-D): the wording lint `expectProtoWording` (`test/helpers/index.ts`) runs on every
// description of J1 … J15 through `protoDiffs`, `protoCompare` and the matrix runner; this block pins its rules with
// self-tests (a planted key name or a JSON spelling fails, free text and element names do not) and unit-tests
// `formatProtoValue` and the other `.proto` literal formatters on every row of the §7.2 value table.

const record = (
  description: string,
  path: string[] = ["components", "messages", "p.M", "properties", "s", "minimum"],
) => ({ action: "replace", path, before: 1, after: 2, type: "breaking", scope: "components", description }) as Diff

describe("Block J16 — ProtoApi wording (R-D)", () => {
  describe("formatProtoValue: the §7.2 value table", () => {
    it("J16.1 64-bit integers (decimal strings in the document) are unquoted digits", () => {
      expect(formatProtoValue("9007199254740993", "int64")).toBe("9007199254740993")
      expect(formatProtoValue("-10", "sint64")).toBe("-10")
      expect(formatProtoValue("18446744073709551615", "uint64")).toBe("18446744073709551615")
      // without a type, a digit string is a 64-bit value, never a quoted string
      expect(formatProtoValue("123")).toBe("123")
    })

    it("J16.2 float and double: decimal, inf, -inf, nan, -0", () => {
      expect(formatProtoValue(1.5, "double")).toBe("1.5")
      expect(formatProtoValue("Infinity", "float")).toBe("inf")
      expect(formatProtoValue("-Infinity", "double")).toBe("-inf")
      expect(formatProtoValue("NaN", "double")).toBe("nan")
      expect(formatProtoValue(-0, "double")).toBe("-0")
      expect(formatProtoValue("-0", "double")).toBe("-0")
    })

    it("J16.3 bool", () => {
      expect(formatProtoValue(true, "bool")).toBe("true")
      expect(formatProtoValue(false)).toBe("false")
    })

    it("J16.4 strings are double-quoted with C escapes", () => {
      expect(formatProtoValue("example.com/shop/v1", "string")).toBe('"example.com/shop/v1"')
      expect(protoStringLiteral('a"b\\c\nd\te\u0001')).toBe('"a\\"b\\\\c\\nd\\te\\x01"')
    })

    it("J16.5 bytes (base64 in the document) are C-escaped string literals, printable ASCII kept", () => {
      expect(formatProtoValue("AAE=", "bytes")).toBe('"\\x00\\x01"')
      expect(protoBytesLiteral("aGk=")).toBe('"hi"')
      expect(protoBytesLiteral("Ij8=")).toBe('"\\"?"')
    })

    it("J16.6 enum values are bare", () => {
      expect(formatProtoValue("NO_SIDE_EFFECTS", "enum")).toBe("NO_SIDE_EFFECTS")
      expect(formatProtoValue("JS_STRING")).toBe("JS_STRING")
    })

    it("J16.7 aggregates in text format, repeated values as lists", () => {
      expect(formatProtoValue({ shard: 4 }, "message")).toBe("{ shard: 4 }")
      expect(formatProtoValue({ seconds: "60" })).toBe("{ seconds: 60 }")
      expect(formatProtoValue([{ id: "a", expression: "this > 0" }])).toBe('[{ id: "a", expression: "this > 0" }]')
      expect(formatProtoValue(["REQUIRED", "IMMUTABLE"])).toBe("[REQUIRED, IMMUTABLE]")
      expect(formatProtoValue(["name"])).toBe('["name"]')
      expect(formatProtoValue({})).toBe("{}")
    })

    it("J16.8 option keys: built-in bare, extensions in parentheses with sub-paths, features", () => {
      expect(formatOptionName("go_package")).toBe("go_package")
      expect(formatOptionName("acme.audit")).toBe("(acme.audit)")
      expect(formatOptionName("acme.table", ["shard"])).toBe("(acme.table).shard")
      expect(formatOptionName("features", ["field_presence"])).toBe("features.field_presence")
      expect(formatOptionName("features", ["pb.cpp", "string_type"])).toBe("features.(pb.cpp).string_type")
      expect(formatOptionName("features.pb.go.legacy_unmarshal_json_enum")).toBe(
        "features.(pb.go).legacy_unmarshal_json_enum",
      )
      expect(formatOptionName("google.api.default_host")).toBe("(google.api.default_host)")
    })

    it("J16.9 ranges: a number, `lo to hi`, `max`, lists", () => {
      expect(formatRange([8, 8])).toBe("8")
      expect(formatRange([150, 199])).toBe("150 to 199")
      expect(formatRange([1000, 536870911], 536870911)).toBe("1000 to max")
      expect(
        formatRanges([
          [5, 5],
          [7, 9],
        ]),
      ).toBe("5, 7 to 9")
      expect(formatRanges([7, 9])).toBe("7 to 9")
    })

    it("J16.10 syntax as the statement; an absent syntax reads proto2", () => {
      expect(formatSyntax("proto3")).toBe('syntax = "proto3"')
      expect(formatSyntax("2023")).toBe('edition = "2023"')
      expect(formatSyntax(undefined)).toBe('syntax = "proto2"')
    })

    it("J16.11 HTTP bindings: verb and path, body and response body after the code span", () => {
      expect(formatHttpBinding({ method: "GET", path: "/v1/pets/{id}" })).toBe("`GET /v1/pets/{id}`")
      expect(formatHttpBinding({ method: "POST", path: "/v1/pets/{id}:get", body: "*" })).toBe(
        "`POST /v1/pets/{id}:get` (body `*`)",
      )
      expect(formatHttpBinding({ method: "HEAD", path: "/h", responseBody: "r" })).toBe("`HEAD /h` (response body `r`)")
    })
  })

  describe("the lint (expectProtoWording) self-tests", () => {
    const keys = [
      "$ref",
      "properties",
      "protoType",
      "items",
      "additionalProperties",
      "propertyNames",
      "jsonName",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
      "minProperties",
      "maxProperties",
      "multipleOf",
      "uniqueItems",
      "readOnly",
      "writeOnly",
      "oneofs",
      "utf8Validation",
      "jsonFormat",
      "extensionOptions",
      "importFlags",
      "extendee",
    ]
    for (const key of keys) {
      it(`J16.L ${key} as a word or code span fails`, () => {
        expect(protoWordingIssues(record(`[Replaced] ${key} of field \`s\` (1) in message \`p.M\``))).toHaveLength(1)
        expect(protoWordingIssues(record(`[Replaced] \`${key}\` of field \`s\` (1) in message \`p.M\``))).toHaveLength(
          1,
        )
      })
    }

    it("J16.L1 `#/`, `required[]`, required fields and x- names fail", () => {
      for (const text of [
        "[Replaced] type of field `s` (1) in message `p.M` from `#/components/messages/p.A` to `p.B`",
        "[Added] `required[]` to message `p.M`",
        "[Added] required fields to message `p.M`",
        "[Added] `x-default` to field `s` (1) in message `p.M`",
      ]) {
        expect({ text, issues: protoWordingIssues(record(text)).length }).toEqual({ text, issues: 1 })
      }
    })

    it("J16.L2 JSON spellings of values fail: quoted digits, Infinity / NaN, ranges a-b, syntax without a statement", () => {
      expect(
        protoWordingIssues(record('[Replaced] default value of field `s` (1) in message `p.M` from `"10"` to `20`')),
      ).toHaveLength(1)
      expect(
        protoWordingIssues(record("[Replaced] default value of field `d` (1) in message `p.M` from `Infinity` to `1`")),
      ).toHaveLength(1)
      expect(protoWordingIssues(record("[Removed] reserved numbers `7-9` from message `p.M`"))).toHaveLength(1)
      expect(
        protoWordingIssues(record('[Replaced] syntax of file `a.proto` from `proto3` to `edition = "2023"`')),
      ).toHaveLength(1)
    })

    it("J16.L3 an extension option without parentheses fails; built-in and feature options pass", () => {
      expect(
        protoWordingIssues(record("[Added] option `acme.audit = true` to field `s` (1) in message `p.M`")),
      ).toHaveLength(1)
      expect(
        protoWordingIssues(record("[Added] option `(acme.audit) = true` to field `s` (1) in message `p.M`")),
      ).toEqual([])
      expect(
        protoWordingIssues(record("[Added] option `features.field_presence = EXPLICIT` to file `a.proto`")),
      ).toEqual([])
      expect(
        protoWordingIssues(record("[Added] option `jstype = JS_STRING` to field `s` (1) in message `p.M`")),
      ).toEqual([])
    })

    it("J16.L4 a record without a description, or without its label, fails", () => {
      expect(protoWordingIssues(record(""))).toHaveLength(1)
      expect(protoWordingIssues(record("minimum value changed"))).toHaveLength(1)
    })

    it("J16.L5 free text of description, title and reason records is exempt", () => {
      const path = ["components", "messages", "p.M", "properties", "s", "description"]
      expect(
        protoWordingIssues(
          record(
            "[Replaced] description of field `s` (1) in message `p.M` from `The items.` to `The properties.`",
            path,
          ),
        ),
      ).toEqual([])
      expect(
        protoWordingIssues(
          record("[Deprecated] field `s` (1) in message `p.M` (reason: use minLength)", [
            ...path.slice(0, -1),
            "deprecation",
          ]),
        ),
      ).toEqual([])
    })

    it("J16.L6 element names are exempt: a field named `items` is a protobuf name", () => {
      expect(protoWordingIssues(record("[Added] field `items` (3) to message `p.properties`"))).toEqual([])
      expect(protoWordingIssues(record("[Renamed] field `a` (1) to `items` in message `p.M`"))).toEqual([])
    })
  })
})

describe("Block J16 — the weak check (POLICY-90 / 102) over the J15 corpus and the catalogue", () => {
  it("J16.W every record of the single-edit corpus and of the catalogue pairs has a strong description", () => {
    const problems: string[] = []
    const check = (diffs: Diff[]) => {
      for (const diff of diffs) {
        for (const reason of weakDescription(diff)) {
          problems.push(`${reason}: ${diff.description}`)
        }
      }
    }
    for (const item of catalogueCases) {
      const docs = protoDocs(item.before, item.after)
      check(protoCompare(docs.before, docs.after).diffs)
    }
    for (const item of singleEdits) {
      const { before, after } = singleEditDocuments(item)
      check(protoCompare(before, after).diffs)
    }
    expect(problems).toEqual([])
  }, 30_000)
})
