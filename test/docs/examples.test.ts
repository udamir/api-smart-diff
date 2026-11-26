// The documentation portal (docs/) runs the curated examples and the demo presets with the real engine in the
// browser; this test runs the same code (docs/.vitepress/theme/diff.ts) on every example and checks the diffs the
// examples page documents, so the documentation cannot drift from the library.

import fs from "node:fs"
import path from "node:path"

import * as api from "../../src"
import {
  DIFF_TYPES,
  compareTexts,
  decodeState,
  encodeState,
  looksLikeSdl,
  parseDocument,
  pointer,
  runCompare,
  specLabel,
} from "../../docs/.vitepress/theme/diff"
import { EXAMPLES, SPEC_LABELS } from "../../docs/.vitepress/theme/examples"
import { PRESETS, SDL_PRESET } from "../../docs/.vitepress/theme/presets"
import { sdlToGraphApi } from "../../docs/.vitepress/theme/sdl"

const docs = path.join(import.meta.dirname, "..", "..", "docs")
const read = (file: string) => fs.readFileSync(path.join(docs, file), "utf8")

const key = (diff: { type: string; action: string; path: string; scope: string }) =>
  `${diff.type} ${diff.action} ${diff.path} ${diff.scope}`

describe("docs portal / examples", () => {
  it("D-EX-001 example ids are unique, every specification and every diff type is shown", () => {
    const ids = EXAMPLES.map((example) => example.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const spec of Object.keys(SPEC_LABELS)) {
      expect(EXAMPLES.some((example) => example.spec === spec)).toBe(true)
    }
    const shown = new Set(EXAMPLES.flatMap((example) => example.expected.map((diff) => diff.type)))
    expect([...shown].sort()).toEqual([...DIFF_TYPES].sort())
  })

  it("D-EX-002 the examples page renders every example once, under its title", () => {
    const page = read("examples/index.md")
    for (const example of EXAMPLES) {
      expect(page.split(`<DiffExample id="${example.id}" />`).length - 1).toBe(1)
      expect(page).toContain(`### ${example.title}\n\n${example.summary}\n`)
    }
  })

  for (const example of EXAMPLES) {
    it(`D-EX-003 ${example.id}: ${example.title}`, () => {
      const { result, errors, failure } = compareTexts(example.before, example.after, example.options)
      expect(failure).toBeUndefined()
      expect(errors).toEqual([])
      const diffs = result!.diffs
      const actual = diffs.map((diff) => key({ ...diff, path: pointer(diff.path) }))
      expect(actual.sort()).toEqual(example.expected.map(key).sort())
      for (const diff of diffs) {
        expect(diff.description).toBeTruthy()
      }
      // the example is filed under the specification the engine detects
      const detected = specLabel(parseDocument(example.before)).toLowerCase().replace(/\s/g, "")
      expect(detected).toContain(SPEC_LABELS[example.spec].toLowerCase().replace(/\s/g, ""))
    })
  }

  for (const preset of PRESETS) {
    it(`D-EX-004 demo preset ${preset.id} compares without errors and shows breaking, risky and annotation changes`, () => {
      const { result, errors, failure } = compareTexts(preset.before, preset.after)
      expect(failure).toBeUndefined()
      expect(errors).toEqual([])
      const types = new Set(result!.diffs.map((diff) => diff.type))
      for (const type of ["breaking", "risky", "annotation"] as const) {
        expect(types.has(type)).toBe(true)
      }
      for (const diff of result!.diffs) {
        expect(diff.description).toBeTruthy()
      }
    })
  }

  it("D-EX-005 the GraphQL SDL preset is detected as SDL and converted to GraphApi 1.0", () => {
    expect(looksLikeSdl(SDL_PRESET.before)).toBe(true)
    expect(looksLikeSdl(SDL_PRESET.after)).toBe(true)
    for (const preset of PRESETS) {
      expect(looksLikeSdl(preset.before)).toBe(false)
    }
    const before = sdlToGraphApi(SDL_PRESET.before)
    expect(specLabel(before)).toBe("GraphApi 1.0")
    const { result, errors, failure } = runCompare(before, sdlToGraphApi(SDL_PRESET.after))
    expect(failure).toBeUndefined()
    expect(errors).toEqual([])
    const types = new Set(result!.diffs.map((diff) => diff.type))
    for (const type of ["breaking", "risky", "non-breaking", "deprecated", "annotation"] as const) {
      expect(types.has(type)).toBe(true)
    }
  })

  it("D-EX-006 a shared demo link restores both editors", () => {
    const state = { before: "type: string\n# ünïcødé ✓\n", after: "type: integer\n" }
    expect(decodeState(encodeState(state))).toEqual(state)
    expect(decodeState("not a state")).toBeUndefined()
  })

  it("D-EX-007 parse and compare failures are reported, not thrown", () => {
    expect(compareTexts("", "type: string").failure).toMatch(/Parse error/)
    expect(compareTexts("swagger: '2.0'", "swagger: '2.0'").failure).toMatch(/Unsupported document/)
  })

  it("D-EX-008 the API reference names every public runtime export and every public type", () => {
    const page = read("guide/api.md")
    // the runtime exports of the package entry (the curated public API, pinned by test/core/public-api.test.ts)
    const missing = Object.keys(api).filter((name) => !page.includes(`\`${name}\``))
    expect(missing).toEqual([])
    // the type exports, read from the entry source
    const entry = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "src", "index.ts"), "utf8")
    const types = [...entry.matchAll(/export type \{([^}]*)\}/g)].flatMap((match) =>
      match[1]
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    )
    expect(types.length).toBeGreaterThan(40)
    expect(types.filter((name) => !new RegExp(`\\b${name}\\b`).test(page))).toEqual([])
  })

  it("D-EX-009 the extension example needs no description hook: its values are named (ISSUE-418), the external example refers to whole documents (ISSUE-417)", () => {
    const extension = EXAMPLES.find((example) => example.id === "custom-extension-enum")!
    expect(extension.options?.annotateHook).toBeUndefined()
    const { result } = compareTexts(extension.before, extension.after, extension.options)
    expect(result!.diffs.map((diff) => diff.description ?? "").sort((a, b) => a.localeCompare(b))).toEqual([
      "[Added] value `blue` of extension `x-extensible-enum` in query parameter `color`",
      "[Removed] value `bird` of extension `x-extensible-enum` in query parameter `kind`",
    ])
    const external = EXAMPLES.find((example) => example.id === "openapi-external-sources")!
    expect(external.before).toContain('$ref: "https://example.com/schemas/pet.json"\n')
  })
})
