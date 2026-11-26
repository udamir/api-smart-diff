# Changelog

## 2.1.0

GraphQL schemas are now compared only in the GraphApi 1.0 encoding, which gqlapi 0.6 and later write. Everything else behaves as in 2.0.0.

### Breaking changes

- GraphApi 0.1.2 documents (`graphapi: 0.1.2`, written by gqlapi 0.5 and earlier) are no longer supported: `apiCompare`, `detectSpec` and `compareGraphApi` throw `UnsupportedSpecError` with the message "GraphApi 0.1.2 is not supported: convert the GraphQL SDL with gqlapi 0.6 or later, which writes GraphApi 1.0" (the same for any `graphapi: 0.x`). In 2.0.0 they were compared with their own rule set. Rebuild both sides from the GraphQL SDL with gqlapi 0.6 or later (`buildFromSchema(buildSchema(sdl))`) and compare the GraphApi 1.0 documents; GraphApi 1.0 paths differ from 0.1.2 paths (object fields under `methods`, non-null as `nonNull: true`, enum values keyed under `values`), so update code that reads `Diff.path` of GraphQL diffs.
- `compareGraphApi` (and `apiCompare` with `engine: "graphapi"`) treats a document without a `graphapi` field as GraphApi 0.1.2 and throws the same error. `detectSpec` and `apiCompare` without `engine` still read a document without a `graphapi` field as a JSON Schema, as in 2.0.0.
- Comparing a GraphApi 1.0 document with a 0.1.2 document throws the 0.1.2 error above instead of "Cannot compare GraphApi 0.1.2 with GraphApi 1.0".
- `graphApiRules` is the GraphApi 1.0 rule set (in 2.0.0 it was the 0.1.2 rule set) and takes no options; `graphApi10Rules` is removed. Replace `graphApi10Rules()` with `graphApiRules()`.
- The `GraphApiRulesOptions` type is removed: its only option, `notMergeAllOf`, applied to the 0.1.2 rule set (GraphApi 1.0 documents have no `allOf`).

### Fixes

- A GraphApi document whose `graphapi` field is a number, as an unquoted `graphapi: 1.0` in YAML parses, is compared with the GraphApi 1.0 rules; 2.0.0 used the 0.1.2 rules for it and left some changes `unclassified`.
- The name of a root operation type that is added or removed together with the type reads "[Added] mutation root type name `M`" instead of "[Added] mutation root type name from `Mutation` to `M`" (it is not a rename).

## 2.0.0

