import fs from "node:fs"
import path from "node:path"

import { buildProto } from "../../helpers"
import type { SingleEditCase } from "./single-edits"

// The documents of the J15 single-edit corpus: the base sets of `single-edits/<set>/` and the edited after sides.

const baseDir = path.join(import.meta.dirname, "single-edits")

const loadSet = (set: string): Record<string, string> => {
  const root = path.join(baseDir, set)
  const files: Record<string, string> = {}
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name)
      if (fs.statSync(file).isDirectory()) {
        walk(file)
      } else if (name.endsWith(".proto")) {
        files[path.relative(root, file).split(path.sep).join("/")] = fs.readFileSync(file, "utf8")
      }
    }
  }
  walk(root)
  return files
}

const sets = new Map<string, Record<string, string>>()
const baseOf = (set: string) => {
  let files = sets.get(set)
  if (!files) {
    files = loadSet(set)
    sets.set(set, files)
  }
  return files
}

const apply = (item: SingleEditCase): Record<string, string> => {
  const after = { ...baseOf(item.set) }
  for (const edit of item.edits) {
    if (edit.rename) {
      after[edit.rename] = after[edit.file]
      delete after[edit.file]
      continue
    }
    const text = after[edit.file]
    if (text === undefined || !text.includes(edit.from)) {
      throw new Error(`${item.id}: "${edit.from}" not found in ${edit.file}`)
    }
    after[edit.file] = text.replace(edit.from, edit.to)
  }
  return after
}

// inputs are frozen: a transform, resolver or classifier that writes into them fails the comparison (no input mutation)
export const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
  }
  return value
}

/** The frozen before and after documents of a single edit of the J15 corpus. */
export const singleEditDocuments = (item: SingleEditCase) => ({
  before: deepFreeze(buildProto(baseOf(item.set)).document),
  after: deepFreeze(buildProto(apply(item)).document),
})
