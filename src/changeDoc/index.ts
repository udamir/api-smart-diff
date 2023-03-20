import { ChangeDocContext, ChangeDocRules } from "./types"
import { getValueByPath } from "../utils"
import { Diff } from "../types"

const resolve = (node: any, key: string | number, ctx: ChangeDocContext): any => {
  if (!node || key === undefined) { return }
  if (key in node) {
    return node[key]
  } else if ("$ref" in node) {
    node = getValueByPath(ctx.source, node.$ref.split("/").slice(1))
    return resolve(node, key, ctx)
  }
}

const getChangeRule = (rules: ChangeDocRules, ctx: ChangeDocContext, index = 0): string => {
  const { node, path } = ctx
  let key = path[index]

  if (index === path.length) {
    key = ""
  } else if (!(`/${key}` in rules) || typeof key === "number") {
    key = "*"
  }

  // check if rules have key
  if (`/${key}` in rules) {
    const rule = rules[`/${key}`]

    if (typeof rule === "string") {
      return rule
    }

    const _ctx: ChangeDocContext = index === path.length ? ctx : {
      ...ctx,
      key: path[index],
      node: resolve(node, path[index], ctx),
      parent: node
    }

    if (typeof rule === "function") {
      const _rule = rule(_ctx)
      if (typeof _rule === "string") {
        return _rule
      } else {
        return getChangeRule(_rule, _ctx, index + 1)
      }
    } else {
      return getChangeRule(rule, _ctx, index + 1)
    } 
  }
  return ""
}

export const changeDoc = (diff: Diff, before: any, after: any, rules: ChangeDocRules): string => {
  if (diff.type !== "annotation" && diff.type !== "unclassified") {
    const source = diff.action === "add" ? after : before
    try {
      return getChangeRule(rules, { ...diff, node: source, source, key: "" })
    } catch (error) {
      console.error(error)
      return ""
    }
  }
  return ""
}
