# api-smart-diff

[![npm](https://img.shields.io/npm/v/api-smart-diff)](https://www.npmjs.com/package/api-smart-diff) [![npm downloads](https://img.shields.io/npm/dm/api-smart-diff?label=npm)](https://www.npmjs.com/package/api-smart-diff) [![npm type definitions](https://img.shields.io/npm/types/api-smart-diff)](https://www.npmjs.com/package/api-smart-diff) [![docs](https://img.shields.io/badge/docs-udamir.github.io-blue)](https://udamir.github.io/api-smart-diff/) [![license](https://img.shields.io/github/license/udamir/api-smart-diff)](https://github.com/udamir/api-smart-diff/blob/master/LICENSE)

Compare two versions of an API document and get every change as a list of diffs and as a merged document annotated with change metadata. Each change is classified (breaking, risky, non-breaking, deprecated, annotation or unclassified) from the API consumer's point of view and comes with a human-readable description. Use it to generate API changelogs, gate releases on breaking changes and review API evolution. It runs in Node.js and in the browser and has two small runtime dependencies.

**[Documentation](https://udamir.github.io/api-smart-diff/)** · [Getting started](https://udamir.github.io/api-smart-diff/guide/getting-started) · [Examples](https://udamir.github.io/api-smart-diff/examples/) · [Online demo](https://udamir.github.io/api-smart-diff/demo) · [API reference](https://udamir.github.io/api-smart-diff/guide/api) · [Migration from 1.x](https://udamir.github.io/api-smart-diff/guide/migration) · [Changelog](https://udamir.github.io/api-smart-diff/changelog)

## Features

- Diffs and a merged document with per-node change metadata
- Six change classes, with request and response direction handled for you
- Shared components classified by where they are used; `$ref`s resolved, including circular ones
- Renames reported as renames, and a description for every change
- Custom classification, matching and description rules

## Supported specifications

| Specification | Versions |
| --- | --- |
| [OpenAPI](https://spec.openapis.org/oas/latest.html) | 3.0, 3.1, 3.2 (documents of different 3.x versions can be compared) |
| [AsyncAPI](https://www.asyncapi.com/docs/reference) | 2.x (2.0 – 2.6), 3.0 |
| [JSON Schema](https://json-schema.org/) | draft-04, draft-06, draft-07, 2020-12 |
| GraphQL via [GraphApi](https://github.com/udamir/graphapi) | GraphApi 1.0 (convert SDL with [gqlapi](https://github.com/udamir/graphapi) 0.6 or later) |
| gRPC / Protocol Buffers via [ProtoApi](https://github.com/udamir/protoapi) | ProtoApi 0.1 (build it from `.proto` sources with [protoapi](https://github.com/udamir/protoapi)) |

The specification is detected from the documents; see [Specifications and engines](https://udamir.github.io/api-smart-diff/guide/engines).

## Installation

```sh
npm install api-smart-diff
```

Requires Node.js 18 or later.

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

## Documentation

- [Installation](https://udamir.github.io/api-smart-diff/guide/installation): CommonJS, browser, GraphQL SDL and `.proto` sources; [usage](https://udamir.github.io/api-smart-diff/guide/usage)
- [Result](https://udamir.github.io/api-smart-diff/guide/result) and [options](https://udamir.github.io/api-smart-diff/guide/options)
- [Classification](https://udamir.github.io/api-smart-diff/guide/classification), [direction and scopes](https://udamir.github.io/api-smart-diff/guide/scopes), [components](https://udamir.github.io/api-smart-diff/guide/components), [renames](https://udamir.github.io/api-smart-diff/guide/renames)
- [Protocol Buffers](https://udamir.github.io/api-smart-diff/guide/protoapi), [custom rules](https://udamir.github.io/api-smart-diff/guide/custom-rules), [API reference](https://udamir.github.io/api-smart-diff/guide/api)
- [Migration from 1.x](https://udamir.github.io/api-smart-diff/guide/migration), [limitations](https://udamir.github.io/api-smart-diff/guide/limitations), [changelog](https://udamir.github.io/api-smart-diff/changelog)

## Benchmark

Measured with the [benchmark project](https://github.com/udamir/api-smart-diff/tree/master/benchmark) in this repository; full reports are in [`benchmark/results/`](https://github.com/udamir/api-smart-diff/tree/master/benchmark/results).

Speed against the published 1.0.6 (minimum of the timed calls, documents parsed outside the timing; Node.js 26, Intel i9-9880H):

| Input | 2.0 | 1.0.6 | Other tools |
| --- | --- | --- | --- |
| GitHub REST (7.6 MB) | 0.12 s | 10.0 s | oasdiff 3.48 s<br/>openapi-changes > 60 s<br/>openapi-diff > 60 s |
| OpenAPI petstore | 2.7 ms | 34 ms | oasdiff 12.8 ms<br/>openapi-changes 25.4 ms<br/>openapi-diff 483 ms |
| 10 000 properties | 17 ms | 0.71 s | oasdiff 1.03 s<br/>openapi-changes 1.89 s<br/>openapi-diff > 60 s |
| 1 500 properties, response | 1.8 ms | 0.62 s | oasdiff 60 ms<br/>openapi-changes 105 ms<br/>openapi-diff > 60 s |
| GitHub GraphQL (1.1 MB) | 55 ms | > 60 s | graphql-inspector 17 ms<br/>graphql-js 24 ms |
| AsyncAPI events | 1.1 ms | 1.0 ms | @asyncapi/diff 0.53 ms |
| Protobuf, 1 700 messages | 0.18 s | — | buf 3.63 s |
| Protobuf, 10 200 messages | 1.20 s | — | buf 24.2 s |

Classification quality on the scripted change sets (share of expected changes found, and share of found changes with the expected class):

| Format | api-smart-diff 2.0 | Other tools |
| --- | --- | --- |
| OpenAPI and JSON Schema (110 changes) | 100 % found, 100 % classes | oasdiff 89 % / 100 %<br/>openapi-changes 100 % / 83 %<br/>openapi-diff 57 % / 77 % |
| GraphQL (24 changes) | 100 % / 100 % | graphql-inspector 100 % / 100 %<br/>graphql-js 71 % / 88 % |
| AsyncAPI 2.6 and 3.0 (24 changes) | 100 % / 100 % | @asyncapi/diff 100 % / 25 %<br/>openapi-changes (3.0 only) 100 % / 83 % |
| Protocol Buffers (17 changes, `FILE` level) | 100 % / 100 % | buf breaking 75 % of the breaking-side changes / 89 % |

## Contributing

Issues and pull requests are welcome; see [Contributing](https://udamir.github.io/api-smart-diff/guide/contributing).

## License

MIT
