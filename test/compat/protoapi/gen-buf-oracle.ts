// Generator of the buf oracle of the compat family `protoapi` (PROTOAPI_DESIGN §9.3). Dev-only: it needs the buf CLI
// (v1.75.0), which is not a dependency of this package; the result is checked in, and the checker (`buf-oracle.ts`)
// needs protoapi only.
//
//   BUF=../protoapi/node_modules/.bin/buf vpx test/compat/protoapi/gen-buf-oracle.ts
//
// For every module of the corpus (`buf-corpus.ts`) and every buf v2 category (FILE, PACKAGE, WIRE_JSON, WIRE, mapped to
// the compatibility level of the same name, §5.4) it runs
// `buf breaking --against previous/<module> --error-format json --config '{"version":"v2","breaking":{"use":["<CAT>"]}}'`
// in `current/<module>`, and resolves every finding (file, line, column) to the innermost ProtoApi pointer whose source
// span contains it in the after document (`#/files/<path>` for a finding at the file level, the deleted file in the
// before document for FILE_NO_DELETE). The deletions of synthetic map-entry messages (ProtoApi has no map-entry
// messages, a map field is one field) are dropped and counted; buf's findings on the key / value fields of a map entry
// lie inside the map field declaration and resolve to the map field. Writes test/compat/coverage/protoapi-buf-oracle.json.

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import type { ProtoApiDocument, SourceMap } from "protoapi"

import {
  BUF_CATEGORIES,
  type BufCategory,
  bufModules,
  buildModule,
  moduleDir,
  ORACLE_FILE,
  type OracleFile,
  type OracleFinding,
} from "./buf-corpus"

const root = path.join(import.meta.dirname, "..", "..", "..")
const buf = process.env.BUF ?? path.join(root, "..", "protoapi", "node_modules", ".bin", "buf")

interface BufFinding {
  path?: string
  start_line: number
  start_column: number
  end_line: number
  end_column: number
  type: string
  message: string
}

