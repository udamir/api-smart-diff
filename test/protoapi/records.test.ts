import { type ProtoApiCompatibility } from "../../src"
import { diffElement } from "../../src/protoapi/protoapi.utils"
import { recordsByElement } from "../../src/protoapi/protoapi.merge"
import { protoCompare, protoDocs } from "../helpers"
import { catalogueCases } from "./fixtures/catalogue"
import { type SingleEditCase, singleEdits } from "./fixtures/single-edits"
import { deepFreeze, singleEditDocuments as documents } from "./fixtures/single-edit-documents"

// J15: one record per element per source change (R-1, §4.9). Every single edit of the corpus and every before / after
// pair of the description catalogue W-01 … W-39 (§7.2) is compared at the four levels with frozen inputs; the records
// are grouped by element (`elementOf`) and their counts asserted exactly, and every description passes the R-D lint
// (`protoCompare`). Known defects run as `it.fails` with their ISSUE id (none since Q4).

const levels: ProtoApiCompatibility[] = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]

const check = (item: SingleEditCase) => {
  const { before, after } = documents(item)
  for (const compatibility of levels) {
    const { diffs, errors } = protoCompare(before, after, { compatibility })
    expect(errors).toBeUndefined()
    const counts = Object.fromEntries(recordsByElement(diffs))
    expect({ level: compatibility, records: counts }).toEqual({ level: compatibility, records: item.expect })
  }
}

const title = (item: SingleEditCase) => `J15.${item.id} [${item.cls}]${item.note ? ` ${item.note}` : ""}`

describe("Block J15 — ProtoApi records per element (structural single edits)", () => {
  it("J15.0 the corpus builds and every edit applies", () => {
    expect(singleEdits.length).toBeGreaterThan(180)
    for (const item of singleEdits) {
      expect(() => documents(item)).not.toThrow()
    }
    // the element of a rename record is the renamed entry
    expect(
      diffElement({
        action: "rename",
        path: ["components", "messages", "p.M", "properties"],
        before: "a",
        after: "b",
        type: "breaking",
        scope: "components",
      }),
    ).toBe("#/components/messages/p.M/properties/a")
    // builds every base and edited document: slow when the suite runs in parallel
  }, 30_000)

  for (const item of singleEdits) {
    if (!item.pending) {
      it(title(item), () => check(item))
    } else if (item.pending.startsWith("ISSUE-")) {
      // ISSUE-374: one lifted option field sets two keywords (`string.len`, `field_behavior` IMMUTABLE → OUTPUT_ONLY)
      // ISSUE-375: a repeated custom option value is compared by position
      it.fails(`${title(item)} (${item.pending})`, () => check(item))
    }
  }

  for (const item of catalogueCases) {
    it(`J15.${item.id} one record at the owning element (§7.2 catalogue pair)`, () => {
      const docs = protoDocs(item.before, item.after)
      const before = deepFreeze(docs.before)
      const after = deepFreeze(docs.after)
      for (const compatibility of levels) {
        const { diffs } = protoCompare(before, after, { compatibility })
        expect({ level: compatibility, records: Object.fromEntries(recordsByElement(diffs)) }).toEqual({
          level: compatibility,
          records: { [item.element]: 1 },
        })
      }
    })
  }
})
