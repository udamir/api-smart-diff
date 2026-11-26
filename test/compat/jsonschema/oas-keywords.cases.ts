// OpenAPI schema vocabulary: 3.0 `nullable`, `discriminator`, `xml`, `example`, `externalDocs`, and the
// `readOnly` / `writeOnly` flags (keyword flips, and changes inside read-only request / write-only response
// properties, which oasdiff downgrades to INFO).

import { annotation, breaking, nonBreaking } from "../../../src"
import type { SchemaCase } from "../../helpers/compat"
import { both, body, property, rr, seq } from "./kw"

const id = seq("OAS")
const general = "test/compatibility-suites/schemas/schema-test-runner-general.ts"
const oasOnly = "test/compatibility-suites/schemas/schema-test-runner-openapi-only.ts"
const cs = (name: string, verdict?: string, runner = general) => [
  { tool: "compat-suites", ref: `schemas/json-schema/${name}` },
  { tool: "fork", ref: `${runner} ${name}`, ...(verdict ? { verdict } : {}) },
]
const oas = (ref: string, verdict?: string) => ({ tool: "oasdiff", ref, ...(verdict ? { verdict } : {}) })
const lib = (ref: string, verdict?: string) => ({
  tool: "libopenapi",
  ref: `what-changed/model/schema_test.go ${ref}`,
  ...(verdict ? { verdict } : {}),
})
const od = (ref: string, verdict?: string) => ({
  tool: "openapi-diff",
  ref: `core/src/test/java/org/openapitools/openapidiff/core/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const s = { type: "string" }
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const pets = {
  Cat: { type: "object", properties: { kind: s, lives: { type: "integer" } }, required: ["kind"] },
  Dog: { type: "object", properties: { kind: s, bark: s }, required: ["kind"] },
}
const poly = (discriminator?: unknown) => ({
  oneOf: [ref("Cat"), ref("Dog")],
  ...(discriminator ? { discriminator } : {}),
})

// ISSUE-71 (fixed): `nullable: true` widens the schema (request non-breaking, response breaking)
// POLICY-26 decided (d): added / removed non-breaking (validation unchanged, generated clients fall back to trying the
// branches), propertyName change and mapping entry removed / retargeted breaking (the serialization contract of
// generated clients), mapping entry added non-breaking
// ISSUE-137 (fixed): `discriminator` rules and descriptions of their own since P4
const DISCRIMINATOR = {}
// POLICY-27 decided (c): `xml` is classified by schema rules only where an XML media type uses the schema; the cases
// below place the schema under application/json, so every `xml` change is an annotation

export const cases: SchemaCase[] = [
  ...both({
    id: id(2),
    title: "OpenAPI 3.0: became nullable (nullable: true added)",
    before: "string",
    after: "string, nullable: true",
    rationale: "request: null becomes acceptable; response: clients that never handled null receive it",
    annotation: "states that null is allowed now (names nullable / null) and the location",
    sources: [
      ...cs("mark-schema-value-as-nullable", undefined, oasOnly),
      oas("checker/check_request_property_became_not_nuallable_test.go (nullable added)"),
    ],
    stems: ["became-nullable"],
    dialect: "3.0",
    schema: [s, { ...s, nullable: true }],
    expect: [{ at: "nullable", type: rr(nonBreaking, breaking), mentions: [/null/i] }],
    // ISSUE-71 (fixed)
  }),
  ...both({
    id: id(2),
    title: "OpenAPI 3.0: became not nullable (nullable: true removed)",
    before: "string, nullable: true",
    after: "string",
    rationale: "request: clients sending null are rejected; response: clients receive a subset",
    annotation: "states that null is no longer allowed and the location",
    sources: [
      ...cs("mark-schema-value-as-non-nullable", undefined, oasOnly),
      oas("checker/check_breaking_property_test.go request property became not nullable"),
    ],
    stems: ["became-not-nullable"],
    dialect: "3.0",
    schema: [{ ...s, nullable: true }, s],
    expect: [{ at: "nullable", type: rr(breaking, nonBreaking), mentions: [/null/i] }],
    // ISSUE-71 (fixed)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: nullable true -> false",
    before: "name: string, nullable: true",
    after: "name: string, nullable: false",
    rationale: "the same narrowing as removing nullable: request breaking, response non-breaking",
    annotation: "states that null is no longer allowed and the property",
    sources: [od("SchemaDiffTest.java changeNullableHandling", "compatible")],
    stems: ["became-not-nullable"],
    dialect: "3.0",
    schema: [
      { ...s, nullable: true },
      { ...s, nullable: false },
    ],
    expect: [{ at: "nullable", type: rr(breaking, nonBreaking), mentions: [/null/i] }],
    // ISSUE-71 (fixed)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: nullable: false added (the default value)",
    before: "name: string",
    after: "name: string, nullable: false",
    rationale: "`nullable: false` is the default",
    annotation: "no diff (or an annotation)",
    sources: [{ tool: "fork", ref: "test/oas-30-to-31.test.ts (nullable equivalences)" }],
    dialect: "3.0",
    schema: [s, { ...s, nullable: false }],
    expect: [{ at: "nullable", type: annotation, optional: true }],
    // ISSUE-70 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: nullable enum gains null support",
    before: "name: string, enum [a, b]",
    after: "name: string, enum [a, b], nullable: true",
    rationale:
      "with nullable: true, null is valid even though it is not listed in the enum (OAS 3.0.3 clarification): request non-breaking, response breaking",
    annotation: "states that null is allowed now",
    sources: [{ tool: "fork", ref: "test/oas-30-to-31.test.ts nullable enum is equivalent to union with null type" }],
    stems: ["became-nullable"],
    dialect: "3.0",
    schema: [
      { ...s, enum: ["a", "b"] },
      { ...s, enum: ["a", "b"], nullable: true },
    ],
    expect: [{ at: "nullable", type: rr(nonBreaking, breaking), mentions: [/null/i] }],
    // ISSUE-71 (fixed)
  }),
  body({
    id: id(),
    title: "OpenAPI 3.0: response header became nullable",
    before: "X-Rate: string",
    after: "X-Rate: string, nullable: true",
    rationale: "clients reading the header can receive null (oasdiff ERR)",
    annotation: "states that null is allowed now and names the header",
    sources: [oas("checker/check_response_header_became_nullable_test.go TestResponseHeaderBecameNullable")],
    covers: ["oasdiff:response-header-became-nullable"],
    placements: ["header"],
    dialect: "3.0",
    schema: [s, { ...s, nullable: true }],
    expect: [{ at: "nullable", type: breaking, mentions: [/null/i] }],
    // ISSUE-71 (fixed)
  }),
  body({
    id: id(),
    title: "OpenAPI 3.0: response header became not nullable",
    before: "X-Rate: string, nullable: true",
    after: "X-Rate: string",
    rationale: "clients receive a subset (oasdiff INFO)",
    annotation: "states that null is no longer allowed and names the header",
    sources: [oas("checker/check_response_header_became_nullable_test.go TestResponseHeaderBecameNotNullable")],
    covers: ["oasdiff:response-header-became-not-nullable"],
    placements: ["header"],
    dialect: "3.0",
    schema: [{ ...s, nullable: true }, s],
    expect: [{ at: "nullable", type: nonBreaking, mentions: [/null/i] }],
    // ISSUE-71 (fixed)
  }),
  body({
    id: id(),
    title: "3.1: response header became nullable (type [string, null])",
    before: "X-Rate: string",
    after: "X-Rate: [string, null]",
    rationale: "clients reading the header can receive null",
    annotation: "names the null type and the header",
    sources: [oas("checker/check_response_header_became_nullable_test.go (3.1 type arrays)")],
    covers: ["oasdiff:response-header-became-nullable"],
    placements: ["header"],
    schema: [s, { type: ["string", "null"] }],
    expect: [{ at: "type/*", action: "add", type: breaking, mentions: ["null"] }],
  }),
  ...both({
    id: id(2),
    title: "discriminator added",
    before: "oneOf [Cat, Dog]",
    after: "oneOf [Cat, Dog], discriminator kind",
    rationale: "validation does not change (oasdiff INFO, fork non-breaking); generated clients gain a faster dispatch",
    annotation: "names the discriminator and the location",
    sources: [
      ...cs("add-discriminator-for-one-of"),
      ...cs("add-discriminator-for-any-of"),
      { tool: "fork", ref: "test/openapi.add-required-fields.test.ts adding discriminator is not breaking" },
      lib("TestCompareSchemas_DiscriminatorAdd", "breaking"),
    ],
    stems: ["discriminator-added"],
    components: pets,
    schema: [poly(), poly({ propertyName: "kind" })],
    expect: [
      { at: ["discriminator", "discriminator/**"], action: "add", type: nonBreaking, mentions: ["discriminator"] },
    ],
    ...DISCRIMINATOR,
  }),
  ...both({
    id: id(2),
    title: "discriminator removed",
    before: "oneOf [Cat, Dog], discriminator kind",
    after: "oneOf [Cat, Dog]",
    rationale: "validation does not change (oasdiff INFO, fork non-breaking)",
    annotation: "names the discriminator and the location",
    sources: [
      ...cs("remove-discriminator-for-one-of"),
      ...cs("remove-discriminator-for-any-of"),
      lib("TestCompareSchemas_DiscriminatorRemove", "breaking"),
    ],
    stems: ["discriminator-removed"],
    components: pets,
    schema: [poly({ propertyName: "kind" }), poly()],
    expect: [
      { at: ["discriminator", "discriminator/**"], action: "remove", type: nonBreaking, mentions: ["discriminator"] },
    ],
    ...DISCRIMINATOR,
  }),
  ...both({
    id: id(2),
    title: "discriminator propertyName changed",
    before: "discriminator kind",
    after: "discriminator type",
    rationale:
      "generated clients dispatch on a different property: breaking for the serialization contract (openapi-diff INCOMPAT, libopenapi B; oasdiff INFO, fork non-breaking)",
    annotation: "names the discriminator property name and the location",
    sources: [
      ...cs("update-discriminator-for-one-of", "non-breaking"),
      od("SchemaBCTest.java discriminatorChanged"),
      lib("TestCompareSchemas_DiscriminatorChange"),
    ],
    stems: ["discriminator-property-name-changed"],
    components: pets,
    schema: [poly({ propertyName: "kind" }), poly({ propertyName: "type" })],
    expect: [
      {
        at: "discriminator/propertyName",
        action: "replace",
        type: breaking,
        mentions: [/property ?name|discriminator/i],
      },
    ],
    ...DISCRIMINATOR,
  }),
  ...both({
    id: id(2),
    title: "discriminator mapping entry added",
    before: "discriminator kind",
    after: "discriminator kind, mapping { cat: Cat }",
    rationale: "an explicit mapping for an existing branch: existing payloads keep their meaning",
    annotation: "names the mapping entry and the location",
    sources: [
      oas("checker/check_request_discriminator_updated_test.go (mapping added)"),
      od("OneOfDiffTest.java testDiffDifferentMapping"),
    ],
    stems: ["discriminator-mapping-added"],
    components: pets,
    schema: [
      poly({ propertyName: "kind" }),
      poly({ propertyName: "kind", mapping: { cat: "#/components/schemas/Cat" } }),
    ],
    expect: [
      {
        at: ["discriminator/mapping", "discriminator/mapping/*"],
        action: "add",
        type: nonBreaking,
        mentions: [/mapping|cat/i],
      },
    ],
    ...DISCRIMINATOR,
  }),
  ...both({
    id: id(2),
    title: "discriminator mapping entry deleted",
    before: "mapping { cat: Cat, dog: Dog }",
    after: "mapping { cat: Cat }",
    rationale: "payloads with kind dog no longer map explicitly (generated clients may fail to dispatch)",
    annotation: "names the mapping entry and the location",
    sources: [oas("checker/check_request_discriminator_updated_test.go (mapping deleted)", "INFO")],
    stems: ["discriminator-mapping-deleted"],
    components: pets,
    schema: [
      poly({ propertyName: "kind", mapping: { cat: "#/components/schemas/Cat", dog: "#/components/schemas/Dog" } }),
      poly({ propertyName: "kind", mapping: { cat: "#/components/schemas/Cat" } }),
    ],
    expect: [{ at: "discriminator/mapping/*", action: "remove", type: breaking, mentions: [/mapping|dog/i] }],
    ...DISCRIMINATOR,
  }),
  ...both({
    id: id(2),
    title: "discriminator mapping entry retargeted",
    before: "mapping { pet: Cat }",
    after: "mapping { pet: Dog }",
    rationale: "the same discriminator value now selects another schema",
    annotation: "names the mapping entry and the location",
    sources: [oas("checker/check_request_discriminator_updated_test.go (mapping changed)", "INFO")],
    stems: ["discriminator-mapping-changed"],
    components: pets,
    schema: [
      poly({ propertyName: "kind", mapping: { pet: "#/components/schemas/Cat" } }),
      poly({ propertyName: "kind", mapping: { pet: "#/components/schemas/Dog" } }),
    ],
    expect: [{ at: "discriminator/mapping/*", action: "replace", type: breaking, mentions: [/mapping|pet/i] }],
    ...DISCRIMINATOR,
  }),
  body({
    id: id(),
    title: "xml name added on a schema",
    before: "object",
    after: "object, xml { name: Pet }",
    rationale: "only the XML serialization changes",
    annotation: "names the xml keyword",
    sources: [...cs("add-xml-name-replacement-for-schema", "breaking", oasOnly)],
    schema: [{ type: "object" }, { type: "object", xml: { name: "Pet" } }],
    expect: [{ at: ["xml", "xml/*"], action: "add", type: annotation, mentions: ["xml"] }],
  }),
  body({
    id: id(),
    title: "xml name changed on a schema",
    before: "xml { name: Pet }",
    after: "xml { name: Animal }",
    rationale: "the XML element name changes",
    annotation: "names the xml keyword",
    sources: [
      ...cs("update-xml-name-replacement-for-schema", "breaking", oasOnly),
      lib("TestCompareSchemas_XMLChange", "breaking"),
    ],
    schema: [
      { type: "object", xml: { name: "Pet" } },
      { type: "object", xml: { name: "Animal" } },
    ],
    expect: [{ at: ["xml/name", "xml"], action: "replace", type: annotation, mentions: [/xml|name/i] }],
  }),
  body({
    id: id(),
    title: "xml removed from a schema",
    before: "xml { name: Pet }",
    after: "object",
    rationale: "the XML element name falls back to the default",
    annotation: "names the xml keyword",
    sources: [
      ...cs("remove-xml-name-replacement-for-schema", "breaking", oasOnly),
      lib("TestCompareSchemas_XMLRemove", "breaking"),
    ],
    schema: [{ type: "object", xml: { name: "Pet" } }, { type: "object" }],
    expect: [{ at: ["xml", "xml/*"], action: "remove", type: annotation, mentions: ["xml"] }],
  }),
  property({
    id: id(),
    title: "xml name added / changed on a property",
    before: "name: string, xml { name: n }",
    after: "name: string, xml { name: fullName }",
    rationale: "the XML element of the property changes",
    annotation: "names the xml keyword and the property",
    sources: [
      ...cs("update-xml-name-replacement-for-property", "breaking", oasOnly),
      ...cs("add-xml-name-replacement-for-property", "breaking", oasOnly),
      ...cs("remove-xml-name-replacement-for-property", "breaking", oasOnly),
    ],
    schema: [
      { ...s, xml: { name: "n" } },
      { ...s, xml: { name: "fullName" } },
    ],
    expect: [{ at: ["xml/name", "xml"], action: "replace", type: annotation, mentions: [/xml|name/i] }],
  }),
  property({
    id: id(),
    title: "property marked as xml attribute",
    before: "name: string",
    after: "name: string, xml { attribute: true }",
    rationale: "the property moves from an element to an attribute in XML",
    annotation: "names the xml keyword and the property",
    sources: cs("mark-property-as-xml-attribute", "breaking", oasOnly),
    schema: [s, { ...s, xml: { attribute: true } }],
    expect: [{ at: ["xml", "xml/attribute"], type: annotation, mentions: ["xml"] }],
  }),
  property({
    id: id(),
    title: "property marked as xml element (attribute: true removed)",
    before: "name: string, xml { attribute: true }",
    after: "name: string",
    rationale: "the property moves from an attribute to an element in XML",
    annotation: "names the xml keyword and the property",
    sources: cs("mark-property-as-xml-element", "breaking", oasOnly),
    schema: [{ ...s, xml: { attribute: true } }, s],
    expect: [{ at: ["xml", "xml/attribute"], type: annotation, mentions: ["xml"] }],
  }),
  body({
    id: id(),
    title: "xml prefix and namespace added / changed",
    before: "xml { prefix: a, namespace: urn:a }",
    after: "xml { prefix: b, namespace: urn:a }",
    rationale: "the XML prefix changes",
    annotation: "names the xml keyword",
    sources: [
      ...cs("update-xml-prefix-for-schema", "breaking", oasOnly),
      ...cs("add-xml-prefix-and-namespace-for-schema", "breaking", oasOnly),
      ...cs("remove-xml-prefix-and-namespace-for-schema", "breaking", oasOnly),
    ],
    schema: [
      { type: "object", xml: { prefix: "a", namespace: "urn:a" } },
      { type: "object", xml: { prefix: "b", namespace: "urn:a" } },
    ],
    expect: [{ at: ["xml/prefix", "xml"], action: "replace", type: annotation, mentions: [/xml|prefix/i] }],
  }),
  property({
    id: id(),
    title: "xml wrapped added / removed on an array property",
    before: "name: array",
    after: "name: array, xml { wrapped: true }",
    rationale: "the XML array gains a wrapping element",
    annotation: "names the xml keyword and the property",
    sources: [
      ...cs("add-xml-wrapped-for-array-property", "breaking", oasOnly),
      ...cs("remove-xml-wrapped-for-array-property", "breaking", oasOnly),
    ],
    schema: [
      { type: "array", items: s },
      { type: "array", items: s, xml: { wrapped: true } },
    ],
    expect: [{ at: ["xml", "xml/wrapped"], type: annotation, mentions: ["xml"] }],
  }),
  property({
    id: id(),
    title: "xml attribute: false / wrapped: false added (the default values)",
    before: "name: array",
    after: "name: array, xml { attribute: false, wrapped: false }",
    rationale: "both are the defaults: the XML serialization does not change",
    annotation: "no diff (or an annotation)",
    sources: [
      ...cs("add-attribute-with-default-value-for-xml", undefined, oasOnly),
      ...cs("add-xml-wrapped-with-default-value-for-array-property", undefined, oasOnly),
      ...cs("remove-attribute-with-default-value-for-xml", undefined, oasOnly),
      ...cs("remove-xml-wrapped-with-default-value-for-array-property", undefined, oasOnly),
    ],
    schema: [
      { type: "array", items: s },
      { type: "array", items: s, xml: { attribute: false, wrapped: false } },
    ],
    expect: [{ at: ["xml", "xml/*"], type: annotation, optional: true }],
  }),
  property({
    id: id(),
    title: "OpenAPI example changed",
    before: "name: string, example a",
    after: "name: string, example b",
    rationale: "examples are annotations",
    annotation: "an annotation naming the example and the property",
    sources: [lib("TestCompareSchemas_Example"), od("ExamplesDiffTest.java issue666OAS30ExampleInSchema")],
    dialect: "3.0",
    schema: [
      { ...s, example: "a" },
      { ...s, example: "b" },
    ],
    expect: [{ at: "example", action: "replace", type: annotation, mentions: ["example"] }],
  }),
  property({
    id: id(),
    title: "externalDocs added to a schema",
    before: "name: string",
    after: "name: string, externalDocs { url }",
    rationale: "documentation only",
    annotation: "an annotation naming externalDocs and the property",
    sources: [lib("TestCompareSchemas_ExternalDocsAdd")],
    schema: [s, { ...s, externalDocs: { url: "https://example.com/name" } }],
    expect: [
      { at: ["externalDocs", "externalDocs/*"], action: "add", type: annotation, mentions: [/external ?docs/i] },
    ],
  }),
  body({
    id: id(),
    title: "optional property became read-only",
    before: "object { a }",
    after: "object { a (readOnly) }",
    rationale:
      "request: clients that send a now send a property the server SHOULD NOT receive (oasdiff WARN, fork breaking, openapi-diff INCOMPAT); response: no change for readers",
    annotation: "names the readOnly status and the property",
    sources: [
      ...cs("mark-object-property-as-read-only"),
      oas(
        "checker/check_request_property_write_only_read_only_test.go TestRequestOptionalPropertyBecameReadOnly",
        "request: WARN",
      ),
      od("ReadOnlyBCTest.java requestReadOnlyIncreased"),
    ],
    covers: [
      "oasdiff:request-optional-property-became-read-only",
      "oasdiff:response-optional-property-became-read-only",
    ],
    schema: [
      { type: "object", properties: { a: s } },
      { type: "object", properties: { a: { ...s, readOnly: true } } },
    ],
    expect: [{ at: "properties/a/readOnly", type: rr(breaking, nonBreaking), mentions: ["readOnly", "`a`"] }],
  }),
  body({
    id: id(),
    title: "required property became read-only",
    before: "object { a }, required [a]",
    after: "object { a (readOnly) }, required [a]",
    rationale:
      "request: clients must no longer send a property they were required to send (oasdiff WARN); response: a is still delivered",
    annotation: "names the readOnly status and the property",
    sources: [
      oas(
        "checker/check_request_property_write_only_read_only_test.go TestRequestRequiredPropertyBecameReadOnly",
        "request: WARN",
      ),
    ],
    covers: [
      "oasdiff:request-required-property-became-read-only",
      "oasdiff:response-required-property-became-read-only",
    ],
    schema: [
      { type: "object", properties: { a: s }, required: ["a"] },
      { type: "object", properties: { a: { ...s, readOnly: true } }, required: ["a"] },
    ],
    expect: [{ at: "properties/a/readOnly", type: rr(breaking, nonBreaking), mentions: ["readOnly", "`a`"] }],
  }),
  body({
    id: id(),
    title: "optional property became not read-only",
    before: "object { a (readOnly) }",
    after: "object { a }",
    rationale:
      "request: clients may send a now; response: readers are unaffected (fork non-breaking in both directions, openapi-diff compatible)",
    annotation: "names the readOnly status and the property",
    sources: [
      ...cs("mark-object-property-as-not-read-only"),
      oas("checker/check_request_property_write_only_read_only_test.go TestRequestOptionalPropertyBecameNonReadOnly"),
      od("ReadOnlyBCTest.java changedButCompatible"),
    ],
    covers: [
      "oasdiff:request-optional-property-became-not-read-only",
      "oasdiff:response-optional-property-became-not-read-only",
    ],
    schema: [
      { type: "object", properties: { a: { ...s, readOnly: true } } },
      { type: "object", properties: { a: s } },
    ],
    expect: [{ at: "properties/a/readOnly", type: nonBreaking, mentions: ["readOnly", "`a`"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "OpenAPI 3.0: required property became not read-only",
    before: "object { a (readOnly) }, required [a]",
    after: "object { a }, required [a]",
    rationale:
      "in 3.0 a required read-only property is required in responses only; without readOnly it becomes required in requests, so clients that omit it are rejected (oasdiff ERR, openapi-diff INCOMPAT)",
    annotation: "names the readOnly status and the property",
    sources: [
      oas("checker/check_request_property_write_only_read_only_test.go TestRequestRequiredPropertyBecameNonReadOnly"),
      od("ReadOnlyBCTest.java requestReadOnlyRequiredDecreased"),
    ],
    covers: [
      "oasdiff:request-required-property-became-not-read-only",
      "oasdiff:response-required-property-became-not-read-only",
    ],
    dialect: "3.0",
    schema: [
      { type: "object", properties: { a: { ...s, readOnly: true } }, required: ["a"] },
      { type: "object", properties: { a: s }, required: ["a"] },
    ],
    expect: [{ at: "properties/a/readOnly", type: rr(breaking, nonBreaking), mentions: ["readOnly", "`a`"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "3.1: required property became not read-only",
    before: "object { a (readOnly) }, required [a]",
    after: "object { a }, required [a]",
    rationale:
      "3.1 has no special readOnly + required rule, so a was already required in requests (oasdiff INFO request-required-property-became-not-read-only-in-openapi-31)",
    annotation: "names the readOnly status and the property",
    sources: [
      oas("checker/check_request_property_write_only_read_only_test.go TestRequestRequiredPropertyBecameNonReadOnly31"),
    ],
    covers: ["oasdiff:request-required-property-became-not-read-only-in-openapi-31"],
    placements: ["request"],
    schema: [
      { type: "object", properties: { a: { ...s, readOnly: true } }, required: ["a"] },
      { type: "object", properties: { a: s }, required: ["a"] },
    ],
    expect: [{ at: "properties/a/readOnly", type: nonBreaking, mentions: ["readOnly", "`a`"] }],
  }),
  body({
    id: id(),
    title: "optional property became write-only",
    before: "object { a }",
    after: "object { a (writeOnly) }",
    rationale:
      "request: clients keep sending a; response: a is no longer returned, like removing an optional response property (oasdiff INFO, fork non-breaking)",
    annotation: "names the writeOnly status and the property",
    sources: [
      ...cs("mark-object-property-as-write-only"),
      oas("checker/check_request_property_write_only_read_only_test.go (optional became write-only)"),
    ],
    covers: [
      "oasdiff:request-optional-property-became-write-only",
      "oasdiff:response-optional-property-became-write-only",
    ],
    schema: [
      { type: "object", properties: { a: s } },
      { type: "object", properties: { a: { ...s, writeOnly: true } } },
    ],
    expect: [{ at: "properties/a/writeOnly", type: nonBreaking, mentions: ["writeOnly", "`a`"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "required response property became write-only",
    before: "object { a }, required [a]",
    after: "object { a (writeOnly) }, required [a]",
    rationale:
      "response: a required property is no longer returned (oasdiff ERR, openapi-diff INCOMPAT); request: clients keep sending it",
    annotation: "names the writeOnly status and the property",
    sources: [
      oas(
        "checker/check_response_required_property_write_only_read_only_test.go TestResponseRequiredPropertyBecameWriteOnly",
      ),
      od("WriteOnlyBCTest.java responseWriteOnlyIncreased"),
    ],
    covers: [
      "oasdiff:response-required-property-became-write-only",
      "oasdiff:request-required-property-became-write-only",
    ],
    schema: [
      { type: "object", properties: { a: s }, required: ["a"] },
      { type: "object", properties: { a: { ...s, writeOnly: true } }, required: ["a"] },
    ],
    expect: [{ at: "properties/a/writeOnly", type: rr(nonBreaking, breaking), mentions: ["writeOnly", "`a`"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "property became not write-only",
    before: "object { a (writeOnly) }",
    after: "object { a }",
    rationale:
      "response: a starts to be returned, like adding an optional property (oasdiff INFO, fork non-breaking, openapi-diff compatible); request: unchanged",
    annotation: "names the writeOnly status and the property",
    sources: [...cs("mark-object-property-as-not-write-only"), od("WriteOnlyBCTest.java changedButCompatible")],
    covers: [
      "oasdiff:request-optional-property-became-not-write-only",
      "oasdiff:response-optional-property-became-not-write-only",
    ],
    schema: [
      { type: "object", properties: { a: { ...s, writeOnly: true } } },
      { type: "object", properties: { a: s } },
    ],
    expect: [{ at: "properties/a/writeOnly", type: nonBreaking, mentions: ["writeOnly", "`a`"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "required property became not write-only",
    before: "object { a (writeOnly) }, required [a]",
    after: "object { a }, required [a]",
    rationale: "response: a is now returned and guaranteed (oasdiff INFO); request: unchanged",
    annotation: "names the writeOnly status and the property",
    sources: [
      oas("checker/check_response_required_property_write_only_read_only_test.go (required became not write-only)"),
    ],
    covers: [
      "oasdiff:response-required-property-became-not-write-only",
      "oasdiff:request-required-property-became-not-write-only",
    ],
    schema: [
      { type: "object", properties: { a: { ...s, writeOnly: true } }, required: ["a"] },
      { type: "object", properties: { a: s }, required: ["a"] },
    ],
    expect: [{ at: "properties/a/writeOnly", type: nonBreaking, mentions: ["writeOnly", "`a`"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "readOnly property in a request: constraint tightened (maxLength decreased)",
    before: "object { id (readOnly, maxLength 10) }",
    after: "object { id (readOnly, maxLength 5) }",
    rationale:
      "clients do not send read-only properties, so tightening them cannot break a request (oasdiff INFO request-read-only-property-*)",
    annotation: "names the keyword and the property",
    sources: [
      oas(
        "checker/check_request_property_max_length_updated_test.go TestRequestReadOnlyPropertyMaxLengthDecreasedCheck",
      ),
    ],
    covers: ["oasdiff:request-read-only-property-max-length-decreased"],
    placements: ["request"],
    schema: [
      { type: "object", properties: { id: { ...s, readOnly: true, maxLength: 10 } } },
      { type: "object", properties: { id: { ...s, readOnly: true, maxLength: 5 } } },
    ],
    expect: [{ at: "properties/id/maxLength", action: "replace", type: nonBreaking, mentions: ["maxLength", "`id`"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "readOnly property in a request: numeric bounds tightened",
    before: "object { n (readOnly, min 0, max 100, exclusiveMinimum 0, exclusiveMaximum 100) }",
    after: "object { n (readOnly, min 1, max 99, exclusiveMinimum 1, exclusiveMaximum 99) }",
    rationale: "clients do not send read-only properties (oasdiff INFO request-read-only-property-*)",
    annotation: "names the keywords and the property",
    sources: [oas("checker/check_request_property_max_updated_test.go / min / exclusive (read-only downgrade)")],
    covers: [
      "oasdiff:request-read-only-property-max-decreased",
      "oasdiff:request-read-only-property-min-increased",
      "oasdiff:request-read-only-property-exclusive-max-decreased",
      "oasdiff:request-read-only-property-exclusive-min-increased",
    ],
    placements: ["request"],
    schema: [
      {
        type: "object",
        properties: {
          n: { type: "number", readOnly: true, minimum: 0, maximum: 100 },
          m: { type: "number", readOnly: true, exclusiveMinimum: 0, exclusiveMaximum: 100 },
        },
      },
      {
        type: "object",
        properties: {
          n: { type: "number", readOnly: true, minimum: 1, maximum: 99 },
          m: { type: "number", readOnly: true, exclusiveMinimum: 1, exclusiveMaximum: 99 },
        },
      },
    ],
    expect: [
      {
        at: [
          "properties/*/minimum",
          "properties/*/maximum",
          "properties/*/exclusiveMinimum",
          "properties/*/exclusiveMaximum",
        ],
        action: "replace",
        type: nonBreaking,
        mentions: [/m/],
      },
    ],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "readOnly property in a request: maxItems / maxProperties decreased, enum value removed",
    before: "object { tags (readOnly, maxItems 10), meta (readOnly, maxProperties 10), state (readOnly, enum [a, b]) }",
    after: "object { tags (maxItems 5), meta (maxProperties 5), state (enum [a]) }",
    rationale: "clients do not send read-only properties (oasdiff INFO request-read-only-property-*)",
    annotation: "names the keywords and the properties",
    sources: [
      oas("checker/check_request_property_max_items_updated_test.go / max_properties / enum (read-only downgrade)"),
    ],
    covers: [
      "oasdiff:request-read-only-property-max-items-decreased",
      "oasdiff:request-read-only-property-max-properties-decreased",
      "oasdiff:request-read-only-property-enum-value-removed",
    ],
    placements: ["request"],
    schema: [
      {
        type: "object",
        properties: {
          tags: { type: "array", items: s, readOnly: true, maxItems: 10 },
          meta: { type: "object", readOnly: true, maxProperties: 10 },
          state: { ...s, readOnly: true, enum: ["a", "b"] },
        },
      },
      {
        type: "object",
        properties: {
          tags: { type: "array", items: s, readOnly: true, maxItems: 5 },
          meta: { type: "object", readOnly: true, maxProperties: 5 },
          state: { ...s, readOnly: true, enum: ["a"] },
        },
      },
    ],
    expect: [
      {
        at: ["properties/tags/maxItems", "properties/meta/maxProperties", "properties/state/enum/*"],
        type: nonBreaking,
      },
    ],
    // ISSUE-72 (fixed): the read-only property is muted in the request; the enum value description is ISSUE-57
    // ISSUE-57 (fixed) (P8a)
  }),
  body({
    id: id(),
    title: "writeOnly property in a response: enum value added",
    before: "object { secret (writeOnly, enum [a]) }",
    after: "object { secret (writeOnly, enum [a, b]) }",
    rationale:
      "write-only properties are never returned, so a new value cannot reach a reader (oasdiff INFO response-write-only-property-enum-value-added)",
    annotation: "names the added value and the property",
    sources: [
      oas("checker/check_response_property_enum_value_added_test.go TestResponseWriteOnlyPropertyEnumValueAdded"),
    ],
    covers: ["oasdiff:response-write-only-property-enum-value-added"],
    placements: ["response"],
    schema: [
      { type: "object", properties: { secret: { ...s, writeOnly: true, enum: ["a"] } } },
      { type: "object", properties: { secret: { ...s, writeOnly: true, enum: ["a", "b"] } } },
    ],
    expect: [{ at: "properties/secret/enum/*", action: "add", type: nonBreaking, mentions: ["`secret`"] }],
    // ISSUE-72 (fixed): the write-only property is muted in the response; the enum value description is ISSUE-57
    // ISSUE-57 (fixed) (P8a)
  }),
  body({
    id: id(),
    title: "writeOnly property in a response: became optional / required",
    before: "object { secret (writeOnly), other (writeOnly) }, required [secret]",
    after: "the same, required [other]",
    rationale:
      "write-only properties are never returned, so their required status does not matter to readers (oasdiff INFO response-write-only-property-became-optional / -required)",
    annotation: "names the properties and their required status",
    sources: [
      oas("checker/check_response_property_became_optional_test.go TestResponseWriteOnlyPropertyBecameOptionalCheck"),
    ],
    covers: [
      "oasdiff:response-write-only-property-became-optional",
      "oasdiff:response-write-only-property-became-required",
    ],
    placements: ["response"],
    schema: [
      {
        type: "object",
        properties: { secret: { ...s, writeOnly: true }, other: { ...s, writeOnly: true } },
        required: ["secret"],
      },
      {
        type: "object",
        properties: { secret: { ...s, writeOnly: true }, other: { ...s, writeOnly: true } },
        required: ["other"],
      },
    ],
    expect: [{ at: "required/*", type: nonBreaking, mentions: ["required"] }],
    // ISSUE-72 (fixed)
  }),
  body({
    id: id(),
    title: "writeOnly property in a response: added / removed",
    before: "object { a, secret (writeOnly), required [a, secret]; old (writeOnly) }",
    after: "object { a, token (writeOnly), required [a, token]; new (writeOnly) }",
    rationale:
      "write-only properties are never returned: adding or removing them, required or not, does not affect readers (oasdiff INFO response-*-write-only-property-*)",
    annotation: "names the added and removed properties",
    sources: [
      oas(
        "checker/check_response_required_property_updated_test.go TestResponseRequiredWriteOnlyPropertyAdded Removed",
      ),
      oas("checker/check_response_optional_property_updated_test.go (write-only)"),
    ],
    covers: [
      "oasdiff:response-required-write-only-property-added",
      "oasdiff:response-required-write-only-property-removed",
      "oasdiff:response-optional-write-only-property-added",
      "oasdiff:response-optional-write-only-property-removed",
    ],
    placements: ["response"],
    schema: [
      {
        type: "object",
        properties: { a: s, secret: { ...s, writeOnly: true }, old: { ...s, writeOnly: true } },
        required: ["a", "secret"],
      },
      {
        type: "object",
        properties: { a: s, token: { ...s, writeOnly: true }, new: { ...s, writeOnly: true } },
        required: ["a", "token"],
      },
    ],
    expect: [{ at: ["properties/*", "required/*"], type: nonBreaking }],
    // ISSUE-72 (fixed)
  }),
]
