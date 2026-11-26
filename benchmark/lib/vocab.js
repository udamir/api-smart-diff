"use strict"
// Shared classification vocabulary of the quality scorers (scripts/quality.js on the curated change sets,
// scripts/corpus.js on the harvested corpus). Every tool's own vocabulary is mapped to these classes by its adapter
// (adapters.js, lib/cli.js): fork `risky`, graphql-inspector DANGEROUS, graphql-js dangerous changes and oasdiff WARN
// -> risky; oasdiff ERR -> breaking; oasdiff INFO -> deprecated / annotation / non-breaking per rule id.
const SEVERITY = ["breaking", "risky", "deprecated", "non-breaking", "annotation", "unclassified"]
// side of the breaking line: risky counts on the breaking side (breaking agreement), unclassified never agrees
const side = (c) => (c === "breaking" || c === "risky" ? "B" : c === "unclassified" || !c ? "U" : "N")
// tools whose vocabulary has no annotation / deprecated tier: an expected annotation or deprecation counts as agreed
// when such a tool says non-breaking
const TWO_TIER = new Set(["openapi-diff", "oasdiff", "openapi-changes", "graphql-inspector", "graphql-js", "asyncapi-diff", "json-schema-diff"])
// tools that report breaking changes only (buf breaking): compared on detection of the expected breaking-side changes
// and on breaking agreement; an expected change below the breaking line is optional for them (nothing to report), a
// finding on it counts as a false breaking verdict (scripts/quality.js, lib/corpus-score.js)
const ONE_TIER = new Set(["buf", "buf-package", "buf-wire-json", "buf-wire"])
const LETTER = { breaking: "B", risky: "R", "non-breaking": "N", deprecated: "D", annotation: "A", unclassified: "U" }
const FROM_LETTER = Object.fromEntries(Object.entries(LETTER).map(([k, v]) => [v, k]))
// most severe class of a list (undefined for an empty list)
const mostSevere = (classes) => SEVERITY.find((s) => classes.includes(s))
// accepted verdicts for an expected class (plus explicit alternatives) and a tool
const acceptedFor = (tool, expected, accept = []) => {
  const a = new Set([expected, ...accept])
  if (TWO_TIER.has(tool) && (a.has("annotation") || a.has("deprecated"))) a.add("non-breaking")
  return a
}
// weak description of the curated change-set scorer (scripts/quality.js): the corpus scorer's definition
// (lib/corpus-score.js weakReasons, one definition everywhere) applied to a normalized diff
// ({ desc, action, cls, flag }); required lazily (corpus-score.js requires this module)
const weak = (desc, diff = {}) =>
  require("./corpus-score").weakReasons({
    description: desc,
    action: diff.action,
    type: diff.cls,
    before: diff.flag ? true : undefined,
    ...(diff.proto ? { proto: true, path: [diff.key] } : {}),
  })
module.exports = { SEVERITY, side, TWO_TIER, ONE_TIER, LETTER, FROM_LETTER, mostSevere, acceptedFor, weak }
