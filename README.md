# api-smart-diff
<img alt="npm" src="https://img.shields.io/npm/v/api-smart-diff"> <img alt="npm" src="https://img.shields.io/npm/dm/api-smart-diff?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/api-smart-diff"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/api-smart-diff">

This package provides utils to compute the diff between two Json based API documents - [online demo](https://udamir.github.io/api-smart-diff/)

## Purpose
- Generate API changelog
- Identify breaking changes
- Ensure API versioning consistency

## Supported API specifications (work on progress)

- [OpenApi 3.0](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md)
  - [x] Rules
  - [x] Transformations
  - [x] Annotations
  - [x] Unit Tests
  - [x] E2E Tests
- [AsyncApi 2.x](https://v2.asyncapi.com/docs/reference)
  - [ ] Rules
  - [ ] Transformations
  - [ ] Annotations
  - [ ] Unit Tests
  - [ ] E2E Tests
- [JsonSchema](https://json-schema.org/draft/2020-12/json-schema-core.html)
  - [x] Rules
  - [x] Transformations
  - [x] Annotations
  - [x] Unit Tests
  - [x] E2E Tests
- [Swagger 2.0](https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md)
  - [ ] Rules
  - [ ] Transformations
  - [ ] Annotations
  - [ ] Unit Tests
  - [ ] E2E Tests
- GraphQL via [GraphApi](https://github.com/udamir/graphapi)
  - [x] Rules
  - [x] Transformations
  - [ ] Annotations
  - [ ] Unit Tests
  - [ ] E2E Tests
- ~~[AsyncApi 3.x](https://www.asyncapi.com/docs/specifications/)~~ (Roadmap)
- ~~gRPC~~ (Roadmap)

## Features
- Generate diff for supported specifications
- Generate merged document with changes in metadata 
- Classify all changes as breaking, non-breaking, deprecated and annotation
- Human-readable change description
- Supports custom classification rules
- Supports custom comparison or match rules
- Supports custom transformations
- Supports custom human-readable changes annotation
- Resolves all $ref pointers, including circular
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

const diffs = apiDiff(oldSpec, newSpec)
// {
//   action: "add" | "remove" | "replace" | "rename",
//   after: 'value in newSpec',
//   before: 'value in oldSpec',
//   description: 'human-readable description'
//   path: ['path, 'in', 'array', 'format'],
//   type: "annotation" | "breaking" | "non-breaking" | "unclassified" | "deprecated"
// }

const merged = apiMerge(oldSpec, newSpec)

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
  var diffs = ApiSmartDiff.apiDiff(oldSpec, newSpec)
  var merged = ApiSmartDiff.apiMerge(oldSpec, newSpec)
</script>
```

## Documentation

Package provides the following public functions:

`apiDiff (before, after, options?: CompareOptions): Array<Diff>`
> Calculates the difference list between two objects and classify difference in accordinance with before document type: OpenApi3, AsyncApi2, JsonSchema.

`apiDiffTree (before, after, options?: CompareOptions): object`
> Calculates the difference tree between two objects and classify difference in accordinance with before document type: OpenApi3, AsyncApi2, JsonSchema.

`apiMerge (before, after, options?: MergeOptions): object`
> Merge two objects and inject difference as meta data. 

### **apiDiff(before, after, options)**
The apiDiff function calculates the difference between two objects.
- `before: any` - the origin object
- `after: any` - the object being compared structurally with the origin object\
- `options: CompareOptions` [optional] - comparison options

```ts
type CompareOptions = {
  rules?: Rules
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  externalRefs?: { [key: string]: any }
}
```
#### *Arguments*
- `rules` - custom match and classification rules
- `trimString` - ignore spaces in matching, default `false`
- `caseSensitive` - ignore case in matching, default `false`
- `strictArrays` - use strict match algorithm for array items, default `false`
- `externalRefs` - object with external refs


#### *Result*
Function returns array of differences:
```ts
type Diff = {
  action: "add" | "remove" | "replace" | "rename"
  path: Array<string | number>
  description?: string 
  before?: any
  after?: any
  type: "breaking" | "non-breaking" | "annotation" | "unclassified" | "deprecated"
}
```

#### *Example*
```ts
const diffs = apiDiff(before, after)
if (diffs.length) {
  // do something with the changes
}
```

### **apiDiffTree(before, after, options)**
The apiDiff function calculates the difference between two objects.
- `before: any` - the origin object
- `after: any` - the object being compared structurally with the origin object\
- `options: CompareOptions` [optional] - comparison options

#### *Result*
Function returns object with `$diff` key for all differences:
```ts
type Diff = {
  action: "add" | "remove" | "replace" | "rename"
  description?: string
  before?: any
  after?: any
  type: "breaking" | "non-breaking" | "annotation" | "unclassified" | "deprecated"
}
```

#### *Example*
```ts
const diff = apiDiffTree(before, after)
// do something with the changes object
```

### **apiMerge(before, after, options)**
The apiDiff function calculates the difference between two objects.
- `before: any` - the origin object
- `after: any` - the object being compared structurally with the origin object\
- `options: MergeOptions` [optional] - comparison options

```ts
type MergeOptions<T> = CompareOptions & {
  resolveUnchangedRefs?: boolean
  arrayMeta?: boolean
  formatMergedMeta?: (diff: T) => any
  metaKey?: string | symbol
}
```
#### *Arguments*
Additional to compare options:
- `arrayMeta` - inject meta to arrays for items changes, default `false`
- `resolveUnchangedRefs` - resolve refs even if no changes, default `false`
- `metaKey` - key for diff metadata, default `$diff`
- `formatMergedMeta` - custom formatting function for meta

#### *Result*
Function returns merged object with metadata. Metadata includes merged keys and differences:
```ts
type MergedMeta = {
  [key: string]: MergedKeyMeta | MergedArrayMeta
}

type MergedKeyMeta = {
  type: DiffType
  action: ActionType
  replaced?: any
}

type MergedArrayMeta = {
  array: { [key: number]: MergedArrayMeta }
}
```

#### *Example*
```ts
const apiKey = Symbol("diff")
const merged = apiMerge(before, after, { apiKey })

// do something with merged object
```

### Human-readable change description example

```ts
import { apiDiff, changeDoc, changeDocOpenApiRules } from "api-smart-diff"

const diff = apiDiff(before, after, { 
  formatMergedMeta: (diff) => ({ ...diff, description: changeDoc(diff, before, after, changeDocOpenApiRules) })
})
```

### **Custom rules**
Custom match and classification rules can be defined as object:
```ts
type Rules = {
  // root property (or array item) rule
  "/"?: Rule

  // rule for all unspecified properties (or nested array items)
  "/*"?: Rule | Rules | (before) => Rules

  // rule for specified properties
  [key: `/${string}`]?: Rule | Rules | (before) => Rules

  // custom match function for object (or array)
  "#"?: (before, after) => boolean
}

// Change classifier
type Rule = [ 
  DiffType | (ctx: IChangeContext) => DiffType, // add
  DiffType | (ctx: IChangeContext) => DiffType, // remove
  DiffType | (ctx: IChangeContext) => DiffType  // replace (rename)
]

// Current path Change context
interface IChageContext {
  before: any // before value
  after: any // after value
  root: IChageContext // get root Change context
  up: (n?: number) => IChageContext // get parent Change Context
}

```

Please check predefined rules in `/src/rules` folder to get examples

## Contributing
When contributing, keep in mind that it is an objective of `api-smart-diff` to have no package dependencies. This may change in the future, but for now, no-dependencies.

Please run the unit tests before submitting your PR: `npm test`. Hopefully your PR includes additional unit tests to illustrate your change/modification!

## License

MIT
