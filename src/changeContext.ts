import { ApiCompare } from "./apiCompare"
import { IChageContext, ObjPath } from "./types"

export class ChangeContext implements IChageContext {
  private _path: ObjPath
  private _engine: ApiCompare

  public get before() {
    return this._engine.resolvePath("before", this._path)
  }

  public get after() {
    const renamedPath = this._engine.getRenamedPath(this._path)
    return this._engine.resolvePath("after", renamedPath)
  }

  constructor(engine: ApiCompare, path: ObjPath) {
    this._engine = engine
    this._path = path
  }

  public up(n = 1) {
    return new ChangeContext(this._engine, this._path.slice(0,-n))
  }

  public root() {
    return new ChangeContext(this._engine, [])
  }
}
