import type { ProtoInput } from "../../helpers"

// The description catalogue W-01 … W-39 of PROTOAPI_DESIGN §7.2 (R-D, approved target wordings, normative): each entry
// is the only difference between two otherwise identical files (`shop/pet.proto` with `package shop.v1;` unless the
// entry says otherwise; `p.proto` with `package p;` for `p.M` and `p.User`). J12 asserts each description verbatim
// and its FILE class (a message no rpc uses reads as used both ways, so `x/y` cells give the more severe); J15 asserts
// one record at the owning element for each pair.

export type CatalogueCase = {
  id: string
  // matrix row and the FILE cell of §7.2 (`B/N` = request / response)
  row: string
  cell: string
  // the class of the record in the fixture (the more severe of `x/y` for messages used both ways)
  type: "breaking" | "risky" | "non-breaking" | "deprecated" | "annotation" | "unclassified"
  before: ProtoInput
  after: ProtoInput
  description: string
  // the element of the record (`elementOf`), for J15
  element: string
}

const shop = (body: string, imports = "") => ({
  "shop/pet.proto": `syntax = "proto3";\npackage shop.v1;\n${imports}\n${body}\n`,
})
const shop2 = (body: string, imports = "") => ({
  "shop/pet.proto": `syntax = "proto2";\npackage shop.v1;\n${imports}\n${body}\n`,
})
const p3 = (body: string, imports = "") => ({ "p.proto": `syntax = "proto3";\npackage p;\n${imports}\n${body}\n` })
const p2 = (body: string) => ({ "p.proto": `syntax = "proto2";\npackage p;\n${body}\n` })

const common = { "common.proto": `syntax = "proto3";\npackage common;\nmessage C {}\n` }
const validate = `import "buf/validate/validate.proto";`
const behavior = `import "google/api/field_behavior.proto";`
const annotations = `import "google/api/annotations.proto";`
const timestamp = `import "google/protobuf/timestamp.proto";`
const acme = {
  "acme/opts.proto": `syntax = "proto3";
package acme;
import "google/protobuf/descriptor.proto";
message Table { int32 shard = 1; }
extend google.protobuf.FieldOptions { bool audit = 50000; }
extend google.protobuf.MessageOptions { Table table = 50002; }
`,
}
const withAcme = (body: string) => ({ ...shop(body, `import "acme/opts.proto";`), ...acme })

const petService = (rpc: string, extra = "") => `message GetPetRequest { string id = 1; }
message ListPetsRequest { int32 page_size = 1; }
message ListPetsResponse { repeated Pet pets = 1; }
message Pet { string name = 1; }
${extra}
service PetService { ${rpc} }`

const rpcPath = (name: string) => `#/services/shop.v1.PetService/methods/${name}`
const field = (message: string, name: string) => `#/components/messages/${message}/properties/${name}`

