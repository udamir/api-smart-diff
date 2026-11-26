# Getting started

## Install

::: code-group

```sh [npm]
npm install api-smart-diff
```

```sh [pnpm]
pnpm add api-smart-diff
```

```sh [yarn]
yarn add api-smart-diff
```

:::

Node.js 18 or later is required; see [Installation](./installation) for the browser build and the requirements.

## Compare two documents

`apiCompare` takes two parsed documents (plain objects — parse YAML with a YAML library first), detects their specification and returns the diffs and the merged document.

```ts
import { apiCompare } from "api-smart-diff"
import { load } from "js-yaml"
import { readFileSync } from "node:fs"

const before = load(readFileSync("openapi-v1.yaml", "utf8"))
const after = load(readFileSync("openapi-v2.yaml", "utf8"))

const { diffs, merged, errors } = apiCompare(before, after)
```

With these two documents:

::: code-group

```yaml [before]
openapi: 3.1.0
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        "200":
          description: A list of pets
```

```yaml [after]
openapi: 3.1.0
info:
  title: Pet store
  version: 1.0.0
paths:
  /pets:
    get:
      parameters:
        - name: owner
          in: query
          required: true
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: A list of pets
```

:::

`diffs` holds two records:

```ts
[
  {
    action: "add",
    path: ["paths", "/pets", "get", "parameters", 0],
    after: { name: "owner", in: "query", required: true, schema: { type: "string" } },
    type: "breaking",
    scope: "request",
    description: "[Added] query parameter `owner`",
  },
  {
    action: "add",
    path: ["paths", "/pets", "get", "parameters", 1],
    after: { name: "limit", in: "query", schema: { type: "integer" } },
    type: "non-breaking",
    scope: "request",
    description: "[Added] query parameter `limit`",
  },
]
```

The new required parameter breaks clients that do not send it; the optional one does not. Try it live in the [examples](/examples/#required-query-parameter-added).

## Gate a release

```ts
import { apiCompare, type DiffType } from "api-smart-diff"

const { diffs, errors } = apiCompare(before, after)
const count = (type: DiffType) => diffs.filter((diff) => diff.type === type).length

if (errors?.length || count("breaking")) {
  console.error(diffs.filter((diff) => diff.type === "breaking").map((diff) => diff.description))
  process.exit(1)
}
if (count("risky")) {
  console.warn(diffs.filter((diff) => diff.type === "risky").map((diff) => diff.description))
}
```

## Next steps

- [Usage](./usage) — Node.js and browser, YAML input, choosing an engine, common recipes.
- [Diff types](./classification) and [Direction and scopes](./scopes) — what the classes mean.
- [Result](./result) — every field of `diffs`, `merged` and `errors`.
- [Online demo](/demo) — try your own documents.
