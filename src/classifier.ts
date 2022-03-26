import { Rules, IJsonPath, Classifier, IDiff } from "./types"
import { allUnclassified } from "./rules/helpers"
import { IClassifiedDiff } from "."

export const findClassifier = (rules: Rules, path: IJsonPath): Classifier => {
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

export const classifyDiff = (diff: IDiff, rules: Rules = {}): IClassifiedDiff => {
  const _diff = diff as IClassifiedDiff

  const classifier = findClassifier(rules, diff.path)

  const index = ["add", "remove", "replace"].indexOf(diff.action)
  const changeType = classifier[index]

  _diff.type = typeof changeType === "function" 
    ? changeType(diff.before, diff.after)
    : changeType

  return _diff
}
