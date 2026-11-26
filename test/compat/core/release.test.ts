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
  // `scope` and the `risky` class, and ships OpenAPI, AsyncAPI 2 / 3, JSON Schema, GraphApi and ProtoApi examples. Since
  // the documentation portal it is docs/demo.md, which bundles the engine from the local sources instead of loading
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
    for (const marker of [/openapi: 3\./, /asyncapi: 2\./, /asyncapi: 3\./, /\$schema: /, /graphapi: /, /protoapi: /]) {
      expect(presets).toMatch(marker)
    }
    // ProtoApi (PROTOAPI_DESIGN §9.6, moved to the portal): a `.proto` preset and `.proto` input built with the
    // protoapi devDependency bundled into the portal (no CDN), loaded on demand by analysis.ts, a compatibility select
    // with the four levels, and source locations through protoapi's `locateDiff`
    expect(presets).toMatch(/syntax = "proto3";/)
    const proto = read("proto.ts")
    expect(proto).toMatch(/from "protoapi"/)
    expect(proto).toMatch(/\bbuildFromProto\(/)
    expect(proto).toMatch(/\blocateDiff\(/)
    expect(read("analysis.ts")).toMatch(/import\("\.\/proto"\)/)
    for (const file of [demo, runtime, read("analysis.ts")]) {
      expect(file).not.toMatch(/^import [^\n]*from "protoapi"/m)
      expect(file).not.toMatch(/https?:[^"]*protoapi/)
    }
    expect(demo).toMatch(/v-for="level in PROTO_LEVELS"/)
    expect(runtime).toMatch(
      /PROTO_LEVELS: readonly ProtoApiCompatibility\[\] = \["FILE", "PACKAGE", "WIRE_JSON", "WIRE"\]/,
    )
  })
})
