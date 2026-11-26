import { allBreaking, type Diff, type ProtoApiCompareOptions } from "../../src"
import { protoCompare, protoDiffs, protoDocs } from "../helpers"

// J10 (PROTOAPI_DESIGN §8, §6.8, §9.1): the custom annotation cases AN-01 … AN-30 and the keyword rows K-1 … K-18 of
// §6.8 with 64-bit BigInt bounds, bound pairs (S3: `gt` ↔ `gte`, both keywords on one side, integer normalisation),
// numeric respelling (S4), the field keyword `required` (S1), validators at the inner positions, `exposedOnly` and
// `typeClassifier`, and the remainder and conflict folds (PD-19, A7). Every case is compared with the message used as
// a request (`req`) and as a response (`resp`); the record is the only one of the comparison (R-1).

const imports = [
  "google/api/field_behavior.proto",
  "google/api/field_info.proto",
  "buf/validate/validate.proto",
  "protoc-gen-openapiv2/options/annotations.proto",
]
  .map((path) => `import "${path}";`)
  .join("\n")

type Usage = "req" | "resp" | "both"

const usages: Record<Usage, string> = {
  req: "service S { rpc Call(M) returns (E); }",
  resp: "service S { rpc Call(E) returns (M); }",
  both: "service S { rpc Call(M) returns (M); }",
}

const doc = (fields: string, usage: Usage, syntax: string) =>
  `${syntax}\npackage p;\n${imports}\nmessage M {\n${fields}\n}\nmessage E {}\nmessage Q { int32 id = 1; }\n${usages[usage]}\n`

type Case = {
  id: string
  title: string
  before: string
  after: string
  // `<action> <path inside p.M>` of the record
  record: string
  // classes by usage
  types: Partial<Record<Usage, Diff["type"]>>
  syntax?: string
  options?: ProtoApiCompareOptions
  description?: string
}

const field = (path: string) => `components/messages/p.M/properties/${path}`

const keyOf = (diff: Diff) => `${diff.action} ${diff.path.join("/")}`

const check = (item: Case) => {
  for (const usage of Object.keys(item.types) as Usage[]) {
    const syntax = item.syntax ?? 'syntax = "proto3";'
    const { diffs } = protoDiffs(doc(item.before, usage, syntax), doc(item.after, usage, syntax), item.options)
    const [action, path] = item.record.split(" ")
    expect({ usage, records: diffs.map(keyOf) }).toEqual({ usage, records: [`${action} ${field(path)}`] })
    expect({ usage, type: diffs[0].type }).toEqual({ usage, type: item.types[usage] })
    if (item.description) {
      expect(diffs[0].description).toBe(item.description)
    }
  }
}

