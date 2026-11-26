# Diff types

Every diff has one of six types (`DiffType`). Each is decided from the **consumer's point of view**: what the change means for an existing client of the API.

| Type | Meaning | Examples |
| --- | --- | --- |
| <span class="asd-type breaking">breaking</span> | existing clients can fail | a required request parameter or property added, an operation removed, a required response property removed, a type changed, a request bound tightened |
| <span class="asd-type risky">risky</span> | valid for most clients, can break some | an enum value, union member or message alternative added on the output side, a numeric bound loosened in a response, required → optional in a response, an optional request property removed, a GraphQL argument added with a default, an OAuth URL changed |
| <span class="asd-type non-breaking">non-breaking</span> | existing clients keep working | an optional parameter or property added, an operation added, a request enum value added, an optional response property removed |
| <span class="asd-type deprecated">deprecated</span> | a deprecation flag or reason changed | `deprecated: true` on an operation, parameter or schema, a GraphQL `@deprecated` |
| <span class="asd-type annotation">annotation</span> | documentation and metadata only | `description`, `summary`, `title`, examples, `x-*` extensions, servers, a rename |
| <span class="asd-type">unclassified</span> | no rule applies | a change in a component nothing references, an unknown keyword, a schema format other than JSON Schema |

The constants are exported as `ClassifierType` and individually as `breaking`, `risky`, `nonBreaking`, `deprecated`, `annotation` and `unclassified`:

```ts
import { breaking, ClassifierType, type DiffType } from "api-smart-diff"

ClassifierType.nonBreaking // "non-breaking"
```

## Breaking

A change is breaking when a client that worked with the before version can fail with the after version: a request it sends is now rejected, or a response it reads no longer has the shape it expects. Typical cases:

- **Requests** (what clients send): a required parameter, header or property added; a type narrowed; a bound tightened (`maxLength` lowered, `minimum` raised); an enum value removed; an operation or path removed; a security requirement added.
- **Responses** (what clients receive): a required property removed; a type changed; a value that was always present made optional is *risky*, not breaking (see below).
- **Messages and GraphQL**: the same logic, in the direction of the message or field (see [Direction and scopes](./scopes)).

## Risky

`risky` is for changes that keep the API valid for most clients but can break some, typically because the set of values a client receives grows. Since 2.0.0 these are no longer forced into breaking or non-breaking:

- an enum value, a union member or a message alternative **added on the output side** — a client with an exhaustive `switch` meets a value it does not handle;
- a numeric bound **loosened in a response** (`maximum` raised, `minimum` lowered);
- a property that was required in a **response** made optional;
- an optional **request** property removed — clients that still send it may be rejected, the others keep working;
- a GraphQL argument or input field **added with a default** or a changed default, an interface implemented by a type;
- an OAuth / OpenID Connect URL changed, a 3.2 `defaultMapping` added in a response.

`risky` is never inverted between directions. Treat it as breaking for a strict release gate and as non-breaking for a changelog.

::: warning A sixth value
`risky` is new in 2.0.0. Code with an exhaustive `switch` over `DiffType`, a `Record<DiffType, …>` map, a colour map or a filter needs a `risky` branch.
:::

## Non-breaking

The API grew in a way existing clients cannot notice: an optional parameter or property, a new operation, path, response or message, a looser request constraint (`maxLength` raised, an enum value added to a request), a property removed from a response that was optional anyway (clients must already cope with its absence).

## Deprecated

A deprecation flag or reason added, changed or removed (`deprecated: true` on an operation, parameter, header, schema or security scheme, a GraphQL deprecation). Nothing breaks yet; the removal that follows will be breaking — removal after deprecation is still breaking.

## Annotation

Documentation and metadata only: descriptions, summaries, titles, examples, external docs, `x-*` extensions (unless a [custom rule](./extensions) says otherwise), servers, tags, the `info` object, and `rename` diffs (a rename is reported as one annotation; changes made together with it are classified on their own).

## Unclassified

No rule classifies the change: a change inside a component that nothing references (with `components: "usage"`, the default), a keyword the rules do not know, a payload in a schema format other than JSON Schema (Avro, RAML, Protobuf are compared as opaque values: a change is one unclassified diff). Unclassified diffs are always described.

## Severity order

Where one class has to be chosen from several — a component referenced from more than one scope, for example — the most severe wins: breaking > risky > non-breaking > deprecated > annotation > unclassified.

## How classification works

Each rule of the rule tree can carry a classifier `$`, a tuple `[add, remove, replace]` whose slots are a `DiffType` or a function of the compare context. The engine picks the slot for the diff's action (a rename uses the replace slot) and reads it in the diff's [scope](./scopes): in response-like scopes a plain tuple is read with breaking and non-breaking swapped. A node without a classifier yields `unclassified`. See [Custom rules](./custom-rules) to write your own.

Try the classes on the [examples page](/examples/) — every diff type is shown there with live, editable documents.
