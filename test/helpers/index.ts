import { applyOperation, type Operation } from "fast-json-patch"
import { buildFromSchema, type GraphApiSchema as GraphApi10Schema } from "gqlapi"
import { buildFromSchema as buildLegacyFromSchema, type GraphApiSchema } from "gqlapi-legacy"
import { buildSchema } from "graphql"
import type { JsonPath } from "json-crawl"
import YAML from "js-yaml"
import path from "node:path"
import fs from "node:fs"

import { apiCompare, type CompareOptions, type CompareRules } from "../../src"
import { getKeyValue } from "../../src/utils"
import { buildPath } from "../../src/jsonSchema"

export const yaml = (strings: TemplateStringsArray): object => {
  return YAML.load(strings[0]) as object
}

// GraphApi 0.1.2 documents come from the gqlapi pre-release that still writes them (gqlapi 0.6 writes only 1.0)
export const graphapi = (strings: TemplateStringsArray): GraphApiSchema => {
  return buildLegacyFromSchema(buildSchema(strings[0], { noLocation: true }))
}

/** GraphApi 1.0 document (gqlapi 0.6) from SDL */
export const graphapi10 = (strings: TemplateStringsArray): GraphApi10Schema => {
  return buildFromSchema(buildSchema(strings[0], { noLocation: true }))
}

export class ExampleResource {
  private res: any = {}
  public externalSources: any = {}

  constructor(
    private filename: string,
    public rules?: CompareRules,
  ) {
    const resPath = path.join(import.meta.dirname, "../resources/", this.filename)
    const data = fs.readFileSync(resPath, "utf8")
    if (/.(yaml|YAML|yml|YML)$/g.test(filename)) {
      try {
        this.res = YAML.load(data)
      } catch (e) {
        console.log(e)
      }
    } else if (/.(graphql|gql)$/g.test(filename)) {
      try {
        const schema = buildSchema(data, { noLocation: true })
        this.res = buildLegacyFromSchema(schema)
      } catch (e) {
        console.log(e)
      }
    }
  }

  public clone(patches: Operation[] = []) {
    const res = JSON.parse(JSON.stringify(this.res))
    for (const patch of patches) {
      applyOperation(res, patch)
    }
    return res
  }

  public diff(after: any) {
    return apiCompare(this.res, after, { rules: this.rules, externalSources: this.externalSources }).diffs
  }

  public merge(after: any, options?: CompareOptions) {
    return apiCompare(this.res, after, { ...options, rules: this.rules, externalSources: this.externalSources }).merged
  }

  public getValue(path: JsonPath) {
    // path = typeof path === "string" ? parsePath(path) : path
    return getKeyValue(this.res, ...path)
  }

  // public findExternalSources () {
  //   return findExternalRefs(this.res)
  // }
}

export const addPatch = (pathArr: any[], value: any): Operation => {
  return {
    op: "add",
    path: buildPath(pathArr),
    value,
  }
}

export const replacePatch = (pathArr: any[], value: any): Operation => {
  return {
    op: "replace",
    path: buildPath(pathArr),
    value,
  }
}

export const removePatch = (pathArr: any[]): Operation => {
  return {
    op: "remove",
    path: buildPath(pathArr),
  }
}
