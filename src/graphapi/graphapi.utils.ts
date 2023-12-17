import { JsonPath } from "json-crawl"

export const isArgSchema = (path: JsonPath) => {
  const i = path.indexOf("args")
  return i === 2 || (i > 4 && path[i-2] === "properties" && path[i-1] !== "properties")
}
