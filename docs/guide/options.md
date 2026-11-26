# Options

`apiCompare(before, after, options)` and every engine take a `CompareOptions` object; all fields are optional.

```ts
type CompareOptions = {
  rules?: CompareRules                 // a complete rule tree replacing the built-in one
  extensions?: CompareExtensionRules   // custom `x-*` rules merged over the built-in "/x-*" rule

  metaKey?: string | symbol            // key of the change metadata in `merged` (default "$diff")
  arrayMeta?: boolean                  // array item meta on the array itself (default: on the parent)
  annotateHook?: AnnotateHook          // custom description hook

  externalSources?: {                  // documents for external $refs, per side, keyed by URI
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }

  onError?: (error: CompareError) => void   // receives errors; without it they are returned in `errors`
  components?: "usage" | "unclassified"     // classification of components.* (default "usage")
  merged?: "original" | "normalized"        // content of `merged` (default "original")
  compareUnchanged?: boolean                // walk structurally equal subtrees too (default false)
  engine?: "openapi" | "asyncapi" | "graphapi" | "protoapi" | "jsonschema" // force an engine in apiCompare
}
```

| Option | Default | Effect |
| --- | --- | --- |
| [`engine`](#engine) | detected | force an engine instead of `detectSpec` |
| [`onError`](#onerror) | collect | receive every `CompareError`; without it errors are returned in `result.errors` |
| [`externalSources`](#externalsources) | none | documents for external `$ref`s, keyed by URI, per side |
| [`merged`](#merged) | `"original"` | `"normalized"` returns the normalized comparison values in `merged` |
| [`components`](#components) | `"usage"` | `"unclassified"` leaves every diff inside `components.*` unclassified |
| [`compareUnchanged`](#compareunchanged) | `false` | walk structurally equal subtrees too (for custom rules) |
| [`extensions`](#extensions) | built-in `"/x-*"` rule | custom rules for `x-*` keys |
| [`rules`](#rules) | spec rule set | a complete custom rule tree |
| [`annotateHook`](#annotatehook) | spec hook | custom descriptions |
| [`metaKey`](#metakey) | `"$diff"` | key (string or `Symbol`) of the change metadata in `merged` |
| [`arrayMeta`](#arraymeta) | `false` | store array item meta on the array instead of on its parent |
| [`compatibility`](#compatibility-protoapi) | `"FILE"` | ProtoApi: the clients and the generated code a change is judged for |
| [`files`](#files-protoapi) | `"compare"` | ProtoApi: `"ignore"` makes file paths and file-level statements annotations |
| [`optionRules`](#optionrules-protoapi) | built-in option rules | ProtoApi: custom rules for option keys |

Engine-specific options: `compareProtoApi` (and `apiCompare` for ProtoApi documents) takes `compatibility`, `files` and `optionRules` (below); `compareOpenApi`, `compareAsyncApi` and `compareJsonSchema` accept `notMergeAllOf: true` (compare `allOf` branches as written instead of merging them first); `compareJsonSchema` takes `version` (`"draft-04" | "draft-06" | "draft-07" | "2020-12"`, overriding the draft read from `$schema`).

## engine

Forces an engine in `apiCompare` instead of detecting the specification. Use it to compare a recognized document as plain JSON with the JSON Schema engine, or a document without a marker as OpenAPI.

```ts
apiCompare(before, after, { engine: "jsonschema" })
```

## onError

Problems inside a comparison never throw and are never printed. A classifier or description function that throws, a `$ref` that cannot be resolved, a failing transform or mapping resolver: each is reported as a `CompareError` and the comparison continues (an unresolvable `$ref` is compared as an opaque value).

```ts
type CompareError = {
  kind: "classify" | "annotate" | "ref" | "transform" | "mapping" | "compare"
  message: string        // e.g. "Cannot resolve $ref: other.json#/X"
  path: JsonPath         // where it happened
  scope: CompareScope    // the scope of that node
  error?: unknown        // the original exception, if any
}
```

Without `onError` the errors are returned in `result.errors` (present only when at least one occurred); with `onError` they are passed to it and `result.errors` is absent.

## externalSources

Documents for external `$ref`s, per side, keyed by the URI the `$ref` names (relative references are resolved against OpenAPI 3.2 `$self` when the document has one). Resolution is synchronous; nothing is fetched. An unresolvable `$ref` is reported through `onError` / `errors`.

```ts
const { diffs } = apiCompare(before, after, {
  externalSources: {
    before: { "https://example.com/schemas/pet.json": petsV1 },
    after: { "https://example.com/schemas/pet.json": petsV2 },
  },
})
// a $ref "https://example.com/schemas/pet.json#/Pet" resolves to petsV1.Pet / petsV2.Pet
```

See the [external sources example](/examples/#external-ref-resolved-from-externalsources). For multi-file documents, bundling them first ([api-ref-bundler](https://github.com/udamir/api-ref-bundler)) is the alternative.

## merged

`merged: "original"` (the default) builds the merged document from the original input values: the after-side value for mapped and added nodes, the before-side value for removed nodes, deep-copied. `merged: "normalized"` returns the values the engine compared instead — path-level parameters moved into operations, defaults made explicit, `example` → `examples`, `const` → `enum`, merged `allOf`, … — which is the 1.x output. See [Result § Merged document](./result#merged-document).

## components

`components: "usage"` (the default) classifies every change inside `components.*` by the places that reference the component: a schema used only in responses gets response semantics, one used in both directions takes the most severe class, and an unreferenced component is `unclassified`. `components: "unclassified"` opts out and leaves every component diff unclassified (the usage locations are still classified in their own scope). See [Components and $ref](./components).

## compareUnchanged

A subtree that is structurally equal in both documents, whose `$ref`s point at unchanged targets, cannot produce a diff with the built-in rules, so the engine copies it into `merged` without walking it — no transform, `compare` resolver or mapping resolver runs inside it. A custom rule set whose resolvers report diffs on equal values (a lint-like rule that flags a missing `operationId` in every operation, for example) sets `compareUnchanged: true` to have such subtrees walked too. The result of the built-in rule sets is the same either way; the option only costs time. `merged: "normalized"` always walks every subtree.

## extensions

Custom rules for specification extensions (`x-*` keys), merged key-wise over the built-in `"/x-*"` rule that every OpenAPI / AsyncAPI object and every JSON Schema node carries. An exact key (`"/x-extensible-enum"`) is merged field by field over `"/x-*"`; a longer prefix (`"/x-internal-*"`) replaces it for the keys it matches; a custom `"/x-*"` entry overrides the built-in fields. Ignored when `rules` is given. See [Specification extensions](./extensions).

```ts
import { allBreaking, apiCompare } from "api-smart-diff"

apiCompare(before, after, { extensions: { "/x-internal": { $: allBreaking } } })
```

## rules

A complete rule tree that replaces the engine's built-in one. Usually you start from a built-in tree (`openapi3Rules`, `asyncApi2Rules`, `asyncApi3Rules`, `jsonSchemaRules`, `graphApiRules`, `graphApi10Rules`) and change parts of it. See [Custom rules](./custom-rules).

## annotateHook

`(diff: Diff, ctx: CompareContext) => string` — produces `diff.description`. Each engine has its own (`openApi3AnnotateHook`, `asyncApiAnnotateHook`, `jsonSchemaAnnotationHook`, `graphApiAnnotateHook`); a custom hook replaces it, and usually delegates to it for the changes it does not handle:

```ts
import { apiCompare, openApi3AnnotateHook } from "api-smart-diff"

apiCompare(before, after, {
  annotateHook: (diff, ctx) => {
    const text = openApi3AnnotateHook(diff, ctx)
    return diff.type === "breaking" ? `⚠ ${text}` : text
  },
})
```

## metaKey

The key under which the merged document carries the change metadata, `"$diff"` by default. A `Symbol` keeps the metadata invisible to `JSON.stringify`, `Object.keys` and spreads:

```ts
const metaKey = Symbol("diff")
const { merged } = apiCompare(before, after, { metaKey })
merged.paths["/pets"][metaKey] // meta of the children of /pets
```

## arrayMeta

By default the meta of array items is stored on the array's parent as `{ [arrayKey]: { array: { [index]: meta } } }` (JSON-serializable). `arrayMeta: true` stores it on the array itself, as `array[metaKey] = { [index]: meta }` — convenient in code, but not visible in `JSON.stringify` output. See [Result § Merged document](./result#merged-document).

## compatibility (ProtoApi)

The [compatibility level](./protoapi#compatibility-levels) of a Protocol Buffers comparison, named after buf's breaking categories: `"FILE"` (default: binary and ProtoJSON clients, generated code per file), `"PACKAGE"` (generated code per package), `"WIRE_JSON"` (binary and ProtoJSON clients only) or `"WIRE"` (binary clients only). A diff's class never increases from `FILE` to `WIRE`; another value is a `TypeError`.

```ts
apiCompare(before, after, { compatibility: "WIRE_JSON" })
```

## files (ProtoApi)

`"ignore"` makes file paths, file-level statements (`syntax`, imports, file options) and the declaring file of every element annotations, for `.proto` trees whose file paths carry no meaning (generated or flattened inputs); the package of a file keeps its class. Default `"compare"`.

## optionRules (ProtoApi)

Rules for the options of every element (file, service, rpc, message, field, enum, value, …), in the [custom rules](./custom-rules) syntax with the option name without parentheses as the key: `"/acme.audit"` for one option, `"/acme.*"` for every option of a prefix. They are merged over the built-in option rules: an exact key overrides a built-in option, a shorter prefix never shadows a longer built-in one. An option without a rule is compared as a value and left `unclassified`.

```ts
import { allAnnotation, allBreaking, compareProtoApi } from "api-smart-diff"

compareProtoApi(before, after, {
  optionRules: {
    "/acme.*": { $: allBreaking },
    "/acme.audit": { $: allAnnotation },
  },
})
```
