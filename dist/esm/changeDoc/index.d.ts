import { ChangeDocRules } from "./types";
import { Diff } from "../types";
export declare const changeDoc: (diff: Diff, before: any, after: any, rules: ChangeDocRules) => string;