The first major release since 1.0.6: a new compare engine behind the same entry points, more specifications (gRPC / Protocol Buffers among them), a sixth classification, usage-based classification of shared components, rename detection, rewritten descriptions and much faster comparison. `apiCompare`, `compareOpenApi`, `compareAsyncApi`, `compareGraphApi`, `compareJsonSchema` and `compare` keep their signatures, `CompareResult` is still `{ diffs, merged, rootMergeMeta }`, `Diff.path` is still the path in the before document, and custom `rules`, `annotateHook` and `ClassifyRule` tuples still work. Step-by-step upgrade notes: [Migration from 1.x](https://udamir.github.io/api-smart-diff/guide/migration).

### Highlights

- **More specifications.** OpenAPI 3.1 and 3.2 (and comparison across 3.0, 3.1 and 3.2), AsyncAPI 3.0, GraphQL in the GraphApi 1.0 encoding, JSON Schema draft-06 and draft-07 next to draft-04 and 2020-12, and gRPC / Protocol Buffers in the ProtoApi encoding, with four compatibility levels named after buf's breaking categories.
- **A sixth classification, `risky`.** Changes that are valid for most clients but can break some (an enum value added to a response, a required response property made optional, a GraphQL argument added with a default) are no longer reported as `breaking` or `non-breaking`.
- **Classification from the consumer's point of view, consistently.** Every diff carries the `scope` it was compared in (`request`, `response`, `components`, …); shared components take the class of the places that use them; AsyncAPI, OpenAPI webhooks and GraphQL follow the same direction rules as OpenAPI requests and responses.
- **Renames are recognized.** A renamed path, component, security scheme, AsyncAPI channel or message is one `rename` diff instead of a removal plus an addition, and the old and new definitions are still compared.
- **Inputs are never modified, and `merged` holds your values.** The merged document contains the original (not normalized) values in the after order, deep-copied.
- **Much faster.** On the GitHub REST API description (7.6 MB) a set of changes compares in 0.14 s instead of 10 s with 1.0.6, and the GitHub GraphQL schema, which 1.0.6 does not finish, compares in 0.07 to 0.15 s.

### Breaking changes

API and TypeScript:

- `apiDiff` and `apiMerge` are removed. Use `apiCompare(before, after, options).diffs` and `.merged`.
- The package exports only its documented API (listed in the [API reference](https://udamir.github.io/api-smart-diff/guide/api)): the comparison functions, the constants and result types, and the building blocks of custom rules (`compare`, the rule sets, the annotate hooks, the classifier shorthands, the generic mapping resolvers, the extension helpers, `createRefsCompareResolver`, `transformCompareRules`, `reverseClassifyRuleTransformer` and the rule types). The internal helpers 1.0.6 also exported are gone, among them `discoverCompareEngine` (use `detectSpec(document).engine`, or `apiCompare` with `options.engine`), `getParentContext` (use `NodeContext.up`), the value helpers (`getKeyValue`, `getStringValue`, `isObject`, `isString`, `typeOf`, `objectKeys`, …), the JSON Schema helpers (`buildPath`, `getRef`, `resolveRef`, `getTarget`, `inferTypes`, …), the per-specification classifiers, mapping resolvers, transforms and description helpers (`pathMappingResolver`, `paramMappingResolver`, `combinaryCompareResolver`, `transformOpenApiSchema`, `operationSecurityChangeAnnotation`, `getMaxOpenApiVersion`, `graphApiSchemaRules`, `transfromGraphSchemaDirective`, …), the walk internals (`createContext`, `createChildContext`, `diffFactory`, `createDiff`, …) and their types (`ContextInput`, `MergeState`, `MergeFactoryResult`, `JsonNode`, `NodeRoot`, `DiffFactory`, `KeyMapping`, …). To keep a built-in resolver or classifier in a custom rule tree, spread the built-in node that holds it; the `AddDiffType` … `ReversedReplaceDiffType` aliases are `RuleDiffType`.
- Misspelled names are corrected without aliases: `ComapreOptions` → `CompareOptions`, `ComapreContext` → `CompareContext`, `OpenApiComapreOptions` → `OpenApiCompareOptions`, `AsyncApiComapreOptions` → `AsyncApiCompareOptions`, `JsonSchemaComapreCache` → `JsonSchemaCompareCache`, `transformComapreRules` → `transformCompareRules`. Rename the imports.
- Annotation template parameters are spelled `arrayItem`, `definition` and `possible` (were `arratItem`, `difinition`, `possbile`). Update custom templates or `annotateHook`s that use them.
- `DiffType` (and `ClassifierType`) has a sixth value, `"risky"`. An exhaustive `switch`, a `Record<DiffType, …>` map, a colour map or a filter over the diff type needs a `risky` entry; treat it as breaking for a strict gate and as non-breaking for a changelog.
- `ClassifyRule` is a 3-tuple, a 6-tuple or an object with one tuple per scope (`{ request: [...], response: [...], default: [...] }`). Code that reads the entries of a rule by index must handle the object form.
- A custom `compare` resolver (`CompareResolver`) returns `CompareResult | undefined` (was `CompareResult | void`); a resolver declared with an explicit `void` return type no longer type-checks, return `undefined` instead.
- The arguments `createRefsCompareResolver(cache)`, `jsonSchemaRules({ cache })` and `openApiSchemaRules({ response })` are still accepted but ignored: direction is a scope now, see [Direction and scopes](https://udamir.github.io/api-smart-diff/guide/scopes).

Results:

- `merged` holds the original input values: the after value for mapped and added nodes, the before value for removed ones, deep-copied so that it never shares objects with the inputs. In 1.0.6 it held the normalized comparison values (path-level parameters moved into operations, `example` turned into `examples`, `allOf` merged, …) and shared objects with the inputs. An unchanged `$ref` stays a `$ref`; a `$ref` whose target changed is inlined where it is used. Pass `merged: "normalized"` if your code needs the 1.x content.
- Merged arrays follow the after order, with removed items appended at the end, and the array meta is keyed by the position in the merged array (in 1.0.6 the array was in before order while the meta used after indexes). Merged objects list the after keys first and the removed keys last. Code that walks merged arrays by before index must use the merged positions.
- Documents that are not supported throw `UnsupportedSpecError` instead of being compared as plain JSON: Swagger 2.0, OpenAPI 4 or later, AsyncAPI 1.x or 4 or later, unknown GraphApi or ProtoApi versions, two documents of different specifications, AsyncAPI 2.x against 3.0 and GraphApi 0.1.2 against 1.0. Convert Swagger 2.0 to OpenAPI 3 first, or pass `engine: "jsonschema"` to compare the documents as plain values.
- Nothing is written to the console: classification, description, `$ref`, transform and mapping errors go to `options.onError`, or, without it, to `result.errors` (1.0.6 printed them with `console.error`).
- Changes inside `components` are classified by how the component is used: a schema used only in responses gets response semantics, one used in both directions is breaking if it is breaking in either, and a component nothing references is `unclassified` (with a description). In 1.0.6 every component change was classified with request semantics. `components: "unclassified"` leaves all component changes unclassified.
- Where changes are reported: a change inside a shared component is reported once at its declaration (`components/...`) and once at each place an operation, webhook or channel uses it, with `origin` pointing at the declaration; documentation-only changes (descriptions, examples, `x-*` values) are reported at the declaration only. In 1.0.6 a change was repeated inside every component that referenced it, and a GraphApi 0.1.2 type change was repeated inside every operation that reached the type; it is now reported at the type. Read changes of shared schemas, responses, parameters, messages and GraphQL types at `components/...`, and expect different diff counts.
- Renamed paths, components of any kind, security schemes, AsyncAPI channels, channel messages and components are reported as one diff with `action: "rename"` (`before` and `after` are the old and new key), classified `annotation`, instead of a removal and an addition. Handle the `rename` action.
- Description texts are rewritten: values in backticks, the nearest container named ("in query parameter `limit`", "in Response 200 content (application/json)"), long free text shortened. Code that matches descriptions with patterns should use `action`, `path`, `type` and `scope` instead.
- Many classifications differ from 1.0.6 (see "Fixes" and the [Classification](https://udamir.github.io/api-smart-diff/guide/classification) guide). Re-check snapshots or gates that depend on the class of a specific change.

Package and runtime:

- The package is `"type": "module"`. `import` resolves to `dist/index.js` (was `dist/index.mjs`) and `require` to `dist/index.cjs`, which is now plain CommonJS (was a UMD bundle). Type declarations are bundled into `dist/index.d.ts` and `dist/index.d.cts`; the per-file declarations under `dist/core/`, `dist/openapi/`, … are gone. Import everything, types included, from `"api-smart-diff"`.
- The `browser` field is removed (it pointed bundlers at the script-tag build, which has no exports); bundlers now use the ES module build. The script-tag build is still `dist/api-smart-diff.min.js` with the global `ApiSmartDiff`, now also named by the `unpkg` and `jsdelivr` fields.
- The ES module and CommonJS builds import `json-crawl` (^1.2.0) and `allof-merge` (^1.0.1) from `node_modules` instead of containing copies of older versions; the script-tag build still bundles them. Custom rule trees use the json-crawl 1.x rule syntax.
- Node.js 18 or later is required, and the code is compiled to ES2020 (was ES2015): browsers need Chrome 80, Firefox 74, Safari 13.1 or an equivalent engine. Use a transpiler for older engines.

### New

- **OpenAPI 3.1 and 3.2**: webhooks, `components.pathItems` and `mediaTypes`, the `query` method and `additionalOperations`, `querystring` parameters, streaming media types (`itemSchema`, `itemEncoding`, `prefixEncoding`), tag hierarchy, `$self`, `jsonSchemaDialect`, `discriminator.defaultMapping`, OAuth device authorization and `oauth2MetadataUrl`. Documents of different 3.x versions are compared with the higher version's rules, and representation-only differences (`nullable: true` vs `type: [T, "null"]`, boolean vs numeric exclusive bounds, `example` vs `examples`) are no change. Also new for all 3.x versions: rules for links, callbacks, OAuth flows, parameter `content`, `example`, `examples`, `allowEmptyValue` and `allowReserved`, header `schema` and `content`, response `summary`, `xml`; servers are matched by name or URL and tags by name. `openapi3Rules({ version })` builds the rules of one version.
- **AsyncAPI 3.0**: channels, operations with `send` and `receive`, `reply`, `components`, Multi Format Schema Objects. Payload schemas of both 2.x and 3.0 are read in the dialect their `schemaFormat` names (AsyncAPI schema, JSON Schema, OpenAPI 3.0 and 3.1 schema objects); message traits are classified by their effect on the messages that apply them.
- **GraphApi 1.0** (the encoding written by gqlapi 0.6 `buildFromSchema`), with the same verdicts and descriptions as the 0.1.2 encoding; the rule set is chosen by the document's `graphapi` field.
- **gRPC / Protocol Buffers** (`compareProtoApi`, detected from `protoapi: "0.1"`): compares the ProtoApi documents that the separate package [protoapi](https://github.com/udamir/protoapi) builds from `.proto` sources (`buildFromProto(files, { imports: "user" })`; install it with `npm install protoapi`, api-smart-diff does not depend on it). `options.compatibility` chooses the clients a change is judged for: `"FILE"` (default) and `"PACKAGE"` cover binary and ProtoJSON clients and the generated code per file or per package, `"WIRE_JSON"` binary and ProtoJSON clients only, `"WIRE"` binary clients only; a change that breaks only generated code is `risky` where generated code is covered and an `annotation` where it is not, and a change never gets a more severe class at a more lenient level. Compared: services and rpcs (request and response types, streaming, idempotency, HTTP bindings), messages, fields (paired by number: wire-compatible type changes per level, cardinality, presence, JSON names, defaults, oneofs, packed encoding), enums (values paired by number, aliases, open and closed enums), extensions, reserved numbers and names, files, packages and options. protovalidate and protoc-gen-validate rules, `google.api.field_behavior`, `google.api.http` and the openapiv2 annotations are compared by meaning and classified by the direction of the rpcs that use the message, like OpenAPI request and response schemas; language-specific options (`go_package`, `java_*`, …) only affect generated code. Each change is one diff per element, described in protobuf terms (``[Replaced] type of field `priority` (4) in message `shop.v1.Order` from `int32` to `int64` ``). `options.files: "ignore"` makes file paths annotations, and `options.optionRules` classifies your custom options (`"/acme.*"`, `"/acme.audit"`); protoapi's `locateDiff` maps a diff to its `.proto` line. The classification was checked against `buf breaking` 1.75.0 in all four categories on buf's own test cases. See [Protocol Buffers](https://udamir.github.io/api-smart-diff/guide/protoapi).
- **JSON Schema** draft-06 and draft-07, detected from `$schema` (two different drafts are read in the later one), with the 2020-12 keywords `prefixItems`, `$defs`, `dependentRequired`, `dependentSchemas`, `contentSchema`, `unevaluatedProperties` / `unevaluatedItems`, `minContains` / `maxContains`, `if` / `then` / `else` and `$dynamicRef`, boolean schemas, effective numeric bounds, `multipleOf` divisibility, `integer` as a subtype of `number`, and recognition of equivalent rewrites (`maxItems: 0` vs `items: false`, a type list vs `anyOf` of single types, …) as one annotation. `compareJsonSchema` takes a `version` option.
- `risky` classification: `ClassifierType.risky`, the `risky` constant and the `allRisky` shorthand for custom rules.
- `Diff.scope` (always set) names the scope the change was compared in, and `Diff.origin` (`{ before, after }`) gives the declaration paths when a change inside a `$ref` target is reported at a usage.
- Options: `engine` (`"openapi" | "asyncapi" | "graphapi" | "protoapi" | "jsonschema"`, skip detection), `onError`, `components: "usage" | "unclassified"`, `merged: "original" | "normalized"`, `compareUnchanged` (walk equal subtrees for custom rules that report on equal values) and `extensions` (rules for `x-*` keys). `result.errors` collects errors when `onError` is not set.
- `detectSpec(document)` returns the engine and version `apiCompare` would use; `UnsupportedSpecError` is exported.
- Specification extensions: every `x-*` change is an `annotation` naming the key, and `options.extensions` gives specific keys their own semantics, for example `x-extensible-enum` with enum semantics. Rule trees accept prefix rules such as `"/x-*": rule`. See [Specification extensions](https://udamir.github.io/api-smart-diff/guide/extensions).
- Scopes for custom rules: `CompareRule.scope`, `CompareContext.scope`, the scoped object form of `ClassifyRule`, and the exported `CompareScopes`. See [Custom rules](https://udamir.github.io/api-smart-diff/guide/custom-rules).
- Context for custom resolvers: the compare session on `CompareContext.session` (`$ref` resolution, caches, error reporting), and `NodeContext.up`, `source`, `origin` and `kind`.
- A documentation portal at [udamir.github.io/api-smart-diff](https://udamir.github.io/api-smart-diff/) with a guide, an API reference, runnable examples and an [online demo](https://udamir.github.io/api-smart-diff/demo). The Protocol Buffers examples and the demo accept `.proto` sources, build them with protoapi in the browser, offer the four compatibility levels and highlight the `.proto` line of a diff.

### Fixes

General:

- The input documents are no longer modified (1.0.6 wrote normalized values into them, for example path-level parameters moved into operations, `required: false` dropped), and `merged` no longer shares objects with the inputs.
- `externalSources` is used: external `$ref`s are resolved from the documents passed per side (relative references against OpenAPI 3.2 `$self`); 1.0.6 accepted the option but ignored it.
- Reusing a rule set (`openapi3Rules()`, `jsonSchemaRules()`, …) for several comparisons no longer returns stale results from the previous comparison.
- `$ref` cycle detection no longer skips non-cyclic references (a second property using the same `$ref`, `$defs` references inside a referenced schema), and `apiCompare` no longer hangs on bundled documents whose `$ref` cycles carry sibling keywords (`{ $ref, description }` inside a cycle).
- A change inside a `$ref` target used in several places is described with the location of each usage, not with that of the first usage.
- Every diff has a description: 1.0.6 returned diffs without one (all AsyncAPI diffs, component diffs, header and many other changes) and descriptions containing `undefined` or unresolved template placeholders.

OpenAPI:

- Response codes with uppercase letters (`4XX`, `5XX`) are compared; 1.0.6 silently dropped every change inside them.
- Response values follow response rules: changing the `type`, `format`, `pattern` or an enum value of a response property is breaking (was non-breaking), adding an enum value to a response is `risky` (was breaking), and `nullable: true` added to a response schema is breaking (was non-breaking).
- Schemas in `$ref` responses and in `components.responses` are classified with response semantics (were request semantics).
- Response headers follow the response direction: removing an optional response header and making a response header required are non-breaking, making it optional is breaking (1.0.6 had all three the other way round). Response header names are compared case-insensitively.
- A schema added to a response or removed from a request is non-breaking (was breaking); removing a non-success or `default` response is non-breaking (was breaking).
- Header parameter names are compared case-insensitively (`X-Id` → `x-id` was a removal plus an addition); `Accept`, `Content-Type` and `Authorization` header parameters, which have no effect in OpenAPI, are annotations.
- Path-level and operation-level parameters follow the OpenAPI override rules (identical documents produced diffs in 1.0.6), explicit `explode` changes on form parameters are detected, and `$ref` path items are compared (1.0.6 emptied them).
- `additionalProperties: true` → `false` in a request is breaking (was non-breaking); `type` is no longer inferred from validators, so adding or removing `type` is reported (1.0.6 reported nothing for `{ minimum: 1 }` → `{ type: "number", minimum: 1 }`).
- Security: securing a previously public operation is breaking (was non-breaking), requirement alternatives are compared as a set, removing operation security when there is no global security is non-breaking, global security changes that no operation inherits are non-breaking, and the HTTP authentication scheme is compared case-insensitively.
- Parameter `example`, `examples`, `allowEmptyValue`, `allowReserved` and `content`, response header `schema`, `links`, `callbacks`, OAuth flows, root `tags` and `externalDocs` are classified (were unclassified).

AsyncAPI 2.x:

- Message and trait `$ref`s are resolved where they are used, so a payload change in `components.messages` is classified at the channel (1.0.6 reported one unclassified diff under `components`).
- Messages the application receives (`publish`) are classified like requests and messages it sends (`subscribe`) like responses, consistently for payloads and headers; message `headers` changes are classified (were unclassified).
- Security requirements and schemes are classified like OpenAPI security (1.0.6 reported security requirement changes as annotations and scheme changes as unclassified).

GraphQL:

- Argument and input rules are no longer inverted: adding a required argument, making an argument non-null or changing its type is breaking (was non-breaking), and an argument or input field added with a default value is `risky`.
- Adding a query, mutation, subscription or scalar is non-breaking and removing one is breaking (both were unclassified); removing an output field is breaking.
- Removing a union member is breaking (was non-breaking); a type that no longer implements an interface is breaking (was unclassified).
- A change inside a named type is reported once at the type, not once inside every operation that reaches it; on large schemas this also removes most of the comparison time.

### Performance

2.0.0 compares only what changed: subtrees that are equal in both documents are copied without being walked, each `$ref` target is compared once per call, and time grows linearly with the width of a document. Measured with the final 2.0.0 build against the published 1.0.6 package on the same machine (Node.js 26, Intel Core i9-9880H; minimum of 7 to 11 timed calls after warm-up, one fresh process per measurement, documents parsed outside the timing):

- GitHub REST API description (7.6 MB JSON, 1 281 operations) with 21 changes: 0.14 s instead of 10.2 s, about 70× faster.
- GitHub public GraphQL schema (1.1 MB SDL) with 18 changes: 1.0.6 does not finish within 90 s; 2.0.0 takes 0.15 s with GraphApi 0.1.2 input and 0.07 s with GraphApi 1.0 input.
- OpenAPI petstore with 24 changes: 2.6 ms instead of 34 ms (13×); a schema with 10 000 properties: 21 ms instead of 2.7 s; 500 usages of one changed `$ref`: about 12× faster.
- A schema with 1 500 properties takes the same time in a request and in a response (2.7 ms); 1.0.6 was several times slower on responses (131 ms request, 620 ms response).
- A 3 KB AsyncAPI 2.6 event API with 12 changes takes about the same time as with 1.0.6 (1.3 ms), while reporting each change both at its declaration and where it is used.
- Protocol Buffers (new, measured against `buf breaking` 1.75.0 on the same `.proto` trees): an API of 1 700 messages (1.6 MB of `.proto` sources) with 119 changes compares in 0.17 s from built documents and in 2.1 s including protoapi's build of both trees, where `buf breaking` takes 3.6 s; 10 200 messages (9.7 MB) take 1.2 s from built documents and 12.5 s including the build (buf: 20 to 24 s per category). The googleapis Compute Engine API (4.2 MB of `.proto` sources, 2 352 messages, 1 095 rpcs) with 180 changes compares in 0.1 s after protoapi builds each side in under a second. The time is the same at every compatibility level.

Size: the browser build `dist/api-smart-diff.min.js` is 381 KB minified and 116 KB gzipped (1.0.6: 63 KB and 18 KB; the Protocol Buffers engine accounts for 75 KB and 23 KB of it), because of the added specifications and rules and the newer json-crawl and allof-merge it bundles; the ES module and CommonJS builds import those dependencies instead of bundling them.

### Known limitations

- A schema reached through a chain of more than about a thousand `$ref`s, each schema referencing the next, is not compared at the place that uses the chain: a change at the end of such a chain is reported only at its declaration under `components`, and `result.errors` (or `onError`) receives the error "Maximum call stack size exceeded". Chains of 600 schemas compare normally, and long chains of components that only reference each other are not affected. Real API documents are not known to contain such chains.
- Comparison time and memory grow with the square of the nesting depth: 500 levels take a few milliseconds, 5 000 levels about 1.5 s, and around 10 000 levels exhaust a 4 GB heap.
- Protocol Buffers: both documents must be built with the same protoapi version and the same options (`imports: "user"`, the default); a renamed message or enum is a removal plus an addition; fields are paired by number only; additions to responses assume ProtoJSON readers that ignore unknown fields (Go `protojson` with `DiscardUnknown`, Java `JsonFormat.parser().ignoringUnknownFields()`); buf's `CSR` category is not covered, and imports are not resolved over the network or from the Buf Schema Registry.
- No comparison across AsyncAPI 2.x and 3.0 or across GraphApi 0.1.2 and 1.0. External `$ref`s are resolved only from `externalSources` (nothing is fetched). AsyncAPI payloads in formats other than JSON Schema (Avro, RAML, Protobuf, …) are compared as opaque values.

More on the [Limitations](https://udamir.github.io/api-smart-diff/guide/limitations) page.

### Requirements

- Node.js 18 or later (tested on 18, 20, 22, 24 and 26). allof-merge 1.0.1 declares Node.js 22 or later, so npm prints an engine warning on Node.js 18 and 20; the package works there.
- Browsers: ES2020 (Chrome 80, Firefox 74, Safari 13.1 or later).
- GraphQL SDL is converted with [gqlapi](https://github.com/udamir/graphapi) and `graphql`, which you install yourself.
- `.proto` sources are built with [protoapi](https://github.com/udamir/protoapi) 0.1 (`npm install protoapi`, Node.js 18 or later), which you install yourself.

## 1.x

Releases up to 1.0.6 were not recorded in this file; see the git history and the GitHub releases of `udamir/api-smart-diff`.
