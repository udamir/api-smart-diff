import { apiDiff, apiMerge, DiffAction } from "../src"

describe("Test array merge", () => {
  it("should be correct diff with array", () => {
    const before = {
      arr: [
        { a: 1, b: 2},  
        { a: 1, b: 3},  
        { a: 3, b: 11},  
        { a: 22, b: 3},  
      ]
    }
    
    const after = {
      arr: [
        { a: 1, b: 3},  
        { a: 5, b: 4 },  
        { a: 2, b: 7 },  
        { a: 1, b: 11 },  
        { a: 3, b: 3 },  
        { a: 22, b: 3 },  
      ]
    }

    const diff = apiDiff(before, after, { strictArrays: false })
    expect(diff.length).toBe(4)
  })

  it("should be correct merge with array", () => {
    const before = {
      arr: [
        { a: 1, b: 2},  
        { a: 1, b: 3},  
        { a: 3, b: 11},  
        { a: 22, b: 3},  
      ]
    }
    
    const after = {
      arr: [
        { a: 1, b: 3},  
        { a: 5, b: 4 },  
        { a: 2, b: 7 },  
        { a: 1, b: 11 },  
        { a: 3, b: 3 },  
        { a: 22, b: 3 },  
      ]
    }

    const merged = apiMerge(before, after, { strictArrays: false })
    expect(merged.$diff.arr.array).toMatchObject({
      4: { action: DiffAction.add },
      5: { action: DiffAction.add },
    })
    expect(merged.arr[0].$diff.b).toMatchObject({ action: DiffAction.replace, replaced: 2 })
    expect(merged.arr[2].$diff.b).toMatchObject({ action: DiffAction.replace, replaced: 11 })
  })
})