import fs from "node:fs"
import path from "node:path"

import * as api from "../../../src"

// Release readiness checks of the 2.0.0 task (temp/TASK_2.0.0_COMPLETENESS.md §1).

// the online demo is a page of the documentation portal (docs/demo.md): a Vue component that runs the engine from the
// sources through the shared helpers in docs/.vitepress/theme/diff.ts, with the showcase documents in presets.ts
const theme = path.join(import.meta.dirname, "..", "..", "..", "docs", ".vitepress", "theme")
const read = (...file: string[]) => fs.readFileSync(path.join(theme, ...file), "utf8")
const demo = read("components", "DiffDemo.vue")
const runtime = read("diff.ts")
const presets = read("presets.ts")

describe("compat core / release", () => {
  it("X-REL-001 the public API no longer exports apiDiff / apiMerge (decision §11.11)", () => {
    expect("apiDiff" in api).toBe(false)
    expect("apiMerge" in api).toBe(false)
    expect(typeof api.apiCompare).toBe("function")
  })

  // ISSUE-59 (fixed): the online demo runs the 2.x API (`apiCompare` instead of the removed `apiDiff` / `apiMerge`), shows
  // `scope` and the `risky` class, and ships OpenAPI, AsyncAPI 2 / 3, JSON Schema and GraphApi examples. Since the
  // documentation portal it is docs/demo.md, which bundles the engine from the local sources instead of loading
  // `dist/api-smart-diff.min.js`.
  it("X-REL-002 the online demo uses the 2.x API [ISSUE-59]", () => {
    for (const text of [demo, runtime]) {
      expect(text).not.toMatch(/\bapi(Diff|Merge)\b/)
      expect(text).not.toMatch(/api-smart-diff@1\./)
    }
    expect(runtime).toMatch(/\bapiCompare\(/)
    expect(runtime).toMatch(/from "\.\.\/\.\.\/\.\.\/src"/)
    expect(runtime).toMatch(/"risky"/)
    // the result (table and raw YAML view) of the portal: the YAML view writes the `scope` of every diff
    expect(demo).toMatch(/<DiffResults\b/)
    expect(read("components", "DiffResults.vue")).toMatch(/<DiffTable\b/)
    expect(read("components", "DiffResults.vue")).toMatch(/<DiffsYaml\b/)
    expect(runtime).toMatch(/const DIFF_KEYS = \[[^\]]*"scope"/)
    for (const marker of [/openapi: 3\./, /asyncapi: 2\./, /asyncapi: 3\./, /\$schema: /, /graphapi: /]) {
      expect(presets).toMatch(marker)
    }
  })
})