const escape = (segment: string) => segment.replace(/~/g, "~0").replace(/\//g, "~1")
const filePointer = (file: string) => `#/files/${escape(file)}`

const before = (a: { line: number; column: number }, b: { line: number; column: number }) =>
  a.line < b.line || (a.line === b.line && a.column <= b.column)

/** The innermost pointer of `map` whose span in `file` contains the 0-based span [start, end). */
const innermost = (
  map: SourceMap,
  file: string,
  start: { line: number; column: number },
  end: { line: number; column: number },
): string | undefined => {
  let best: string | undefined
  let bestSize = Number.POSITIVE_INFINITY
  for (const [pointer, location] of Object.entries(map)) {
    if (location.file !== file || !before(location.start, start) || !before(end, location.end)) continue
    const size = (location.end.line - location.start.line) * 100_000 + (location.end.column - location.start.column)
    if (size < bestSize || (size === bestSize && best !== undefined && pointer.length > best.length)) {
      best = pointer
      bestSize = size
    }
  }
  return best
}

const DELETED =
  /^Previously present (file|package|service|message|enum|extension) "([^"]*)" was deleted(?: from package "([^"]*)")?/
const SECTION: Record<string, string> = {
  service: "services",
  message: "components/messages",
  enum: "components/enums",
  extension: "components/extensions",
}

/** The pointer of a declaration buf reports deleted without a location, in the before document. */
const deletedPointer = (document: ProtoApiDocument, message: string): string | undefined => {
  const match = message.match(DELETED)
  if (!match) return undefined
  const [, kind, name, pkg] = match
  if (kind === "file") return filePointer(name)
  if (kind === "package") {
    // a package is no element: the first file that declared it
    const files = Object.entries(document.files ?? {}).filter(([, file]) => (file.package ?? "") === name)
    return files.length ? filePointer(files.map(([file]) => file).sort()[0]) : undefined
  }
  return `#/${SECTION[kind]}/${escape(pkg ? `${pkg}.${name}` : name)}`
}

const runBuf = (module: string, category: BufCategory): BufFinding[] => {
  const config = JSON.stringify({ version: "v2", breaking: { use: [category] } })
  const run = spawnSync(
    buf,
    [
      "breaking",
      "--against",
      moduleDir("previous", module),
      "--error-format",
      "json",
      "--config",
      config,
      "--against-config",
      config,
    ],
    { cwd: moduleDir("current", module), encoding: "utf8" },
  )
  if (run.error) throw run.error
  const lines = run.stdout.split("\n").filter((line) => line.startsWith("{"))
  if (run.status !== 0 && run.status !== 100) {
    throw new Error(`buf breaking failed for ${module} ${category} (exit ${run.status}): ${run.stderr}`)
  }
  return lines.map((line) => JSON.parse(line) as BufFinding)
}

const version = () => {
  const run = spawnSync(buf, ["--version"], { encoding: "utf8" })
  if (run.error || run.status !== 0) {
    throw new Error(`buf not found at ${buf} (set BUF to the buf v1.75.0 binary)`)
  }
  return run.stdout.trim()
}

const main = () => {
  const bufVersion = version()
  const filtered: Record<string, number> = {}
  const modules: OracleFile["modules"] = {}
  let total = 0
  for (const module of bufModules()) {
    const previous = buildModule("previous", module)
    const current = buildModule("current", module)
    const beforeMessages = Object.keys(previous.document.components?.messages ?? {})
    const afterMessages = Object.keys(current.document.components?.messages ?? {})
    const entry: Record<string, OracleFinding[]> = {}
    for (const category of BUF_CATEGORIES) {
      const findings: OracleFinding[] = []
      for (const finding of runBuf(module, category)) {
        const deleted = finding.message.match(/^Previously present message "([^"]+)" was deleted/)?.[1]
        if (
          deleted?.endsWith("Entry") &&
          !beforeMessages.some((name) => name === deleted || name.endsWith(`.${deleted}`))
        ) {
          const key = `${finding.type}: map-entry message deleted (ProtoApi has no map-entry messages)`
          filtered[key] = (filtered[key] ?? 0) + 1
          continue
        }
        // a message-level rule reported on a map-entry message (its JSON format follows the enclosing message, whose
        // own finding is kept)
        const entry = finding.message.match(/^Message "([^"]+)" /)?.[1]
        if (entry?.endsWith("Entry") && !afterMessages.some((name) => name === entry || name.endsWith(`.${entry}`))) {
          const key = `${finding.type}: map-entry message changed (ProtoApi has no map-entry messages)`
          filtered[key] = (filtered[key] ?? 0) + 1
          continue
        }
        let pointer: string
        let side: OracleFinding["side"] = "after"
        if (!finding.path) {
          // a deletion buf reports without a location (FILE_NO_DELETE, PACKAGE_*_NO_DELETE): the deleted declaration
          // in the before document
          pointer = deletedPointer(previous.document, finding.message) ?? ""
          if (!pointer) throw new Error(`${module} ${category}: finding without a path: ${finding.message}`)
          side = "before"
        } else if (
          finding.start_line === 1 &&
          finding.start_column === 1 &&
          finding.end_line === 1 &&
          finding.end_column === 1
        ) {
          pointer = filePointer(finding.path)
        } else {
          const start = { line: finding.start_line - 1, column: finding.start_column - 1 }
          const end = { line: finding.end_line - 1, column: finding.end_column - 1 }
          pointer = innermost(current.sourceMap, finding.path, start, end) ?? filePointer(finding.path)
        }
        findings.push({ rule: finding.type, pointer, side, message: finding.message })
      }
      findings.sort(
        (a, b) =>
          a.rule.localeCompare(b.rule) || a.pointer.localeCompare(b.pointer) || a.message.localeCompare(b.message),
      )
      total += findings.length
      entry[category] = findings
    }
    modules[module] = entry as Record<BufCategory, OracleFinding[]>
  }
  const result: OracleFile = {
    generated: "BUF=<buf v1.75.0> vpx test/compat/protoapi/gen-buf-oracle.ts",
    buf: bufVersion,
    categories: {
      FILE: '{"version":"v2","breaking":{"use":["FILE"]}} -> compatibility "FILE"',
      PACKAGE: '{"version":"v2","breaking":{"use":["PACKAGE"]}} -> compatibility "PACKAGE"',
      WIRE_JSON: '{"version":"v2","breaking":{"use":["WIRE_JSON"]}} -> compatibility "WIRE_JSON"',
      WIRE: '{"version":"v2","breaking":{"use":["WIRE"]}} -> compatibility "WIRE"',
    },
    filtered,
    modules,
  }
  // one finding per line keeps the file reviewable
  const lines: string[] = ["{"]
  const head = { ...result, modules: undefined }
  for (const [key, value] of Object.entries(head)) {
    if (value !== undefined) lines.push(` ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
  }
  lines.push(' "modules": {')
  const names = Object.keys(modules)
  names.forEach((module, i) => {
    lines.push(`  ${JSON.stringify(module)}: {`)
    BUF_CATEGORIES.forEach((category, j) => {
      const findings = modules[module][category]
      const tail = j < BUF_CATEGORIES.length - 1 ? "," : ""
      if (!findings.length) {
        lines.push(`   ${JSON.stringify(category)}: []${tail}`)
        return
      }
      lines.push(`   ${JSON.stringify(category)}: [`)
      findings.forEach((f, k) => lines.push(`    ${JSON.stringify(f)}${k < findings.length - 1 ? "," : ""}`))
      lines.push(`   ]${tail}`)
    })
    lines.push(`  }${i < names.length - 1 ? "," : ""}`)
  })
  lines.push(" }", "}")
  fs.writeFileSync(ORACLE_FILE, `${lines.join("\n")}\n`)
  console.log(`buf ${bufVersion}: ${names.length} modules, ${total} findings, filtered ${JSON.stringify(filtered)}`)
}

main()
