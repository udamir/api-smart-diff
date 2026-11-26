import { type ProtoApiCompareOptions } from "../../src"
import { diffElement } from "../../src/protoapi/protoapi.utils"
import { type ProtoInput, protoCompare, protoDiffs, protoDocs } from "../helpers"
import { catalogueCases } from "./fixtures/catalogue"

// J12 (PROTOAPI_DESIGN §9.1): descriptions under R-D. (c) The catalogue W-01 … W-39 of §7.2 as exact-description
// tests, one per entry, the before / after pair as fixture; every further template of §7.2 once; the merged-record
// templates (A4) and the shape-fold template (PD-16); the `[Deprecated]` label (PD-23); containers and the weak check
// (POLICY-90 / 102); free text (POLICY-95 / 108) and listed validator values (POLICY-119).

describe("Block J12 — ProtoApi descriptions (R-D)", () => {
  describe("the catalogue W-01 … W-39 (§7.2, normative)", () => {
    for (const item of catalogueCases) {
      it(`J12.${item.id} (${item.row}, ${item.cell}) ${item.description}`, () => {
        const { diffs } = protoDiffs(item.before, item.after)
        const records = diffs.filter((diff) => diffElement(diff) === item.element)
        expect(records.map((diff) => diff.description)).toEqual([item.description])
        expect(records[0].type).toBe(item.type)
      })
    }
  })
})

// ---- further templates of §7.2 (asserted once each)

type Template = {
  id: string
  before: ProtoInput
  after: ProtoInput
  description: string
  options?: ProtoApiCompareOptions
  edit?: (docs: { before: Doc; after: Doc }) => void
  // the number of records of the comparison (default: any; the description must be one of them)
  records?: number
}

// biome-ignore lint/suspicious/noExplicitAny: fixtures write keys the document type does not declare
type Doc = Record<string, any>

const pet = (body: string, imports = "", syntax = 'syntax = "proto3";') => ({
  "shop/pet.proto": `${syntax}\npackage shop.v1;\n${imports}\n${body}\n`,
})
const legacy = (body: string, syntax = 'syntax = "proto2";') => ({
  "legacy.proto": `${syntax}\npackage shop.legacy;\n${body}\n`,
})
const pp = (body: string, syntax = 'syntax = "proto3";', imports = "") => ({
  "p.proto": `${syntax}\npackage p;\n${imports}\n${body}\n`,
})
const aa = (body: string) => ({
  "a.proto": `syntax = "proto2";\npackage a;\n${body}\n`,
})
const service = (rpcs: string, imports = "") =>
  pet(
    `message GetPetRequest { string name = 1; }\nmessage GetPetRequestV2 { string name = 1; }\nmessage ListPetsRequest {}\nmessage Pet { string name = 1; }\nservice PetService {\n${rpcs}\n}`,
    imports,
  )
const commonFile = { "common.proto": `syntax = "proto3";\npackage common;\nmessage C {}\n` }
const validate = `import "buf/validate/validate.proto";`
const behavior = `import "google/api/field_behavior.proto";`
const http = `import "google/api/annotations.proto";`
const client = `import "google/api/client.proto";`
const acmeOpts = {
  "acme/opts.proto": `syntax = "proto3";\npackage acme;\nimport "google/protobuf/descriptor.proto";\nextend google.protobuf.FieldOptions { bool audit = 50000; }\n`,
}

