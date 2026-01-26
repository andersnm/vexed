import { TstInstanceExpression, TstExpression, TstInstanceObject, TypeMeta, InstanceMeta, TstScopedExpression, ScopeMeta, isBinaryExpression, isIndexExpression, isMemberExpression, isParameter, isVariableExpression, isScopedExpression, TstParameterExpression, TstVariableExpression } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { ArrayBaseTypeDefinition } from "../types/ArrayBaseTypeDefinition.js";
import { printScope } from "./TstPrintVisitor.js";
import { TstScope, getScopeParameter } from "./TstReduceExpressionVisitor.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export class TstInstanceVisitor extends TstReplaceVisitor {
    scopes: Set<TstScope> = new Set();
    visited: Set<TstInstanceObject> = new Set();
    scopeReferenceCount: Map<TstScope, number> = new Map();

    constructor(private runtime: TstRuntime) {
        super();
    }

    incrementScopeReferenceCount(scope: TstScope) {
        const count = this.scopeReferenceCount.get(scope) || 0;
        this.scopeReferenceCount.set(scope, count + 1);
        if (scope.parent) {
            this.incrementScopeReferenceCount(scope.parent);
        }
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

        if (instanceType instanceof ArrayBaseTypeDefinition) {
            const array = expr.instance[InstanceMeta] as TstExpression[];
            for (let i = 0; i < array.length; i++) {
                const element = array[i];
                // Count scope references from array elements
                this.countScopeReferencesInExpression(element);
                this.visit(element);
            }
        }

        return expr;
    }

    private countScopeReferencesInExpression(expr: TstExpression): void {
        // Count scope references in expressions without visiting instances
        // This ensures we count all parameter/variable references from array elements
        
        if (isParameter(expr) || isVariableExpression(expr)) {
            // Both parameter and variable expressions have a 'name' property
            const name = isParameter(expr) ? (expr as TstParameterExpression).name : (expr as TstVariableExpression).name;
            for (const scope of this.scopes) {
                const ref = getScopeParameter(scope, name);
                if (ref) {
                    this.incrementScopeReferenceCount(scope);
                    break;
                }
            }
        } else if (isBinaryExpression(expr)) {
            this.countScopeReferencesInExpression(expr.left);
            this.countScopeReferencesInExpression(expr.right);
        } else if (isMemberExpression(expr)) {
            this.countScopeReferencesInExpression(expr.object);
        } else if (isIndexExpression(expr)) {
            this.countScopeReferencesInExpression(expr.object);
            this.countScopeReferencesInExpression(expr.index);
        } else if (isScopedExpression(expr)) {
            this.incrementScopeReferenceCount(expr.scope);
        }
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
