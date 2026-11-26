// The "Report issue" action of the documentation portal (docs/.vitepress/theme/report.ts) and the live comparison it
// reports on (analysis.ts, live.ts): the issue body, the URL length limit, the issue form ids and the share links.

import fs from "node:fs"
import path from "node:path"

import { load } from "js-yaml"
import { effectScope, nextTick, ref } from "vue"

import { type Analysis, analyzeTexts, needsSdl, portableAnalysis } from "../../docs/.vitepress/theme/analysis"
import type { CompareOptions } from "../../src"
import {
  decodeState,
  decodeStateAsync,
  encodeState,
  encodeStateCompressed,
  pointer,
} from "../../docs/.vitepress/theme/diff"
import { EXAMPLES, exampleById } from "../../docs/.vitepress/theme/examples"
import { type LiveRunner, useLiveAnalysis, workerRunner } from "../../docs/.vitepress/theme/live"
import {
  FIELD_IDS,
  ISSUE_TEMPLATE,
  MAX_URL_LENGTH,
  NEW_ISSUE_URL,
  PROBLEM_KINDS,
  type ReportInput,
  TEMPLATE_LABELS,
  buildReport,
  issueUrlLength,
  engineOfLabel,
  documentLanguage,
  fenced,
  protoSnippet,
  reportDiff,
} from "../../docs/.vitepress/theme/report"
import { buildProtoText, locateProtoDiff } from "../../docs/.vitepress/theme/proto"
import pkg from "../../package.json"

const root = path.join(import.meta.dirname, "..", "..")

const petstore = (type: string, extra = "") => `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths:
  /pets:
    get:
      responses:
        "200":
          description: A pet
          content:
            application/json:
              schema:
                type: object
                properties:
                  name:
                    type: ${type}
${extra}`

const input = (overrides: Partial<ReportInput> = {}): ReportInput => {
  const analysis = analyzeTexts({ before: petstore("string"), after: petstore("integer") })
  const diffs = analysis.comparison!.result!.diffs.map(reportDiff)
  return {
    kind: "classification",
    expectedType: "risky",
    note: "A type change of a response property should be breaking only for strict clients.",
    version: pkg.version,
    origin: "online demo",
    spec: `${analysis.sides.before.label} (engine openapi)`,
    snippet: 'import { apiCompare } from "api-smart-diff"\n\nconst { diffs, merged } = apiCompare(before, after)',
    diff: diffs[0],
    diffs,
    before: { text: petstore("string"), language: "yaml" },
    after: { text: petstore("integer"), language: "yaml" },
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36",
    shareUrl: "https://udamir.github.io/api-smart-diff/demo#z.abc",
    ...overrides,
  }
}

const params = (url: string) => new URL(url).searchParams