const templates: Template[] = [
  // file
  {
    id: "file added",
    before: pet("message Pet {}"),
    after: { ...pet("message Pet {}"), "shop/common.proto": `syntax = "proto3";\npackage shop.v1;\n` },
    description: "[Added] file `shop/common.proto`",
    records: 1,
  },
  {
    id: "bundled file added",
    before: pet("message Pet {}"),
    after: pet("message Pet { google.protobuf.Timestamp at = 1; }", `import "google/protobuf/timestamp.proto";`),
    description: "[Added] bundled file `google/protobuf/timestamp.proto`",
  },
  {
    id: "file renamed",
    before: { "pet.proto": `syntax = "proto3";\npackage shop.v1;\nmessage Pet {}\n` },
    after: { "shop/pet.proto": `syntax = "proto3";\npackage shop.v1;\nmessage Pet {}\n` },
    description: "[Renamed] file `pet.proto` to `shop/pet.proto`",
    records: 1,
  },
  {
    id: "import added",
    before: { ...pet("message Pet {}"), ...commonFile },
    after: { ...pet("message Pet {}", `import "common.proto";`), ...commonFile },
    description: "[Added] import `common.proto` to file `shop/pet.proto`",
    records: 1,
  },
  {
    id: "public modifier removed",
    before: { ...pet("message Pet {}", `import public "common.proto";`), ...commonFile },
    after: { ...pet("message Pet {}", `import "common.proto";`), ...commonFile },
    description: "[Removed] public modifier from import `common.proto` in file `shop/pet.proto`",
    records: 1,
  },
  {
    id: "L-1 file option",
    before: pet("message Pet {}", "option java_string_check_utf8 = false;"),
    after: pet("message Pet {}", "option java_string_check_utf8 = true;"),
    description: "[Replaced] option `java_string_check_utf8` of file `shop/pet.proto` from `false` to `true`",
    records: 1,
  },
  {
    id: "file deprecated (PD-23)",
    before: pet("message Pet {}"),
    after: pet("message Pet {}", "option deprecated = true;"),
    description: "[Deprecated] file `shop/pet.proto`",
    records: 1,
  },
  // service / rpc
  {
    id: "service added",
    before: { ...pet("message Pet {}"), "shop/order.proto": `syntax = "proto3";\npackage shop.v1;\nmessage O {}\n` },
    after: {
      ...pet("message Pet {}"),
      "shop/order.proto": `syntax = "proto3";\npackage shop.v1;\nmessage O {}\nservice OrderService { rpc Get(O) returns (O); }\n`,
    },
    description: "[Added] service `shop.v1.OrderService` to file `shop/order.proto`",
    records: 1,
  },
  {
    id: "rpc removed",
    before: service("rpc GetPet(GetPetRequest) returns (Pet);\nrpc List(ListPetsRequest) returns (Pet);"),
    after: service("rpc List(ListPetsRequest) returns (Pet);"),
    description: "[Removed] rpc `GetPet` from service `shop.v1.PetService`",
    records: 1,
  },
  {
    id: "request type",
    before: service("rpc GetPet(GetPetRequest) returns (Pet);"),
    after: service("rpc GetPet(GetPetRequestV2) returns (Pet);"),
    description:
      "[Replaced] request type of rpc `GetPet` in service `shop.v1.PetService` from `shop.v1.GetPetRequest` to `shop.v1.GetPetRequestV2`",
    records: 1,
  },
  {
    id: "idempotency",
    before: service("rpc ListPets(ListPetsRequest) returns (Pet) { option idempotency_level = IDEMPOTENT; }"),
    after: service("rpc ListPets(ListPetsRequest) returns (Pet) { option idempotency_level = NO_SIDE_EFFECTS; }"),
    description:
      "[Replaced] idempotency level of rpc `ListPets` in service `shop.v1.PetService` from `IDEMPOTENT` to `NO_SIDE_EFFECTS`",
    records: 1,
  },
  {
    id: "additional binding added",
    before: service(
      `rpc GetPet(GetPetRequest) returns (Pet) { option (google.api.http) = { get: "/v1/pets/{name}" }; }`,
      http,
    ),
    after: service(
      `rpc GetPet(GetPetRequest) returns (Pet) { option (google.api.http) = { get: "/v1/pets/{name}" additional_bindings { post: "/v1/pets:get" } }; }`,
      http,
    ),
    description: "[Added] additional HTTP binding `POST /v1/pets:get` to rpc `GetPet` in service `shop.v1.PetService`",
    records: 1,
  },
  {
    id: "binding removed",
    before: service(
      `rpc GetPet(GetPetRequest) returns (Pet) { option (google.api.http) = { get: "/v1/pets/{id}" }; }`,
      http,
    ),
    after: service("rpc GetPet(GetPetRequest) returns (Pet);", http),
    description: "[Removed] HTTP binding `GET /v1/pets/{id}` from rpc `GetPet` in service `shop.v1.PetService`",
    records: 1,
  },
  {
    id: "deprecation removed",
    before: service("rpc GetPet(GetPetRequest) returns (Pet) { option deprecated = true; }"),
    after: service("rpc GetPet(GetPetRequest) returns (Pet);"),
    description: "[Removed] deprecation from rpc `GetPet` in service `shop.v1.PetService`",
    records: 1,
  },
  {
    id: "deprecation reason",
    before: service(
      "// Deprecated: use GetPetV2\nrpc GetPet(GetPetRequest) returns (Pet) { option deprecated = true; }",
    ),
    after: service(
      "// Deprecated: use GetPetV3\nrpc GetPet(GetPetRequest) returns (Pet) { option deprecated = true; }",
    ),
    description:
      "[Replaced] deprecation reason of rpc `GetPet` in service `shop.v1.PetService` from `use GetPetV2` to `use GetPetV3`",
    records: 1,
  },
  // message
  {
    id: "message added",
    before: pet("message Pet {}"),
    after: pet("message Pet {}\nmessage Owner {}"),
    description: "[Added] message `shop.v1.Owner` to file `shop/pet.proto`",
    records: 1,
  },
  {
    id: "declaring file",
    before: {
      "pet.proto": `syntax = "proto3";\npackage shop.v1;\nmessage Pet {}\n`,
      "pets/pet.proto": `syntax = "proto3";\npackage shop.v1;\nmessage Other {}\n`,
    },
    after: {
      "pet.proto": `syntax = "proto3";\npackage shop.v1;\n`,
      "pets/pet.proto": `syntax = "proto3";\npackage shop.v1;\nmessage Other {}\nmessage Pet {}\n`,
    },
    description: "[Replaced] declaring file of message `shop.v1.Pet` from `pet.proto` to `pets/pet.proto`",
    records: 1,
  },
  {
    id: "reserved numbers removed",
    before: pet("message Pet { reserved 7 to 9; }"),
    after: pet("message Pet {}"),
    description: "[Removed] reserved numbers `7 to 9` from message `shop.v1.Pet`",
    records: 1,
  },
  {
    id: "reserved name added",
    before: pet("message Pet {}"),
    after: pet('message Pet { reserved "legacy_name"; }'),
    description: "[Added] reserved name `legacy_name` to message `shop.v1.Pet`",
    records: 1,
  },
  {
    id: "extension range added",
    before: legacy("message Order { optional int32 id = 1; }"),
    after: legacy("message Order { optional int32 id = 1; extensions 1000 to max; }"),
    description: "[Added] extension range `1000 to max` to message `shop.legacy.Order`",
    records: 1,
  },
  {
    id: "JSON format",
    before: pp("message M {}", 'edition = "2023";'),
    after: pp("message M { option features.json_format = LEGACY_BEST_EFFORT; }", 'edition = "2023";'),
    description: "[Replaced] JSON format of message `p.M` from `ALLOW` to `LEGACY_BEST_EFFORT`",
  },
  {
    id: "visibility",
    before: pp(
      "option features.default_symbol_visibility = EXPORT_ALL;\nmessage M { message N {} }",
      'edition = "2024";',
    ),
    after: pp(
      "option features.default_symbol_visibility = EXPORT_ALL;\nmessage M { local message N {} }",
      'edition = "2024";',
    ),
    description: "[Replaced] visibility of message `p.M.N` from `export` to `local`",
    records: 1,
  },
  {
    id: "oneof added (S8: with its own description)",
    before: pet("message Pet { string dog = 10; }"),
    after: pet("message Pet {\n  // The kind.\n  oneof kind { string dog = 10; }\n}"),
    description: "[Added] oneof `kind` to message `shop.v1.Pet`",
  },
  // field
  {
    id: "field added",
    before: pet("message Pet {}"),
    after: pet("message Pet { string nickname = 3; }"),
    description: "[Added] field `nickname` (3) to message `shop.v1.Pet`",
    records: 1,
  },
  {
    id: "required field added (F-46)",
    before: pet("message CreatePetRequest {}", behavior),
    after: pet("message CreatePetRequest { string name = 1 [(google.api.field_behavior) = REQUIRED]; }", behavior),
    description: "[Added] required field `name` (1) to message `shop.v1.CreatePetRequest`",
    records: 1,
  },
  {
    id: "field removed, number reserved (PD-3)",
    before: pet("message Pet { string nickname = 3; }"),
    after: pet("message Pet { reserved 3; }"),
    description: "[Removed] field `nickname` (3) from message `shop.v1.Pet` without reserving the name",
  },
  {
    id: "field renamed",
    before: pet("message Pet { string nick = 3; }"),
    after: pet("message Pet { string nickname = 3; }"),
    description: "[Renamed] field `nick` (3) to `nickname` in message `shop.v1.Pet`",
    records: 1,
  },
  {
    id: "field renamed, JSON name changed (PD-20)",
    before: pp("message User { string uid = 1; }"),
    after: pp("message User { string account_id = 1; }"),
    edit: ({ before }) => {
      before.components.messages["p.User"].properties.uid.jsonName = "uid"
    },
    description:
      "[Renamed] field `uid` (1) to `account_id` in message `p.User`, JSON name `uid` changed to `accountId`",
    records: 1,
  },
  {
    id: "required label added",
    before: legacy("message Order { optional int32 id = 1; }"),
    after: legacy("message Order { required int32 id = 1; }"),
    description: "[Added] required label to field `id` (1) in message `shop.legacy.Order` (`required`)",
    records: 1,
  },
  {
    id: "field left a oneof",
    before: pet("message Contact { oneof channel { string email = 1; string phone = 2; } }"),
    after: pet("message Contact { string email = 1; oneof channel { string phone = 2; } }"),
    description: "[Removed] field `email` (1) in message `shop.v1.Contact` from oneof `channel`",
    records: 1,
  },
  {
    id: "field moved between oneofs",
    before: pet("message Pet { oneof kind { string dog = 10; string cat = 11; } oneof other { string fish = 12; } }"),
    after: pet("message Pet { oneof kind { string dog = 10; } oneof other { string cat = 11; string fish = 12; } }"),
    description: "[Replaced] oneof of field `cat` (11) in message `shop.v1.Pet` from `kind` to `other`",
    records: 1,
  },
  {
    id: "implicit default (C6)",
    before: legacy("enum Color { RED = 1; GREEN = 2; }\nmessage Order { optional Color color = 5; }"),
    after: legacy("enum Color { GREEN = 2; RED = 1; }\nmessage Order { optional Color color = 5; }"),
    description:
      "[Replaced] default value of field `color` (5) in message `shop.legacy.Order` from `RED` (implicit) to `GREEN` (implicit)",
  },
  {
    id: "expanded encoding",
    before: legacy("message Order { repeated int32 codes = 7; }", 'syntax = "proto3";'),
    after: legacy("message Order { repeated int32 codes = 7 [packed = false]; }", 'syntax = "proto3";'),
    description: "[Added] expanded encoding to field `codes` (7) in message `shop.legacy.Order`",
    records: 1,
  },
  {
    id: "UTF-8 validation removed",
    before: legacy("message Order { string note = 2; }", 'edition = "2023";'),
    after: legacy("message Order { string note = 2 [features.utf8_validation = NONE]; }", 'edition = "2023";'),
    description: "[Removed] UTF-8 validation from field `note` (2) in message `shop.legacy.Order`",
  },
  {
    id: "delimited encoding",
    before: pp("message N {}\nmessage M { N meta = 4; }", 'edition = "2023";'),
    after: pp("message N {}\nmessage M { N meta = 4 [features.message_encoding = DELIMITED]; }", 'edition = "2023";'),
    description: "[Added] delimited encoding to field `meta` (4) in message `p.M`",
  },
  // validators
  {
    id: "pattern of elements",
    before: pet(
      'message Search { repeated string tags = 2 [(buf.validate.field).repeated.items.string.pattern = "^[a-z]+$"]; }',
      validate,
    ),
    after: pet("message Search { repeated string tags = 2; }", validate),
    description: "[Removed] pattern `^[a-z]+$` from elements of field `tags` (2) in message `shop.v1.Search`",
    records: 1,
  },
  {
    id: "maximum value of map values",
    before: pet(
      "message Search { map<string, int32> weights = 3 [(buf.validate.field).map.values.int32.lte = 100]; }",
      validate,
    ),
    after: pet(
      "message Search { map<string, int32> weights = 3 [(buf.validate.field).map.values.int32.lt = 100]; }",
      validate,
    ),
    description:
      "[Replaced] maximum value of map values of field `weights` (3) in message `shop.v1.Search` from `<= 100` to `< 100`",
    records: 1,
  },
  {
    id: "allowed value",
    before: pet("message Signup {\n  // @Enum cat\n  string kind = 8;\n}"),
    after: pet("message Signup {\n  // @Enum cat, dog\n  string kind = 8;\n}"),
    description: '[Added] allowed value `"dog"` to field `kind` (8) in message `shop.v1.Signup`',
    records: 1,
  },
  {
    id: "constant value",
    before: pet('message Booking { string ref = 4 [(buf.validate.field).string.const = "fixed"]; }', validate),
    after: pet('message Booking { string ref = 4 [(buf.validate.field).string.const = "fixed2"]; }', validate),
    description:
      '[Replaced] constant value of field `ref` (4) in message `shop.v1.Booking` from `"fixed"` to `"fixed2"`',
    records: 1,
  },
  {
    id: "multiple-of",
    before: pet("message Search { int32 page_size = 4; }"),
    after: pet("message Search {\n  // @MultipleOf 10\n  int32 page_size = 4;\n}"),
    description: "[Added] multiple-of constraint `10` to field `page_size` (4) in message `shop.v1.Search`",
    records: 1,
  },
  {
    id: "input-only",
    before: pet("message Search { string token = 8; }", behavior),
    after: pet("message Search { string token = 8 [(google.api.field_behavior) = INPUT_ONLY]; }", behavior),
    description: "[Added] input-only behavior to field `token` (8) in message `shop.v1.Search`",
    records: 1,
  },
  {
    id: "immutable",
    before: pet("message Book { string isbn = 5; }", behavior),
    after: pet("message Book { string isbn = 5 [(google.api.field_behavior) = IMMUTABLE]; }", behavior),
    description: "[Added] immutable behavior to field `isbn` (5) in message `shop.v1.Book`",
    records: 1,
  },
  {
    id: "example",
    before: pet("message Pet { string id = 1; }\nmessage Booking { Pet pet = 1; }"),
    after: pet('message Pet { string id = 1; }\nmessage Booking {\n  // @Example {"id":1}\n  Pet pet = 1;\n}'),
    description: "[Added] example `{ id: 1 }` to field `pet` (1) in message `shop.v1.Booking`",
    records: 1,
  },
  {
    id: "annotation conflict",
    before: pet(
      "message Coupon {\n  // @Format email\n  string contact = 2 [(buf.validate.field).string.uuid = true];\n}",
      validate,
    ),
    after: pet(
      "message Coupon {\n  // @Format uri\n  string contact = 2 [(buf.validate.field).string.uuid = true];\n}",
      validate,
    ),
    description:
      "[Replaced] annotation conflict of field `contact` (2) in message `shop.v1.Coupon` from `email` dropped to `uri` dropped (format `uuid` kept)",
    records: 1,
  },
  // enum / value
  {
    id: "value alias removed",
    before: pp("enum E { option allow_alias = true; Z = 0; A = 1; B = 1; }"),
    after: pp("enum E { option allow_alias = true; Z = 0; A = 1; }"),
    description: "[Removed] value alias `B` (1) from enum `p.E`",
    records: 1,
  },
  {
    id: "value removed",
    before: pet("enum Status { STATUS_UNSPECIFIED = 0; SOLD = 2; }"),
    after: pet("enum Status { STATUS_UNSPECIFIED = 0; }"),
    description: "[Removed] value `SOLD` (2) from enum `shop.v1.Status` without reserving the number",
    records: 1,
  },
  {
    id: "enum type closed → open",
    before: pp("enum Color { option features.enum_type = CLOSED; C0 = 0; }", 'edition = "2023";'),
    after: pp("enum Color { C0 = 0; }", 'edition = "2023";'),
    description: "[Replaced] enum type of enum `p.Color` from `closed` to `open`",
  },
  {
    id: "L-3 language feature",
    before: pp("enum Color { C0 = 0; }", 'edition = "2023";', `import "google/protobuf/go_features.proto";`),
    after: pp(
      "enum Color { option features.(pb.go).legacy_unmarshal_json_enum = true; C0 = 0; }",
      'edition = "2023";',
      `import "google/protobuf/go_features.proto";`,
    ),
    description: "[Added] option `features.(pb.go).legacy_unmarshal_json_enum = true` to enum `p.Color`",
    records: 1,
  },
  // extension
  {
    id: "extension removed",
    before: legacy(
      "message Order { optional int32 id = 1; extensions 100 to 199; }\nextend Order { optional int32 priority = 100; }",
    ),
    after: legacy("message Order { optional int32 id = 1; extensions 100 to 199; }"),
    description:
      "[Removed] extension `shop.legacy.priority` (100) of message `shop.legacy.Order` from file `legacy.proto`",
    records: 1,
  },
  {
    id: "extended message",
    before: aa(
      "message M { extensions 100 to 199; }\nmessage N { extensions 100 to 199; }\nextend M { optional int32 x = 100; }",
    ),
    after: aa(
      "message M { extensions 100 to 199; }\nmessage N { extensions 100 to 199; }\nextend N { optional int32 x = 100; }",
    ),
    description: "[Replaced] extended message of extension `a.x` (100) from `a.M` to `a.N`",
    records: 1,
  },
  {
    id: "extension number",
    before: aa("message M { extensions 100 to 199; }\nextend M { optional int32 x = 100; }"),
    after: aa("message M { extensions 100 to 199; }\nextend M { optional int32 x = 101; }"),
    description: "[Replaced] field number of extension `a.x` (100) of message `a.M` from `100` to `101`",
    records: 1,
  },
  // options
  {
    id: "L-2 jstype added",
    before: pp("message M { int64 big = 2; }"),
    after: pp("message M { int64 big = 2 [jstype = JS_STRING]; }"),
    description: "[Added] option `jstype = JS_STRING` to field `big` (2) in message `p.M`",
    records: 1,
  },
  {
    id: "L-2 ctype replaced",
    before: pp("message M { string s = 1 [ctype = CORD]; }", 'syntax = "proto2";'.replace("proto2", "proto3")),
    after: pp("message M { string s = 1 [ctype = CORD]; }"),
    edit: ({ after }) => {
      after.components.messages["p.M"].properties.s.options.ctype = "STRING"
    },
    description: "[Replaced] option `ctype` of field `s` (1) in message `p.M` from `CORD` to `STRING`",
    records: 1,
  },
  {
    id: "custom option added",
    before: { ...pet("message Pet { int64 id = 1; }", `import "acme/opts.proto";`), ...acmeOpts },
    after: { ...pet("message Pet { int64 id = 1 [(acme.audit) = true]; }", `import "acme/opts.proto";`), ...acmeOpts },
    description: "[Added] option `(acme.audit) = true` to field `id` (1) in message `shop.v1.Pet`",
    records: 1,
  },
  {
    id: "L-4 default_host",
    before: service(
      'option (google.api.default_host) = "pets.example.com";\nrpc GetPet(GetPetRequest) returns (Pet);',
      client,
    ),
    after: service(
      'option (google.api.default_host) = "pets.example.org";\nrpc GetPet(GetPetRequest) returns (Pet);',
      client,
    ),
    description:
      '[Replaced] option `(google.api.default_host)` of service `shop.v1.PetService` from `"pets.example.com"` to `"pets.example.org"`',
    records: 1,
  },
  {
    id: "L-4 method_signature (one value)",
    before: service(
      'rpc GetPet(GetPetRequest) returns (Pet) { option (google.api.method_signature) = "name"; }',
      client,
    ),
    after: service(
      'rpc GetPet(GetPetRequest) returns (Pet) { option (google.api.method_signature) = "name,view"; }',
      client,
    ),
    description:
      '[Replaced] option `(google.api.method_signature)` of rpc `GetPet` in service `shop.v1.PetService` from `["name"]` to `["name,view"]`',
    records: 1,
  },
  {
    id: "remainder option (CEL)",
    before: pet(
      'message Pet { int64 id = 1 [(buf.validate.field).cel = { id: "a", expression: "this > 0" }]; }',
      validate,
    ),
    after: pet(
      'message Pet { int64 id = 1 [(buf.validate.field).cel = { id: "a", expression: "this > 1" }]; }',
      validate,
    ),
    description:
      '[Replaced] option `(buf.validate.field).cel` of field `id` (1) in message `shop.v1.Pet` from `[{ id: "a", expression: "this > 0" }]` to `[{ id: "a", expression: "this > 1" }]`',
    records: 1,
  },
  // free text
  {
    id: "free text",
    before: pet("message Pet {\n  // Unique id.\n  int64 id = 1;\n}"),
    after: pet("message Pet {\n  // Unique identifier.\n  int64 id = 1;\n}"),
    description:
      "[Replaced] description of field `id` (1) in message `shop.v1.Pet` from `Unique id.` to `Unique identifier.`",
    records: 1,
  },
  {
    id: "free text shortened (POLICY-95)",
    before: pet("message Pet {\n  // Short.\n  int64 id = 1;\n}"),
    after: pet(
      "message Pet {\n  // A very long description of the identifier that goes on and on well beyond sixty characters.\n  int64 id = 1;\n}",
    ),
    description:
      "[Replaced] description of field `id` (1) in message `shop.v1.Pet` from `Short.` to `A very long description of the identifier that goes on and…`",
    records: 1,
  },
]

