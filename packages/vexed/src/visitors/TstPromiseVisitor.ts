import { TstInstanceExpression, TstExpression, TstInstanceObject, TypeMeta, InstanceMeta, TstPromiseExpression } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TstInstanceVisitor } from "./TstInstanceVisitor.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export class TstPromiseVisitor extends TstInstanceVisitor {
    promises: Set<TstPromiseExpression> = new Set();

    constructor(runtime: TstRuntime) {
        super(runtime);
    }

    visitPromiseExpression(expr: TstPromiseExpression): TstExpression {
        this.promises.add(expr);
        return super.visitPromiseExpression(expr);
    }
}
