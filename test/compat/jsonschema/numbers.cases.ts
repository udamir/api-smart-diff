// JSON Schema numeric keywords: minimum, maximum, exclusiveMinimum / exclusiveMaximum (2020-12 numeric form and the
// OpenAPI 3.0 / draft-04 boolean form), multipleOf.

import { annotation, breaking, nonBreaking } from "../../../src"
import { type SchemaCase, risky } from "../../helpers/compat"
import { body, both, kwRe, property, rr, seq, withJsd } from "./kw"

const id = seq("NUM")
const general = "test/compatibility-suites/schemas/schema-test-runner-general.ts"
const oasOnly = "test/compatibility-suites/schemas/schema-test-runner-openapi-only.ts"
const cs = (name: string, verdict?: string, runner = general) => [
  { tool: "compat-suites", ref: `schemas/json-schema/${name}` },
  { tool: "fork", ref: `${runner} ${name}`, ...(verdict ? { verdict } : {}) },
]
const num = (extra: Record<string, unknown> = {}) => ({ type: "number", ...extra })

// POLICY-05 decided (b): a loosened response bound is risky (a client that validates or sizes by the old range can
// fail; fork risky, oasdiff ERR); the request keeps its definite class

const EFF = "ISSUE-88"

const own: SchemaCase[] = [
  ...both({
    id: id(2),
    title: "minimum set",
    before: "number",
    after: "number, minimum 0",
    rationale: "request: negative values become invalid; response: clients receive a subset of the old values",
    annotation: "names the keyword (minimum) and the location",
    sources: cs("add-minimum-for-number-property"),
    stems: ["min-set"],
    schema: [num(), num({ minimum: 0 })],
    expect: [{ at: "minimum", action: "add", type: rr(breaking, nonBreaking), mentions: ["minimum"] }],
  }),
  ...both({
    id: id(2),
    title: "minimum unset",
    before: "number, minimum 0",
    after: "number",
    rationale:
      "request: accepts more values; response: negative values can be returned to clients that never handled them",
    annotation: "names the keyword (minimum) and the location",
    sources: cs("remove-minimum-for-number-property"),
    schema: [num({ minimum: 0 }), num()],
    expect: [{ at: "minimum", action: "remove", type: rr(nonBreaking, risky), mentions: ["minimum"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "minimum increased",
    before: "number, minimum 0",
    after: "number, minimum 10",
    rationale: "request: values 0..9 become invalid; response: clients receive a subset",
    annotation: "names the keyword (minimum) and the location",
    sources: cs("increase-minimum-for-number-property"),
    stems: ["min-increased"],
    schema: [num({ minimum: 0 }), num({ minimum: 10 })],
    expect: [{ at: "minimum", action: "replace", type: rr(breaking, nonBreaking), mentions: ["minimum"] }],
  }),
  ...both({
    id: id(2),
    title: "minimum decreased",
    before: "number, minimum 10",
    after: "number, minimum 0",
    rationale: "request: accepts more values; response: smaller values than before can be returned",
    annotation: "names the keyword (minimum) and the location",
    sources: cs("decrease-minimum-for-number-property"),
    stems: ["min-decreased"],
    schema: [num({ minimum: 10 }), num({ minimum: 0 })],
    expect: [{ at: "minimum", action: "replace", type: rr(nonBreaking, risky), mentions: ["minimum"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "maximum set",
    before: "number",
    after: "number, maximum 100",
    rationale: "request: values above 100 become invalid; response: clients receive a subset",
    annotation: "names the keyword (maximum) and the location",
    sources: cs("add-maximum-for-number-property"),
    stems: ["max-set"],
    schema: [num(), num({ maximum: 100 })],
    expect: [{ at: "maximum", action: "add", type: rr(breaking, nonBreaking), mentions: ["maximum"] }],
  }),
  ...both({
    id: id(2),
    title: "maximum unset",
    before: "number, maximum 100",
    after: "number",
    rationale: "request: accepts more values; response: values above the old maximum can be returned",
    annotation: "names the keyword (maximum) and the location",
    sources: cs("remove-maximum-for-number-property"),
    schema: [num({ maximum: 100 }), num()],
    expect: [{ at: "maximum", action: "remove", type: rr(nonBreaking, risky), mentions: ["maximum"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "maximum increased",
    before: "number, maximum 100",
    after: "number, maximum 200",
    rationale: "request: accepts more values; response: larger values than before can be returned (oasdiff ERR)",
    annotation: "names the keyword (maximum) and the location",
    sources: cs("increase-maximum-for-number-property"),
    stems: ["max-increased"],
    schema: [num({ maximum: 100 }), num({ maximum: 200 })],
    expect: [{ at: "maximum", action: "replace", type: rr(nonBreaking, risky), mentions: ["maximum"] }],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "maximum decreased",
    before: "number, maximum 200",
    after: "number, maximum 100",
    rationale: "request: values 101..200 become invalid; response: clients receive a subset",
    annotation: "names the keyword (maximum) and the location",
    sources: cs("decrease-maximum-for-number-property"),
    stems: ["max-decreased"],
    schema: [num({ maximum: 200 }), num({ maximum: 100 })],
    expect: [{ at: "maximum", action: "replace", type: rr(breaking, nonBreaking), mentions: ["maximum"] }],
  }),
  ...both({
    id: id(2),
    title: "exclusiveMinimum set (2020-12 numeric form)",
    before: "number",
    after: "number, exclusiveMinimum 0",
    rationale: "request: values <= 0 become invalid; response: clients receive a subset",
    annotation: "names the keyword (exclusiveMinimum) and the location",
    sources: cs("add-exclusive-minimum"),
    stems: ["exclusive-min-set"],
    schema: [num(), num({ exclusiveMinimum: 0 })],
    expect: [
      { at: "exclusiveMinimum", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("exclusiveMinimum")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "exclusiveMinimum removed (2020-12 numeric form)",
    before: "number, exclusiveMinimum 0",
    after: "number",
    rationale: "request: accepts more values; response: values <= 0 can be returned",
    annotation: "names the keyword (exclusiveMinimum) and the location",
    sources: cs("remove-exclusive-minimum"),
    schema: [num({ exclusiveMinimum: 0 }), num()],
    expect: [
      {
        at: "exclusiveMinimum",
        action: "remove",
        type: rr(nonBreaking, risky),
        mentions: [kwRe("exclusiveMinimum")],
      },
    ],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "exclusiveMinimum increased",
    before: "number, exclusiveMinimum 0",
    after: "number, exclusiveMinimum 10",
    rationale: "request: values in (0, 10] become invalid; response: clients receive a subset",
    annotation: "names the keyword (exclusiveMinimum) and the location",
    sources: cs("increase-exclusive-minimum-value"),
    stems: ["exclusive-min-increased"],
    schema: [num({ exclusiveMinimum: 0 }), num({ exclusiveMinimum: 10 })],
    expect: [
      {
        at: "exclusiveMinimum",
        action: "replace",
        type: rr(breaking, nonBreaking),
        mentions: [kwRe("exclusiveMinimum")],
      },
    ],
  }),
  ...both({
    id: id(2),
    title: "exclusiveMinimum decreased",
    before: "number, exclusiveMinimum 10",
    after: "number, exclusiveMinimum 0",
    rationale: "request: accepts more values; response: smaller values than before can be returned",
    annotation: "names the keyword (exclusiveMinimum) and the location",
    sources: cs("decrease-exclusive-minimum-value"),
    stems: ["exclusive-min-decreased"],
    schema: [num({ exclusiveMinimum: 10 }), num({ exclusiveMinimum: 0 })],
    expect: [
      {
        at: "exclusiveMinimum",
        action: "replace",
        type: rr(nonBreaking, risky),
        mentions: [kwRe("exclusiveMinimum")],
      },
    ],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "exclusiveMaximum set (2020-12 numeric form)",
    before: "number",
    after: "number, exclusiveMaximum 100",
    rationale: "request: values >= 100 become invalid; response: clients receive a subset",
    annotation: "names the keyword (exclusiveMaximum) and the location",
    sources: cs("add-exclusive-maximum"),
    stems: ["exclusive-max-set"],
    schema: [num(), num({ exclusiveMaximum: 100 })],
    expect: [
      { at: "exclusiveMaximum", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("exclusiveMaximum")] },
    ],
  }),
  ...both({
    id: id(2),
    title: "exclusiveMaximum removed (2020-12 numeric form)",
    before: "number, exclusiveMaximum 100",
    after: "number",
    rationale: "request: accepts more values; response: values >= 100 can be returned",
    annotation: "names the keyword (exclusiveMaximum) and the location",
    sources: cs("remove-exclusive-maximum"),
    schema: [num({ exclusiveMaximum: 100 }), num()],
    expect: [
      {
        at: "exclusiveMaximum",
        action: "remove",
        type: rr(nonBreaking, risky),
        mentions: [kwRe("exclusiveMaximum")],
      },
    ],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "exclusiveMaximum increased",
    before: "number, exclusiveMaximum 100",
    after: "number, exclusiveMaximum 200",
    rationale: "request: accepts more values; response: larger values than before can be returned (oasdiff ERR)",
    annotation: "names the keyword (exclusiveMaximum) and the location",
    sources: cs("increase-exclusive-maximum-value"),
    stems: ["exclusive-max-increased"],
    schema: [num({ exclusiveMaximum: 100 }), num({ exclusiveMaximum: 200 })],
    expect: [
      {
        at: "exclusiveMaximum",
        action: "replace",
        type: rr(nonBreaking, risky),
        mentions: [kwRe("exclusiveMaximum")],
      },
    ],
    // ISSUE-130 (fixed): POLICY-05 decided (b)
  }),
  ...both({
    id: id(2),
    title: "exclusiveMaximum decreased",
    before: "number, exclusiveMaximum 200",
    after: "number, exclusiveMaximum 100",
    rationale: "request: values in [100, 200) become invalid; response: clients receive a subset",
    annotation: "names the keyword (exclusiveMaximum) and the location",
    sources: cs("decrease-exclusive-maximum-value"),
    stems: ["exclusive-max-decreased"],
    schema: [num({ exclusiveMaximum: 200 }), num({ exclusiveMaximum: 100 })],
    expect: [
      {
        at: "exclusiveMaximum",
        action: "replace",
        type: rr(breaking, nonBreaking),
        mentions: [kwRe("exclusiveMaximum")],
      },
    ],
  }),
  property({
    id: id(),
    title: "inclusive minimum became exclusive (2020-12: minimum 5 -> exclusiveMinimum 5)",
    before: "name: number, minimum 5",
    after: "name: number, exclusiveMinimum 5",
    rationale:
      "the effective lower bound excludes 5 now: request breaking, response non-breaking; the removal of the inclusive keyword only carries the change (fork convention: non-breaking in both directions), the added exclusive bound carries the verdict",
    annotation: "names both keywords and the property",
    sources: cs("change-from-inclusive-minimum-to-exclusive-minimum"),
    schema: [num({ minimum: 5 }), num({ exclusiveMinimum: 5 })],
    expect: [
      { at: "minimum", action: "remove", type: nonBreaking, mentions: ["minimum"] },
      { at: "exclusiveMinimum", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("exclusiveMinimum")] },
    ],
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "exclusive minimum became inclusive (2020-12: exclusiveMinimum 5 -> minimum 5)",
    before: "name: number, exclusiveMinimum 5",
    after: "name: number, minimum 5",
    rationale:
      "the effective lower bound now admits 5: request non-breaking (every old value stays valid), response widened (POLICY-05: risky, as the fork)",
    annotation: "names both keywords and the property",
    sources: cs("change-from-exclusive-minimum-to-inclusive-minimum"),
    schema: [num({ exclusiveMinimum: 5 }), num({ minimum: 5 })],
    expect: [
      { at: "exclusiveMinimum", action: "remove", type: nonBreaking, mentions: [kwRe("exclusiveMinimum")] },
      { at: "minimum", action: "add", type: rr(nonBreaking, risky), mentions: ["minimum"] },
    ],
    // ISSUE-130 (fixed); the response keeps the effective-bound cause
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "inclusive maximum became exclusive (2020-12: maximum 5 -> exclusiveMaximum 5)",
    before: "name: number, maximum 5",
    after: "name: number, exclusiveMaximum 5",
    rationale: "the effective upper bound excludes 5 now: request breaking, response non-breaking",
    annotation: "names both keywords and the property",
    sources: cs("change-from-inclusive-maximum-to-exclusive-maximum"),
    schema: [num({ maximum: 5 }), num({ exclusiveMaximum: 5 })],
    expect: [
      { at: "maximum", action: "remove", type: nonBreaking, mentions: ["maximum"] },
      { at: "exclusiveMaximum", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("exclusiveMaximum")] },
    ],
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "exclusive maximum became inclusive (2020-12: exclusiveMaximum 5 -> maximum 5)",
    before: "name: number, exclusiveMaximum 5",
    after: "name: number, maximum 5",
    rationale:
      "the effective upper bound now admits 5: request non-breaking, response widened (POLICY-05: risky, as the fork)",
    annotation: "names both keywords and the property",
    sources: cs("change-from-exclusive-maximum-to-inclusive-maximum"),
    schema: [num({ exclusiveMaximum: 5 }), num({ maximum: 5 })],
    expect: [
      { at: "exclusiveMaximum", action: "remove", type: nonBreaking, mentions: [kwRe("exclusiveMaximum")] },
      { at: "maximum", action: "add", type: rr(nonBreaking, risky), mentions: ["maximum"] },
    ],
    // ISSUE-130 (fixed); the response keeps the effective-bound cause
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: minimum marked exclusive (exclusiveMinimum: true added)",
    before: "name: number, minimum 5",
    after: "name: number, minimum 5, exclusiveMinimum true",
    rationale:
      "the value 5 becomes invalid: request breaking, response non-breaking; ASD normalizes the boolean form into the numeric one, so the diff may be reported on minimum (carrier, non-breaking) and exclusiveMinimum",
    annotation: "names the exclusive bound and the property",
    sources: [
      ...cs("mark-minimum-value-as-exclusive-for-number-property", undefined, oasOnly),
      { tool: "fork", ref: "test/openapi.exclusive-bounds.test.ts" },
    ],
    covers: ["oasdiff:request-property-exclusive-min-set"],
    dialect: "3.0",
    schema: [num({ minimum: 5 }), num({ minimum: 5, exclusiveMinimum: true })],
    expect: [
      { at: "minimum", action: "remove", type: nonBreaking, mentions: ["minimum"], optional: true },
      { at: "exclusiveMinimum", type: rr(breaking, nonBreaking), mentions: [kwRe("exclusiveMinimum")] },
    ],
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: minimum marked inclusive (exclusiveMinimum: true removed)",
    before: "name: number, minimum 5, exclusiveMinimum true",
    after: "name: number, minimum 5",
    rationale: "the value 5 becomes valid: request non-breaking, response widened (POLICY-05: risky, as the fork)",
    annotation: "names the exclusive bound and the property",
    sources: cs("mark-minimum-value-as-inclusive-for-number-property", undefined, oasOnly),
    dialect: "3.0",
    schema: [num({ minimum: 5, exclusiveMinimum: true }), num({ minimum: 5 })],
    expect: [
      { at: "exclusiveMinimum", type: nonBreaking, mentions: [kwRe("exclusiveMinimum")] },
      { at: "minimum", action: "add", type: rr(nonBreaking, risky), mentions: ["minimum"], optional: true },
    ],
    // ISSUE-130 (fixed); the response keeps the effective-bound cause
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: maximum marked exclusive (exclusiveMaximum: true added)",
    before: "name: number, maximum 5",
    after: "name: number, maximum 5, exclusiveMaximum true",
    rationale: "the value 5 becomes invalid: request breaking, response non-breaking",
    annotation: "names the exclusive bound and the property",
    sources: cs("mark-maximum-value-as-exclusive-for-number-property", undefined, oasOnly),
    covers: ["oasdiff:request-property-exclusive-max-set"],
    dialect: "3.0",
    schema: [num({ maximum: 5 }), num({ maximum: 5, exclusiveMaximum: true })],
    expect: [
      { at: "maximum", action: "remove", type: nonBreaking, mentions: ["maximum"], optional: true },
      { at: "exclusiveMaximum", type: rr(breaking, nonBreaking), mentions: [kwRe("exclusiveMaximum")] },
    ],
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: maximum marked inclusive (exclusiveMaximum: true removed)",
    before: "name: number, maximum 5, exclusiveMaximum true",
    after: "name: number, maximum 5",
    rationale: "the value 5 becomes valid: request non-breaking, response widened (POLICY-05: risky, as the fork)",
    annotation: "names the exclusive bound and the property",
    sources: cs("mark-maximum-value-as-inclusive-for-number-property", undefined, oasOnly),
    dialect: "3.0",
    schema: [num({ maximum: 5, exclusiveMaximum: true }), num({ maximum: 5 })],
    expect: [
      { at: "exclusiveMaximum", type: nonBreaking, mentions: [kwRe("exclusiveMaximum")] },
      { at: "maximum", action: "add", type: rr(nonBreaking, risky), mentions: ["maximum"], optional: true },
    ],
    // ISSUE-130 (fixed); the response keeps the effective-bound cause
    // ISSUE-88 (fixed) (P5)
  }),
  body({
    id: id(),
    title: "OpenAPI 3.0: exclusiveMinimum false -> true",
    before: "number, minimum 5, exclusiveMinimum false",
    after: "number, minimum 5, exclusiveMinimum true",
    rationale: "`exclusiveMinimum: false` is the default, so this is the same narrowing as adding `true`",
    annotation: "names the exclusive bound",
    sources: [{ tool: "fork", ref: "test/openapi.exclusive-bounds.test.ts" }],
    covers: ["oasdiff:request-body-exclusive-min-set"],
    dialect: "3.0",
    scalar: false,
    schema: [num({ minimum: 5, exclusiveMinimum: false }), num({ minimum: 5, exclusiveMinimum: true })],
    expect: [
      { at: "minimum", action: "remove", type: nonBreaking, mentions: ["minimum"], optional: true },
      { at: "exclusiveMinimum", type: rr(breaking, nonBreaking), mentions: [kwRe("exclusiveMinimum")] },
    ],
    // ISSUE-88 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: exclusive minimum value increased (exclusiveMinimum: true kept)",
    before: "name: number, minimum 5, exclusiveMinimum true",
    after: "name: number, minimum 7, exclusiveMinimum true",
    rationale: "the exclusive lower bound moves up: request breaking, response non-breaking",
    annotation: "names the bound and the property",
    sources: [{ tool: "fork", ref: "test/openapi.exclusive-bounds.test.ts" }],
    covers: ["oasdiff:request-property-min-increased"],
    dialect: "3.0",
    schema: [num({ minimum: 5, exclusiveMinimum: true }), num({ minimum: 7, exclusiveMinimum: true })],
    expect: [
      {
        at: ["minimum", "exclusiveMinimum"],
        action: "replace",
        type: rr(breaking, nonBreaking),
        mentions: [/minimum/i],
      },
    ],
  }),
  property({
    id: id(),
    title: "OpenAPI 3.0: exclusiveMinimum: true without a minimum has no effect",
    before: "name: number",
    after: "name: number, exclusiveMinimum true",
    rationale: "draft-04 `exclusiveMinimum` only modifies `minimum`; without it the set of valid values is unchanged",
    annotation: "if reported: an annotation naming the keyword",
    sources: [{ tool: "fork", ref: "test/openapi.exclusive-bounds.test.ts" }],
    dialect: "3.0",
    schema: [num(), num({ exclusiveMinimum: true })],
    expect: [{ at: "exclusiveMinimum", type: annotation, optional: true, mentions: [kwRe("exclusiveMinimum")] }],
    // ISSUE-88 (fixed) (P5)
  }),
  ...both({
    id: id(2),
    title: "multipleOf set",
    before: "number",
    after: "number, multipleOf 5",
    rationale: "request: values that are not multiples of 5 become invalid; response: clients receive a subset",
    annotation: "names the keyword (multipleOf) and the location",
    sources: cs("add-multiple-of-for-number-property"),
    stems: ["multiple-of-set"],
    schema: [num(), num({ multipleOf: 5 })],
    expect: [{ at: "multipleOf", action: "add", type: rr(breaking, nonBreaking), mentions: [kwRe("multipleOf")] }],
  }),
  ...both({
    id: id(2),
    title: "multipleOf unset",
    before: "number, multipleOf 5",
    after: "number",
    rationale: "request: accepts more values; response: values that are not multiples of 5 can be returned",
    annotation: "names the keyword (multipleOf) and the location",
    sources: cs("remove-multiple-of-for-number-property"),
    stems: ["multiple-of-unset"],
    schema: [num({ multipleOf: 5 }), num()],
    expect: [{ at: "multipleOf", action: "remove", type: rr(nonBreaking, breaking), mentions: [kwRe("multipleOf")] }],
  }),
  ...both({
    id: id(2),
    title: "multipleOf changed to a value that is neither a divisor nor a multiple",
    before: "number, multipleOf 2",
    after: "number, multipleOf 3",
    rationale: "the value sets overlap only partially: 4 was valid and is not, 3 is valid and was not",
    annotation: "names the keyword (multipleOf) and the location",
    sources: cs("update-multiple-of-for-number-property"),
    stems: ["multiple-of-changed"],
    schema: [num({ multipleOf: 2 }), num({ multipleOf: 3 })],
    expect: [{ at: "multipleOf", action: "replace", type: breaking, mentions: [kwRe("multipleOf")] }],
    // ISSUE-95 (fixed) (P5)
  }),
  ...both(
    {
      id: id(2),
      title: "multipleOf generalized (4 -> 2)",
      before: "number, multipleOf 4",
      after: "number, multipleOf 2",
      rationale:
        "every multiple of 4 is a multiple of 2: request non-breaking; response: clients can receive 2, 6, ... (oasdiff: response multiple-of-changed)",
      annotation: "names the keyword (multipleOf) and the location",
      sources: [],
      covers: [],
      stems: ["multiple-of-generalized"],
      schema: [num({ multipleOf: 4 }), num({ multipleOf: 2 })],
      expect: [
        { at: "multipleOf", action: "replace", type: rr(nonBreaking, breaking), mentions: [kwRe("multipleOf")] },
      ],
    },
    {
      body: { covers: ["oasdiff:response-body-multiple-of-changed"] },
      property: { covers: ["oasdiff:response-property-multiple-of-changed"] },
    },
  ),
  ...both(
    {
      id: id(2),
      title: "multipleOf specialized (2 -> 4)",
      before: "number, multipleOf 2",
      after: "number, multipleOf 4",
      rationale:
        "request: 2, 6, ... become invalid (oasdiff: request multiple-of-changed); response: clients receive a subset",
      annotation: "names the keyword (multipleOf) and the location",
      sources: [],
      stems: ["multiple-of-specialized"],
      schema: [num({ multipleOf: 2 }), num({ multipleOf: 4 })],
      expect: [
        { at: "multipleOf", action: "replace", type: rr(breaking, nonBreaking), mentions: [kwRe("multipleOf")] },
      ],
    },
    {
      body: { covers: ["oasdiff:request-body-multiple-of-changed"] },
      property: { covers: ["oasdiff:request-property-multiple-of-changed"] },
    },
  ),
  property({
    id: id(),
    title: "multipleOf generalized with decimal steps (0.1 -> 0.01)",
    before: "name: number, multipleOf 0.1",
    after: "name: number, multipleOf 0.01",
    rationale:
      "every multiple of 0.1 is a multiple of 0.01, so this is a generalization; a floating-point remainder (0.1 % 0.01 != 0 in IEEE 754) must not invert the verdict",
    annotation: "names the keyword (multipleOf) and the property",
    sources: [
      {
        tool: "json-schema-diff",
        ref: "test/unit/json-schema-diff/diff-schemas-type-number.spec.ts (numeric precision)",
      },
    ],
    stems: ["multiple-of-generalized"],
    schema: [num({ multipleOf: 0.1 }), num({ multipleOf: 0.01 })],
    expect: [{ at: "multipleOf", action: "replace", type: rr(nonBreaking, breaking), mentions: [kwRe("multipleOf")] }],
    covers: ["oasdiff:response-property-multiple-of-changed"],
    // ISSUE-95 (fixed) (P5)
  }),
  property({
    id: id(),
    title: "minimum increased on an integer property",
    before: "name: integer, minimum 1",
    after: "name: integer, minimum 2",
    rationale: "numeric keywords apply to integers too: request breaking, response non-breaking",
    annotation: "names the keyword (minimum) and the property",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.classify.ts typeClassifier (number includes integer)" }],
    stems: ["min-increased"],
    schema: [
      { type: "integer", minimum: 1 },
      { type: "integer", minimum: 2 },
    ],
    expect: [{ at: "minimum", action: "replace", type: rr(breaking, nonBreaking), mentions: ["minimum"] }],
  }),
  property({
    id: id(),
    title: "maximum set on an untyped schema",
    before: "name: {}",
    after: "name: { maximum: 10 }",
    rationale:
      "the keyword applies to every numeric instance of an untyped schema: request breaking, response non-breaking",
    annotation: "names the keyword (maximum) and the property",
    sources: [{ tool: "json-schema-diff", ref: "test/unit/json-schema-diff/diff-schemas-type-number.spec.ts" }],
    schema: [{}, { maximum: 10 }],
    expect: [{ at: "maximum", action: "add", type: rr(breaking, nonBreaking), mentions: ["maximum"] }],
  }),
  property({
    id: id(),
    title: "minimum added to a string property (keyword not applicable)",
    before: "name: string",
    after: "name: string, minimum 2",
    rationale:
      "numeric keywords do not constrain strings, so the set of valid values is unchanged; ASD reports such changes as unclassified today, oasdiff would still flag min-set",
    annotation: "names the keyword (minimum) and the property",
    sources: [{ tool: "asd", ref: "src/jsonSchema/jsonSchema.classify.ts typeClassifier" }],
    schema: [{ type: "string" }, { type: "string", minimum: 2 }],
    expect: [{ at: "minimum", action: "add", type: annotation, mentions: ["minimum"] }],
    // ISSUE-133 (fixed) (P5) POLICY-10 decided (a)
  }),
]

// Atlassian json-schema-diff test cases (checklist jsd) represented by the cases above
const N = "diff-schemas-type-number"
export const cases = withJsd(own, {
  "JS-NUM-001": [
    [N, "all numbers to number with minimum constraint"],
    [N, "all numbers to numbers with minimum and exclusiveMaximum constraints"],
  ],
  "JS-NUM-005": [[N, "numbers with minimum constraint to more restrictive minimum constraint"]],
  "JS-NUM-009": [
    [N, "all numbers to number with maximum constraint"],
    [N, "all numbers to numbers with maximum and exclusiveMinimum constraints"],
  ],
  "JS-NUM-015": [[N, "numbers with maximum constraint to more restrictive maximum constraint"]],
  "JS-NUM-017": [
    [N, "all numbers to number with exclusiveMinimum constraint"],
    [N, "all numbers to numbers with maximum and exclusiveMinimum constraints"],
  ],
  "JS-NUM-021": [[N, "numbers with exclusiveMinimum constraint to more restrictive exclusiveMinimum constraint"]],
  "JS-NUM-025": [
    [N, "all numbers to number with exclusiveMaximum constraint"],
    [N, "all numbers to numbers with minimum and exclusiveMaximum constraints"],
  ],
  "JS-NUM-031": [[N, "numbers with exclusiveMaximum constraint to more restrictive exclusiveMaximum constraint"]],
})
