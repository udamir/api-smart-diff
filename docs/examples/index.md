---
title: Examples
outline: [2, 3]
---

<script setup>
import DiffExample from "../.vitepress/theme/components/DiffExample.vue"
</script>

# Examples

Each example is a pair of small documents compared with `apiCompare` from the current sources, live in your browser. Both editors are editable: change either document and the diff list below updates as you type; **Reset** restores the example, **Open in demo** loads it into the [online demo](/demo) and **Report issue** (or the ⚑ of a row) prepares a GitHub issue about the result. The test suite checks the documented result of every example, so what you read here is what the library returns.

The colours are the [diff types](/guide/classification): <span class="asd-type breaking">breaking</span> <span class="asd-type risky">risky</span> <span class="asd-type non-breaking">non-breaking</span> <span class="asd-type deprecated">deprecated</span> <span class="asd-type annotation">annotation</span> <span class="asd-type">unclassified</span>. The location columns name where the change is in the API: for OpenAPI the method and the endpoint (hover a row for the request or response part), for AsyncAPI the operation, the channel and the message, for GraphQL the operation kind, the field and arguments vs output; a change inside `components` names the component and the usages the engine reports for it. The toolbar above the result filters by type (click a chip) and by text, and **Table | YAML** switches to the raw `diffs` array as `apiCompare` returns it, limited to the diffs the filter shows. Click the **Type** or **Endpoint** header to sort (again to reverse, a third time for the engine order); the YAML view follows the same order.


## Breaking and non-breaking changes

The basic verdicts: a change is breaking when an existing client of the API can fail, non-breaking when every existing client keeps working.

### Required query parameter added

A client that does not send the new required `owner` parameter now gets an error, so the change is breaking. The optional `limit` parameter added next to it is non-breaking: existing requests stay valid.

<ClientOnly>
  <DiffExample id="openapi-required-parameter" />
</ClientOnly>

### Operation removed, operation added

Removing `DELETE /pets/{id}` breaks every client that calls it; adding `PUT` breaks nobody. Path templates are matched by position, so `/pets/{id}` and `/pets/{petId}` are the same path: the renamed template parameter is one non-breaking `rename` diff, and the operation diffs use the before path.

<ClientOnly>
  <DiffExample id="openapi-operation-removed" />
</ClientOnly>

### Property type changed

Changing the type of a response property from `integer` to `string` breaks clients that parse a number. Changing a description is only an annotation.

<ClientOnly>
  <DiffExample id="openapi-type-change" />
</ClientOnly>


## Request and response direction

What a client sends and what it receives are read in opposite directions: a change that is breaking in a request is usually non-breaking in a response and the other way round. The `scope` under each action shows where each diff was classified.

### The same change in a request and in a response

A required property `name` is added to the request body and to the response. In the request the property and its required status are breaking (existing clients do not send it); in the response both are non-breaking (clients receive one more field). Each diff carries the `scope` it was classified in.

<ClientOnly>
  <DiffExample id="openapi-direction" />
</ClientOnly>

### Property removed from a request and from a response

Removing a required property from a response breaks clients that read it (the property and its required status are two breaking diffs). Removing an optional property from a request is risky: clients that still send it may be rejected, others keep working. An optional response property removed would be non-breaking, since clients must already cope with its absence.

<ClientOnly>
  <DiffExample id="openapi-property-removed" />
</ClientOnly>


## Risky changes

Valid for most clients, but able to break some — typically a value space that grows on the side clients read. Treat `risky` as breaking for a strict gate and as non-breaking for a changelog.

### Enum value added (risky in a response)

A new enum value in a request is non-breaking: the server accepts more. The same value in a response is risky: it is valid, but a client with an exhaustive `switch` over the values receives one it does not know.

<ClientOnly>
  <DiffExample id="openapi-risky-enum" />
</ClientOnly>

### Validation bounds tightened and loosened