export const catalogueCases: CatalogueCase[] = [
  {
    id: "W-01",
    row: "P-4",
    cell: "R",
    type: "risky",
    before: { "shop/pet.proto": `syntax = "proto3";\npackage shop.v1;\nmessage Pet {}\n` },
    after: { "shop/pet.proto": `edition = "2023";\npackage shop.v1;\nmessage Pet {}\n` },
    description: '[Replaced] syntax of file `shop/pet.proto` from `syntax = "proto3"` to `edition = "2023"`',
    element: "#/files/shop~1pet.proto",
  },
  {
    id: "W-02",
    row: "P-8",
    cell: "N",
    type: "non-breaking",
    before: { ...shop("message Pet {}", `import "common.proto";`), ...common },
    after: { ...shop("message Pet {}", `import public "common.proto";`), ...common },
    description: "[Added] public modifier to import `common.proto` in file `shop/pet.proto`",
    element: "#/files/shop~1pet.proto",
  },
  {
    id: "W-03",
    row: "L-1",
    cell: "R",
    type: "risky",
    before: shop("message Pet {}", `option go_package = "example.com/shop/v1";`),
    after: shop("message Pet {}", `option go_package = "example.com/shop/v1;shopv1";`),
    description:
      '[Replaced] option `go_package` of file `shop/pet.proto` from `"example.com/shop/v1"` to `"example.com/shop/v1;shopv1"`',
    element: "#/files/shop~1pet.proto",
  },
  {
    id: "W-04",
    row: "P-5",
    cell: "B",
    type: "breaking",
    before: { "shop/pet.proto": `syntax = "proto3";\npackage shop.v1;\nmessage Pet { string name = 1; }\n` },
    after: { "shop/pet.proto": `syntax = "proto3";\npackage shop.v2;\nmessage Pet { string name = 1; }\n` },
    description: "[Replaced] package of file `shop/pet.proto` from `shop.v1` to `shop.v2`",
    element: "#/files/shop~1pet.proto",
  },
  {
    id: "W-05",
    row: "R-6",
    cell: "B",
    type: "breaking",
    before: shop(petService("rpc ListPets(ListPetsRequest) returns (ListPetsResponse);")),
    after: shop(petService("rpc ListPets(ListPetsRequest) returns (stream Pet);")),
    description:
      "[Replaced] response type of rpc `ListPets` in service `shop.v1.PetService` from `shop.v1.ListPetsResponse` to `stream shop.v1.Pet`",
    element: rpcPath("ListPets"),
  },
  {
    id: "W-06",
    row: "R-8",
    cell: "R",
    type: "risky",
    before: shop(petService("rpc GetPet(GetPetRequest) returns (Pet) { option idempotency_level = NO_SIDE_EFFECTS; }")),
    after: shop(petService("rpc GetPet(GetPetRequest) returns (Pet);")),
    description: "[Removed] idempotency level `NO_SIDE_EFFECTS` from rpc `GetPet` in service `shop.v1.PetService`",
    element: rpcPath("GetPet"),
  },
  {
    id: "W-07",
    row: "R-11",
    cell: "B",
    type: "breaking",
    before: shop(
      petService(`rpc GetPet(GetPetRequest) returns (Pet) { option (google.api.http) = { get: "/v1/pets/{id}" }; }`),
      annotations,
    ),
    after: shop(
      petService(
        `rpc GetPet(GetPetRequest) returns (Pet) { option (google.api.http) = { post: "/v1/pets/{id}:get" body: "*" }; }`,
      ),
      annotations,
    ),
    description:
      "[Replaced] HTTP binding of rpc `GetPet` in service `shop.v1.PetService` from `GET /v1/pets/{id}` to `POST /v1/pets/{id}:get` (body `*`)",
    element: rpcPath("GetPet"),
  },
  {
    id: "W-08",
    row: "R-18",
    cell: "D",
    type: "deprecated",
    before: shop(petService("rpc GetPet(GetPetRequest) returns (Pet);")),
    after: shop(
      petService(
        "\n  // Deprecated: use GetPetV2\n  rpc GetPet(GetPetRequest) returns (Pet) { option deprecated = true; }\n",
      ),
    ),
    description: "[Deprecated] rpc `GetPet` in service `shop.v1.PetService` (reason: use GetPetV2)",
    element: rpcPath("GetPet"),
  },
  {
    id: "W-09",
    row: "M-10",
    cell: "R",
    type: "risky",
    before: shop("message Pet { reserved 8; string name = 1; }"),
    after: shop("message Pet { string name = 1; }"),
    description: "[Removed] reserved number `8` from message `shop.v1.Pet`",
    element: "#/components/messages/shop.v1.Pet",
  },
  {
    id: "W-10",
    row: "M-15",
    cell: "R",
    type: "risky",
    before: shop2("message Pet { optional string name = 1; extensions 150 to 199; }"),
    after: shop2("message Pet { optional string name = 1; }"),
    description: "[Removed] extension range `150 to 199` from message `shop.v1.Pet`",
    // an extension range is an element of its own (R-1, `elementOf`)
    element: "#/components/messages/shop.v1.Pet/extensions/0",
  },
  {
    id: "W-11",
    row: "M-2",
    cell: "R",
    type: "risky",
    before: shop("message Pet { string name = 1; }\nmessage Legacy { string id = 1; }"),
    after: shop("message Pet { string name = 1; }"),
    description: "[Removed] message `shop.v1.Legacy` from file `shop/pet.proto`",
    element: "#/components/messages/shop.v1.Legacy",
  },
  {
    id: "W-12",
    row: "F-47",
    cell: "B/B",
    type: "breaking",
    before: shop(
      "message CreatePetRequest { string name = 1 [(google.api.field_behavior) = REQUIRED]; string tag = 2; }",
      behavior,
    ),
    after: shop("message CreatePetRequest { string tag = 2; }", behavior),
    description:
      "[Removed] required field `name` (1) from message `shop.v1.CreatePetRequest` without reserving the number",
    element: field("shop.v1.CreatePetRequest", "name"),
  },
  {
    id: "W-13",
    row: "F-23",
    cell: "R",
    type: "risky",
    before: shop("message Pet { string nickname = 3; }"),
    after: shop("message Pet { optional string nickname = 3; }"),
    description: "[Added] explicit presence to field `nickname` (3) in message `shop.v1.Pet` (`optional`)",
    element: field("shop.v1.Pet", "nickname"),
  },
  {
    id: "W-14",
    row: "F-18",
    cell: "B",
    type: "breaking",
    before: shop("message Pet { string tag = 4; }"),
    after: shop("message Pet { repeated string tag = 4; }"),
    description: "[Replaced] type of field `tag` (4) in message `shop.v1.Pet` from `string` to `repeated string`",
    element: field("shop.v1.Pet", "tag"),
  },
  {
    id: "W-15",
    row: "F-21 → F-12",
    cell: "B",
    type: "breaking",
    before: shop("message Pet { map<string, int32> counts = 5; }"),
    after: shop("message Pet { map<string, int64> counts = 5; }"),
    description:
      "[Replaced] type of field `counts` (5) in message `shop.v1.Pet` from `map<string, int32>` to `map<string, int64>`",
    element: field("shop.v1.Pet", "counts"),
  },
  {
    id: "W-16",
    row: "F-12, S4",
    cell: "B",
    type: "breaking",
    before: shop("message Order { int32 qty = 3 [(buf.validate.field).int32.gt = 0]; }", validate),
    after: shop("message Order { int64 qty = 3 [(buf.validate.field).int64.gt = 0]; }", validate),
    description: "[Replaced] type of field `qty` (3) in message `shop.v1.Order` from `int32` to `int64`",
    element: field("shop.v1.Order", "qty"),
  },
  {
    id: "W-17",
    row: "F-32",
    cell: "B",
    type: "breaking",
    before: shop2("message Order { optional int32 qty = 3 [default = 1]; }"),
    after: shop2("message Order { optional int32 qty = 3 [default = 2]; }"),
    description: "[Replaced] default value of field `qty` (3) in message `shop.v1.Order` from `1` to `2`",
    element: field("shop.v1.Order", "qty"),
  },
  {
    id: "W-18",
    row: "F-32",
    cell: "B",
    type: "breaking",
    before: p2(String.raw`message M { optional bytes magic = 6 [default = "\x00\x01"]; }`),
    after: p2(String.raw`message M { optional bytes magic = 6 [default = "\x00\x02"]; }`),
    description: '[Replaced] default value of field `magic` (6) in message `p.M` from `"\\x00\\x01"` to `"\\x00\\x02"`',
    element: field("p.M", "magic"),
  },
  {
    id: "W-19",
    row: "F-30",
    cell: "B",
    type: "breaking",
    before: shop(`message Owner { string email = 2 [json_name = "mail"]; }`),
    after: shop(`message Owner { string email = 2 [json_name = "emailAddress"]; }`),
    description: "[Replaced] JSON name of field `email` (2) in message `shop.v1.Owner` from `mail` to `emailAddress`",
    element: field("shop.v1.Owner", "email"),
  },
  {
    id: "W-20",
    row: "F-9",
    cell: "R",
    type: "risky",
    before: p3("message User { string user_id = 1; }"),
    after: p3(`message User { string account_id = 1 [json_name = "userId"]; }`),
    description: "[Renamed] field `user_id` (1) to `account_id` in message `p.User`, JSON name `userId` kept",
    element: field("p.User", "user_id"),
  },
  {
    id: "W-21",
    row: "F-25",
    cell: "B",
    type: "breaking",
    before: shop("message Contact { string email = 1; oneof channel { string phone = 2; } }"),
    after: shop("message Contact { oneof channel { string email = 1; string phone = 2; } }"),
    description: "[Added] field `email` (1) in message `shop.v1.Contact` to oneof `channel`",
    element: field("shop.v1.Contact", "email"),
  },
  {
    id: "W-22",
    row: "M-7",
    cell: "R",
    type: "risky",
    before: shop("message Contact { oneof contact { string email = 1; string phone = 2; } }"),
    after: shop("message Contact { oneof channel { string email = 1; string phone = 2; } }"),
    description: "[Renamed] oneof `contact` to `channel` in message `shop.v1.Contact`",
    element: "#/components/messages/shop.v1.Contact/oneofs/contact",
  },
  {
    id: "W-23",
    row: "F-45",
    cell: "D",
    type: "deprecated",
    before: shop("message Pet {\n  string note = 2;\n}"),
    after: shop("message Pet {\n  // Deprecated: use notes\n  string note = 2 [deprecated = true];\n}"),
    description: "[Deprecated] field `note` (2) in message `shop.v1.Pet` (reason: use notes)",
    element: field("shop.v1.Pet", "note"),
  },
  {
    id: "W-24",
    row: "K-5",
    cell: "B/N",
    type: "breaking",
    before: shop("message Pet { string name = 2 [(buf.validate.field).string.max_len = 50]; }", validate),
    after: shop("message Pet { string name = 2 [(buf.validate.field).string.max_len = 30]; }", validate),
    description: "[Replaced] maximum length of field `name` (2) in message `shop.v1.Pet` from `50` to `30`",
    element: field("shop.v1.Pet", "name"),
  },
  {
    id: "W-25",
    row: "K-1",
    cell: "N/R",
    type: "risky",
    before: shop("message Order { int32 qty = 3 [(buf.validate.field).int32.gt = 0]; }", validate),
    after: shop("message Order { int32 qty = 3 [(buf.validate.field).int32.gte = 0]; }", validate),
    description: "[Replaced] minimum value of field `qty` (3) in message `shop.v1.Order` from `> 0` to `>= 0`",
    element: field("shop.v1.Order", "qty"),
  },
  {
    id: "W-26",
    row: "K-1",
    cell: "B/N",
    type: "breaking",
    before: p3("message M { int64 big = 6; }", validate),
    after: p3("message M { int64 big = 6 [(buf.validate.field).int64.gte = 9007199254740993]; }", validate),
    description: "[Added] minimum value `>= 9007199254740993` to field `big` (6) in message `p.M`",
    element: field("p.M", "big"),
  },
  {
    id: "W-27",
    row: "K-14",
    cell: "B/N",
    type: "breaking",
    before: shop("message CreatePetRequest { string name = 2; }", validate),
    after: shop("message CreatePetRequest { string name = 2 [(buf.validate.field).required = true]; }", validate),
    description: "[Added] required constraint to field `name` (2) in message `shop.v1.CreatePetRequest`",
    element: field("shop.v1.CreatePetRequest", "name"),
  },
  {
    id: "W-28",
    row: "K-10",
    cell: "B/N",
    type: "breaking",
    before: shop("message Owner { string email = 3; }", validate),
    after: shop("message Owner { string email = 3 [(buf.validate.field).string.email = true]; }", validate),
    description: "[Added] format `email` to field `email` (3) in message `shop.v1.Owner`",
    element: field("shop.v1.Owner", "email"),
  },
  {
    id: "W-29",
    row: "K-7",
    cell: "B/N",
    type: "breaking",
    before: shop("message Pet { repeated string tags = 4; }", validate),
    after: shop("message Pet { repeated string tags = 4 [(buf.validate.field).repeated.max_items = 10]; }", validate),
    description: "[Added] maximum item count `10` to field `tags` (4) in message `shop.v1.Pet`",
    element: field("shop.v1.Pet", "tags"),
  },
  {
    id: "W-30",
    row: "K-15",
    cell: "B/N",
    type: "breaking",
    before: shop("message Pet { google.protobuf.Timestamp created_at = 12; }", `${timestamp}\n${behavior}`),
    after: shop(
      "message Pet { google.protobuf.Timestamp created_at = 12 [(google.api.field_behavior) = OUTPUT_ONLY]; }",
      `${timestamp}\n${behavior}`,
    ),
    description: "[Added] output-only behavior to field `created_at` (12) in message `shop.v1.Pet`",
    element: field("shop.v1.Pet", "created_at"),
  },
  {
    id: "W-31",
    row: "K-18",
    cell: "A",
    type: "annotation",
    before: shop("message ListPetsRequest {\n  // @Default 10\n  int32 page_size = 1;\n}"),
    after: shop("message ListPetsRequest {\n  // @Default 20\n  int32 page_size = 1;\n}"),
    description:
      "[Replaced] documented default of field `page_size` (1) in message `shop.v1.ListPetsRequest` from `10` to `20`",
    element: field("shop.v1.ListPetsRequest", "page_size"),
  },
  {
    id: "W-32",
    row: "V-1",
    cell: "N/R",
    type: "risky",
    before: shop("enum Status { STATUS_UNSPECIFIED = 0; AVAILABLE = 1; }"),
    after: shop("enum Status { STATUS_UNSPECIFIED = 0; AVAILABLE = 1; SOLD = 2; }"),
    description: "[Added] value `SOLD` (2) to enum `shop.v1.Status`",
    element: "#/components/enums/shop.v1.Status/values/SOLD",
  },
  {
    id: "W-33",
    row: "V-8",
    cell: "B",
    type: "breaking",
    before: shop("enum Status { STATUS_UNSPECIFIED = 0; SOLD = 2; }"),
    after: shop("enum Status { STATUS_UNSPECIFIED = 0; SOLD_OUT = 2; }"),
    description: "[Renamed] value `SOLD` (2) to `SOLD_OUT` in enum `shop.v1.Status`",
    element: "#/components/enums/shop.v1.Status/values/SOLD",
  },
  {
    id: "W-34",
    row: "E-4",
    cell: "R",
    type: "risky",
    before: {
      "shop/pet.proto": `edition = "2023";\npackage shop.v1;\nenum Color { COLOR_UNSPECIFIED = 0; RED = 1; }\n`,
    },
    after: {
      "shop/pet.proto": `edition = "2023";\npackage shop.v1;\nenum Color { option features.enum_type = CLOSED; COLOR_UNSPECIFIED = 0; RED = 1; }\n`,
    },
    description: "[Replaced] enum type of enum `shop.v1.Color` from `open` to `closed`",
    element: "#/components/enums/shop.v1.Color",
  },
  {
    id: "W-35",
    row: "X-6",
    cell: "B",
    type: "breaking",
    before: {
      "acme/opts.proto": `syntax = "proto3";\npackage acme;\nimport "google/protobuf/descriptor.proto";\nextend google.protobuf.FieldOptions { string label = 50001; }\n`,
    },
    after: {
      "acme/opts.proto": `syntax = "proto3";\npackage acme;\nimport "google/protobuf/descriptor.proto";\nextend google.protobuf.FieldOptions { string display_label = 50001; }\n`,
    },
    description:
      "[Renamed] extension `acme.label` (50001) of message `google.protobuf.FieldOptions` to `acme.display_label`",
    element: "#/components/extensions/acme.label",
  },
  {
    id: "W-36",
    row: "F-44",
    cell: "U",
    type: "unclassified",
    before: withAcme("message Pet { int64 id = 1 [(acme.audit) = true]; }"),
    after: withAcme("message Pet { int64 id = 1 [(acme.audit) = false]; }"),
    description: "[Replaced] option `(acme.audit)` of field `id` (1) in message `shop.v1.Pet` from `true` to `false`",
    element: field("shop.v1.Pet", "id"),
  },
  {
    id: "W-37",
    row: "M-27",
    cell: "U",
    type: "unclassified",
    before: withAcme("message Pet { option (acme.table) = { shard: 4 }; string name = 1; }"),
    after: withAcme("message Pet { option (acme.table) = { shard: 8 }; string name = 1; }"),
    description: "[Replaced] option `(acme.table).shard` of message `shop.v1.Pet` from `4` to `8`",
    element: "#/components/messages/shop.v1.Pet",
  },
  {
    id: "W-38",
    row: "R-18",
    cell: "A",
    type: "annotation",
    before: shop(petService("\n  // Lists pets.\n  rpc ListPets(ListPetsRequest) returns (stream Pet);\n")),
    after: shop(petService("\n  // Lists all pets.\n  rpc ListPets(ListPetsRequest) returns (stream Pet);\n")),
    description:
      "[Replaced] description of rpc `ListPets` in service `shop.v1.PetService` from `Lists pets.` to `Lists all pets.`",
    element: rpcPath("ListPets"),
  },
  {
    id: "W-39",
    row: "F-14, PD-16",
    cell: "B",
    type: "breaking",
    before: shop("message Order { int32 qty = 3 [(buf.validate.field).int32.gt = 0]; }", validate),
    after: shop("message Order { string qty = 3 [(buf.validate.field).string.min_len = 1]; }", validate),
    description:
      "[Replaced] type of field `qty` (3) in message `shop.v1.Order` from `int32` to `string` (minimum value `> 0` removed, minimum length `1` added)",
    element: field("shop.v1.Order", "qty"),
  },
]
