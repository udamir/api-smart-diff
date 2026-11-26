# Specifications and engines

## Supported specifications

| Specification | Versions | Engine |
| --- | --- | --- |
| [OpenAPI](https://spec.openapis.org/oas/latest.html) | 3.0, 3.1, 3.2 | `compareOpenApi` |
| [AsyncAPI](https://www.asyncapi.com/docs/reference) | 2.x (2.0 – 2.6), 3.0 | `compareAsyncApi` |
| [JSON Schema](https://json-schema.org/) | draft-04, draft-06, draft-07, 2020-12 | `compareJsonSchema` |
| GraphQL via [GraphApi](https://github.com/udamir/graphapi) | `graphapi: "0.1.2"` and `graphapi: "1.0"` | `compareGraphApi` |
| gRPC / Protocol Buffers via [ProtoApi](https://github.com/udamir/protoapi) | `protoapi: "0.1"`, built from `.proto` sources with protoapi | `compareProtoApi` |
| Swagger 2.0 | not supported | `UnsupportedSpecError` — convert to OpenAPI 3 first |

## Detection

`apiCompare(before, after, options?)` reads the marker field of both documents with `detectSpec`:

| Marker | Engine |
| --- | --- |
| `openapi: 3.x` (a string or a YAML number such as `3.1`) | `compareOpenApi` |
| `asyncapi: 2.x` or `3.x` | `compareAsyncApi` |
| `graphapi: 0.x` or `1.x` | `compareGraphApi` |
| `protoapi: 0.x` | `compareProtoApi` |
| none of them | `compareJsonSchema` |

```ts
import { detectSpec } from "api-smart-diff"

detectSpec({ openapi: "3.1.0" }) // { engine: "openapi", version: "3.1.0" }
detectSpec({ type: "object" }) // { engine: "jsonschema" }
```

`options.engine` (`"openapi"`, `"asyncapi"`, `"graphapi"`, `"protoapi"` or `"jsonschema"`) skips the detection, for example to compare a recognized document as a plain JSON value tree with the JSON Schema engine.

### Unsupported documents

A recognized but unsupported document throws `UnsupportedSpecError` instead of being compared as plain JSON: Swagger 2, OpenAPI 4 or later, AsyncAPI 1.x or 4+, an unknown GraphApi or ProtoApi version, two documents of different specifications, AsyncAPI 2.x against 3.0, and GraphApi 0.1.2 against 1.0. The error carries the versions it found:

```ts
import { apiCompare, UnsupportedSpecError } from "api-smart-diff"

try {
  apiCompare({ swagger: "2.0" }, { swagger: "2.0" })
} catch (error) {
  if (error instanceof UnsupportedSpecError) {
    console.log(error.message) // "Swagger 2.0 is not supported"
    console.log(error.before, error.after) // the versions of the two documents, when known
  }
}
```

Every other problem is reported through `errors` / `onError`, never thrown (see [Result](./result#errors)).

## OpenAPI 3.0, 3.1 and 3.2

```ts
compareOpenApi(before, after, options?: OpenApiCompareOptions)
```

One rule tree is generated for each version (`openapi3Rules({ version: "3.0" | "3.1" | "3.2" })`): schema dialect, operation methods (`query` in 3.2), `additionalOperations`, `querystring` parameters, `webhooks`, `components.pathItems` and `components.mediaTypes`, streaming media types (`itemSchema`, `itemEncoding`, `prefixEncoding`), tag hierarchy, the device-authorization flow, `$self`, and so on.

Documents of **different 3.x versions** can be compared with each other: the rules of the higher version are used, and representation-only differences produce no diff — `nullable: true` vs `type: [T, "null"]`, boolean vs numeric `exclusiveMinimum` / `exclusiveMaximum`, `example` vs `examples` (see the [migration example](/examples/#openapi-3-0-to-3-1-migration)).

For the comparison the engine normalizes both documents (on copies; the inputs and the merged document keep the original values): path-level parameters are moved into the operations, default values such as parameter `style` / `explode` and `required: false` are made explicit, `example` is read as `examples`, `const` as a one-value `enum`, boolean exclusive bounds as numeric ones, and `allOf` is merged with [allof-merge](https://github.com/udamir/allof-merge). Keys are matched as the specification defines them: paths by template (`/pets/{id}` ≡ `/pets/{petId}`, repeated slashes collapsed, a base path moved between `servers` and the paths), parameters by `in` and `name` (header names case-insensitive), status codes case-insensitively and an explicit code with the range of its class (`200` ↔ `2XX`), media types by exact key, then ignoring parameters such as `charset`, then one wildcard pair, servers by name or URL, tags by name.

Extra options: `notMergeAllOf: true` compares `allOf` branches as written; `extensions` gives `x-*` keys their own rules. The version rules are chosen from the documents; to compare with the rules of a specific version, pass them: `compareOpenApi(before, after, { rules: openapi3Rules({ version: "3.2" }) })`.

## AsyncAPI 2.x and 3.0

```ts
compareAsyncApi(before, after, options?: AsyncApiCompareOptions)
```

Separate profiles for 2.x and 3.0 (`asyncApi2Rules`, `asyncApi3Rules`); a 2.x document cannot be compared with a 3.0 document. Messages are classified from the client's point of view: messages the application consumes (2.x `publish`, 3.0 `receive`) like requests, messages it produces (2.x `subscribe`, 3.0 `send`) like responses; a 3.0 reply takes the opposite direction of its operation, and the 2.x and 3.0 spellings of one API get the same verdicts (see [Direction and scopes](./scopes)).

Payload schemas are read in the dialect their `schemaFormat` names — AsyncAPI schema, JSON Schema drafts, OpenAPI 3.0 / 3.1 schema objects; other formats (Avro, RAML, Protobuf, …) are compared as opaque values. A trait is classified by what it changes in the effective (merged) message or operation, while its diffs stay at the trait. Channels, channel messages and components can be [renamed](./renames). Extra option: `notMergeAllOf`.

## JSON Schema

```ts
compareJsonSchema(before, after, options?: JsonSchemaCompareOptions)
```

The draft is read from `$schema` (absent or another URI: 2020-12); of two documents with different drafts the later draft is used for both, and an equivalent cross-draft rewrite (a draft-07 tuple `items` vs 2020-12 `prefixItems`) is an annotation. The 2020-12 keywords are supported (`prefixItems`, `$defs`, `dependentRequired`, `dependentSchemas`, `contentSchema`, `unevaluated*`, `minContains` / `maxContains`, `if` / `then` / `else`, `$dynamicRef`), as are boolean schemas.

Classification works on what a schema accepts: effective numeric bounds, `multipleOf` divisibility, `type` assignability (`integer` is a subset of `number`), enum values as sets, `oneOf` / `anyOf` branches matched by structure, and a conservative set-level check that recognizes equivalent rewrites (`maxItems: 0` ≡ `items: false`, a partition of a type into `anyOf` branches, De Morgan, double negation) as one annotation. A standalone schema is read with request semantics (the contract of values a client sends).

Extra options: `notMergeAllOf: true`; `version` (`"draft-04"`, `"draft-06"`, `"draft-07"`, `"2020-12"`) overrides the detected draft.

## GraphQL (GraphApi 0.1.2 and 1.0)

```ts
compareGraphApi(before, after, options?: CompareOptions)
```

GraphQL schemas are compared in their [GraphApi](https://udamir.github.io/graphapi/) encoding: convert SDL with [gqlapi](https://github.com/udamir/graphapi) — `buildFromSchema(buildSchema(sdl))`; gqlapi 0.6 and later write [GraphAPI 1.0](https://udamir.github.io/graphapi/spec/v1.0), gqlapi 0.5 and earlier write 0.1.2. The rule set (`graphApiRules`, `graphApi10Rules`) is selected by the `graphapi` field; both encodings give the same verdicts and descriptions, but a 0.1.2 document cannot be compared with a 1.0 document.

Arguments and input types are classified like requests (`args` scope), output fields and object, interface and union types like responses (`output` scope). Named types are nominal components: a change inside a type is reported at `components/...`, not inside every operation that reaches it. Types that no root operation type reaches are classified as if they were reachable. Executable documents (queries sent by clients) are not compared.

## gRPC / Protocol Buffers (ProtoApi 0.1)

```ts
compareProtoApi(before, after, options?: ProtoApiCompareOptions)
```

Protocol Buffers APIs are compared in their [ProtoApi](https://github.com/udamir/protoapi) encoding: build both sides from `.proto` sources with the separate package protoapi — `buildFromProto(files, { imports: "user" })`, the same protoapi version and options for both — and compare the documents. Four compatibility levels named after buf's breaking categories (`options.compatibility`: `FILE`, `PACKAGE`, `WIRE_JSON`, `WIRE`) decide which clients a change is judged for. rpc requests are classified like requests (`request` scope), responses like responses (`response`), messages and enums by the rpcs that use them (`components`). Fields and enum values are paired by number, files by the declarations they hold; validation rules (protovalidate, `google.api.field_behavior`) are compared as JSON Schema keywords; descriptions read in protobuf terms with `.proto` literals. Extra options: `compatibility`, `files`, `optionRules`. See [Protocol Buffers](./protoapi).

## Calling an engine directly

The engines take the same `CompareOptions` as `apiCompare` plus their own extras, and an optional fourth argument, a `SourceContext`, used by custom resolvers that compare a sub-node of a larger document:

```ts
import { compareOpenApi } from "api-smart-diff"

const { diffs } = compareOpenApi(before, after, { notMergeAllOf: true })
```

`compare(before, after, options)` is the generic engine all of them delegate to: with `options.rules` you can run it with a rule tree of your own (see [Custom rules](./custom-rules)).
