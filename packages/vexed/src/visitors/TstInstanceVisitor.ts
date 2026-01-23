import { TstInstanceExpression, TstExpression, TstInstanceObject, TypeMeta, InstanceMeta, TstScopedExpression, ScopeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { printScope } from "./TstPrintVisitor.js";
import { TstScope } from "./TstReduceExpressionVisitor.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export class TstInstanceVisitor extends TstReplaceVisitor {
    scopes: Set<TstScope> = new Set();
    visited: Set<TstInstanceObject> = new Set();

    constructor(private runtime: TstRuntime) {
        super();
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        if (this.visited.has(expr.instance)) {
            return expr;
        }

        this.visited.add(expr.instance);

        const instanceType = expr.instance[TypeMeta];
        const scope = expr.instance[ScopeMeta].get(instanceType)!;
        this.visitScopeConstructorArguments(expr.instance, scope, instanceType);

        this.visitInstanceProperties(expr.instance, expr.instance[TypeMeta]);

        if (instanceType.name.endsWith("[]")) {
            const array = expr.instance[InstanceMeta] as TstExpression[];
            for (let i = 0; i < array.length; i++) {
                const element = array[i];
                this.visit(element);
            }
        }

        return expr;
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        // Collect instances referenced only from variables
        this.visitScope(expr.scope);

        return super.visitScopedExpression(expr);
    }

    public visitInstanceProperties(obj: TstInstanceObject, scopeType: TypeDefinition) {
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

    protected visitScope(scope: TstScope) {
        if (this.scopes.has(scope)) {
            return;
        }

        this.scopes.add(scope);

        for (let variable of scope.variables) {
            this.visit(variable.value);
        }

        if (scope.parent) {
            this.visitScope(scope.parent);
        }
    }

    protected visitScopeConstructorArguments(instance: TstInstanceObject, scope: TstScope, extendsType: TypeDefinition) {
        //console.log("Checking scope constructora rargs " + printScope(scope) + " for type " + extendsType.name);
        this.visitScope(scope);

        if (extendsType.extends) {
            const extendsScope = instance[ScopeMeta].get(extendsType.extends)!;
            this.visitScopeConstructorArguments(instance, extendsScope, extendsType.extends);
        }
    }
}
