import { parseRef } from "allof-merge"

type ParsedRef = ReturnType<typeof parseRef>

const cache = new Map<string, ParsedRef>()
const CACHE_LIMIT = 10000

/** `parseRef` with a bounded memo: the same `$ref` strings repeat thousands of times in large documents. */
export const parseRefCached = ($ref: string): ParsedRef => {
  let parsed = cache.get($ref)
  if (!parsed) {
    parsed = parseRef($ref)
    if (cache.size >= CACHE_LIMIT) {
      cache.clear()
    }
    cache.set($ref, parsed)
  }
  return parsed
}
