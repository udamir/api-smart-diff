import type { ComapreOptions } from "../types"

export type AsyncApiRulesOptions = {
  // version?: "2.x" | "3.x"
  notMergeAllOf?: boolean
}

export type AsyncApiSchemaRulesOptions = AsyncApiRulesOptions & {
  response?: boolean
}

export type AsyncApiComapreOptions = ComapreOptions & AsyncApiRulesOptions
