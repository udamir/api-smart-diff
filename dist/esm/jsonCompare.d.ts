import { JsonCompareOptions, MatchFunc, JsonDiff, CompareResult, JsonMergedMeta } from "./types";
import { PathPointer } from "./utils";
export declare class JsonCompare<D extends JsonDiff = JsonDiff, T extends CompareResult<D> = CompareResult<D>> {
    before: any;
    after: any;
    trimStrings?: boolean;
    caseSensitive?: boolean;
    strictArrays?: boolean;
    matchRules: {
        [path: string]: MatchFunc;
    };
    diffKey: string | symbol;
    arrayMeta?: boolean;
    formatMergedMeta: (diff: D) => any;
    private _merged;
    get merged(): any;
    constructor(before: any, after: any, options?: JsonCompareOptions<D>);
    protected _formatMergeMeta: (diff: D) => JsonMergedMeta;
    private setMeta;
    private checkMatch;
    protected getMatchFunc(path: PathPointer): MatchFunc | undefined;
    compare(): D[];
    buildDiffTree(): any;
    merge(): any;
    normalizeString(value: string): string;
    mergeResults(results: {
        [key: string]: CompareResult<D>;
    }, merged: any, array?: boolean): T;
    mergeValue({ action, before, after }: JsonDiff): any;
    compareResult(diff: JsonDiff): T;
    compareAny(before: any, after: any, path?: PathPointer, merged?: any, key?: string | number): T;
    compareObjects(before: any, after: any, path: PathPointer, merged: any): T;
    compareArrays(before: any[], after: any[], path: PathPointer, merged: any): T;
    compareEnums(before: any[], after: any[], path: PathPointer, merged: any): T;
}
