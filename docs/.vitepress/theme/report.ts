/**
 * "Report issue" of the demo and the examples: builds a GitHub issue from what the reader sees — the problem kind,
 * the selected diff or the diff list, a ready `apiCompare(...)` call, both documents and a link that restores the
 * portal state — as a prefilled "new issue" URL for the issue form `.github/ISSUE_TEMPLATE/bug_report.yml` (fields
 * prefilled by their `id`) and as Markdown to copy. Nothing is sent anywhere: the reader opens the URL and submits.
 */
import type { ActionType, DiffType } from "../../../src"
import { DIFF_TYPES } from "./diff"

export const REPOSITORY_URL = "https://github.com/udamir/api-smart-diff"
export const NEW_ISSUE_URL = `${REPOSITORY_URL}/issues/new`
/** file name of the issue form in `.github/ISSUE_TEMPLATE` */
export const ISSUE_TEMPLATE = "bug_report.yml"
/**
 * The length budget of a "new issue" URL, counted by `issueUrlLength`. GitHub sends a reader who is not signed in to
 * `/login?return_to=<the URL, percent-encoded again>`; measured 2026-11-22: a `return_to` of about 7 700 characters
 * still redirects with the query, a longer one drops the query (the form opens empty after signing in), and a URL of
 * about 7 000 characters or more is answered with an error page (500). Counting the URL as it is encoded into
 * `return_to` keeps the prefilled fields through the sign-in.
 */
export const MAX_URL_LENGTH = 7500

/** Length of the URL as GitHub's sign-in redirect carries it (never shorter than the URL itself) */
export const issueUrlLength = (url: string): number => encodeURIComponent(url).length

export type ProblemKind = "classification" | "description" | "missing" | "extra" | "crash" | "other"

export interface ProblemKindInfo {
  id: ProblemKind
  /** shown in the dialog and written to the `problem` field of the issue form */
  label: string
  /** a repository label for the kind (the issue form itself adds `bug` and `portal-report`) */
  issueLabel?: string
}

export const PROBLEM_KINDS: readonly ProblemKindInfo[] = [
  { id: "classification", label: "Wrong classification", issueLabel: "classification" },
  { id: "description", label: "Wrong or unclear description", issueLabel: "description" },
  { id: "missing", label: "Missing change", issueLabel: "missing-change" },
  { id: "extra", label: "Extra change", issueLabel: "extra-change" },
  { id: "crash", label: "Crash or error", issueLabel: "crash" },
  { id: "other", label: "Other" },
]

/** labels the issue form adds to every report */
export const TEMPLATE_LABELS = ["bug", "portal-report"] as const

/** the `id`s of the issue form fields, the query parameters that prefill them */
export const FIELD_IDS = [
  "problem",
  "expected",
  "details",
  "diffs",
  "reproduction",
  "documents",
  "version",
  "environment",
  "link",
] as const

export type FieldId = (typeof FIELD_IDS)[number]

export interface ReportDiff {
  type: DiffType
  action: ActionType
  /** JSON pointer of `diff.path` */
  path: string
  scope: string
  description?: string
  /** the API location of the diff (`GET /pets/{id} · response 200 application/json`, see location.ts) */
  location?: string
}

export interface ReportDocument {
  text: string
  /** fence language: yaml, json or graphql */
  language: string
}

export interface ReportInput {
  kind: ProblemKind
  /** the type the reader expected (wrong classification, missing change) */
  expectedType?: DiffType
  /** free text of the reader */
  note?: string
  /** api-smart-diff version of the portal build */
  version: string
  /** where the report comes from: "online demo", `example "…" (id)` */
  origin: string
  /** detected specification and engine, e.g. "OpenAPI 3.1.0 (engine openapi)" */
  spec: string
  /** the `apiCompare(...)` call with the options of the comparison */
  snippet: string
  /** the diff the report is about ("this diff is wrong") */
  diff?: ReportDiff
  /** every diff of the comparison */
  diffs: readonly ReportDiff[]
  /** `apiCompare` threw, or the input could not be read */
  failure?: string
  /** errors reported through `onError` */
  errors?: readonly string[]
  before: ReportDocument
  after: ReportDocument
  userAgent: string
  /** a portal link that restores the documents and the options */
  shareUrl?: string
}

export interface Report {
  title: string
  /** labels of the URL (the issue form adds TEMPLATE_LABELS itself) */
  labels: string[]
  /** the prefilled issue form fields, as they are in the URL */
  fields: Record<FieldId, string>
  /** the "new issue" URL, `issueUrlLength` at most MAX_URL_LENGTH */
  url: string
  /** the whole report as Markdown, nothing left out */
  markdown: string
  /** both documents as Markdown (for "Copy documents" when they do not fit the URL) */
  documentsMarkdown: string
  /** what the URL leaves out to stay under the length limit */
  omitted: { documents: boolean; diffs: boolean; link: boolean; details: boolean }
}

