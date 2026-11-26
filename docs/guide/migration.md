# Migration from 1.x

2.0.0 is a redesign of the compare engine behind the same entry points: `apiCompare`, `compareOpenApi`, `compareAsyncApi`, `compareGraphApi`, `compareJsonSchema` and `compare` keep their signatures, `CompareResult` is still `{ diffs, merged, rootMergeMeta }`, `Diff.path` is still the path in the before document, merged metadata still lives under `metaKey` (default `$diff`, arrays on the parent as `{ array }` unless `arrayMeta`), and custom `rules` / `annotateHook` and the `ClassifyRule` tuple vocabulary still work. The full list of changes is in the [changelog](/changelog). 2.1.0 no longer reads GraphApi 0.1.2, the only GraphApi encoding 1.x compares: convert GraphQL schemas with gqlapi 0.6 or later (see step 4).

## Checklist

| 1.x | 2.x |
| --- | --- |
| `apiDiff(before, after, options)` | `apiCompare(before, after, options).diffs` |
| `apiMerge(before, after, options)` | `apiCompare(before, after, options).merged` |
| `ComapreOptions`, `ComapreContext`, `OpenApiComapreOptions`, `AsyncApiComapreOptions`, `JsonSchemaComapreCache` | `CompareOptions`, `CompareContext`, `OpenApiCompareOptions`, `AsyncApiCompareOptions`, `JsonSchemaCompareCache` (no aliases) |
| `transformComapreRules` | `transformCompareRules` |
| every internal helper exported from the package (`getKeyValue`, `isObject`, `buildPath`, the per-specification classifiers, mapping resolvers, transforms and annotation helpers, `transfromGraphSchemaDirective`, …) | only the documented API is exported (see the [API reference](./api)); use `detectSpec(document).engine` instead of `discoverCompareEngine`, `NodeContext.up` instead of `getParentContext`, and spread a built-in rule node to reuse its resolvers |
| annotation template keys `arratItem`, `difinition`, `possbile` | `arrayItem`, `definition`, `possible` |
| five diff types | six: `risky` is new — add a branch to every exhaustive `switch`, `Record<DiffType, …>` map, colour map and filter (treat it as breaking for a strict gate, as non-breaking for a changelog) |
| `merged` is the normalized tree, sharing objects with the inputs and the `$ref` cache | `merged` holds the original input values (after side for mapped and added nodes, before side for removed ones), deep-copied; an unchanged `$ref` stays a `$ref`; `merged: "normalized"` restores the 1.x content |
| merged arrays in before order | merged arrays in after order with removed items appended (objects: after keys first, removed keys last); array meta keyed by the merged position |
| unsupported documents diffed as plain JSON Schema | `UnsupportedSpecError` (Swagger 2, OpenAPI 4+, AsyncAPI 1.x / 4+, GraphApi versions other than 1.x, two different specifications); `options.engine` forces an engine |
| GraphApi 0.1.2 documents (`graphapi: 0.1.2`, written by gqlapi 0.5 and earlier) | GraphApi 1.0 documents (`graphapi: "1.0"`, written by gqlapi 0.6 and later); a 0.1.2 document throws `UnsupportedSpecError` |
| `Diff = { type, action, path, before?, after?, description? }` | plus `scope` (always) and `origin?: { before, after }` (declaration paths inside `$ref` targets); `action` can be `"rename"` for renamed paths, components, channels and messages (`before` / `after` are the old and the new key) |
| classifier errors printed with `console.error` | `options.onError` or `result.errors` |
| `components.*` diffs with request semantics | classified by usage (unreferenced: `unclassified`); a change inside a component is reported at the declaration and, unless it is annotation-only, at every usage location; a change inside a GraphQL type is reported at the type declaration, not inside every operation that reaches it |
| direction through reversed rule copies (`transformComapreRules`, `openApiSchemaRules({ response: true })`) | direction is a scope (`CompareRule.scope`, scoped `ClassifyRule`s); `response` options and the `cache` argument of `createRefsCompareResolver` / `jsonSchemaRules` are ignored |
| description texts | rewritten (values in backticks, nearest container named); update any pattern that matches descriptions |
| ES2015 build, UMD `dist/index.cjs`, `dist/index.mjs` | ES2020 build (Node.js 18 or later, Chrome 80, Firefox 74, Safari 13.1); `dist/index.js` (ES module) and `dist/index.cjs` (CommonJS) with bundled declarations; `dist/api-smart-diff.min.js` is still the browser build with the global `ApiSmartDiff` |

## Step by step

### 1. Replace `apiDiff` and `apiMerge`

```ts
// 1.x
import { apiDiff, apiMerge } from "api-smart-diff"
const diffs = apiDiff(before, after)
const merged = apiMerge(before, after)

// 2.0.0
import { apiCompare } from "api-smart-diff"
const { diffs, merged } = apiCompare(before, after)
```

### 2. Handle `risky` and `rename`

```ts
import type { DiffType } from "api-smart-diff"

const colours: Record<DiffType, string> = {
  breaking: "red",
  risky: "orange", // new in 2.0.0
  "non-breaking": "green",
  deprecated: "purple",
  annotation: "blue",
  unclassified: "grey",
}

for (const diff of diffs) {
  if (diff.action === "rename") {
    console.log(`renamed ${diff.before} to ${diff.after} at /${diff.path.join("/")}`)
  }
}
```

### 3. Read component changes at `components/...`

A change inside a shared schema, response, parameter or message is reported once at its declaration and once per usage location (annotation-only changes at the declaration only). If you counted diffs per operation, the counts change; if you list changes, decide whether to show the declarations, the usages or both (see [Components and $ref](./components)).

### 4. Catch `UnsupportedSpecError`

Swagger 2 documents and mixed specifications used to be compared as plain JSON; they now throw. Convert Swagger 2 to OpenAPI 3 first, or pass `engine: "jsonschema"` to compare the documents as plain values.

GraphApi 0.1.2 documents throw as well ("GraphApi 0.1.2 is not supported: convert the GraphQL SDL with gqlapi 0.6 or later, which writes GraphApi 1.0"). Rebuild both sides from the GraphQL SDL with gqlapi 0.6 or later — `buildFromSchema(buildSchema(sdl))` — and compare the GraphApi 1.0 documents. GraphApi 1.0 paths differ from 0.1.2 paths (object fields are under `methods`, non-null is `nonNull: true`, enum values are keyed under `values`), so update any code that reads `Diff.path` of GraphQL diffs.

### 5. Check the merged document

If your code relied on the normalized content of `merged` (path-level parameters inside operations, `examples` instead of `example`, merged `allOf`), pass `merged: "normalized"`. If it walked merged arrays by before index, note that they follow the after order now.

### 6. Update description matching

Description texts are rewritten. Code that matched them with patterns should use `action`, `path`, `type` and `scope` instead.

### 7. Custom rules

Rule trees, `ClassifyRule` tuples and the shorthands still work. Rules that relied on reversed copies for responses (`openApiSchemaRules({ response: true })`, `transformComapreRules`) should use scopes: a plain 3-tuple is inverted automatically in response-like scopes, and the object form `{ request, response, default }` expresses direction-specific rules (see [Direction and scopes](./scopes)). Legacy arguments (`createRefsCompareResolver(cache?)`, `jsonSchemaRules({ cache })`, `openApiSchemaRules({ response })`) are accepted and ignored.
