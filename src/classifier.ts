import { Rules, IJsonPath, Classifier, allUnclassified, IClassifiedDiff, IDiff } from "./types"

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

export const classifyDiff = (rules: Rules, diff: IDiff[]): IClassifiedDiff[] => {
  const _diff = diff as IClassifiedDiff[]

  for (const item of _diff) {
    const classifier = findClassifier(rules, item.path)
    const index = ["add", "remove", "replace"].indexOf(item.action)
    const changeType = classifier[index]
    if (typeof changeType === "function") {
      item.type = changeType(item.before, item.after)
    } else {
      item.type = changeType
    }
  }

  return _diff
}
