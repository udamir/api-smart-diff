import { ApiCompare } from "./apiCompare"
import { IChangeContext, ObjPath } from "./types"

export class ChangeContext implements IChangeContext {
  private _path: ObjPath
  private _engine: ApiCompare

  public get before() {
    return this._engine.resolvePath("before", this._path)
  }

  public get after() {
    const renamedPath = this._engine.getRenamedPath(this._path)
    return this._engine.resolvePath("after", renamedPath)
  }

  public get up() {
    return (n = 1) => new ChangeContext(this._engine, this._path.slice(0,-n))
  }

  public get root() {
    return new ChangeContext(this._engine, [])
  }

  constructor(engine: ApiCompare, path: ObjPath) {
    this._engine = engine
    this._path = path
  }
}