describe("docs portal / report issue", () => {
  it("D-RP-001 the issue URL opens the issue form with the title, a kind label and every field prefilled", () => {
    const report = buildReport(input())
    // the budget counts the URL as GitHub's sign-in redirect carries it (percent-encoded once more)
    expect(issueUrlLength(report.url)).toBe(encodeURIComponent(report.url).length)
    expect(report.url.startsWith(`${NEW_ISSUE_URL}?template=${ISSUE_TEMPLATE}&`)).toBe(true)
    expect(issueUrlLength(report.url)).toBeLessThanOrEqual(MAX_URL_LENGTH)
    const query = params(report.url)
    // the description names the change, shortened to keep the title at 120 characters with the expected type
    expect(query.get("title")).toMatch(
      /^Wrong classification: breaking: \[Replaced\] type definition of `name` from `string` to `integer` .*… \(expected risky\)$/,
    )
    expect(query.get("title")!.length).toBe(120)
    expect(query.get("labels")).toBe("classification")
    expect(query.get("problem")).toBe("Wrong classification")
    expect(query.get("expected")).toBe("risky")
    expect(query.get("details")).toContain("strict clients")
    expect(query.get("version")).toBe(pkg.version)
    expect(query.get("environment")).toContain("Chrome/140.0")
    expect(query.get("link")).toBe("https://udamir.github.io/api-smart-diff/demo#z.abc")
    // the reported diff and the list
    const diffs = query.get("diffs")!
    expect(diffs).toContain(
      "Reported diff:\n\n- **breaking** replace `/paths/~1pets/get/responses/200/content/application~1json/schema/properties/name/type` (response): ",
    )
    expect(diffs).toContain("All diffs — 1 diff: 1 breaking.")
    // a ready apiCompare call with the detected specification
    expect(query.get("reproduction")).toContain("Specification: OpenAPI 3.1.0 · YAML (engine openapi)")
    expect(query.get("reproduction")).toContain('```ts\nimport { apiCompare } from "api-smart-diff"')
    // both documents, fenced as YAML
    expect(query.get("documents")).toBe(
      `Before:\n\n\`\`\`yaml\n${petstore("string").trimEnd()}\n\`\`\`\n\nAfter:\n\n\`\`\`yaml\n${petstore("integer").trimEnd()}\n\`\`\``,
    )
    expect(report.omitted).toEqual({ documents: false, diffs: false, link: false, details: false })
    // the URL parameters are the issue form's field ids, nothing else
    expect([...query.keys()].sort()).toEqual(["labels", "template", "title", ...FIELD_IDS].sort())
  })

  it("D-RP-002 the Markdown report holds every section; a report without a diff names the comparison", () => {
    const markdown = buildReport(input()).markdown
    for (const part of [
      "**Problem**: Wrong classification",
      "**Expected**: risky",
      "### What is wrong",
      "### Diffs",
      "### Reproduction",
      "### Documents",
      `- api-smart-diff: ${pkg.version}`,
      "- Browser: Mozilla/5.0",
      "- Portal link: https://udamir.github.io/api-smart-diff/demo#z.abc",
    ]) {
      expect(markdown).toContain(part)
    }
    const whole = buildReport(input({ kind: "missing", diff: undefined, expectedType: undefined, note: "" }))
    expect(whole.title).toBe("Missing change: OpenAPI 3.1.0 · YAML (engine openapi) (online demo)")
    expect(params(whole.url).get("labels")).toBe("missing-change")
    expect(params(whole.url).has("details")).toBe(false)
    expect(whole.markdown).toContain("_No details given._")
    // "other" has no kind label (the issue form adds bug and portal-report itself)
    expect(params(buildReport(input({ kind: "other" })).url).has("labels")).toBe(false)
    // a failure is part of the diffs field
    const crash = buildReport(
      input({ kind: "crash", diff: undefined, diffs: [], failure: "Parse error: bad indentation" }),
    )
    expect(params(crash.url).get("diffs")).toContain("Failure:\n\n```\nParse error: bad indentation\n```")
    expect(params(crash.url).get("labels")).toBe("crash")
  })

  it("D-RP-003 the ids, the labels and the problem kinds match the issue form", () => {
    const form = load(fs.readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/bug_report.yml"), "utf8")) as {
      labels: string[]
      body: { type: string; id?: string; attributes: { description?: string } }[]
    }
    const ids = form.body.filter((item) => item.id).map((item) => item.id)
    expect(ids).toEqual([...FIELD_IDS])
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
    }
    expect(form.labels).toEqual([...TEMPLATE_LABELS])
    const problem = form.body.find((item) => item.id === "problem")!.attributes.description!
    for (const kind of PROBLEM_KINDS) {
      expect(problem).toContain(kind.label)
    }
    expect(fs.existsSync(path.join(root, ".github/ISSUE_TEMPLATE/config.yml"))).toBe(true)
  })

  it("D-RP-004 documents too large for the URL are left out, the link and the diff stay, the Markdown keeps them", () => {
    const properties = Array.from(
      { length: 400 },
      (_, i) => `                  field${i}:\n                    type: string\n`,
    ).join("")
    const before = petstore("string", properties)
    const after = petstore("integer", properties)
    const report = buildReport(
      input({ before: { text: before, language: "yaml" }, after: { text: after, language: "yaml" } }),
    )
    expect(issueUrlLength(report.url)).toBeLessThanOrEqual(MAX_URL_LENGTH)
    expect(report.omitted.documents).toBe(true)
    expect(report.omitted.link).toBe(false)
    const query = params(report.url)
    expect(query.get("documents")).toContain("too large for the issue link")
    expect(query.get("documents")).toContain("Copy documents")
    expect(query.get("link")).toBe("https://udamir.github.io/api-smart-diff/demo#z.abc")
    expect(query.get("diffs")).toContain("Reported diff:")
    expect(report.markdown).toContain(before.trimEnd())
    expect(report.documentsMarkdown).toContain(after.trimEnd())
  })

  it("D-RP-005 a long diff list is shortened, then the link and the note, and the URL never exceeds the limit", () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({
      type: "breaking" as const,
      action: "remove" as const,
      path: `/paths/~1pets/get/parameters/${i}`,
      scope: "request",
      description: `[Removed] query parameter \`p${i}\` of operation GET /pets`,
    }))
    const list = buildReport(input({ diffs: many }))
    expect(issueUrlLength(list.url)).toBeLessThanOrEqual(MAX_URL_LENGTH)
    expect(list.omitted.diffs).toBe(true)
    const diffs = params(list.url).get("diffs")!
    expect(diffs).toContain("All diffs — 2000 diffs: 2000 breaking.")
    expect(diffs).toMatch(/… \d+ more \(open the portal link to see all of them\)\./)
    expect(diffs).toContain("Reported diff:")
    expect(list.markdown).toContain("`/paths/~1pets/get/parameters/1999`")

    const huge = buildReport(
      input({
        diffs: many,
        note: "x".repeat(20_000),
        shareUrl: `https://udamir.github.io/api-smart-diff/demo#z.${"a".repeat(9000)}`,
      }),
    )
    expect(issueUrlLength(huge.url)).toBeLessThanOrEqual(MAX_URL_LENGTH)
    expect(huge.omitted).toEqual({ documents: true, diffs: true, link: true, details: true })
    expect(params(huge.url).get("details")!.endsWith("\n…")).toBe(true)
    // a smaller limit is honoured as well
    expect(issueUrlLength(buildReport(input({ diffs: many }), 3000).url)).toBeLessThanOrEqual(3000)
  })

  it("D-RP-006 documents are fenced so that their own backticks cannot close the fence", () => {
    expect(fenced("a ``` b", "yaml")).toBe("````yaml\na ``` b\n````")
    expect(fenced("plain\n\n")).toBe("```\nplain\n```")
    const report = buildReport(input({ before: { text: 'description: "````"\n', language: "yaml" } }))
    expect(params(report.url).get("documents")).toContain('`````yaml\ndescription: "````"\n`````')
  })

  it("D-RP-007 helpers: diff pointers and the engine of a detected specification", () => {
    expect(reportDiff({ type: "annotation", action: "add", path: [], scope: "root" }).path).toBe("")
    expect(reportDiff({ type: "breaking", action: "add", path: ["paths", "/a~b", 0], scope: "request" }).path).toBe(
      pointer(["paths", "/a~b", 0]),
    )
    expect(engineOfLabel("AsyncAPI 3.0.0 · YAML")).toBe("asyncapi")
    expect(engineOfLabel("GraphQL SDL → GraphApi 1.0.0")).toBe("graphapi")
    expect(engineOfLabel("JSON Schema draft-07 · JSON")).toBe("jsonschema")
    expect(engineOfLabel("Unsupported document")).toBeUndefined()
  })
})