export const problemKind = (kind: ProblemKind): ProblemKindInfo =>
  PROBLEM_KINDS.find((item) => item.id === kind) ?? PROBLEM_KINDS[PROBLEM_KINDS.length - 1]

/** A fence longer than any run of backticks in the text, so a document cannot close it */
export const fenced = (text: string, language = ""): string => {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((match) => match[0].length))
  const fence = "`".repeat(longest + 1)
  return `${fence}${language}\n${text.replace(/\n+$/, "")}\n${fence}`
}

const diffLine = (diff: ReportDiff): string =>
  `- **${diff.type}** ${diff.action} \`${diff.path || "/"}\` (${diff.scope})${diff.location ? ` at ${diff.location}` : ""}${diff.description ? `: ${diff.description}` : ""}`

const summaryLine = (diffs: readonly ReportDiff[]): string => {
  if (!diffs.length) {
    return "No diffs."
  }
  const counts = DIFF_TYPES.map((type) => [type, diffs.filter((diff) => diff.type === type).length] as const)
    .filter(([, count]) => count)
    .map(([type, count]) => `${count} ${type}`)
  return `${diffs.length} diff${diffs.length === 1 ? "" : "s"}: ${counts.join(", ")}.`
}

/** The diff section: the selected diff, then the list (limited to `limit` lines) */
const diffsField = (input: ReportInput, limit = Number.POSITIVE_INFINITY): string => {
  const parts: string[] = []
  if (input.diff) {
    parts.push(`Reported diff:\n\n${diffLine(input.diff)}`)
  }
  if (input.failure) {
    parts.push(`Failure:\n\n${fenced(input.failure)}`)
  }
  parts.push(`All diffs — ${summaryLine(input.diffs)}`)
  const shown = input.diffs.slice(0, limit)
  if (shown.length) {
    parts.push(shown.map(diffLine).join("\n"))
  }
  if (shown.length < input.diffs.length) {
    parts.push(`… ${input.diffs.length - shown.length} more (open the portal link to see all of them).`)
  }
  if (input.errors?.length) {
    parts.push(`Errors (\`onError\`):\n\n${fenced(input.errors.join("\n"))}`)
  }
  return parts.join("\n\n")
}

const reproductionField = (input: ReportInput): string =>
  `Specification: ${input.spec}\nReported from: ${input.origin}\n\n${fenced(input.snippet, "ts")}`

export const documentsMarkdown = (input: ReportInput): string =>
  `Before:\n\n${fenced(input.before.text, input.before.language)}\n\nAfter:\n\n${fenced(input.after.text, input.after.language)}`

const OMITTED_DOCUMENTS =
  "The documents are too large for the issue link: attach them or paste them here (the portal's **Copy documents** button copies both)."

const expectedText = (input: ReportInput): string => (input.expectedType ? input.expectedType : "")

export const reportTitle = (input: ReportInput): string => {
  const kind = problemKind(input.kind).label
  const { diff, expectedType } = input
  const subject = diff
    ? `${diff.type}: ${diff.description || `${diff.action} ${diff.path || "/"}`}`
    : `${input.spec} (${input.origin})`
  const suffix = diff && expectedType && expectedType !== diff.type ? ` (expected ${expectedType})` : ""
  const room = 120 - kind.length - 2 - suffix.length
  return `${kind}: ${subject.length > room ? `${subject.slice(0, room - 1)}…` : subject}${suffix}`
}

const buildUrl = (title: string, labels: readonly string[], fields: Record<FieldId, string>): string => {
  const params: [string, string][] = [
    ["template", ISSUE_TEMPLATE],
    ["title", title],
  ]
  if (labels.length) {
    params.push(["labels", labels.join(",")])
  }
  for (const id of FIELD_IDS) {
    if (fields[id]) {
      params.push([id, fields[id]])
    }
  }
  return `${NEW_ISSUE_URL}?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`
}

// length of a field value inside `issueUrlLength` (encoded for the query, then again for the sign-in redirect)
const encodedLength = (text: string): number => encodeURIComponent(encodeURIComponent(text)).length

/** Shortens text to fit `budget` characters of `encodedLength` */
const shorten = (text: string, budget: number): string => {
  if (encodedLength(text) <= budget) {
    return text
  }
  const suffix = "\n…"
  let low = 0
  let high = text.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (encodedLength(text.slice(0, middle) + suffix) <= budget) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return low ? text.slice(0, low) + suffix : ""
}

