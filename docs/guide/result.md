# Result

```ts
type CompareResult = {
  diffs: Diff[]
  merged: any
  rootMergeMeta?: MergeMeta    // meta of the document itself, when the whole document was replaced
  errors?: CompareError[]      // present only when onError is not set and an error occurred
}
```

## Diffs

```ts
type Diff = {
  action: "add" | "remove" | "replace" | "rename"
  path: Array<string | number>  // path of the change in the before document (the after path for added nodes)
  before?: any                  // the before value (removed and replaced nodes; the old key of a rename)
  after?: any                   // the after value (added and replaced nodes; the new key of a rename)
  type: DiffType                // "breaking" | "risky" | "non-breaking" | "deprecated" | "annotation" | "unclassified"
  scope: CompareScope           // the scope the node was compared in: "request", "response", "components", ...
  origin?: { before: JsonPath; after: JsonPath } // declaration paths, only when they differ from `path`
  description?: string          // human-readable description (always set by the built-in engines)
}
```

- **`action`** — `add` and `remove` for keys or items that exist on one side only, `replace` for a changed value (including a changed type of node, an object replaced by a string for example), `rename` for a renamed path, component, security scheme, channel or message (one diff at the map; `before` and `after` are the old and the new key, see [Renames](./renames)).
- **`path`** — always a path in the **before** document, except for added nodes, which only exist in the after document. Keys are matched before they are compared, so a renamed path template or a reordered parameter list still produces diffs at the right place; the item of a reordered array is identified by its before index (and a change inside a reordered `oneOf` / `anyOf` branch by the branch's after index).
- **`type`** — the [classification](./classification).
- **`scope`** — where the node was classified; see [Direction and scopes](./scopes).
- **`origin`** — a change inside a `$ref` target is reported at the usage location (`path`) with `origin` pointing at the declaration it comes from. See [Components and $ref](./components).
- **`description`** — see [Descriptions](./descriptions).

`diffs` lists removals and renames of a node's children first, then the changes inside the children, then additions, in document order.

## Merged document

`merged` is one document that holds both versions: the after document, plus the nodes that were removed, with change metadata next to every changed node.

- Values are the **original input values**: the after-side value for mapped and added nodes, the before-side value for removed nodes. They are deep-copied, so `merged` never aliases an input, and an unchanged document comes back unchanged.
- A removed object key stays in place (after the after keys); a removed array item is appended after the last after item. Arrays follow the **after** order.
- An unchanged `$ref` stays a `$ref`. A `$ref` whose target changed is inlined at the usage, because the metadata needs the resolved subtree.
- `options.merged: "normalized"` returns the values the engine compared instead (path-level parameters moved into operations, explicit defaults, `examples`, `enum`, merged `allOf`, …).

### Metadata

The metadata of a node's children is stored on the node, under `options.metaKey` (`"$diff"` by default), keyed by child key:

```ts
type DiffMeta = {
  action: "add" | "remove" | "replace" | "rename"
  type: DiffType
  replaced?: any // the before value of a replaced node
}
```

For array items the meta is keyed by the item's position in the merged array and wrapped in `{ array: … }`, so that it stays JSON-serializable. With `options.arrayMeta: true` it is stored on the array itself instead (`array[metaKey]`).

For example, a required response property `createdAt` removed (from the [direction example](/examples/#property-removed-from-a-request-and-from-a-response)) gives:

```json
{
  "type": "object",
  "required": ["id", "createdAt"],
  "properties": {
    "id": { "type": "string" },
    "createdAt": { "type": "string" },
    "$diff": {
      "createdAt": { "action": "remove", "type": "breaking" }
    }
  },
  "$diff": {
    "required": {
      "array": {
        "1": { "action": "remove", "type": "breaking" }
      }
    }
  }
}
```

A replaced value keeps its old value in `replaced`:

```json
{ "info": { "title": "Pet store", "version": "1.1.0", "$diff": { "version": { "action": "replace", "type": "annotation", "replaced": "1.0.0" } } } }
```

When the documents themselves differ in kind (a string compared with a number, for example), there is no parent to carry the meta; it is returned as `rootMergeMeta`.

### Symbol keys

A `Symbol` as `metaKey` keeps the metadata out of `JSON.stringify`, `Object.keys` and object spreads, so the merged document can be rendered or serialized as the plain after document:

```ts
const metaKey = Symbol("diff")
const { merged } = apiCompare(before, after, { metaKey })

const metaOf = (node: any, key: string | number) => node?.[metaKey]?.[key]
```

## Errors

```ts
type CompareError = {
  kind: "classify" | "annotate" | "ref" | "transform" | "mapping" | "compare"
  message: string
  path: JsonPath
  scope: CompareScope
  error?: unknown
}
```

Errors are problems inside the comparison: a `$ref` that cannot be resolved (`kind: "ref"`, the node is then compared as an opaque value), a classifier, description, transform or mapping function that threw. The comparison always completes, nothing is printed, and the errors are collected in `result.errors` — or passed to `options.onError` when it is set, in which case `result.errors` is absent. A diff whose classifier failed is `unclassified`.

Documents of an unsupported specification are the only case that throws, with `UnsupportedSpecError` (see [Specifications and engines](./engines#unsupported-documents)).
