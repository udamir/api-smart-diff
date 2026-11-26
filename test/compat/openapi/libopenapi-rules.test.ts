// Cases harvested from the pb33f libopenapi breaking rules (`what-changed/model/breaking_rules.go` buildDefaultRules)
// for the Component.Property rows that no existing case covered (checklist test/compat/coverage/
// libopenapi-breaking-rules.json). libopenapi's own verdict is the default rule (added / modified / removed breaking);
// the expectations below follow the consumer viewpoint and the decided policies of temp/TASK_2.0.0_COMPLETENESS.md §3.0.

import { annotation, breaking, nonBreaking, unclassified } from "../../../src"
import { type CompatCase, risky, runCases } from "../../helpers/compat"
import { rr } from "../jsonschema/kw"

const info = { title: "compat", version: "1.0.0" }
const ok = { 200: { description: "ok" } }
const str = { type: "string" }
const oas = (extra: Record<string, unknown> = {}, openapi = "3.1.0") => ({ openapi, info, paths: {}, ...extra })
const rules = (ref: string, verdict?: string) => ({
  tool: "libopenapi",
  ref: `what-changed/model/breaking_rules.go ${ref}`,
  ...(verdict ? { verdict } : {}),
})

/** POST /a whose request body carries the given media type object; GET /a whose 200 response carries it */
const reqBody = (media: Record<string, unknown>, openapi = "3.1.0", extra: Record<string, unknown> = {}) => ({
  openapi,
  info,
  paths: { "/a": { post: { requestBody: { content: media }, responses: ok } } },
  ...extra,
})
const resBody = (media: Record<string, unknown>, openapi = "3.1.0", extra: Record<string, unknown> = {}) => ({
  openapi,
  info,
  paths: { "/a": { get: { responses: { 200: { description: "ok", content: media } } } } },
  ...extra,
})
const RQ = "paths/~1a/post/requestBody/content"
const RS = "paths/~1a/get/responses/200/content"

/** GET /a whose 200 response declares the header X-Rate */
const rate = (header: Record<string, unknown>) => ({
  openapi: "3.1.0",
  info,
  paths: { "/a": { get: { responses: { 200: { description: "ok", headers: { "X-Rate": header } } } } } },
})
const XR = "paths/~1a/get/responses/200/headers/X-Rate"

/** API secured by the scheme S */
const secured = (scheme: unknown) => ({
  openapi: "3.1.0",
  info,
  security: [{ S: [] }],
  paths: { "/a": { get: { responses: ok } } },
  components: { securitySchemes: { S: scheme } },
})
const oauth2 = {
  type: "oauth2",
  flows: { clientCredentials: { tokenUrl: "https://auth.example.com/token", scopes: {} } },
}
const bearer = { type: "http", scheme: "bearer" }
const SS = "components/securitySchemes/S"

/** 2020-12 recursive tree whose children use a dynamic reference */
const tree = (target: string, anchor = "node") => ({
  $dynamicAnchor: anchor,
  type: "object",
  properties: { children: { type: "array", items: { $dynamicRef: target } } },
  $defs: { leaf: { $dynamicAnchor: "leaf", type: "string" } },
})

/** 3.2 polymorphic body with a discriminator */
const pets = {
  schemas: {
    Cat: { type: "object", properties: { kind: str, lives: { type: "integer" } } },
    Dog: { type: "object", properties: { kind: str, bark: str } },
  },
}
const poly = (discriminator: Record<string, unknown>) => ({
  "application/json": {
    schema: {
      oneOf: [{ $ref: "#/components/schemas/Cat" }, { $ref: "#/components/schemas/Dog" }],
      discriminator: { propertyName: "kind", ...discriminator },
    },
  },
})
const DM = "schema/discriminator/defaultMapping"

/** object with the property `id`, optionally carrying an `xml` object */
const xmlObj = (xml?: Record<string, unknown>) => ({
  schema: { type: "object", properties: { id: { type: "string", ...(xml ? { xml } : {}) } } },
})

