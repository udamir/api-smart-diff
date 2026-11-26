// buf v1.75.0 breaking rules → the rows of the classification matrix they map to (PROTOAPI_DESIGN §6, §9.3): the
// paths of the records that answer a finding of the rule (`at`, relative to the document root, `*` = one segment,
// `**` = any) and the least class that agrees with buf's verdict (`min`). A finding of a rule is reported by buf as a
// break in the category it was run with, so `min` is `breaking` for every rule; where asd classifies the row lower by
// decision, the rule@category is an accepted exception that names the decision
// (test/compat/coverage/protoapi-buf-oracle-exceptions.json). `named: false` marks deletions whose message names no
// declaration (ranges, reserved statements).

import type { DiffType } from "../../../src"

export interface BufRuleMapping {
  at: string[]
  min: DiffType
  named?: boolean
  /**
   * A4 (PD-25): the merged record of a syntax or feature change is reported at one resolved keyword of the element and
   * lists the others in its description; a record at another resolved keyword (`at`) answers the rule when its
   * description names the rule's effect (`mentions`)
   */
  merged?: { at: string[]; mentions: RegExp }
}

// the keywords of a field (or an extension body) below its element
const fieldAt = (...keys: string[]) =>
  keys.flatMap((key) => [`components/messages/*/properties/*/${key}`, `components/extensions/*/${key}`])
// the shape of a field (§4.7: the carrier `type` / `$ref` and the inner positions), its kind (`delimited`)
const shape = fieldAt("type", "$ref", "items/**", "additionalProperties/**", "propertyNames/**", "delimited")
// renames reported at the properties / extensions container (F-8, F-9, X-6)
const fieldRename = ["components/messages/*/properties", "components/extensions"]
// a syntax or feature change of the file or an enclosing message, whose effects buf reports at every field (A4)
const inherited = ["files/*/syntax", "files/*/options/features/**", "components/messages/*/options/features/**"]
const fileOption = (option: string) => [`files/*/options/${option}`]
// the resolved keywords of a field, an enum and a message (A4)
const fieldResolved = fieldAt(
  "presence",
  "utf8Validation",
  "items/utf8Validation",
  "additionalProperties/utf8Validation",
  "propertyNames/utf8Validation",
  "packed",
  "delimited",
)
const enumResolved = ["components/enums/*/closed", "components/enums/*/jsonFormat"]
const messageResolved = ["components/messages/*/jsonFormat"]

const rule = (at: string[], extra: Partial<BufRuleMapping> = {}): BufRuleMapping => ({ at, min: "breaking", ...extra })