A tighter `maximum` on a request parameter is breaking: values that were accepted are now rejected. A looser `maximum` on a response property is risky: the response is still valid JSON of the same type, but a client that relied on the old bound (a fixed-size field, a progress bar) can receive a larger value.

<ClientOnly>
  <DiffExample id="openapi-risky-bounds" />
</ClientOnly>


## Deprecations and annotations

Changes that do not break anything today: deprecations warn about a future removal, annotations are documentation and metadata.

### Operation and parameter deprecated

Setting `deprecated: true` is its own class, `deprecated`: nothing breaks yet, but clients should move away. The changed `summary` and the new `x-rate-limit` extension are annotations (documentation and metadata only).

<ClientOnly>
  <DiffExample id="openapi-deprecated" />
</ClientOnly>


## Components and $ref

Reusable definitions are classified by how the API uses them, and a change inside one is reported at the declaration and at every usage location.

### Component classified by its usages

`Pet` is used only in a response, so changing the type of its `tag` property is classified with response semantics: breaking. The change is reported at the declaration in `components` and again at the usage location in the response, where `origin` points at the declaration. `Draft` is not referenced anywhere, so its change is `unclassified`.

<ClientOnly>
  <DiffExample id="openapi-component-usage" />
</ClientOnly>

### Component used in both directions

`Pet` is both the request body and the response. Making `name` required is breaking for the request and non-breaking for the response, and each usage reports its own class. At the declaration the component takes the most severe class of its usages: breaking.

<ClientOnly>
  <DiffExample id="openapi-component-both-directions" />
</ClientOnly>

### External $ref resolved from externalSources

The response refers to a schema in another file, `pet.json`, which is the schema itself (a `$ref` without a fragment names the whole document; `pet.json#/Pet` would name a part of it). Nothing is fetched: the referenced documents are passed per side in `externalSources`, keyed by their URI. The type of `name` in the external schema changed, which breaks the response; the editors hold only the referencing documents, the external ones are in the options.

<ClientOnly>
  <DiffExample id="openapi-external-sources" />
</ClientOnly>


## Renames

A renamed entry whose references all moved is one `rename` diff, not a removal plus an addition.

### Component renamed

`Pet` is renamed to `Animal` and every `$ref` moved with it. This is one `rename` diff (an annotation) at the `schemas` map instead of a removal and an addition, and the repointed references are no change. A change made together with the rename (`name` became required) is still reported and classified on its own, and its description names both keys.

<ClientOnly>
  <DiffExample id="openapi-component-rename" />
</ClientOnly>

### AsyncAPI 3.0 channel renamed

The channel `userSignup` is renamed to `userRegistration` and the operation's `$ref` moved with it: one `rename` annotation. The changed `address` is reported on its own, and it is breaking: clients subscribe by address.

<ClientOnly>
  <DiffExample id="asyncapi3-channel-rename" />
</ClientOnly>


## Versions

Documents of different OpenAPI 3.x versions can be compared with each other.

### OpenAPI 3.0 to 3.1 migration

Documents of different 3.x versions are compared with the profile of the higher version, and representation-only changes are not reported: `nullable: true` and `type: [string, "null"]` mean the same, and so do `example` and `examples`. Only the `openapi` field itself changed.

<ClientOnly>
  <DiffExample id="openapi-cross-version" />
</ClientOnly>


## AsyncAPI

Messages are classified from the client's point of view: messages the application consumes like requests, messages it produces like responses.

### AsyncAPI 2.x publish and subscribe

Direction is read from the client's point of view. `publish` messages are sent by clients to the application, so a new required payload property breaks them (like a request). `subscribe` messages are produced by the application, so a removed required property breaks the clients that read it (like a response).

<ClientOnly>
  <DiffExample id="asyncapi2-direction" />
</ClientOnly>

### AsyncAPI 3.0 send and receive

