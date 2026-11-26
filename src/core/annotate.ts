import type { JsonPath } from "json-crawl"

import { isObject, objectKeys, isString, isArray } from "../utils"
import type { AnnotateTemplate, ChangeAnnotationResolver, CompareContext, Diff } from "../types"
import { CompareScopes } from "./constants"
import { ruleView } from "./rules"
import { type RenamedEntryNames, documentEntryRenames, renamedEntry } from "./renames"

export const annotationTemplate = (template: string, params?: AnnotateTemplate["params"]): AnnotateTemplate =>
  params ? { template, params } : { template }

const MAX_VALUE_LENGTH = 60
const LITERAL_LIKE = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null|\s*)$/
const MAX_LISTED = 5

const jsonText = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

/** Length limit of a free-text value in descriptions (POLICY-95): longer texts are shortened to it and end in "…". */
export const FREE_TEXT_LENGTH = 60

/**
 * Keys whose values are free text (documentation prose): their values are listed shortened to `FREE_TEXT_LENGTH`
 * (POLICY-95). Identifiers, URLs, enum / const / default values and other contract values are always listed in full.
 */
export const FREE_TEXT_KEYS: ReadonlySet<string> = new Set(["description", "summary", "title", "$comment"])

/** Whether the values of `key` are free text (POLICY-95). */
export const isFreeTextKey = (key: unknown): boolean => isString(key) && FREE_TEXT_KEYS.has(key)

/**
 * Length limit of every other string value in descriptions (POLICY-108): identifiers, URLs, enum values and other
 * strings longer than this are shortened to it and end in "…" (in practice identifiers stay intact).
 */
export const MAX_STRING_LENGTH = 200

// a string within `maxLength`: cut at the last word boundary of the limit when it is not far back, else at the limit
const capText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text
  }
  const cut = text.slice(0, maxLength)
  const space = cut.lastIndexOf(" ")
  return `${(space >= maxLength * 0.75 ? cut.slice(0, space) : cut).trimEnd()}…`
}

// a free-text string on one line (every whitespace run, newlines included, becomes one space) within `maxLength`
const shortenText = (value: string, maxLength: number): string => capText(value.replace(/\s+/g, " ").trim(), maxLength)

/**
 * Human-readable rendering of a JSON value for descriptions, in backticks: a string as it is (`gamma`; quoted when it
 * reads like a number, boolean, `null` or is blank: `"1"`), a number, boolean or `null` as JSON (`2`, `true`), a short
 * array or object as compact JSON (`["a","b"]`, `{"a":2}`); a long one is summarized (its first items or keys and the
 * count). Backticks inside a value are replaced by quotes. With `maxLength` (free text, POLICY-95: see `formatText`) a
 * string is put on one line (whitespace runs collapsed) and shortened to `maxLength` characters followed by "…";
 * without it a string is listed as it is up to `MAX_STRING_LENGTH` (200) characters and shortened beyond (POLICY-108;
 * identifiers, URLs and enum values stay complete in practice).
 */
export const formatValue = (value: unknown, maxLength?: number): string => {
  if (value === undefined) {
    return ""
  }
  if (isString(value)) {
    const text = maxLength !== undefined ? shortenText(value, maxLength) : capText(value, MAX_STRING_LENGTH)
    // a string that reads like another JSON value (`"1"`, `"true"`, `""`) is quoted, so it differs from that value
    return LITERAL_LIKE.test(text) ? `\`${JSON.stringify(text)}\`` : `\`${text.replace(/`/g, "'")}\``
  }
  if (!isObject(value)) {
    return `\`${String(value)}\``
  }
  const json = jsonText(value)
  if (json.length <= MAX_VALUE_LENGTH) {
    return `\`${json.replace(/`/g, "'")}\``
  }
  if (isArray(value)) {
    const items = value
      .slice(0, MAX_LISTED)
      .map((item) => formatValue(item, maxLength))
      .join(", ")
    return `[${items}${value.length > MAX_LISTED ? ", …" : ""}] (${value.length} items)`
  }
  const keys = Object.keys(value)
  const listed = keys
    .slice(0, MAX_LISTED)
    .map((key) => `\`${key}\``)
    .join(", ")
  return `object with ${listed}${keys.length > MAX_LISTED ? ", …" : ""} (${keys.length} keys)`
}

/** A free-text value (`description`, `summary`, ...) for descriptions: `formatValue` shortened (POLICY-95). */
export const formatText = (value: unknown): string => formatValue(value, FREE_TEXT_LENGTH)

