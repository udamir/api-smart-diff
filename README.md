# api-smart-diff
<img alt="npm" src="https://img.shields.io/npm/v/api-smart-diff"> <img alt="npm" src="https://img.shields.io/npm/dm/api-smart-diff?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/api-smart-diff"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/api-smart-diff">

This package provides utils to compute the diff between two API specifications - [online demo](https://udamir.github.io/api-smart-diff/)

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
- Resolves all $ref pointers, including external and circular
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

const diffs = apiDiff(oldSpec, newSpec, { rules: "OpenApi3" })
// {
//   action: "add" | "remove" | "replace" | "rename",
//   after: 'value in newSpec',
//   before: 'value in oldSpec',
//   path: ['path, 'in', 'array', 'format'],
//   type: "annotation" | "breaking" | "non-breaking" | "unclassified"
// }

const merged = apiMerge(oldSpec, newSpec, { rules: "OpenApi3" })

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
  var diffs = ApiSmartDiff.apiDiff(oldSpec, newSpec, { rules: "OpenApi3" })
  var merged = ApiSmartDiff.apiMerge(oldSpec, newSpec, { rules: "OpenApi3" })
</script>
```

## Documentation

Package provides the following public functions:

`apiDiff (before, after, options?: CompareOptions): Array<Diff>`
> Calculates the difference list between two objects and classify difference in accordinance with specified rules: OpenApi3, AsyncApi2, JsonSchema.

`apiDiffTree (before, after, options?: CompareOptions): object`
> Calculates the difference tree between two objects and classify difference in accordinance with specified rules: OpenApi3, AsyncApi2, JsonSchema.

`apiMerge (before, after, options?: MergeOptions): object`
> Merge two objects and inject difference as meta data. 

### **apiDiff(before, after, options)**
The apiDiff function calculates the difference between two objects.
- `before: any` - the origin object
- `after: any` - the object being compared structurally with the origin object\
- `options: CompareOptions` [optional] - comparison options

```ts
type CompareOptions = {
  rules?: Rules | "OpenApi3" | "AsyncApi2" | "JsonSchema" 
  trimStrings?: boolean
  caseSensitive?: boolean
  strictArrays?: boolean
  externalRefs?: { [key: string]: any }
}
```
#### *Arguments*
- `rules` - match and classification rules, custom or predefined.
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
  before?: any
  after?: any
  type: "breaking" | "non-breaking" | "annotation" | "unclassified"
}
```

#### *Example*
```ts
const diffs = apiDiff(before, after, { rules: "OpenApi3" })
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
  before?: any
  after?: any
  type: "breaking" | "non-breaking" | "annotation" | "unclassified"
}
```

#### *Example*
```ts
const diff = apiDiffTree(before, after, { rules: "OpenApi3" })
// do something with the changes object
```

### **apiMerge(before, after, options)**
The apiDiff function calculates the difference between two objects.
- `before: any` - the origin object
- `after: any` - the object being compared structurally with the origin object\
- `options: MergeOptions` [optional] - comparison options

```ts
type MergeOptions<T> = CompareOptions & {
  arrayMeta?: boolean
  formatMergedMeta?: (diff: T) => any
  metaKey?: string | symbol
}
```
#### *Arguments*
Additional to compare options:
- `arrayMeta` - inject meta to arrays for items changes, default `false`
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
const merged = apiMerge(before, after, { rules: "OpenApi3", apiKey })

// do something with merged object
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
  up: (n?: number) => IChageContext // get parent Change Context
  root: () => IChageContext // get root Change context
}

```

Please check predefined rules in `/src/rules` folder to get examples

## Contributing
When contributing, keep in mind that it is an objective of `api-smart-diff` to have no package dependencies. This may change in the future, but for now, no-dependencies.

Please run the unit tests before submitting your PR: `npm test`. Hopefully your PR includes additional unit tests to illustrate your change/modification!

## License

MIT
