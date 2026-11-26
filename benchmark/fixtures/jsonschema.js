"use strict"
// JSON Schema fixtures: the repository pair test/resources/schema-before.yaml / schema-after.yaml with a hand-built
// expected list, an allOf-heavy synthetic document, a wide plain schema, and an identical pair.
//
// Semantics of a stand-alone JSON Schema (the default of compareJsonSchema in both api-smart-diff versions and of
// json-schema-diff): the schema validates data a client SENDS, so narrowing the set of valid instances is breaking and
// widening it is non-breaking ("request semantics").
const fs = require("node:fs")
const path = require("node:path")
const yaml = require("js-yaml")
const P = require("../scripts/paths")

const load = (f) => yaml.load(fs.readFileSync(path.join(P.ASD_RESOURCES, f), "utf8"))
const ptr = (...segs) => `/${segs.join("/")}/`.toLowerCase()

const repoExpected = () => [
  { id: "J1", what: "name.examples item 'Example name' removed", class: "annotation", tokens: [ptr("name", "examples")] },
  { id: "J2", what: "age.type number -> string", class: "breaking", tokens: [ptr("age", "type")] },
  { id: "J3", what: "age.minimum 10 -> 20 (inert: age became a string)", class: "annotation", accept: ["non-breaking", "unclassified", "breaking"], tokens: [ptr("age", "minimum")] },
  { id: "J4", what: "age.maximum 40 -> 30 (inert: age became a string)", class: "annotation", accept: ["non-breaking", "unclassified", "breaking"], tokens: [ptr("age", "maximum")] },
  { id: "J5", what: "age.x-param removed", class: "annotation", accept: ["unclassified", "non-breaking"], tokens: ["x-param"] },
  { id: "J6", what: "age.enum value 50 added (30/20 reordered)", class: "non-breaking", tokens: [ptr("age", "enum")] },
  { id: "J7", what: "age.readOnly true -> false", class: "non-breaking", accept: ["annotation"], tokens: [ptr("age", "readonly")] },
  { id: "J8", what: "completed_at.format date-time -> uuid", class: "breaking", tokens: [ptr("completed_at", "format")] },
  { id: "J9", what: "completed_at.pattern changed (stricter)", class: "breaking", tokens: [ptr("completed_at", "pattern")] },
  { id: "J10", what: "completed_at.description changed", class: "annotation", tokens: [ptr("completed_at", "description")] },
  { id: "J11", what: "items.description changed", class: "annotation", tokens: [ptr("items", "description")], not: ["/plan/"] },
  { id: "J12", what: "email.deprecated true -> false", class: "deprecated", accept: ["annotation", "non-breaking"], tokens: [ptr("email", "deprecated")] },
  { id: "J13", what: "email.default changed", class: "annotation", accept: ["non-breaking", "risky", "breaking"], tokens: [ptr("email", "default")] },
  { id: "J14", what: "plan.anyOf branch {type: number} removed (branches reordered)", class: "breaking", tokens: ["/plan/anyof"], not: ["/bar/", "/baz/", "description"] },
  { id: "J15", what: "plan.anyOf object bar string -> number", class: "breaking", tokens: ["/plan/", "/bar/"] },
  { id: "J16", what: "plan.anyOf object baz string -> boolean", class: "breaking", tokens: ["/plan/", "/baz/"] },
  { id: "J17", what: "plan.anyOf array branch description added", class: "annotation", tokens: ["/plan/", "description"] },
  { id: "J18", what: "permissions.properties ids -> ids12 (also seen through $ref by `ref`); an optional property removed is risky", class: "risky", accept: ["breaking"], tokens: ["/ids"] },
  { id: "J19", what: "patternProperties._name$ string -> number", class: "breaking", tokens: ["_name$"] },
  { id: "J20", what: "required: completed_at removed", class: "non-breaking", tokens: ["/required/"], not: ["/plan/"] },
]

// allOf-heavy: n definitions, each `allOf: [ {$ref: Base}, {$ref: Mixin<i%5>}, { own properties } ]`, a root object
// referencing all of them; Base and one mixin change
const allOfDoc = (n, changed) => {
  const defs = {
    Base: { type: "object", required: ["id"], properties: { id: { type: "string" }, createdAt: { type: changed ? "integer" : "string" } } },
  }
  for (let m = 0; m < 5; m++) defs[`Mixin${m}`] = { type: "object", properties: { [`mix${m}`]: { type: "string", maxLength: changed && m === 0 ? 10 : 20 } } }
  for (let i = 0; i < n; i++) {
    defs[`D${i}`] = {
      allOf: [{ $ref: "#/definitions/Base" }, { $ref: `#/definitions/Mixin${i % 5}` }, { type: "object", properties: { [`own${i}`]: { type: "string" }, [`count${i}`]: { type: "integer" } } }],
    }
  }
  return { type: "object", properties: Object.fromEntries(Array.from({ length: n }, (_, i) => [`d${i}`, { $ref: `#/definitions/D${i}` }])), definitions: defs }
}
const wide = (n, changed) => ({ type: "object", properties: Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, { type: changed && i % 20 === 0 ? "integer" : "string" }])) })

const fixtures = [
  { name: "js-repo-pair", family: "jsonschema", spec: "jsonschema", kind: "changeset", desc: "test/resources/schema-before.yaml -> schema-after.yaml (20 changes)", generate: () => ({ before: load("schema-before.yaml"), after: load("schema-after.yaml"), expected: repoExpected() }) },
  { name: "js-identical", family: "jsonschema", spec: "jsonschema", kind: "identical", desc: "test/resources/jsonschema.yaml compared with itself ($refs, nullable)", generate: () => ({ before: load("jsonschema.yaml"), after: load("jsonschema.yaml") }) },
  { name: "js-repo-identical", family: "jsonschema", spec: "jsonschema", kind: "identical", desc: "test/resources/schema-before.yaml compared with itself", generate: () => ({ before: load("schema-before.yaml"), after: load("schema-before.yaml") }) },
  { name: "js-allof-200", family: "jsonschema", spec: "jsonschema", kind: "synthetic", desc: "200 definitions of allOf [$ref Base, $ref Mixin, own props], root refs all; Base.createdAt type and Mixin0 maxLength change", generate: () => ({ before: allOfDoc(200, false), after: allOfDoc(200, true) }) },
  { name: "js-wide-4000", family: "jsonschema", spec: "jsonschema", kind: "synthetic", desc: "plain schema with 4 000 properties, every 20th type string -> integer", generate: () => ({ before: wide(4000, false), after: wide(4000, true) }) },
]

module.exports = { fixtures }