/** The value rendered by `formatValue`, or `undefined` for a missing value (a template param that does not resolve). */
export const formatParam = (value: unknown, maxLength?: number): string | undefined =>
  value === undefined ? undefined : formatValue(value, maxLength)

const PLACEHOLDER_SPLIT = /{{(\w+)}}/
const SPACING = /\s{2}|\s[.,)]/

// a template split once into its literal parts and placeholder names: parts[0] name[0] parts[1] ... parts[n]
interface CompiledTemplate {
  parts: string[]
  names: string[]
}
const compiledTemplates = new Map<string, CompiledTemplate>()
const COMPILED_LIMIT = 4096

const compileTemplate = (template: string): CompiledTemplate => {
  let compiled = compiledTemplates.get(template)
  if (!compiled) {
    const pieces = template.split(PLACEHOLDER_SPLIT)
    const parts: string[] = []
    const names: string[] = []
    for (let i = 0; i < pieces.length; i++) {
      ;(i % 2 ? names : parts).push(pieces[i])
    }
    compiled = { parts, names }
    if (compiledTemplates.size >= COMPILED_LIMIT) {
      compiledTemplates.clear()
    }
    compiledTemplates.set(template, compiled)
  }
  return compiled
}

interface TemplateVariant {
  params: string[]
  template: string
}

// a template key of a dictionary: its plain template and its `key_a_b` variants, the most specific first (variants
// with as many params keep the dictionary order), so the first variant whose params are all present wins
interface TemplateEntry {
  template: string | undefined
  variants: TemplateVariant[] | undefined
}

// the entries of every dictionary, indexed once (dictionaries are static): one map lookup per template instead of a
// property access on a large object (cleared inline caches after every full garbage collection, ISSUE-191) and the
// variant index of every key (ISSUE-330)
const templateEntries = new WeakMap<Record<string, string>, Map<string, TemplateEntry>>()

const entriesOf = (dict: Record<string, string>): Map<string, TemplateEntry> => {
  let entries = templateEntries.get(dict)
  if (!entries) {
    entries = new Map()
    for (const name of Object.keys(dict)) {
      let entry = entries.get(name)
      if (!entry) {
        entry = { template: undefined, variants: undefined }
        entries.set(name, entry)
      }
      entry.template = dict[name]
    }
    for (const name of objectKeys(dict)) {
      const [base, ...params] = name.split("_")
      if (!params.length) {
        continue
      }
      let entry = entries.get(base)
      if (!entry) {
        entry = { template: undefined, variants: undefined }
        entries.set(base, entry)
      }
      if (!entry.variants) {
        entry.variants = []
      }
      entry.variants.push({ params, template: dict[name] })
    }
    for (const entry of entries.values()) {
      // stable: variants with as many params stay in dictionary order
      entry.variants?.sort((x, y) => y.params.length - x.params.length)
    }
    templateEntries.set(dict, entries)
  }
  return entries
}

// the `annotation` template ("annotation (key)") names an annotation keyword; a change of another class is described
// with the neutral `keyword` template instead (ISSUE-145, `renderTemplate`)
const KEYWORD_TEMPLATE = "`{{key}}`"

// the rendering of one template: its params, read in place (no copy with the param names as keys: such objects get a
// new hidden class per template, which is slow right after a garbage collection, ISSUE-191), and its nested templates,
// each rendered once, when it is first read
interface Rendering {
  dict: Record<string, string>
  params: AnnotateTemplate["params"]
  type: Diff["type"] | undefined
  nested: Map<string, string> | undefined
}

// the text of a nested template param (`createAnnotation`), rendered once per rendering
const nestedParam = (rendering: Rendering, key: string, value: AnnotateTemplate): string => {
  let nested = rendering.nested
  if (!nested) {
    nested = new Map()
    rendering.nested = nested
  }
  let text = nested.get(key)
  if (text === undefined) {
    text = createAnnotation(value, rendering.dict, rendering.type)
    nested.set(key, text)
  }
  return text
}

// the most specific `key_a_b` variant whose params are all present wins over the plain key
const findTemplate = (dict: Record<string, string>, key: string, rendering: Rendering): string | undefined => {
  const entry = entriesOf(dict).get(key)
  let result = entry?.template
  if (result === undefined && key in dict) {
    result = dict[key]
  }
  const variants = entry?.variants
  if (variants) {
    const params = rendering.params
    for (let v = 0; v < variants.length; v++) {
      const names = variants[v].params
      let defined = true
      for (let i = 0; i < names.length && defined; i++) {
        const raw = params ? params[names[i]] : undefined
        const value =
          typeof raw !== "object" || raw === null ? raw : nestedParam(rendering, names[i], raw as AnnotateTemplate)
        defined = value !== undefined && value !== "" && value !== null
      }
      if (defined) {
        return variants[v].template
      }
    }
  }
  return result
}