const docsOf = (item: Template) => {
  const docs = protoDocs(item.before, item.after)
  if (!item.edit) {
    return docs
  }
  const edited = { before: structuredClone(docs.before) as Doc, after: structuredClone(docs.after) as Doc }
  item.edit(edited)
  return edited
}

describe("Block J12 — further templates of §7.2", () => {
  for (const item of templates) {
    it(`J12.T ${item.id}: ${item.description}`, () => {
      const { before, after } = docsOf(item)
      const { diffs } = protoCompare(before, after, item.options)
      expect(diffs.map((diff) => diff.description)).toContain(item.description)
      if (item.records !== undefined) {
        expect(diffs.map((diff) => diff.description)).toHaveLength(item.records)
      }
    })
  }
})

describe("Block J12 — merged records, labels, containers and values", () => {
  it("J12.M1 A4 inherited feature, one action: the positions name the target, the file names the cause", () => {
    const body = "message M { string a = 1; map<string, string> labels = 6; }\nmessage O { string b = 1; }\n"
    const { diffs } = protoDiffs(
      { "p.proto": `edition = "2023";\npackage p;\n${body}` },
      { "p.proto": `edition = "2023";\npackage p;\noption features.utf8_validation = NONE;\n${body}` },
    )
    expect(diffs.map((diff) => diff.description)).toContain(
      "[Removed] UTF-8 validation from map keys and map values of field `labels` (6) in message `p.M` (inherited from option `features.utf8_validation` of file `p.proto`)",
    )
  })

  it("J12.M2 A4 syntax change, mixed actions: resolved features with their effects and the cause", () => {
    const { diffs } = protoDiffs(
      { "p.proto": 'syntax = "proto2";\npackage p;\nmessage M { optional string s = 1; }\n' },
      { "p.proto": 'syntax = "proto3";\npackage p;\nmessage M { string s = 1; }\n' },
    )
    expect(diffs.map((diff) => diff.description)).toContain(
      "[Replaced] resolved features of field `s` (1) in message `p.M`: explicit presence removed, UTF-8 validation added (syntax of file `p.proto` changed)",
    )
    // the cause keeps its own record at the file (§4.9)
    expect(diffs.map((diff) => diff.description)).toContain(
      '[Replaced] syntax of file `p.proto` from `syntax = "proto2"` to `syntax = "proto3"`',
    )
  })

  it("J12.M3 A4 one action, several keywords: joined with `and`", () => {
    const { diffs } = protoDiffs(
      { "p.proto": 'syntax = "proto2";\npackage p;\nenum E { A = 1; }\n' },
      { "p.proto": 'syntax = "proto3";\npackage p;\nenum E { A0 = 0; A = 1; }\n' },
    )
    expect(diffs.map((diff) => diff.description)).toContain(
      "[Replaced] resolved features of enum `p.E`: enum type changed from `closed` to `open`, JSON format changed from `LEGACY_BEST_EFFORT` to `ALLOW` (syntax of file `p.proto` changed)",
    )
  })

  it("J12.M4 the shape fold (PD-16, PD-27): inner positions named after the term, in walk order", () => {
    const validate = `import "buf/validate/validate.proto";`
    const { diffs } = protoDiffs(
      `syntax = "proto3";\npackage p;\n${validate}\nmessage M { repeated string tags = 1 [(buf.validate.field).repeated = { min_items: 1, items: { string: { min_len: 2 } } }]; }\n`,
      `syntax = "proto3";\npackage p;\n${validate}\nmessage M { repeated int32 tags = 1 [(buf.validate.field).repeated = { min_items: 1, items: { int32: { gt: 0 } } }]; }\n`,
    )
    expect(diffs.map((diff) => diff.description)).toEqual([
      "[Replaced] type of field `tags` (1) in message `p.M` from `repeated string` to `repeated int32` (minimum length of elements `2` removed, minimum value of elements `> 0` added)",
    ])
  })

  it("J12.D1 PD-23: a deprecation record reads [Deprecated]; its action stays add, its type deprecated", () => {
    const { diffs } = protoDiffs(
      'syntax = "proto3";\npackage p;\nmessage M { string s = 1; }\n',
      'syntax = "proto3";\npackage p;\nmessage M { string s = 1 [deprecated = true]; }\n',
    )
    expect(diffs).toMatchObject([
      { action: "add", type: "deprecated", description: "[Deprecated] field `s` (1) in message `p.M`" },
    ])
  })

  it("J12.C1 containers: an element is never named as its own container (weak check, POLICY-90 / 102)", () => {
    const { diffs } = protoDiffs(
      'syntax = "proto3";\npackage p;\nmessage M { string s = 1; oneof o { string a = 2; } }\n',
      'syntax = "proto3";\npackage p;\nmessage M { string s = 1; oneof o { string a = 2; string s2 = 3; } }\n',
    )
    for (const diff of diffs) {
      const names = (diff.description ?? "").match(/`[^`]+`/g) ?? []
      expect(new Set(names).size).toBe(names.length)
    }
    expect(diffs.map((diff) => diff.description)).toEqual(["[Added] field `s2` (3) to message `p.M`"])
  })

  it("J12.C2 nested containers: a value names its enum, a field its message, an rpc its service", () => {
    const { diffs } = protoDiffs(
      'syntax = "proto3";\npackage p;\nmessage M { message N { string a = 1; } }\nenum E { E0 = 0; }\nservice S { rpc Get(M) returns (M); }\n',
      'syntax = "proto3";\npackage p;\nmessage M { message N { string a = 1; string b = 2; } }\nenum E { E0 = 0; E1 = 1; }\nservice S { rpc Get(M) returns (M); rpc List(M) returns (M); }\n',
    )
    expect(diffs.map((diff) => diff.description).sort((a, b) => String(a).localeCompare(String(b)))).toEqual([
      "[Added] field `b` (2) to message `p.M.N`",
      "[Added] rpc `List` to service `p.S`",
      "[Added] value `E1` (1) to enum `p.E`",
    ])
  })

  it("J12.V1 POLICY-119: validator values are listed; POLICY-108: long values are capped", () => {
    const long = "x".repeat(250)
    const { diffs } = protoDiffs(
      'syntax = "proto3";\npackage p;\nmessage M {\n  // @Enum a, b, c\n  string s = 1;\n}\n',
      `syntax = "proto3";\npackage p;\nmessage M {\n  // @Pattern ${long}\n  string s = 1;\n}\n`,
    )
    expect(diffs.map((diff) => diff.description)).toEqual([
      '[Removed] allowed values `"a"`, `"b"`, `"c"` from field `s` (1) in message `p.M`',
      `[Added] pattern \`${"x".repeat(200)}…\` to field \`s\` (1) in message \`p.M\``,
    ])
  })

  it("J12.A1 a custom annotateHook replaces the descriptions; merged records keep its text", () => {
    const { diffs } = protoDiffs(
      'syntax = "proto3";\npackage p;\nmessage M { string s = 1; }\n',
      'syntax = "proto3";\npackage p;\nmessage M { string s = 2; }\n',
      { annotateHook: (diff) => `custom ${diff.action}` },
    )
    expect(diffs.map((diff) => String(diff.description)).sort((a, b) => a.localeCompare(b))).toEqual([
      "custom add",
      "custom remove",
    ])
  })
})