const cases: Case[] = [
  {
    id: "AN-01",
    title: "a documented default changed (`@Default`) is an annotation",
    before: "// @Default 10\nint32 n = 1;",
    after: "// @Default 20\nint32 n = 1;",
    record: "replace n/x-default",
    types: { req: "annotation", resp: "annotation" },
    description: "[Replaced] documented default of field `n` (1) in message `p.M` from `10` to `20`",
  },
  {
    id: "AN-02",
    title: "a proto2 wire default changed is breaking (F-32)",
    syntax: 'syntax = "proto2";',
    before: "optional int32 n = 1 [default = 10];",
    after: "optional int32 n = 1 [default = 20];",
    record: "replace n/default",
    types: { req: "breaking", resp: "breaking" },
  },
  {
    id: "AN-03",
    title: "`@Required` added: the required constraint (K-14)",
    before: "string id = 1;",
    after: "// @Required\nstring id = 1;",
    record: "add id/required",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Added] required constraint to field `id` (1) in message `p.M`",
  },
  {
    id: "AN-04",
    title: "`field_behavior` OPTIONAL → REQUIRED is one record, the remainder folded (PD-19)",
    before: "string id = 1 [(google.api.field_behavior) = OPTIONAL];",
    after: "string id = 1 [(google.api.field_behavior) = REQUIRED];",
    record: "add id/required",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Added] required constraint to field `id` (1) in message `p.M`",
  },
  {
    id: "AN-05",
    title: "the `Required.` prefix removed; the description is unchanged",
    before: "// Required. The id.\nstring id = 1;",
    after: "// The id.\nstring id = 1;",
    record: "remove id/required",
    types: { req: "non-breaking", resp: "risky" },
  },
  {
    id: "AN-06",
    title: "`(buf.validate.field).required` removed",
    before: "string id = 1 [(buf.validate.field).required = true];",
    after: "string id = 1;",
    record: "remove id/required",
    types: { req: "non-breaking", resp: "risky" },
  },
  {
    id: "AN-07",
    title: "`@MaxLength` lowered",
    before: "// @MaxLength 64\nstring s = 1;",
    after: "// @MaxLength 32\nstring s = 1;",
    record: "replace s/maxLength",
    types: { req: "breaking", resp: "non-breaking" },
  },
  {
    id: "AN-08",
    title: "`string.max_len` raised (AD-16)",
    before: "string s = 1 [(buf.validate.field).string.max_len = 32];",
    after: "string s = 1 [(buf.validate.field).string.max_len = 64];",
    record: "replace s/maxLength",
    types: { req: "non-breaking", resp: "breaking" },
  },
  {
    id: "AN-09",
    title: "`string.email` removed: the format removed",
    before: "string s = 1 [(buf.validate.field).string.email = true];",
    after: "string s = 1;",
    record: "remove s/format",
    types: { req: "non-breaking", resp: "breaking" },
    description: "[Removed] format `email` from field `s` (1) in message `p.M`",
  },
  {
    id: "AN-10a",
    title: "`field_info.format` UUID4 → IPV4 is breaking both ways",
    before: "string s = 1 [(google.api.field_info).format = UUID4];",
    after: "string s = 1 [(google.api.field_info).format = IPV4];",
    record: "replace s/format",
    types: { req: "breaking", resp: "breaking" },
  },
  {
    id: "AN-10b",
    title: "`field_info.format` IPV4 → IPV4_OR_IPV6 is a generalization",
    before: "string s = 1 [(google.api.field_info).format = IPV4];",
    after: "string s = 1 [(google.api.field_info).format = IPV4_OR_IPV6];",
    record: "replace s/format",
    types: { req: "non-breaking", resp: "breaking" },
  },
  {
    id: "AN-11",
    title: "`@Pattern` changed is breaking both ways (POLICY-41)",
    before: "// @Pattern ^[a-z]+$\nstring s = 1;",
    after: "// @Pattern ^[a-z0-9]+$\nstring s = 1;",
    record: "replace s/pattern",
    types: { req: "breaking", resp: "breaking" },
  },
  {
    id: "AN-12",
    title: "`int64` `{ gt: 0 }` → `{ gte: 0 }` is one lower-bound record (S3), compared as BigInt",
    before: "int64 n = 1 [(buf.validate.field).int64 = { gt: 0 }];",
    after: "int64 n = 1 [(buf.validate.field).int64 = { gte: 0 }];",
    record: "replace n/minimum",
    types: { req: "non-breaking", resp: "risky" },
    description: "[Replaced] minimum value of field `n` (1) in message `p.M` from `> 0` to `>= 0`",
  },
  {
    id: "AN-13",
    title: "`repeated.min_items` removed",
    before: "repeated string s = 1 [(buf.validate.field).repeated.min_items = 1];",
    after: "repeated string s = 1;",
    record: "remove s/minItems",
    types: { req: "non-breaking", resp: "breaking" },
  },
  {
    id: "AN-14",
    title: "the `Output only.` prefix added: output-only behavior (PD-12)",
    before: "// Created.\nstring s = 1;",
    after: "// Output only. Created.\nstring s = 1;",
    record: "add s/readOnly",
    types: { req: "breaking", resp: "non-breaking" },
  },
  {
    id: "AN-15",
    title: "`field_behavior` IMMUTABLE added (PD-12)",
    before: "string s = 1;",
    after: "string s = 1 [(google.api.field_behavior) = IMMUTABLE];",
    record: "add s/immutable",
    types: { req: "breaking", resp: "annotation" },
    description: "[Added] immutable behavior to field `s` (1) in message `p.M`",
  },
  {
    id: "AN-16",
    title: "`field_behavior` INPUT_ONLY removed (PD-12)",
    before: "string s = 1 [(google.api.field_behavior) = INPUT_ONLY];",
    after: "string s = 1;",
    record: "remove s/writeOnly",
    types: { req: "non-breaking", resp: "non-breaking" },
    description: "[Removed] input-only behavior from field `s` (1) in message `p.M`",
  },
  {
    id: "AN-17",
    title: "`@Deprecated` added",
    before: "string s = 1;",
    after: "// @Deprecated use v2\nstring s = 1;",
    record: "add s/deprecation",
    types: { req: "deprecated", resp: "deprecated" },
    description: "[Deprecated] field `s` (1) in message `p.M` (reason: use v2)",
  },
  {
    id: "AN-18",
    title: "the deprecation reason changed",
    before: "// Deprecated: use v2\nstring s = 1 [deprecated = true];",
    after: "// Deprecated: use v3\nstring s = 1 [deprecated = true];",
    record: "replace s/deprecation/reason",
    types: { req: "deprecated", resp: "deprecated" },
    description: "[Replaced] deprecation reason of field `s` (1) in message `p.M` from `use v2` to `use v3`",
  },
  {
    id: "AN-19",
    title: "`deprecated = true` removed",
    before: "string s = 1 [deprecated = true];",
    after: "string s = 1;",
    record: "remove s/deprecation",
    types: { req: "deprecated", resp: "deprecated" },
    description: "[Removed] deprecation from field `s` (1) in message `p.M`",
  },
  {
    id: "AN-20",
    title: "an `@Example` of a message field changed is one annotation record (one value)",
    before: '// @Example {"id":1}\nQ q = 1;',
    after: '// @Example {"id":2}\nQ q = 1;',
    record: "replace q/examples/0",
    types: { req: "annotation", resp: "annotation" },
    description: "[Replaced] example of field `q` (1) in message `p.M` from `{ id: 1 }` to `{ id: 2 }`",
  },
  {
    id: "AN-21",
    title: "an `@Enum` value removed",
    before: "// @Enum a, b\nstring s = 1;",
    after: "// @Enum a\nstring s = 1;",
    record: "remove s/enum/1",
    types: { req: "breaking", resp: "non-breaking" },
    description: '[Removed] allowed value `"b"` from field `s` (1) in message `p.M`',
  },
  {
    id: "AN-22",
    title: "a dropped tag changed alone gives only the conflict entry record (A7: nothing to fold into)",
    before: "// @Format email\nstring s = 1 [(buf.validate.field).string.uuid = true];",
    after: "// @Format uri\nstring s = 1 [(buf.validate.field).string.uuid = true];",
    record: "replace s/x-annotation-conflicts/0/dropped/value",
    types: { req: "annotation", resp: "annotation" },
    description:
      "[Replaced] annotation conflict of field `s` (1) in message `p.M` from `email` dropped to `uri` dropped (format `uuid` kept)",
  },
  {
    id: "AN-23",
    title: "an `@since` line changed is a description change",
    before: "// @since 1.2\nstring s = 1;",
    after: "// @since 1.3\nstring s = 1;",
    record: "replace s/description",
    types: { req: "annotation", resp: "annotation" },
  },
  {
    id: "AN-24",
    title: "a comment changed",
    before: "// Lists pets.\nstring s = 1;",
    after: "// Lists all pets.\nstring s = 1;",
    record: "replace s/description",
    types: { req: "annotation", resp: "annotation" },
  },
  {
    id: "AN-26",
    title: "the openapiv2 field default changed is a documented default",
    before: 'int32 n = 1 [(grpc.gateway.protoc_gen_openapiv2.options.openapiv2_field) = { default: "10" }];',
    after: 'int32 n = 1 [(grpc.gateway.protoc_gen_openapiv2.options.openapiv2_field) = { default: "20" }];',
    record: "replace n/x-default",
    types: { req: "annotation", resp: "annotation" },
  },
  {
    id: "AN-27",
    title: "a `buf.validate.message` CEL expression changed is an unclassified option, one value",
    before:
      'string s = 1;\noption (buf.validate.message).cel = { id: "a", message: "m", expression: "this.s != \'\'" };',
    after:
      'string s = 1;\noption (buf.validate.message).cel = { id: "a", message: "m", expression: "this.s != \'x\'" };',
    record: "replace -",
    types: { req: "unclassified", resp: "unclassified" },
  },
  {
    id: "AN-29",
    title: "`@Required` removed on a field of a response-only message is risky (POLICY-05)",
    before: "// @Required\nstring s = 1;",
    after: "string s = 1;",
    record: "remove s/required",
    types: { resp: "risky" },
  },
  {
    id: "AN-30",
    title: "`@MinLength` raised on a message used both ways takes the more severe class",
    before: "// @MinLength 3\nstring s = 1;",
    after: "// @MinLength 5\nstring s = 1;",
    record: "replace s/minLength",
    types: { both: "breaking", req: "breaking", resp: "non-breaking" },
  },
]

