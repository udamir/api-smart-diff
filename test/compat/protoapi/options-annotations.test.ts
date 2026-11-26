import { runCases, type CompatCase } from "../../helpers/compat"
import { buf, cells, e23, field, p3, parity, proto, row } from "./cases"

// PB-OPT / PB-ANN / PB-EDGE: language and googleapis options (R-G, PD-13, §6.7), unknown options, the annotation
// keywords of §6.8, and edge cases found by the buf oracle (ISSUE-400, ISSUE-402) and the buf corpus

const M = (body: string) => `message M {\n${body}\n}`
const behavior = 'import "google/api/field_behavior.proto";\n'
const validate = 'import "buf/validate/validate.proto";\n'

// every language file option buf compares (FILE_SAME_<OPTION>), with a before and an after value
const fileOptions: [string, string, string][] = [
  ["java_package", '"foo"', '"bar"'],
  ["java_outer_classname", '"Foo"', '"Bar"'],
  ["java_multiple_files", "true", "false"],
  ["java_generic_services", "true", "false"],
  ["go_package", '"example.com/foo"', '"example.com/bar"'],
  ["cc_generic_services", "true", "false"],
  ["cc_enable_arenas", "false", "true"],
  ["py_generic_services", "true", "false"],
  ["objc_class_prefix", '"FOO"', '"BAR"'],
  ["csharp_namespace", '"Foo"', '"Bar"'],
  ["swift_prefix", '"Foo"', '"Bar"'],
  ["php_class_prefix", '"Foo"', '"Bar"'],
  ["php_namespace", '"Foo"', '"Bar"'],
  ["php_metadata_namespace", '"Foo"', '"Bar"'],
  ["ruby_package", '"Foo"', '"Bar"'],
  ["optimize_for", "CODE_SIZE", "LITE_RUNTIME"],
]
const fileOptionCase = ([option, before, after]: [string, string, string], index: number): CompatCase =>
  proto({
    id: `PB-OPT-${String(index + 1).padStart(3, "0")}`,
    area: "options",
    title: `file option \`${option}\` changed`,
    before: `option ${option} = ${before};`,
    after: `option ${option} = ${after};`,
    rationale: "a language option only changes generated code: one generic record, build-only (R-G)",
    annotation: "names the option with both values and the file",
    sources: [buf("breaking_file_same_values", `FILE_SAME_${option.toUpperCase()} F P`), row("L-1")],
    covers: [`buf:FILE_SAME_${option.toUpperCase()}`],
    proto: [
      p3(M("string s = 1;"), `option ${option} = ${before};\n`),
      p3(M("string s = 1;"), `option ${option} = ${after};\n`),
    ],
    expect: [{ at: `files/a.proto/options/${option}`, type: cells("R R A A"), mentions: [`\`${option}`] }],
  })

