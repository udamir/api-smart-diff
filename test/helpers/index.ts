import { applyOperation, Operation } from 'fast-json-patch';
import yaml from 'js-yaml';
import path from 'path';
import fs from 'fs';

import { apiDiff, BaseRulesType, DiffPath } from '../../src';
import { typeOf } from '../../src/utils';

export class ExampleResource {
  private res: any = {}
  constructor(private filename: string, public type: BaseRulesType) {
    try {
      const resPath = path.join(__dirname, "../resources/", this.filename)
      this.res = yaml.load(fs.readFileSync(resPath, 'utf8'));
    } catch (e) {
      console.log(e);
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

  public getValue(pathArr: DiffPath) {
    let value = this.res
    for (const key of pathArr) {
      if (typeOf(value) === "array") {
        value = value[+key]
      } else {
        value = value[key]
      }
      if (value === undefined) {
        break
      }
    }
    return value
  }
}

export const addPatch = (pathArr: any[], value: any): Operation => {
  return {
    op: "add",
    path: "/" + pathArr.join("/"),
    value
  }
}

export const replacePatch = (pathArr: any[], value: any): Operation => {
  return {
    op: "replace",
    path: "/" + pathArr.join("/"),
    value
  }
}

export const removePatch = (pathArr: any[]): Operation => {
  return {
    op: "remove",
    path: "/" + pathArr.join("/"),
  }
}