describe("docs portal / share links", () => {
  it("D-RP-008 a report about `.proto` input holds the sources, the protoapi build and the compatibility level", () => {
    const example = exampleById("proto-field-rename")
    const options = { compatibility: "WIRE_JSON" } as CompareOptions
    const analysis = analyzeTexts({ before: example.before, after: example.after, options }, undefined, {
      build: buildProtoText,
      locate: locateProtoDiff,
    })
    const diffs = analysis.comparison!.result!.diffs.map(reportDiff)
    const report = buildReport(
      input({
        spec: `${analysis.sides.before.label} (engine ${engineOfLabel(analysis.sides.before.label)}, compatibility WIRE_JSON)`,
        snippet: protoSnippet("WIRE_JSON"),
        diff: diffs[0],
        diffs,
        before: { text: example.before, language: documentLanguage(example.before, false, true) },
        after: { text: example.after, language: documentLanguage(example.after, false, true) },
      }),
    )
    const fields = params(report.url)
    expect(report.omitted.documents).toBe(false)
    expect(fields.get("documents")).toContain('```proto\nsyntax = "proto3";')
    expect(fields.get("documents")).toContain("string buyer_id = 2;")
    expect(fields.get("reproduction")).toContain(
      "Specification: .proto → ProtoApi 0.1 (engine protoapi, compatibility WIRE_JSON)",
    )
    expect(fields.get("reproduction")).toContain('buildFromProto(beforeFiles, { imports: "user" })')
    expect(fields.get("reproduction")).toContain('apiCompare(before, after, { compatibility: "WIRE_JSON" })')
    expect(fields.get("diffs")).toContain(
      "- **breaking** rename `/components/messages/shop.v1.Order/properties` (components)",
    )
    expect(report.markdown).toContain("```proto\n")
    // the default level writes no option
    expect(protoSnippet()).toMatch(/apiCompare\(before, after\)$/)
  })

  it("D-SH-001 a compressed share link restores the documents and the demo options", async () => {
    const state = {
      before: petstore("string", "# ünïcödé ✓\n"),
      after: petstore("integer"),
      options: { engine: "openapi" as const, components: "unclassified" as const },
    }
    const hash = await encodeStateCompressed(state)
    expect(hash.startsWith("z.")).toBe(true)
    expect(hash).toMatch(/^z\.[A-Za-z0-9_-]+$/)
    expect(await decodeStateAsync(hash)).toEqual(state)
    // compressed links are much shorter than plain ones for real documents
    expect(hash.length).toBeLessThan(encodeState(state).length / 2)
    // plain links (examples, earlier portal builds) still work, synchronously and asynchronously
    const plain = encodeState({ before: "a: 1\n", after: "a: 2\n" })
    expect(decodeState(plain)).toEqual({ before: "a: 1\n", after: "a: 2\n" })
    expect(await decodeStateAsync(plain)).toEqual({ before: "a: 1\n", after: "a: 2\n" })
    expect(decodeState(hash)).toBeUndefined()
    expect(await decodeStateAsync("z.not-deflate")).toBeUndefined()
  })

  it("D-SH-002 option values a demo select does not offer are dropped from a link", async () => {
    const hash = await encodeStateCompressed({
      before: "a: 1\n",
      after: "a: 2\n",
      // (`merged` is an option of earlier portal builds)
      options: { engine: "evil" as never, merged: "normalized", components: "unclassified" } as never,
    })
    expect(await decodeStateAsync(hash)).toEqual({
      before: "a: 1\n",
      after: "a: 2\n",
      options: { components: "unclassified" },
    })
    // no options: the link has none either
    expect(await decodeStateAsync(await encodeStateCompressed({ before: "a", after: "b", options: {} }))).toEqual({
      before: "a",
      after: "b",
    })
  })
})