The same API as the 2.x example in AsyncAPI 3.0 spelling: a `receive` operation consumes messages (request semantics), a `send` operation produces them (response semantics), and the 2.x and 3.0 spellings get the same verdicts. The messages are components, so every change is reported at the message declaration and at the channel message that references it, classified by the operations that use the channel.

<ClientOnly>
  <DiffExample id="asyncapi3-operations" />
</ClientOnly>


## JSON Schema

A standalone JSON Schema is read as the contract of the values a client sends (request semantics).

### JSON Schema validators

A standalone schema is read as the contract of the values a client sends (request semantics). A tighter `maxLength` and a raised `minimum` reject values that were valid: breaking. A new optional property and a property that is no longer required are non-breaking, and a changed `description` is an annotation.

<ClientOnly>
  <DiffExample id="jsonschema-validators" />
</ClientOnly>

### Enum values and type changes

Replacing the enum value `guest` with `owner` breaks clients that send `guest`. Widening `integer` to `number` accepts more values (non-breaking); changing `string` to `integer` is breaking.

<ClientOnly>
  <DiffExample id="jsonschema-enum-type" />
</ClientOnly>

### Equivalent rewrites

`maxItems: 0` and `items: false` accept the same arrays: the rewrite is recognized and reported as one annotation, never as breaking. A list of types and an `anyOf` of single types are normalized to the same schema before the comparison, so that rewrite produces no diff at all.

<ClientOnly>
  <DiffExample id="jsonschema-equivalent" />
</ClientOnly>

### allOf merged before comparing

`allOf` branches are merged (with allof-merge) before the comparison, so splitting a schema into `allOf` parts is no change at all; only the tightened `maxLength` is reported.

<ClientOnly>
  <DiffExample id="jsonschema-allof" />
</ClientOnly>


## GraphQL (GraphApi)

GraphQL schemas are compared in their GraphApi encoding: arguments and input types like requests, output fields like responses. Convert SDL with [gqlapi](https://github.com/udamir/graphapi) (`buildFromSchema(buildSchema(sdl))`), or paste SDL into the [online demo](/demo).

### GraphQL fields and arguments

GraphQL is compared in its GraphApi 1.0 encoding (convert the SDL with gqlapi). A new non-null argument without a default breaks every query that does not pass it; an argument with a default is risky. Object types are named components, so field changes are reported at the type: a removed field is breaking, an added one non-breaking.

<ClientOnly>
  <DiffExample id="graphapi-fields" />
</ClientOnly>

### GraphQL enums, unions and deprecation

`Genre` and `SearchResult` are only returned, never sent. An enum value or union member added to an output type is risky (a client with an exhaustive match can receive a value it does not handle), while a removed enum value is non-breaking (the server simply never sends it). A field that gets a deprecation is `deprecated`.

<ClientOnly>
  <DiffExample id="graphapi-enums-unions" />
</ClientOnly>

### GraphApi 0.1.2 documents

Documents written by gqlapi 0.5 and earlier (`graphapi: 0.1.2`) are compared with their own rule set and get the same verdicts as 1.0 documents. A field type changed from `String` to `Int` is breaking.

<ClientOnly>
  <DiffExample id="graphapi-012" />
</ClientOnly>


## Custom rules

The built-in rule sets can be extended through the options; the options of these examples are shown under the editors.

### Custom rule for an extension

By default every `x-*` change is an annotation. `options.extensions` gives `x-extensible-enum` enum semantics: its values are compared as a set (`enumMappingResolver`), an added value is non-breaking and a removed one is breaking. The built-in descriptions name each value and the extension, no description hook is needed. Without these options both diffs would be annotations.

<ClientOnly>
  <DiffExample id="custom-extension-enum" />
</ClientOnly>

### A breaking extension

An organization that treats its `x-internal` flag as part of the contract classifies every change of it as breaking with a custom rule. Other extensions stay annotations.

<ClientOnly>
  <DiffExample id="custom-extension-breaking" />
</ClientOnly>
