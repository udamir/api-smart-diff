import { Diff, ObjPath, Rules, ApiDiffOptions, JsonDiff, ApiMergedMeta, MatchFunc, CompareResult } from "./types";
import { PathPointer } from "./utils";
import { JsonCompare } from "./jsonCompare";
export declare class ApiCompare extends JsonCompare<Diff> {
    before: any;
    after: any;
    rules: Rules;
    beforeRefs: Set<string>;
    afterRefs: Set<string>;
    beforeCache: Map<string, any>;
    afterCache: Map<string, any>;
    compareCache: Map<string, {
        result: CompareResult<Diff>;
        merged: any;
    }>;
    renamedPath: any;
    resolveUnchangedRefs: boolean;
    constructor(before: any, after: any, options?: ApiDiffOptions);
    protected getMatchFunc(path: PathPointer): MatchFunc | undefined;
    static apiDiff(before: any, after: any, options?: ApiDiffOptions): Diff[];
    static apiDiffTree(before: any, after: any, options?: ApiDiffOptions): any;
    static apiMerge(before: any, after: any, options?: ApiDiffOptions): any;
    protected _formatMergeMeta: (diff: Diff) => ApiMergedMeta;
    dereference(source: "before" | "after", value: any, objPath: PathPointer): [any, () => void];
    private calcApiRules;
    classifyDiff(diff: JsonDiff): Diff;
    resolvePath: (source: "before" | "after", objPath: ObjPath) => any;
    getRenamedPath(objPath: ObjPath): (string | number)[];
    compareResult(diff: JsonDiff): CompareResult<Diff>;
    compareObjects(before: any, after: any, objPath: PathPointer, merged: any): CompareResult<Diff>;
}