const renderTemplate = (
  dict: Record<string, string>,
  name: string,
  rawParams: AnnotateTemplate["params"],
  type: Diff["type"] | undefined,
): string => {
  const rendering: Rendering = { dict, params: rawParams, type, nested: undefined }
  // (the template choice and the param reads written out: every call costs before V8 optimizes the description code,
  // ISSUE-330)
  const templateName = name === "annotation" && type !== undefined && type !== "annotation" ? "keyword" : name
  const template =
    templateName === "keyword" && !("keyword" in dict) ? KEYWORD_TEMPLATE : findTemplate(dict, templateName, rendering)
  if (!template) {
    return ""
  }

  // a template renders only when every placeholder resolves (DESIGN_PROPOSALS §4.5): a missing or empty param, or a
  // nested template that does not render, fails the whole template, so the caller's fallback describes the change
  // instead of a text with a gap ("parameter ``", "[Replaced] of id")
  const { parts, names } = compileTemplate(template)
  let text = parts[0]
  for (let i = 0; i < names.length; i++) {
    const key = names[i]
    const raw = rawParams ? rawParams[key] : undefined
    const value = typeof raw !== "object" || raw === null ? raw : nestedParam(rendering, key, raw as AnnotateTemplate)
    if (value === undefined || value === "" || value === null) {
      return ""
    }
    text += String(value)
    text += parts[i + 1]
  }
  return SPACING.test(text)
    ? text
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([.,)])/g, "$1")
        .trim()
    : text.trim()
}

/**
 * Renders a template from a dictionary. A `key_a_b` variant is chosen when every listed param is present and
 * non-empty (the most specific variant wins); the chosen template renders only when each of its placeholders
 * resolves (a missing param or a nested template that does not render gives ""), so the text never contains
 * `undefined`, `{{...}}` or a gap. With the diff's `type`, the `annotation` template is replaced by the dictionary's
 * `keyword` template (or `` `key` ``) for a change that is not an annotation. Templates are split into literal parts
 * once.
 */
export const createAnnotation = (
  annotationTemplate?: AnnotateTemplate,
  dict: Record<string, string> = {},
  type?: Diff["type"],
): string => {
  if (!annotationTemplate) {
    return ""
  }
  const { template = "", params } = annotationTemplate
  return renderTemplate(dict, template, params, type)
}

/**
 * The nearest named container of a changed node (POLICY-08 decided (a): the nearest container suffices, `diff.path`
 * carries the operation): its description ("operation `GET /pets`", "message `signup` of channel `userSignup`",
 * "schema component `Pet`") and the number of `diff.path` segments it spans, so the fallback can name the remaining
 * path inside it.
 */
export interface DiffContainer {
  // empty for a container that is named by the caller (a schema whose location the spec template states)
  name: string
  length: number
  // the path inside the container in the container's own terms (a schema: its property path and keywords)
  describeInside?: (inside: JsonPath) => string
}

export type ContainerLocator = (diff: Diff, ctx: CompareContext) => DiffContainer | undefined

/**
 * One segment of a container pattern: a literal key, `*` (any key, captured), `#` (an array index, captured) or a
 * predicate on the key (captured).
 */
export type ContainerSegment = string | ((key: string | number) => boolean)

export interface ContainerPattern {
  at: ContainerSegment[]
  // the container's description from the captured keys (in pattern order), the document root and the container path
  name: (keys: (string | number)[], root: unknown, path: JsonPath) => string | undefined
}

const matchSegment = (segment: ContainerSegment, key: string | number): boolean | "capture" => {
  if (typeof segment === "function") {
    return segment(key) ? "capture" : false
  }
  if (segment === "*") {
    return typeof key === "string" ? "capture" : false
  }
  if (segment === "#") {
    return typeof key === "number" ? "capture" : false
  }
  return segment === key
}

/**
 * A container locator from path patterns, matched against the declaration path of the changed node (`origin`, else
 * `diff.path`) and against `diff.path`; the longest match wins. The patterns of a spec name its containers once for
 * every fallback description (operations, parameters, responses, channels, messages, components, types, fields, ...).
 */
