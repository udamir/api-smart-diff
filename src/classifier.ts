import { Rules, DiffPath, Classifier, UnclassifiedDiff, Diff } from "./types"
import { allUnclassified } from "./constants"

export const findClassifier = (rules: Rules, path: DiffPath): Classifier => {
  let _rules = rules
  for (let key of [...path, ""]) {
    // check if rules dont have key of key is array index
    if (!_rules.hasOwnProperty(`/${key}`) || typeof key === "number") {
      key = "*"
    }

    // check if rules have key
    if (_rules.hasOwnProperty(`/${key}`)) {
      const rule = _rules[`/${key}`]
      if (Array.isArray(rule)) {
        return rule
      }
      _rules = typeof rule === "function" ? rule() : rule
    } else {
      return allUnclassified
    }
  }
  return allUnclassified
}

export const classifyDiff = (diff: UnclassifiedDiff, rules: Rules = {}): Diff => {
  const _diff = diff as Diff

  const classifier = findClassifier(rules, diff.path)

  const index = ["add", "remove", "replace"].indexOf(diff.action)
  const changeType = classifier[index]

  _diff.type = typeof changeType === "function" 
    ? changeType(diff.before, diff.after)
    : changeType

  return _diff
}
