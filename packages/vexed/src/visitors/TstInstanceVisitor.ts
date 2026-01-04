import { TstInstanceExpression, TstExpression, TstInstanceObject, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export class TstInstanceVisitor extends TstReplaceVisitor {
    visited: Set<TstInstanceObject> = new Set();

    constructor(private runtime: TstRuntime) {
        super();
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        if (this.visited.has(expr.instance)) {
            return expr;
        }

        this.visited.add(expr.instance);

        this.runtime.visitInstanceProperties(this, expr.instance, expr.instance[TypeMeta]);
        return expr;
    }
}
