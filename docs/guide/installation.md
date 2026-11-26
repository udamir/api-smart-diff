# Installation

## Package

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

The package ships:

| File | Format | Used by |
| --- | --- | --- |
| `dist/index.js` | ES module | `import` (bundlers, Node.js ESM) |
| `dist/index.cjs` | CommonJS | `require` |
| `dist/index.d.ts`, `dist/index.d.cts` | TypeScript declarations | bundled, no `@types` package needed |
| `dist/api-smart-diff.min.js` | IIFE, global `ApiSmartDiff` | `<script>` tags, CDNs (`unpkg`, `jsdelivr`) |

The ES module and CommonJS builds import their two runtime dependencies, `json-crawl` and `allof-merge`, from `node_modules`; the browser build bundles them. The package is marked `sideEffects: false`.

```ts
// ES modules / TypeScript
import { apiCompare } from "api-smart-diff"

// CommonJS
const { apiCompare } = require("api-smart-diff")
```

## Requirements

- **Node.js 18 or later** (tested on 18, 20, 22, 24 and 26). The dependencies declare their own minimum versions (json-crawl: Node.js ≥ 18, allof-merge: Node.js ≥ 22), so npm prints an engine warning on Node.js 18 and 20; the package works there.
- **Browsers**: the code is compiled to ES2020 (optional chaining and `??` are native), so the browser build runs in Chrome 80, Firefox 74, Safari 13.1 or later, or an equivalent engine. Use a transpiler such as Babel for older engines.
- **Input**: parsed documents (plain objects). The library does not read files or parse YAML; use a YAML parser such as `js-yaml` or `yaml`.

## Browser

The self-contained browser build exposes the global `ApiSmartDiff`:

```html
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@2/dist/api-smart-diff.min.js"></script>
<script>
  const { diffs, merged } = ApiSmartDiff.apiCompare(before, after)
</script>
```

`unpkg` works the same way (`https://unpkg.com/api-smart-diff@2/dist/api-smart-diff.min.js`). In an application built with a bundler, import the package instead: the bundler picks the ES module build and tree-shakes it.

## GraphQL

GraphQL schemas are compared in their [GraphApi](https://github.com/udamir/graphapi) encoding, so converting SDL needs `gqlapi` and `graphql` (they are not dependencies of api-smart-diff):

```sh
npm install gqlapi graphql
```

```ts
import { buildSchema } from "graphql"
import { buildFromSchema } from "gqlapi"
import { apiCompare } from "api-smart-diff"

const toGraphApi = (sdl: string) => buildFromSchema(buildSchema(sdl)) // a GraphApi 1.0 document

const { diffs } = apiCompare(toGraphApi(beforeSdl), toGraphApi(afterSdl))
```

## Protocol Buffers

gRPC / Protocol Buffers APIs are compared in their [ProtoApi](https://github.com/udamir/protoapi) encoding, so building documents from `.proto` sources needs `protoapi` (not a dependency of api-smart-diff). Build both sides with the same protoapi version and its default options:

```sh
npm install protoapi
```

```ts
import { buildFromProto } from "protoapi"
import { apiCompare } from "api-smart-diff"

const toProtoApi = (files: Record<string, string>) => buildFromProto(files, { imports: "user" }).document

const { diffs } = apiCompare(toProtoApi(beforeFiles), toProtoApi(afterFiles), { compatibility: "WIRE_JSON" })
```

See [Protocol Buffers](./protoapi) for the build issues to check, the compatibility levels and the source locations of diffs.

## External references

Documents with external `$ref`s (to other files or URLs) are resolved from the `externalSources` option only — nothing is fetched. Either pass the referenced documents (see [Options](./options#externalsources)) or bundle the document into one file first, for example with [api-ref-bundler](https://github.com/udamir/api-ref-bundler).
