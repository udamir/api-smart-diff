# api-smart-diff

This package provides utils to compute the diff between two API specifications.

## Purpose
- Identify breaking and non-breaking changes.
- Ensure API versioning consistency.
- Generate API changelog.

## Compatilibity

- OpenApi 3.0
- AsyncApi 2.1
- JsonSchema
- ~~[Swagger 2.0](https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md)~~ (Roadmap)
- ~~graphql~~ (Roadmap)
- ~~gRPC~~ (Roadmap)

## Installation
```SH
npm install api-smart-diff
```

## Usage

### Nodejs
```ts
import { syncApiDiff } from 'api-smart-diff'

const diff = syncApiDiff(oldSpec, newSpec, "OpenApi3")
// {
//   action: "add" | "remove" | "replace",
//   after: 'value after',
//   before: 'value before',
//   path: ['path, 'in', 'array'],
//   type: "annotation" | "breaking" | "non-breaking" | "unclassified"
// }
```

### Browsers

A browser version of `api-smart-diff` is also available via SDN:
```html
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@latest/browser/api-smart-diff.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@latest/browser/api-smart-diff.js"></script>
```

Reference `api-smart-diff.min.js` in your HTML and use the global variable `ApiSmartDiff`.
```HTML
<script>
  var diff = ApiSmartDiff.syncApiDiff (oldSpec, newSpec, "OpenApi3")
</script>
```

## License

MIT
