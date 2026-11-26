# Renames

A keyed definition that was renamed — with every reference moved to the new key, or with mostly the same content — is reported as **one `rename` diff at its map** instead of a removal plus an addition.

```ts
{
  action: "rename",
  path: ["components", "schemas"],
  before: "Pet",
  after: "Animal",
  type: "annotation",
  scope: "components",
  description: "[Renamed] schema component `Pet` to `Animal`",
}
```

`before` and `after` are the old and the new key; the merged metadata sits on the new key.

## What can be renamed

- OpenAPI: components of every kind, security schemes, paths (a renamed path template parameter: `/pets/{id}` → `/pets/{petId}`, one non-breaking rename at `paths`), and a response code renamed to its range (`200` ↔ `2XX`).
- AsyncAPI 3.0: channels and channel messages; AsyncAPI 2.x and 3.0: components (security schemes included).
- Protocol Buffers (ProtoApi): fields and enum values are paired by number, so a field or enum value renamed with the same number is one rename; a renamed file with the same declarations is one change of its path, and a renamed package is one diff at the `package` statement. Renamed messages and enums are not detected. The rules on this page do not apply to ProtoApi; see [Pairing](./protoapi#pairing) and the classes per compatibility level in [Compatibility levels](./protoapi#compatibility-levels).

## When a pair is a rename

A removed key and an added key of the same map are considered when the old key is no longer referenced in the after document and the new key was not referenced in the before document. They are a rename when:

1. the old key was referenced and the new key is referenced **from the same places** (every reference moved), or
2. — referenced or not — **more than half of the direct fields** of the two definitions are equal (equal top-level keys ÷ all top-level keys of both; identical definitions are 100 %).

A field that differs only by references repointed through other renames counts as equal — `$ref`s, discriminator `mapping` values, `defaultMapping`, link `operationRef`s, and the keys of an AsyncAPI 3 channel's `messages` renamed together with the channel — so definitions renamed together are recognized: a schema and the schema it references, a chain, schemas that reference each other, a channel and its message.

Candidates are paired one to one: a matching set of references first, then the most similar definitions. Two equally good candidates for one key are not paired, and the change stays a removal plus an addition.

## What the rename diff means

- A rename of a component, security scheme, channel or message is an `annotation`: the API is the same, only a name changed (a rename of a definition nothing references is `unclassified`, like every change of an unreferenced component). A renamed path template parameter is `non-breaking`; a response code renamed to its range is breaking from `200` to `2XX` (clients lose the exact code) and non-breaking from `2XX` to `200`.
- The repointed references are **no change**.
- The old and the new definition are compared, so a change made together with the rename is reported and classified on its own, at the declaration and at the usages, and its description names both keys: ``[Added] required status to `name` in schema component `Animal` (renamed from `Pet`)``.
- Containers inside a renamed entry are named with both keys too: ``in payload of message `registration` (renamed from `signup`) in channel `userSignup` ``.

See the [component rename](/examples/#component-renamed) and [channel rename](/examples/#asyncapi-3-0-channel-renamed) examples.
