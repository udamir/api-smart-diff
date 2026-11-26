import { type Diff, type NodeContext } from "../../src"
import { buildPath, getCompareId, getTarget, isCycleRef } from "../../src/jsonSchema"
import {
  componentKindWord,
  createAnnotation,
  createContainerLocator,
  fallbackAnnotation,
  FREE_TEXT_LENGTH,
  MAX_STRING_LENGTH,
  formatText,
  formatValue,
  isFreeTextKey,
  withContainer,
  getParentContext,
} from "../../src/core"
import { getBooleanValue, getKeyValue, getNumberValue, isNumber, joinPath, typeOf } from "../../src/utils"

describe("Block A6 — annotation template engine", () => {
  const dict = {
    add: "[Added] {{text}}",
    add_target: "[Added] {{text}} to `{{target}}`",
    add_target_schema: "[Added] {{text}} to `{{target}}` of `{{schema}}`",
    property: "property `{{key}}`",
  }

  it("A6.1 renders a template with params", () => {
    expect(createAnnotation({ template: "add", params: { text: "x" } }, dict)).toBe("[Added] x")
  })

  it("A6.2 renders nested templates used as params", () => {
    const template = { template: "add", params: { text: { template: "property", params: { key: "id" } } } }
    expect(createAnnotation(template, dict)).toBe("[Added] property `id`")
  })

  it("A6.3 picks the most specific `key_param` variant whose params are all present and non-empty", () => {
    expect(createAnnotation({ template: "add", params: { text: "x", target: "t" } }, dict)).toBe("[Added] x to `t`")
    expect(createAnnotation({ template: "add", params: { text: "x", target: "t", schema: "s" } }, dict)).toBe(
      "[Added] x to `t` of `s`",
    )
    expect(createAnnotation({ template: "add", params: { text: "x", target: "" } }, dict)).toBe("[Added] x")
  })

  it("A6.4 returns an empty string for a missing template or missing input", () => {
    expect(createAnnotation(undefined, dict)).toBe("")
    expect(createAnnotation({ template: "nope" }, dict)).toBe("")
  })

  // ISSUE-28 (fixed): params that exist with an undefined value are stringified as "undefined".
  it("A6.5 does not print 'undefined' for params that have no value", () => {
    const text = createAnnotation({ template: "add", params: { text: undefined } }, dict)
    expect(text).not.toContain("undefined")
  })

  // ISSUE-28 (fixed): placeholders without a param are left as raw `{{text}}` in the final description.
  it("A6.6 does not leak raw placeholders when a param is missing", () => {
    expect(createAnnotation({ template: "add", params: {} }, dict)).not.toContain("{{")
  })

  it("A6.7 replaces repeated placeholders of the same param", () => {
    expect(createAnnotation({ template: "twice", params: { a: "x" } }, { twice: "{{a}}-{{a}}" })).toBe("x-x")
  })

  // P8a (DESIGN_PROPOSALS §4.5, §12.18): a template renders only when every placeholder resolves
  it("A6.8 a template with an unresolved placeholder or nested template does not render", () => {
    expect(
      createAnnotation(
        { template: "add_target", params: { text: "x" } },
        { add_target: "[Added] {{text}} to {{target}}" },
      ),
    ).toBe("")
    expect(createAnnotation({ template: "add", params: { text: { template: "missing" } } }, dict)).toBe("")
  })

  // ISSUE-145 (fixed) (P8a): the `annotation` template is used for annotation diffs only
  it("A6.9 the `annotation` template becomes the `keyword` template for a change of another class", () => {
    const template = { template: "add", params: { text: { template: "annotation", params: { key: "title" } } } }
    const d = { ...dict, annotation: "annotation ({{key}})" }
    expect(createAnnotation(template, d, "annotation")).toBe("[Added] annotation (title)")
    expect(createAnnotation(template, d, "unclassified")).toBe("[Added] `title`")
    expect(createAnnotation(template, { ...d, keyword: "keyword {{key}}" }, "breaking")).toBe("[Added] keyword title")
  })

  it("A6.10 formatValue renders values in backticks and summarizes long ones", () => {
    expect(formatValue("gamma")).toBe("`gamma`")
    expect(formatValue(2)).toBe("`2`")
    expect(formatValue(null)).toBe("`null`")
    expect(formatValue({ a: 2 })).toBe('`{"a":2}`')
    expect(formatValue(["a", "b"])).toBe('`["a","b"]`')
    expect(formatValue(Array.from({ length: 30 }, (_, i) => `value-${i}`))).toBe(
      "[`value-0`, `value-1`, `value-2`, `value-3`, `value-4`, …] (30 items)",
    )
    expect(formatValue("a`b")).toBe("`a'b`")
    // a string that reads like another value is quoted
    expect(formatValue("1")).toBe('`"1"`')
    expect(formatValue("")).toBe('`""`')
  })

  it("A6.11 the fallback names the key, the path inside the nearest container and the values", () => {
    const locate = createContainerLocator([{ at: ["channels", "*"], name: ([channel]) => `channel \`${channel}\`` }])
    const ctx = (before: unknown, after: unknown) =>
      ({ before: { value: before, root: {} }, after: { value: after, root: {} }, scope: "root" }) as never
    const replace = {
      action: "replace",
      path: ["channels", "a", "bindings", "ws", "method"],
      type: "unclassified",
    } as Diff
    expect(fallbackAnnotation(replace, ctx("GET", "POST"), locate)).toBe(
      "[Replaced] `method` of bindings.ws in channel `a` from `GET` to `POST`",
    )
    const add = { action: "add", path: ["channels", "b"], type: "non-breaking" } as Diff
    expect(fallbackAnnotation(add, ctx(undefined, {}), locate)).toBe("[Added] channel `b`")
    const item = { action: "add", path: ["channels", "a", "tags", 1], type: "annotation" } as Diff
    expect(fallbackAnnotation(item, ctx(undefined, { name: "beta" }), locate)).toBe(
      "[Added] item [1] `beta` to tags in channel `a`",
    )
    expect(fallbackAnnotation(replace, ctx("GET", "POST"))).toBe(
      "[Replaced] `method` of channels.a.bindings.ws from `GET` to `POST`",
    )
  })

  it("A6.12 withContainer appends the container unless the text names it", () => {
    const container = { name: "object type `User`", length: 3 }
    expect(withContainer("[Added] field `age`", container)).toBe("[Added] field `age` in object type `User`")
    expect(withContainer("[Added] field `age` of `User`", container)).toBe("[Added] field `age` of `User`")
    expect(withContainer("", container)).toBe("")
  })

  it("A6.13 componentKindWord names a components map key", () => {
    expect(componentKindWord("securitySchemes")).toBe("security scheme")
    expect(componentKindWord("requestBodies")).toBe("request body")
    expect(componentKindWord("correlationIds")).toBe("correlation ID")
    expect(componentKindWord("schemas")).toBe("schema")
  })

  // POLICY-95 decided (c): free text is listed shortened (about 60 characters and "…"), on one line
  it("A6.14 formatText shortens free text; formatValue keeps other strings complete", () => {
    expect(FREE_TEXT_LENGTH).toBe(60)
    // short text unchanged
    expect(formatText("List pets")).toBe("`List pets`")
    // exactly at the limit: no ellipsis
    const exact = "x".repeat(60)
    expect(formatText(exact)).toBe(`\`${exact}\``)
    // one character over the limit, no word boundary: cut at the limit
    expect(formatText(`${exact}y`)).toBe(`\`${exact}…\``)
    // long text: cut at the last word boundary within the limit
    const long = "Returns all pets from the system that the user has access to, ordered by name"
    expect(formatText(long)).toBe("`Returns all pets from the system that the user has access…`")
    expect(formatText(long).length).toBeLessThanOrEqual(60 + 3)
    // multi-line text: whitespace runs (newlines included) collapsed, then shortened
    expect(formatText("First line.\n\n  Second   line.\r\n\tThird.")).toBe("`First line. Second line. Third.`")
    expect(formatText(`${"word ".repeat(20)}\nend`)).toBe(`\`${"word ".repeat(12).trim()}…\``)
    // a blank text after collapsing is quoted like an empty string; backticks become quotes
    expect(formatText(" \n ")).toBe('`""`')
    expect(formatText("use `limit`")).toBe("`use 'limit'`")
    // values of other kinds are rendered as by formatValue
    expect(formatText(2)).toBe("`2`")
    expect(formatText(undefined)).toBe("")
    // identifiers, URLs and enum values are never shortened
    const url = `https://example.com/${"segment/".repeat(10)}token`
    expect(formatValue(url)).toBe(`\`${url}\``)
    expect(formatValue("a\nb")).toBe("`a\nb`")
    expect(formatValue(long, 20)).toBe("`Returns all pets…`")
  })

  // POLICY-108 decided (changed, P8d): the 60-character free-text rule stays; every other string value is capped at 200
  // characters and "…"
  it("A6.17 formatValue caps other string values at 200 characters", () => {
    expect(MAX_STRING_LENGTH).toBe(200)
    // at the limit: unchanged; one over: cut at the limit (no word boundary)
    const exact = "a".repeat(200)
    expect(formatValue(exact)).toBe(`\`${exact}\``)
    expect(formatValue(`${exact}b`)).toBe(`\`${exact}…\``)
    // a long text that is not free text: cut at the last word boundary within the limit, its lines kept
    const words = `${"lorem ipsum\n".repeat(30)}end`
    const capped = formatValue(words)
    expect(capped.endsWith("…`")).toBe(true)
    expect(capped.length).toBeLessThanOrEqual(200 + 3)
    expect(capped).toContain("\n")
    expect(words.startsWith(capped.slice(1, -2))).toBe(true)
    // identifiers and URLs of usual length stay complete; free text keeps its 60-character limit
    const url = `https://example.com/${"segment/".repeat(20)}token`
    expect(url.length).toBeLessThan(200)
    expect(formatValue(url)).toBe(`\`${url}\``)
    expect(formatText(exact)).toBe(`\`${"a".repeat(60)}…\``)
    // strings inside a summarized array are capped as well
    const items = formatValue([exact + exact, "b", "c"])
    expect(items).toBe(`[\`${exact}…\`, \`b\`, \`c\`] (3 items)`)
  })

  it("A6.15 isFreeTextKey names the free-text fields", () => {
    for (const key of ["description", "summary", "title", "$comment"]) {
      expect(isFreeTextKey(key)).toBe(true)
    }
    for (const key of ["name", "url", "operationId", "enum", "default", 0, undefined]) {
      expect(isFreeTextKey(key)).toBe(false)
    }
  })

  it("A6.16 the fallback lists a free-text value shortened", () => {
    const ctx = (before: unknown, after: unknown) =>
      ({ before: { value: before, root: {} }, after: { value: after, root: {} }, scope: "root" }) as never
    const long = "A long explanation of the channel that is written over several lines.\nAnd more."
    const replace = { action: "replace", path: ["channels", "a", "description"], type: "annotation" } as Diff
    expect(fallbackAnnotation(replace, ctx("Old text", long))).toBe(
      "[Replaced] `description` of channels.a from `Old text` to `A long explanation of the channel that is written over…`",
    )
    const name = { action: "replace", path: ["channels", "a", "name"], type: "annotation" } as Diff
    expect(fallbackAnnotation(name, ctx("a", long))).toContain("And more.")
  })
})