// §6.8 keyword rows beyond the AN cases (K-1 … K-17, S3, S4, inner positions, ISSUE-374)
const keywordCases: Case[] = [
  {
    id: "K-1a",
    title: "a 64-bit lower bound lowered by one beyond 2^53 is compared as BigInt (looser)",
    before: "int64 n = 1 [(buf.validate.field).int64.gte = 9007199254740993];",
    after: "int64 n = 1 [(buf.validate.field).int64.gte = 9007199254740992];",
    record: "replace n/minimum",
    types: { req: "non-breaking", resp: "risky" },
    description:
      "[Replaced] minimum value of field `n` (1) in message `p.M` from `>= 9007199254740993` to `>= 9007199254740992`",
  },
  {
    id: "K-1b",
    title: "a 64-bit lower bound raised by one beyond 2^53 (tighter)",
    before: "int64 n = 1 [(buf.validate.field).int64.gte = 9007199254740993];",
    after: "int64 n = 1 [(buf.validate.field).int64.gte = 9007199254740994];",
    record: "replace n/minimum",
    types: { req: "breaking", resp: "non-breaking" },
  },
  {
    id: "K-1c",
    title: "integer normalisation: `gt: 0` → `gte: 1` is the same effective bound (S3, C6)",
    before: "int32 n = 1 [(buf.validate.field).int32.gt = 0];",
    after: "int32 n = 1 [(buf.validate.field).int32.gte = 1];",
    record: "replace n/minimum",
    types: { req: "annotation", resp: "annotation" },
    description: "[Replaced] minimum value of field `n` (1) in message `p.M` from `> 0` to `>= 1`",
  },
  {
    id: "K-1d",
    title: "both lower-bound keywords on one side: one record for the effective bound (S3)",
    before: "int64 n = 1 [(buf.validate.field).int64 = { gt: 1, gte: 3 }];",
    after: "int64 n = 1 [(buf.validate.field).int64 = { gt: 4 }];",
    record: "replace n/exclusiveMinimum",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Replaced] minimum value of field `n` (1) in message `p.M` from `>= 3` to `> 4`",
  },
  {
    id: "K-1e",
    title: "a lower bound added on a double field",
    before: "double d = 1;",
    after: "double d = 1 [(buf.validate.field).double.gt = 0.5];",
    record: "add d/exclusiveMinimum",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Added] minimum value `> 0.5` to field `d` (1) in message `p.M`",
  },
  {
    id: "K-2",
    title: "`lte: 100` → `lt: 100` is one upper-bound record (S3)",
    before: "int32 n = 1 [(buf.validate.field).int32 = { lte: 100 }];",
    after: "int32 n = 1 [(buf.validate.field).int32 = { lt: 100 }];",
    record: "replace n/exclusiveMaximum",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Replaced] maximum value of field `n` (1) in message `p.M` from `<= 100` to `< 100`",
  },
  {
    id: "K-3a",
    title: "a 64-bit step narrowed (`multipleOf` 10 → 20)",
    before: "// @MultipleOf 10\nint64 n = 1;",
    after: "// @MultipleOf 20\nint64 n = 1;",
    record: "replace n/multipleOf",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Replaced] multiple-of constraint of field `n` (1) in message `p.M` from `10` to `20`",
  },
  {
    id: "K-3b",
    title: "an unrelated step (`multipleOf` 20 → 30) is breaking both ways",
    before: "// @MultipleOf 20\nint64 n = 1;",
    after: "// @MultipleOf 30\nint64 n = 1;",
    record: "replace n/multipleOf",
    types: { req: "breaking", resp: "breaking" },
  },
  {
    id: "K-6",
    title: "a minimum entry count added to a map (`map.min_pairs`)",
    before: "map<string, int32> m = 1;",
    after: "map<string, int32> m = 1 [(buf.validate.field).map.min_pairs = 1];",
    record: "add m/minProperties",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Added] minimum entry count `1` to field `m` (1) in message `p.M`",
  },
  {
    id: "K-8",
    title: "unique elements required (`repeated.unique`)",
    before: "repeated string s = 1;",
    after: "repeated string s = 1 [(buf.validate.field).repeated.unique = true];",
    record: "add s/uniqueItems",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Added] unique-elements constraint to field `s` (1) in message `p.M`",
  },
  {
    id: "K-9",
    title: "a pattern replaced by `.*` is a generalization (POLICY-41)",
    before: "// @Pattern ^[a-z]+$\nstring s = 1;",
    after: "// @Pattern .*\nstring s = 1;",
    record: "replace s/pattern",
    types: { req: "non-breaking", resp: "breaking" },
  },
  {
    id: "K-11",
    title: "allowed values added (the keyword)",
    before: "string s = 1;",
    after: "// @Enum a, b\nstring s = 1;",
    record: "add s/enum",
    types: { req: "breaking", resp: "non-breaking" },
    description: '[Added] allowed values `"a"`, `"b"` to field `s` (1) in message `p.M`',
  },
  {
    id: "K-12",
    title: "an allowed value added (POLICY-05: risky in responses)",
    before: "int64 n = 1 [(buf.validate.field).int64 = { in: [1, 2] }];",
    after: "int64 n = 1 [(buf.validate.field).int64 = { in: [1, 2, 3] }];",
    record: "add n/enum/2",
    types: { req: "non-breaking", resp: "risky" },
    description: "[Added] allowed value `3` to field `n` (1) in message `p.M`",
  },
  {
    id: "K-13",
    title: "a constant value changed",
    before: 'string s = 1 [(buf.validate.field).string.const = "fixed"];',
    after: 'string s = 1 [(buf.validate.field).string.const = "fixed2"];',
    record: "replace s/const",
    types: { req: "breaking", resp: "breaking" },
    description: '[Replaced] constant value of field `s` (1) in message `p.M` from `"fixed"` to `"fixed2"`',
  },
  {
    id: "K-16",
    title: "input-only behavior added (PD-12)",
    before: "string s = 1;",
    after: "string s = 1 [(google.api.field_behavior) = INPUT_ONLY];",
    record: "add s/writeOnly",
    types: { req: "non-breaking", resp: "breaking" },
  },
  {
    id: "K-17",
    title: "immutable behavior removed (PD-12)",
    before: "string s = 1 [(google.api.field_behavior) = IMMUTABLE];",
    after: "string s = 1;",
    record: "remove s/immutable",
    types: { req: "non-breaking", resp: "annotation" },
  },
  {
    id: "K-9i",
    title: "a pattern of the elements removed (`repeated.items`)",
    before: 'repeated string s = 1 [(buf.validate.field).repeated.items.string.pattern = "^[a-z]+$"];',
    after: "repeated string s = 1;",
    record: "remove s/items/pattern",
    types: { req: "non-breaking", resp: "breaking" },
    description: "[Removed] pattern `^[a-z]+$` from elements of field `s` (1) in message `p.M`",
  },
  {
    id: "K-4k",
    title: "a minimum length of the map keys added (`map.keys`)",
    before: "map<string, int32> m = 1;",
    after: "map<string, int32> m = 1 [(buf.validate.field).map.keys.string.min_len = 2];",
    record: "add m/propertyNames/minLength",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Added] minimum length `2` to map keys of field `m` (1) in message `p.M`",
  },
  {
    id: "K-2v",
    title: "a maximum value of the map values respelled `lte` → `lt` (`map.values`, S3)",
    before: "map<string, int32> m = 1 [(buf.validate.field).map.values.int32.lte = 100];",
    after: "map<string, int32> m = 1 [(buf.validate.field).map.values.int32.lt = 100];",
    record: "replace m/additionalProperties/exclusiveMaximum",
    types: { req: "breaking", resp: "non-breaking" },
    description: "[Replaced] maximum value of map values of field `m` (1) in message `p.M` from `<= 100` to `< 100`",
  },
  {
    id: "exposedOnly",
    title: "a validator tightened on an output-only field reads non-breaking in a request (`exposedOnly`)",
    before: "string s = 1 [(google.api.field_behavior) = OUTPUT_ONLY, (buf.validate.field).string.max_len = 64];",
    after: "string s = 1 [(google.api.field_behavior) = OUTPUT_ONLY, (buf.validate.field).string.max_len = 32];",
    record: "replace s/maxLength",
    types: { req: "non-breaking", resp: "non-breaking" },
  },
  {
    id: "PD-19",
    title: "a pattern added next to a prefix rule: the remainder of the option folds into the pattern record",
    before: 'string s = 1 [(buf.validate.field).string.prefix = "pets/"];',
    after: 'string s = 1 [(buf.validate.field).string = { prefix: "pets/", pattern: "^[a-z/]+$" }];',
    record: "replace s/pattern",
    types: { req: "breaking", resp: "breaking" },
  },
  {
    id: "A7",
    title: "an option change that also changes a conflict entry is one record, the keyword's",
    before:
      '// @Title Dropped\nint32 n = 1 [(grpc.gateway.protoc_gen_openapiv2.options.openapiv2_field) = { title: "Kept" }];',
    after:
      '// @Title Dropped\nint32 n = 1 [(grpc.gateway.protoc_gen_openapiv2.options.openapiv2_field) = { title: "Kept2" }];',
    record: "replace n/title",
    types: { req: "annotation", resp: "annotation" },
    description: "[Replaced] title of field `n` (1) in message `p.M` from `Kept` to `Kept2`",
  },
  {
    id: "ISSUE-374a",
    title: "an exact length changed (`string.len`) is one record (ISSUE-374 (fixed))",
    before: "string s = 1 [(buf.validate.field).string.len = 4];",
    after: "string s = 1 [(buf.validate.field).string.len = 5];",
    // the representative is the most severe record of the scope: the raised minimum in a request
    record: "replace s/minLength",
    types: { req: "breaking" },
    description: "[Replaced] minimum length and maximum length of field `s` (1) in message `p.M` from `4` to `5`",
  },
  {
    id: "ISSUE-374c",
    title: "an exact length changed in a response: the raised maximum is the representative",
    before: "string s = 1 [(buf.validate.field).string.len = 4];",
    after: "string s = 1 [(buf.validate.field).string.len = 5];",
    record: "replace s/maxLength",
    types: { resp: "breaking" },
    description: "[Replaced] minimum length and maximum length of field `s` (1) in message `p.M` from `4` to `5`",
  },
  {
    id: "ISSUE-374b",
    title: "one field behavior replaced by another is one record (ISSUE-374 (fixed))",
    before: "string s = 1 [(google.api.field_behavior) = IMMUTABLE];",
    after: "string s = 1 [(google.api.field_behavior) = OUTPUT_ONLY];",
    record: "add s/readOnly",
    types: { req: "breaking", resp: "non-breaking" },
    description:
      "[Replaced] field behavior of field `s` (1) in message `p.M`: immutable behavior removed, output-only behavior added",
  },
]

