"use strict"
// Scoring of one harvested-corpus variant (fixtures/cache/corpus/<type>.json, scripts/corpus-export.ts) for one tool.
//
// Case level (every tool, comparable across tools): the corpus pairs are minimal (one scenario per pair), so a tool is
// judged on the whole pair rather than per diff location, which every tool reports in its own way.
//   detected   = some diff when the variant expects a non-optional change; no diff when it expects none; always true
//                when every expected change is optional
//   verdict    = most severe class among the tool's diffs (breaking > risky > deprecated > non-breaking > annotation >
//                unclassified)
//   expected   = most severe expected class among the non-optional changes (all changes when every one is optional)
//   classified = verdict is the expected class (two-tier tools: non-breaking accepted for an expected annotation /
//                deprecation, lib/vocab.js), or the class of an optional expected change that is more severe than it
//                (an optional change may be reported at its own type, as the strict check accepts); n/a
//                (null) when nothing is to be classified
//   breaking   = classified, or verdict on the same side of the breaking line (risky counts as breaking)
//   described  = no diff has a weak description (weakReasons below: the strict check for every
//                tool -- not strong, i.e. empty, undefined / {{ / [object / NaN, fewer than two words or 8 characters;
//                an action tag of another action; a non-annotation change described as "annotation (...)"; the
//                changed item named as its own container; the tag and class checks apply where the tool's adapter
//                keeps api-smart-diff's action and class); n/a when the tool rightly reports nothing
//   risky      = { expected: expected class is risky, verdict: verdict is risky }
// Strict (api-smart-diff only, where `diff.path` is the document path): the attribution of test/helpers/compat.ts of
// the repository (path pattern under the placement prefix + action; no spurious diff; every diff of a change
// has the expected type; strong description that contains the placement's and the change's mentions). It reproduces
// the D / C / A columns of test/compat/report.ts except the identical-document and mutation checks.
const { mostSevere, acceptedFor, side, LETTER, ONE_TIER } = require("./vocab")

