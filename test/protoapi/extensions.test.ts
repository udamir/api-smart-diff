import { caseTitle, checkCase } from "./fixtures/matrix"
import { extensionCases } from "./fixtures/matrix-cases"

// J8: the classification matrix rows of extensions (§6.6) at FILE (phase Q3). Every case asserts its record's class and that
// the comparison has no other record than the case lists (R-1); J6 runs the same cases at PACKAGE, WIRE_JSON and WIRE.

describe("Block J8 — ProtoApi extensions (§6.6) at FILE", () => {
  for (const item of extensionCases) {
    it(caseTitle(item), () => checkCase(item, ["FILE"]))
  }
})
