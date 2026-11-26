// Internal helpers (not exported from the package): reads of document objects that stay out of the V8 runtime.

const hasOwn = Object.prototype.hasOwnProperty

/**
 * Whether a document object has an own key. Document objects come in as many hidden classes as there are key sets,
 * so a named property access or `in` check on them is megamorphic, and every full garbage collection clears V8's
 * megamorphic cache: each (key set, name) pair then went through the runtime once in the first call after it
 * (ISSUE-330). An own-property check and a keyed load of a present key mostly stay out of the
 * runtime. Equivalent to `key in obj` for plain JSON data (no inherited document keys).
 */
export const hasOwnKey = (obj: object, key: string): boolean => hasOwn.call(obj, key)

/** The own value of `key` of a document object, `undefined` when absent (see `hasOwnKey`). */
export const ownValue = (obj: object, key: string): unknown =>
  hasOwn.call(obj, key) ? (obj as Record<string, unknown>)[key] : undefined

/** A reference object (`{ $ref: "..." }` with a non-empty string), read without a named property access (ISSUE-330). */
export const isRefNode = (value: unknown): value is { $ref: string } => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const ref = ownValue(value, "$ref")
  return typeof ref === "string" && ref !== ""
}
