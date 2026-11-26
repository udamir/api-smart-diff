import {
  annotation,
  breaking,
  compareProtoApi,
  deprecated,
  type Diff,
  type DiffType,
  nonBreaking,
  type ProtoApiCompareOptions,
  type ProtoApiCompatibility,
  risky,
  unclassified,
} from "../../../src"
import { expectProtoWording, type ProtoBuildOptions, type ProtoInput, protoDocs } from "../../helpers"

// Shared runner of the classification matrix blocks J4 … J9 and J11 (PROTOAPI_DESIGN §6, §9.1): one case is one row
// (or one variant of a row) of §6 with a `.proto` pair; its record is found by action and path and its class asserted
// at every level the block runs (J4 … J9, J11: FILE; J6: PACKAGE, WIRE_JSON, WIRE). The cells are the spec's literal
// cells (B, R, N, D, A, U in the order FILE, PACKAGE, WIRE_JSON, WIRE), never read from the engine's own table.

export const levels: ProtoApiCompatibility[] = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]

const letters: Record<string, DiffType> = {
  B: breaking,
  R: risky,
  N: nonBreaking,
  D: deprecated,
  A: annotation,
  U: unclassified,
}

export type MatrixCase = {
  // test id (`J5.12`) and the matrix row (`F-12`, a variant `F-18 packed`)
  id: string
  row: string
  title: string
  before: ProtoInput
  after: ProtoInput
  // `<action> <path>` of the record (path segments joined by `/`; a rename: `rename <path> <before>-><after>`)
  record: string
  // the spec cells "B B B R" (FILE PACKAGE WIRE_JSON WIRE)
  cells: string
  // other records of the comparison (default 0: the record is the only one, R-1)
  others?: number
  options?: ProtoApiCompareOptions
  build?: ProtoBuildOptions
  // changes the built documents (hand-made keys the builder does not write from `.proto` text)
  edit?: (docs: { before: EditableDocument; after: EditableDocument }) => void
}

// a built document opened for hand-made edits
// biome-ignore lint/suspicious/noExplicitAny: fixtures write keys the document type does not declare
type EditableDocument = Record<string, any>

export const header = `syntax = "proto3"; package p;`
export const proto2 = `syntax = "proto2"; package p;`
export const edition2023 = `edition = "2023"; package p;`
export const edition2024 = `edition = "2024"; package p;`

/** The spec cells of a case as diff types. */
export const cellsOf = (item: MatrixCase): DiffType[] => item.cells.split(" ").map((cell) => letters[cell])

export const recordKey = (diff: Diff): string =>
  `${diff.action} ${diff.path.join("/")}${diff.action === "rename" ? ` ${String(diff.before)}->${String(diff.after)}` : ""}`

const documentsOf = (item: MatrixCase) => {
  const docs = protoDocs(item.before, item.after, item.build)
  if (!item.edit) {
    return docs
  }
  const edited = {
    before: structuredClone(docs.before) as EditableDocument,
    after: structuredClone(docs.after) as EditableDocument,
  }
  item.edit(edited)
  return { ...docs, ...edited }
}

/** The class of the case's record and the other records at a level. */
export const runCase = (item: MatrixCase, compatibility: ProtoApiCompatibility) => {
  const { before, after } = documentsOf(item)
  const { diffs, errors } = compareProtoApi(before, after, { ...item.options, compatibility })
  // R-D (J16): every description of the matrix blocks is linted
  expectProtoWording(diffs)
  const record = diffs.find((diff) => recordKey(diff) === item.record)
  return {
    errors,
    type: record?.type,
    records: diffs.map(recordKey),
    others: diffs.filter((diff) => diff !== record).map((diff) => `${recordKey(diff)} ${diff.type}`),
  }
}

/** Asserts the case at the given levels: the record exists with the cell of the level, with `others` other records. */
export const checkCase = (item: MatrixCase, at: ProtoApiCompatibility[]) => {
  const cells = cellsOf(item)
  for (const compatibility of at) {
    const result = runCase(item, compatibility)
    const expected = cells[levels.indexOf(compatibility)]
    expect(result.errors).toBeUndefined()
    expect({ level: compatibility, record: item.record, type: result.type, records: result.records }).toMatchObject({
      level: compatibility,
      record: item.record,
      type: expected,
    })
    expect({ level: compatibility, others: result.others.length, list: result.others }).toMatchObject({
      level: compatibility,
      others: item.others ?? 0,
    })
  }
}

const severity: Record<DiffType, number> = {
  [breaking]: 5,
  [risky]: 4,
  [nonBreaking]: 3,
  [deprecated]: 2,
  [annotation]: 1,
  [unclassified]: 0,
}

/** Whether a row's cells never get more severe from FILE to WIRE (§5.4). */
export const isLevelOrdered = (cells: readonly DiffType[]): boolean =>
  cells.every((cell, index) => index === 0 || severity[cell] <= severity[cells[index - 1]])

export const caseTitle = (item: MatrixCase) => `${item.id} ${item.row}: ${item.title}`
