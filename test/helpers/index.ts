import { applyOperation, Operation } from "fast-json-patch"
import yaml from "js-yaml"
import path from "path"
import fs from "fs"

import { apiDiff, BaseRulesType, DiffPath } from "../../src"
import { buildPath, resolveObjValue, findExternalRefs } from "../../src/utils"

export class ExampleResource {
  private res: any = {}
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
    return apiDiff(this.res, after, { rules: this.type })
  }

  public getValue(path: DiffPath | string) {
    path = typeof path === "string" ? path : "/" + path.join("/")
    return resolveObjValue(this.res, path)
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
