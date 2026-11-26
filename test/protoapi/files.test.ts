import { caseTitle, checkCase } from "./fixtures/matrix"
import { fileCases } from "./fixtures/matrix-cases"

// J9: the classification matrix rows of document and files (§6.1, U3) at FILE (phase Q3). Every case asserts its record's class and that
// the comparison has no other record than the case lists (R-1); J6 runs the same cases at PACKAGE, WIRE_JSON and WIRE.

describe("Block J9 — ProtoApi document and files (§6.1, U3) at FILE", () => {
  for (const item of fileCases) {
    it(caseTitle(item), () => checkCase(item, ["FILE"]))
  }
})
