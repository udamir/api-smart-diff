/**
 * One live comparison of two editors: parsing (JSON, YAML, GraphQL SDL or `.proto` sources), specification detection,
 * `apiCompare` and the merged document as text. The demo runs it in a web worker (`compare.worker.ts`), the examples in the page; both
 * get the same `Analysis`, so a parse error mid-typing can keep the previous result on screen, marked stale.
 */
import { detectSpec } from "../../../src"
import type { CompareEngineName, CompareError, CompareOptions, Diff } from "../../../src"
import {
  type Comparison,
  type TextFormat,
  formatOf,
  looksLikeProto,
  looksLikeSdl,
  parseDocument,
  pointer,
  runCompare,
  serialize,
  specLabel,
} from "./diff"
import { type DiffLocation, diffLocations } from "./location"
import type { ProtoSide, SourceLine } from "./proto"

export interface AnalysisRequest {
  before: string
  after: string
  /** must be structured-cloneable when the request goes to the worker (the demo options are plain values) */
  options?: CompareOptions
  /** format of the merged document text */
  format?: TextFormat
}

export interface SideInfo {
  /** the editor holds GraphQL SDL, converted with gqlapi */
  sdl: boolean
  /** the editor holds `.proto` sources, built with protoapi (absent otherwise) */
  proto?: true
  /** detected specification and text format, empty for an empty editor or an editor that does not parse */
  label: string
  /** parse error of this editor */
  error?: string
}

/** A comparison error without its `error` object (it may not be cloneable) */
export type PlainCompareError = Pick<CompareError, "kind" | "message" | "path" | "scope">

export interface Analysis {
  sides: { before: SideInfo; after: SideInfo }
  /**
   * An editor does not parse (typically mid-typing): there is no new result, the previous one stays valid for the
   * last input that parsed and is shown as stale.
   */
  inputError?: string
  /** absent while an editor is empty */
  comparison?: Comparison
  /** the merged document serialized in the requested format */
  mergedText?: string
  /** `.proto` input: the build issues of both sides (`Before: api.proto:3:5 [syntax] …`), fatal ones first */
  buildIssues?: { fatal: boolean; text: string }[]
  /** `.proto` input: the editor lines of each diff (`locateDiff` of protoapi), by the index of the diff */
  sourceLines?: (SourceLine | undefined)[]
  /** the engine the comparison ran with (`options.engine` or detected from the before document) */
  engine?: CompareEngineName
  /** the API location of every diff of the result, in the order of `comparison.result.diffs` (see location.ts) */
  locations?: DiffLocation[]
}

type SdlConverter = (sdl: string) => unknown

/** The protoapi side of the analysis (proto.ts), loaded on demand */
export interface ProtoBuilder {
  build: (text: string) => ProtoSide
  locate: (diff: Diff, before?: ProtoSide, after?: ProtoSide) => SourceLine | undefined
}

interface Side {
  document?: unknown
  sdl: boolean
  proto?: ProtoSide
  error?: string
}

const isObjectDocument = (value: unknown): boolean => typeof value === "object" && value !== null

