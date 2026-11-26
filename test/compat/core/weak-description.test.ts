import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import type { Diff } from "../../../src"
import { namesItselfAsContainer, weakDescription } from "../../helpers/compat"

// POLICY-90 decided: the weak-description check flags a name used both as the changed key and as its own container,
// never a repeat inside a "from … to …" value pair. The benchmark's corpus scorer (main worktree,
// bench/lib/corpus-score.js `weakReasons` / `ownContainer`, reused by bench/lib/vocab.js `weak`, POLICY-93) implements
// the same rule; the parity test runs when the main worktree is next to this one.

const ownContainer = [
  "[Added] `limit` to `limit` in input type `SearchFilter`",
  "[Removed] `age` from `age` in object type `User`",
  "[Replaced] `home` of `home` in object type `User`",
  "[Added] `limit` to Argument `limit` of property `search(...)` in type `Query`",
  "[Removed] `term` from Argument `term` of property `search(...)` in type `Query`",
  "[Replaced] `filter` of Argument `filter` of property `search(...)` in type `Query`",
  "[Added] `size` Argument `size` of directive `@limit`",
  "[Added] `to` to `to` in input type `Range`",
]

const strong = [
  "[Replaced] `address` of channel `user` from `user` to `user/{userId}`",
  "[Replaced] `url` of server `https://api.example.com/v1` from `https://api.example.com/v1` to `https://api.example.com/v2`",
  "[Replaced] description of input type `Filter` from `Filter` to `Search filter`",
  "[Replaced] type from `Status` to `Status` of field `User.status`",
  "[Added] argument `limit` to field `Query.search`",
  "[Removed] input field `tag` from input type `SearchFilter`",
  "[Added] field `User` to object type `User`",
  "[Added] property `id` to `items`",
]

const diffOf = (description: string): Diff => ({
  type: "non-breaking",
  action: description.startsWith("[Added]") ? "add" : description.startsWith("[Removed]") ? "remove" : "replace",
  path: [],
  description,
  scope: "#",
})

const benchScorer = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "api-smart-diff",
  "bench",
  "lib",
  "corpus-score.js",
)

describe("compat core / weak descriptions (POLICY-90)", () => {
  it("X-WEAK-001 flags the changed item named as its own container", () => {
    for (const text of ownContainer) {
      expect(namesItselfAsContainer(text), text).toBe(true)
      expect(weakDescription(diffOf(text)), text).toContain("names the changed item as its own container")
    }
  })

  it("X-WEAK-002 accepts a repeat inside a from … to … value pair and distinct names", () => {
    for (const text of strong) {
      expect(namesItselfAsContainer(text), text).toBe(false)
      expect(weakDescription(diffOf(text)), text).toEqual([])
    }
  })

  it.skipIf(!fs.existsSync(benchScorer))("X-WEAK-003 the benchmark scorers apply the same rule (POLICY-93)", () => {
    const require = createRequire(import.meta.url)
    const scorer = require(benchScorer)
    const vocab = require(path.join(path.dirname(benchScorer), "vocab.js"))
    for (const text of ownContainer) {
      const diff = diffOf(text)
      expect(scorer.ownContainer(text), text).toBe(true)
      expect(scorer.weakReasons(diff), text).toBe(true)
      expect(vocab.weak(text, { action: diff.action, cls: diff.type }), text).toBe(true)
    }
    for (const text of strong) {
      const diff = diffOf(text)
      expect(scorer.weakReasons(diff), text).toBe(false)
      expect(vocab.weak(text, { action: diff.action, cls: diff.type }), text).toBe(false)
    }
    // the remaining weak reasons agree as well
    for (const diff of [
      { ...diffOf("[Added] x"), description: "[Added] x" },
      { ...diffOf("[Removed] `a` from `b`"), action: "add" as const },
      { ...diffOf("[Added] annotation (description) to `a`") },
    ]) {
      expect(scorer.weakReasons(diff), diff.description).toBe(weakDescription(diff).length > 0)
      expect(vocab.weak(diff.description, { action: diff.action, cls: diff.type })).toBe(
        weakDescription(diff).length > 0,
      )
    }
  })
})
