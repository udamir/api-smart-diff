import { isRefNode } from "../own"

import {
  allAnnotation,
  allUnclassified,
  annotation,
  breaking,
  compareNested,
  deepEqual,
  staticRules,
  unclassified,
} from "../core"
import {
  jsonSchemaRules,
  schemaAnnotationChange,
  schemaCompareResolver,
  valueCompareResolver,
  type JsonSchemaDraft,
  SCHEMA_KIND,
} from "../jsonSchema"
import { openApiSchemaRules } from "../openapi"
import type {
  ClassifyRule,
  CompareContext,
  CompareExtensionRules,
  CompareResolver,
  CompareRules,
  CompareTransformResolver,
} from "../types"
import { isObject, isPlainObject, isString } from "../utils"
import { effectiveObject, fixed, isAsyncApiSchemaFormat } from "./asyncapi.classify"

/**
 * The schema language a `schemaFormat` names (2.x message `schemaFormat`, 3.0 Multi Format Schema Object): the
 * AsyncAPI schema (the default), a JSON Schema draft, an OpenAPI schema object, or a format this library does not
 * understand (Avro, RAML, Protobuf, ...), compared as an opaque value (ISSUE-109, ISSUE-144).
 */
export type SchemaDialect = "asyncapi" | JsonSchemaDraft | "openapi-3.0" | "openapi-3.1" | "opaque"

export const schemaDialect = (format: unknown): SchemaDialect => {
  if (format === undefined) {
    return "asyncapi"
  }
  if (!isString(format)) {
    return "opaque"
  }
  const value = format.trim().toLowerCase()
  if (isAsyncApiSchemaFormat(value)) {
    return "asyncapi"
  }
  const jsonSchema = value.match(/^application\/schema(?:\+json|\+yaml)?(?:\s*;\s*version=([\w.-]+))?\s*$/)
  if (jsonSchema) {
    const draft = jsonSchema[1]
    return draft === "draft-04" || draft === "draft-06" || draft === "2020-12"
      ? draft
      : draft === "2019-09"
        ? "2020-12"
        : "draft-07"
  }
  const openApi = value.match(/^application\/vnd\.oai\.openapi(?:\+json|\+yaml)?(?:\s*;\s*version=([\d.]+))?\s*$/)
  if (openApi) {
    return !openApi[1] || openApi[1].startsWith("3.0") ? "openapi-3.0" : "openapi-3.1"
  }
  return /json-schema/.test(value) ? "draft-07" : "opaque"
}

const combine = (before: SchemaDialect, after: SchemaDialect): SchemaDialect =>
  before === "opaque" || after === "opaque" ? "opaque" : after

/** A 3.0 Multi Format Schema Object (`{ schemaFormat, schema }`). */
export const isMultiFormatSchema = (value: unknown): value is { schemaFormat: unknown; schema: unknown } =>
  isPlainObject(value) && "schemaFormat" in value && "schema" in value

/**
 * A plain schema and a Multi Format Schema Object are brought to one shape before they are compared: a wrapper with
 * the default AsyncAPI schema format is the plain schema written differently (unwrapped, ISSUE-104); a plain schema
 * compared with another format is wrapped with the default format, so the format change is one `schemaFormat` diff.
 */
export const transformMultiFormatSchema: CompareTransformResolver = (before, after, ctx) => {
  if (before === undefined || after === undefined || isRefNode(before) || isRefNode(after)) {
    return [before, after]
  }
  const bWrapped = isMultiFormatSchema(before)
  const aWrapped = isMultiFormatSchema(after)
  if (bWrapped === aWrapped) {
    return [before, after]
  }
  const wrapped = (bWrapped ? before : after) as { schemaFormat: unknown; schema: unknown }
  if (isAsyncApiSchemaFormat(wrapped.schemaFormat)) {
    return bWrapped ? [wrapped.schema, after] : [before, wrapped.schema]
  }
  const root = bWrapped ? ctx?.after.root : ctx?.before.root
  const version = isObject(root) && root.asyncapi !== undefined ? String(root.asyncapi) : "3.0.0"
  const plain = {
    schemaFormat: `application/vnd.aai.asyncapi+json;version=${version}`,
    schema: bWrapped ? after : before,
  }
  return bWrapped ? [before, plain] : [plain, after]
}

