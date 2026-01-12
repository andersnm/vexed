import { TstInstanceExpression, TstExpression, TstInstanceObject, TypeMeta, InstanceMeta } from "../TstExpression.js";
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

        const instanceType = expr.instance[TypeMeta];
        if (instanceType.name.endsWith("[]")) {
            const array = expr.instance[InstanceMeta] as TstExpression[];
            for (let i = 0; i < array.length; i++) {
                const element = array[i];
                array[i] = this.visit(element);
            }
        }

        return expr;
    }
}
