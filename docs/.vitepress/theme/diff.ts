/**
 * What the online demo and the live examples run: parsing of the editors (JSON or YAML), specification detection, the
 * comparison itself (`apiCompare` from the local sources) and the rendering helpers. Shared with the example test, so
 * the page and the test run exactly the same code.
 */
import { dump, load } from "js-yaml"

import { UnsupportedSpecError, apiCompare, detectSpec } from "../../../src"
import type { CompareError, CompareOptions, CompareResult, Diff, DiffType, ProtoApiCompatibility } from "../../../src"

export type TextFormat = "yaml" | "json"
/** Editor languages (`text` for GraphQL SDL, which is not highlighted; `proto` for Protocol Buffers sources) */
export type Language = TextFormat | "proto" | "text"

/** The editor language of a text: `.proto` sources, JSON or YAML */
export const languageOf = (text: string): Language =>
  looksLikeProto(text) && !/^\s*[{[]/.test(text) ? "proto" : formatOf(text)

/** Diff types from the most to the least severe (the order of the summary chips and of the colours) */
export const DIFF_TYPES: DiffType[] = ["breaking", "risky", "non-breaking", "deprecated", "annotation", "unclassified"]

export const DIFF_TYPE_HINTS: Record<DiffType, string> = {
  breaking: "existing clients fail",
  risky: "valid for most clients, can break some",
  "non-breaking": "existing clients keep working",
  deprecated: "a deprecation flag or reason changed",
  annotation: "documentation and metadata only",
  unclassified: "no rule applies",
}

/** Parses an editor: JSON first (exact error positions), YAML otherwise (JSON is valid YAML too) */
export const parseDocument = (text: string): unknown => {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error("The document is empty")
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // not strict JSON (comments, trailing commas, YAML flow style): read it as YAML
    }
  }
  return load(text)
}

/** Text that does not parse as a YAML / JSON document but reads like GraphQL type definitions */
export const looksLikeSdl = (text: string): boolean =>
  /^\s*(?:"""[\s\S]*?"""\s*|"[^"\n]*"\s*|#[^\n]*\n\s*)*(?:schema|type|input|enum|interface|union|scalar|directive|extend)\b[^:\n]*(?:\{|$|=|@|implements)/m.test(
    text,
  )

// ---- Protocol Buffers input ------------------------------------------------------------------------------------

/** The compatibility levels of the ProtoApi engine (`options.compatibility`), from the strictest to the most lenient */
export const PROTO_LEVELS: readonly ProtoApiCompatibility[] = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"]

/** What each level protects (the level selectors show it as a hint) */
export const PROTO_LEVEL_HINTS: Record<ProtoApiCompatibility, string> = {
  FILE: "binary and ProtoJSON clients, and generated code per file (the default)",
  PACKAGE:
    "binary and ProtoJSON clients, and generated code per package (moving a declaration between files of a package is no change)",
  WIRE_JSON: "binary and ProtoJSON clients, not generated code",
  WIRE: "binary clients only",
}

/** File of an editor that holds `.proto` text without a `// file: <path>` line */
export const DEFAULT_PROTO_FILE = "api.proto"

/**
 * Text that does not parse as a YAML / JSON document but reads like Protocol Buffers sources: a `syntax` or `edition`
 * statement, a `package` statement or a `message` / `service` definition at the start of a line.
 */
