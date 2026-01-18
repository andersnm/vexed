import { TstInstanceExpression, TstExpression, TstInstanceObject, TypeMeta, InstanceMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
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

        this.visitInstanceProperties(expr.instance, expr.instance[TypeMeta]);

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

    visitInstanceProperties(obj: TstInstanceObject, scopeType: TypeDefinition) {
        if (scopeType.extends) {
            this.visitInstanceProperties(obj, scopeType.extends);
        }

        for (let propertyDeclaration of scopeType.properties) {
            // TODO: why not resolveProperty - visit native results? need resolveProperty deep true/false?
            if (!obj[propertyDeclaration.name]) {
                continue;
            }
            this.visit(obj[propertyDeclaration.name]);
        }
    }
}
