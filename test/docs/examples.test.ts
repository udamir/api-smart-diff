// The documentation portal (docs/) runs the curated examples and the demo presets with the real engine in the
// browser; this test runs the same code (docs/.vitepress/theme/diff.ts) on every example and checks the diffs the
// examples page documents, so the documentation cannot drift from the library. The Protocol Buffers examples are
// `.proto` sources built with protoapi (docs/.vitepress/theme/proto.ts) and documented at every compatibility level.

import fs from "node:fs"
import path from "node:path"

import * as api from "../../src"
import type { CompareOptions } from "../../src"
import { type ProtoBuilder, analyzeTexts, needsProto, needsSdl } from "../../docs/.vitepress/theme/analysis"
import {
  DIFF_TYPES,
  PROTO_LEVELS,
  compareTexts,
  decodeState,
  encodeState,
  looksLikeProto,
  looksLikeSdl,
  parseDocument,
  pointer,
  runCompare,
  specLabel,
  splitProtoFiles,
} from "../../docs/.vitepress/theme/diff"
import { EXAMPLES, SPEC_LABELS } from "../../docs/.vitepress/theme/examples"
import { PRESETS, PROTO_PRESET, SDL_PRESET } from "../../docs/.vitepress/theme/presets"
import { buildProtoText, locateProtoDiff } from "../../docs/.vitepress/theme/proto"
import { sdlToGraphApi } from "../../docs/.vitepress/theme/sdl"

const docs = path.join(import.meta.dirname, "..", "..", "docs")
const read = (file: string) => fs.readFileSync(path.join(docs, file), "utf8")

const key = (diff: { type: string; action: string; path: string; scope: string }) =>
  `${diff.type} ${diff.action} ${diff.path} ${diff.scope}`

const proto: ProtoBuilder = { build: buildProtoText, locate: locateProtoDiff }