const readSide = (text: string, sdl: SdlConverter | undefined, proto: ProtoBuilder | undefined): Side => {
  let parsed: unknown
  let parseError: string | undefined
  try {
    parsed = parseDocument(text)
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error)
  }
  if (!isObjectDocument(parsed) && looksLikeProto(text)) {
    if (!proto) {
      return { sdl: false, error: "the .proto builder (protoapi) is not loaded" }
    }
    let side: ProtoSide
    try {
      side = proto.build(text)
    } catch (error) {
      return { sdl: false, error: `protoapi: ${error instanceof Error ? error.message : String(error)}` }
    }
    const fatal = side.issues.filter((issue) => issue.fatal)
    return fatal.length
      ? { sdl: false, proto: side, error: `.proto build: ${fatal.map((issue) => issue.text).join("; ")}` }
      : { sdl: false, proto: side, document: side.document }
  }
  if (!isObjectDocument(parsed) && looksLikeSdl(text)) {
    if (!sdl) {
      return { sdl: true, error: "the GraphQL SDL converter is not loaded" }
    }
    try {
      return { sdl: true, document: sdl(text) }
    } catch (error) {
      return { sdl: true, error: `GraphQL SDL: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
  if (parseError !== undefined) {
    return { sdl: false, error: `Parse error: ${parseError}` }
  }
  return { sdl: false, document: parsed }
}

const sideInfo = (side: Side, text: string): SideInfo => {
  const proto = side.proto ? ({ proto: true } as const) : {}
  if (!text.trim() || side.error) {
    return { sdl: side.sdl, ...proto, label: "", error: side.error }
  }
  const spec = specLabel(side.document)
  if (side.proto) {
    return { sdl: false, proto: true, label: `.proto → ${spec}` }
  }
  return { sdl: side.sdl, label: side.sdl ? `GraphQL SDL → ${spec}` : `${spec} · ${formatOf(text).toUpperCase()}` }
}

/** Does the editor hold `.proto` sources (text that is not a YAML / JSON object)? */
const isProtoText = (text: string): boolean => {
  if (!looksLikeProto(text)) {
    return false
  }
  try {
    return !isObjectDocument(parseDocument(text))
  } catch {
    return true
  }
}

/** Does any editor hold `.proto` sources (protoapi has to be loaded first)? */
export const needsProto = (request: AnalysisRequest): boolean => [request.before, request.after].some(isProtoText)

/** Does any editor hold GraphQL SDL (the converter has to be loaded first)? */
export const needsSdl = (request: AnalysisRequest): boolean =>
  [request.before, request.after].some((text) => {
    if (!looksLikeSdl(text) || isProtoText(text)) {
      return false
    }
    try {
      return !isObjectDocument(parseDocument(text))
    } catch {
      return true
    }
  })

const protoIssues = (b: Side, a: Side) => {
  const all = [
    ...(b.proto?.issues ?? []).map((issue) => ({ ...issue, text: `Before: ${issue.text}` })),
    ...(a.proto?.issues ?? []).map((issue) => ({ ...issue, text: `After: ${issue.text}` })),
  ]
  return all.length ? { buildIssues: [...all.filter((i) => i.fatal), ...all.filter((i) => !i.fatal)] } : {}
}

/**
 * Analyzes two editors synchronously (`sdl` converts GraphQL SDL, `proto` builds `.proto` sources; without them such
 * input is an input error)
 */
export const analyzeTexts = (request: AnalysisRequest, sdl?: SdlConverter, proto?: ProtoBuilder): Analysis => {
  const { before, after, options = {}, format = "yaml" } = request
  const b = readSide(before, sdl, proto)
  const a = readSide(after, sdl, proto)
  const sides = { before: sideInfo(b, before), after: sideInfo(a, after) }
  const issues = protoIssues(b, a)
  if (!before.trim() || !after.trim()) {
    return { sides, ...issues }
  }
  if (b.error || a.error) {
    const inputError = [b.error && `Before: ${b.error}`, a.error && `After: ${a.error}`].filter(Boolean).join("\n")
    return { sides, inputError, ...issues }
  }
  const comparison = runCompare(b.document, a.document, options)
  const mergedText = comparison.result ? serialize(comparison.result.merged, format) : undefined
  const engine = engineOf(b.document, options)
  let locations: DiffLocation[] | undefined
  if (comparison.result && engine) {
    try {
      const context = { engine, before: b.document, after: a.document, merged: comparison.result.merged }
      locations = diffLocations(comparison.result.diffs, context)
    } catch {
      // a location is a reading aid: a document it cannot read leaves the location columns empty
      locations = undefined
    }
  }
  if (proto && (b.proto || a.proto) && comparison.result) {
    const sourceLines = comparison.result.diffs.map((diff) => proto.locate(diff, b.proto, a.proto))
    return { sides, comparison, mergedText, ...issues, sourceLines, engine, locations }
  }
  return { sides, comparison, mergedText, ...issues, engine, locations }
}

/** The engine `apiCompare` runs for the documents (`undefined` for an unsupported document) */
export const engineOf = (before: unknown, options: CompareOptions = {}): CompareEngineName | undefined => {
  if (options.engine) {
    return options.engine
  }
  try {
    return detectSpec(before).engine
  } catch {
    return undefined
  }
}

let sdlModule: Promise<typeof import("./sdl")> | undefined
let protoModule: Promise<typeof import("./proto")> | undefined

/** The `.proto` builder of the portal (protoapi), loaded the first time it is needed */
export const loadProtoBuilder = async (): Promise<ProtoBuilder> => {
  protoModule ??= import("./proto")
  const { buildProtoText, locateProtoDiff } = await protoModule
  return { build: buildProtoText, locate: locateProtoDiff }
}

/**
 * Analyzes two editors, loading the GraphQL SDL converter (graphql + gqlapi) the first time an editor holds SDL and
 * the `.proto` builder (protoapi) the first time an editor holds `.proto` sources
 */
export const runAnalysis = async (request: AnalysisRequest): Promise<Analysis> => {
  let sdl: SdlConverter | undefined
  let proto: ProtoBuilder | undefined
  if (needsSdl(request)) {
    sdlModule ??= import("./sdl")
    sdl = (await sdlModule).sdlToGraphApi
  }
  if (needsProto(request)) {
    proto = await loadProtoBuilder()
  }
  return analyzeTexts(request, sdl, proto)
}

/**
 * The analysis as a structured-cloneable message: the merged document is sent as text only, and the errors without
 * their `error` objects.
 */
export const portableAnalysis = (analysis: Analysis): Analysis => {
  const { comparison } = analysis
  if (!comparison) {
    return analysis
  }
  const errors: PlainCompareError[] = comparison.errors.map(({ kind, message, path, scope }) => ({
    kind,
    message,
    path: [...path],
    scope,
  }))
  return {
    ...analysis,
    comparison: {
      errors: errors as CompareError[],
      failure: comparison.failure,
      result: comparison.result
        ? { ...comparison.result, merged: undefined, rootMergeMeta: undefined, errors: undefined }
        : undefined,
    },
  }
}

/** Errors of a comparison as lines of text */
export const errorLines = (errors: readonly PlainCompareError[]): string[] =>
  errors.map((error) => `[${error.kind}] ${error.message} at ${pointer(error.path) || "/"} (${error.scope})`)
