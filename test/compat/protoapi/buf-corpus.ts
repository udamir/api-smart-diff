// The corpus of the ProtoApi buf oracle (PROTOAPI_DESIGN §9.3): buf v1.75.0
// `private/bufpkg/bufcheck/testdata/breaking/{previous,current}` as vendored by protoapi (`test/fixtures/buf-breaking`,
// single build roots flattened, Apache-2.0 `LICENSE` kept), without the four modules that test buf's plugin and policy
// configuration (`breaking_custom_plugins`, `breaking_policy_*`): 55 modules, each a pair of `.proto` file trees; plus
// 29 scenario modules authored for asd (`buf-scenarios`).
// Shared by the generator (`gen-buf-oracle.ts`, needs buf) and the checker (`buf-oracle.ts`, needs protoapi only).

import fs from "node:fs"
import path from "node:path"

import { type BuildIssue, buildFromProto, type ProtoApiDocument, type SourceMap } from "protoapi"

export const BUF_CORPUS = path.join(import.meta.dirname, "buf-breaking")
/** Scenario modules authored for asd (`buf-scenarios/README.md`): 25 parity scenarios and the record decisions. */
export const BUF_SCENARIOS = path.join(import.meta.dirname, "buf-scenarios")
const ROOTS = [BUF_CORPUS, BUF_SCENARIOS]

/** buf v2 categories, in the order of the compatibility levels (§5.4). */
export const BUF_CATEGORIES = ["FILE", "PACKAGE", "WIRE_JSON", "WIRE"] as const
export type BufCategory = (typeof BUF_CATEGORIES)[number]

export type CorpusSide = "previous" | "current"

/** The module names of the corpus and the scenarios (directories of `current/`), sorted. */
export const bufModules = (): string[] =>
  ROOTS.flatMap((root) =>
    fs
      .readdirSync(path.join(root, "current"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  ).sort()

/** The directory of one side of a module. */
export const moduleDir = (side: CorpusSide, module: string): string => {
  const root = ROOTS.find((dir) => fs.existsSync(path.join(dir, "current", module))) ?? BUF_CORPUS
  return path.join(root, side, module)
}

const walk = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return entry.name.endsWith(".proto") ? [full] : []
    })

/** The `.proto` files of one side of a module, keyed by their import path. */
export const moduleSources = (side: CorpusSide, module: string): Record<string, string> => {
  const dir = moduleDir(side, module)
  if (!fs.existsSync(dir)) return {}
  return Object.fromEntries(
    walk(dir).map((file) => [path.relative(dir, file).split(path.sep).join("/"), fs.readFileSync(file, "utf8")]),
  )
}

export interface ModuleBuild {
  document: ProtoApiDocument
  sourceMap: SourceMap
  issues: BuildIssue[]
}

/** One side of a module built with protoapi's defaults (`imports: "user"`, invariant 19). */
export const buildModule = (side: CorpusSide, module: string): ModuleBuild => {
  const { document, sourceMap, issues } = buildFromProto(moduleSources(side, module), { imports: "user" })
  return { document, sourceMap, issues }
}

/** One finding of `buf breaking`, resolved to the ProtoApi element it is reported at. */
export interface OracleFinding {
  rule: string
  /** JSON pointer of the innermost ProtoApi node whose source span contains the finding */
  pointer: string
  /** the document the pointer belongs to: `after` (buf reports in the current files), `before` for a deleted file */
  side: "before" | "after"
  message: string
}

export interface OracleFile {
  generated: string
  buf: string
  categories: Record<BufCategory, string>
  /** findings that cannot have a ProtoApi counterpart and were dropped, with their count */
  filtered: Record<string, number>
  modules: Record<string, Record<BufCategory, OracleFinding[]>>
}

export const ORACLE_FILE = path.join(import.meta.dirname, "..", "coverage", "protoapi-buf-oracle.json")
export const ORACLE_EXCEPTIONS_FILE = path.join(
  import.meta.dirname,
  "..",
  "coverage",
  "protoapi-buf-oracle-exceptions.json",
)
