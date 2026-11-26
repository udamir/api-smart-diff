// The result toolbar of the portal (docs/.vitepress/theme/results.ts): the type filter, the search and the sorting by
// type and by location target, and that the YAML view receives the same filtered and sorted diffs as the table.

import { load } from "js-yaml"

import type { Diff, DiffType } from "../../src"
import { analyzeTexts } from "../../docs/.vitepress/theme/analysis"
import { countByType, diffsYaml, pointer } from "../../docs/.vitepress/theme/diff"
import type { DiffLocation } from "../../docs/.vitepress/theme/location"
import {
  filterRows,
  nextSort,
  presentTypes,
  resultRows,
  resultView,
  sortHint,
  sortRows,
  sortSummary,
  staleHidden,
  targetLabel,
  viewDiffs,
} from "../../docs/.vitepress/theme/results"

const diff = (type: DiffType, path: (string | number)[], description = ""): Diff =>
  ({ type, action: "replace", path, scope: "", description, before: 1, after: 2 }) as unknown as Diff

const location = (method: string, target: string, part = ""): DiffLocation => ({
  method,
  target,
  part,
  text: `${method} ${target}${part ? ` · ${part}` : ""}`.trim(),
})

// engine order (document order) of a small OpenAPI result
const DIFFS: Diff[] = [
  diff("non-breaking", ["paths", "/pets", "post", "responses", "201"], "response 201 added"),
  diff("breaking", ["paths", "/pets", "get", "parameters", 0], "required parameter limit added"),
  diff("annotation", ["info", "title"], "title changed"),
  diff("breaking", ["paths", "/orders", "delete"], "operation removed"),
  diff("risky", ["paths", "/pets", "get", "responses", "200"], "enum value added"),
  diff("unclassified", ["x-extra"], "extension changed"),
  diff("deprecated", ["paths", "/pets", "put"], "operation deprecated"),
]
const LOCATIONS: DiffLocation[] = [
  location("POST", "/pets", "response 201"),
  location("GET", "/pets", "parameter query limit"),
  location("", "info", "title"),
  location("DELETE", "/orders"),
  location("GET", "/pets", "response 200 application/json"),
  location("", "x-extra"),
  location("PUT", "/pets"),
]

const order = (rows: { index: number }[]) => rows.map((row) => row.index)