describe("Block J10 — ProtoApi annotation keywords (§6.8, AN-01 … AN-30)", () => {
  for (const item of cases) {
    if (item.id === "AN-27") {
      it(`J10.${item.id} ${item.title}`, () => {
        for (const usage of ["req", "resp"] as Usage[]) {
          const { diffs } = protoDiffs(
            doc(item.before, usage, 'syntax = "proto3";'),
            doc(item.after, usage, 'syntax = "proto3";'),
          )
          expect(diffs.map(keyOf)).toEqual(["replace components/messages/p.M/options/buf.validate.message/cel"])
          expect(diffs[0].type).toBe("unclassified")
        }
      })
      continue
    }
    it(`J10.${item.id} ${item.title}`, () => check(item))
  }

  for (const item of keywordCases) {
    it(`J10.${item.id} ${item.title}`, () => check(item))
  }

  it("J10.S4 numerically equal keyword values in another spelling give no record: int32 → int64 keeps one record", () => {
    const { diffs } = protoDiffs(
      doc(
        "// @Default 10\n// @Enum 1, 2\nint32 n = 1 [(buf.validate.field).int32 = { gt: 0, lte: 9 }];",
        "req",
        'syntax = "proto3";',
      ),
      doc(
        "// @Default 10\n// @Enum 1, 2\nint64 n = 1 [(buf.validate.field).int64 = { gt: 0, lte: 9 }];",
        "req",
        'syntax = "proto3";',
      ),
    )
    expect(diffs.map((d) => `${keyOf(d)} ${d.type}`)).toEqual([`replace ${field("n/type")} breaking`])
    expect(diffs[0].description).toBe("[Replaced] type of field `n` (1) in message `p.M` from `int32` to `int64`")
  })

  it("J10.typeClassifier a validator of another type than the field's is an annotation (POLICY-10)", () => {
    const { before, after } = protoDocs(
      doc("int32 n = 1;", "req", 'syntax = "proto3";'),
      doc("int32 n = 1;", "req", 'syntax = "proto3";'),
    )
    const edited = structuredClone(after) as any
    edited.components.messages["p.M"].properties.n.minLength = 3
    const { diffs } = protoCompare(before, edited)
    expect(diffs.map((d) => `${keyOf(d)} ${d.type}`)).toEqual([`add ${field("n/minLength")} annotation`])
  })

  it("J10.S1 a renamed field takes its required constraint with it: one rename record (S2)", () => {
    const { diffs } = protoDiffs(
      doc("// @Required\nstring id = 1;", "req", 'syntax = "proto3";'),
      doc("// @Required\nstring key = 1;", "req", 'syntax = "proto3";'),
    )
    expect(diffs.map(keyOf)).toEqual(["rename components/messages/p.M/properties"])
    expect(diffs[0].description).toBe("[Renamed] field `id` (1) to `key` in message `p.M`")
  })

  it("J10.AN-25 whitespace inside a comment line is normalised: no diff (Q18)", () => {
    const { diffs } = protoDiffs(
      doc("// Required. The id.\nstring s = 1;", "req", 'syntax = "proto3";'),
      doc("// Required.  The id.\nstring s = 1;", "req", 'syntax = "proto3";'),
    )
    expect(diffs).toEqual([])
  })

  it("J10.AN-22b the identical conflict documents give no diff; the conflict entry is on the field", () => {
    const text = doc(
      "// @Format email\nstring s = 1 [(buf.validate.field).string.uuid = true];",
      "req",
      'syntax = "proto3";',
    )
    const { diffs, after } = protoDiffs(text, text)
    expect(diffs).toEqual([])
    expect((after as any).components.messages["p.M"].properties.s).toMatchObject({
      format: "uuid",
      "x-annotation-conflicts": [
        {
          keyword: "format",
          kept: { source: "buf.validate", value: "uuid" },
          dropped: { source: "tag", value: "email" },
        },
      ],
    })
  })

  it("J10.AN-28 a custom option removed is unclassified; `optionRules` promotes it", () => {
    const opts = `import "google/protobuf/descriptor.proto";\nextend google.protobuf.FieldOptions { bool audit = 50000; }`
    const before = `syntax = "proto3";\npackage mycompany;\n${opts}\nmessage M { string s = 1 [(mycompany.audit) = true]; }\n`
    const after = `syntax = "proto3";\npackage mycompany;\n${opts}\nmessage M { string s = 1; }\n`
    const plain = protoDiffs(before, after).diffs
    expect(plain.map((d) => `${keyOf(d)} ${d.type}`)).toEqual([
      "remove components/messages/mycompany.M/properties/s/options/mycompany.audit unclassified",
    ])
    expect(plain[0].description).toBe(
      "[Removed] option `(mycompany.audit) = true` from field `s` (1) in message `mycompany.M`",
    )
    const promoted = protoDiffs(before, after, {
      optionRules: { "/mycompany.*": { $: { default: ["non-breaking", "breaking", "breaking"] } } },
    })
    expect(promoted.diffs.map((d) => d.type)).toEqual(["breaking"])
    expect(protoDiffs(before, after, { optionRules: { "/mycompany.audit": { $: allBreaking } } }).diffs[0].type).toBe(
      "breaking",
    )
  })
})
