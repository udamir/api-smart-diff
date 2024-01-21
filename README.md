# api-smart-diff
<img alt="npm" src="https://img.shields.io/npm/v/api-smart-diff"> <img alt="npm" src="https://img.shields.io/npm/dm/api-smart-diff?label=npm"> <img alt="npm type definitions" src="https://img.shields.io/npm/types/api-smart-diff"> <img alt="GitHub" src="https://img.shields.io/github/license/udamir/api-smart-diff">

This package provides utils to compute the diff between two Json based API documents - [online demo](https://udamir.github.io/api-smart-diff/)

## Purpose
- Generate API changelog
- Identify breaking changes
- Ensure API versioning consistency

## Supported API specifications (work on progress)

- [OpenApi 3.0](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md)
- [AsyncApi 2.x](https://v2.asyncapi.com/docs/reference)
- [JsonSchema](https://json-schema.org/draft/2020-12/json-schema-core.html)
- GraphQL via [GraphApi](https://github.com/udamir/graphapi)
- ~~[Swagger 2.0](https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md)~~
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
- Can be used in nodejs or browser

## Installation
```SH
npm install api-smart-diff --save
```
or
```SH
yarn add api-smart-diff
```

## Usage

### Nodejs
```ts
import { apiCompare } from 'api-smart-diff'

const { diffs, merged } = apiCompare(before, after)
// diff: 
// {
//   action: "add" | "remove" | "replace" | "rename",
//   after: 'value in after',
//   before: 'value in before',
//   description: 'human-readable description'
//   path: ['path, 'in', 'array', 'format'],
//   type: "annotation" | "breaking" | "non-breaking" | "unclassified" | "deprecated"
// } 

// merged meta:
// {
//   action: "add" | "remove" | "replace" | "rename",
//   type: "annotation" | "breaking" | "non-breaking" | "unclassified" | "deprecated",
//   replaced: "value in before",
// }

```

### Browsers

A browser version of `api-smart-diff` is also available via CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/api-smart-diff@latest/dist/api-smart-diff.min.js"></script>
```

Reference `api-smart-diff.min.js` in your HTML and use the global variable `ApiSmartDiff`.
```HTML
<script>
  var { diffs, merged } = ApiSmartDiff.apiCompare(before, after)
</script>
```

## Documentation

Package provides the following public functions:

`apiCompare (before, after, options?: CompareOptions): { diffs: Diff[], merged: object }`
> Calculates the difference and merge two objects and classify difference in accordinance with before document type


### **apiCompare(before, after, options)**
The apiDiff function calculates the difference between two objects.

#### *Arguments*
- `before: any` - the origin object
- `after: any` - the object being compared structurally with the origin object\
- `options: CompareOptions` [optional] - comparison options

```ts
export type ComapreOptions = {
  rules?: CompareRules              // custom rules for compare

  metaKey?: string | symbol         // metakey for merge changes
  arrayMeta?: boolean               // add changes to arrays via metakey
  annotateHook?: AnnotateHook       // custom format hook

  externalSources?: {               // resolved external $ref sources
    before?: Record<string, object>
    after?: Record<string, object>
  }
}
```
#### *Result*
Function returns object with `diffs` array and `merged` object with metadata
```ts
type Diff = {
  action: "add" | "remove" | "replace" | "rename"
  path: Array<string | number>
  description?: string 
  before?: any
  after?: any
  type: "breaking" | "non-breaking" | "annotation" | "unclassified" | "deprecated"
}

type MergeMeta = DiffMeta | MergeArrayMeta
type MergeArrayMeta = { array: Record<number, MergeMeta> }

export type DiffMeta = {
  action: "add" | "remove" | "replace" | "rename"
  type: "breaking" | "non-breaking" | "annotation" | "unclassified" | "deprecated"
  replaced?: any
}
```

#### *Example*
```ts
const metaKey = Symbol("diff")
const { diffs, merged } = apiCompare(before, after, { metaKey })

// do something with diffs or merged object
```

### **Custom rules**
Custom compare rules can be defined as CrawlRules:
```ts
import { CrawlRules } from "json-crawl"

type CompareRules = CrawlRules<CompareRule>

type CompareRule = {
  $?: ClassifyRule                            // classifier for current node
  compare?: CompareResolver                   // compare handler for current node
  transform?: CompareTransformResolver[]      // transformations before compare/merge
  mapping?: MappingResolver<string | number>  // keys mapping rules
  annotate?: ChangeAnnotationResolver         // resolver for annotation template
}

// Change classifier
type ClassifyRule = [ 
  DiffType | (ctx: ComapreContext) => DiffType, // add
  DiffType | (ctx: ComapreContext) => DiffType, // remove
  DiffType | (ctx: ComapreContext) => DiffType  // replace (rename)
]

// Compare context
type ComapreContext = {
  before: NodeContext       // before node context
  after: NodeContext        // after node context
  rules: CompareRules       // rules for compared nodes
  options: ComapreOptions   // compare options
}

// Node context
type NodeContext =  {
  path: JsonPath
  key: string | number
  value: unknown
  parent?: unknown
  root: unknown
}

// Custom compare resolver
type CompareResolver = (ctx: ComapreContext) => CompareResult | void

// Transformation rules
type CompareTransformResolver<T = unknown> = (before: T, after: T) => [T, T]

// Mapping rules
type MappingResolver = (
  before: Record<string, unknown> | unknown[],
  after: Record<string, unknown> | unknown[], 
  ctx: ComapreContext
) => MapKeysResult

type MapKeysResult<T extends string | number> = {
  added: Array<T>
  removed: Array<T>
  mapped: Record<T, T>
}

// Annotation tempalte resolver
type ChangeAnnotationResolver = (diff: Diff, ctx: ComapreContext) => AnnotateTemplate | undefined

type AnnotateTemplate = {
  template: string,
  params?: { [key: string]: AnnotateTemplate | string | number | undefined }
}

```

Please check predefined rules in `/src/rules` folder to get examples

## Contributing
When contributing, keep in mind that it is an objective of `api-smart-diff` to have no additional package dependencies. This may change in the future, but for now, no new dependencies.

Please run the unit tests before submitting your PR: `yarn test`. Hopefully your PR includes additional unit tests to illustrate your change/modification!

## License

MIT
