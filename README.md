# api-smart-diff

[![npm](https://img.shields.io/npm/v/api-smart-diff)](https://www.npmjs.com/package/api-smart-diff) [![npm downloads](https://img.shields.io/npm/dm/api-smart-diff?label=npm)](https://www.npmjs.com/package/api-smart-diff) [![npm type definitions](https://img.shields.io/npm/types/api-smart-diff)](https://www.npmjs.com/package/api-smart-diff) [![docs](https://img.shields.io/badge/docs-udamir.github.io-blue)](https://udamir.github.io/api-smart-diff/) [![license](https://img.shields.io/github/license/udamir/api-smart-diff)](https://github.com/udamir/api-smart-diff/blob/master/LICENSE)

Compare two versions of an API document and get every change as a list of diffs and as a merged document annotated with change metadata. Each change is classified (breaking, risky, non-breaking, deprecated, annotation or unclassified) from the API consumer's point of view and comes with a human-readable description. Use it to generate API changelogs, gate releases on breaking changes and review API evolution. It runs in Node.js and in the browser and has two small runtime dependencies.

**[Documentation](https://udamir.github.io/api-smart-diff/)** · [Getting started](https://udamir.github.io/api-smart-diff/guide/getting-started) · [Examples](https://udamir.github.io/api-smart-diff/examples/) · [Online demo](https://udamir.github.io/api-smart-diff/demo) · [API reference](https://udamir.github.io/api-smart-diff/guide/api) · [Migration from 1.x](https://udamir.github.io/api-smart-diff/guide/migration) · [Changelog](https://udamir.github.io/api-smart-diff/changelog)

## Features

- Diffs and a merged document with per-node change metadata, for OpenAPI, AsyncAPI, JSON Schema, GraphQL and gRPC / Protocol Buffers
- Six change classes, with request and response direction handled for you (a change that breaks a request may be harmless in a response)
- Shared components classified by where they are used; `$ref`s resolved, including circular references
- Renamed paths, components, channels and messages reported as renames, not as a removal plus an addition
- A description for every change, for example ``[Added] required status to query parameter `limit` ``
- Custom classification, matching and description rules, and rules for `x-*` extensions
- Input documents are never modified; TypeScript declarations included

## Supported specifications

| Specification | Versions |
| --- | --- |
| [OpenAPI](https://spec.openapis.org/oas/latest.html) | 3.0, 3.1, 3.2 (documents of different 3.x versions can be compared) |
| [AsyncAPI](https://www.asyncapi.com/docs/reference) | 2.x (2.0 – 2.6), 3.0 |
| [JSON Schema](https://json-schema.org/) | draft-04, draft-06, draft-07, 2020-12 |
| GraphQL via [GraphApi](https://github.com/udamir/graphapi) | GraphApi 0.1.2 and 1.0 (convert SDL with [gqlapi](https://github.com/udamir/graphapi)) |
| gRPC / Protocol Buffers via [ProtoApi](https://github.com/udamir/protoapi) | ProtoApi 0.1 (build it from `.proto` sources with [protoapi](https://github.com/udamir/protoapi)) |

`apiCompare` detects the specification from the documents. Swagger 2.0 is not supported (convert it to OpenAPI 3 first): unsupported documents throw `UnsupportedSpecError`. Details per specification: [Specifications and engines](https://udamir.github.io/api-smart-diff/guide/engines).

## Installation

```sh
npm install api-smart-diff
```

Requires Node.js 18 or later. To compare `.proto` sources, also install `protoapi` (`npm install protoapi`), which builds the ProtoApi documents; api-smart-diff itself does not depend on it. The package ships an ES module, a CommonJS build and a self-contained browser build; see [Installation](https://udamir.github.io/api-smart-diff/guide/installation).

## Quick start

`apiCompare` takes two parsed documents (plain objects; parse YAML with a library such as `js-yaml` first):

```js
import { apiCompare } from "api-smart-diff"

const before = {
  openapi: "3.1.0",
  info: { title: "Pet store", version: "1.0.0" },
  paths: {
    "/pets": {
      get: {
        parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "A list of pets" } },
      },
    },
  },
}
const after = structuredClone(before)
after.paths["/pets"].get.parameters[0].required = true
after.paths["/pets"].post = { responses: { "201": { description: "Created" } } }

const { diffs, merged, errors } = apiCompare(before, after)

for (const diff of diffs) {
  console.log(diff.type, diff.description)
}
// breaking [Added] required status to query parameter `limit`
// non-breaking [Added] operation `POST /pets`

console.log(merged.paths["/pets"].$diff)
// { post: { action: "add", type: "non-breaking" } }
```

CommonJS:

```js
const { apiCompare } = require("api-smart-diff")
```

Browser, with the global `ApiSmartDiff`:

```html
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@2/dist/api-smart-diff.min.js"></script>
<script>
  const { diffs, merged } = ApiSmartDiff.apiCompare(before, after)
</script>
```

GraphQL schemas are compared in their GraphApi encoding; install `gqlapi` and `graphql` to convert SDL:

```ts
import { buildSchema } from "graphql"
import { buildFromSchema } from "gqlapi"
import { apiCompare } from "api-smart-diff"

const toGraphApi = (sdl: string) => buildFromSchema(buildSchema(sdl))

const { diffs } = apiCompare(toGraphApi("type Query { pet(id: ID!): String }"), toGraphApi("type Query { pet(id: ID!, owner: ID!): String }"))
// breaking [Added] argument `owner` to field `Query.pet`
```

gRPC / Protocol Buffers APIs are compared in their ProtoApi encoding; install `protoapi` to build it from `.proto` sources (both sides with the same protoapi version and options), and choose the clients a change is judged for with `compatibility` (`"FILE"` by default, `"PACKAGE"`, `"WIRE_JSON"` or `"WIRE"`):

```ts
import { buildFromProto } from "protoapi"
import { apiCompare } from "api-smart-diff"

const toProtoApi = (text: string) => buildFromProto({ "shop/v1/shop.proto": text }, { imports: "user" }).document

const before = toProtoApi(`syntax = "proto3";
package shop.v1;
message Order { string id = 1; int32 priority = 2; }`)
const after = toProtoApi(`syntax = "proto3";
package shop.v1;
message Order { string id = 1; int64 priority = 2; string note = 3; }`)

const { diffs } = apiCompare(before, after)
// breaking [Replaced] type of field `priority` (2) in message `shop.v1.Order` from `int32` to `int64`
// non-breaking [Added] field `note` (3) to message `shop.v1.Order`
```

Check protoapi's build issues before comparing, and map a diff back to its `.proto` line with protoapi's `locateDiff`; see [Protocol Buffers](https://udamir.github.io/api-smart-diff/guide/protoapi).

## Result

```ts
type CompareResult = {
  diffs: Diff[]
  merged: any               // the after document with change metadata under `metaKey` (default "$diff")
  rootMergeMeta?: MergeMeta // metadata of the root when the whole document was replaced
  errors?: CompareError[]   // classification, description and $ref errors, when `onError` is not set
}

type Diff = {
  action: "add" | "remove" | "replace" | "rename"
  type: "breaking" | "risky" | "non-breaking" | "deprecated" | "annotation" | "unclassified"
  path: Array<string | number> // where the change is, in the before document (after document for added nodes)
  before?: any
  after?: any
  description?: string
  scope: CompareScope          // "request", "response", "components", ...
  origin?: { before: JsonPath; after: JsonPath } // declaration paths of a change inside a $ref target
}
```

The merged document keeps the original values of both inputs (removed nodes included) and carries the metadata `{ action, type, replaced? }` of each change on the parent of the changed key. See [Result](https://udamir.github.io/api-smart-diff/guide/result).

## Options

`apiCompare(before, after, options)` and the engines `compareOpenApi`, `compareAsyncApi`, `compareGraphApi`, `compareProtoApi` and `compareJsonSchema` accept:

| Option | Default | Effect |
| --- | --- | --- |
| `metaKey` | `"$diff"` | key (string or `Symbol`) of the change metadata in `merged` |
| `arrayMeta` | `false` | store the metadata of array items on the array instead of on its parent |
| `externalSources` | none | documents for external `$ref`s per side: `{ before: { [uri]: doc }, after: { [uri]: doc } }`; nothing is fetched |
| `onError` | collect in `result.errors` | callback for classification, description, `$ref` and transform errors |
| `engine` | detected | force `"openapi"`, `"asyncapi"`, `"graphapi"`, `"protoapi"` or `"jsonschema"` |
| `components` | `"usage"` | `"unclassified"` leaves changes inside `components` unclassified instead of classifying them by usage |
| `merged` | `"original"` | `"normalized"` returns the normalized comparison values in `merged` (the 1.x content) |
| `rules`, `extensions`, `annotateHook` | built-in | custom rule tree, rules for `x-*` keys, custom description hook |
| `compatibility` | `"FILE"` | ProtoApi: the clients and the generated code a change is judged for, `"FILE"`, `"PACKAGE"`, `"WIRE_JSON"` or `"WIRE"` |
| `files`, `optionRules` | `"compare"`, built-in | ProtoApi: `"ignore"` makes file paths annotations; custom rules for (custom) options |

All options, with examples: [Options](https://udamir.github.io/api-smart-diff/guide/options), [Custom rules](https://udamir.github.io/api-smart-diff/guide/custom-rules), [Specification extensions](https://udamir.github.io/api-smart-diff/guide/extensions).

## Classification

| Type | Meaning | Example |
| --- | --- | --- |
| `breaking` | existing clients can fail | a required request property added, an operation removed, a response property type changed |
| `risky` | valid for most clients, can break some | an enum value added to a response, a GraphQL argument added with a default |
| `non-breaking` | existing clients keep working | an optional request property added, a new operation |
| `deprecated` | a deprecation flag or reason changed | `deprecated: true` added to an operation |
| `annotation` | documentation and metadata only | `description`, `summary`, examples, `x-*` extensions |
| `unclassified` | no rule applies | a change in a component nothing references |

Every verdict is given from the client's point of view: a change is breaking when an existing client of the API can fail. What a client sends (request bodies, parameters, GraphQL arguments, messages the application receives) and what it receives (responses, GraphQL output types, messages the application sends) are classified with opposite rules, and a shared component takes the most severe class of the places that use it. Read more: [Diff types](https://udamir.github.io/api-smart-diff/guide/classification), [Direction and scopes](https://udamir.github.io/api-smart-diff/guide/scopes), [Components and $ref](https://udamir.github.io/api-smart-diff/guide/components), [Renames](https://udamir.github.io/api-smart-diff/guide/renames).

A release gate in a few lines:

```ts
import { apiCompare } from "api-smart-diff"

const { diffs, errors } = apiCompare(before, after)
const breaking = diffs.filter((diff) => diff.type === "breaking")
const risky = diffs.filter((diff) => diff.type === "risky")

if (errors?.length || breaking.length) {
  console.error(breaking.map((diff) => diff.description).join("\n"))
  process.exit(1)
}
if (risky.length) console.warn(risky.map((diff) => diff.description).join("\n"))
```

## Upgrading from 1.x

2.0.0 keeps `apiCompare` and the engine functions but removes `apiDiff` / `apiMerge`, renames the misspelled `Comapre*` types, adds the `risky` type, changes the content and order of `merged`, reports renames and changes inside shared components differently, rewrites the descriptions and requires Node.js 18. The [migration guide](https://udamir.github.io/api-smart-diff/guide/migration) lists every step; the [changelog](https://udamir.github.io/api-smart-diff/changelog) lists every change.

## Limitations

AsyncAPI 2.x cannot be compared with 3.0, nor GraphApi 0.1.2 with 1.0; external `$ref`s are resolved only from `externalSources`; AsyncAPI payloads in non-JSON-Schema formats (Avro, RAML, Protobuf) are compared as opaque values. Protocol Buffers: both documents must be built with the same protoapi version and options, renamed messages and enums are a removal plus an addition, and additions to responses assume ProtoJSON readers that ignore unknown fields. See [Limitations](https://udamir.github.io/api-smart-diff/guide/limitations).

## Benchmark

The [`benchmark/`](https://github.com/udamir/api-smart-diff/tree/master/benchmark) folder is a self-contained project that compares api-smart-diff with the published 1.0.6, the Netcracker api-diff fork and other diff tools (oasdiff, openapi-changes, openapi-diff, json-schema-diff, @asyncapi/diff, graphql-inspector, graphql-js, buf breaking) on OpenAPI, JSON Schema, AsyncAPI, GraphQL and Protocol Buffers inputs, measuring classification quality, speed and memory. Its [README](https://github.com/udamir/api-smart-diff/tree/master/benchmark#readme) explains how to run it, and the rendered reports are in [`benchmark/results/`](https://github.com/udamir/api-smart-diff/tree/master/benchmark/results).

## Contributing

Issues and pull requests are welcome; see [Contributing](https://udamir.github.io/api-smart-diff/guide/contributing). Run `pnpm run check && pnpm test` before submitting a pull request, and include tests for your change. The project avoids new runtime dependencies.

## License

MIT