const strongDesc = (d) => {
  if (typeof d !== "string" || !d.trim()) return false
  if (/undefined|\{\{|\}\}|\[object|NaN/.test(d)) return false
  const text = d.replace(/^\[[A-Za-z]+\]\s*/, "")
  return text.length >= 8 && text.split(/\s+/).filter(Boolean).length >= 2
}

const expectedClassOf = (v) => {
  const req = v.expect.filter((e) => !e.optional)
  const pool = (req.length ? req : v.expect).map((e) => e.type).filter(Boolean)
  return mostSevere(pool)
}

const caseScore = (tool, v, diffs, { floor = false } = {}) => {
  // a one-tier tool (buf: breaking findings only) has nothing to report for an expected change below the breaking
  // line: such changes are optional for it, a finding on them is a wrong (breaking) verdict
  if (ONE_TIER.has(tool)) v = { ...v, expect: v.expect.map((e) => (e.type && side(e.type) !== "B" ? { ...e, optional: true } : e)) }
  const req = v.expect.filter((e) => !e.optional)
  const n = diffs.length
  const detected = req.length ? n > 0 : v.expect.length ? true : n === 0
  const verdict = n ? mostSevere(diffs.map((d) => d.cls)) || "unclassified" : undefined
  const exp = expectedClassOf(v)
  let classified = null
  let breaking = null
  if (floor) {
    // structural diffs classify nothing
  } else if (!v.expect.length) {
    // nothing may be reported: the only right "classification" is no diff
    classified = n === 0
    breaking = n === 0
  } else if (exp) {
    if (!n) classified = req.length ? false : null
    else {
      // classes of optional changes that may raise the verdict above the required one
      const raise = v.expect.filter((e) => e.optional && e.type && req.length && mostSevere([e.type, exp]) === e.type && e.type !== exp).map((e) => e.type)
      classified = [exp, ...raise].some((c) => acceptedFor(tool, c).has(verdict))
    }
    if (classified !== null) breaking = classified || (side(verdict) !== "U" && side(verdict) === side(exp))
  }
  // the strict weak check (weakReasons) on the normalized diff ({ desc, action, cls, flag })
  const described = floor ? null : n ? diffs.every((d) => !weakNormalized(d)) : req.length ? false : null
  return {
    n,
    d: detected,
    c: classified,
    b: breaking,
    a: described,
    v: verdict ? LETTER[verdict] : "",
    e: exp ? LETTER[exp] : "",
    rE: exp === "risky",
    rV: verdict === "risky",
  }
}

// ---- strict attribution (port of test/helpers/compat.ts checkDiffs) ----
const parsePattern = (p) => (p === "" ? [] : p.split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~")))
const matchSegments = (pattern, path) => {
  if (!pattern.length) return !path.length
  const [head, ...rest] = pattern
  if (head === "**") {
    for (let i = 0; i <= path.length; i++) if (matchSegments(rest, path.slice(i))) return true
    return false
  }
  if (!path.length) return false
  return (head === "*" || head === path[0]) && matchSegments(rest, path.slice(1))
}
const matchPath = (pattern, path, prefix) => matchSegments([...prefix.map(String), ...parsePattern(pattern)], path.map(String))
const ACTION_TAG = { add: "[Added]", remove: "[Removed]", replace: "[Replaced]", rename: "[Renamed]" }
// the changed item named as its own container -- a backticked name followed by a preposition and the same
// name (`X` to `X`, `X` from `X`, `X` of `X`) or by "Argument" and the same name (`X` to Argument `X`, `X` Argument
// `X`); a repeat inside a "from ... to ..." value pair is not one (`user` from `user` to `user/{id}`, from `S` to `S`).
// Same rule as namesItselfAsContainer in test/helpers/compat.ts of the repository.
const ownContainer = (d) => {
  for (const m of String(d || "").matchAll(/`([^`]+)` (?:(to|from|of) )?([Aa]rgument )?`\1`/g)) {
    const [whole, , preposition, argument] = m
    if (!preposition && !argument) continue
    if (!argument && preposition === "from" && d.startsWith(" to `", m.index + whole.length)) continue
    if (!argument && preposition === "to" && /\bfrom $/.test(d.slice(0, m.index))) continue
    return true
  }
  return false
}
// weak description (the one definition of the benchmark; = weakDescription of test/helpers/compat.ts):
// not strong, an action tag of another action (a boolean flag switched on / off may read [Added] / [Removed]), a
// non-annotation change described as "annotation (...)", or the changed item named as its own container.
// `diff` = { description, action, type, before?, after? } (api-smart-diff diff fields; any other tool's action /
// class skip the checks that need them)
// ProtoApi (type grpc, `diff.proto`): the labels a ProtoApi description takes besides the action word, as
// protoApiLabel of test/helpers/compat.ts in the repository: `[Deprecated]` for deprecation records
// (PD-23), the state of a keyword whose absence has a meaning (W-34: `closed` added reads "[Replaced] enum type … from
// `open` to `closed`"), an implicit default replaced (C6), a merged record of mixed effects (A4, PD-25)
const PROTOAPI_STATE_KEYS = new Set(["closed", "jsonFormat", "utf8Validation", "packed", "presence", "syntax", "visibility"])
const protoApiLabel = (diff, tag) => {
  if (tag === "[Deprecated]") return diff.type === "deprecated"
  const key = String((diff.path || [])[(diff.path || []).length - 1])
  const d = diff.description || ""
  return /^\[Replaced\] (resolved features|field behavior) of /.test(d) || (PROTOAPI_STATE_KEYS.has(key) && /^\[(Added|Removed|Replaced)\]$/.test(tag)) || (key === "default" && tag === "[Replaced]" && d.includes("(implicit)"))
}
const weakReasons = (diff) => {
  const d = diff.description
  if (!strongDesc(d)) return true
  const tag = d.match(/^\[[A-Za-z]+\]/)?.[0]
  const flag = diff.action === "replace" && (typeof diff.before === "boolean" || typeof diff.after === "boolean")
  if (tag && ACTION_TAG[diff.action] && tag !== ACTION_TAG[diff.action] && !(flag && /^\[(Added|Removed)\]$/.test(tag)) && !(diff.proto && protoApiLabel(diff, tag))) return true
  if (diff.type && diff.type !== "annotation" && /\bannotation \(/.test(d)) return true
  if (ownContainer(d)) return true
  return false
}
// weakReasons of a diff normalized by adapters.js ({ desc, action, cls, flag }), as lib/vocab.js weak
const weakNormalized = (d) =>
  weakReasons({ description: d.desc, action: d.action, type: d.cls, before: d.flag ? true : undefined, ...(d.proto ? { proto: true, path: [d.key] } : {}) })
const mentionMissing = (desc, m) => (typeof m === "string" ? !String(desc || "").toLowerCase().includes(m.toLowerCase()) : !new RegExp(m.re, m.flags).test(String(desc || "")))

// api-smart-diff diff -> the fields used here, stored in the raw corpus results
const compactDiff = (d) => ({ p: (d.path || []).map(String), a: d.action, t: d.type, d: d.description, ...(typeof d.before === "boolean" || typeof d.after === "boolean" ? { f: 1 } : {}) })
const expandDiff = (c) => ({ path: c.p, action: c.a, type: c.t, description: c.d, before: c.f ? true : undefined })

// rawDiffs: api-smart-diff `diffs` ({ path, action, type, description, before, after }) or their compactDiff form
const strictScore = (v, rawDiffs) => {
  rawDiffs = rawDiffs.map((d) => (d.p ? expandDiff(d) : d)).map((d) => (v.docFamily === "protoapi" ? { ...d, proto: true } : d))
  let detected = true
  let classified = true
  let annotated = true
  const attributed = new Map()
  let spurious = 0
  for (const diff of rawDiffs) {
    const e = v.expect.find((x) => (!x.action || x.action.includes(diff.action)) && x.at.some((p) => matchPath(p, diff.path || [], v.prefix)))
    if (!e) spurious++
    else attributed.set(e, [...(attributed.get(e) || []), diff])
  }
  if (spurious) detected = false
  for (const e of v.expect) {
    const found = attributed.get(e) || []
    if (!found.length && !e.optional) detected = false
    for (const diff of found) {
      if (e.type && diff.type !== e.type) classified = false
      const missing = [...v.mentions, ...(e.mentions || [])].some((m) => mentionMissing(diff.description, m))
      if (weakReasons(diff) || missing) annotated = false
    }
  }
  return `${detected ? "D" : "-"}${classified ? "C" : "-"}${annotated ? "A" : "-"}`
}

module.exports = { caseScore, strictScore, compactDiff, strongDesc, weakReasons, ownContainer, expectedClassOf }
