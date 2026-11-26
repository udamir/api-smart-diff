# Limitations

Known limits of api-smart-diff 2.0.0:

- **No cross-version comparison** for AsyncAPI 2.x ↔ 3.0 and GraphApi 0.1.2 ↔ 1.0 (`UnsupportedSpecError`). OpenAPI 3.0 ↔ 3.1 ↔ 3.2 is supported.
- **External references** are resolved only from [`externalSources`](./options#externalsources), synchronously; nothing is fetched. Bundle multi-file documents with [api-ref-bundler](https://github.com/udamir/api-ref-bundler) or pass the referenced documents.
- **Non-JSON schema formats** in AsyncAPI payloads (Avro, RAML, Protobuf, …) are compared as opaque values: a change is one `unclassified` diff.
- **GraphQL** is compared in its GraphApi encoding; SDL must be converted with gqlapi first, and executable documents (operations) are not compared.
- **Equivalent JSON Schema rewrites** (`maxItems: 0` vs `items: false`, a partition of a type into `anyOf` branches, De Morgan, …) are recognized by a conservative set-level check of schemas of up to 128 objects; a larger rewrite is compared keyword by keyword.
- **Deeply nested documents**: comparison time and memory grow with the square of the nesting depth, because every compared node keeps its own path. Documents nested up to a few thousand levels compare normally (500 levels take a few milliseconds, 5 000 levels about 1.5 s under Node.js); around 10 000 levels exhaust a 4 GB heap.
- **Very long `$ref` chains**: a chain of a few thousand schemas, each referencing the next, expanded at an OpenAPI, AsyncAPI or JSON Schema usage reports a compare error ("Maximum call stack size exceeded") at the usage and the change only at its declaration. 600 chained schemas compare normally, and a long chain that is not expanded at a usage (components that only reference each other) compares normally. Real documents are not known to contain such chains.
- **Many usages of one `$ref`**: 500 changed usages of one `$ref` take about 15–25 ms.
- **Very wide AsyncAPI 3.0 documents** (more than about 1 500 channels or operations with differing shapes) compare slightly superlinearly (≈ 2.2–2.6× per doubling), because V8 stops sharing object shapes for such large input maps; 2 000 channels compare in about 50 ms.

## Performance

The engine walks only what changed: a subtree that is structurally equal in both documents (with unchanged `$ref` targets) is copied, not compared; `$ref` targets are compared once per call and re-described at every usage; the walk is iterative, so nesting depth is not limited by the call stack; and comparison time is linear in the width of a document.

Measured with the 2.0.0 build against the published 1.0.6 package on the same machine (Node.js 26, Intel Core i9-9880H; minimum of 7 to 11 timed calls after warm-up, one fresh process per measurement, documents parsed outside the timing):

| Input | 1.0.6 | 2.0.0 |
| --- | --- | --- |
| GitHub REST API description (7.6 MB JSON, 1 281 operations), 21 changes | 10.2 s | 0.14 s |
| GitHub public GraphQL schema (1.1 MB SDL), 18 changes | not finished after 90 s | 0.15 s (GraphApi 0.1.2), 0.07 s (GraphApi 1.0) |
| OpenAPI petstore, 24 changes | 34 ms | 2.6 ms |
| A schema with 10 000 properties | 2.7 s | 21 ms |
| A schema with 1 500 properties, in a request / in a response | 131 ms / 620 ms | 2.7 ms / 2.7 ms |
| AsyncAPI 2.6 event API (3 KB), 12 changes | 1.2 ms | 1.3 ms |

The heap added by a comparison is about the size of the input, and response rules cost the same as request rules.
