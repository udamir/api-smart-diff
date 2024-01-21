import { applyOperation, Operation } from "fast-json-patch"
import { buildFromSchema, GraphApiSchema } from "gqlapi"
import { buildSchema } from "graphql"
import { JsonPath } from "json-crawl"
import YAML from "js-yaml"
import path from "path"
import fs from "fs"


import { apiDiff, apiMerge, getKeyValue, buildPath, ComapreOptions, CompareRules } from "../../src"

export const yaml = (strings: TemplateStringsArray): object => {
  return YAML.load(strings[0]) as object
}

export const graphapi = (strings: TemplateStringsArray): GraphApiSchema => {
  return buildFromSchema(buildSchema(strings[0], { noLocation: true }))
}

export class ExampleResource {
  private res: any = {}
  public externalSources: any = {}

  constructor(private filename: string, public rules?: CompareRules) {
    const resPath = path.join(__dirname, "../resources/", this.filename)
    const data = fs.readFileSync(resPath, "utf8")
    if (new RegExp(".(yaml|YAML|yml|YML)$", "g").test(filename)) {
      try {
        this.res = YAML.load(data)
      } catch (e) {
        console.log(e)
      }
    } else if (new RegExp(".(graphql|gql)$", "g").test(filename)) {
      try {
        const schema = buildSchema(data, { noLocation: true })
        this.res = buildFromSchema(schema)
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
    return apiDiff(this.res, after, { rules: this.rules, externalSources: this.externalSources })
  }

  public merge(after: any, options?: ComapreOptions) {
    return apiMerge(this.res, after, { ...options, rules: this.rules, externalSources: this.externalSources })
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
