import { caseTitle, checkCase } from "./fixtures/matrix"
import { serviceCases } from "./fixtures/matrix-cases"

// J4: the classification matrix rows of services and methods (§6.2) at FILE (phase Q3). Every case asserts its record's class and that
// the comparison has no other record than the case lists (R-1); J6 runs the same cases at PACKAGE, WIRE_JSON and WIRE.

describe("Block J4 — ProtoApi services and methods (§6.2) at FILE", () => {
  for (const item of serviceCases) {
    it(caseTitle(item), () => checkCase(item, ["FILE"]))
  }
})
