import { TstInstanceExpression, TstExpression, TstInstanceObject, TypeMeta, InstanceMeta, TstScopedExpression, ScopeMeta, isBinaryExpression, isIndexExpression, isMemberExpression, isParameter, isVariableExpression, isScopedExpression, TstParameterExpression, TstVariableExpression, TstBinaryExpression, TstMemberExpression, TstIndexExpression } from "../TstExpression.js";
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
                // Visit array elements - counting happens via visitor overrides
                this.visit(element);
            }
        }

        return expr;
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        // Count reference when visiting parameter expressions
        this.countParameterOrVariableReference(expr.name);
        return super.visitParameterExpression(expr);
    }

    visitVariableExpression(expr: TstVariableExpression): TstExpression {
        // Count reference when visiting variable expressions
        this.countParameterOrVariableReference(expr.name);
        return super.visitVariableExpression(expr);
    }

    visitBinaryExpression(expr: TstBinaryExpression): TstExpression {
        // Visit both sides to count references
        return super.visitBinaryExpression(expr);
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        // Visit object to count references
        return super.visitMemberExpression(expr);
    }

    visitIndexExpression(expr: TstIndexExpression): TstExpression {
        // Visit both object and index to count references
        return super.visitIndexExpression(expr);
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        // Collect instances referenced only from variables
        this.visitScope(expr.scope);
        
        // Count reference to the scoped expression's scope
        this.incrementScopeReferenceCount(expr.scope);
        
        return super.visitScopedExpression(expr);
    }

    private countParameterOrVariableReference(name: string): void {
        // Find which scope this parameter/variable belongs to and increment its count
        for (const scope of this.scopes) {
            const ref = getScopeParameter(scope, name);
            if (ref) {
                this.incrementScopeReferenceCount(scope);
                break;
            }
        }
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
