/**
 * What the result toolbar does with the diffs of a comparison before the table and the YAML view show them: the type
 * filter, the text search and the sorting (by type or by the location target: endpoint, channel, field, declaration). Both views
 * receive the same list, so the YAML view shows (and copies) exactly the diffs the table shows, in the same order.
 * Pure: no DOM, no engine call.
 */
import type { Diff, DiffType } from "../../../src"
import { DIFF_TYPES, pointer } from "./diff"
import type { DiffLocation } from "./location"

export interface ResultRow {
  diff: Diff
  /** the API location of the diff (see location.ts) */
  location?: DiffLocation
  /** the position of the diff in the engine output (document order) */
  index: number
}

/** `type`: by severity; `target`: by the location target (endpoint, channel, field, declaration, pointer) */
export type SortKey = "type" | "target"
export type SortDirection = "asc" | "desc"

export interface SortState {
  key: SortKey
  direction: SortDirection
}

export interface ResultFilter {
  /** the diff types switched off with the type chips */
  hidden?: Partial<Record<DiffType, boolean>>
  /** the search text (location, JSON pointer, description; case-insensitive) */
  query?: string
}

/** The rows of a comparison; the locations are used only when there is one for every diff */
export const resultRows = (diffs: readonly Diff[], locations?: readonly DiffLocation[]): ResultRow[] =>
  diffs.map((diff, index) => ({
    diff,
    location: locations?.length === diffs.length ? locations[index] : undefined,
    index,
  }))

/** The types that occur in a result (the toolbar shows a chip for these only), in the order of severity */
export const presentTypes = (counts: Record<DiffType, number>): DiffType[] =>
  DIFF_TYPES.filter((type) => counts[type] > 0)

/** The switched-off types that no longer occur (their chip is gone): reset, so that nothing is filtered invisibly */
export const staleHidden = (hidden: ResultFilter["hidden"], counts: Record<DiffType, number>): DiffType[] =>
  DIFF_TYPES.filter((type) => hidden?.[type] && !counts[type])

/** The search matches the location text, the JSON pointer of the path and the description */
export const matchesQuery = (row: ResultRow, query: string): boolean => {
  const text = query.trim().toLowerCase()
  if (!text) {
    return true
  }
  return `${row.location?.text ?? ""} ${pointer(row.diff.path)} ${row.diff.description ?? ""}`
    .toLowerCase()
    .includes(text)
}

export const filterRows = (rows: readonly ResultRow[], filter: ResultFilter = {}): ResultRow[] =>
  rows.filter((row) => !filter.hidden?.[row.diff.type] && matchesQuery(row, filter.query ?? ""))

// OpenAPI path item order of the methods; GraphApi operation kinds (other engines: alphabetical)
const METHOD_ORDER = ["get", "put", "post", "delete", "options", "head", "patch", "trace", "query"]
const OPERATION_ORDER = ["query", "mutation", "subscription"]

const methodRank = (method: string, engine: string | undefined): number => {
  if (!method) {
    return -1
  }
  const order = engine === "graphapi" ? OPERATION_ORDER : engine === "openapi" ? METHOD_ORDER : []
  const rank = order.indexOf(method.toLowerCase())
  return rank < 0 ? order.length : rank
}

const compareText = (a: string, b: string): number => {
  const lower = a.toLowerCase().localeCompare(b.toLowerCase(), "en")
  return lower || (a < b ? -1 : a > b ? 1 : 0)
}

/** The location target a row sorts by (the JSON pointer without a location) */
export const sortTarget = (row: ResultRow): string => row.location?.target ?? (pointer(row.diff.path) || "/")

const compareTarget = (a: ResultRow, b: ResultRow, engine: string | undefined): number => {
  const target = compareText(sortTarget(a), sortTarget(b))
  if (target) {
    return target
  }
  const methodA = a.location?.method ?? ""
  const methodB = b.location?.method ?? ""
  return methodRank(methodA, engine) - methodRank(methodB, engine) || compareText(methodA, methodB)
}

const compareType = (a: ResultRow, b: ResultRow): number =>
  DIFF_TYPES.indexOf(a.diff.type) - DIFF_TYPES.indexOf(b.diff.type)

/**
 * The rows sorted: by type in the order of severity (breaking, risky, non-breaking, deprecated, annotation,
 * unclassified), or by the target alphabetically and then the method (OpenAPI: HTTP order of a path item; GraphApi:
 * query, mutation, subscription; otherwise alphabetical). `desc` reverses the key only: rows with equal keys stay in
 * document order. Without a sort the rows keep the engine order.
 */
export const sortRows = (rows: readonly ResultRow[], sort?: SortState, engine?: string): ResultRow[] => {
  const sorted = [...rows]
  if (!sort) {
    return sorted.sort((a, b) => a.index - b.index)
  }
  const sign = sort.direction === "desc" ? -1 : 1
  const compare = sort.key === "type" ? compareType : (a: ResultRow, b: ResultRow) => compareTarget(a, b, engine)
  return sorted.sort((a, b) => sign * compare(a, b) || a.index - b.index)
}

/** A click on a sortable header: ascending, then descending, then back to the document order */
export const nextSort = (current: SortState | undefined, key: SortKey): SortState | undefined => {
  if (!current || current.key !== key) {
    return { key, direction: "asc" }
  }
  return current.direction === "asc" ? { key, direction: "desc" } : undefined
}

/** The filtered and sorted rows the table and the YAML view show */
export const resultView = (
  diffs: readonly Diff[],
  options: { locations?: readonly DiffLocation[]; engine?: string; sort?: SortState } & ResultFilter = {},
): ResultRow[] => sortRows(filterRows(resultRows(diffs, options.locations), options), options.sort, options.engine)

/** The diffs the YAML view shows: the same as the table, in the same order */
export const viewDiffs = (rows: readonly ResultRow[]): Diff[] => rows.map((row) => row.diff)

/** The header of the column the target sort applies to */
export const targetLabel = (engine: string | undefined): string => {
  switch (engine) {
    case "openapi":
      return "Endpoint"
    case "asyncapi":
      return "Channel"
    case "graphapi":
      return "Field"
    case "protoapi":
      return "Declaration"
    default:
      return "Location"
  }
}

/** A short description of the sort for the YAML note and the tooltips (`type ↑`, `endpoint ↓`) */
export const sortSummary = (sort: SortState | undefined, engine?: string): string =>
  sort
    ? `sorted by ${sort.key === "type" ? "type" : targetLabel(engine).toLowerCase()} ${sort.direction === "asc" ? "↑" : "↓"}`
    : ""

/** The tooltip of a sortable header */
export const sortHint = (key: SortKey, engine: string | undefined, sort: SortState | undefined): string => {
  const order =
    key === "type"
      ? "by severity (breaking, risky, non-breaking, deprecated, annotation, unclassified)"
      : `by ${targetLabel(engine).toLowerCase()} (alphabetical${engine === "openapi" ? ", then method in HTTP order" : engine === "protoapi" ? ", then rpc" : ", then operation"})`
  const state =
    sort?.key !== key
      ? "click to sort"
      : sort.direction === "asc"
        ? "sorted ascending; click to reverse"
        : "sorted descending; click to return to document order"
  return `Sort ${order}, then document order: ${state}. The YAML view uses the same order.`
}
