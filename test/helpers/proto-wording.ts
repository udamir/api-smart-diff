// The R-D wording lint of ProtoApi descriptions (PROTOAPI_DESIGN §9.1 J16), shared by the J block (test/helpers/index.ts)
// and the compat family `protoapi` (test/helpers/compat.ts, also run by test/compat/report.ts outside the test runner).

import type { Diff } from "../../src"

// ProtoApi and JSON Schema keys that a description must never name (R-D)
const PROTO_FORBIDDEN_KEYS = [
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const FORBIDDEN_PATTERNS: [RegExp, string][] = [
  ...PROTO_FORBIDDEN_KEYS.map((key): [RegExp, string] => [new RegExp(`(^|[^\\w$])${escapeRegExp(key)}(?![\\w])`), key]),
  [/#\//, "#/"],
  [/required\[\]/, "required[]"],
  [/required fields/, "required fields"],
  [/(^|[^\w])x-[a-z]/, "x- name"],
]

// code spans that hold a name of a protobuf element (never a key of the format)
const NAME_SPAN =
  /\b(field|message|rpc|service|enum|value|alias|oneof|extension|file|import|package|declaration|to) `[^`]*`/g
const CODE_SPAN = /`[^`]*`/g
const FREE_TEXT_KEYS = new Set(["description", "title", "reason"])

/**
 * The R-D issues of a ProtoApi record's description (J16): a missing description, a ProtoApi or JSON Schema key name
 * (as a word or code span) outside the free text of description, title and reason records and outside element names,
 * or a value that is not a `.proto` literal (quoted digits, `Infinity` / `NaN`, ranges written `a-b`, a syntax
 * without its statement, an extension option without parentheses).
 */
export const protoWordingIssues = (diff: Diff): string[] => {
  const issues: string[] = []
  const text = diff.description
  if (!text || !/^\[(Added|Removed|Replaced|Renamed|Deprecated)\] /.test(text)) {
    return [`no description: ${diff.action} ${diff.path.join("/")}`]
  }
  const last = String(diff.path[diff.path.length - 1])
  const freeText =
    FREE_TEXT_KEYS.has(last) ||
    diff.path.includes("deprecation") ||
    diff.path.includes("x-annotation-conflicts") ||
    (diff.action !== "rename" && (diff.path.includes("title") || diff.path.includes("description")))
  let checked = text.replace(/ \(reason: .*\)$/, "")
  if (freeText) {
    checked = checked.replace(CODE_SPAN, "``")
  }
  checked = checked.replace(NAME_SPAN, (match) => match.replace(CODE_SPAN, "``"))
  for (const [pattern, key] of FORBIDDEN_PATTERNS) {
    if (pattern.test(checked)) {
      issues.push(`names \`${key}\`: ${text}`)
    }
  }
  if (/\b(Infinity|NaN)\b/.test(text)) {
    issues.push(`JSON spelling of a float: ${text}`)
  }
  const spans = (freeText ? "" : text).match(CODE_SPAN) ?? []
  for (const span of spans) {
    const value = span.slice(1, -1)
    if (/^"-?\d+"$/.test(value)) {
      issues.push(`quoted digits ${span}: ${text}`)
    }
    if (/^\d+-\d+$/.test(value)) {
      issues.push(`range written a-b ${span}: ${text}`)
    }
  }
  if (text.startsWith("[Replaced] syntax of file ")) {
    for (const span of spans.slice(1)) {
      if (!/^`(syntax|edition) = "/.test(span)) {
        issues.push(`syntax without its statement ${span}: ${text}`)
      }
    }
  }
  for (const match of text.matchAll(/\boption `([^`]*)`/g)) {
    const name = match[1].split(" = ")[0]
    if (/^[A-Za-z_]\w*\.[\w.]+/.test(name) && !name.startsWith("features.")) {
      issues.push(`extension option without parentheses \`${name}\`: ${text}`)
    }
  }
  return issues
}
