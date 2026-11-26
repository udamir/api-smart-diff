import { runCases, type CompatCase } from "../../helpers/compat"
import { buf, cells, e23, p2, p3, parity, proto, row } from "./cases"

// PB-ENUM: enums and enum values (PROTOAPI_DESIGN §6.5), re-authored from buf's breaking corpus and the parity
// scenarios

const E = "components/enums/p.E"
const values = (body: string) => `enum E {\n${body}\n}`

const cases: CompatCase[] = [
  proto({
    id: "PB-ENUM-001",
    title: "enum deleted that no field references",
    before: "enum E { E_ZERO = 0; } message M { string s = 1; }",
    after: "message M { string s = 1; }",
    rationale: "nothing on the wire changes; code that names the type stops compiling (G1, PD-5)",
    annotation: "names the deleted enum and its file",
    sources: [buf("breaking_enum_no_delete", "ENUM_NO_DELETE F; PACKAGE_ENUM_NO_DELETE P"), row("E-2")],
    covers: ["buf:ENUM_NO_DELETE", "buf:PACKAGE_ENUM_NO_DELETE"],
    proto: [p3(`${values("E_ZERO = 0;")}\nmessage M { string s = 1; }`), p3("message M { string s = 1; }")],
    expect: [{ at: E, action: "remove", type: cells("R R R R"), mentions: ["`p.E`"] }],
  }),
  proto({
    id: "PB-ENUM-002",
    title: "enum value deleted, neither number nor name reserved",
    before: "enum E { E_ZERO = 0; A = 1; B = 2; }",
    after: "enum E { E_ZERO = 0; A = 1; }",
    rationale: "readers meet an unknown number, ProtoJSON writers send the name (PD-3 A)",
    annotation: "names the value, its number and the enum",
    sources: [
      buf("breaking_enum_value_no_delete", "ENUM_VALUE_NO_DELETE F P"),
      buf("breaking_enum_value_no_delete_unless_name_reserved", "ENUM_VALUE_NO_DELETE_UNLESS_NAME_RESERVED J"),
      buf("breaking_enum_value_no_delete_unless_number_reserved", "ENUM_VALUE_NO_DELETE_UNLESS_NUMBER_RESERVED J W"),
      row("V-4"),
    ],
    covers: [
      "buf:ENUM_VALUE_NO_DELETE",
      "buf:ENUM_VALUE_NO_DELETE_UNLESS_NAME_RESERVED",
      "buf:ENUM_VALUE_NO_DELETE_UNLESS_NUMBER_RESERVED",
    ],
    proto: [p3(values("E_ZERO = 0; A = 1; B = 2;")), p3(values("E_ZERO = 0; A = 1;"))],
    expect: [{ at: `${E}/values/B`, action: "remove", type: cells("B B B B"), mentions: ["`B`"] }],
  }),
  proto({
    id: "PB-ENUM-003",
    title: "enum value deleted, its number reserved",
    before: "enum E { E_ZERO = 0; A = 1; B = 2; }",
    after: "enum E { reserved 2; E_ZERO = 0; A = 1; }",
    rationale: "binary clients are safe, ProtoJSON writers still send the name (PD-3 B)",
    annotation: "names the value and the enum",
    sources: [buf("breaking_enum_value_no_delete_unless_number_reserved"), row("V-5")],
    proto: [p3(values("E_ZERO = 0; A = 1; B = 2;")), p3(values("reserved 2; E_ZERO = 0; A = 1;"))],
    expect: [
      { at: `${E}/values/B`, action: "remove", type: cells("B B B R"), mentions: ["`B`"] },
      { at: `${E}/reserved/numbers/*`, action: "add", type: cells("N N N N") },
    ],
  }),
  proto({
    id: "PB-ENUM-004",
    title: "enum value deleted, its name reserved",
    before: "enum E { E_ZERO = 0; A = 1; B = 2; }",
    after: 'enum E { reserved "B"; E_ZERO = 0; A = 1; }',
    rationale: "binary clients need the number reserved (PD-28)",
    annotation: "names the value and the enum",
    sources: [buf("breaking_enum_value_no_delete_unless_name_reserved"), row("V-6")],
    proto: [p3(values("E_ZERO = 0; A = 1; B = 2;")), p3(values('reserved "B"; E_ZERO = 0; A = 1;'))],
    expect: [
      { at: `${E}/values/B`, action: "remove", type: cells("B B B B"), mentions: ["`B`"] },
      { at: `${E}/reserved/names/*`, action: "add", type: cells("N N N A") },
    ],
  }),
  proto({
    id: "PB-ENUM-005",
    title: "enum value deleted with its number and its name reserved",
    before: "enum E { E_ZERO = 0; A = 1; B = 2; }",
    after: 'enum E { reserved 2; reserved "B"; E_ZERO = 0; A = 1; }',
    rationale: "no runtime client can break, only generated code loses the constant (PD-3 C, build-only)",
    annotation: "names the value and the enum",
    sources: [buf("breaking_enum_value_no_delete", "ENUM_VALUE_NO_DELETE F P"), row("V-7")],
    // the two reserved statements are two changes of the enum (E-7, E-8), each its own record
    single: false,
    proto: [p3(values("E_ZERO = 0; A = 1; B = 2;")), p3(values('reserved 2; reserved "B"; E_ZERO = 0; A = 1;'))],
    expect: [
      { at: `${E}/values/B`, action: "remove", type: cells("R R A A"), mentions: ["`B`"] },
      { at: `${E}/reserved/numbers/*`, action: "add", type: cells("N N N N") },
      { at: `${E}/reserved/names/*`, action: "add", type: cells("N N N A") },
    ],
  }),
  proto({
    id: "PB-ENUM-006",
    title: "enum value renamed",
    before: "enum E { E_UNSPECIFIED = 0; A = 1; }",
    after: "enum E { E_UNSPECIFIED = 0; B = 1; }",
    rationale: "ProtoJSON and generated code use the name, the wire only the number (U2)",
    annotation: "names both value names and the enum",
    sources: [
      parity("v enum_value_renamed", "ENUM_VALUE_SAME_NAME F P J"),
      buf("breaking_enum_value_same_name"),
      row("V-8"),
    ],
    covers: ["buf:ENUM_VALUE_SAME_NAME"],
    proto: [p3(values("E_UNSPECIFIED = 0; A = 1;")), p3(values("E_UNSPECIFIED = 0; B = 1;"))],
    expect: [{ at: `${E}/values`, action: "rename", type: cells("B B B N"), mentions: ["`A`", "`B`"] }],
  }),
  proto({
    id: "PB-ENUM-007",
    title: "alias name removed while its number stays",
    before: "enum E { option allow_alias = true; E_UNSPECIFIED = 0; A = 1; B = 1; }",
    after: "enum E { E_UNSPECIFIED = 0; A = 1; }",
    rationale: "the number is still known; ProtoJSON clients that send `B` fail (review §9.4, U2)",
    annotation: "names the removed alias and the enum",
    sources: [parity("n alias_name_removed", "ENUM_VALUE_SAME_NAME F P J"), row("V-3")],
    // the alias and the `allow_alias` option are two changes of the enum
    single: false,
    proto: [
      p3(values("option allow_alias = true; E_UNSPECIFIED = 0; A = 1; B = 1;")),
      p3(values("E_UNSPECIFIED = 0; A = 1;")),
    ],
    expect: [
      { at: `${E}/values/B`, action: "remove", type: cells("B B B N"), mentions: ["`B`"] },
      { at: `${E}/options/allow_alias`, action: "remove", type: cells("A A A A") },
    ],
  }),
  proto({
    id: "PB-ENUM-008",
    title: "open enum made closed (edition 2023)",
    before: "enum E { E_UNSPECIFIED = 0; A = 1; }",
    after: "enum E { option features.enum_type = CLOSED; E_UNSPECIFIED = 0; A = 1; }",
    rationale: "unknown values are kept as unknown fields instead of the number: risky at every level (G4)",
    annotation: "names the enum and both enum types",
    sources: [parity("d enum_open_to_closed", "ENUM_SAME_TYPE F P"), buf("breaking_enum_same_type"), row("E-4")],
    covers: ["buf:ENUM_SAME_TYPE"],
    proto: [
      e23(values("E_UNSPECIFIED = 0; A = 1;")),
      e23(values("option features.enum_type = CLOSED; E_UNSPECIFIED = 0; A = 1;")),
    ],
    expect: [{ at: `${E}/closed`, action: "add", type: cells("R R R R"), mentions: ["`open`", "`closed`"] }],
  }),
  proto({
    id: "PB-ENUM-009",
    title: "closed enum made open (edition 2023)",
    before: "enum E { option features.enum_type = CLOSED; E_UNSPECIFIED = 0; A = 1; }",
    after: "enum E { E_UNSPECIFIED = 0; A = 1; }",
    rationale: "readers keep more values than before (§10 Q1)",
    annotation: "names the enum and both enum types",
    sources: [parity("e enum_closed_to_open", "ENUM_SAME_TYPE F P"), row("E-5")],
    proto: [
      e23(values("option features.enum_type = CLOSED; E_UNSPECIFIED = 0; A = 1;")),
      e23(values("E_UNSPECIFIED = 0; A = 1;")),
    ],
    expect: [{ at: `${E}/closed`, action: "remove", type: cells("N N N N"), mentions: ["`closed`", "`open`"] }],
  }),
  proto({
    id: "PB-ENUM-010",
    title: "`json_format = LEGACY_BEST_EFFORT` set on an enum (edition 2023)",
    before: "enum E { E_UNSPECIFIED = 0; }",
    after: "enum E { option features.json_format = LEGACY_BEST_EFFORT; E_UNSPECIFIED = 0; }",
    rationale: "generated JSON mappings may change, ProtoJSON runtime parsing does not (C7, build-only)",
    annotation: "names the enum and both JSON formats",
    sources: [buf("breaking_enum_same_json_format", "ENUM_SAME_JSON_FORMAT F P J"), row("E-9")],
    covers: ["buf:ENUM_SAME_JSON_FORMAT"],
    proto: [
      e23(values("E_UNSPECIFIED = 0;")),
      e23(values("option features.json_format = LEGACY_BEST_EFFORT; E_UNSPECIFIED = 0;")),
    ],
    expect: [{ at: `${E}/jsonFormat`, action: "add", type: cells("R R A A"), mentions: ["JSON format"] }],
  }),
  proto({
    id: "PB-ENUM-011",
    title: "reserved number range of an enum removed, not reused",
    before: "enum E { reserved 5 to 9; E_ZERO = 0; }",
    after: "enum E { E_ZERO = 0; }",
    rationale: "nothing breaks now, the numbers may be reused later with another meaning (PD-4)",
    annotation: "names the range and the enum",
    sources: [buf("breaking_reserved_enum_no_delete", "RESERVED_ENUM_NO_DELETE F P J W"), row("E-7")],
    covers: ["buf:RESERVED_ENUM_NO_DELETE"],
    proto: [p3(values("reserved 5 to 9; E_ZERO = 0;")), p3(values("E_ZERO = 0;"))],
    expect: [{ at: `${E}/reserved/numbers/*`, action: "remove", type: cells("R R R R"), mentions: ["`5 to 9`"] }],
  }),
  proto({
    id: "PB-ENUM-012",
    title: "enum value added: non-breaking in a request, risky in a response",
    before: "enum E { E_ZERO = 0; A = 1; } (field of p.M)",
    after: "enum E { E_ZERO = 0; A = 1; B = 2; }",
    rationale: "servers accept the new value; clients switching over a returned value may meet it (PD-11, POLICY-05)",
    annotation: "names the added value and the enum",
    sources: [row("V-1")],
    use: { message: "p.M", directions: ["request", "response"] },
    proto: [
      p3(`${values("E_ZERO = 0; A = 1;")}\nmessage M { E e = 1; }`),
      p3(`${values("E_ZERO = 0; A = 1; B = 2;")}\nmessage M { E e = 1; }`),
    ],
    expect: [
      { at: `${E}/values/B`, action: "add", type: { request: "non-breaking", response: "risky" }, mentions: ["`B`"] },
    ],
  }),
  proto({
    id: "PB-ENUM-013",
    title: "first value of a proto2 enum changed: the implicit default of its fields changes",
    before: "message M { optional E e = 1; } enum E { A = 1; B = 2; }",
    after: "message M { optional E e = 1; } enum E { B = 2; A = 1; }",
    rationale: "readers of a message without `e` see `B` instead of `A` (C6)",
    annotation: "names the field and both implicit defaults",
    sources: [parity("o enum_first_value_proto2", "FIELD_SAME_DEFAULT F P J W"), row("F-32")],
    proto: [
      p2(`message M { optional E e = 1; }\n${values("A = 1; B = 2;")}`),
      p2(`message M { optional E e = 1; }\n${values("B = 2; A = 1;")}`),
    ],
    expect: [{ at: "components/messages/p.M/properties/e/default", type: cells("B B B B"), mentions: ["`A`", "`B`"] }],
  }),
]

runCases("protoapi", "enums", cases, import.meta.filename)