export const reportMarkdown = (input: ReportInput): string => {
  const sections = [
    `**Problem**: ${problemKind(input.kind).label}${input.expectedType ? `\n**Expected**: ${input.expectedType}` : ""}`,
    `### What is wrong\n\n${input.note?.trim() || "_No details given._"}`,
    `### Diffs\n\n${diffsField(input)}`,
    `### Reproduction\n\n${reproductionField(input)}`,
    `### Documents\n\n${documentsMarkdown(input)}`,
    `### Environment\n\n- api-smart-diff: ${input.version}\n- Browser: ${input.userAgent}${input.shareUrl ? `\n- Portal link: ${input.shareUrl}` : ""}`,
  ]
  return `## ${reportTitle(input)}\n\n${sections.join("\n\n")}\n`
}

/**
 * Builds the report. The URL holds every field when it fits MAX_URL_LENGTH (`maxLength`); otherwise it leaves out,
 * in this order, the documents, the diff list beyond the reported diff, the portal link and finally shortens the
 * reader's note, and `omitted` says what is missing so the dialog can ask for it.
 */
export const buildReport = (input: ReportInput, maxLength = MAX_URL_LENGTH): Report => {
  const title = reportTitle(input)
  const kindLabel = problemKind(input.kind).issueLabel
  const labels = kindLabel ? [kindLabel] : []
  const fields: Record<FieldId, string> = {
    problem: problemKind(input.kind).label,
    expected: expectedText(input),
    details: input.note?.trim() ?? "",
    diffs: diffsField(input),
    reproduction: reproductionField(input),
    documents: documentsMarkdown(input),
    version: input.version,
    environment: input.userAgent,
    link: input.shareUrl ?? "",
  }
  const omitted = { documents: false, diffs: false, link: false, details: false }
  const fits = () => issueUrlLength(buildUrl(title, labels, fields)) <= maxLength

  if (!fits()) {
    omitted.documents = true
    fields.documents = OMITTED_DOCUMENTS
  }
  // fewer diff lines, down to none (the reported diff and the summary stay)
  for (
    let limit = Math.min(input.diffs.length - 1, 50);
    !fits() && limit >= 0;
    limit = limit > 10 ? limit - 10 : limit - 1
  ) {
    omitted.diffs = true
    fields.diffs = diffsField(input, limit)
  }
  if (!fits() && fields.link) {
    omitted.link = true
    fields.link = ""
  }
  if (!fits()) {
    omitted.details = true
    const rest = issueUrlLength(buildUrl(title, labels, { ...fields, details: "" })) + "%26details%3D".length
    fields.details = shorten(fields.details, Math.max(0, maxLength - rest))
  }
  if (!fits()) {
    // the fixed parts alone are too long (a huge failure message): keep the beginnings only
    fields.diffs = shorten(fields.diffs, Math.floor(maxLength / 6))
    fields.reproduction = shorten(fields.reproduction, Math.floor(maxLength / 4))
    fields.environment = shorten(fields.environment, 300)
  }
  return {
    title,
    labels,
    fields,
    url: buildUrl(title, labels, fields),
    markdown: reportMarkdown(input),
    documentsMarkdown: documentsMarkdown(input),
    omitted,
  }
}

/** Fence language of an editor text */
export const documentLanguage = (text: string, sdl = false): string =>
  sdl ? "graphql" : /^\s*[{[]/.test(text) ? "json" : "yaml"

/** What the demo or an example knows about the comparison; the dialog adds the reader's answers and the link */
export type ReportBase = Omit<ReportInput, "kind" | "expectedType" | "note" | "diff" | "shareUrl" | "userAgent">

/** `ReportDiff` of a diff of the comparison (`location`: its location text, `DiffLocation.text`, when known) */
export const reportDiff = (diff: {
  type: DiffType
  action: ActionType
  path: readonly (string | number)[]
  scope: string
  description?: string
  location?: string
}): ReportDiff => ({
  type: diff.type,
  action: diff.action,
  path: diff.path.length
    ? `/${diff.path.map((segment) => String(segment).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`
    : "",
  scope: diff.scope,
  description: diff.description,
  ...(diff.location ? { location: diff.location } : {}),
})

/** The engine `apiCompare` picks for a detected specification label ("OpenAPI 3.1.0 · YAML" → openapi) */
export const engineOfLabel = (label: string): string | undefined =>
  label.includes("OpenAPI")
    ? "openapi"
    : label.includes("AsyncAPI")
      ? "asyncapi"
      : label.includes("GraphApi")
        ? "graphapi"
        : label.includes("JSON Schema")
          ? "jsonschema"
          : undefined
