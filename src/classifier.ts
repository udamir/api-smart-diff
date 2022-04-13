import { Rules, UnclassifiedDiff, Diff } from "./types"
import { allUnclassified } from "./constants"
import { getPathRules } from "./utils"

export const classifyDiff = (diff: UnclassifiedDiff, source: any, rules: Rules = {}): Diff => {
  const _diff = diff as Diff

  const rule = getPathRules(rules, [...diff.path, ""], source)
  const classifier = Array.isArray(rule) ? rule : allUnclassified

  const index = ["add", "remove", "replace"].indexOf(diff.action)
  const changeType = classifier[index]

  _diff.type = typeof changeType === "function" 
    ? changeType(diff.before, diff.after)
    : changeType

  return _diff
}
