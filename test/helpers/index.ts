import { applyOperation, type Operation } from "fast-json-patch"
import { buildFromSchema, type GraphApiSchema } from "gqlapi"
import { buildSchema } from "graphql"
import {
  buildFromProto,
  type BuildIssue,
  type BuildIssueCode,
  type ProtoApiDocument,
  type SourceMap,
  type TextBuildOptions,
} from "protoapi"
import type { JsonPath } from "json-crawl"
import YAML from "js-yaml"
import path from "node:path"
import fs from "node:fs"

import { protoWordingIssues } from "./proto-wording"

import { apiCompare, type CompareOptions, type CompareResult, type CompareRules, type Diff } from "../../src"
import { getKeyValue } from "../../src/utils"
import { buildPath } from "../../src/jsonSchema"
import { compareProtoApi } from "../../src/protoapi/protoapi.compare"
import type { ProtoApiCompareOptions } from "../../src/protoapi/protoapi.types"

export const yaml = (strings: TemplateStringsArray): object => {
  return YAML.load(strings[0]) as object
}

/** GraphApi 1.0 document (gqlapi 0.6) from SDL */
export const graphapi = (strings: TemplateStringsArray): GraphApiSchema => {
  return buildFromSchema(buildSchema(strings[0], { noLocation: true }))
}

/** `.proto` input of a ProtoApi build: one file (`a.proto`) or a map of import paths to file texts. */
export type ProtoInput = string | Record<string, string>

export type ProtoBuildOptions = Pick<TextBuildOptions, "imports" | "files" | "annotations" | "bundle" | "loader"> & {
  // build issue codes the test expects; any other issue of a code in `FATAL_PROTO_ISSUES` fails the build (C8)
  issues?: BuildIssueCode[]
}

// issues that make a document unfit for a comparison (PROTOAPI_DESIGN §9.1, C8)
const FATAL_PROTO_ISSUES: BuildIssueCode[] = ["syntax", "missing-import", "unresolved-type"]

/**
 * Builds a ProtoApi document from `.proto` text with protoapi's default options, `imports: "user"` (invariant 19), and
 * fails on `syntax`, `missing-import` or `unresolved-type` issues the test does not list.
 */
export const buildProto = (
  input: ProtoInput,
  options: ProtoBuildOptions = {},
): { document: ProtoApiDocument; sourceMap: SourceMap; issues: BuildIssue[] } => {
  const { issues: expected = [], ...build } = options
  const sources = typeof input === "string" ? { "a.proto": input } : input
  const result = buildFromProto(sources, { imports: "user", ...build })
  const fatal = result.issues.filter(
    (issue) => FATAL_PROTO_ISSUES.includes(issue.code) && !expected.includes(issue.code),
  )
  if (fatal.length) {
    throw new Error(`Unexpected ProtoApi build issues: ${fatal.map((i) => `${i.code}: ${i.message}`).join("; ")}`)
  }
  return result
}

/** ProtoApi document of one `.proto` file (`a.proto`) written inline. */
export const proto = (strings: TemplateStringsArray, ...values: unknown[]): ProtoApiDocument =>
  buildProto(String.raw({ raw: strings.raw }, ...values)).document

/** Both sides of a ProtoApi comparison built from `.proto` inputs, with their build issues and source maps. */
export const protoDocs = (before: ProtoInput, after: ProtoInput, options: ProtoBuildOptions = {}) => {
  const b = buildProto(before, options)
  const a = buildProto(after, options)
  return {
    before: b.document,
    after: a.document,
    issues: { before: b.issues, after: a.issues },
    maps: { before: b.sourceMap, after: a.sourceMap },
  }
}

// ---- R-D wording lint (PROTOAPI_DESIGN §9.1 J16): `protoWordingIssues` lives in `proto-wording.ts`, which the compat
// harness (test/helpers/compat.ts) imports outside the test runner as well

export { protoWordingIssues } from "./proto-wording"

/** Asserts R-D on every description of a ProtoApi comparison (J16; run by `protoDiffs` and the J runners). */
export const expectProtoWording = (diffs: readonly Diff[]) => {
  const issues = diffs.flatMap(protoWordingIssues)
  expect(issues).toEqual([])
}

/** `compareProtoApi` with the R-D wording lint on every description (J16), for the J tests that compare documents. */
export const protoCompare: typeof compareProtoApi = (before, after, options, context) => {
  const result = compareProtoApi(before, after, options, context)
  if (!options?.annotateHook) {
    expectProtoWording(result.diffs)
  }
  return result
}

/**
 * Compares two `.proto` inputs through `apiCompare` (engine detection included) and runs the R-D wording lint
 * (`expectProtoWording`, J16) on every description it returns, so the lint covers the whole J block.
 */
export const protoDiffs = (
  before: ProtoInput,
  after: ProtoInput,
  options: ProtoApiCompareOptions = {},
  build: ProtoBuildOptions = {},
): CompareResult & { before: ProtoApiDocument; after: ProtoApiDocument } => {
  const docs = protoDocs(before, after, build)
  const result = apiCompare(docs.before, docs.after, options)
  if (!options.annotateHook) {
    expectProtoWording(result.diffs)
  }
  return { ...result, before: docs.before, after: docs.after }
}

export class ExampleResource {
  private res: any = {}
  public externalSources: any = {}

  constructor(
    private filename: string,
    public rules?: CompareRules,
  ) {
    const resPath = path.join(import.meta.dirname, "../resources/", this.filename)
    const data = fs.readFileSync(resPath, "utf8")
    if (/.(yaml|YAML|yml|YML)$/g.test(filename)) {
      try {
        this.res = YAML.load(data)
      } catch (e) {
        console.log(e)
      }
    } else if (/.(graphql|gql)$/g.test(filename)) {
      try {
        const schema = buildSchema(data, { noLocation: true })
        this.res = buildFromSchema(schema)
      } catch (e) {
        console.log(e)
      }
    }
  }

  public clone(patches: Operation[] = []) {
    const res = JSON.parse(JSON.stringify(this.res))
    for (const patch of patches) {
      applyOperation(res, patch)
    }
    return res
  }

  public diff(after: any) {
    return apiCompare(this.res, after, { rules: this.rules, externalSources: this.externalSources }).diffs
  }

  public merge(after: any, options?: CompareOptions) {
    return apiCompare(this.res, after, { ...options, rules: this.rules, externalSources: this.externalSources }).merged
  }

  public getValue(path: JsonPath) {
    // path = typeof path === "string" ? parsePath(path) : path
    return getKeyValue(this.res, ...path)
  }

  // public findExternalSources () {
  //   return findExternalRefs(this.res)
  // }
}

export const addPatch = (pathArr: any[], value: any): Operation => {
  return {
    op: "add",
    path: buildPath(pathArr),
    value,
  }
}

export const replacePatch = (pathArr: any[], value: any): Operation => {
  return {
    op: "replace",
    path: buildPath(pathArr),
    value,
  }
}

export const removePatch = (pathArr: any[]): Operation => {
  return {
    op: "remove",
    path: buildPath(pathArr),
  }
}
