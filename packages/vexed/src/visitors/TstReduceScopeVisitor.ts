// Reduce variables in all distinct scopes, otherwise leave TST unchanged

import { isInstanceExpression, ScopeMeta, TstExpression, TstInstanceExpression, TstInstanceObject, TstNewExpression, TstPromiseExpression, TstScopedExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { printScope } from "./TstPrintVisitor.js";
import { getScopeParameter, TstReduceExpressionVisitor, TstScope } from "./TstReduceExpressionVisitor.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export class TstReduceScopeVisitor extends TstReplaceVisitor {

    visitedScopes: Set<TstScope> = new Set();
    reduceCount: number = 0;
    promiseExpressions: TstPromiseExpression[] = [];

    constructor(private runtime: TstRuntime) {
        super();
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        // Reduce all variables in all scopes - once
        this.reduceScopeVariables(expr.scope);

        this.visit(expr.expr);
        return expr;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        // Reduce all constructor arguments for this instance

        const instanceType = expr.instance[TypeMeta];
        const scope = expr.instance[ScopeMeta].get(instanceType)!;
        this.reduceScopeConstructorArguments(expr.instance, scope, instanceType);

        return expr;
    }

    reduceScopeConstructorArguments(instance: TstInstanceObject, scope: TstScope, extendsType: TypeDefinition) {
        for (let parameter of extendsType.parameters) {
            const variable = getScopeParameter(scope, parameter.name);
            if (!variable) {
                throw new Error("Cannot find constructor parameter " + parameter.name + " in scope for instance of " + extendsType.name + " " + printScope(scope));
            }

            this.visit(variable.value);
        }

        if (extendsType.extends) {
            const extendsScope = instance[ScopeMeta].get(extendsType.extends)!;
            this.reduceScopeConstructorArguments(instance, extendsScope, extendsType.extends);
        }
    }

    reduceScopeVariables(scope: TstScope) {

        if (this.visitedScopes.has(scope)) {
            return ;
        }

        this.visitedScopes.add(scope);

        if (scope.parent) {
            this.reduceScopeVariables(scope.parent);
        }

        for (let i = 0; i < scope.variables.length; i++) {
            const variable = scope.variables[i];

            if (isInstanceExpression(variable.value))
                continue;

            // Reduce scoped expression inside the variable value
            this.visit(variable.value);

            const reducer = new TstReduceExpressionVisitor(this.runtime, scope);
            const reducedValue = reducer.visit(variable.value);

            scope.variables[i].value = reducedValue;
            this.reduceCount += reducer.reduceCount;
            this.promiseExpressions.push(...reducer.promiseExpressions);
        }
    }
}