/** Builds and compares `.proto` sources the way the page does (analysis.ts with the protoapi builder) */
const compareProto = (before: string, after: string, options?: CompareOptions) =>
  analyzeTexts({ before, after, options }, undefined, proto)

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

  for (const example of EXAMPLES.filter((item) => !item.levels)) {
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

  // `.proto` examples: the documented diffs at every compatibility level, each located in the sources
  for (const example of EXAMPLES.filter((item) => item.levels)) {
    it(`D-EX-003 ${example.id}: ${example.title} (at every compatibility level)`, () => {
      expect(example.spec).toBe("protoapi")
      expect(example.expected).toEqual(example.levels!.FILE)
      expect(looksLikeProto(example.before) && looksLikeProto(example.after)).toBe(true)
      for (const level of PROTO_LEVELS) {
        const analysis = compareProto(example.before, example.after, { compatibility: level } as CompareOptions)
        expect(analysis.inputError).toBeUndefined()
        expect(analysis.buildIssues).toBeUndefined()
        const { result, errors, failure } = analysis.comparison!
        expect(failure).toBeUndefined()
        expect(errors).toEqual([])
        const diffs = result!.diffs
        const actual = diffs.map((diff) => key({ ...diff, path: pointer(diff.path) }))
        expect({ level, diffs: actual.sort() }).toEqual({ level, diffs: example.levels![level].map(key).sort() })
        for (const diff of diffs) {
          expect(diff.description).toBeTruthy()
        }
        // every diff has a source line in one of the editors
        expect(analysis.sourceLines).toHaveLength(diffs.length)
        for (const location of analysis.sourceLines!) {
          expect(location).toBeDefined()
          const text = location!.side === "before" ? example.before : example.after
          expect(location!.from).toBeLessThan(text.split("\n").length)
        }
        expect(analysis.sides.before.label).toBe(".proto → ProtoApi 0.1")
      }
    })
  }

  it("D-EX-010 the `.proto` examples: at least 8, a table documents every level, no class increases from FILE to WIRE", () => {
    const examples = EXAMPLES.filter((item) => item.levels)
    expect(examples.length).toBeGreaterThanOrEqual(8)
    expect(new Set(examples.map((item) => item.group))).toEqual(new Set(["Protocol Buffers"]))
    const page = read("examples/index.md")
    const rank = (type: string) => DIFF_TYPES.length - DIFF_TYPES.indexOf(type as never)
    for (const example of examples) {
      const section = page.slice(page.indexOf(`<DiffExample id="${example.id}" />`))
      for (const level of PROTO_LEVELS) {
        const counts = DIFF_TYPES.map((type) => [type, example.levels![level].filter((d) => d.type === type).length])
          .filter(([, count]) => count)
          .map(([type, count]) => `${count} ${type}`)
          .join(", ")
        expect(section).toContain(`| \`${level}\` | ${counts || "no diffs"} |`)
      }
      // the same diffs at every level, never more severe at a more lenient level
      const byLevel = PROTO_LEVELS.map(
        (level) => new Map(example.levels![level].map((d) => [`${d.action} ${d.path}`, d.type])),
      )
      for (const diff of byLevel[0].keys()) {
        const types = byLevel.map((level) => level.get(diff))
        expect(types.every(Boolean)).toBe(true)
        for (let i = 1; i < types.length; i++) {
          expect(rank(types[i]!)).toBeLessThanOrEqual(rank(types[i - 1]!))
        }
      }
      expect(byLevel.map((level) => level.size)).toEqual(byLevel.map(() => byLevel[0].size))
    }
    // the examples together show every class but deprecated and unclassified at some level
    const shown = new Set(
      examples.flatMap((item) => PROTO_LEVELS.flatMap((level) => item.levels![level].map((d) => d.type))),
    )
    for (const type of ["breaking", "risky", "non-breaking", "annotation"] as const) {
      expect(shown.has(type)).toBe(true)
    }
  })

  it("D-EX-011 the `.proto` preset builds with protoapi, gives the result of the ProtoApi preset and locates every diff", () => {
    expect(looksLikeProto(PROTO_PRESET.before)).toBe(true)
    expect(needsProto({ before: PROTO_PRESET.before, after: PROTO_PRESET.after })).toBe(true)
    expect(needsSdl({ before: PROTO_PRESET.before, after: PROTO_PRESET.after })).toBe(false)
    for (const preset of [...PRESETS, SDL_PRESET]) {
      expect(looksLikeProto(preset.before)).toBe(false)
      expect(needsProto(preset)).toBe(false)
    }
    expect(splitProtoFiles(PROTO_PRESET.before).map((file) => [file.path, file.line])).toEqual([
      ["shop/v1/shop.proto", 1],
    ])
    const yamlPreset = PRESETS.find((preset) => preset.id === "protoapi")!
    for (const level of PROTO_LEVELS) {
      const options = { compatibility: level } as CompareOptions
      const analysis = compareProto(PROTO_PRESET.before, PROTO_PRESET.after, options)
      expect(analysis.buildIssues).toBeUndefined()
      const diffs = analysis.comparison!.result!.diffs
      const fromYaml = compareTexts(yamlPreset.before, yamlPreset.after, options).result!.diffs
      const plain = (list: typeof diffs) =>
        list.map(({ type, action, path, scope, description }) => ({ type, action, path, scope, description }))
      expect(plain(diffs)).toEqual(plain(fromYaml))
      expect(analysis.sourceLines!.every(Boolean)).toBe(true)
      const types = new Set(diffs.map((diff) => diff.type))
      for (const type of ["breaking", "risky", "non-breaking", "deprecated", "annotation"] as const) {
        expect(types.has(type)).toBe(true)
      }
    }
    // the removed rpc lies in the before sources, a changed field in the after sources (editor lines, zero-based)
    const analysis = compareProto(PROTO_PRESET.before, PROTO_PRESET.after)
    const diffs = analysis.comparison!.result!.diffs
    const at = (text: string) => analysis.sourceLines![diffs.findIndex((diff) => diff.description?.includes(text))]!
    const removed = at("[Removed] rpc `CancelOrder`")
    expect(removed.side).toBe("before")
    expect(PROTO_PRESET.before.split("\n")[removed.from]).toContain("rpc CancelOrder(")
    const priority = at("type of field `priority`")
    expect(priority.side).toBe("after")
    expect(PROTO_PRESET.after.split("\n")[priority.from]).toContain("int64 priority = 4;")
  })

  it("D-EX-012 `.proto` build issues: a syntax error is an input error, other issues are warnings", () => {
    const broken = compareProto(PROTO_PRESET.before, PROTO_PRESET.after.replace("message Order {", "message Order {{"))
    expect(broken.inputError).toMatch(/^After: \.proto build: shop\/v1\/shop\.proto:\d+:\d+ \[syntax\]/)
    expect(broken.comparison).toBeUndefined()
    expect(broken.buildIssues?.[0]).toMatchObject({ fatal: true })
    // without the builder `.proto` input is an input error (the page loads protoapi first)
    expect(analyzeTexts({ before: PROTO_PRESET.before, after: PROTO_PRESET.after }).inputError).toMatch(
      /protoapi\) is not loaded/,
    )
    const unknownOption = compareProto(
      'syntax = "proto3";\npackage a;\nmessage M {\n  string s = 1;\n}\n',
      'syntax = "proto3";\npackage a;\nmessage M {\n  string s = 1 [(acme.audit) = true];\n}\n',
    )
    expect(unknownOption.inputError).toBeUndefined()
    expect(unknownOption.buildIssues?.length).toBeGreaterThan(0)
    expect(unknownOption.buildIssues!.every((issue) => !issue.fatal)).toBe(true)
    expect(unknownOption.comparison?.result).toBeDefined()
  })

  it("D-EX-013 protoapi is loaded on demand: only proto.ts imports it, the other modules load proto.ts dynamically", () => {
    const theme = path.join(docs, ".vitepress", "theme")
    const files = [
      ...fs.readdirSync(theme).filter((file) => /\.(ts|vue)$/.test(file)),
      ...fs.readdirSync(path.join(theme, "components")).map((file) => path.join("components", file)),
    ]
    for (const file of files) {
      const text = fs.readFileSync(path.join(theme, file), "utf8")
      const imports = [...text.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gms)]
      for (const [, typeOnly, source] of imports) {
        if (source === "protoapi") {
          expect(file).toBe("proto.ts")
        }
        if (source.endsWith("/proto") && !typeOnly) {
          throw new Error(`${file} imports proto.ts statically`)
        }
      }
    }
    expect(fs.readFileSync(path.join(theme, "analysis.ts"), "utf8")).toMatch(/import\("\.\/proto"\)/)
  })

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
