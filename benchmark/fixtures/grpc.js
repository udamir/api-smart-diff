"use strict"
// gRPC / Protocol Buffers fixtures (type `grpc`, family `protoapi`). Every fixture is a pair of `.proto` source trees;
// scripts/fixtures.js writes them to fixtures/cache/<name>/{before,after}.proto.d/ (with a buf.yaml and the bundled
// imports buf needs, for buf breaking) and the ProtoApi documents built from them with the published protoapi
// (`imports: "user"`) to {before,after}.protoapi.json.
//
// - grpc-shop: a hand-written order service (5 rpcs, 9 messages, an enum, protovalidate rules) with 17 scripted
//   changes; the expected class of every change is given per compatibility level (FILE, PACKAGE, WIRE_JSON, WIRE),
//   `row` states the rule behind it
// - grpc-shop-identical: its before tree compared with itself
// - grpc-poc-170 / -1700 / -10200: a synthetic generator (170 / 1,700 / 10,200 messages, about 140 KB / 1.4 MB /
//   8.6 MB) with field rules, 1 % of the messages edited (7 changes each); the same generator as
//   test/helpers/proto-corpus.ts of the repository (its performance tests)
//
// Direction semantics: request messages are written by clients (narrowing breaks them), response messages are read by
// clients (removing or retyping breaks them; additions are non-breaking for tolerant readers).
// `class` of an expected change: one class, or { FILE, PACKAGE, WIRE_JSON, WIRE } per level; the asd rows and the buf
// rows of each level are scored against that level's class (scripts/quality.js).

const LEVELS = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]
const per = (file, pkg, json, wire) => ({ FILE: file, PACKAGE: pkg, WIRE_JSON: json, WIRE: wire })
const B = "breaking"
const R = "risky"
const N = "non-breaking"
const D = "deprecated"
const A = "annotation"

// ---------------------------------------------------------------- grpc-shop
const shop = (after) => {
  const x = (a, b) => (after ? a : b)
  return `syntax = "proto3";

package shop.v1;

import "google/protobuf/timestamp.proto";
import "buf/validate/validate.proto";

option go_package = "${x("example.com/shop/v2;shopv1", "example.com/shop/v1;shopv1")}";

// Order service of the shop.
service OrderService {
  // Creates an order.
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  // ${x("Returns one order by its id.", "Gets an order.")}
  rpc GetOrder(GetOrderRequest) returns (Order);
  // Lists orders.
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse);
  // Watches order events.
  rpc WatchOrders(WatchOrdersRequest) returns (${x("", "stream ")}OrderEvent);
${x(
  `  // Refunds an order.
  rpc RefundOrder(RefundOrderRequest) returns (Order);
`,
  `  // Cancels an order.
  rpc CancelOrder(CancelOrderRequest) returns (Order);
`,
)}}

// Lifecycle of an order.
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_PAID = 2;
  ORDER_STATUS_SHIPPED = 3;
${x("  ORDER_STATUS_REFUNDED = 5;\n", "  ORDER_STATUS_LEGACY = 4;\n")}}

// An amount of money.
message Money {
  string currency_code = 1;
  int64 units = 2;
  int32 nanos = 3${x(' [json_name = "nano"]', "")};
}

// One position of an order.
message LineItem {
  string sku = 1 [(buf.validate.field).string.min_len = ${x(3, 1)}];
  int32 quantity = 2 [(buf.validate.field).int32.gt = 0];
  Money price = 3;
}

// An order.
message Order {
  string order_id = 1;
  string ${x("buyer_id", "customer_id")} = 2;
  repeated LineItem items = 3;
  OrderStatus status = 4;
  Money total = 5;
  google.protobuf.Timestamp created_at = 6${x(" [deprecated = true]", "")};
  string note = ${x(9, 7)};
  ${x("int64", "int32")} priority = 8;
${x("  string tracking_number = 10;\n", "")}}

message CreateOrderRequest {
  string customer_id = 1;
  repeated LineItem items = 2;
  string coupon_code = 3;
${x("  string channel = 4;\n", "")}}

message GetOrderRequest {
  string order_id = 1;
}

message ListOrdersRequest {
  int32 page_size = 1${x(" [(buf.validate.field).int32 = { gte: 1, lte: 100 }]", "")};
  string page_token = 2;
}

message ListOrdersResponse {
  repeated Order orders = 1;
${x("", "  string next_page_token = 2;\n")}}

message WatchOrdersRequest {
  string customer_id = 1;
}

message OrderEvent {
  string order_id = 1;
  OrderStatus status = 2;
}

message CancelOrderRequest {
  string order_id = 1;
  string reason = 2;
}
${x(
  `
message RefundOrderRequest {
  string order_id = 1;
}
`,
  "",
)}`
}

