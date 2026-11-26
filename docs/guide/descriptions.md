# Descriptions

Every diff of the built-in engines carries a human-readable `description`:

```text
[Added] query parameter `owner`
[Replaced] maxLength validator of `name` from `100` to `50`
[Removed] required status from `createdAt` in Response 201 content (application/json)
[Added] possible value `pending` to `status` in Response 200 content (application/json)
[Added] property `requestedBy` in publish message payload of channel `order/cancel`
[Added] argument `genre` to field `Query.books`
[Renamed] schema component `Pet` to `Animal`
[Added] required status to `name` in schema component `Animal` (renamed from `Pet`)
```

## Shape

A description starts with the action — `[Added]`, `[Removed]`, `[Replaced]`, `[Renamed]` — names what changed (a parameter, property, validator, enum value, operation, …) and, where it helps, the values and the **nearest container**: the parameter, request body, response, header, media type, channel, message, component or GraphQL type the change is in. `diff.path` identifies the operation, so the operation is not repeated in every text.

Protocol Buffers descriptions are written for the `.proto` source: they use protobuf terms (field, message, enum value, rpc, option) and `.proto` literals, never ProtoApi or JSON Schema keys, and name the element with its field number where it helps — ``[Replaced] maximum value of field `page_size` (1) in message `shop.v1.ListOrdersRequest` from `<= 100` to `<= 50` ``.

Values are written in backticks:

- strings as they are (`gamma`), quoted when they read like another JSON value (`"1"`, `"true"`, `""`);
- numbers, booleans and `null` as JSON (`2`, `true`);
- short arrays and objects as compact JSON (`["a","b"]`), long ones summarized by their first items or keys and the count;
- free text (`description`, `summary`, `title`, `$comment`) on one line, shortened to about 60 characters with `…`;
- every other string up to 200 characters (identifiers, URLs and enum values stay complete in practice).

## How descriptions are built

Each rule can carry an `annotate` resolver that returns an `AnnotateTemplate` — a template name and its parameters, rendered with the engine's dictionary. A template renders only when every placeholder resolves; otherwise a generated description names the action, the key, the location and the values, so a description never contains an empty name or the text `undefined`.

The location comes from a container locator of each specification, which walks the compare context chain — also across `$ref` targets — and reads what a node is from the `kind` its rule declares (`schema`, `parameter`, `header`, `message`, …), not from path positions.

## Custom descriptions

The simplest way to change descriptions is `options.annotateHook`, a function `(diff, ctx) => string` that replaces the engine's hook. Delegate to the built-in hook for everything you do not handle:

```ts
import { apiCompare, openApi3AnnotateHook } from "api-smart-diff"

const { diffs } = apiCompare(before, after, {
  annotateHook: (diff, ctx) => {
    if (diff.path.at(-1) === "operationId") {
      return `[${diff.action}] operationId ${diff.before ?? ""} → ${diff.after ?? ""}`
    }
    return openApi3AnnotateHook(diff, ctx)
  },
})
```

The built-in hooks are `openApi3AnnotateHook`, `asyncApiAnnotateHook`, `jsonSchemaAnnotationHook` and `graphApiAnnotateHook`.

Description texts were rewritten in 2.0.0. Do not parse them; use `action`, `path`, `before`, `after`, `type` and `scope` for logic and the description for people.