const cases: CompatCase[] = [
  {
    kind: "doc",
    id: "OAS-LOR-001",
    area: "versions",
    title: "3.1 jsonSchemaDialect changed and removed",
    before: "jsonSchemaDialect https://spec.openapis.org/oas/3.1/dialect/base",
    after: "jsonSchemaDialect https://json-schema.org/draft/2020-12/schema / no jsonSchemaDialect",
    rationale:
      "the default dialect only says how schemas without `$schema` are read; the schemas themselves are compared as they are (POLICY-28: an equivalent rewrite is an annotation), so the dialect field is document metadata",
    annotation: "names jsonSchemaDialect",
    sources: [rules("JSONSchemaDialect modified / removed", "breaking")],
    covers: ["lo:JSONSchemaDialect"],
    docs: {
      changed: [
        oas({ jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base" }),
        oas({ jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema" }),
      ],
      removed: [oas({ jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base" }), oas()],
    },
    expect: {
      changed: [{ at: "jsonSchemaDialect", action: "replace", type: annotation, mentions: ["jsonSchemaDialect"] }],
      removed: [{ at: "jsonSchemaDialect", action: "remove", type: annotation, mentions: ["jsonSchemaDialect"] }],
    },
  },
  {
    kind: "doc",
    id: "OAS-LOR-002",
    area: "servers-tags-info",
    title: "info contact name and url changed",
    before: "contact { name: API team, url: https://a.example.com }",
    after: "contact { name: Platform team, url: https://b.example.com }",
    rationale: "contact details are documentation for humans; no request or response changes",
    annotation: "names the contact field that changed",
    sources: [rules("Contact.Name / Contact.URL (never breaking)")],
    covers: ["lo:Contact.Name", "lo:Contact.URL"],
    docs: [
      oas({ info: { ...info, contact: { name: "API team", url: "https://a.example.com" } } }),
      oas({ info: { ...info, contact: { name: "Platform team", url: "https://b.example.com" } } }),
    ],
    expect: [
      { at: "info/contact/name", action: "replace", type: annotation, mentions: ["contact", "name"] },
      { at: "info/contact/url", action: "replace", type: annotation, mentions: ["contact", "url"] },
    ],
  },
  {
    kind: "doc",
    id: "OAS-LOR-003",
    area: "refs-components",
    title: "components object removed and added as a whole while nothing references it",
    before: "components.schemas { Tag } (unused) / no components",
    after: "no components / components.schemas { Tag } (unused)",
    rationale:
      "no operation references Tag: the definitions have no effect on any request or response, so the change is unclassified with a description (decision §11.4, POLICY-18)",
    annotation: "names the components that were removed / added",
    sources: [rules("Components removed", "breaking")],
    covers: ["lo:Components"],
    docs: {
      removed: [oas({ components: { schemas: { Tag: str } } }), oas()],
      added: [oas(), oas({ components: { schemas: { Tag: str } } })],
    },
    expect: {
      removed: [
        { at: ["components", "components/**"], action: "remove", type: unclassified, mentions: [/components|Tag/] },
      ],
      added: [{ at: ["components", "components/**"], action: "add", type: unclassified, mentions: [/components|Tag/] }],
    },
    // ISSUE-69 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-LOR-004",
    area: "responses",
    title: "all responses removed from an operation (3.1 responses object optional)",
    before: "GET /a with responses 200",
    after: "GET /a without `responses`",
    rationale: "clients lose the documented success outcome (the mirror of OAS-RS-028, responses added)",
    annotation: "names the removed responses (status 200)",
    sources: [rules("Operation.Responses removed")],
    covers: ["lo:Operation.Responses"],
    docs: [
      { openapi: "3.1.0", info, paths: { "/a": { get: { responses: ok } } } },
      { openapi: "3.1.0", info, paths: { "/a": { get: {} } } },
    ],
    expect: [
      {
        at: ["paths/~1a/get/responses", "paths/~1a/get/responses/200"],
        action: "remove",
        type: breaking,
        mentions: ["200"],
      },
    ],
    // ISSUE-85 (fixed) (P8-OAS)
  },
  {
    kind: "doc",
    id: "OAS-LOR-005",
    area: "encoding",
    title: "3.2 itemEncoding added to and removed from a streamed request",
    before: "multipart/mixed itemSchema string without itemEncoding / with itemEncoding contentType image/png",
    after: "with itemEncoding contentType image/png / without itemEncoding",
    rationale:
      "an explicit item content type replaces the default (text/plain for a string item): callers streaming the default are rejected; dropping it accepts the default again (as OAS-ENC-001 / OAS-ENC-003 for form parts)",
    annotation: "names the item encoding and the request body media type",
    sources: [rules("MediaType.ItemEncoding removed", "breaking")],
    covers: ["lo:MediaType.ItemEncoding"],
    docs: {
      added: [
        reqBody({ "multipart/mixed": { itemSchema: str } }, "3.2.0"),
        reqBody({ "multipart/mixed": { itemSchema: str, itemEncoding: { contentType: "image/png" } } }, "3.2.0"),
      ],
      removed: [
        reqBody({ "multipart/mixed": { itemSchema: str, itemEncoding: { contentType: "image/png" } } }, "3.2.0"),
        reqBody({ "multipart/mixed": { itemSchema: str } }, "3.2.0"),
      ],
    },
    expect: {
      added: [
        {
          at: [`${RQ}/multipart~1mixed/itemEncoding`, `${RQ}/multipart~1mixed/itemEncoding/*`],
          action: "add",
          type: breaking,
          mentions: ["itemEncoding", "multipart/mixed"],
        },
      ],
      removed: [
        {
          at: [`${RQ}/multipart~1mixed/itemEncoding`, `${RQ}/multipart~1mixed/itemEncoding/*`],
          action: "remove",
          type: nonBreaking,
          mentions: ["itemEncoding", "multipart/mixed"],
        },
      ],
    },
    // ISSUE-85 (fixed) (P8a)
  },
  {
    kind: "doc",
    id: "OAS-LOR-006",
    area: "headers",
    title: "response header switched between `schema` and `content`",
    before: "X-Rate schema integer / X-Rate content text/plain schema integer",
    after: "X-Rate content text/plain schema integer / X-Rate schema integer",
    rationale:
      "response semantics: the old representation is no longer promised (removed: clients lose the guarantee they parse against, breaking), the new one constrains what the server sends (added: non-breaking); the mirror of OAS-PARAM-037 for a parameter",
    annotation: "names the header, the status code and the representation (schema / content) that changed",
    sources: [rules("Header.Schema added / removed", "breaking")],
    covers: ["lo:Header.Schema"],
    docs: {
      toContent: [
        rate({ schema: { type: "integer" } }),
        rate({ content: { "text/plain": { schema: { type: "integer" } } } }),
      ],
      toSchema: [
        rate({ content: { "text/plain": { schema: { type: "integer" } } } }),
        rate({ schema: { type: "integer" } }),
      ],
    },
    expect: {
      toContent: [
        { at: `${XR}/schema`, action: "remove", type: breaking, mentions: ["X-Rate", "200"] },
        { at: [`${XR}/content`, `${XR}/content/*`], action: "add", type: nonBreaking, mentions: ["X-Rate", "200"] },
      ],
      toSchema: [
        { at: [`${XR}/content`, `${XR}/content/*`], action: "remove", type: breaking, mentions: ["X-Rate", "200"] },
        { at: `${XR}/schema`, action: "add", type: nonBreaking, mentions: ["X-Rate", "200"] },
      ],
    },
    // ISSUE-62 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-LOR-007",
    area: "security",
    title: "oauth2 scheme replaced by HTTP bearer and back (flows removed / added)",
    before: "scheme S oauth2 clientCredentials / http bearer",
    after: "scheme S http bearer / oauth2 clientCredentials",
    rationale:
      "clients obtain and send credentials the server no longer accepts: the type change is breaking; the fields of the new type are new requirements (breaking), the dropped fields of the old type are no longer used (non-breaking), as OAS-SEC-028",
    annotation: "names the scheme S and the field that changed",
    sources: [rules("SecurityScheme.Flows removed / SecurityScheme.Type modified")],
    covers: ["lo:SecurityScheme.Flows"],
    docs: { toBearer: [secured(oauth2), secured(bearer)], toOauth2: [secured(bearer), secured(oauth2)] },
    expect: {
      toBearer: [
        { at: `${SS}/type`, action: "replace", type: breaking, mentions: ["S", "type"] },
        { at: `${SS}/scheme`, action: "add", type: breaking, mentions: ["S", "scheme"] },
        { at: [`${SS}/flows`, `${SS}/flows/**`], action: "remove", type: nonBreaking, mentions: ["S", "flows"] },
      ],
      toOauth2: [
        { at: `${SS}/type`, action: "replace", type: breaking, mentions: ["S", "type"] },
        { at: [`${SS}/flows`, `${SS}/flows/**`], action: "add", type: breaking, mentions: ["S", "flows"] },
        { at: `${SS}/scheme`, action: "remove", type: nonBreaking, mentions: ["S", "scheme"] },
      ],
    },
  },
  {
    // a document case rather than a schema case: ajv (the JSON Schema oracle, test/compat/oracle.ts) overflows its stack on
    // a `$dynamicRef` whose dynamic anchor is not at a resource root, so the oracle must not receive this pair
    kind: "doc",
    id: "OAS-LOR-008",
    area: "refs-components",
    title: "2020-12 $dynamicRef retargeted to another dynamic anchor",
    before: "tree ($dynamicAnchor node), children items $dynamicRef #node",
    after: "children items $dynamicRef #leaf (a string schema)",
    rationale:
      "the children were trees and are strings now: payloads that were valid are rejected (request) and clients decoding trees receive strings (response), as a `$ref` retargeted to a component of a different type (JS-REF-001)",
    annotation: "names the dynamic reference of `children` and the location",
    sources: [rules("Schema.DynamicRef modified", "breaking")],
    covers: ["lo:Schema.DynamicRef"],
    docs: {
      request: [
        reqBody({ "application/json": { schema: tree("#node") } }),
        reqBody({ "application/json": { schema: tree("#leaf") } }),
      ],
      response: [
        resBody({ "application/json": { schema: tree("#node") } }),
        resBody({ "application/json": { schema: tree("#leaf") } }),
      ],
    },
    expect: {
      request: [
        {
          at: `${RQ}/application~1json/schema/properties/children/items/**`,
          type: breaking,
          mentions: ["children", "Request Body"],
        },
      ],
      response: [
        {
          at: `${RS}/application~1json/schema/properties/children/items/**`,
          type: breaking,
          mentions: ["children", "Response 200"],
        },
      ],
    },
    // ISSUE-148 (fixed) (P5)
  },
  {
    kind: "schema",
    id: "OAS-LOR-009",
    area: "refs-components",
    title: "2020-12 $dynamicAnchor added to a schema that no $dynamicRef targets",
    before: "object",
    after: "object with $dynamicAnchor node",
    rationale:
      "an anchor only names a schema resource for dynamic resolution; with no `$dynamicRef` resolving to it the set of valid instances is unchanged",
    annotation: "names $dynamicAnchor and the location",
    sources: [rules("Schema.DynamicAnchor (added not breaking)")],
    covers: ["lo:Schema.DynamicAnchor"],
    schema: [{ type: "object" }, { type: "object", $dynamicAnchor: "node" }],
    expect: [{ at: "$dynamicAnchor", action: "add", type: rr(annotation, annotation), mentions: ["$dynamicAnchor"] }],
    // ISSUE-148 (fixed) (P5)
  },
  {
    kind: "schema",
    id: "OAS-LOR-010",
    area: "refs-components",
    title: "$vocabulary added to a body schema",
    before: "object",
    after: "object with $vocabulary { core: true }",
    rationale:
      "`$vocabulary` is honoured only in a meta-schema; in a schema that validates instances it has no effect (JSON Schema 2020-12 core §8.1.2)",
    annotation: "names $vocabulary and the location",
    sources: [rules("Schema.Vocabulary added", "breaking")],
    covers: ["lo:Schema.Vocabulary"],
    schema: [
      { type: "object" },
      { type: "object", $vocabulary: { "https://json-schema.org/draft/2020-12/vocab/core": true } },
    ],
    expect: [
      {
        at: ["$vocabulary", "$vocabulary/**"],
        action: "add",
        type: rr(annotation, annotation),
        mentions: ["$vocabulary"],
      },
    ],
    // ISSUE-148 (fixed) (P5)
  },
  {
    kind: "doc",
    id: "OAS-LOR-011",
    area: "request-body",
    title: "3.2 discriminator defaultMapping added, retargeted and removed",
    before: "oneOf Cat / Dog, discriminator kind (without / with defaultMapping Cat)",
    after: "defaultMapping Cat / Dog / removed",
    rationale:
      "defaultMapping names the schema for payloads whose `kind` is missing or unmapped. Request: adding it accepts such payloads (non-breaking), retargeting or removing it rejects or reinterprets payloads that were accepted (breaking). Response (proposed, POLICY-39): adding it lets the server send unmapped kinds (risky, as an output enum value added), retargeting changes the shape clients decode (breaking), removing it narrows what is sent (non-breaking)",
    annotation: "names defaultMapping, the discriminator and the body location",
    sources: [
      rules("Discriminator.DefaultMapping added / modified / removed", "breaking"),
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G9", verdict: "response: non-breaking" },
    ],
    covers: ["lo:Discriminator.DefaultMapping"],
    docs: {
      "add-request": [
        reqBody(poly({}), "3.2.0", { components: pets }),
        reqBody(poly({ defaultMapping: "Cat" }), "3.2.0", { components: pets }),
      ],
      "change-request": [
        reqBody(poly({ defaultMapping: "Cat" }), "3.2.0", { components: pets }),
        reqBody(poly({ defaultMapping: "Dog" }), "3.2.0", { components: pets }),
      ],
      "remove-request": [
        reqBody(poly({ defaultMapping: "Cat" }), "3.2.0", { components: pets }),
        reqBody(poly({}), "3.2.0", { components: pets }),
      ],
      "add-response": [
        resBody(poly({}), "3.2.0", { components: pets }),
        resBody(poly({ defaultMapping: "Cat" }), "3.2.0", { components: pets }),
      ],
      "change-response": [
        resBody(poly({ defaultMapping: "Cat" }), "3.2.0", { components: pets }),
        resBody(poly({ defaultMapping: "Dog" }), "3.2.0", { components: pets }),
      ],
      "remove-response": [
        resBody(poly({ defaultMapping: "Cat" }), "3.2.0", { components: pets }),
        resBody(poly({}), "3.2.0", { components: pets }),
      ],
    },
    expect: {
      "add-request": [
        {
          at: `${RQ}/application~1json/${DM}`,
          action: "add",
          type: nonBreaking,
          mentions: ["defaultMapping", "Request Body"],
        },
      ],
      "change-request": [
        {
          at: `${RQ}/application~1json/${DM}`,
          action: "replace",
          type: breaking,
          mentions: ["defaultMapping", "Request Body", "Dog"],
        },
      ],
      "remove-request": [
        {
          at: `${RQ}/application~1json/${DM}`,
          action: "remove",
          type: breaking,
          mentions: ["defaultMapping", "Request Body"],
        },
      ],
      "add-response": [
        { at: `${RS}/application~1json/${DM}`, action: "add", type: risky, mentions: ["defaultMapping", "200"] },
      ],
      "change-response": [
        {
          at: `${RS}/application~1json/${DM}`,
          action: "replace",
          type: breaking,
          mentions: ["defaultMapping", "200", "Dog"],
        },
      ],
      "remove-response": [
        {
          at: `${RS}/application~1json/${DM}`,
          action: "remove",
          type: nonBreaking,
          mentions: ["defaultMapping", "200"],
        },
      ],
    },
    // ISSUE-137 (fixed); POLICY-39 decided (a): direction-aware (request add non-breaking, retarget / remove breaking;
    // response add risky, retarget breaking, remove non-breaking)
  },
  {
    kind: "doc",
    id: "OAS-LOR-012",
    area: "media-types",
    title: "xml mapping of a property changed in a body served as XML",
    before: "application/xml body, property id as an element / atom+xml element name a",
    after: "id marked xml attribute / element name b",
    rationale:
      "POLICY-27 (c): where an XML media type uses the schema, `xml` decides the wire format: an element that becomes an attribute (or is renamed) is no longer where producers put it or consumers read it, in a request and in a response",
    annotation: "names the xml keyword of `id` and the body location",
    sources: [
      rules("XML.Attribute / XML.Name modified", "breaking"),
      { tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md POLICY-27 (c)" },
    ],
    covers: ["lo:Schema.XML", "lo:XML.Attribute", "lo:XML.Name"],
    docs: {
      request: [reqBody({ "application/xml": xmlObj() }), reqBody({ "application/xml": xmlObj({ attribute: true }) })],
      response: [resBody({ "application/xml": xmlObj() }), resBody({ "application/xml": xmlObj({ attribute: true }) })],
      "atom-name": [
        reqBody({ "application/atom+xml": xmlObj({ name: "a" }) }),
        reqBody({ "application/atom+xml": xmlObj({ name: "b" }) }),
      ],
    },
    expect: {
      request: [
        {
          at: [`${RQ}/application~1xml/schema/properties/id/xml`, `${RQ}/application~1xml/schema/properties/id/xml/*`],
          type: breaking,
          mentions: ["xml", "id", "application/xml"],
        },
      ],
      response: [
        {
          at: [`${RS}/application~1xml/schema/properties/id/xml`, `${RS}/application~1xml/schema/properties/id/xml/*`],
          type: breaking,
          mentions: ["xml", "id", "application/xml"],
        },
      ],
      "atom-name": [
        {
          at: `${RQ}/application~1atom+xml/schema/properties/id/xml/name`,
          action: "replace",
          type: breaking,
          mentions: ["id", "application/atom+xml"],
        },
      ],
    },
    // ISSUE-147 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-LOR-013",
    area: "media-types",
    title: "3.2 xml nodeType changed (element -> attribute) under JSON and under XML",
    before: "property id xml nodeType element (response application/json / application/xml)",
    after: "xml nodeType attribute",
    rationale:
      "POLICY-27 (c): the XML mapping is documentation where only JSON uses the schema (annotation) and the wire format where an XML media type uses it (breaking for clients that read the element)",
    annotation: "names nodeType of `id` and the body location",
    sources: [
      rules("XML.NodeType modified", "breaking"),
      { tool: "asd", ref: "test/openapi/openapi32.test.ts G10", verdict: "annotation" },
    ],
    covers: ["lo:XML.NodeType"],
    docs: {
      json: [
        resBody({ "application/json": xmlObj({ nodeType: "element" }) }, "3.2.0"),
        resBody({ "application/json": xmlObj({ nodeType: "attribute" }) }, "3.2.0"),
      ],
      xml: [
        resBody({ "application/xml": xmlObj({ nodeType: "element" }) }, "3.2.0"),
        resBody({ "application/xml": xmlObj({ nodeType: "attribute" }) }, "3.2.0"),
      ],
    },
    expect: {
      json: [
        {
          at: `${RS}/application~1json/schema/properties/id/xml/nodeType`,
          action: "replace",
          type: annotation,
          mentions: ["nodeType", "id"],
        },
      ],
      xml: [
        {
          at: `${RS}/application~1xml/schema/properties/id/xml/nodeType`,
          action: "replace",
          type: breaking,
          mentions: ["nodeType", "id", "application/xml"],
        },
      ],
    },
    // ISSUE-147 (fixed)
  },
  {
    kind: "doc",
    id: "OAS-LOR-014",
    area: "media-types",
    title: "xml keywords without serialization effect in a body served as XML",
    before:
      "application/xml body, property id (string) without xml / tags (array) without xml / id with xml { name: id }",
    after: "id xml { name: id } / id xml {} / id xml { wrapped: true } / id xml { attribute: false } / tags wrapped",
    rationale:
      "POLICY-76 decided (b): only the effective XML mapping is the wire format; `xml.name` equal to the property name, an empty `xml` object, an explicit default (`attribute: false`) and `wrapped` on a non-array leave the element where it was (annotation); wrapping an array moves its items into a wrapper element (breaking)",
    annotation: "names the xml keyword of the property",
    sources: [
      { tool: "asd", ref: "docs/TASK_2.0.0_COMPLETENESS.md §3.0a POLICY-76 (b)" },
      {
        tool: "asd",
        ref: "OpenAPI 3.1 XML Object: name defaults to the property name, wrapped applies to arrays only",
      },
    ],
    docs: {
      "name-equal": [resBody({ "application/xml": xmlObj() }), resBody({ "application/xml": xmlObj({ name: "id" }) })],
      "name-equal-removed": [
        reqBody({ "application/xml": xmlObj({ name: "id" }) }),
        reqBody({ "application/xml": xmlObj() }),
      ],
      empty: [reqBody({ "application/xml": xmlObj() }), reqBody({ "application/xml": xmlObj({}) })],
      "wrapped-scalar": [
        resBody({ "application/xml": xmlObj({ name: "a" }) }),
        resBody({ "application/xml": xmlObj({ name: "a", wrapped: true }) }),
      ],
      "attribute-default": [
        reqBody({ "application/xml": xmlObj({ name: "a" }) }),
        reqBody({ "application/xml": xmlObj({ name: "a", attribute: false }) }),
      ],
      "wrapped-array": [
        resBody({
          "application/xml": { schema: { type: "object", properties: { tags: { type: "array", items: str } } } },
        }),
        resBody({
          "application/xml": {
            schema: { type: "object", properties: { tags: { type: "array", items: str, xml: { wrapped: true } } } },
          },
        }),
      ],
    },
    expect: {
      "name-equal": [
        {
          at: `${RS}/application~1xml/schema/properties/id/xml`,
          action: "add",
          type: annotation,
          mentions: ["xml", "id"],
        },
      ],
      "name-equal-removed": [
        {
          at: `${RQ}/application~1xml/schema/properties/id/xml`,
          action: "remove",
          type: annotation,
          mentions: ["xml", "id"],
        },
      ],
      empty: [
        {
          at: `${RQ}/application~1xml/schema/properties/id/xml`,
          action: "add",
          type: annotation,
          mentions: ["xml", "id"],
        },
      ],
      "wrapped-scalar": [
        {
          at: `${RS}/application~1xml/schema/properties/id/xml/wrapped`,
          action: "add",
          type: annotation,
          mentions: ["wrapped", "id"],
        },
      ],
      "attribute-default": [
        {
          at: `${RQ}/application~1xml/schema/properties/id/xml/attribute`,
          action: "add",
          type: annotation,
          mentions: ["attribute", "id"],
        },
      ],
      "wrapped-array": [
        {
          at: `${RS}/application~1xml/schema/properties/tags/xml`,
          action: "add",
          type: breaking,
          mentions: ["xml", "tags", "application/xml"],
        },
      ],
    },
    // POLICY-76 decided (b) (P8a)
  },
]

runCases("openapi", "libopenapi-rules", cases, import.meta.filename)
