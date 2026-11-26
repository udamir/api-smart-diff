import type { CompareOptions, CompareEngine, CompareEngineName } from "./types"
import { compareJsonSchema } from "./jsonSchema"
import { compareGraphApi } from "./graphapi"
import { compareAsyncApi } from "./asyncapi"
import { compareOpenApi } from "./openapi"
import { UnsupportedSpecError } from "./core"
import { isObject } from "./utils"

export interface DetectedSpec {
  engine: CompareEngineName
  // specification version as written in the document (e.g. "3.1.0", "2.6.0", "0.1.2")
  version?: string
}

const engines: Record<CompareEngineName, CompareEngine> = {
  openapi: compareOpenApi,
  asyncapi: compareAsyncApi,
  graphapi: compareGraphApi,
  jsonschema: compareJsonSchema,
}

const versionOf = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined

/**
 * Detects the specification of a document. Objects without a specification marker are JSON Schemas; documents of a
 * recognized but unsupported specification (Swagger 2, OpenAPI 4+, AsyncAPI 1.x/4+, unknown GraphApi versions)
 * throw `UnsupportedSpecError`.
 */
export const detectSpec = (document: unknown): DetectedSpec => {
  if (!isObject(document)) {
    return { engine: "jsonschema" }
  }

  if ("openapi" in document) {
    const version = versionOf(document.openapi)
    if (version !== undefined && /^3(\.\d+)*$/.test(version)) {
      return { engine: "openapi", version }
    }
    throw new UnsupportedSpecError(`Unsupported OpenAPI version: ${String(document.openapi)}`, version)
  }

  if ("swagger" in document) {
    throw new UnsupportedSpecError(`Swagger ${String(document.swagger)} is not supported`, versionOf(document.swagger))
  }

  if ("asyncapi" in document) {
    const version = versionOf(document.asyncapi)
    if (version !== undefined && /^[23](\.\d+)*$/.test(version)) {
      return { engine: "asyncapi", version }
    }
    throw new UnsupportedSpecError(`Unsupported AsyncAPI version: ${String(document.asyncapi)}`, version)
  }

  if ("graphapi" in document && document.graphapi) {
    const version = versionOf(document.graphapi)
    if (version !== undefined && /^(0\.\d+(\.\d+)*|1(\.\d+)*)$/.test(version)) {
      return { engine: "graphapi", version }
    }
    throw new UnsupportedSpecError(`Unsupported GraphApi version: ${String(document.graphapi)}`, version)
  }

  return { engine: "jsonschema" }
}

/** The compare engine for a document (throws `UnsupportedSpecError` for unsupported specifications). */
export const discoverCompareEngine = (data: unknown): CompareEngine => engines[detectSpec(data).engine]

/**
 * Compares two API documents with the engine detected from them (`options.engine` forces one). Both documents must
 * belong to the same specification; the engines check the version compatibility themselves.
 */
export const apiCompare = (before: unknown, after: unknown, options: CompareOptions = {}) => {
  if (options.engine) {
    return engines[options.engine](before, after, options)
  }

  const b = detectSpec(before)
  const a = detectSpec(after)
  if (b.engine !== a.engine) {
    throw new UnsupportedSpecError(
      `Cannot compare a ${b.engine} document with a ${a.engine} document`,
      b.version ?? b.engine,
      a.version ?? a.engine,
    )
  }

  return engines[b.engine](before, after, options)
}
