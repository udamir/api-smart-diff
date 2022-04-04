# api-smart-diff
<img alt="npm" src="https://img.shields.io/npm/v/api-smart-diff"> <img alt="npm" src="https://img.shields.io/npm/dm/api-smart-diff?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/api-smart-diff"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/api-smart-diff">

This package provides utils to compute the diff between two API specifications.

## Purpose
- Generate API changelog
- Identify breaking changes
- Ensure API versioning consistency

## Supported API specifications

- [OpenApi 3.0](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md)
- [AsyncApi 2.1](https://www.asyncapi.com/docs/specifications/v2.1.0)
- [JsonSchema](https://json-schema.org/draft/2020-12/json-schema-core.html)
- ~~[Swagger 2.0](https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md)~~ (Roadmap)
- ~~graphql~~ (Roadmap)
- ~~gRPC~~ (Roadmap)

## Features
- Generate diff for supported specifications
- Generate merged spec with changes in metadata 
- Classify all changes as breaking, non-breaking, annotation
- Supports custom classification rules
- Supports custom match rules for array items and object keys
- Resolves all $ref pointers, including external
- Typescript syntax support out of the box
- No dependencies, can be used in nodejs or browser

## Installation
```SH
npm install api-smart-diff --save
```

## Usage

### Nodejs
```ts
import { apiDiff } from 'api-smart-diff'

const diff = apiDiff(oldSpec, newSpec, { rules: "OpenApi3" })
// {
//   action: "add" | "remove" | "replace",
//   after: 'value in newSpec',
//   before: 'value in oldSpec',
//   path: ['path, 'in', 'array', 'format'],
//   type: "annotation" | "breaking" | "non-breaking" | "unclassified"
// }

const merge = apiMerge(oldSpec, newSpec, { rules: "OpenApi3" })

```

### Browsers

A browser version of `api-smart-diff` is also available via CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@latest/browser/api-smart-diff.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@latest/browser/api-smart-diff.js"></script>
```

Reference `api-smart-diff.min.js` in your HTML and use the global variable `ApiSmartDiff`.
```HTML
<script>
  var diff = ApiSmartDiff.apiDiff(oldSpec, newSpec, { rules: "OpenApi3" })
  var merge = ApiSmartDiff.apiMerge(oldSpec, newSpec, { rules: "OpenApi3" })
</script>
```

## License

MIT
