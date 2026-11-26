# What is api-smart-diff?

`api-smart-diff` compares two versions of an API document and tells you what changed and what the change means for the clients of the API. It reads OpenAPI, AsyncAPI, JSON Schema, GraphQL (in its [GraphApi](https://github.com/udamir/graphapi) encoding) and gRPC / Protocol Buffers (in its [ProtoApi](./protoapi) encoding), runs in Node.js and in the browser, and has two small runtime dependencies (`json-crawl` and `allof-merge`).

```ts
import { apiCompare } from "api-smart-diff"

const { diffs, merged } = apiCompare(before, after)

for (const diff of diffs) {
  console.log(diff.type, diff.description)
}
// breaking      [Added] query parameter `owner`
// risky         [Added] possible value `pending` to `status` in Response 200 content (application/json)
// deprecated    [Added] deprecated status to operation `GET /pets`
// annotation    [Replaced] annotation (summary) of operation `GET /pets` from `List pets` to `List all pets`
```

## What you get

A comparison returns two things:

- **`diffs`** — one record per change: what happened (`add`, `remove`, `replace`, `rename`), where (`path` in the before document), the old and new values, the [class](./classification) of the change, the [scope](./scopes) it was classified in and a [human-readable description](./descriptions).
- **`merged`** — the after document with change metadata attached to every changed node (and removed nodes kept in place), so a UI can render the document with its changes highlighted. See [Result](./result).

## What it is for

- **Release gates**: fail a pipeline on breaking changes, ask for a review of risky ones.
- **Changelogs**: list the changes of a release in words, grouped by class.
- **Reviews**: see the changes of a pull request in the API contract, not in the YAML.
- **API governance**: keep versioning consistent — a breaking change needs a new major version.

## How it decides

Every verdict is given from the **consumer's point of view**: a change is breaking when an existing client of the API can fail. That depends on the direction: adding a required property breaks a request (clients do not send it) but not a response (clients receive one more field). The engine tracks the direction as an explicit [scope](./scopes), classifies a reusable component by the places that use it ([Components and $ref](./components)), recognizes [renamed](./renames) definitions, and normalizes representation-only differences (`nullable: true` vs `type: [T, "null"]`, `example` vs `examples`, an `allOf` split, …) so they produce no diff.

Specification support is expressed as a tree of [rules](./custom-rules): which keys are compared how, how keys are matched (path templates, case-insensitive headers, parameters by name and location, enum values as sets), how each change is classified and described. You can extend or replace the rules.

## Where to go next

- [Getting started](./getting-started) — install and run the first comparison.
- [Online demo](/demo) — paste two documents and see the result.
- [Examples](/examples/) — curated, editable before / after pairs for every specification and feature.
- [Migration from 1.x](./migration) — what changed in 2.0.0.
