import { emptySecurity, includeSecurity } from "../src/utils"

describe("Rules function", () => {
  test("emptySecurity should work correctry", () => {
    expect(emptySecurity([])).toBe(true)
    expect(emptySecurity([{}])).toBe(true)
    expect(emptySecurity(undefined)).toBe(false)
    expect(emptySecurity([{ bearer: [] }])).toBe(false)
    expect(emptySecurity([{ bearer: [], apiKey: [] }])).toBe(false)
    expect(emptySecurity([{ bearer: [] }, { apiKey: [] }])).toBe(false)
  })

  test("includeSecurity should work correctry", () => {
    const globalSecurity = [{ bearer: [] }, { apiKey: [] }]
    expect(includeSecurity(globalSecurity, [{ bearer: [] }])).toBe(true)
    expect(includeSecurity(globalSecurity, [{ apiKey: []}])).toBe(true)
    expect(includeSecurity(globalSecurity, [{}])).toBe(false)
    expect(includeSecurity(globalSecurity, [{ basic: []}])).toBe(false)
    expect(includeSecurity(globalSecurity)).toBe(true)
  })
})