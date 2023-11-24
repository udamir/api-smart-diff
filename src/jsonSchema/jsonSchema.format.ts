import type { ComapreContext, Diff } from "../types"

export const jsonSchemaDiffFormat = (diff: Diff, ctx: ComapreContext): Diff => {
  const { rules } = ctx.options

  if (rules?.annotate) {
    diff.description = rules.annotate(diff, ctx)
  }

  return diff
}