describe("docs portal / live comparison", () => {
  it("D-LV-001 a document that does not parse is an input error, without a result", () => {
    const analysis = analyzeTexts({ before: petstore("string"), after: "openapi: 3.1.0\npaths:\n  /a: [\n" })
    expect(analysis.inputError).toMatch(/^After: Parse error: /)
    expect(analysis.comparison).toBeUndefined()
    expect(analysis.sides.before.label).toBe("OpenAPI 3.1.0 · YAML")
    expect(analysis.sides.after.error).toMatch(/^Parse error/)
    // an empty editor is no error and no result
    expect(analyzeTexts({ before: petstore("string"), after: "  " })).toEqual({
      sides: {
        before: { sdl: false, label: "OpenAPI 3.1.0 · YAML" },
        after: { sdl: false, label: "", error: "Parse error: The document is empty" },
      },
    })
    // GraphQL SDL needs the converter, a YAML document does not
    expect(needsSdl({ before: "type Query {\n  a: Int\n}\n", after: "a: 1" })).toBe(true)
    expect(needsSdl({ before: petstore("string"), after: petstore("integer") })).toBe(false)
  })

  it("D-LV-002 the analysis sent from the worker is structured-cloneable and keeps the diffs and the merged text", () => {
    const analysis = analyzeTexts({ before: petstore("string"), after: petstore("integer"), format: "json" })
    const portable = portableAnalysis(analysis)
    const cloned = structuredClone(portable)
    expect(cloned.comparison!.result!.diffs).toEqual(analysis.comparison!.result!.diffs)
    expect(cloned.comparison!.result!.merged).toBeUndefined()
    expect(JSON.parse(cloned.mergedText!).paths["/pets"].get.responses["200"]).toBeDefined()
  })

  it("D-LV-003 edits are debounced, a running comparison is not interrupted, and the edits made meanwhile are compared once with the latest text", async () => {
    vi.useFakeTimers()
    try {
      const requests: string[] = []
      const releases: (() => void)[] = []
      const runner: LiveRunner = {
        run: (request) => {
          requests.push(request.after)
          return new Promise<Analysis>((resolve) => releases.push(() => resolve(analyzeTexts(request))))
        },
      }
      const after = ref(petstore("integer"))
      const scope = effectScope()
      const live = scope.run(() =>
        useLiveAnalysis(() => ({ before: petstore("string"), after: after.value }), runner, 250),
      )!
      // the first comparison starts at once
      expect(requests).toHaveLength(1)
      releases.shift()!()
      await vi.runAllTimersAsync()
      expect(live.analysis.value?.comparison?.result?.diffs).toHaveLength(1)
      expect(live.busy.value).toBe(false)

      // typing: nothing is compared before the pause
      for (const type of ["n", "nu", "num", "number"]) {
        after.value = petstore(type)
        await nextTick()
        await vi.advanceTimersByTimeAsync(100)
      }
      expect(requests).toHaveLength(1)
      expect(live.busy.value).toBe(true)
      await vi.advanceTimersByTimeAsync(250)
      expect(requests).toHaveLength(2)

      // edits while that comparison runs are coalesced into one more comparison, with the latest text
      after.value = petstore("boolean")
      await nextTick()
      await vi.advanceTimersByTimeAsync(300)
      after.value = petstore("array")
      await nextTick()
      await vi.advanceTimersByTimeAsync(300)
      expect(requests).toHaveLength(2)
      releases.shift()!()
      await vi.advanceTimersByTimeAsync(0)
      expect(requests).toHaveLength(3)
      expect(requests[2]).toBe(petstore("array"))
      releases.shift()!()
      await vi.advanceTimersByTimeAsync(0)
      expect(live.busy.value).toBe(false)

      // invalid input keeps the last result, marked stale; valid input clears the mark
      after.value = "openapi: 3.1.0\npaths: [\n"
      await nextTick()
      await vi.advanceTimersByTimeAsync(250)
      releases.shift()!()
      await vi.advanceTimersByTimeAsync(0)
      expect(live.inputError.value).toMatch(/^After: Parse error/)
      expect(live.stale.value).toBe(true)
      expect(live.analysis.value?.comparison?.result?.diffs).toHaveLength(1)
      after.value = petstore("string")
      await nextTick()
      await vi.advanceTimersByTimeAsync(250)
      releases.shift()!()
      await vi.advanceTimersByTimeAsync(0)
      expect(live.stale.value).toBe(false)
      expect(live.analysis.value?.comparison?.result?.diffs).toEqual([])
      scope.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it("D-LV-004 the worker runner falls back to the page when the worker cannot be created or fails", async () => {
    const request = { before: petstore("string"), after: petstore("integer") }
    const noWorker = workerRunner(() => {
      throw new Error("no workers here")
    })
    expect((await noWorker.run(request)).comparison?.result?.diffs).toHaveLength(1)

    let fail: ((event: unknown) => void) | null = null
    const failing = workerRunner(() => {
      const worker = {
        postMessage: () => setTimeout(() => fail?.(new Error("worker crashed"))),
        terminate: () => undefined,
        onmessage: null,
        onerror: null as ((event: unknown) => void) | null,
      }
      queueMicrotask(() => (fail = worker.onerror))
      return worker
    })
    await Promise.resolve()
    expect((await failing.run(request)).comparison?.result?.diffs).toHaveLength(1)
  })

  it("D-LV-005 every example with options compares in the page (its options are not sent to a worker)", () => {
    for (const example of EXAMPLES.filter((item) => item.options)) {
      const analysis = analyzeTexts({ before: example.before, after: example.after, options: example.options })
      expect(analysis.comparison?.failure).toBeUndefined()
      expect(analysis.comparison?.result?.diffs.length).toBe(example.expected.length)
    }
  })
})
