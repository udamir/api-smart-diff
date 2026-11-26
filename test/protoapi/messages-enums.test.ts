import { caseTitle, checkCase } from "./fixtures/matrix"
import { messageEnumCases } from "./fixtures/matrix-cases"

// J7: the classification matrix rows of messages and enums (§6.3, §6.5) at FILE (phase Q3). Every case asserts its record's class and that
// the comparison has no other record than the case lists (R-1); J6 runs the same cases at PACKAGE, WIRE_JSON and WIRE.

describe("Block J7 — ProtoApi messages and enums (§6.3, §6.5) at FILE", () => {
  for (const item of messageEnumCases) {
    it(caseTitle(item), () => checkCase(item, ["FILE"]))
  }
})
