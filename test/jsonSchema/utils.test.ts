
import { type Diff, changeDiffsPath } from "../../src"

describe("Comapre array jsonSchema", () => {
  it("should update diffs path correctly", () => {
    const diffs = [
      { path: ["a", "b", "c", "d", "1"] },
      { path: ["a", "b", "c", "d", "1", "2"] },
      { path: ["a", "b", "c", "d", "1", "2", "3"] },
    ] as Diff[]

    expect(changeDiffsPath(diffs, ["a", "b", "c"], ["aa", "bb"])).toMatchObject([
      { path: ["aa", "bb", "d", "1"] },
      { path: ["aa", "bb", "d", "1", "2"] },
      { path: ["aa", "bb", "d", "1", "2", "3"] },
    ])
  })
})
