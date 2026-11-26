import { protoApiCompatibilityLevels, protoApiMatrix, type ProtoApiLevelCells } from "../../src/protoapi/protoapi.const"
import { caseTitle, cellsOf, checkCase, isLevelOrdered, levels, runCase } from "./fixtures/matrix"
import { matrixCases } from "./fixtures/matrix-cases"

// J6 (phase Q3): every case of the matrix blocks J4, J5, J7, J8, J9 and J11 at PACKAGE, WIRE_JSON and WIRE (their
// FILE cell is asserted by the block itself), and the level order invariant of §5.4: a change is never more severe at
// a more lenient level (FILE, PACKAGE, WIRE_JSON, WIRE), over the matrix table of `protoapi.const.ts`, over the spec
// cells of every case and over the classes the engine gives every case at the four levels.

// the matrix key of a case row (`F-46 request` → `F-46.request`)
const matrixKey = (row: string) => row.replace(" ", ".")

describe("Block J6 — ProtoApi compatibility levels", () => {
  it("J6.0 the level order is FILE, PACKAGE, WIRE_JSON, WIRE", () => {
    expect(protoApiCompatibilityLevels).toEqual(levels)
  })

  it("J6.1 every row of the matrix table keeps the level order invariant (§5.4)", () => {
    const unordered = Object.entries(protoApiMatrix)
      .filter(([, cells]) => !isLevelOrdered(cells as ProtoApiLevelCells))
      .map(([row]) => row)
    expect(unordered).toEqual([])
  })

  it("J6.2 the spec cells of every case keep the level order invariant (§5.4)", () => {
    expect(matrixCases.filter((item) => !isLevelOrdered(cellsOf(item))).map((item) => item.id)).toEqual([])
  })

  it("J6.3 every row of the matrix table has a case, and the case cells are the table's", () => {
    const table = protoApiMatrix as Record<string, ProtoApiLevelCells>
    const covered = new Set(matrixCases.map((item) => matrixKey(item.row)))
    expect(Object.keys(table).filter((row) => !covered.has(row))).toEqual([])
    // a case of a row whose class does not depend on the change (rows without a change-dependent note) has the cells
    // of the table
    const differing = matrixCases
      .filter((item) => matrixKey(item.row) in table)
      .filter((item) => cellsOf(item).join() !== table[matrixKey(item.row)].join())
      .map((item) => `${item.id} ${item.row}`)
    expect(differing).toEqual(expectedDiffering)
  })

  it("J6.4 the engine keeps the level order invariant on every case (§5.4)", () => {
    const unordered: string[] = []
    for (const item of matrixCases) {
      const types = levels.map((level) => runCase(item, level).type)
      if (types.some((type) => type === undefined) || !isLevelOrdered(types as never)) {
        unordered.push(`${item.id} ${types.join(" ")}`)
      }
    }
    expect(unordered).toEqual([])
    // every case at four levels
  }, 60_000)

  for (const item of matrixCases) {
    it(`J6.${caseTitle(item)}`, () => checkCase(item, ["PACKAGE", "WIRE_JSON", "WIRE"]))
  }
})

// cases whose cells differ from their row's table entry on purpose: the row's class depends on the change and the case
// is the other variant (F-47 takes the F-3 … F-6 cell, only floored at risky in responses; an explicit visibility
// equal to the effective one is no visibility change, C6)
const expectedDiffering: string[] = ["J5.80 F-47 response", "J7.23 M-19"]
