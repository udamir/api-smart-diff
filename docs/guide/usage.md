# Usage

## The entry point

```ts
apiCompare(before: unknown, after: unknown, options?: CompareOptions): CompareResult
```

`apiCompare` detects the specification of both documents, compares them with the matching engine and returns `{ diffs, merged, rootMergeMeta?, errors? }`. The documents are never modified. Every option is described in [Options](./options), every field of the result in [Result](./result).

```ts
import { apiCompare } from "api-smart-diff"

const { diffs, merged } = apiCompare(before, after)
```

To skip the detection, call an engine directly — `compareOpenApi`, `compareAsyncApi`, `compareJsonSchema`, `compareGraphApi` or `compareProtoApi` — or force one with `options.engine`; see [Specifications and engines](./engines).

## Reading YAML

The library takes parsed documents. JSON is `JSON.parse`; YAML needs a parser:

```ts
import { readFileSync } from "node:fs"
import { load } from "js-yaml"
import { apiCompare } from "api-smart-diff"

const read = (file: string) => load(readFileSync(file, "utf8"))

const { diffs } = apiCompare(read("api/v1.yaml"), read("api/v2.yaml"))
```

## Recipes

### A release gate

Fail on breaking changes (and on errors, which mean that part of the documents could not be compared), warn on risky ones.

```ts
import { apiCompare } from "api-smart-diff"

const { diffs, errors = [] } = apiCompare(before, after)
const breaking = diffs.filter((diff) => diff.type === "breaking")
const risky = diffs.filter((diff) => diff.type === "risky")

for (const error of errors) console.error(`[${error.kind}] ${error.message} at /${error.path.join("/")}`)
for (const diff of breaking) console.error(`BREAKING ${diff.description}`)
for (const diff of risky) console.warn(`RISKY    ${diff.description}`)

process.exitCode = errors.length || breaking.length ? 1 : 0
```

### A changelog grouped by class

```ts
import { apiCompare, type DiffType } from "api-smart-diff"

const titles: Record<DiffType, string> = {
  breaking: "Breaking changes",
  risky: "Changes to review",
  "non-breaking": "New features",
  deprecated: "Deprecations",
  annotation: "Documentation",
  unclassified: "Other changes",
}

const { diffs } = apiCompare(before, after)
const sections = Object.entries(titles)
  .map(([type, title]) => {
    const lines = diffs.filter((diff) => diff.type === type).map((diff) => `- ${diff.description}`)
    return lines.length ? `## ${title}\n\n${lines.join("\n")}` : ""
  })
  .filter(Boolean)

console.log(sections.join("\n\n"))
```

`DiffType` has six values in 2.0.0; a `Record<DiffType, …>` like the one above makes TypeScript report a missing `risky` entry.

### Changes of one operation, or of one direction

`diff.path` is the path in the before document (the after path for added nodes), so filtering by a path prefix selects a part of the API; `diff.scope` selects a direction.

```ts
const pointer = (path: (string | number)[]) => "/" + path.map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")

const petsApi = diffs.filter((diff) => pointer(diff.path).startsWith("/paths/~1pets"))
const responseChanges = diffs.filter((diff) => diff.scope === "response")
```

A change inside a reusable component is reported at its declaration (`components/...`) and again at every usage location reachable from an operation or a channel — see [Components and $ref](./components). To avoid counting a change twice, keep either the declarations or the usages:

```ts
const atUsages = diffs.filter((diff) => diff.path[0] !== "components")
```

### Highlighting a document

The merged document is the after document with change metadata under `$diff` (or your own `metaKey`). A `Symbol` key keeps the metadata out of `JSON.stringify` and of key iteration:

```ts
const metaKey = Symbol("diff")
const { merged } = apiCompare(before, after, { metaKey })

// meta of the children of a node, keyed by child key
const changesOfInfo = merged.info[metaKey] // e.g. { version: { action: "replace", type: "annotation", replaced: "1.0.0" } }
```

See [Result § Merged document](./result#merged-document) for the layout, arrays included.

### Collecting errors

Problems inside the comparison (a `$ref` that cannot be resolved, a custom classifier that throws, …) never throw and are never printed: they are returned in `result.errors`, or passed to `options.onError` when you set it.

```ts
const { diffs } = apiCompare(before, after, {
  onError: (error) => logger.warn(`${error.kind}: ${error.message}`, { path: error.path }),
})
```

Only documents of an unsupported specification throw, with `UnsupportedSpecError` — see [Specifications and engines](./engines#unsupported-documents).

## In the browser

```html
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@2/dist/api-smart-diff.min.js"></script>
<script>
  const { diffs } = ApiSmartDiff.apiCompare(before, after)
  document.body.textContent = diffs.map((diff) => `${diff.type}: ${diff.description}`).join("\n")
</script>
```

Every export of the package is available on the `ApiSmartDiff` global. The [online demo](/demo) is built on the same API.
