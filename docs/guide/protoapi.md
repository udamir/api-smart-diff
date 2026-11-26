# Protocol Buffers (ProtoApi)

api-smart-diff compares gRPC / Protocol Buffers APIs in their **ProtoApi** encoding. [ProtoApi](https://github.com/udamir/protoapi) is a JSON document format for Protocol Buffers APIs (format version `protoapi: "0.1"`): services with their rpcs, messages with their fields, enums, extensions, files, packages and options, with the validation rules of the messages written as JSON Schema keywords. The separate package `protoapi` builds such a document from `.proto` sources (or from a `FileDescriptorSet`) and keeps a source map that points every node back to its `.proto` line.

The result is what api-smart-diff gives for the other specifications: classified diffs with descriptions and a merged document with change metadata. Every diff stands for one source change at one element, and its description reads in protobuf terms, with values written as `.proto` literals:

```
[Removed] rpc `CancelOrder` from service `shop.v1.OrderService`
[Replaced] type of field `priority` (4) in message `shop.v1.Order` from `int32` to `int64`
[Replaced] maximum value of field `page_size` (1) in message `shop.v1.ListOrdersRequest` from `<= 100` to `<= 50`
```

Try it in the [examples](/examples/#protocol-buffers) or paste `.proto` sources into the [online demo](/demo).

## Installation

protoapi is **not** a dependency of api-smart-diff: the library never parses `.proto` text and never imports protoapi. Install it next to api-smart-diff:

```sh
npm install api-smart-diff protoapi
```

## Usage

Build both sides with protoapi, then compare the documents. `apiCompare` detects ProtoApi documents by their `protoapi` field; `compareProtoApi` skips the detection.

```ts
import { buildFromProto, locateDiff } from "protoapi"
import { apiCompare } from "api-smart-diff"

// { [import path]: file text } for each side; imports of the files protoapi bundles (google/protobuf/*, google/api/*,
// buf/validate/*, ...) are resolved by protoapi itself
const before = buildFromProto({ "shop/v1/shop.proto": beforeText }, { imports: "user" })
const after = buildFromProto({ "shop/v1/shop.proto": afterText }, { imports: "user" })

// build issues are protoapi's side channel: do not compare a side with `syntax`, `missing-import` or `unresolved-type`
const fatal = [...before.issues, ...after.issues].filter((issue) =>
  ["syntax", "missing-import", "unresolved-type"].includes(issue.code),
)

const { diffs, merged } = apiCompare(before.document, after.document, { compatibility: "WIRE" })

for (const diff of diffs) {
  // the .proto location of a diff: { file, start: { line, column }, end } (zero-based)
  const where = locateDiff(diff, before.sourceMap, after.sourceMap)
  console.log(diff.type, diff.description, where && `${where.file}:${where.start.line + 1}`)
}
```

```ts
import { compareProtoApi } from "api-smart-diff"

const { diffs } = compareProtoApi(before.document, after.document, { compatibility: "PACKAGE" })
```

### What the documents must satisfy

The comparison relies on properties of protoapi's output; documents that break them give wrong results without an error.

- **Same protoapi version, same options.** Build both documents with the same version of protoapi and the same producer options (`imports`, `files`, `annotations`, …), and do not edit a document by hand. Store the protoapi version with any document you keep for a later comparison.
- **The default `imports: "user"`.** Every user file reachable through imports is emitted completely, and the bundled files (`google/protobuf/*`, `google/api/*`, `buf/validate/*`, …) contribute only the declarations your files reference, so an import of a bundled file is no change.
- **No fatal build issue.** A side with a `syntax`, `missing-import` or `unresolved-type` issue is not compared; other issues (an unknown option, an annotation conflict, …) are informative.
- **Files are present.** protoapi's `files: false` removes the data that pairs files and packages; use the comparison option `files: "ignore"` instead when file paths carry no meaning.

## Compatibility levels

`options.compatibility` chooses which clients a change is judged for. The levels carry the names of buf's breaking categories:

| Level | Runtime clients covered | Generated code covered | A change that only breaks generated code is |
| --- | --- | --- | --- |
| `FILE` (default) | binary and ProtoJSON (gRPC, Connect, HTTP/JSON transcoding) | yes, per file: import paths and per-file generated units | risky |
| `PACKAGE` | binary and ProtoJSON | yes, per package: moving a declaration between files of one package is no change | risky |
| `WIRE_JSON` | binary and ProtoJSON | no | an annotation |
| `WIRE` | binary only (field names and JSON names do not matter) | no | an annotation |

A change is **breaking** only when it breaks the runtime clients the level covers; **risky** marks changes that can break some clients or need attention. A diff's class never increases from `FILE` to `WIRE`. Some verdicts that differ by level:

| Change | `FILE` / `PACKAGE` | `WIRE_JSON` | `WIRE` |
| --- | --- | --- | --- |
| field renamed, same number | breaking | breaking (the JSON name changes) | non-breaking |
| `json_name` changed | breaking | breaking | annotation |
| `int32` → `int64` in a message | breaking | breaking (64-bit integers are JSON strings) | risky (old readers truncate values above 2³¹) |
| `string` → `bytes` | breaking | breaking | risky |
| `int32` → `string` | breaking | breaking | breaking |
| field removed, number reserved | risky (generated code loses it) | annotation | annotation |
| field removed, number not reserved | breaking | breaking | breaking |
| language option changed (`go_package`, `java_package`, …) | risky | annotation | annotation |
| message moved to another file of the same package | risky at `FILE`, annotation at `PACKAGE` | annotation | annotation |
| oneof renamed, same members | risky | annotation | annotation |
| rpc request or response streaming turned on or off | breaking | breaking | breaking |
| package renamed | breaking | breaking | breaking |

The [compatibility levels example](/examples/#the-same-changes-at-four-compatibility-levels) shows one change set at every level.

## Direction

As for OpenAPI requests and responses, the class of a change depends on who sends the message. A message used as an rpc request is read like an OpenAPI request, a message used as a response like a response, and a message used by both takes the more severe class; the use is followed through fields and map values (transitively). A message no rpc uses is classified as if it were used both ways.

So a field added to a request message is non-breaking, a field marked `(google.api.field_behavior) = REQUIRED` added to it breaking; an enum value added to an enum that responses carry is risky (a client may not handle the new value), one added to a request enum non-breaking; a tightened validation rule in a request is breaking, in a response non-breaking. Messages are named components: a change inside a message is reported once, at `components/messages/<full name>`, with the scope `components`.

## Pairing

- **Fields by number.** The number is what goes on the wire, so a field renumbered from 5 to 6 is a removal plus an addition, and a field renamed with the same number is one rename. Fields are never paired by name.
- **Enum values by number** (aliases included), **rpcs by name**, **HTTP bindings** by method and path, **extensions** by extendee and number.
- **Files by the declarations they hold**: a file renamed with the same content is one change of its path; a **package rename** is one diff at the `package` statement, not one per declaration.
- **Type renames are not detected**: a renamed message or enum is a removal plus an addition, and the fields that refer to it are retargeted.

## Options and validation rules

protoapi lifts the options it knows into the document, and the engine compares them by meaning:

- **Validation** — protovalidate (`buf.validate.*`), protoc-gen-validate (`validate.rules`), `google.api.field_behavior` and the openapiv2 annotations become JSON Schema keywords (`minLength`, `maximum`, `required`, `pattern`, …) and are classified by the direction of the message, like OpenAPI schema keywords; 64-bit bounds are compared exactly.
- **API conventions** — `google.api.http` bindings, idempotency levels, deprecation.
- **Language-specific options** (`go_package`, `java_*`, `csharp_namespace`, `ctype`, `jstype`, …) only affect generated code: risky at `FILE` / `PACKAGE`, annotations at `WIRE_JSON` / `WIRE`.
- **Every other option** — custom options of your organization, for example — is compared as a value and left `unclassified`, with a description naming it. `optionRules` classifies them, in the [custom rules](./custom-rules) syntax without the parentheses of the option name (`"/acme.audit"` exact, `"/acme.*"` prefix):

```ts
import { allAnnotation, allBreaking, compareProtoApi } from "api-smart-diff"

const { diffs } = compareProtoApi(before.document, after.document, {
  optionRules: {
    "/acme.*": { $: allBreaking }, // every (acme.xxx) option change breaks clients
    "/acme.audit": { $: allAnnotation }, // except (acme.audit)
  },
})
```

An exact key overrides a built-in option rule; a shorter prefix never shadows a longer built-in one.

## Options

| Option | Default | Effect |
| --- | --- | --- |
| `compatibility` | `"FILE"` | `"FILE"`, `"PACKAGE"`, `"WIRE_JSON"` or `"WIRE"`: the clients and the generated code a change is judged for (above); another value is a `TypeError` |
| `files` | `"compare"` | `"ignore"` makes file paths, file-level statements and the declaring file of every element annotations, for inputs whose file paths carry no meaning (generated or flattened trees); the package of a file keeps its class |
| `optionRules` | built-in option rules | rules for option keys, merged over the built-in rules of every element (above) |

The common options (`onError`, `components`, `metaKey`, `rules`, `annotateHook`, …) work as for the other specifications, see [Options](./options); `merged` holds the original after values (the internal normalized values are not protobuf). `protoApiRules({ compatibility, files, optionRules })` builds the default rule tree for a level, which custom `rules` can extend.

## Tolerant readers

Additions are classified for clients that ignore what they do not know: a field added to a response is non-breaking and an enum value added to a response is risky, not breaking. The binary decoders of every protobuf runtime behave that way. Strict **ProtoJSON** readers do not — Go `protojson.Unmarshal` without `DiscardUnknown: true` and Java `JsonFormat.parser()` without `ignoringUnknownFields()` reject an unknown field or enum name. Configure your ProtoJSON clients to ignore unknown fields, or, if you must support strict readers, raise those diffs with custom `rules`.

## Compared with buf breaking

[buf breaking](https://buf.build/docs/breaking/) checks a change against a fixed set of rules and reports violations; api-smart-diff reports every change — breaking or not — with a class, a description and the merged document, which is what change logs, API review tools and diff viewers need.

- **The same categories.** The levels are buf's categories `FILE`, `PACKAGE`, `WIRE_JSON` and `WIRE`; the classification was checked against buf 1.75.0 (`buf breaking`, all four categories) on buf's own test corpus, and every difference from buf is a recorded, deliberate decision.
- **Three classes instead of pass / fail.** Where buf rejects a change that only breaks some clients (a type change within one wire group, an enum value added to a response, a generated-code-only change at `FILE`), api-smart-diff says `risky`; where buf is silent about an addition, it says `non-breaking`.
- **Validation rules.** protovalidate, protoc-gen-validate and `field_behavior` rules are compared by meaning and by direction; buf breaking does not look at them.
- **Not covered:** buf's `CSR` category, imports resolved over the network or from the Buf Schema Registry (protoapi bundles the common well-known and googleapis files), and the execution or validation of messages.
- **Speed.** A 1.6 MB `.proto` API (1 700 messages, 1 % of them edited) compares in about 160 ms from built documents and in about 2.1 s from `.proto` sources including protoapi's build of both trees, where `buf breaking` takes 3.7 s on the same trees.

## Limitations

- Type renames are a removal plus an addition; fields are paired by number only.
- No `CSR` category; imports are not resolved over the network or from the Buf Schema Registry.
- Responses assume tolerant ProtoJSON readers (above).
- ProtoApi references are nominal and never expanded, so a long chain of messages referencing each other compares normally.