// keywords whose meaning differs between the JSON Schema drafts (tuple `items`, boolean exclusive bounds, ...)
const DRAFT_SPECIFIC = new Set([
  "additionalItems",
  "prefixItems",
  "dependencies",
  "$recursiveRef",
  "$recursiveAnchor",
  "$dynamicRef",
  "$dynamicAnchor",
])
// OpenAPI 3.0 Schema Object keywords JSON Schema reads differently or not at all (POLICY-91); boolean exclusive
// bounds are draft-specific anyway
const OPENAPI_30_SPECIFIC = new Set(["nullable", "example", "discriminator", "xml"])
// keywords whose value maps names to schemas: their keys are names, not keywords
const NAMED_SCHEMAS = new Set(["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"])

/** Whether a schema (at any depth) uses one of `keywords`, a tuple `items` or boolean exclusive bounds. */
const usesKeyword = (value: unknown, keywords: Set<string>, seen = new Set<unknown>()): boolean => {
  if (!isObject(value) || seen.has(value)) {
    return false
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.some((item) => usesKeyword(item, keywords, seen))
  }
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key]
    if (
      keywords.has(key) ||
      (key === "items" && Array.isArray(child)) ||
      ((key === "exclusiveMinimum" || key === "exclusiveMaximum") && typeof child === "boolean")
    ) {
      return true
    }
    const nested = NAMED_SCHEMAS.has(key) && isObject(child) && !Array.isArray(child) ? Object.values(child) : [child]
    if (nested.some((item) => usesKeyword(item, keywords, seen))) {
      return true
    }
  }
  return false
}

/**
 * Formats that read a schema as JSON Schema (POLICY-91 decided): the AsyncAPI schema (a draft-07 superset), the JSON
 * Schema drafts, OpenAPI 3.1 (a 2020-12 dialect), and OpenAPI 3.0 when the schema uses no 3.0-specific keyword.
 */
const isJsonCompatible = (dialect: SchemaDialect, schema: unknown) =>
  dialect === "asyncapi" ||
  dialect === "draft-04" ||
  dialect === "draft-06" ||
  dialect === "draft-07" ||
  dialect === "2020-12" ||
  dialect === "openapi-3.1" ||
  (dialect === "openapi-3.0" && !usesKeyword(schema, OPENAPI_30_SPECIFIC))

// the schema a `schemaFormat` governs: the `schema` of a Multi Format Schema Object, the `payload` of a 2.x message
const governedSchema = (parent: unknown): unknown =>
  isMultiFormatSchema(parent) ? parent.schema : isObject(parent) ? parent.payload : undefined

/**
 * Two spellings of the AsyncAPI schema format are the same format; an equal schema switched between JSON Schema
 * compatible formats (POLICY-91: the AsyncAPI schema, the JSON Schema drafts, OpenAPI 3.1, OpenAPI 3.0 without
 * 3.0-specific keywords) without draft-specific keywords is read the same way, an annotation (POLICY-82 decided,
 * consistent with POLICY-28); any other `schemaFormat` change is breaking.
 */
const schemaFormatClassifier = ({ before, after }: CompareContext) => {
  if (isAsyncApiSchemaFormat(before.value ?? AA_DEFAULT) && isAsyncApiSchemaFormat(after.value ?? AA_DEFAULT)) {
    return annotation
  }
  const bSchema = governedSchema(before.parent)
  const aSchema = governedSchema(after.parent)
  if (
    bSchema === undefined ||
    !deepEqual(bSchema, aSchema) ||
    !isJsonCompatible(schemaDialect(before.value), bSchema) ||
    !isJsonCompatible(schemaDialect(after.value), aSchema)
  ) {
    return breaking
  }
  return usesKeyword(bSchema, DRAFT_SPECIFIC) ? breaking : annotation
}
const AA_DEFAULT = "application/vnd.aai.asyncapi"

export const schemaFormatRule: ClassifyRule = fixed([
  schemaFormatClassifier,
  schemaFormatClassifier,
  schemaFormatClassifier,
])

// a schema in a format this library does not understand: one unclassified replace when the (resolved) values differ
const opaqueCompareResolver: CompareResolver = (ctx) => {
  const resolve = (side: "before" | "after") => {
    const value = ctx[side].value
    return isRefNode(value) ? (ctx.session.resolveRef(side, ctx[side].root, value.$ref)?.value ?? value) : value
  }
  return valueCompareResolver({
    ...ctx,
    before: { ...ctx.before, value: resolve("before") },
    after: { ...ctx.after, value: resolve("after") },
    rules: { ...ctx.rules, $: [unclassified, unclassified, unclassified] },
  })
}

