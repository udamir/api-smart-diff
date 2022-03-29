import { applyOperation, Operation } from "fast-json-patch"
import yaml from "js-yaml"
import path from "path"
import fs from "fs"

import { apiDiff, apiMerge, BaseRulesType, DiffPath, MergeOptions } from "../../src"
import { buildPath, findExternalRefs } from "../../src/utils"
import { resolveObjValue } from "../../src/dereference"

export class ExampleResource {
  private res: any = {}
  public externalSources: any = {}

  constructor(private filename: string, public type: BaseRulesType) {
    try {
      const resPath = path.join(__dirname, "../resources/", this.filename)
      this.res = yaml.load(fs.readFileSync(resPath, "utf8"))
    } catch (e) {
      console.log(e)
    }
  }

  public clone(patches: Operation[]) {
    const res = JSON.parse(JSON.stringify(this.res))
    for (const patch of patches) {
      applyOperation(res, patch)
    }
    return res
  }

  public diff(after: any) {
    return apiDiff(this.res, after, { rules: this.type, externalRefs: this.externalSources })
  }

  public merge(after: any, options?: MergeOptions) {
    return apiMerge(this.res, after, { ...options, rules: this.type, externalRefs: this.externalSources })
  }

  public getValue(path: DiffPath | string) {
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
