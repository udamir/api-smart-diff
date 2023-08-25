import { Diff } from "../types";
export type ChangeDocRuleRef = (ctx: ChangeDocContext) => string;
export type ChangeDocRulesRef = (ctx: ChangeDocContext) => ChangeDocRules;
export type ChangeDocRules = {
    [key: `/${string}`]: string | ChangeDocRules | ChangeDocRulesRef | ChangeDocRuleRef;
} & {
    "/"?: string | ChangeDocRuleRef;
};
export interface ChangeDocContext extends Diff {
    key: string | number;
    node: any;
    parent?: any;
    source: any;
}
