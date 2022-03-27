# api-smart-diff

This package provides utils to compute the diff between two API specifications.

## Purpose
- Generate API changelog
- Classify all changes: breaking, non-breaking or annotation
- Ensure API versioning consistency

## Compatilibity

- OpenApi 3.0
- AsyncApi 2.1
- JsonSchema
- ~~[Swagger 2.0](https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md)~~ (Roadmap)
- ~~graphql~~ (Roadmap)
- ~~gRPC~~ (Roadmap)

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
  var diff = ApiSmartDiff.apiDiff(oldSpec, newSpec, { rules: "OpenApi3" })
</script>
```

## License

MIT
