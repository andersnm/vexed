// Find all distinct scopes, leave TST unchanged

import { ScopeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstScopedExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { TstInstanceVisitor } from "./TstInstanceVisitor.js";
import { TstScope } from "./TstReduceExpressionVisitor.js";

export class TstScopeVisitor extends TstInstanceVisitor {

    scopes: Set<TstScope> = new Set();

    constructor(runtime: TstRuntime) {
        super(runtime);
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        this.visitScopeVariables(expr.scope);

        return super.visitScopedExpression(expr);
    }

    private visitScopeVariables(scope: TstScope) {

        if (this.scopes.has(scope)) {
            return ;
        }

        this.scopes.add(scope);

        if (scope.parent) {
            this.visitScopeVariables(scope.parent);
        }
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        // Visit all constructor arguments on this instance
        const instanceType = expr.instance[TypeMeta];
        const scope = expr.instance[ScopeMeta].get(instanceType)!;
        this.visitScopeConstructorArguments(expr.instance, scope, instanceType);

        return super.visitInstanceExpression(expr);
    }

    private visitScopeConstructorArguments(instance: TstInstanceObject, scope: TstScope, extendsType: TypeDefinition) {
        this.visitScopeVariables(scope);

        if (extendsType.extends) {
            const extendsScope = instance[ScopeMeta].get(extendsType.extends)!;
            this.visitScopeConstructorArguments(instance, extendsScope, extendsType.extends);
        }
    }
}
