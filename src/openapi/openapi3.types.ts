import type { ComapreOptions } from "../types"

export type OpenApi3RulesOptions = {
  version?: "3.0.x" | "3.1.x"
  notMergeAllOf?: boolean
}

export type OpenApi3SchemaRulesOptions = OpenApi3RulesOptions & {
  response?: boolean
}

export type OpenApiComapreOptions = ComapreOptions & Omit<OpenApi3RulesOptions, "version">
