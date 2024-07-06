import type { JsonPath } from "json-crawl"

export const isArgSchema = (path: JsonPath) => {
  const i = path.indexOf("args")
  return i === 2
    || (i > 3 && path[i-2] === "properties" && path[i-1] !== "properties")
    || (i > 2 && path[i-2] === "directives" && path[i-1] !== "directives")
}
