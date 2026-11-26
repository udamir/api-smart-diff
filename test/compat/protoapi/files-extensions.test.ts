import { runCases, type CompatCase } from "../../helpers/compat"
import { buf, cells, p2, p3, parity, proto, row } from "./cases"

// PB-FILE / PB-EXT: files, packages and extensions (PROTOAPI_DESIGN §6.1, §6.6), re-authored from buf's breaking
// corpus, the parity scenarios and the record decisions A2, A3, A5

const pet = (pkg: string) =>
  `syntax = "proto3";\npackage ${pkg};\nmessage Pet {\n  string id = 1;\n}\nservice PetService {\n  rpc Get(Pet) returns (Pet);\n}\n`
const ext = "message M {\n  extensions 100 to 200;\n}\n"

const cases: CompatCase[] = [
  proto({
    id: "PB-FILE-001",
    area: "files",
    title: "file deleted whose package has no other file",
    before: "a.proto (package p, message M); b.proto (package q, message N)",
    after: "a.proto",
    rationale: "a file move is build-only (FILE risky), its declarations are classified on their own rows (PD-9)",
    annotation: "names the deleted file; the message record names the message",
    sources: [
      buf("breaking_file_no_delete", "FILE_NO_DELETE F"),
      buf("breaking_package_no_delete", "PACKAGE_NO_DELETE P"),
      row("P-2"),
    ],
    covers: ["buf:FILE_NO_DELETE", "buf:PACKAGE_NO_DELETE"],
    proto: [
      {
        "a.proto": p3("message M { string s = 1; }"),
        "b.proto": 'syntax = "proto3";\npackage q;\nmessage N { string s = 1; }\n',
      },
      { "a.proto": p3("message M { string s = 1; }") },
    ],
    expect: [
      { at: "files/b.proto", action: "remove", type: cells("R A A A"), mentions: ["`b.proto`"] },
      { at: "components/messages/q.N", action: "remove", type: cells("R R R R"), mentions: ["`q.N`"] },
    ],
  }),
  proto({
    id: "PB-FILE-002",
    area: "files",
    title: "file added",
    before: "a.proto",
    after: "a.proto, b.proto (message N)",
    rationale: "a new file breaks no client; JSON and binary clients do not see files (PD-9)",
    annotation: "names the added file",
    sources: [row("P-1")],
    proto: [
      { "a.proto": p3("message M { string s = 1; }") },
      { "a.proto": p3("message M { string s = 1; }"), "b.proto": p3("message N { string s = 1; }") },
    ],
    expect: [
      { at: "files/b.proto", action: "add", type: cells("N N A A"), mentions: ["`b.proto`"] },
      { at: "components/messages/p.N", action: "add", type: cells("N N N N") },
    ],
  }),
  proto({
    id: "PB-FILE-003",
    area: "files",
    title: "file renamed with unchanged content: one record (A5)",
    before: "shop/pet.proto",
    after: "shop/pets.proto (same declarations)",
    rationale:
      "import paths change, nothing else: build-only in FILE, annotation elsewhere; no file or `file` records (A5)",
    annotation: "names both file paths",
    sources: [
      { tool: "asd", ref: "test/compat/protoapi/buf-scenarios record_a5_file_renamed", verdict: "FILE_NO_DELETE F" },
      row("P-20"),
    ],
    proto: [{ "shop/pet.proto": pet("shop.v1") }, { "shop/pets.proto": pet("shop.v1") }],
    expect: [
      { at: "files", action: "rename", type: cells("R A A A"), mentions: ["`shop/pet.proto`", "`shop/pets.proto`"] },
    ],
  }),
  proto({
    id: "PB-FILE-004",
    area: "files",
    title: "package changed: one record at the file package (A2)",
    before: "package shop.v1; message Pet; service PetService",
    after: "package shop.v2; (same declarations)",
    rationale: "every fully qualified name changes: method paths, type URLs and JSON `@type` break (A2)",
    annotation: "names the file and both packages",
    sources: [
      buf("breaking_file_same_package", "FILE_SAME_PACKAGE F P J W"),
      {
        tool: "asd",
        ref: "test/compat/protoapi/buf-scenarios record_a2_package_changed",
        verdict: "FILE_SAME_PACKAGE F P J W; PACKAGE_NO_DELETE P",
      },
      row("P-5"),
    ],
    covers: ["buf:FILE_SAME_PACKAGE"],
    proto: [{ "shop/pet.proto": pet("shop.v1") }, { "shop/pet.proto": pet("shop.v2") }],
    expect: [
      {
        at: "files/shop~1pet.proto/package",
        action: "replace",
        type: cells("B B B B"),
        mentions: ["`shop.v1`", "`shop.v2`"],
      },
    ],
  }),
  proto({
    id: "PB-FILE-005",
    area: "files",
    title: "syntax proto3 → proto2: one record per affected element (A4)",
    before: 'syntax = "proto3"; message M { string s = 1; }',
    after: 'syntax = "proto2"; message M { optional string s = 1; }',
    rationale:
      "the statement is build-only; its runtime effects (presence, UTF-8 validation, JSON format) are resolved keywords, one merged record per element (A4, U1)",
    annotation: "names the file and both syntax statements; each element record lists its effects",
    sources: [
      parity(
        "l proto3_to_proto2",
        "FILE_SAME_SYNTAX F P; FIELD_SAME_CARDINALITY F P; FIELD_SAME_UTF8_VALIDATION F P; MESSAGE_SAME_JSON_FORMAT F P J",
      ),
      buf("breaking_file_same_syntax", "FILE_SAME_SYNTAX F P"),
      row("P-4"),
    ],
    covers: ["buf:FILE_SAME_SYNTAX"],
    proto: [p3("message M { string s = 1; }"), p2("message M { optional string s = 1; }")],
    expect: [
      {
        at: "files/a.proto/syntax",
        action: "replace",
        type: cells("R R A A"),
        mentions: ['`syntax = "proto3"`', '`syntax = "proto2"`'],
      },
      { at: "components/messages/p.M/jsonFormat", type: cells("R R A A"), mentions: ["JSON format"] },
      { at: "components/messages/p.M/properties/s/**", type: cells("R R A A"), mentions: ["`s`"] },
    ],
  }),
  proto({
    id: "PB-EXT-001",
    area: "extensions",
    title: "extension deleted (proto2)",
    before: "extend M { optional string label = 100; }",
    after: "(no extension)",
    rationale: "readers keep the value as an unknown field; code that names the extension stops compiling (PD-5)",
    annotation: "names the extension, its number and the extended message",
    sources: [
      buf("breaking_extension_no_delete", "EXTENSION_NO_DELETE F"),
      buf("breaking_package_extension_no_delete", "PACKAGE_EXTENSION_NO_DELETE P"),
      row("X-2"),
    ],
    covers: ["buf:EXTENSION_NO_DELETE", "buf:PACKAGE_EXTENSION_NO_DELETE"],
    proto: [p2(`${ext}extend M {\n  optional string label = 100;\n}`), p2(ext)],
    expect: [
      { at: "components/extensions/p.label", action: "remove", type: cells("R R R R"), mentions: ["`p.label`"] },
    ],
  }),
  proto({
    id: "PB-EXT-002",
    area: "extensions",
    title: "extension renamed, same extendee and number: one record (A3)",
    before: "extend M { optional string label = 100; }",
    after: "extend M { optional string display_label = 100; }",
    rationale: "ProtoJSON writes `[full.name]` and text-format options name it; the wire keeps the number (PD-22)",
    annotation: "names both extension names and the extended message",
    sources: [
      {
        tool: "asd",
        ref: "test/compat/protoapi/buf-scenarios record_a3_extension_renamed",
        verdict: "FIELD_SAME_NAME F P J; EXTENSION_NO_DELETE F",
      },
      row("X-6"),
    ],
    proto: [
      p2(`${ext}extend M {\n  optional string label = 100;\n}`),
      p2(`${ext}extend M {\n  optional string display_label = 100;\n}`),
    ],
    expect: [
      {
        at: "components/extensions",
        action: "rename",
        type: cells("B B B N"),
        mentions: ["`p.label`", "`p.display_label`"],
      },
    ],
  }),
  proto({
    id: "PB-EXT-003",
    area: "extensions",
    title: "extension type changed `int32` → `string`",
    before: "extend M { optional int32 n = 100; }",
    after: "extend M { optional string n = 100; }",
    rationale: "the field rows apply to extension bodies (X-5): another wire type breaks every reader",
    annotation: "names the extension and both types",
    sources: [
      buf(
        "breaking_field_wire_compatible_type",
        "FIELD_SAME_TYPE F P; FIELD_WIRE_JSON_COMPATIBLE_TYPE J; FIELD_WIRE_COMPATIBLE_TYPE W",
      ),
      row("X-5"),
    ],
    proto: [
      p2(`${ext}extend M {\n  optional int32 n = 100;\n}`),
      p2(`${ext}extend M {\n  optional string n = 100;\n}`),
    ],
    expect: [
      {
        at: "components/extensions/p.n/type",
        action: "replace",
        type: cells("B B B B"),
        mentions: ["`int32`", "`string`"],
      },
    ],
  }),
]

runCases("protoapi", "files", cases, import.meta.filename)
