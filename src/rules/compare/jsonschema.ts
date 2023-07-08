import { DiffTypeFunc, ComapareRules, DiffType, ComapreRule, ClassifyRule } from "../types"
import {
  breaking, nonBreaking, addNonBreaking, allAnnotation, allBreaking, allUnclassified,
  onlyAddBreaking, allDeprecated,
} from "../../constants"
import { Diff } from "../../types"

export const breakingIf = (v: boolean): DiffType => (v ? breaking : nonBreaking)

export const breakingIfAfterTrue: DiffTypeFunc = ({ after }): DiffType => breakingIf(after)
export const nonBreakingIfDefault: DiffTypeFunc = ({ after, up }) => up(2).after?.properties?.[after]?.default !== undefined ? nonBreaking : breaking

const maxClassifier: ClassifyRule = [breaking, nonBreaking, (c) => breakingIf(c.before > c.after)]
const minClassifier: ClassifyRule = [breaking, nonBreaking, (c) => breakingIf(c.before < c.after)]
const exclusiveClassifier: ClassifyRule = [breakingIfAfterTrue, nonBreaking, breakingIfAfterTrue]
const booleanClassifier: ClassifyRule = [breakingIfAfterTrue, nonBreaking, breakingIfAfterTrue]
const multipleOfClassifier: ClassifyRule = [breaking, nonBreaking, (c) => breakingIf(!!(c.before % c.after))]

const compareEnums: ComapreRule = (ctx) => {
  const { before, after } = ctx

  // take into account before.parent.const and after.parent.const
  const _before: any[] = "const" in before.parent ? [before.parent.const] : Array.isArray(before.value) ? before.value : []
  const _after: any[] = "const" in after.parent ? [after.parent.const] : Array.isArray(after.value) ? after.value : []

  const beforeKeys = new Set(_before.keys())

  const diffs: Diff[] = []

  // compare _before vs _after
  for (const aValue of _after) {
    let added = true
    for (const bKey of beforeKeys) {
      if (_before[bKey] === aValue) {
        beforeKeys.delete(bKey)
        added = false
        break
      }
    }
    if (added) {
      diffs.push({ action: "add", path: [...ctx.path], after: aValue })
    }
  }

  for (const bKey of beforeKeys) {
    diffs.push({ action: "remove", path: [...ctx.path], after: _before[bKey] })
  }

  return []
}

export const jsonSchemaRules = (draft: string = ""): ComapareRules => ({
  "/title": { $: allAnnotation },
  "/multipleOf": { $: multipleOfClassifier },
  "/maximum": { $: maxClassifier },
  "/exclusiveMaximum": { $: exclusiveClassifier },
  "/minimum": { $: minClassifier },
  "/exclusiveMinimum": { $: exclusiveClassifier },
  "/maxLength": { $: maxClassifier },
  "/minLength": { $: minClassifier },
  "/pattern": { $: [breaking, nonBreaking, breaking] }, // TODO: Compare Regex before vs after
  "/maxItems": { $: maxClassifier },
  "/minItems": { $: minClassifier },
  "/uniqueItems": { $: booleanClassifier },
  "/maxProperties": { $: maxClassifier },
  "/minProperties": { $: minClassifier },
  "/required": {
    $: onlyAddBreaking,
    "/*": { $: [nonBreakingIfDefault, nonBreaking, nonBreakingIfDefault] },
  },
  "/enum": {
    $: [breaking, nonBreaking, breaking],
    "/*": { $: [nonBreaking, breaking, breaking] },
    "#": compareEnums
  },
  "/type": {
    $: [breaking, nonBreaking, breaking],
    "/*": { $: [nonBreaking, breaking, breaking] }
  },
  "/not": {
    $: [breaking, nonBreaking, breaking],
    "/*": () => ({
      ...jsonSchemaRules(draft),
      $: allBreaking,
    })
  },
  "/allOf": {
    $: [breaking, nonBreaking, breaking],
    "/*": () => ({
      ...jsonSchemaRules(draft),
      $: allBreaking
    })
  },
  "/oneOf": {
    $: [breaking, nonBreaking, breaking],
    "/*": () => ({
      ...jsonSchemaRules(draft),
      $: addNonBreaking
    })
  },
  "/anyOf": {
    $: [breaking, nonBreaking, breaking],
    "/*": () => ({
      ...jsonSchemaRules(draft),
      $: addNonBreaking
    })
  },
  "/items": () => ({
    ...jsonSchemaRules(draft),
    $: addNonBreaking
  }),
  "/properties": {
    $: [breaking, nonBreaking, breaking],
    "/*": () => ({
      ...jsonSchemaRules(draft),
      $: addNonBreaking
    })
  },
  "/additionalProperties": () => ({
    ...jsonSchemaRules(draft),
    $: [breaking, breaking, breakingIfAfterTrue]
  }),
  "/description": { $: allAnnotation },
  "/format": { $: [breaking, nonBreaking, breaking] },
  "/default": { $: [nonBreaking, breaking, breaking] },
  "/nullable": { $: booleanClassifier },
  "/discriminator": {
    // TODO
    $$: allUnclassified,
    "/propertyName": { $: allUnclassified },
    "/mapping": { $: allUnclassified },
  },
  "/readOnly": { $: booleanClassifier },
  "/writeOnly": { $: booleanClassifier },
  "/example": { $: allAnnotation },
  "/examples": { $$: allAnnotation },
  "/externalDocs": { $$: allAnnotation },
  "/deprecated": { $$: allDeprecated },
  "/xml": { $$: allUnclassified },
})
