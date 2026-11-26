import { caseTitle, checkCase } from "./fixtures/matrix"
import { fieldCases } from "./fixtures/matrix-cases"

// J5: the classification matrix rows of fields (§6.4) at FILE (phase Q3). Every case asserts its record's class and that
// the comparison has no other record than the case lists (R-1); J6 runs the same cases at PACKAGE, WIRE_JSON and WIRE.

describe("Block J5 — ProtoApi fields (§6.4) at FILE", () => {
  for (const item of fieldCases) {
    it(caseTitle(item), () => checkCase(item, ["FILE"]))
  }
})
