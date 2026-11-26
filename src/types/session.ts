import type { JsonPath } from "json-crawl"

import type { CompareContext } from "./rules"
import type { AnnotateHook, CompareError, CompareResult, CompareScope, CompareOptions, Diff } from "./compare"

export type CompareSide = "before" | "after"

export interface RefTarget {
  // resolved value
  value: unknown
  // document the pointer was resolved against (the root or an external source)
  document: unknown
  // path of the value inside `document`
  path: JsonPath
  // normalized reference ("#/components/schemas/Pet", "ext.yaml#/X")
  ref: string
}

export interface CachedCompareResult extends CompareResult {
  // contexts of the cached diffs (parallel to `diffs`), used to re-describe them at another usage site
  contexts: CompareContext[]
  bPath: JsonPath
  aPath: JsonPath
  // usage scopes of the enclosing component when the result was computed in the `components` scope with diffs
  direction?: string
  // diffs left to the declaration while the result was computed (POLICY-57), with their contexts; replayed into the
  // session on a cache hit
  suppressedDiffs: Diff[]
  suppressedContexts: CompareContext[]
}

export interface NestedCompareResult extends CompareResult {
  contexts: CompareContext[]
}

export interface UsageIndex {
  // scopes that reference a component pointer (transitively through other components)
  usage: (pointer: string) => Set<CompareScope>
}

export interface CompareSession {
  options: CompareOptions
  errors: CompareError[]
  // report an error through `options.onError`, or collect it
  report: (error: CompareError) => void
  // resolve a `$ref` against the document root (or `externalSources`); undefined when it cannot be resolved
  resolveRef: (side: CompareSide, root: unknown, $ref: string) => RefTarget | undefined
  // references currently being resolved, per side (cycle detection), and the pairs (`before ref|after ref`) they are
  // resolved in: a cycle that closes on the same pair is the comparison already in progress (ISSUE-99)
  refStack: Record<CompareSide, Set<string>>
  refPairs: Set<string>
  // containers on the current comparison path (object identity): guards against cyclic object graphs
  pathStack: object[]
  // input containers written into `merged` by reference, copied by the nearest changed ancestor
  aliases: WeakSet<object>
  // results of `$ref` pair comparisons keyed by (scope, bRef, aRef), plus the component direction when it differs
  refResults: Map<string, CachedCompareResult>
  // running number of diffs produced in this session (used to detect unchanged subtrees)
  diffCount: number
  // > 0 while the content of a component is compared at one of its usage locations (a `$ref` naming the same
  // declaration on both sides): annotation diffs are then reported at the declaration only (POLICY-57, ISSUE-190)
  declarationOnly: number
  // the diffs not emitted at a usage location because of `declarationOnly` (POLICY-57), with their contexts: checked
  // against the declaration's diffs at the end of the call (POLICY-60)
  suppressedDiffs: Diff[]
  suppressedContexts: CompareContext[]
  // keys (`declarationKey`) of the changes the declaration does not report: emitted at the usage locations even in
  // `declarationOnly` mode (POLICY-60); set for the second pass of a call only
  keepAtUsage: Set<string> | undefined
  // diffs (emitted or left to the declaration) produced inside references nested in the content of a usage whose two
  // sides name the same declaration, and the nesting of such references: at the declaration those references are
  // nominal, so a combinator at a usage leaves these diffs out when it pairs branches, as the declaration does
  nominalDiffs: number
  nominalNesting: number
  // per-session, lazily built indexes keyed by an arbitrary string (usage index, allOf mergers, ...)
  caches: Map<string, unknown>
  // the options the engine reads on every node, copied once: the options object is built per call by spreading, and
  // reading it in the walk keeps the walk's property caches from settling (ISSUE-191)
  metaKey: string | symbol
  arrayMeta: boolean
  normalized: boolean
  annotateHook: AnnotateHook | undefined
  unclassifiedComponents: boolean
}
