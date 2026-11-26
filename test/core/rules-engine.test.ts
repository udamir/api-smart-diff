import {
  type ClassifyRule,
  type ClassifyTuple,
  type CompareRules,
  type Diff,
  allBreaking,
  allNonBreaking,
  annotation,
  breaking,
  compare,
  deprecated,
  nonBreaking,
  reverseClassifyRuleTransformer,
  transformCompareRules,
  unclassified,
} from "../../src"
import { reverseClassifyRule, transformClassifyRule } from "../../src/core"

const metaKey = Symbol("diff")

describe("Block A5 — rules resolution and custom rule hooks", () => {
  describe("rule key resolution (json-crawl semantics)", () => {
    it("A5.1 an exact key rule takes precedence over '/*' and '/**'", () => {
      const rules: CompareRules = {
        "/a": { $: allBreaking },
        "/*": { $: allNonBreaking },
        "/**": { $: [annotation, annotation, annotation] },
      }
      const { diffs } = compare({ a: 1, b: 1 }, { a: 2, b: 2 }, { rules })

      expect(diffs).toMatchObject([
        { path: ["a"], type: breaking },
        { path: ["b"], type: nonBreaking },
      ])
    })

    it("A5.2 '/**' applies to every descendant, '/*' only to direct children", () => {
      const deep = compare({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }, { rules: { "/**": { $: allBreaking } } })
      expect(deep.diffs).toMatchObject([{ path: ["a", "b", "c"], type: breaking }])

      const shallow = compare({ a: { b: 1 }, x: 1 }, { a: { b: 2 }, x: 2 }, { rules: { "/*": { $: allBreaking } } })
      expect(shallow.diffs).toMatchObject([
        { path: ["a", "b"], type: unclassified },
        { path: ["x"], type: breaking },
      ])
    })

    it("A5.3 (characterization) an exact key rule is merged on top of the sibling '/*' rule", () => {
      // json-crawl's getNodeRules spreads `/*` under the exact key, so properties not redefined by the exact rule are
      // inherited from `/*` — rule authors must remember that `/*` leaks into explicitly named siblings.
      const seen: string[] = []
      const rules: CompareRules = {
        "/*": { $: allNonBreaking, annotate: () => ({ template: "fromStar" }) },
        "/a": { $: allBreaking },
      }
      compare(
        { a: 1 },
        { a: 2 },
        {
          rules,
          annotateHook: (diff, ctx) => {
            seen.push(String(ctx.rules.annotate?.(diff, ctx)?.template))
            return ""
          },
        },
      )

      expect(seen).toEqual(["fromStar"])
    })

    it("A5.4 function rules receive the node key, path and value", () => {
      const rules: CompareRules = {
        "/*": ({ key, path, value }) => ({
          $: key === "a" && path.length === 1 && value === 1 ? allBreaking : allNonBreaking,
        }),
      }
      const { diffs } = compare({ a: 1, b: 1 }, { a: 2, b: 2 }, { rules })

      expect(diffs).toMatchObject([
        { path: ["a"], type: breaking },
        { path: ["b"], type: nonBreaking },
      ])
    })

    it("A5.5 rename is classified with the replace slot of the classify rule", () => {
      const rules: CompareRules = {
        mapping: () => ({ added: [], removed: [], mapped: { a: "b" } }),
        "/*": { $: [breaking, breaking, deprecated] },
      }
      const { diffs } = compare({ a: 1 }, { b: 1 }, { rules })
      expect(diffs).toMatchObject([{ action: "rename", type: deprecated }])
    })
  })

  describe("custom compare / transform resolvers", () => {
    it("A5.6 a compare resolver result is used verbatim and nested nodes are not visited", () => {
      const rules: CompareRules = {
        "/a": {
          compare: (ctx) => ({
            diffs: [
              {
                action: "replace",
                path: ctx.before.path,
                before: ctx.before.value,
                after: ctx.after.value,
                type: deprecated,
              },
              // without a `scope`: the result is passed on verbatim, whatever it holds
            ] as Diff[],
            merged: "custom",
            rootMergeMeta: { action: "replace", type: deprecated, replaced: "x" },
          }),
          "/**": { $: allBreaking },
        },
      }
      const { diffs, merged } = compare({ a: { b: 1 } }, { a: { b: 2 } }, { metaKey, rules })

      expect(diffs).toEqual([{ action: "replace", path: ["a"], before: { b: 1 }, after: { b: 2 }, type: deprecated }])
      expect(merged.a).toBe("custom")
      expect(merged[metaKey]).toEqual({ a: { action: "replace", type: deprecated, replaced: "x" } })
    })

    it("A5.7 a compare resolver returning undefined falls back to structural comparison", () => {
      const rules: CompareRules = { "/a": { compare: () => undefined, "/**": { $: allBreaking } } }
      const { diffs } = compare({ a: { b: 1 } }, { a: { b: 2 } }, { rules })
      expect(diffs).toMatchObject([{ path: ["a", "b"], type: breaking }])
    })

    // 2.0.2: `merged` holds the compared (transformed) value of a changed node (the `merged` option is removed); an
    // unchanged subtree is written as the after value
    it("A5.8 transforms run before comparison and the merged document holds the transformed after value", () => {
      const rules: CompareRules = {
        "/a": { transform: [(b, a) => [String(b).toLowerCase(), String(a).toLowerCase()]], $: allBreaking },
      }
      const same = compare({ a: "X" }, { a: "x" }, { rules })
      expect(same.diffs).toEqual([])
      expect(same.merged.a).toBe("x")

      const upper = compare({ a: "A" }, { a: "B" }, { rules })
      expect(upper.diffs).toMatchObject([{ before: "a", after: "b" }])
      expect(upper.merged.a).toBe("b")
    })

    it("A5.9 (characterization) transforms are skipped when the before value is an array", () => {
      let calls = 0
      const rules: CompareRules = {
        "/a": {
          transform: [
            (b, a) => {
              calls++
              return [b, a]
            },
          ],
        },
      }
      compare({ a: [1] }, { a: [2] }, { rules })
      expect(calls).toBe(0)

      compare({ a: { x: 1 } }, { a: [2] }, { rules })
      expect(calls).toBe(1)
    })

    // the library never writes to the console: errors go to `onError` or `result.errors` (DESIGN_PROPOSALS §5, ISSUE-43)
    it("A5.10 a throwing classifier degrades to unclassified instead of aborting the comparison", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      const boom: ClassifyRule = [
        () => {
          throw new Error("boom")
        },
        breaking,
        breaking,
      ]
      const { diffs, errors } = compare({}, { a: 1 }, { rules: { "/a": { $: boom } } })

      expect(diffs).toMatchObject([{ action: "add", type: unclassified }])
      expect(error).not.toHaveBeenCalled()
      expect(errors).toMatchObject([{ kind: "classify", path: ["a"], message: expect.stringContaining("boom") }])
      error.mockRestore()
    })

    it("A5.10b onError receives classifier errors instead of result.errors", () => {
      const seen: unknown[] = []
      const boom: ClassifyRule = [
        () => {
          throw new Error("boom")
        },
        breaking,
        breaking,
      ]
      const result = compare({}, { a: 1 }, { rules: { "/a": { $: boom } }, onError: (e) => seen.push(e) })

      expect(seen).toHaveLength(1)
      expect(result.errors).toBeUndefined()
    })
  })

  describe("classify rule transformers", () => {
    it("A5.11 reverseClassifyRule swaps breaking/non-breaking and keeps the other types", () => {
      expect(reverseClassifyRule([breaking, nonBreaking, annotation])).toEqual([nonBreaking, breaking, annotation])
      expect(reverseClassifyRule([deprecated, unclassified, breaking])).toEqual([deprecated, unclassified, nonBreaking])
    })

    it("A5.12 explicit reversed entries win over automatic inversion", () => {
      const rule: ClassifyRule = [breaking, breaking, breaking, annotation, deprecated, unclassified]
      expect(reverseClassifyRule(rule)).toEqual([annotation, deprecated, unclassified])
    })

    it("A5.13 reversed classifier functions are inverted lazily", () => {
      const [add] = reverseClassifyRule([() => breaking, nonBreaking, nonBreaking]) as ClassifyTuple
      expect(typeof add).toBe("function")
      expect((add as Function)({})).toBe(nonBreaking)
    })

    it("A5.14 transformClassifyRule passes the action name to the transformer", () => {
      const actions: string[] = []
      const rule = transformClassifyRule([breaking, breaking, breaking], (type, _ctx, action) => {
        actions.push(action)
        return type
      })
      for (const entry of rule as ClassifyTuple) {
        ;(entry as Function)({})
      }
      expect(actions).toEqual(["add", "remove", "replace"])
    })

    it("A5.15 transformCompareRules reverses nested, function and '/**' rules", () => {
      const rules: CompareRules = {
        $: [breaking, nonBreaking, breaking],
        "/*": () => ({ $: [breaking, nonBreaking, breaking] }),
        "/**": { $: [nonBreaking, breaking, nonBreaking] },
      }
      const reversed = transformCompareRules(rules, reverseClassifyRuleTransformer)

      expect(reversed.$).toEqual([nonBreaking, breaking, nonBreaking])
      expect((reversed["/*"] as Function)({ key: "", path: [], value: {} }).$).toEqual([
        nonBreaking,
        breaking,
        nonBreaking,
      ])
      expect((reversed["/**"] as CompareRules).$).toEqual([breaking, nonBreaking, breaking])
    })

    const mapping = () => ({ added: [], removed: [], mapped: {} })
    const transform = [
      (b: unknown, a: unknown): [unknown, unknown] => [b, a],
      (b: unknown, a: unknown): [unknown, unknown] => [a, b],
    ]

    it("A5.16 transformCompareRules keeps non-rule properties (compare, mapping, transform) intact", () => {
      const reversed = transformCompareRules(
        { mapping, transform, "/a": { skip: true } },
        reverseClassifyRuleTransformer,
      )

      expect(reversed.mapping).toBe(mapping)
      expect(reversed.transform?.[1]).toBe(transform[1])
      expect((reversed["/a"] as CompareRules).skip).toBe(true)
    })

    // ISSUE-50 (fixed): the key guard `if (key && …)` treats array index 0 as "no key", so the first transform function is
    // wrapped like a function *rule* and returns a deep clone of `[before, after]` on every call.
    it("A5.17 transformCompareRules keeps the first transform function intact", () => {
      const reversed = transformCompareRules({ transform }, reverseClassifyRuleTransformer)
      expect(reversed.transform?.[0]).toBe(transform[0])
    })
  })
})
