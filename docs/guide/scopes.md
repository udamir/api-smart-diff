# Direction and scopes

The same change means different things depending on who writes the value. A required property added to a **request** breaks clients (they do not send it); added to a **response** it does not (clients receive one more field). A property removed from a response can break clients that read it; removed from a request it only matters to clients that still send it.

api-smart-diff tracks this as explicit state, the **scope**. A rule opens a scope for its subtree (`scope: "request"`), the scope travels with the comparison into `$ref` targets, and every diff reports the scope it was classified in (`diff.scope`). Direction is never guessed from the path.

## Built-in scopes

Every verdict is given from the **consumer's** (client's) point of view.

| Where | Scope | Read as | Example |
| --- | --- | --- | --- |
| OpenAPI parameters, request bodies, the responses of callbacks and webhooks | `request` | what clients send | a required property added is breaking, an optional request property removed is risky |
| OpenAPI responses, the request bodies of callbacks and webhooks | `response` (inverted) | what clients receive | a required property removed is breaking, an enum value added is risky |
| AsyncAPI 2.x `publish`, 3.0 `receive` (messages the application consumes) | `publish` / `receive` | like a request | a required payload property added is breaking |
| AsyncAPI 2.x `subscribe`, 3.0 `send` (messages the application produces) | `subscribe` / `send` (inverted) | like a response | a required payload property removed is breaking |
| GraphQL arguments and input types | `args` | like a request | a non-null argument without a default added is breaking, one with a default is risky |
| GraphQL output fields, object, interface and union types | `output` (inverted) | like a response | a field removed is breaking, a union member or enum value added is risky |
| ProtoApi rpc request and response sides | `request` / `response` (inverted) | like an OpenAPI request / response | streaming turned on for a request or a response is breaking; see [Protocol Buffers](./protoapi#direction) |
| `components.*`, GraphQL named types, ProtoApi messages and enums | `components` | by usage | see [Components and $ref](./components) |
| everything else (info, servers, tags, a standalone JSON Schema) | `root` | like a request | a standalone schema is the contract of the values a client sends |

A few details:

- A 3.0 **reply** takes the opposite direction of its operation; OpenAPI **webhooks and callbacks** invert the direction of their operations (the API calls the client).
- The 2.x and 3.0 spellings of the same AsyncAPI API get identical verdicts.
- Inside `not`, a schema is read in the opposite direction.
- The scope names are exported as `CompareScopes`; the inverted ones are `response`, `output`, `subscribe` and `send`.

## Inversion

A classifier is written once, as a tuple `[add, remove, replace]` read in request semantics. In the inverted scopes — `response`, `output`, `subscribe` and `send` — a plain 3-tuple is read with `breaking` and `non-breaking` swapped, while `risky`, `deprecated`, `annotation` and `unclassified` never change. A tuple such as `[breaking, nonBreaking, breaking]` (adding breaks requests, removing does not) therefore reads as `[nonBreaking, breaking, nonBreaking]` in a response. Slots can also be functions of the compare context, for decisions that depend on more than the direction — the built-in rules use them a lot (a property removed from a response is breaking only when it was required, for example).

When a rule means something different per direction that a swap cannot express, it uses the object form, which is never inverted:

```ts
import { breaking, nonBreaking, risky } from "api-smart-diff"

const rule = {
  $: {
    request: [nonBreaking, risky, breaking],
    response: [risky, breaking, breaking],
    default: [nonBreaking, breaking, breaking], // every other scope
  },
}
```

or the 6-tuple form `[add, remove, replace, reversedAdd, reversedRemove, reversedReplace]`, whose last three slots are used in the inverted scopes. See [Custom rules](./custom-rules#classifiers).

## Example

The [direction example](/examples/#the-same-change-in-a-request-and-in-a-response) adds a required property `name` to the request body and to the response of one operation:

| Diff | Scope | Type |
| --- | --- | --- |
| property `name` added in the request body | `request` | breaking |
| `name` made required in the request body | `request` | breaking |
| property `name` added in the response | `response` | non-breaking |
| `name` made required in the response | `response` | non-breaking |

Filter by scope to get the changes of one direction:

```ts
const responseChanges = diffs.filter((diff) => diff.scope === "response")
```
