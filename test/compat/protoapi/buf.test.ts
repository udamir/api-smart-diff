import { runCases, type CompatCase } from "../../helpers/compat"
import { buf, cells, field, p2, p3, parity, proto, row } from "./cases"

// PB-BUF: scenarios of buf's breaking corpus whose shape the other areas do not have (scalar ↔ enum, message ↔ enum,
// a proto2 group renamed), re-authored as the smallest pair

const cases: CompatCase[] = [
  proto({
    id: "PB-BUF-001",
    title: "`int32` field → enum field",
    before: "message M { int32 e = 1; }",
    after: "message M { E e = 1; } enum E { E_UNSPECIFIED = 0; }",
    rationale: "binary encodes both as varints, ProtoJSON writes enum names: breaking where buf's groups say so (§5.3)",
    annotation: "names the field, `int32` and the enum",
    sources: [
      parity("x int32_to_enum", "FIELD_SAME_TYPE F P; FIELD_WIRE_JSON_COMPATIBLE_TYPE J; FIELD_WIRE_COMPATIBLE_TYPE W"),
      buf("breaking_int_enum"),
      row("F-14"),
    ],
    proto: [
      p3("message M { int32 e = 1; }\nenum E { E_UNSPECIFIED = 0; }"),
      p3("message M { E e = 1; }\nenum E { E_UNSPECIFIED = 0; }"),
    ],
    expect: [
      { at: `${field("M", "e")}/$ref`, action: "replace", type: cells("B B B B"), mentions: ["`int32`", "`p.E`"] },
    ],
  }),
  proto({
    id: "PB-BUF-002",
    title: "message field → enum field",
    before: "message M { N v = 1; } message N {} enum E { E_UNSPECIFIED = 0; }",
    after: "message M { E v = 1; } message N {} enum E { E_UNSPECIFIED = 0; }",
    rationale: "a length-delimited message and a varint are different wire types",
    annotation: "names the field and both types",
    sources: [
      buf(
        "breaking_message_enum",
        "FIELD_SAME_TYPE F P; FIELD_WIRE_JSON_COMPATIBLE_TYPE J; FIELD_WIRE_COMPATIBLE_TYPE W",
      ),
      row("F-14"),
    ],
    proto: [
      p3("message M { N v = 1; }\nmessage N {}\nenum E { E_UNSPECIFIED = 0; }"),
      p3("message M { E v = 1; }\nmessage N {}\nenum E { E_UNSPECIFIED = 0; }"),
    ],
    expect: [
      { at: `${field("M", "v")}/$ref`, action: "replace", type: cells("B B B B"), mentions: ["`p.N`", "`p.E`"] },
    ],
  }),
  proto({
    id: "PB-BUF-003",
    title: "proto2 group renamed: one field rename (A6)",
    before: "optional group Item = 1 { optional string id = 2; }",
    after: "optional group Entry = 1 { optional string id = 2; }",
    rationale: "the field name, its JSON name and the group type name change together; the number stays (U2, A6)",
    annotation: "names both field names and the message",
    sources: [
      {
        tool: "asd",
        ref: "test/compat/protoapi/buf-scenarios record_a6_group_renamed",
        verdict: "FIELD_SAME_NAME F P J; FIELD_SAME_JSON_NAME F P J; FIELD_SAME_TYPE F P; MESSAGE_NO_DELETE F",
      },
      row("F-48"),
    ],
    proto: [
      p2("message M {\n  optional group Item = 1 {\n    optional string id = 2;\n  }\n}"),
      p2("message M {\n  optional group Entry = 1 {\n    optional string id = 2;\n  }\n}"),
    ],
    expect: [
      {
        at: "components/messages/p.M/properties",
        action: "rename",
        type: cells("B B B N"),
        mentions: ["`item`", "`entry`"],
      },
    ],
  }),
]

runCases("protoapi", "buf corpus", cases, import.meta.filename)