describe("docs portal / result toolbar", () => {
  const rows = resultRows(DIFFS, LOCATIONS)

  it("D-RES-001 rows keep the engine order and use the locations only when there is one per diff", () => {
    expect(order(rows)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(rows[1].location?.target).toBe("/pets")
    expect(resultRows(DIFFS, LOCATIONS.slice(1)).every((row) => row.location === undefined)).toBe(true)
  })

  it("D-RES-002 type filter hides the switched-off types", () => {
    expect(order(filterRows(rows, { hidden: { breaking: true } }))).toEqual([0, 2, 4, 5, 6])
    expect(order(filterRows(rows, { hidden: { breaking: true, annotation: true, unclassified: true } }))).toEqual([
      0, 4, 6,
    ])
    expect(order(filterRows(rows, { hidden: { breaking: false } }))).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it("D-RES-003 search matches the location text, the pointer and the description, case-insensitive", () => {
    expect(order(filterRows(rows, { query: "  ORDERS " }))).toEqual([3])
    // the location text has the request / response part (no longer a column)
    expect(order(filterRows(rows, { query: "response 20" }))).toEqual([0, 4])
    expect(order(filterRows(rows, { query: "/paths/~1pets/get" }))).toEqual([1, 4])
    expect(order(filterRows(rows, { query: "deprecated" }))).toEqual([6])
    expect(order(filterRows(rows, { query: "" }))).toHaveLength(DIFFS.length)
    expect(order(filterRows(rows, { query: "nothing like this" }))).toEqual([])
  })

  it("D-RES-004 type filter and search combine", () => {
    expect(order(filterRows(rows, { query: "/pets", hidden: { breaking: true } }))).toEqual([0, 4, 6])
  })

  it("D-RES-005 sort by type: severity order, equal types in document order; desc reverses the key only", () => {
    expect(order(sortRows(rows, { key: "type", direction: "asc" }))).toEqual([1, 3, 4, 0, 6, 2, 5])
    expect(order(sortRows(rows, { key: "type", direction: "desc" }))).toEqual([5, 2, 6, 0, 4, 1, 3])
    expect(order(sortRows(rows))).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it("D-RES-006 sort by endpoint: alphabetical, then method in HTTP order, then document order", () => {
    // /orders < /pets < info < x-extra; /pets: GET (1, 4), PUT (6), POST (0)
    expect(order(sortRows(rows, { key: "target", direction: "asc" }, "openapi"))).toEqual([3, 1, 4, 6, 0, 2, 5])
    expect(order(sortRows(rows, { key: "target", direction: "desc" }, "openapi"))).toEqual([5, 2, 0, 6, 1, 4, 3])
  })

  it("D-RES-007 sort by field (GraphApi): operation kind order; without locations by JSON pointer", () => {
    const graph = resultRows(
      [diff("breaking", ["mutations", "a"]), diff("breaking", ["queries", "a"]), diff("breaking", ["queries", "b"])],
      [location("mutation", "a"), location("query", "a"), location("query", "b")],
    )
    expect(order(sortRows(graph, { key: "target", direction: "asc" }, "graphapi"))).toEqual([1, 0, 2])
    const plain = resultRows([
      diff("breaking", ["properties", "b"]),
      diff("breaking", ["properties", "a"]),
      diff("breaking", []),
    ])
    expect(order(sortRows(plain, { key: "target", direction: "asc" }, "jsonschema"))).toEqual([2, 1, 0])
  })

  it("D-RES-008 a header click sorts ascending, then descending, then back to document order", () => {
    const asc = nextSort(undefined, "type")
    expect(asc).toEqual({ key: "type", direction: "asc" })
    const desc = nextSort(asc, "type")
    expect(desc).toEqual({ key: "type", direction: "desc" })
    expect(nextSort(desc, "type")).toBeUndefined()
    expect(nextSort(desc, "target")).toEqual({ key: "target", direction: "asc" })
  })

  it("D-RES-009 labels, summary and tooltip of the sort (the tooltip says the YAML view uses the same order)", () => {
    expect(targetLabel("openapi")).toBe("Endpoint")
    expect(targetLabel("asyncapi")).toBe("Channel")
    expect(targetLabel("graphapi")).toBe("Field")
    expect(targetLabel("jsonschema")).toBe("Location")
    expect(sortSummary(undefined)).toBe("")
    expect(sortSummary({ key: "target", direction: "desc" }, "openapi")).toBe("sorted by endpoint ↓")
    expect(sortSummary({ key: "type", direction: "asc" })).toBe("sorted by type ↑")
    expect(sortHint("type", "openapi", undefined)).toMatch(/YAML view uses the same order/)
    expect(sortHint("target", "openapi", { key: "target", direction: "asc" })).toMatch(/HTTP order.*reverse/)
  })

  it("D-RES-010 the YAML view receives the filtered and sorted diffs of the table", () => {
    const view = resultView(DIFFS, {
      locations: LOCATIONS,
      engine: "openapi",
      hidden: { annotation: true },
      query: "pets",
      sort: { key: "type", direction: "asc" },
    })
    expect(order(view)).toEqual([1, 4, 0, 6])
    const shown = viewDiffs(view)
    expect(shown).toEqual([DIFFS[1], DIFFS[4], DIFFS[0], DIFFS[6]])
    const yaml = load(diffsYaml(shown)) as Diff[]
    expect(yaml.map((item) => item.path)).toEqual(shown.map((item) => item.path))
  })

  it("D-RES-011 a real comparison: filter and sort on the portal analysis", () => {
    const before = `openapi: 3.1.0
info: {title: Pets, version: "1"}
paths:
  /pets:
    get:
      responses: {"200": {description: ok}}
    post:
      responses: {"201": {description: ok}}
  /orders:
    get:
      responses: {"200": {description: ok}}
`
    const after = before
      .replace('version: "1"', 'version: "2"')
      .replace(
        'post:\n      responses: {"201": {description: ok}}',
        'post:\n      deprecated: true\n      responses: {"201": {description: ok}}',
      )
      .replace('  /orders:\n    get:\n      responses: {"200": {description: ok}}\n', "")
    const analysis = analyzeTexts({ before, after })
    const diffs = analysis.comparison?.result?.diffs ?? []
    expect(diffs.length).toBeGreaterThanOrEqual(3)
    const byEndpoint = resultView(diffs, {
      locations: analysis.locations,
      engine: analysis.engine,
      sort: { key: "target", direction: "asc" },
    })
    expect(byEndpoint.map((row) => row.location?.target)).toEqual(
      byEndpoint.map((row) => row.location?.target ?? "").sort((a, b) => a.localeCompare(b, "en")),
    )
    const breaking = resultView(diffs, {
      locations: analysis.locations,
      engine: analysis.engine,
      hidden: { annotation: true, deprecated: true, "non-breaking": true },
    })
    expect(breaking.map((row) => `${row.diff.type} ${pointer(row.diff.path)}`)).toEqual([
      "breaking /paths/~1orders/get",
    ])
    expect(resultView(diffs, { locations: analysis.locations, query: "orders" }).map((row) => row.diff.type)).toEqual([
      "breaking",
    ])
  })

  it("D-RES-012 chips only for the types present; a switched-off type that disappears is reset", () => {
    expect(presentTypes(countByType(DIFFS))).toEqual([
      "breaking",
      "risky",
      "non-breaking",
      "deprecated",
      "annotation",
      "unclassified",
    ])
    const counts = countByType([DIFFS[0], DIFFS[1]])
    expect(presentTypes(counts)).toEqual(["breaking", "non-breaking"])
    expect(staleHidden({ breaking: true, risky: true, annotation: false }, counts)).toEqual(["risky"])
    expect(staleHidden(undefined, counts)).toEqual([])
    expect(presentTypes(countByType([]))).toEqual([])
  })
})