export const createContainerLocator =
  (patterns: ContainerPattern[]): ContainerLocator =>
  (diff, ctx) => {
    const node = diff.action === "add" ? ctx.after : ctx.before
    let best: DiffContainer | undefined
    let bestPattern: ContainerPattern | undefined
    let bestKeys: (string | number)[] = []
    let bestAt: number[] = []
    for (let p = 0; p < patterns.length; p++) {
      const pattern = patterns[p]
      const { at } = pattern
      // the container is the changed node or one of its ancestors
      if (at.length > diff.path.length) {
        continue
      }
      const keys: (string | number)[] = []
      const positions: number[] = []
      let matched = true
      for (let i = 0; i < at.length; i++) {
        const result = matchSegment(at[i], diff.path[i])
        if (!result) {
          matched = false
          break
        }
        if (result === "capture") {
          keys.push(diff.path[i])
          positions.push(i)
        }
      }
      if (!matched || (best && best.length >= at.length)) {
        continue
      }
      const name = pattern.name(keys, node.root, diff.path.slice(0, at.length))
      if (name) {
        best = { name, length: at.length }
        bestPattern = pattern
        bestKeys = keys
        bestAt = positions
      }
    }
    return best && bestPattern ? withRenamedEntries(best, bestPattern, bestKeys, bestAt, diff, ctx, node.root) : best
  }

// a placeholder for the k-th captured key when it names a renamed entry (never part of a document key)
const renamedPlaceholder = (k: number) => `\u0000renamed${k}\u0000`

/**
 * A container that is (or lies in) a renamed entry names it by its new key and the key it was renamed from
 * (POLICY-107: "schema component `New` (renamed from `Old`)"); `diff.path` holds the before keys.
 */
const withRenamedEntries = (
  container: DiffContainer,
  pattern: ContainerPattern,
  keys: (string | number)[],
  positions: number[],
  diff: Diff,
  ctx: CompareContext,
  root: unknown,
): DiffContainer => {
  if (!documentEntryRenames(ctx).size) {
    return container
  }
  const placeholderKeys = [...keys]
  const renamed: (RenamedEntryNames | undefined)[] = []
  for (let k = 0; k < keys.length; k++) {
    renamed[k] = renamedEntry(ctx, "before", diff.path.slice(0, positions[k] + 1))
    if (renamed[k]) {
      placeholderKeys[k] = renamedPlaceholder(k)
    }
  }
  if (!renamed.some(Boolean)) {
    return container
  }
  let name = pattern.name(placeholderKeys, root, diff.path.slice(0, container.length))
  if (!name) {
    return container
  }
  for (let k = 0; k < keys.length; k++) {
    const names = renamed[k]
    if (names) {
      const placeholder = renamedPlaceholder(k)
      name = name
        .replace(`\`${placeholder}\``, `\`${names.name}\` (renamed from \`${names.from}\`)`)
        .split(placeholder)
        .join(names.name)
    }
  }
  return { ...container, name }
}