export const looksLikeProto = (text: string): boolean =>
  /^\s*(?:(?:syntax|edition)\s*=\s*["']|package\s+[\w.]+\s*;|(?:message|service)\s+\w+\s*\{)/m.test(text)

export interface ProtoFileText {
  /** import path of the file */
  path: string
  text: string
  /** zero-based editor line of the first line of the file */
  line: number
}

const FILE_MARKER = /^\/\/ file: (\S+)\s*$/

/**
 * The `.proto` files of an editor: one file (`api.proto`) or several, each introduced by a line `// file: <path>`
 * (so one editor can hold a file and the files it imports). The marker lines are not part of the files.
 */
export const splitProtoFiles = (text: string): ProtoFileText[] => {
  const lines = text.split("\n")
  const files: ProtoFileText[] = []
  let current: { path: string; line: number; lines: string[] } = { path: DEFAULT_PROTO_FILE, line: 0, lines: [] }
  const flush = (marked: boolean) => {
    const body = current.lines.join("\n")
    // the text above the first marker is a file of its own only when it holds more than blank lines
    if (marked || body.trim()) {
      files.push({ path: current.path, text: body, line: current.line })
    }
  }
  let marked = false
  lines.forEach((line, index) => {
    const marker = FILE_MARKER.exec(line)
    if (marker) {
      flush(marked)
      marked = true
      current = { path: marker[1], line: index + 1, lines: [] }
    } else {
      current.lines.push(line)
    }
  })
  flush(marked)
  return files
}

export const formatOf = (text: string): TextFormat => (/^\s*[{[]/.test(text) ? "json" : "yaml")

export const serialize = (value: unknown, format: TextFormat): string =>
  format === "yaml"
    ? dump(value, { noRefs: true, lineWidth: 120 })
    : `${JSON.stringify(value, (_key, item) => (item === undefined ? null : item), 2)}\n`

/** Converts a document to the other text format (keeps text that is not a JSON / YAML object, such as SDL) */
export const convertText = (text: string, format: TextFormat): string => {
  try {
    const document = parseDocument(text)
    return document && typeof document === "object" ? serialize(document, format) : text
  } catch {
    return text
  }
}

/** Human-readable name of the specification of a document, as `apiCompare` detects it */
export const specLabel = (document: unknown): string => {
  try {
    const { engine, version } = detectSpec(document)
    switch (engine) {
      case "openapi":
        return `OpenAPI ${version}`
      case "asyncapi":
        return `AsyncAPI ${version}`
      case "graphapi":
        return `GraphApi ${version}`
      case "protoapi":
        return `ProtoApi ${version}`
      default: {
        const $schema =
          document && typeof document === "object" ? (document as Record<string, unknown>).$schema : undefined
        const draft = typeof $schema === "string" ? /draft-0[467]|2020-12|2019-09/.exec($schema)?.[0] : undefined
        return `JSON Schema${draft ? ` ${draft}` : ""}`
      }
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** JSON pointer of a diff path (RFC 6901 escaping) */
export const pointer = (path: readonly (string | number)[]): string =>
  path.length ? `/${path.map((segment) => String(segment).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}` : ""

export interface Comparison {
  result?: CompareResult
  /** errors reported through `onError` (classifier, annotation, `$ref`, ...) */
  errors: CompareError[]
  /** the document or the comparison could not be processed */
  failure?: string
}

/** Runs `apiCompare` on two parsed documents, collecting the reported errors instead of throwing */
export const runCompare = (before: unknown, after: unknown, options: CompareOptions = {}): Comparison => {
  const errors: CompareError[] = []
  try {
    const result = apiCompare(before, after, { ...options, onError: (error) => errors.push(error) })
    return { result, errors }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { errors, failure: error instanceof UnsupportedSpecError ? `Unsupported document: ${message}` : message }
  }
}

/** Parses both editors and compares them */
export const compareTexts = (before: string, after: string, options: CompareOptions = {}): Comparison => {
  let documents: [unknown, unknown]
  try {
    documents = [parseDocument(before), parseDocument(after)]
  } catch (error) {
    return { errors: [], failure: `Parse error: ${error instanceof Error ? error.message : String(error)}` }
  }
  return runCompare(documents[0], documents[1], options)
}

export const countByType = (diffs: readonly Diff[]): Record<DiffType, number> => {
  const counts = Object.fromEntries(DIFF_TYPES.map((type) => [type, 0])) as Record<DiffType, number>
  for (const diff of diffs) {
    counts[diff.type] += 1
  }
  return counts
}

/** A short rendering of a diff value for the table (the full value is in the merged document) */
export const previewValue = (value: unknown): string => {
  if (value === undefined) {
    return ""
  }
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}

// ---- raw diffs as YAML ------------------------------------------------------------------------------------------

/** the order of the `Diff` fields in the YAML view (other fields follow in their own order) */
const DIFF_KEYS = ["type", "action", "path", "before", "after", "scope", "origin", "description"]

/**
 * A value as plain data that YAML can show: functions, symbols and bigints become descriptive strings, `undefined`
 * object members are left out (in arrays they become `null`), dates become ISO strings and a circular reference
 * becomes "[circular]". Symbol keys (a symbol `metaKey`) are not enumerable data and are left out.
 */
export const plainValue = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  switch (typeof value) {
    case "function":
      return `[function ${value.name || "anonymous"}]`
    case "symbol":
      return value.toString()
    case "bigint":
      return `${value}n`
    case "number":
      return Number.isFinite(value) ? value : String(value)
    case "object":
      break
    default:
      return value
  }
  if (value === null) {
    return null
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? String(value) : value.toISOString()
  }
  if (seen.has(value)) {
    return "[circular]"
  }
  seen.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item) => (item === undefined ? null : plainValue(item, seen)))
    }
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) {
        result[key] = plainValue(item, seen)
      }
    }
    return result
  } finally {
    seen.delete(value)
  }
}

const orderedDiff = (diff: Diff): Record<string, unknown> => {
  const plain = plainValue(diff) as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of [...DIFF_KEYS, ...Object.keys(plain)]) {
    if (key in plain && !(key in result)) {
      result[key] = plain[key]
    }
  }
  return result
}

const FLOW = "__asd_flow_"

