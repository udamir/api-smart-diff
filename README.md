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
Browser folder contains an Ubundle allowing you to either reference `api-smart-diff.min.js` in your HTML or import module using Require.js.

Reference `api-smart-diff.min.js` in your HTML and use the global variable `ApiSmartDiff`.
```HTML
<script src="node_modules/api-smart-diff/browser/api-smart-diff.min.js"></script>
<script>
  var diff = ApiSmartDiff.syncApiDiff (oldSpec, newSpec, "OpenApi3")
</script>
```

## License

MIT
