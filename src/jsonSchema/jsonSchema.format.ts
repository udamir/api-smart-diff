import type { ComapreContext, Diff } from "../types"

export const jsonSchemaDiffFormat = (diff: Diff, ctx: ComapreContext): Diff => {
  const { rules } = ctx.options

  if (rules?.annotate) {
    const description = rules.annotate(diff, ctx)
    if (description) {
      diff.description = description
    }
  }

  return diff
}
