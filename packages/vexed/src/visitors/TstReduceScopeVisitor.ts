// Reduce variables in all distinct scopes, otherwise leave TST unchanged

import { isInstanceExpression, TstExpression, TstPromiseExpression, TstScopedExpression } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TstReduceExpressionVisitor, TstScope } from "./TstReduceExpressionVisitor.js";
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
        return expr;
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

            const reducer = new TstReduceExpressionVisitor(this.runtime, scope);
            const reducedValue = reducer.visit(variable.value);

            // console.log("Reduced scope variable:", variable.name, "from", printExpression(variable.value), "to", printExpression(reducedValue));
            scope.variables[i].value = reducedValue;
            this.reduceCount += reducer.reduceCount;
            this.promiseExpressions.push(...reducer.promiseExpressions);
        }
    }
}