// tokens: every entry must occur in a diff's haystack (an array = one of them); api-smart-diff haystacks carry the
// document path and the description, buf's the rule id and its message (lib/cli.js)
const shopExpected = () => [
  { id: "G1", what: "rpc CancelOrder removed", class: B, tokens: ["cancelorder"], not: ["cancelorderrequest"], row: "rpc removed" },
  { id: "G2", what: "rpc RefundOrder added (with its request message)", class: N, tokens: ["refundorder"], row: "rpc and message added" },
  { id: "G3", what: "response field Order.priority int32 -> int64", class: per(B, B, B, R), tokens: ["priority"], row: "int32 and int64 share the varint wire type (WIRE: risky), but ProtoJSON writes int64 as a string" },
  { id: "G4", what: "response field Order.note renumbered 7 -> 9", class: B, tokens: ["note"], row: "renumbered = removed + added" },
  { id: "G5", what: "response field Order.customer_id renamed buyer_id (same number)", class: per(B, B, B, N), tokens: [["buyer_id", "buyerid"]], row: "renamed: the JSON name changes, the wire number does not" },
  { id: "G6", what: "enum value ORDER_STATUS_LEGACY (4) removed, number not reserved", class: B, tokens: [["order_status_legacy", 'enum value "4" on enum "orderstatus"']], row: "removed, number and name not reserved" },
  { id: "G7", what: "enum value ORDER_STATUS_REFUNDED (5) added to an enum read in responses", class: R, tokens: ["order_status_refunded"], row: "added: non-breaking in requests, risky in responses" },
  { id: "G8", what: "request field CreateOrderRequest.channel added", class: N, tokens: ["channel"], row: "field added" },
  { id: "G9", what: "request field ListOrdersRequest.page_size gains protovalidate bounds 1 … 100", class: B, tokens: ["page_size"], row: "protovalidate bounds added in a request" },
  { id: "G10", what: "LineItem.sku min_len 1 -> 3 (LineItem used in a request and a response)", class: B, tokens: ["sku"], row: "min_len raised: breaking in the request use" },
  { id: "G11", what: "rpc WatchOrders no longer server streaming", class: B, tokens: ["watchorders"], row: "server streaming toggled" },
  { id: "G12", what: "field Order.created_at deprecated", class: D, tokens: ["created_at"], row: "deprecation" },
  { id: "G13", what: "comment of rpc GetOrder changed", class: A, tokens: ["getorder"], not: ["getorderrequest"], row: "description" },
  { id: "G14", what: "file option go_package changed", class: per(R, R, A, A), tokens: ["go_package"], row: "language option: affects generated code only" },
  { id: "G15", what: "Money.nanos json_name set to nano", class: per(B, B, B, A), tokens: ["nanos"], row: "effective JSON name changed" },
  { id: "G16", what: "response field Order.tracking_number added", class: N, tokens: ["tracking_number"], row: "field added (tolerant readers)" },
  { id: "G17", what: "response field ListOrdersResponse.next_page_token removed (number not reserved)", class: B, tokens: ["next_page_token"], row: "removed, number and name not reserved" },
]

// ---------------------------------------------------------------- the proof-of-concept generator
const SCALARS = ["int32", "int64", "uint32", "string", "bool", "double", "bytes", "sint64", "fixed32"]
// the .proto text of `messages` messages; `mutate` = the edited message indexes (after side)
const pocCorpus = (messages, pkg, mutate = new Set()) => {
  const out = [`syntax = "proto3";\n\npackage ${pkg};\n\nimport "google/protobuf/timestamp.proto";\nimport "google/api/field_behavior.proto";\nimport "buf/validate/validate.proto";\n`]
  for (let m = 0; m < messages; m++) {
    const x = mutate.has(m)
    if (m % 5 === 0) {
      // the enum of a group of five messages gains a value when one of them is mutated
      const group = [0, 1, 2, 3, 4].some((i) => mutate.has(m + i))
      out.push(`// Status of entity ${m}.\nenum Status${m} {\n  STATUS${m}_UNSPECIFIED = 0;\n  // Active.\n  STATUS${m}_ACTIVE = 1;\n  STATUS${m}_DELETED = 2 [deprecated = true];\n${group ? `  STATUS${m}_ARCHIVED = 3;\n` : ""}}\n`)
    }
    out.push(`// Entity number ${m}.\n// @Example {"id": ${m}}\nmessage Entity${m} {\n  reserved 100, 101 to 110;\n  reserved "old_field";\n`)
    for (let f = 0; f < 12; f++) {
      const n = f + 1
      const scalar = SCALARS[(m + f) % SCALARS.length]
      switch (f % 6) {
        case 0:
          out.push(
            f === 0
              ? `  // Identifier ${f}.\n  ${x ? "int64" : "int32"} field_${f} = ${n} [(buf.validate.field).${x ? "int64" : "int32"} = { ${x ? "gt" : "gte"}: 0, lte: 1000000 }];\n`
              : `  // Required. Identifier ${f}.\n  ${scalar} field_${f} = ${n};\n`,
          )
          break
        case 1:
          out.push(
            f === 1
              ? `  // Optional label.\n  // @MaxLength ${x ? 32 : 64}\n  optional string label_${f} = ${n} [json_name = "lbl${f}", (buf.validate.field).string.min_len = ${x ? 2 : 1}, (google.api.field_behavior) = ${x ? "REQUIRED" : "OPTIONAL"}];\n`
              : `  // Optional label.\n  // @MaxLength 64\n  optional string label_${f} = ${n} [json_name = "lbl${f}"];\n`,
          )
          break
        case 2:
          out.push(`  repeated ${scalar} list_${f} = ${n}; // trailing\n`)
          break
        case 3:
          out.push(`  map<string, ${scalar}> attrs_${f} = ${n};\n`)
          break
        case 4:
          out.push(`  ${m > 0 ? `Entity${m - 1}` : "google.protobuf.Timestamp"} ref_${f} = ${n} [deprecated = ${f === 10 || (x && f === 4)}];\n`)
          break
        case 5:
          out.push(`  Status${m - (m % 5)} status_${f} = ${n};\n`)
          break
      }
    }
    out.push(`  oneof kind {\n    string kind_a = 50;\n    int64 kind_b = 51;\n  }\n${x ? "  string added = 60;\n" : ""}  message Nested { bool flag = 1; }\n}\n`)
    if (m % 50 === 49) {
      out.push(`// Service for entities ${m - 49}..${m}.\nservice EntityService${m} {\n`)
      for (let r = 0; r < 10; r++) out.push(`  // Gets entity.\n  rpc Get${r}(Entity${m - r}) returns (${r % 2 ? "stream " : ""}Entity${m - r - 1}) { option idempotency_level = NO_SIDE_EFFECTS; }\n`)
      out.push(`}\n`)
    }
  }
  return out.join("")
}
const onePercent = (messages) => new Set(Array.from({ length: Math.max(1, Math.ceil(messages / 100)) }, (_, i) => (i * 100 + 7) % messages))