export const opaqueSchemaRules: CompareRules = { $: allUnclassified, compare: opaqueCompareResolver }

export interface SchemaDialectOptions {
  notMergeAllOf?: boolean
  extensions?: CompareExtensionRules
}

// `nullable` is an OpenAPI 3.0 keyword: neither the AsyncAPI Schema Object nor JSON Schema define it, so it changes
// no valid value (POLICY-10 decided (a): a definition without effect is an annotation; AA-FRK-001)
export const asyncApiSchemaBaseRules: CompareRules = {
  "/nullable": { $: allAnnotation, annotate: schemaAnnotationChange },
}

/** Rule sets per schema dialect, built once per AsyncAPI rule tree (`asyncapi` is the profile's own schema rules). */
export const createSchemaDialects = (
  asyncApiRules: CompareRules,
  { notMergeAllOf, extensions }: SchemaDialectOptions,
) => {
  const cache = new Map<SchemaDialect, CompareRules>()
  return (dialect: SchemaDialect): CompareRules => {
    if (dialect === "asyncapi") {
      return asyncApiRules
    }
    let rules = cache.get(dialect)
    if (!rules) {
      rules =
        dialect === "opaque"
          ? opaqueSchemaRules
          : dialect === "openapi-3.0" || dialect === "openapi-3.1"
            ? openApiSchemaRules({ version: dialect === "openapi-3.0" ? "3.0" : "3.1", notMergeAllOf, extensions })
            : jsonSchemaRules({ notMergeAllOf, version: dialect, extensions, baseRules: asyncApiSchemaBaseRules })
      cache.set(dialect, rules)
    }
    return rules
  }
}

/**
 * 2.x message payload: the message's (effective) `schemaFormat` selects the schema language of the payload
 * (ISSUE-109 for 2.x; the `schemaFormat` change itself is reported at the message).
 */
export const createPayloadDialectResolver = (
  dialects: (dialect: SchemaDialect) => CompareRules,
  presence: ClassifyRule,
): CompareResolver => {
  const payloadRules = new Map<SchemaDialect, CompareRules>()
  return (ctx: CompareContext) => {
    const format = (side: "before" | "after") => {
      const message = ctx[side].up?.value
      return message === undefined ? undefined : effectiveObject(ctx, side, message)?.schemaFormat
    }
    const dialect = combine(schemaDialect(format("before")), schemaDialect(format("after")))
    if (dialect === "asyncapi") {
      return schemaCompareResolver(ctx)
    }
    let rules = payloadRules.get(dialect)
    if (!rules) {
      rules = { ...dialects(dialect), $: presence }
      payloadRules.set(dialect, rules)
    }
    return compareNested(ctx, ctx.before.value, ctx.after.value, { rules })
  }
}

/**
 * 3.0 schema sites that admit a Multi Format Schema Object (message `payload` / `headers`, `components.schemas`):
 * a plain schema uses the profile's schema rules; a multi-format object is compared field by field, its `schema` with
 * the rules of the dialect its `schemaFormat` names (ISSUE-109, ISSUE-144).
 */
export const createMultiFormatResolver = (
  dialects: (dialect: SchemaDialect) => CompareRules,
  presence: ClassifyRule,
  extra: CompareRules = {},
): CompareResolver => {
  const shells = new Map<SchemaDialect, CompareRules>()
  const shell = (dialect: SchemaDialect): CompareRules => {
    let rules = shells.get(dialect)
    if (!rules) {
      rules = {
        $: presence,
        "/schemaFormat": { $: schemaFormatRule },
        "/schema": staticRules(() => ({ ...dialects(dialect), $: presence, kind: SCHEMA_KIND })),
        "/*": { $: allUnclassified },
        ...extra,
      }
      shells.set(dialect, rules)
    }
    return rules
  }
  return (ctx: CompareContext) => {
    const { value: before } = ctx.before
    const { value: after } = ctx.after
    if (isMultiFormatSchema(before) && isMultiFormatSchema(after)) {
      const dialect = combine(schemaDialect(before.schemaFormat), schemaDialect(after.schemaFormat))
      return compareNested(ctx, before, after, { rules: shell(dialect) })
    }
    return schemaCompareResolver(ctx)
  }
}
