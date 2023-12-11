import { CompareRules, breaking, nonBreaking, reverseRules, unclassified } from "../../src"

describe("Openapi utils unit tests", () => {
  it("should reverse simple rules", () => {
    const rules: CompareRules = {
      "/*": { $: [nonBreaking, breaking, unclassified] },
    } 
    const reversed = reverseRules(rules)
    expect(reversed).toMatchObject({
      "/*": { $: [breaking, nonBreaking, unclassified] }
    })
  })

  it("should reverse rules with nested rules", () => {
    const rules: CompareRules = {
      "/*": { 
        $: [nonBreaking, breaking, unclassified],
        "/*": { 
          $: [breaking, nonBreaking, unclassified]
        },
      },
    } 
    const reversed = reverseRules(rules)
    expect(reversed).toMatchObject({
      "/*": { 
        $: [breaking, nonBreaking, unclassified],
        "/*": {
          $: [nonBreaking, breaking, unclassified],
        }
      }
    })
  })

  it("should reverse rules with classifyFunc ", () => {
    const rules: CompareRules = {
      "/*": { $: [nonBreaking, breaking, ({ before }) => before.path.length ? breaking : nonBreaking ] },
    } 
    const reversed: any = reverseRules(rules)
    expect(reversed["/*"].$[2]({ before: { path: [] }})).toEqual(breaking)
    expect(reversed["/*"].$[2]({ before: { path: [1] }})).toEqual(nonBreaking)
  })

  
  it("should reverse rules with nested func rules", () => {
    const rules: CompareRules = {
      "/*": { 
        $: [nonBreaking, breaking, unclassified],
        "/*": () => ({ 
          $: [breaking, nonBreaking, unclassified]
        }),
      },
    } 
    const reversed: any = reverseRules(rules)
    expect(reversed["/*"]["/*"]()).toMatchObject({
      $: [nonBreaking, breaking, unclassified],
    })
  })

})