// the 7 changes of a mutated message m; message and enum names are matched with their package path (api-smart-diff
// pointers `/bench.p.entity7/`) or quoted (buf messages `"Entity7"`), so Entity7 never matches Entity70
const pocExpected = (messages) =>
  [...onePercent(messages)].flatMap((m) => {
    const msg = [`/bench.p.entity${m}/`, `"entity${m}"`, `bench.p.entity${m}\``]
    const group = m - (m % 5)
    return [
      // int32 -> int64 (varint group, JSON number -> string) with the lower bound made exclusive (S3 / S4 fold)
      { id: `E${m}.type`, what: `Entity${m}.field_0 int32 -> int64, gte 0 -> gt 0`, class: per(B, B, B, R), tokens: [msg, "field_0"] },
      { id: `E${m}.minLength`, what: `Entity${m}.label_1 min_len 1 -> 2`, class: B, tokens: [msg, "label_1", ["minlength", "minimum length"]] },
      { id: `E${m}.maxLength`, what: `Entity${m}.label_1 @MaxLength 64 -> 32`, class: B, tokens: [msg, "label_1", ["maxlength", "maximum length"]] },
      { id: `E${m}.required`, what: `Entity${m}.label_1 field_behavior OPTIONAL -> REQUIRED`, class: B, tokens: [msg, "label_1", "required"] },
      { id: `E${m}.deprecated`, what: `Entity${m}.ref_4 deprecated`, class: D, tokens: [msg, "ref_4"] },
      { id: `E${m}.added`, what: `Entity${m}.added added`, class: N, tokens: [msg, "added"], not: ["field_0", "label_1", "ref_4"] },
      { id: `E${m}.enum`, what: `Status${group}.STATUS${group}_ARCHIVED added (an enum used in requests and responses)`, class: R, tokens: [`status${group}_archived`] },
    ]
  })

const files = (text) => ({ "a.proto": text })
const poc = (messages, size) => ({
  name: `grpc-poc-${messages}`,
  family: "protoapi",
  spec: "proto3",
  kind: "synthetic",
  group: "grpc-poc",
  size,
  desc: `proof-of-concept generator, ${messages.toLocaleString("en")} messages (${size}), ${Math.ceil(messages / 100)} edited messages × 7 changes`,
  generate: () => ({ sources: { before: files(pocCorpus(messages, "bench.p")), after: files(pocCorpus(messages, "bench.p", onePercent(messages))) }, expected: pocExpected(messages) }),
})

const fixtures = [
  {
    name: "grpc-shop",
    family: "protoapi",
    spec: "proto3",
    kind: "changeset",
    desc: "order service (5 rpcs, 9 messages, an enum, protovalidate rules), 17 scripted changes, classes per compatibility level",
    generate: () => ({ sources: { before: { "shop/v1/shop.proto": shop(false) }, after: { "shop/v1/shop.proto": shop(true) } }, expected: shopExpected() }),
  },
  {
    name: "grpc-shop-identical",
    family: "protoapi",
    spec: "proto3",
    kind: "identical",
    desc: "grpc-shop before tree compared with itself",
    generate: () => ({ sources: { before: { "shop/v1/shop.proto": shop(false) }, after: { "shop/v1/shop.proto": shop(false) } } }),
  },
  poc(170, "≈ 160 KB"),
  poc(1700, "≈ 1.6 MB"),
  poc(10200, "≈ 9.7 MB"),
]

module.exports = { fixtures, LEVELS, pocCorpus, onePercent }
