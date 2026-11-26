# Custom rules

Specification support in api-smart-diff is a **rule tree**: for every node of a document, a rule says how it is compared, how its keys are matched, how a change is classified and how it is described. The built-in engines are thin wrappers that pick a rule tree and an annotate hook and call the generic `compare`. You can change the built-in trees, give `x-*` extensions real semantics (see [Specification extensions](./extensions)), or compare documents of your own format.

## The rule tree

Rules are a [json-crawl](https://github.com/udamir/json-crawl) `CrawlRules<CompareRule>` tree, keyed by path segments:

```ts
const rules: CompareRules = {
  $: allAnnotation,            // the rule of the current node
  "/info": {                   // the child "info"
    "/version": { $: allBreaking },
  },
  "/paths": {
    "/*": {                    // every child of "paths"
      "/**": { $: allNonBreaking }, // every descendant
    },
  },
  "/x-*": { $: allAnnotation }, // a prefix rule: every key starting with "x-"
}
```

Resolution of a child's rule follows json-crawl 1.x: exact key `/name` > the longest matching prefix rule `/<prefix>*` > `/*` > `/**`, merged with the higher-priority fields winning, and `/**` applies to every descendant. A key is a prefix rule when it ends with `*` after a non-empty prefix (`"/x-*"`); only the trailing `*` is special, and prefix rules match string keys only (array indexes never match). Any node may also be a function `({ key, path, value }) => CompareRules`, for lazy or recursive rules (JSON Schema is recursive).

## CompareRule

```ts
type CompareRule = {
  $?: ClassifyRule                        // classifier of the node
  compare?: CompareResolver               // custom comparison of the node (returns a CompareResult)
  transform?: CompareTransformResolver[]  // normalization before the comparison (never written into the inputs)
  mapping?: MappingResolver               // how the keys / items of the two sides are matched
  annotate?: ChangeAnnotationResolver     // description template of a change of the node
  scope?: CompareScope | ScopeResolver    // open a scope for the node and its subtree
  kind?: string                           // what the node is ("schema", "parameter", ...), used by descriptions
  skip?: boolean                          // do not compare: the before value is the merge result
}
```

The built-in rule sets use a few more fields (`inheritUsage`, `unreferencedScopes`, `referenceRenames`, `impliedReferences`) for usage tracking and rename detection; see the type declarations.

### Classifiers

`$` is a `ClassifyRule`, in one of three forms:

```ts
// 3-tuple, read in request semantics; inverted (breaking <-> non-breaking) in response, output, subscribe and send
type ClassifyTuple = [add, remove, replace]

// 6-tuple: explicit slots for the inverted scopes
type ClassifyTuple6 = [add, remove, replace, reversedAdd, reversedRemove, reversedReplace]

// object form: one tuple per scope, `default` for every other scope (never inverted)
type ScopedClassifyRule = { [scope: string]: ClassifyTuple; default?: ClassifyTuple }
```

Each slot is a `DiffType` or a function `(ctx: CompareContext) => DiffType`. A rename uses the replace slot. Shorthands:

| Shorthand | Tuple |
| --- | --- |
| `allBreaking` | `[breaking, breaking, breaking]` |
| `allNonBreaking` | `[nonBreaking, nonBreaking, nonBreaking]` |
| `addNonBreaking` | `[nonBreaking, breaking, breaking]` |
| `onlyAddBreaking` | `[breaking, nonBreaking, nonBreaking]` |
| `allRisky` | `[risky, risky, risky]` |
| `allDeprecated` | `[deprecated, deprecated, deprecated]` |
| `allAnnotation` | `[annotation, annotation, annotation]` |
| `allUnclassified` | `[unclassified, unclassified, unclassified]` |

`nonDirectional(tuple)` builds `{ default: tuple }` for rules that mean the same in every scope.

A function slot reads the compare context — both sides, their parents, the scope:

```ts
import { breaking, nonBreaking, type ClassifyRule } from "api-smart-diff"

// a lower timeout breaks clients, a higher one does not
const timeout: ClassifyRule = [
  nonBreaking,
  breaking,
  (ctx) => ((ctx.after.value as number) >= (ctx.before.value as number) ? nonBreaking : breaking),
]
```

### The compare context

```ts
type CompareContext = {
  before: NodeContext
  after: NodeContext
  rules: CompareRules     // the rules of the node
  options: CompareOptions
  scope: CompareScope     // the current scope
  session: object         // per-call state of the engine: $ref resolution, caches, errors
}

type NodeContext = {
  path: JsonPath
  key: string | number
  value: unknown          // the (transformed) value being compared
  parent?: unknown
  root: unknown
  up?: NodeContext        // the parent node context (also across $ref targets)
  source?: unknown        // the original input value of the node
  origin?: JsonPath       // declaration path inside a $ref target
  kind?: string
}
```

`up` links a node context to the context of its parent, also across `$ref` targets: from the property node `properties/name`, `ctx.after.up` is the `properties` node and `ctx.after.up?.up` the schema, so `(ctx.after.up?.up?.value as any)?.required` is the `required` list of the schema.

### Resolvers

```ts
// a complete comparison of the node (for $ref, combinators, opaque values); return undefined to fall back
type CompareResolver = (ctx: CompareContext) => CompareResult | undefined

// normalization: returns the values to compare (the context is an optional third argument)
type CompareTransformResolver<T = unknown> = (before: T, after: T, ctx?: CompareContext) => [T, T]

// key matching: before key -> after key
type MappingResolver = (before, after, ctx: CompareContext) => { added: Key[]; removed: Key[]; mapped: Record<Key, Key> }
```

The exported mapping resolvers are `objectMappingResolver` and `arrayMappingResolver` (the defaults), `caseInsensitiveKeyMappingResolver`, `createKeyMappingResolver(normalize)` (keys matched by a normalized form) and `enumMappingResolver` (array items as a set of values). The mapping resolvers of the built-in rule sets (OpenAPI path templates, parameters, response codes, media types, …) are part of those rule sets: spread a built-in node to keep its resolver.

### Descriptions

`annotate` returns an `AnnotateTemplate` — a template name from the engine's dictionary and its parameters — or `undefined`. Writing templates for the built-in dictionaries is advanced; for most needs a custom [`annotateHook`](./descriptions#custom-descriptions) is simpler. Without a matching template the engine generates a description from the action, the key, the location and the values.

## Changing a built-in rule tree

The rule tree builders are exported: `openapi3Rules({ version, notMergeAllOf, extensions })` (`version` is `"3.0"`, `"3.1"` or `"3.2"`), `asyncApi2Rules`, `asyncApi3Rules`, `jsonSchemaRules({ version, notMergeAllOf })`, `graphApiRules`, `protoApiRules({ compatibility, files, optionRules })`. Spread a built-in node to change one field and keep the rest:

```ts
import { allBreaking, compareOpenApi, openapi3Rules, type CompareRules } from "api-smart-diff"

const base = openapi3Rules({ version: "3.1" }) as Record<string, any>
const info = base["/info"]

// treat a change of info.version as breaking (for example, to force a review of every version bump)
const rules: CompareRules = {
  ...base,
  "/info": { ...info, "/version": { ...info["/version"], $: allBreaking } },
}

const { diffs } = compareOpenApi(before, after, { rules })
// breaking  [Replaced] API version from `1.0.0` to `2.0.0`
```

`options.rules` replaces the whole tree, so the tree you pass must be complete; spreading the built-in tree is the way to do that. For `x-*` keys use `options.extensions` instead, which is merged into the built-in tree for you.

## Comparing your own format

The generic `compare` runs any rule tree on any two JSON values. Without a spec engine there is no description dictionary, so pass an `annotateHook` that describes a diff from its action, path and values:

```ts
import { addNonBreaking, allAnnotation, allBreaking, compare, type CompareRules, type Diff } from "api-smart-diff"

// a service configuration: endpoints may be added, never removed or moved
const rules: CompareRules = {
  "/version": { $: allAnnotation },
  "/endpoints": {
    "/*": {
      $: addNonBreaking,
      "/url": { $: allBreaking },
      "/timeout": { $: timeout }, // the function classifier above
    },
  },
}

const describe = (diff: Diff): string => {
  const at = diff.path.join(".")
  if (diff.action === "add") return `[Added] ${at}`
  if (diff.action === "remove") return `[Removed] ${at}`
  return `[Replaced] ${at} from \`${diff.before}\` to \`${diff.after}\``
}

const { diffs } = compare(before, after, { rules, annotateHook: describe })
// annotation    [Replaced] version from `1` to `2`
// breaking      [Removed] endpoints.b
// breaking      [Replaced] endpoints.a.url from `x` to `z`
// breaking      [Replaced] endpoints.a.timeout from `10` to `5`
// non-breaking  [Added] endpoints.c
```

## Custom rules on unchanged subtrees

A subtree that is structurally equal in both documents is copied into `merged` without being walked, so no rule runs inside it. A rule set whose resolvers report diffs on equal values sets [`compareUnchanged: true`](./options#compareunchanged).

## Legacy helpers

`transformCompareRules(rules, transformer)` and `reverseClassifyRuleTransformer` (which 1.x used to derive response rules from request rules) are still exported for custom-rule authors; the built-in rule sets express direction through [scopes](./scopes) instead.