const cases: CompatCase[] = [
  ...fileOptions.map(fileOptionCase),
  proto({
    id: "PB-OPT-017",
    area: "options",
    title: "`java_string_check_utf8` changed: one record at the file, none at its fields (R-G)",
    before: "option java_string_check_utf8 = false; message M { string s = 1; }",
    after: "option java_string_check_utf8 = true; message M { string s = 1; }",
    rationale: "Java-only parsing behaviour; no effective value per field (R-G)",
    annotation: "names the option with both values and the file",
    sources: [buf("breaking_field_same_java_utf8_validation", "FIELD_SAME_JAVA_UTF8_VALIDATION F P"), row("L-1")],
    covers: ["buf:FIELD_SAME_JAVA_UTF8_VALIDATION"],
    proto: [
      p3(M("string s = 1;"), "option java_string_check_utf8 = false;\n"),
      p3(M("string s = 1;"), "option java_string_check_utf8 = true;\n"),
    ],
    expect: [
      {
        at: "files/a.proto/options/java_string_check_utf8",
        type: cells("R R A A"),
        mentions: ["`java_string_check_utf8`"],
      },
    ],
  }),
  proto({
    id: "PB-OPT-018",
    area: "options",
    title: "`ctype = CORD` set on a string field",
    before: "string s = 1;",
    after: "string s = 1 [ctype = CORD];",
    rationale: "a C++-only storage choice (R-G)",
    annotation: "names the option, its value and the field",
    sources: [
      buf("breaking_field_same_cpp_string_type", "FIELD_SAME_CPP_STRING_TYPE F P"),
      buf("breaking_field_same_ctype"),
      row("L-2"),
    ],
    covers: ["buf:FIELD_SAME_CPP_STRING_TYPE"],
    proto: [p3(M("string s = 1;")), p3(M("string s = 1 [ctype = CORD];"))],
    expect: [
      { at: `${field("M", "s")}/options/ctype`, action: "add", type: cells("R R A A"), mentions: ["`ctype = CORD`"] },
    ],
  }),
  proto({
    id: "PB-OPT-019",
    area: "options",
    title: "`jstype = JS_STRING` set on an `int64` field",
    before: "int64 i = 1;",
    after: "int64 i = 1 [jstype = JS_STRING];",
    rationale: "a JavaScript-only representation choice (R-G)",
    annotation: "names the option, its value and the field",
    sources: [parity("q jstype_added", "FIELD_SAME_JSTYPE F P"), buf("breaking_field_same_jstype"), row("L-2")],
    covers: ["buf:FIELD_SAME_JSTYPE"],
    proto: [p3(M("int64 i = 1;")), p3(M("int64 i = 1 [jstype = JS_STRING];"))],
    expect: [
      {
        at: `${field("M", "i")}/options/jstype`,
        action: "add",
        type: cells("R R A A"),
        mentions: ["`jstype = JS_STRING`"],
      },
    ],
  }),
  proto({
    id: "PB-OPT-020",
    area: "options",
    title: "`ctype = CORD` replaced by `features.(pb.cpp).string_type = CORD`: two options, two records (R-G)",
    before: "bytes b = 1 [ctype = CORD];",
    after: "bytes b = 1 [features.(pb.cpp).string_type = CORD];",
    rationale: "no equivalence logic between language options (R-G); both are build-only",
    annotation: "names each option",
    sources: [parity("w ctype_to_cpp_feature", "none"), row("L-3")],
    // two options of the field change: one record each (R-G)
    single: false,
    proto: [
      e23(M("bytes b = 1 [ctype = CORD];")),
      e23(M("bytes b = 1 [features.(pb.cpp).string_type = CORD];"), 'import "google/protobuf/cpp_features.proto";\n'),
    ],
    expect: [
      { at: `${field("M", "b")}/options/**`, type: cells("R R A A"), count: 2 },
      {
        at: "files/a.proto/imports/*",
        action: "add",
        type: cells("A A A A"),
        mentions: ["`google/protobuf/cpp_features.proto`"],
      },
    ],
  }),
  proto({
    id: "PB-OPT-021",
    area: "options",
    title: "custom field option changed",
    before: 'string s = 1 [(owner) = "a"];',
    after: 'string s = 1 [(owner) = "b"];',
    rationale: "asd cannot know what a custom option means (C7)",
    annotation: "names the option in parentheses with both values",
    sources: [row("F-44")],
    proto: [
      p3(
        M('string s = 1 [(owner) = "a"];'),
        'import "google/protobuf/descriptor.proto";\nextend google.protobuf.FieldOptions { string owner = 50001; }\n',
      ),
      p3(
        M('string s = 1 [(owner) = "b"];'),
        'import "google/protobuf/descriptor.proto";\nextend google.protobuf.FieldOptions { string owner = 50001; }\n',
      ),
    ],
    expect: [
      {
        at: `${field("M", "s")}/options/p.owner`,
        action: "replace",
        type: cells("U U U U"),
        mentions: ["`(p.owner)`"],
      },
    ],
  }),
  proto({
    id: "PB-ANN-001",
    area: "annotations",
    title: "field description changed",
    before: "// The id.\nstring s = 1;",
    after: "// The identifier.\nstring s = 1;",
    rationale: "documentation only (C1)",
    annotation: "names the field",
    sources: [row("F-45")],
    proto: [p3(M("  // The id.\n  string s = 1;")), p3(M("  // The identifier.\n  string s = 1;"))],
    expect: [{ at: `${field("M", "s")}/description`, action: "replace", type: cells("A A A A"), mentions: ["`s`"] }],
  }),
  proto({
    id: "PB-ANN-002",
    area: "annotations",
    title: "field deprecated",
    before: "string s = 1;",
    after: "string s = 1 [deprecated = true];",
    rationale: "clients are warned, nothing breaks (PD-23)",
    annotation: "reads [Deprecated] and names the field",
    sources: [row("F-45")],
    proto: [p3(M("string s = 1;")), p3(M("string s = 1 [deprecated = true];"))],
    expect: [
      {
        at: `${field("M", "s")}/deprecation`,
        action: "add",
        type: cells("D D D D"),
        mentions: ["[Deprecated]", "`s`"],
      },
    ],
  }),
  proto({
    id: "PB-ANN-003",
    area: "annotations",
    title: "kept field marked `REQUIRED` by `google.api.field_behavior`",
    before: "string s = 1;",
    after: "string s = 1 [(google.api.field_behavior) = REQUIRED];",
    rationale: "requests without the field are rejected by the server; responses only gain a promise (K-14, S1)",
    annotation: "names the field and the required constraint",
    sources: [row("K-14")],
    use: { message: "p.M", directions: ["request", "response"] },
    proto: [
      p3(M("string s = 1;"), behavior),
      p3(M("string s = 1 [(google.api.field_behavior) = REQUIRED];"), behavior),
    ],
    expect: [
      { at: `${field("M", "s")}/required`, action: "add", type: { request: "breaking", response: "non-breaking" } },
    ],
  }),
  proto({
    id: "PB-ANN-004",
    area: "annotations",
    title: "maximum length added by protovalidate",
    before: "string s = 1;",
    after: "string s = 1 [(buf.validate.field).string.max_len = 10];",
    rationale: "longer requests are rejected; responses only gain a promise (K-5)",
    annotation: "names the field and the maximum length",
    sources: [row("K-5")],
    use: { message: "p.M", directions: ["request", "response"] },
    proto: [
      p3(M("string s = 1;"), validate),
      p3(M("string s = 1 [(buf.validate.field).string.max_len = 10];"), validate),
    ],
    expect: [
      {
        at: `${field("M", "s")}/maxLength`,
        action: "add",
        type: { request: "breaking", response: "non-breaking" },
        mentions: ["maximum length"],
      },
    ],
  }),
  proto({
    id: "PB-EDGE-001",
    area: "edge cases",
    title: "`string` → `bytes` with the same default literal: only the type record (ISSUE-400)",
    before: 'optional string s = 1 [default = "abc"];',
    after: 'optional bytes s = 1 [default = "abc"];',
    rationale: "the default is the same bytes, only its document spelling changes with the type (R-1)",
    annotation: "names the field and both types",
    sources: [
      buf(
        "breaking_field_same_default",
        "FIELD_SAME_TYPE F P; FIELD_WIRE_JSON_COMPATIBLE_TYPE J (no FIELD_SAME_DEFAULT)",
      ),
      row("F-13"),
    ],
    proto: [
      'syntax = "proto2";\npackage p;\nmessage M { optional string s = 1 [default = "abc"]; }\n',
      'syntax = "proto2";\npackage p;\nmessage M { optional bytes s = 1 [default = "abc"]; }\n',
    ],
    expect: [{ at: `${field("M", "s")}/type`, action: "replace", type: cells("B B B R") }],
  }),
  proto({
    id: "PB-EDGE-002",
    area: "edge cases",
    title: "`string` field made repeated while the file moves from proto2 to edition 2023 (ISSUE-402)",
    before: 'syntax = "proto2"; message M { optional string s = 1; }',
    after: 'edition = "2023"; message M { repeated string s = 1; }',
    rationale: "two causes at the field: the shape change and the UTF-8 validation the edition turns on (A4, R-1)",
    annotation: "names the field and each effect",
    sources: [
      buf("breaking_field_same_cardinality", "FIELD_SAME_CARDINALITY F P; FIELD_SAME_UTF8_VALIDATION F P"),
      row("F-18"),
      row("F-36"),
    ],
    // two causes at one field: the shape change and the edition's UTF-8 validation
    single: false,
    proto: [
      'syntax = "proto2";\npackage p;\nmessage M { optional string s = 1; }\n',
      e23("message M { repeated string s = 1; }"),
    ],
    expect: [
      { at: "files/a.proto/syntax", action: "replace", type: cells("R R A A") },
      { at: "components/messages/p.M/jsonFormat", action: "remove", type: cells("N N N N") },
      { at: `${field("M", "s")}/type`, action: "replace", type: cells("B B B R") },
      {
        at: `${field("M", "s")}/items/utf8Validation`,
        action: "remove",
        type: cells("R R A A"),
        mentions: ["UTF-8 validation"],
      },
    ],
  }),
  proto({
    id: "PB-EDGE-003",
    area: "edge cases",
    title: "proto2 `required` → edition 2023 `LEGACY_REQUIRED`: no field record",
    before: 'syntax = "proto2"; message M { required int64 n = 1; }',
    after: 'edition = "2023"; message M { int64 n = 1 [features.field_presence = LEGACY_REQUIRED]; }',
    rationale:
      "both spell wire-level requiredness (Q5); buf compares the descriptor label and reports a deleted required field",
    annotation: "the syntax record names both statements",
    sources: [
      buf("breaking_field_same_label", "MESSAGE_SAME_REQUIRED_FIELDS F P J W (buf compares the label)"),
      row("F-24"),
    ],
    proto: [
      'syntax = "proto2";\npackage p;\nmessage M { required int64 n = 1; }\n',
      e23("message M { int64 n = 1 [features.field_presence = LEGACY_REQUIRED]; }"),
    ],
    expect: [
      { at: "files/a.proto/syntax", action: "replace", type: cells("R R A A") },
      { at: "components/messages/p.M/jsonFormat", action: "remove", type: cells("N N N N") },
    ],
  }),
  proto({
    id: "PB-EDGE-004",
    area: "edge cases",
    title: "map value type changed: one record at the map field",
    before: "map<string, int32> m = 1;",
    after: "map<string, int64> m = 1;",
    rationale: "ProtoApi has no map-entry message; buf reports the entry's value field, asd the map field (DG-01)",
    annotation: "names the field and both map types",
    sources: [buf("breaking_field_same_type", "FIELD_SAME_TYPE F P (on the map entry)"), row("F-21")],
    proto: [p3(M("map<string, int32> m = 1;")), p3(M("map<string, int64> m = 1;"))],
    expect: [
      {
        at: `${field("M", "m")}/type`,
        action: "replace",
        type: cells("B B B R"),
        mentions: ["`map<string, int32>`", "`map<string, int64>`"],
      },
    ],
  }),
]

runCases("protoapi", "options and annotations", cases, import.meta.filename)
