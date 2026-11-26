# Components and $ref

Reusable definitions — OpenAPI `components.*` (schemas, parameters, responses, request bodies, headers, security schemes, path items, media types, …), AsyncAPI components and 3.0 channel messages, GraphQL named types, Protocol Buffers messages and enums — are compared once, in the `components` scope, and classified by **how the API uses them**.

## Classified by usage

A component has no direction of its own. With `options.components: "usage"` (the default) the engine builds an index of which scopes reference each component, transitively through other components, over both documents, and classifies a change inside the component in every scope that uses it:

- a schema referenced only from responses gets response semantics;
- a schema referenced from requests and responses takes the **most severe** class of its usages (breaking > risky > non-breaking > deprecated > annotation > unclassified);
- a component that only the after document references is classified by that usage;
- a component **nothing references** is `unclassified` (with a description);
- GraphQL types that no root operation type reaches are classified as if they were reachable (output types with output semantics, input types with argument semantics, enums and scalars in both).
- Protocol Buffers messages and enums take the direction of the rpcs that use them — a message used as an rpc request reads like an OpenAPI request, one used as a response like a response — followed through fields and map values; a message no rpc uses is classified as if it were used both ways (see [Direction](./protoapi#direction)).

`options.components: "unclassified"` opts out: every diff inside `components.*` is unclassified, and only the usage locations are classified.

See the [component usage example](/examples/#component-classified-by-its-usages) and the [both directions example](/examples/#component-used-in-both-directions).

## Where a change is reported

A change inside a component is reported **at its declaration** (`components/...`, scope `components`) and, when it matters to a client, **again at every usage location** reachable from an operation, webhook or channel — each request body, response, parameter or message payload that references it, in the scope of that usage, with `origin` pointing at the declaration:

```ts
{
  action: "replace",
  path: ["paths", "/pets", "get", "responses", "200", "content", "application/json", "schema", "properties", "tag", "type"],
  origin: {
    before: ["components", "schemas", "Pet", "properties", "tag", "type"],
    after: ["components", "schemas", "Pet", "properties", "tag", "type"],
  },
  type: "breaking",
  scope: "response",
  description: "[Replaced] type definition of `tag` from `string` to `integer` in Response 200 content (application/json)",
}
```

Rules that keep the volume manageable:

- Inside `components`, a `$ref` from one component to another is not expanded: the change is reported at the declaration it belongs to, not inside every component that references it.
- **Annotation-only changes** (descriptions, titles, examples, `x-*` values, …) are reported at the declaration only. While a usage whose `$ref` names the same declaration in both documents is compared, a diff that is an annotation in the usage's scope is not repeated there.
- A usage whose reference was **retargeted** (`$ref: A` → `$ref: B`) or switched between an inline schema and a `$ref` reports all its diffs, annotations included, since no declaration holds them.
- GraphQL named types are nominal: a change inside a type is reported at `components/...` only, not inside every operation that reaches it.

To list every change once, keep either the declarations or the usage locations:

```ts
const declarations = diffs.filter((diff) => diff.path[0] === "components")
const usages = diffs.filter((diff) => diff.path[0] !== "components")
```

## $ref resolution

- Local `$ref`s (`#/components/schemas/Pet`) are resolved in their own document, external ones from [`externalSources`](./options#externalsources) (nothing is fetched). A `$ref` that cannot be resolved is reported in `errors` and compared as an opaque value.
- `$ref` targets are compared once per pair and re-described at every usage; circular references are detected and compared once.
- `$ref`s with sibling keywords are supported (validation siblings apply in OpenAPI 3.0 too); OpenAPI 3.1 Reference Object `summary` / `description` overrides are compared.
- An unchanged `$ref` stays a `$ref` in the merged document; a `$ref` whose target changed is inlined at the usage (see [Result](./result#merged-document)).
- A reference that only follows a [rename](./renames) is no change.

## Repointed references

A component removed after all its usages were repointed to an identical one is non-breaking, and a reference repointed together with a rename is not reported at all. A usage retargeted to a different definition is compared as a change of the usage (both definitions are compared).
