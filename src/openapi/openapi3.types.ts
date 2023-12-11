import { ComapreOptions } from "../types"

export type OpenApi3RulesOptions = {
  notMergeAllOf?: boolean
}

export type OpenApiComapreOptions = ComapreOptions & {
  notMergeAllOf?: boolean
}
