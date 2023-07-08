import { CrawlRules } from "json-crawl"
import { Diff } from "../types"

export type ChangeDocResolver = (ctx: ChangeDocContext) => string

export type ChangeDocRule = {
  "%"?: string | ChangeDocResolver
}

export type ChangeDocRules = CrawlRules<ChangeDocRule>

export interface ChangeDocContext extends Diff {
  key: string | number
  node: any
  parent?: any
  source: any // source before (replace, delete) | after (add)
}