describe("Block A7 — utilities", () => {
  describe("type guards and getters", () => {
    it("A7.1 isNumber accepts numbers and numeric strings", () => {
      expect(isNumber(1)).toBe(true)
      expect(isNumber("12")).toBe(true)
      expect(isNumber("abc")).toBe(false)
    })

    // ISSUE-27 (fixed): `+"" === 0` so the empty string is treated as numeric.
    it("A7.2 isNumber rejects the empty string", () => {
      expect(isNumber("")).toBe(false)
    })

    it("A7.3 getKeyValue walks objects and arrays and returns undefined for missing paths", () => {
      const obj = { a: [{ b: 1 }], c: null }
      expect(getKeyValue(obj, "a", 0, "b")).toBe(1)
      expect(getKeyValue(obj, "a", "0", "b")).toBe(1)
      expect(getKeyValue(obj, "a", 5)).toBeUndefined()
      expect(getKeyValue(obj, "c", "x")).toBeUndefined()
      expect(getKeyValue(obj, "missing")).toBeUndefined()
      expect(getKeyValue(obj)).toBe(obj)
      expect(getKeyValue(1, "a")).toBeUndefined()
    })

    // ISSUE-27 (fixed): `Boolean("false") === true`.
    it("A7.4 getBooleanValue parses the string 'false' as false", () => {
      expect(getBooleanValue({ a: "false" }, "a")).toBe(false)
    })

    it("A7.5 getBooleanValue returns booleans and undefined for other values", () => {
      expect(getBooleanValue({ a: true }, "a")).toBe(true)
      expect(getBooleanValue({ a: "yes" }, "a")).toBeUndefined()
    })

    // ISSUE-27 (fixed): `+"0"` is falsy so numeric string "0" is dropped.
    it("A7.6 getNumberValue parses the string '0'", () => {
      expect(getNumberValue({ a: "0" }, "a")).toBe(0)
    })

    it("A7.7 typeOf distinguishes arrays, null and primitives", () => {
      expect(typeOf([])).toBe("array")
      expect(typeOf(null)).toBe("null")
      expect(typeOf(undefined)).toBe("null")
      expect(typeOf({})).toBe("object")
      expect(typeOf("s")).toBe("string")
    })
  })

  describe("paths", () => {
    it("A7.8 joinPath treats an empty segment as 'go to parent'", () => {
      expect(joinPath(["a", "b"], ["", "c"])).toEqual(["a", "c"])
      expect(joinPath(["a"], ["", ""])).toEqual([])
      expect(joinPath([], ["x"], ["y"])).toEqual(["x", "y"])
    })

    it("A7.9 buildPath escapes '/' in JSON pointer segments", () => {
      expect(buildPath(["paths", "/pets/{id}"])).toBe("/paths/~1pets~1{id}")
      expect(buildPath([])).toBe("/")
    })

    // ISSUE-27 (fixed): RFC 6901 requires '~' to be escaped as '~0' (before '/' -> '~1'); keys containing '~1' collide
    // with keys containing '/'.
    it("A7.10 buildPath escapes '~' in JSON pointer segments", () => {
      expect(buildPath(["a~b"])).toBe("/a~0b")
      expect(buildPath(["a~1b"])).not.toBe(buildPath(["a/b"]))
    })

    it("A7.11 getTarget renders a human readable property path", () => {
      expect(getTarget(["properties", "a", "properties", "b"])).toBe("a.b")
      expect(getTarget(["properties", "a", "items", "properties", "b"])).toBe("a[].b")
      expect(getTarget(["items", 0, "properties", "b"])).toBe("[0].b")
      expect(getTarget(["additionalProperties", "properties", "b"])).toBe("{.*}.b")
      expect(getTarget(["patternProperties", "^x", "type"])).toBe("{^x}")
      expect(getTarget(["type"])).toBeUndefined()
    })

    it("A7.12 getParentContext navigates relative to the current node", () => {
      const root = { properties: { a: { type: "string" } }, required: ["a"] }
      const ctx: NodeContext = { path: ["properties", "a", "type"], key: "type", value: "string", root }

      // the current key is dropped first, then every "" segment goes one level further up
      expect(getParentContext(ctx)?.value).toEqual({ type: "string" })
      expect(getParentContext(ctx, "")?.value).toEqual(root.properties)
      expect(getParentContext(ctx, "", "", "required")?.value).toEqual(["a"])
      expect(getParentContext(ctx, "", "")?.value).toBe(root)
      expect(getParentContext(ctx, "nope")).toBeUndefined()
    })
  })

  describe("$ref helpers", () => {
    it("A7.13 getCompareId joins differing refs", () => {
      expect(getCompareId("#/a", "#/a")).toBe("#/a")
      expect(getCompareId("#/a", "#/b")).toBe("#/a:#/b")
    })

    it("A7.14 isCycleRef detects a node inside the expansion of the same $ref", () => {
      expect(isCycleRef("#/defs/X", "#/defs/X/properties/child", {})).toBe(true)
      expect(isCycleRef("#/defs/X", "#/properties/a/properties/b", { "#/defs/X": ["#/properties/a"] })).toBe(true)
      expect(isCycleRef("", "#/anything", {})).toBe(false)
      expect(isCycleRef("#/defs/X", "#/properties/b", { "#/defs/X": ["#/properties/a"] })).toBe(false)
    })

    // ISSUE-07 (fixed): cycle detection compares string prefixes, not path segments.
    it("A7.15 isCycleRef does not treat a sibling key with a shared prefix as a cycle", () => {
      expect(isCycleRef("#/defs/X", "#/properties/ab", { "#/defs/X": ["#/properties/a"] })).toBe(false)
      expect(isCycleRef("#/defs/Pet", "#/defs/PetList/items", {})).toBe(false)
    })
  })
})
