# Specification extensions

Every OpenAPI and AsyncAPI object that allows specification extensions, and every JSON Schema node, carries the prefix rule `"/x-*"`: an `x-*` change — also lifecycle extensions such as `x-sunset` and `x-stability-level`, and any change nested inside an extension value — is an **annotation** whose description names the key and its container:

```text
[Added] extension `x-rate-limit` to operation `GET /pets`
[Removed] value `bird` of extension `x-extensible-enum` in query parameter `kind`
```

`x-*` keys of map objects (Paths, path items, Responses, callbacks, webhooks) are extensions, never paths, operations or status codes. The built-in extension value is compared with an isolated annotation tree: the rules of the enclosing object never apply inside an extension.

## Custom extension rules

`options.extensions` holds rules in json-crawl 1.x syntax that are merged key-wise over the built-in `"/x-*"` rule:

- an **exact key** such as `"/x-extensible-enum"` is merged field by field over `"/x-*"` — it inherits the built-in `annotate` and the isolated `compare` unless it sets them;
- a **longer prefix** such as `"/x-internal-*"` replaces `"/x-*"` for the keys it matches;
- a custom **`"/x-*"`** entry overrides the built-in fields.

A key without the leading `/` is a `TypeError`. `extensions` is ignored when `options.rules` is given; with a custom tree, spread `extensionRules(annotate, custom)` into the object nodes yourself.

### A breaking flag

```ts
import { allBreaking, apiCompare } from "api-smart-diff"

// adding, removing or changing x-internal is breaking; other extensions stay annotations
const { diffs } = apiCompare(before, after, {
  extensions: { "/x-internal": { $: allBreaking } },
})
```

### Enum semantics for `x-extensible-enum`

```ts
import { apiCompare, breaking, enumMappingResolver, nonBreaking } from "api-smart-diff"

// removing a value breaks requests that send it, adding one does not
const { diffs } = apiCompare(before, after, {
  extensions: {
    "/x-extensible-enum": {
      compare: undefined,           // walk the value with the child rules below instead of the isolated annotation tree
      mapping: enumMappingResolver, // values are compared as a set
      "/*": { $: [nonBreaking, breaking, breaking] },
    },
  },
})
```

A custom entry that defines `compare` — even as `undefined` — walks the extension value with its own child rules. Both are live on the [examples page](/examples/#custom-rules).

::: tip Descriptions of walked extension values
The items of an extension value walked with custom child rules are described like the built-in ones, naming the value and the extension: ``[Removed] value `bird` of extension `x-extensible-enum` in query parameter `kind` ``. See the [extension example](/examples/#custom-rule-for-an-extension).
:::

## Helpers

For rule sets of your own: `extensionRules(annotate, custom?)` builds the `"/x-*"` rule merged with custom extension rules, to spread into every object node that allows extensions; `extensionRule(annotate)` is the built-in rule of one `x-*` key; `EXTENSION_PREFIX` (`"x-"`) and `isExtensionKey(key)` recognize extension keys; `excludeExtensions(resolver?)` wraps a map's mapping resolver so `x-*` keys are matched by name only. See the [API reference](./api#specification-extensions).