/**
 * The `diffs` array of a comparison as YAML, as the engine returns it (the fields of every `Diff`, nothing added).
 * JSON paths (`path`, `origin.before`, `origin.after`) are written as one-line flow sequences, which YAML reads as
 * the same arrays.
 */
export const diffsYaml = (diffs: readonly Diff[]): string => {
  if (!diffs.length) {
    return "[]\n"
  }
  const flows: string[] = []
  const flow = (path: unknown): unknown => {
    if (!Array.isArray(path)) {
      return path
    }
    flows.push(`[${path.map((segment) => JSON.stringify(segment)).join(", ")}]`)
    return `${FLOW}${flows.length - 1}`
  }
  const items = diffs.map((diff) => {
    const item = orderedDiff(diff)
    if ("path" in item) {
      item.path = flow(item.path)
    }
    const origin = item.origin
    if (origin && typeof origin === "object" && !Array.isArray(origin)) {
      const { before, after, ...rest } = origin as Record<string, unknown>
      item.origin = { before: flow(before), after: flow(after), ...rest }
    }
    return item
  })
  const text = dump(items, { noRefs: true, lineWidth: 120, skipInvalid: true })
  return text.replace(new RegExp(`${FLOW}(\\d+)`, "g"), (_match, index: string) => flows[Number(index)])
}

// ---- shareable demo state ---------------------------------------------------------------------------------------

/** The demo options a share link restores (the demo selects) */
export type DemoOptions = Pick<CompareOptions, "engine" | "merged" | "components"> & {
  /** ProtoApi documents only */
  compatibility?: ProtoApiCompatibility
}

export interface DemoState {
  before: string
  after: string
  options?: DemoOptions
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const fromBase64 = (text: string): Uint8Array => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

const DEMO_OPTION_VALUES: { [K in keyof DemoOptions]-?: readonly string[] } = {
  engine: ["openapi", "asyncapi", "graphapi", "protoapi", "jsonschema"],
  merged: ["original", "normalized"],
  components: ["usage", "unclassified"],
  compatibility: PROTO_LEVELS,
}

const readState = (json: string): DemoState | undefined => {
  const state = JSON.parse(json) as Partial<DemoState>
  if (typeof state.before !== "string" || typeof state.after !== "string") {
    return undefined
  }
  const result: DemoState = { before: state.before, after: state.after }
  if (state.options && typeof state.options === "object") {
    // only the values the demo selects offer (a link is input from anywhere)
    const options: Record<string, string> = {}
    for (const [key, values] of Object.entries(DEMO_OPTION_VALUES)) {
      const value = (state.options as Record<string, unknown>)[key]
      if (typeof value === "string" && values.includes(value)) {
        options[key] = value
      }
    }
    if (Object.keys(options).length) {
      result.options = options as DemoOptions
    }
  }
  return result
}

const stateJson = (state: DemoState): string =>
  JSON.stringify(
    state.options && Object.keys(state.options).length ? state : { before: state.before, after: state.after },
  )

/** The state as plain base64url JSON (synchronous; links of the examples and links of earlier portal builds) */
export const encodeState = (state: DemoState): string => toBase64(new TextEncoder().encode(stateJson(state)))

// prefix of a deflate-compressed state (base64url never contains a ".")
const COMPRESSED = "z."

const pipe = async (bytes: Uint8Array, stream: { readable: ReadableStream; writable: WritableStream }) => {
  const output = new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream)).arrayBuffer()
  return new Uint8Array(await output)
}

/**
 * The state compressed with deflate (`CompressionStream`, available in the browsers of the portal and in Node.js 18+),
 * so that share links stay short enough for an issue URL; plain `encodeState` where compression is not available.
 */
export const encodeStateCompressed = async (state: DemoState): Promise<string> => {
  if (typeof CompressionStream !== "function") {
    return encodeState(state)
  }
  const bytes = await pipe(new TextEncoder().encode(stateJson(state)), new CompressionStream("deflate"))
  return COMPRESSED + toBase64(bytes)
}

/** Reads a plain state (synchronous; `undefined` for a compressed or an invalid one) */
export const decodeState = (hash: string): DemoState | undefined => {
  try {
    return hash.startsWith(COMPRESSED) ? undefined : readState(new TextDecoder().decode(fromBase64(hash)))
  } catch {
    return undefined
  }
}

/** Reads a plain or a compressed state */
export const decodeStateAsync = async (hash: string): Promise<DemoState | undefined> => {
  if (!hash.startsWith(COMPRESSED)) {
    return decodeState(hash)
  }
  try {
    if (typeof DecompressionStream !== "function") {
      return undefined
    }
    const bytes = await pipe(fromBase64(hash.slice(COMPRESSED.length)), new DecompressionStream("deflate"))
    return readState(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}
