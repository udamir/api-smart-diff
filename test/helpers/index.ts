import { applyOperation, Operation } from "fast-json-patch"
import yaml from "js-yaml"
import path from "path"
import fs from "fs"

import { apiDiff, apiMerge, BaseRulesType, ObjPath, MergeOptions, Rules, apiDiffTree } from "../../src"
import { buildPath, findExternalRefs } from "../../src/utils"
import { resolveObjValue } from "../../src/dereference"

export class ExampleResource {
  private res: any = {}
  public externalSources: any = {}

  constructor(private filename: string, public rules: BaseRulesType | Rules) {
    const resPath = path.join(__dirname, "../resources/", this.filename)
    const data = fs.readFileSync(resPath, "utf8")
    if (new RegExp(".(yaml|YAML|yml|YML)$", "g").test(filename)) {
      try {
        this.res = yaml.load(data)
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
    return apiDiff(this.res, after, { rules: this.rules, externalRefs: this.externalSources })
  }

  public merge(after: any, options?: MergeOptions) {
    return apiMerge(this.res, after, { ...options, rules: this.rules, externalRefs: this.externalSources })
  }

  public diffTree(after: any, options?: MergeOptions) {
    return apiDiffTree(this.res, after, { ...options, rules: this.rules, externalRefs: this.externalSources })
  }

  public getValue(path: ObjPath | string) {
    path = typeof path === "string" ? path : buildPath(path)
    return resolveObjValue(this.res, path, this.externalSources)
  }

  public findExternalSources () {
    return findExternalRefs(this.res)
  }
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
