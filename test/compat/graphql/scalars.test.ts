import { annotation, breaking, nonBreaking } from "../../../src"
import { type CaseSource, type CompatCase, type GraphqlCase, runCases } from "../../helpers/compat"

const gql = (c: Omit<GraphqlCase, "kind">): CompatCase => ({ kind: "graphql", ...c })
const gi = (ref: string, verdict?: string): CaseSource => ({
  tool: "graphql-inspector",
  ref: `packages/core/__tests__/diff/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const giChange = (ref: string, verdict?: string): CaseSource => ({
  tool: "graphql-inspector",
  ref: `packages/core/src/diff/changes/${ref}`,
  ...(verdict ? { verdict } : {}),
})
const fork = (ref: string, verdict?: string): CaseSource => ({ tool: "fork", ref, ...(verdict ? { verdict } : {}) })
const asd = (ref: string): CaseSource => ({ tool: "asd", ref })

const ev = (field: string, extra = "") => `type Query { event: Event } type Event { id: ID! ${field} } ${extra}`
const arg = (a: string, extra = "") => `type Query { events(${a}): [String] } ${extra}`

const cases: CompatCase[] = [
  gql({
    id: "GQL-SCL-001",
    // ISSUE-127 (fixed) (P8a)
    title: "custom scalar added together with the field that uses it",
    before: "type Event { id: ID! }",
    after: "type Event { id: ID! at: DateTime } scalar DateTime",
    rationale: "a new type and a new field; existing queries are unaffected",
    annotation: "names the added field (Event.at) and the added scalar (DateTime)",
    sources: [
      giChange("type.ts TYPE_ADDED"),
      asd("test/graphapi/classification.test.ts adding a custom scalar used by a new field is classified"),
    ],
    covers: ["gi:TYPE_ADDED", "gi:FIELD_ADDED"],
    sdl: [ev(""), ev("at: DateTime", "scalar DateTime")],
    expect: [
      {
        at: ["queries/event/**/at", "components/objects/Event/**/at"],
        action: "add",
        type: nonBreaking,
        mentions: ["Event", "at"],
      },
      { at: "components/scalars/DateTime", action: "add", type: nonBreaking, mentions: ["DateTime"] },
    ],
  }),
  gql({
    id: "GQL-SCL-002",
    // ISSUE-127 (fixed) (P8a)
    title: "custom scalar removed together with the field that used it",
    before: "type Event { id: ID! at: DateTime } scalar DateTime",
    after: "type Event { id: ID! }",
    rationale: "queries selecting Event.at fail validation",
    annotation: "names the removed field (Event.at) and the removed scalar (DateTime)",
    sources: [giChange("type.ts TYPE_REMOVED"), gi("rules/safe-unreachable.test.ts removed scalar")],
    covers: ["gi:TYPE_REMOVED", "gi:FIELD_REMOVED"],
    sdl: [ev("at: DateTime", "scalar DateTime"), ev("")],
    expect: [
      {
        at: ["queries/event/**/at", "components/objects/Event/**/at"],
        action: "remove",
        type: breaking,
        mentions: ["Event", "at"],
      },
      { at: "components/scalars/DateTime", action: "remove", type: breaking, mentions: ["DateTime"] },
    ],
  }),
  gql({
    id: "GQL-SCL-003",
    // ISSUE-127 (fixed) (P8a)
    title: "output field changed from String to a custom scalar",
    before: "type Event { at: String }",
    after: "type Event { at: DateTime } scalar DateTime",
    rationale:
      "GraphQL types are nominal: clients typed against String receive a custom scalar with its own serialization",
    annotation: "names the type and the field (Event.at) and the type change",
    sources: [
      fork("test/graphapi.diff.test.ts new types in output: built-in scalar -> custom scalar"),
      asd("test/graphapi/classification.test.ts changing a field type from String to a custom scalar is breaking"),
      asd("test/graphapi/graphapi10.test.ts G10.9"),
    ],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [ev("at: String"), ev("at: DateTime", "scalar DateTime")],
    expect: [
      {
        at: ["queries/event/**/at/**", "components/objects/Event/**/at/**"],
        type: breaking,
        mentions: ["Event", "at"],
      },
      { at: "components/scalars/DateTime", action: "add", type: nonBreaking, mentions: ["DateTime"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-004",
    // ISSUE-127 (fixed) (P8a)
    title: "output field changed from one custom scalar to another",
    before: "type Event { at: Date } scalar Date",
    after: "type Event { at: DateTime } scalar DateTime",
    rationale: "the value has another nominal type and serialization",
    annotation: "names the type and the field (Event.at) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in output: custom scalar -> another custom scalar")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [ev("at: Date", "scalar Date"), ev("at: DateTime", "scalar DateTime")],
    expect: [
      {
        at: ["queries/event/**/at/**", "components/objects/Event/**/at/**"],
        type: breaking,
        mentions: ["Event", "at"],
      },
      { at: "components/scalars/Date", action: "remove", type: breaking, mentions: ["Date"], optional: true },
      { at: "components/scalars/DateTime", action: "add", type: nonBreaking, mentions: ["DateTime"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-005",
    // ISSUE-127 (fixed) (P8a)
    title: "output field changed from a custom scalar to String",
    before: "type Event { at: DateTime } scalar DateTime",
    after: "type Event { at: String }",
    rationale: "clients decoding the custom scalar receive an arbitrary string",
    annotation: "names the type and the field (Event.at) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in output: custom scalar -> built-in scalar")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [ev("at: DateTime", "scalar DateTime"), ev("at: String")],
    expect: [
      {
        at: ["queries/event/**/at/**", "components/objects/Event/**/at/**"],
        type: breaking,
        mentions: ["Event", "at"],
      },
      { at: "components/scalars/DateTime", action: "remove", type: breaking, mentions: ["DateTime"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-006",
    title: "argument changed from String to a custom scalar",
    before: "events(since: String)",
    after: "events(since: DateTime) scalar DateTime",
    rationale: "variables declared `$s: String` no longer match the argument type",
    annotation: "names the field and the argument (Query.events since) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in arguments: built-in scalar -> custom scalar")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [arg("since: String"), arg("since: DateTime", "scalar DateTime")],
    expect: [
      { at: "queries/events/args/**", type: breaking, mentions: ["events", "since"] },
      { at: "components/scalars/DateTime", action: "add", type: nonBreaking, mentions: ["DateTime"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-007",
    title: "argument changed from a custom scalar to String",
    before: "events(since: DateTime) scalar DateTime",
    after: "events(since: String)",
    rationale: "variables declared `$s: DateTime` no longer match the argument type",
    annotation: "names the field and the argument (Query.events since) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in arguments: custom scalar -> built-in scalar")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [arg("since: DateTime", "scalar DateTime"), arg("since: String")],
    expect: [
      { at: "queries/events/args/**", type: breaking, mentions: ["events", "since"] },
      { at: "components/scalars/DateTime", action: "remove", type: breaking, mentions: ["DateTime"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-008",
    title: "argument changed from one custom scalar to another",
    before: "events(since: Date) scalar Date",
    after: "events(since: DateTime) scalar DateTime",
    rationale: "variables declared `$s: Date` no longer match the argument type",
    annotation: "names the field and the argument (Query.events since) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in arguments: custom scalar -> another custom scalar")],
    covers: ["gi:FIELD_ARGUMENT_TYPE_CHANGED"],
    sdl: [arg("since: Date", "scalar Date"), arg("since: DateTime", "scalar DateTime")],
    expect: [
      { at: "queries/events/args/**", type: breaking, mentions: ["events", "since"] },
      { at: "components/scalars/Date", action: "remove", type: breaking, mentions: ["Date"], optional: true },
      { at: "components/scalars/DateTime", action: "add", type: nonBreaking, mentions: ["DateTime"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-009",
    // ISSUE-127 (fixed) (P8a)
    title: "custom scalar list item type changed ([Date] to [DateTime])",
    before: "type Event { days: [Date] } scalar Date",
    after: "type Event { days: [DateTime] } scalar DateTime",
    rationale: "list items have another nominal type",
    annotation: "names the type and the field (Event.days) and the type change",
    sources: [fork("test/graphapi.diff.test.ts new types in output: custom scalar -> array of another custom scalar")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [ev("days: [Date]", "scalar Date"), ev("days: [DateTime]", "scalar DateTime")],
    expect: [
      {
        at: ["queries/event/**/days/**", "components/objects/Event/**/days/**"],
        type: breaking,
        mentions: ["Event", "days"],
      },
      { at: "components/scalars/Date", action: "remove", type: breaking, mentions: ["Date"], optional: true },
      { at: "components/scalars/DateTime", action: "add", type: nonBreaking, mentions: ["DateTime"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-010",
    // ISSUE-127 (fixed) (P8a)
    title: "output field Boolean to String",
    before: "type Event { open: Boolean }",
    after: "type Event { open: String }",
    rationale: "clients parsing a boolean receive a string",
    annotation: "names the type and the field (Event.open) and the type change",
    sources: [giChange("field.ts FIELD_TYPE_CHANGED")],
    covers: ["gi:FIELD_TYPE_CHANGED"],
    sdl: [ev("open: Boolean"), ev("open: String")],
    expect: [
      {
        at: ["queries/event/**/open/**", "components/objects/Event/**/open/**"],
        type: breaking,
        mentions: ["Event", "open"],
      },
    ],
  }),
  gql({
    id: "GQL-SCL-011",
    // ISSUE-127 (fixed) (P8a)
    title: "@specifiedBy added to a custom scalar",
    before: "scalar DateTime",
    after: 'scalar DateTime @specifiedBy(url: "https://tools.ietf.org/html/rfc3339")',
    rationale: "@specifiedBy documents the scalar's specification; operations and responses are unchanged",
    annotation: "names the scalar (DateTime) and the specification URL",
    sources: [
      giChange("directive-usage.ts DIRECTIVE_USAGE_SCALAR_ADDED", "DANGEROUS"),
      asd("test/graphapi/classification.test.ts changing @specifiedBy url is an annotation"),
    ],
    covers: [],
    sdl: [
      ev("at: DateTime", "scalar DateTime"),
      ev("at: DateTime", 'scalar DateTime @specifiedBy(url: "https://tools.ietf.org/html/rfc3339")'),
    ],
    expect: [{ at: "**", action: "add", type: annotation, mentions: ["DateTime", "specifiedBy"] }],
  }),
  gql({
    id: "GQL-SCL-012",
    // ISSUE-127 (fixed) (P8-rest); ISSUE-128 (fixed) (P8a)
    title: "@specifiedBy URL changed",
    before: 'scalar DateTime @specifiedBy(url: "https://a.example/spec")',
    after: 'scalar DateTime @specifiedBy(url: "https://b.example/spec")',
    rationale: "@specifiedBy documents the scalar's specification; operations and responses are unchanged",
    annotation: "names the scalar (DateTime) and the new specification URL",
    sources: [
      asd("test/graphapi/classification.test.ts changing @specifiedBy url is an annotation"),
      fork("test/graphapi.diff.test.ts Directives test: specifiedBy directive test"),
    ],
    sdl: [
      ev("at: DateTime", 'scalar DateTime @specifiedBy(url: "https://a.example/spec")'),
      ev("at: DateTime", 'scalar DateTime @specifiedBy(url: "https://b.example/spec")'),
    ],
    expect: [{ at: "**", type: annotation, mentions: ["DateTime", "b.example"] }],
  }),
  gql({
    id: "GQL-SCL-013",
    // ISSUE-127 (fixed) (P8a)
    title: "@specifiedBy removed from a custom scalar",
    before: 'scalar DateTime @specifiedBy(url: "https://a.example/spec")',
    after: "scalar DateTime",
    rationale: "@specifiedBy documents the scalar's specification; operations and responses are unchanged",
    annotation: "names the scalar (DateTime) and the specification URL",
    sources: [giChange("directive-usage.ts DIRECTIVE_USAGE_SCALAR_REMOVED", "DANGEROUS")],
    sdl: [
      ev("at: DateTime", 'scalar DateTime @specifiedBy(url: "https://a.example/spec")'),
      ev("at: DateTime", "scalar DateTime"),
    ],
    expect: [{ at: "**", action: "remove", type: annotation, mentions: ["DateTime", "specifiedBy"] }],
  }),
  gql({
    id: "GQL-SCL-014",
    // ISSUE-127 (fixed) (P8a)
    title: "custom scalar used by an input field changed to another scalar",
    before: "input EventFilter { since: Date } scalar Date",
    after: "input EventFilter { since: String }",
    rationale: "variables declared `$s: Date` for `since` no longer match",
    annotation: "names the input type and the field (EventFilter.since) and the type change",
    sources: [giChange("input.ts INPUT_FIELD_TYPE_CHANGED")],
    covers: ["gi:INPUT_FIELD_TYPE_CHANGED"],
    sdl: [
      arg("filter: EventFilter", "input EventFilter { since: Date } scalar Date"),
      arg("filter: EventFilter", "input EventFilter { since: String }"),
    ],
    expect: [
      {
        at: ["queries/events/args/**", "components/inputObjects/EventFilter/**"],
        type: breaking,
        mentions: ["EventFilter", "since"],
      },
      { at: "components/scalars/Date", action: "remove", type: breaking, mentions: ["Date"], optional: true },
    ],
  }),
  gql({
    id: "GQL-SCL-015",
    title: "custom scalar used as input and output: definition unchanged (not a change)",
    before: "scalar Date used by Event.day and events(day:)",
    after: "the same SDL with the scalar declared first",
    rationale: "definition order is presentation; the schema is the same",
    annotation: "no diff",
    sources: [gi("schema.test.ts same schema")],
    sdl: [
      "type Query { events(day: Date): [Event] } type Event { day: Date } scalar Date",
      "scalar Date type Event { day: Date } type Query { events(day: Date): [Event] }",
    ],
    expect: [],
  }),
]

runCases("graphql", "scalars", cases, import.meta.filename)