const BACKTICKED = /`[^`]+`/g

/**
 * A rendered description with its container appended (" in <container>") unless the text already names it (every
 * backticked name of the container occurs in the text): for hooks whose templates name the changed entity but not
 * the object it belongs to (a field without its type).
 */
export const withContainer = (text: string, container: DiffContainer | undefined): string => {
  if (!text || !container) {
    return text
  }
  const names = container.name.match(BACKTICKED)
  if (names ? names.every((name) => text.includes(name)) : text.includes(container.name)) {
    return text
  }
  return `${text} in ${container.name}`
}

/**
 * A `components` map key as words for descriptions, singular and lower case: `securitySchemes` → "security scheme",
 * `requestBodies` → "request body", `correlationIds` → "correlation ID", `inputObjects` → "input object".
 */
export const componentKindWord = (kind: string): string =>
  kind
    .replace(/ies$/, "y")
    .replace(/s$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\bid\b/, "ID")

const actionWord: Record<Diff["action"], string> = {
  add: "Added",
  remove: "Removed",
  replace: "Replaced",
  rename: "Renamed",
}

const actionPreposition: Record<Diff["action"], string> = {
  add: "to",
  remove: "from",
  replace: "of",
  rename: "of",
}

// scopes worth naming in a description; `components` is an internal reading of a component, named by its container
const scopeWord: Record<string, string> = {
  [CompareScopes.request]: "request",
  [CompareScopes.response]: "response",
  [CompareScopes.args]: "arguments",
  [CompareScopes.output]: "output",
  [CompareScopes.publish]: "publish operation",
  [CompareScopes.subscribe]: "subscribe operation",
  [CompareScopes.send]: "send operation",
  [CompareScopes.receive]: "receive operation",
}

/** Readable location of a node: its path with array indexes in brackets (`paths./pet.get.responses.200`). */
export const describePath = (path: JsonPath): string => {
  let result = ""
  for (let i = 0; i < path.length; i++) {
    const step = path[i]
    result += typeof step === "number" ? `[${step}]` : result ? `.${step}` : String(step)
  }
  return result
}

const isScalar = (value: unknown) => value === null || (typeof value !== "object" && value !== undefined)

// a short name of an object item for the fallback: its `name`, `id`, `url`, `$ref` target or (3.0 servers) `host`
const itemName = (value: unknown): string | undefined => {
  if (isScalar(value)) {
    return formatValue(value)
  }
  if (!isObject(value) || isArray(value)) {
    return
  }
  for (const key of ["name", "id", "url", "host", "$ref"]) {
    const name = value[key]
    if (isString(name)) {
      return formatValue(key === "$ref" ? name.slice(name.lastIndexOf("/") + 1) : name)
    }
  }
  return
}

/**
 * Generated description used when no template applies, so every diff carries a description:
 * `[Action] <what> <to | from | of> <where>[ <values>]`. `what` is the changed key (`` `required` ``), an array item
 * with its name or value (`item [1] `cert``) or the renamed keys; `where` is the path inside the nearest container and
 * the container itself, named by the spec's `locate` (POLICY-08), else the document path and the scope; scalar values
 * are named: the added / removed value, and for a replace "from `a` to `b`".
 */
export const fallbackAnnotation = (diff: Diff, ctx: CompareContext, locate?: ContainerLocator): string => {
  const { action, path } = diff
  const key = path[path.length - 1]
  let what: string
  if (action === "rename") {
    what = `\`${String(diff.before)}\` to \`${String(diff.after)}\``
  } else if (typeof key === "number") {
    const name = itemName(action === "remove" ? ctx.before.value : ctx.after.value)
    what = name ? `item [${key}] ${name}` : `item [${key}]`
  } else {
    what = key === undefined ? "document" : `\`${key}\``
  }
  // free-text values are shortened (POLICY-95)
  const limit = isFreeTextKey(key) ? FREE_TEXT_LENGTH : undefined
  const container = locate?.(diff, ctx)
  // the changed node is a container itself (a channel, an operation, a server): named by it
  if (container?.name && action !== "rename" && container.length >= path.length) {
    return `[${actionWord[action]}] ${container.name}`
  }
  if (typeof key !== "number" && action !== "rename" && action !== "replace") {
    const value = action === "add" ? ctx.after.value : ctx.before.value
    if (isScalar(value)) {
      what += ` ${formatValue(value, limit)}`
    }
  }
  const parent = action === "rename" ? path : path.slice(0, -1)
  let location: string
  if (container) {
    const inside = parent.slice(container.length)
    const relative = inside.length ? (container.describeInside ?? describePath)(inside) : ""
    const name = container.name
    location = relative
      ? ` ${actionPreposition[action]} ${relative}${name ? ` in ${name}` : ""}`
      : name
        ? ` ${actionPreposition[action]} ${name}`
        : ""
  } else {
    const scope = ctx.scope !== CompareScopes.root && scopeWord[ctx.scope] ? ` (${scopeWord[ctx.scope]})` : ""
    location = `${parent.length ? ` ${actionPreposition[action]} ${describePath(parent)}` : ""}${scope}`
  }
  const before = ctx.before.value
  const after = ctx.after.value
  const values =
    action === "replace" && isScalar(before) && isScalar(after)
      ? ` from ${formatValue(before, limit)} to ${formatValue(after, limit)}`
      : ""
  return `[${actionWord[action]}] ${what}${location}${values}`
}

/**
 * Describes a diff with the node's `annotate` rule rendered through `dict` (with the diff's type, see
 * `createAnnotation`), falling back to the generated description (with the spec's container locator) when the rule is
 * missing or its template does not render.
 */
export const describeDiff = (
  diff: Diff,
  ctx: CompareContext,
  dict: Record<string, string>,
  annotate: ChangeAnnotationResolver | undefined = ctx.rules ? ruleView(ctx.rules).annotate : undefined,
  locate?: ContainerLocator,
): string => {
  const template = annotate?.(diff, ctx)
  const text = template ? createAnnotation(template, dict, diff.type) : ""
  return text || fallbackAnnotation(diff, ctx, locate)
}
