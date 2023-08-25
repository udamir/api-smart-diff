import { ApiCompare } from "./apiCompare";
import { IChangeContext, ObjPath } from "./types";
export declare class ChangeContext implements IChangeContext {
    private _path;
    private _engine;
    get before(): any;
    get after(): any;
    get up(): (n?: number) => ChangeContext;
    get root(): ChangeContext;
    constructor(engine: ApiCompare, path: ObjPath);
}