export const bufRules: Record<string, BufRuleMapping> = {
  // deletions (§6.1 … §6.6)
  FILE_NO_DELETE: rule(["files/*", "files"]),
  PACKAGE_NO_DELETE: rule(["files/*", "files/*/package", "files"]),
  SERVICE_NO_DELETE: rule(["services/*", "services/*/file"]),
  PACKAGE_SERVICE_NO_DELETE: rule(["services/*"]),
  RPC_NO_DELETE: rule(["services/*/methods/*"]),
  MESSAGE_NO_DELETE: rule(["components/messages/*", "components/messages/*/file"]),
  PACKAGE_MESSAGE_NO_DELETE: rule(["components/messages/*"]),
  ENUM_NO_DELETE: rule(["components/enums/*", "components/enums/*/file"]),
  PACKAGE_ENUM_NO_DELETE: rule(["components/enums/*"]),
  EXTENSION_NO_DELETE: rule(["components/extensions/*", "components/extensions", "components/extensions/*/file"]),
  PACKAGE_EXTENSION_NO_DELETE: rule(["components/extensions/*", "components/extensions"]),
  FIELD_NO_DELETE: rule(["components/messages/*/properties/*"]),
  FIELD_NO_DELETE_UNLESS_NAME_RESERVED: rule(["components/messages/*/properties/*"]),
  FIELD_NO_DELETE_UNLESS_NUMBER_RESERVED: rule(["components/messages/*/properties/*"]),
  ENUM_VALUE_NO_DELETE: rule(["components/enums/*/values/*"]),
  ENUM_VALUE_NO_DELETE_UNLESS_NAME_RESERVED: rule(["components/enums/*/values/*"]),
  ENUM_VALUE_NO_DELETE_UNLESS_NUMBER_RESERVED: rule(["components/enums/*/values/*"]),
  ONEOF_NO_DELETE: rule([
    "components/messages/*/oneofs/*",
    "components/messages/*/oneofs",
    "components/messages/*/properties/*/oneof",
  ]),
  EXTENSION_MESSAGE_NO_DELETE: rule(["components/messages/*/extensions/**", "components/messages/*/extensions"], {
    named: false,
  }),
  RESERVED_MESSAGE_NO_DELETE: rule(["components/messages/*/reserved/**"], { named: false }),
  RESERVED_ENUM_NO_DELETE: rule(["components/enums/*/reserved/**"], { named: false }),
  // files (§6.1, §6.7)
  FILE_SAME_PACKAGE: rule(["files/*/package"]),
  FILE_SAME_SYNTAX: rule(["files/*/syntax"]),
  FILE_SAME_CC_ENABLE_ARENAS: rule(fileOption("cc_enable_arenas")),
  FILE_SAME_CC_GENERIC_SERVICES: rule(fileOption("cc_generic_services")),
  FILE_SAME_CSHARP_NAMESPACE: rule(fileOption("csharp_namespace")),
  FILE_SAME_GO_PACKAGE: rule(fileOption("go_package")),
  FILE_SAME_JAVA_GENERIC_SERVICES: rule(fileOption("java_generic_services")),
  FILE_SAME_JAVA_MULTIPLE_FILES: rule(fileOption("java_multiple_files")),
  FILE_SAME_JAVA_OUTER_CLASSNAME: rule(fileOption("java_outer_classname")),
  FILE_SAME_JAVA_PACKAGE: rule(fileOption("java_package")),
  FILE_SAME_OBJC_CLASS_PREFIX: rule(fileOption("objc_class_prefix")),
  FILE_SAME_OPTIMIZE_FOR: rule(fileOption("optimize_for")),
  FILE_SAME_PHP_CLASS_PREFIX: rule(fileOption("php_class_prefix")),
  FILE_SAME_PHP_METADATA_NAMESPACE: rule(fileOption("php_metadata_namespace")),
  FILE_SAME_PHP_NAMESPACE: rule(fileOption("php_namespace")),
  FILE_SAME_PY_GENERIC_SERVICES: rule(fileOption("py_generic_services")),
  FILE_SAME_RUBY_PACKAGE: rule(fileOption("ruby_package")),
  FILE_SAME_SWIFT_PREFIX: rule(fileOption("swift_prefix")),
  // services and methods (§6.2; S5: one record per side for type and streaming)
  RPC_SAME_REQUEST_TYPE: rule(["services/*/methods/*/request"]),
  RPC_SAME_CLIENT_STREAMING: rule(["services/*/methods/*/request"]),
  RPC_SAME_RESPONSE_TYPE: rule(["services/*/methods/*/response"]),
  RPC_SAME_SERVER_STREAMING: rule(["services/*/methods/*/response"]),
  RPC_SAME_IDEMPOTENCY_LEVEL: rule(["services/*/methods/*/idempotency"]),
  // messages (§6.3)
  MESSAGE_SAME_JSON_FORMAT: rule(["components/messages/*/jsonFormat", ...inherited], {
    merged: { at: messageResolved, mentions: /JSON format/ },
  }),
  MESSAGE_NO_REMOVE_STANDARD_DESCRIPTOR_ACCESSOR: rule([
    "components/messages/*/options/no_standard_descriptor_accessor",
  ]),
  MESSAGE_SAME_MESSAGE_SET_WIRE_FORMAT: rule(["components/messages/*/options/message_set_wire_format"]),
  MESSAGE_SAME_REQUIRED_FIELDS: rule(["components/messages/*/properties/*", ...fieldAt("presence")]),
  // enums and values (§6.5)
  ENUM_SAME_TYPE: rule(["components/enums/*/closed", "components/enums/*/options/features/**", ...inherited], {
    merged: { at: enumResolved, mentions: /enum type/ },
  }),
  ENUM_SAME_JSON_FORMAT: rule(
    ["components/enums/*/jsonFormat", "components/enums/*/options/features/**", ...inherited],
    {
      merged: { at: enumResolved, mentions: /JSON format/ },
    },
  ),
  ENUM_VALUE_SAME_NAME: rule(["components/enums/*/values", "components/enums/*/values/*"]),
  // fields (§6.4, §6.7)
  FIELD_SAME_NAME: rule(fieldRename),
  FIELD_SAME_JSON_NAME: rule([...fieldAt("jsonName"), ...fieldRename]),
  FIELD_SAME_TYPE: rule(shape),
  FIELD_WIRE_JSON_COMPATIBLE_TYPE: rule(shape),
  FIELD_WIRE_COMPATIBLE_TYPE: rule(shape),
  FIELD_SAME_CARDINALITY: rule([...shape, ...fieldAt("presence", "oneof"), ...inherited], {
    merged: { at: fieldResolved, mentions: /presence/ },
  }),
  FIELD_WIRE_JSON_COMPATIBLE_CARDINALITY: rule([...shape, ...fieldAt("presence")]),
  FIELD_WIRE_COMPATIBLE_CARDINALITY: rule([...shape, ...fieldAt("presence")]),
  FIELD_SAME_ONEOF: rule([...fieldAt("oneof"), "components/messages/*/oneofs", "components/messages/*/oneofs/*"]),
  FIELD_SAME_DEFAULT: rule(fieldAt("default")),
  FIELD_SAME_UTF8_VALIDATION: rule(
    [
      ...fieldAt(
        "utf8Validation",
        "items/utf8Validation",
        "additionalProperties/utf8Validation",
        "propertyNames/utf8Validation",
        "options/features/utf8_validation",
      ),
      ...inherited,
    ],
    { merged: { at: fieldResolved, mentions: /UTF-8 validation/ } },
  ),
  FIELD_SAME_CPP_STRING_TYPE: rule([
    ...fieldAt("options/ctype", "options/features/pb.cpp/**"),
    "files/*/options/features/pb.cpp/**",
    "components/messages/*/options/features/pb.cpp/**",
  ]),
  FIELD_SAME_JAVA_UTF8_VALIDATION: rule([
    ...fieldAt("options/features/pb.java/**"),
    "files/*/options/java_string_check_utf8",
    "files/*/options/features/pb.java/**",
    "components/messages/*/options/features/pb.java/**",
  ]),
  FIELD_SAME_JSTYPE: rule(fieldAt("options/jstype")),
}
