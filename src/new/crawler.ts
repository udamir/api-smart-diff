
export type ObjPath = (string | number)[]

export const isObject = (value: any): value is Record<string | number | symbol, any> => typeof value === "object" && value !== null

export interface CrawlContext<T> {
  readonly root: any              // root node
  readonly node: any              // current node
  readonly path: ObjPath          // path to current node
  readonly key: string | number   // current node key
  state?: T                       // crawl state
}

export type MaybeArray<T> = T | Array<T>
export type ExitHook = () => void

export interface CrawlHookResponse<T> {
  value?: unknown,                        // updated value of current node for crawl
  state?: T,                              // state for next crawl step
  exitHook?: ExitHook                     // on exit hook for current node
}

export type CrawlHook<T> = (value: unknown, ctx: CrawlContext<T>) => CrawlHookResponse<T> | null

export const explore = <T>(data: unknown, hooks: MaybeArray<CrawlHook<T>>) => {
  const root = { "#": data }
  return crawl(data, { path: [], key: "#", root, node: root }, hooks)
}

export const clone = <T>(data: any, hooks: MaybeArray<CrawlHook<T>> = []) => {
  hooks = Array.isArray(hooks) ? hooks : [hooks]
  const root: any = {}

  const cloneHook: CrawlHook<T> = (value, ctx) => {
    ctx.node[ctx.key] = isObject(value) ? (Array.isArray(value) ? [] : {}) : value
    return { value, state: ctx.state }
  }

  crawl(data, { path: [], key: "#", root, node: root }, [...hooks, cloneHook])
  return root["#"]
}

export const crawl = <T>(data: any, ctx: CrawlContext<T>, hooks: MaybeArray<CrawlHook<T>>) => {
  hooks = Array.isArray(hooks) ? hooks : [hooks]

  const exitHooks: ExitHook[] = []
  let result: CrawlHookResponse<T> = { value: data, state: ctx.state }

  for (const hook of hooks) {
    if (!hook) { continue }
    const _result = hook(result.value, { ...ctx, state: result.state })
    result = _result || {}
    if (!_result) { break }
    result.exitHook && exitHooks.push(result.exitHook)
  }

  const { value, state } = result
  const node = ctx.node[ctx.key]

  if (Array.isArray(value)) {
    for (const i of value.keys()) {
      const _ctx = { ...ctx, state, path: [...ctx.path, i], key: i, node }
      crawl(value[i], _ctx, hooks)
    }
  } else if (isObject(value)) {
    for (const key of Object.keys(value)) {
      const _ctx = { ...ctx, state, path: [...ctx.path, key], key, node }
      crawl(value[key], _ctx, hooks)
    }
  }
  
  for (const exitHook of exitHooks.reverse()) {
    exitHook()
  }
}
