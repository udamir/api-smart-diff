/**
 * Protocol Buffers input of the demo and the examples: api-smart-diff compares the ProtoApi documents that the separate
 * package protoapi builds from `.proto` sources, so an editor holding `.proto` text is built with
 * `buildFromProto(files, { imports: "user" })` first, and the source map of each side locates a diff in the editors
 * (`locateDiff`). Loaded on demand (when an editor holds `.proto` text, see `looksLikeProto` in diff.ts), so the other
 * pages never load protoapi; the library itself never imports it.
 */
import { type BuildIssue, type Location, type SourceMap, buildFromProto, locateDiff } from "protoapi"
import protoapiPackage from "protoapi/package.json" with { type: "json" }

import type { Diff } from "../../../src"
import { type ProtoFileText, splitProtoFiles } from "./diff"

/** version of the protoapi build the portal bundles */
export const PROTOAPI_VERSION: string = protoapiPackage.version

/** build issues that make a document unfit for a comparison; the other issues are informative */
export const FATAL_PROTO_ISSUES: readonly string[] = ["syntax", "missing-import", "unresolved-type"]

export interface ProtoBuildIssue {
  fatal: boolean
  /** `api.proto:3:5 [syntax] …`, with the line and column of the editor (one-based) */
  text: string
}

/** One side built from an editor */
export interface ProtoSide {
  document: unknown
  sourceMap: SourceMap
  files: ProtoFileText[]
  issues: ProtoBuildIssue[]
}

/** Where a diff lies in the editors (zero-based editor lines, `to` inclusive) */
export interface SourceLine {
  side: "before" | "after"
  file: string
  from: number
  to: number
}

const editorLine = (files: readonly ProtoFileText[], file: string, line: number): number =>
  (files.find((item) => item.path === file)?.line ?? 0) + line

const issueText = (issue: BuildIssue, files: readonly ProtoFileText[]): string => {
  const at = issue.location
    ? `${issue.location.file}:${editorLine(files, issue.location.file, issue.location.start.line) + 1}:${issue.location.start.column + 1}`
    : (issue.file ?? "")
  return `${at ? `${at} ` : ""}[${issue.code}] ${issue.message}`
}

/** Builds the ProtoApi document of an editor with protoapi's default options (`imports: "user"`) */
export const buildProtoText = (text: string): ProtoSide => {
  const files = splitProtoFiles(text)
  const sources = Object.fromEntries(files.map((file) => [file.path, file.text]))
  const result = buildFromProto(sources, { imports: "user" })
  return {
    document: result.document,
    sourceMap: result.sourceMap,
    files,
    issues: result.issues.map((issue) => ({
      fatal: FATAL_PROTO_ISSUES.includes(issue.code),
      text: issueText(issue, files),
    })),
  }
}

/** The side's map, or an empty one for a side that is not `.proto` input */
const mapOf = (side: ProtoSide | undefined): SourceMap => side?.sourceMap ?? {}

const sourceLine = (side: "before" | "after", location: Location, files: readonly ProtoFileText[]): SourceLine => {
  const from = editorLine(files, location.file, location.start.line)
  // the end is exclusive: a location that ends at the start of a line does not cover that line
  const endLine =
    location.end.column === 0 && location.end.line > location.start.line ? location.end.line - 1 : location.end.line
  return { side, file: location.file, from, to: Math.max(from, editorLine(files, location.file, endLine)) }
}

/**
 * The editor lines of a diff: a removal lies in the before sources, every other change in the after sources, or in the
 * before sources when the after sources have no entry on its path (`locateDiff` of protoapi).
 */
export const locateProtoDiff = (diff: Diff, before?: ProtoSide, after?: ProtoSide): SourceLine | undefined => {
  if (diff.action !== "remove" && after) {
    const found = locateDiff(diff, {}, mapOf(after))
    if (found) {
      return sourceLine("after", found, after.files)
    }
  }
  if (before) {
    const found = locateDiff(diff, mapOf(before), {})
    if (found) {
      return sourceLine("before", found, before.files)
    }
  }
  return undefined
}
