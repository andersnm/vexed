import { InstanceMeta, isFunctionCall, isFunctionReferenceExpression, isInstanceExpression, isMemberExpression, isReturnStatement, isUnboundFunctionReferenceExpression, RuntimeMeta, ScopeMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstInstanceObject, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstMissingInstanceExpression, TstNativeMemberExpression, TstNewArrayExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstUnaryExpression, TstUnboundFunctionReferenceExpression, TstVariable, TstVariableExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { printExpression } from "./TstPrintVisitor.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export interface TstScope {
    parent: TstScope | null;
    thisObject: TstInstanceObject;
    variables: TstVariable[];
    comment?: string;
}

export function getScopeParameter(scope: TstScope, name: string): TstVariable | null {
    const param = scope.variables.find(v => v.name === name);
    if (param) {
        return param;
    }

    if (scope.parent) {
        return getScopeParameter(scope.parent, name);
    }

    return null;
}

function isScopeReduced(scope: TstScope): boolean {
    for (let variable of scope.variables) {
        if (!isInstanceExpression(variable.value) && !isFunctionReferenceExpression(variable.value) && !isUnboundFunctionReferenceExpression(variable.value)) {
            return false;
        }
    }

    if (scope.parent) {
        return isScopeReduced(scope.parent);
    }

    return true;
}

export class TstReduceExpressionVisitor extends TstReplaceVisitor {

    reduceCount: number = 0;
    scopeStack: TstScope[] = [];
    scopeReferenceCount: Map<TstScope, number> = new Map();

    constructor(private runtime: TstRuntime, scope: TstScope) {
        super();
        this.scopeStack.push(scope);
    }

    get scope() {
        return this.scopeStack[this.scopeStack.length - 1];
    }

    incrementReferenceCount(scope: TstScope) {
        const count = this.scopeReferenceCount.get(scope) || 0;
        this.scopeReferenceCount.set(scope, count + 1);
        if (scope.parent) {
            this.incrementReferenceCount(scope.parent);
        }
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        const objectExpression = this.visit(expr.object);

        if (isInstanceExpression(objectExpression)) {
            // Reduce member expression only if the property is fully reduced
            const instanceType = objectExpression.instance[TypeMeta];
            const propertyExpression = instanceType.resolvePropertyExpression(objectExpression.instance, expr.property);

            if (propertyExpression && (isInstanceExpression(propertyExpression) || isFunctionReferenceExpression(propertyExpression))) {
                this.reduceCount++;
                return propertyExpression;
            }

            // The instance stores an unbound function reference in the property slot which never reduces.
            // This is where the function property is accessed, and returns a new bound function reference.
            // Equivalent to calling `.bind(this)` in JS, but automatically:
            if (propertyExpression && isUnboundFunctionReferenceExpression(propertyExpression)) {
                this.reduceCount++;
                return {
                    exprType: "functionReference",
                    target: objectExpression,
                    method: propertyExpression.method,
                } as TstFunctionReferenceExpression;
            }
        }

        return {
            exprType: "member",
            object: objectExpression,
            property: expr.property,
        } as TstMemberExpression;
    }

    visitUnboundFunctionReferenceExpression(expr: TstUnboundFunctionReferenceExpression): TstExpression {
        // Can only reduce unbound function references in member expression
        return expr;
    }

    visitFunctionReferenceExpression(expr: TstFunctionReferenceExpression): TstExpression {
        return super.visitFunctionReferenceExpression(expr);
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        const parameter = getScopeParameter(this.scope, expr.name);
        if (parameter) {
            this.incrementReferenceCount(this.scope);
            if (isInstanceExpression(parameter.value) || isFunctionReferenceExpression(parameter.value)/* || isFunctionCall(parameter.value)*/) {
                this.reduceCount++;
                return parameter.value;
            }

            return expr;
        }

        throw new Error(`Internal error: Parameter not found: ${expr.name}`);
    }

    visitVariableExpression(expr: TstVariableExpression): TstExpression {
        const variable = getScopeParameter(this.scope, expr.name);
        if (variable) {
            this.incrementReferenceCount(this.scope);
            if (isInstanceExpression(variable.value) || isFunctionReferenceExpression(variable.value)) {
                this.reduceCount++;
                return variable.value;
            }

            return expr;
        }

        throw new Error(`Internal error: Variable not found: ${expr.name}`);
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        // "this" always evaluates inside a scope and reduces immediately. Does not increment the scope reference count.
        this.reduceCount++;
        return {
            exprType: "instance",
            instance: this.scope.thisObject,
        } as TstInstanceExpression;
    }

    visitNewExpression(expr: TstNewExpression): TstExpression {
        this.reduceCount++;
        // this.incrementReferenceCount(this.scope); // ??
        const args = expr.args.map(arg => ({
            exprType: "scoped",
            expr: this.visit(arg),
            scope: this.scope,
            comment: "new " + expr.type.name + "(...)",
        } as TstScopedExpression));

        const instance = expr.type.createInstance(args);

        // Set properties from instance literal if present
        if (expr.properties) {
            for (const prop of expr.properties) {
                const propValue = this.visit(prop.argument);
                const scopedValue = {
                    exprType: "scoped",
                    expr: propValue,
                    scope: this.scope,
                    comment: "instance literal property " + prop.name,
                } as TstScopedExpression;
                
                // Set the property directly on the instance
                instance[prop.name] = scopedValue;
            }
        }

        return {
            exprType: "instance",
            instance: instance,
        } as TstInstanceExpression;
    }

    visitNewArrayExpression(expr: TstNewArrayExpression): TstExpression {
        this.reduceCount++;

        const scopedElements = expr.elements.map(element => ({
            exprType: "scoped",
            expr: this.visit(element),
            scope: this.scope,
            comment: "array element",
        } as TstScopedExpression));

        const arrayInstance = expr.arrayType.createInstance([]);
        arrayInstance![InstanceMeta].push(...scopedElements);

        return {
            exprType: "instance",
            instance: arrayInstance,
        } as TstInstanceExpression;
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        // Multiple expressions can reference the same scope, so this is not the place
        // to reduce the scope itself. This is done separately with the TstReduceScopeVisitor.

        if (!expr.expr) {
            // Should not happen
            throw new Error("Internal error: Empty scoped expression");
        }

        const beforeReduceCount = this.reduceCount;
        const beforeReferenceCount = this.scopeReferenceCount.get(expr.scope) || 0;
        this.scopeStack.push(expr.scope);
        const visited = this.visit(expr.expr);
        this.scopeStack.pop();

        // Reduce scope only when:
        //  - there are no references to this scope in the scoped expression, OR:
        //  - the scope expression cannot be reduced no more
        //  - all parameters in the scope - and its parent scopes - are reduced to instances

        const referenceCount = this.scopeReferenceCount.get(expr.scope) || 0;

        if (referenceCount === beforeReferenceCount || (isScopeReduced(expr.scope)) && beforeReduceCount === this.reduceCount) {
            this.reduceCount++;
            return visited;
        }

        this.incrementReferenceCount(expr.scope);
        return {
            exprType: "scoped",
            expr: visited,
            scope: expr.scope,
        } as TstScopedExpression;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        // Anything instance-specific is reduced separately
        return expr;
    }

    visitPromiseExpression(expr: TstPromiseExpression): TstExpression {
        if (expr.promiseError) {
            throw expr.promiseError;
        }
        if (expr.promiseValue) {
            this.reduceCount++;
            return expr.promiseValue;
        }

        return expr;
    }

    visitNativeMemberExpression(expr: TstNativeMemberExpression): TstExpression {
        const objectExpr = this.visit(expr.object);

        if (isInstanceExpression(objectExpr)) {
            this.reduceCount++;
            return expr.callback(objectExpr.instance);
        }

        return {
            exprType: "nativeMember",
            object: objectExpr,
            callback: expr.callback,
            memberType: expr.memberType,
            memberName: expr.memberName,
        } as TstNativeMemberExpression;
    }

    visitMissingInstanceExpression(expr: TstMissingInstanceExpression): TstExpression {
        return expr;
    }

    visitIndexExpression(expr: TstIndexExpression): TstExpression {
        const objectExpr = this.visit(expr.object);
        const indexExpr = this.visit(expr.index);

        if (isInstanceExpression(objectExpr) && isInstanceExpression(indexExpr)) {
            const instanceType = objectExpr.instance[TypeMeta];
            const indexType = indexExpr.instance[TypeMeta];
            if (indexType != this.runtime.getType("int")) {
                throw new Error("Internal error: Index expression must be of type int");
            }

            const indexValue = indexExpr.instance[InstanceMeta] as number;

            // If both the object and index are instances, we can try to resolve the index
            const resolved = instanceType.resolveIndex(objectExpr.instance, indexValue);
            if (resolved) {
                this.reduceCount++;
                return resolved;
            }
        }

        return {
            exprType: "index",
            object: objectExpr,
            index: indexExpr
        } as TstIndexExpression;
    }

    visitBinaryExpression(expr: TstBinaryExpression): TstExpression {
        const leftExpr = this.visit(expr.left);
        const rightExpr = this.visit(expr.right);

        if (isInstanceExpression(leftExpr) && isInstanceExpression(rightExpr)) {
            const leftType = leftExpr.instance[TypeMeta];
            const rightType = rightExpr.instance[TypeMeta];

            // TODO: allow auto-cast int->decimal, warn or err if cast decimal->int
            if (leftType !== rightType) {
                throw new Error("Binary expression must have same types on both sides");
            }

            this.reduceCount++;
            return leftType.resolveOperator(leftExpr.instance, rightExpr.instance, expr.operator);
        }

        return {
            exprType: "binary",
            left: leftExpr,
            right: rightExpr,
            operator: expr.operator
        } as TstBinaryExpression;
    }

    visitUnaryExpression(expr: TstUnaryExpression): TstExpression {
        if (expr.operator === "typeof") {
            this.incrementReferenceCount(this.scope);
            const operandType = this.runtime.getExpressionType(expr.operand);

            this.reduceCount++;

            const typeType = this.runtime.getType("Type");
            const typeInstance = this.runtime.createInstance(typeType, [], operandType);

            return {
                exprType: "instance",
                instance: typeInstance,
            } as TstInstanceExpression;
        }

        throw new Error("Internal error: Unary operator not implemented: " + expr.operator);
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {

        let callee = this.visit(expr.callee);

        if (!isFunctionReferenceExpression(callee)) {
            return {
                exprType: "functionCall",
                callee: callee,
                args: expr.args, //expr.args.map(arg => this.visit(arg)),
                returnType: expr.returnType,
                genericBindings: expr.genericBindings,
            } as TstFunctionCallExpression;
        }

        if (!isInstanceExpression(callee.target)) {
            // console.log("Callee target is not instance: " + printExpression(callee.target));
            return {
                exprType: "functionCall",
                callee: callee,
                args: expr.args, // expr.args.map(arg => this.visit(arg)),
                returnType: expr.returnType,
                genericBindings: expr.genericBindings,
            } as TstFunctionCallExpression;
        }

        const argsExpr = expr.args.map(arg => this.visit(arg));

        const variables: TstVariable[] = [];
        for (let i = 0; i < argsExpr.length; i++) {
            const arg = argsExpr[i];
            const methodParameter = callee.method.parameters[i];

            const argType = this.runtime.getExpressionType(arg);

            if (!this.runtime.isTypeAssignable(argType, methodParameter.type, expr.genericBindings)) {
                throw new Error(`Function call argument type mismatch for parameter ${methodParameter.name}: expected ${methodParameter.type.name}, got ${argType ? argType.name : "unknown"}`);
            }

            variables.push({
                name: methodParameter.name,
                value: arg,
                type: argType, // methodParameter.type, // <- use the concrete type
            });
        }

        const objectType = callee.method.declaringType;

        const methodScope = callee.target.instance[ScopeMeta].get(objectType);
        if (!methodScope) {
            throw new Error("Internal error: Method scope not found for method " + callee.method.name + " on type " + objectType.name);
        }

        const scope: TstScope = {
            parent: methodScope, // the scope of the constructor
            thisObject: callee.target.instance,
            variables: variables,
            comment: callee.method.declaringType.name + "::" + callee.method.name + "(...)"
        };

        this.incrementReferenceCount(methodScope);
        this.incrementReferenceCount(scope);

        // Functions may "refuse" to invoke, f.ex if expecting a resolved parameter - which is implementation-specific.
        const returnExpr = objectType.callFunction(callee.method, scope);
        if (returnExpr) {
            this.reduceCount++;
            return returnExpr;
        }

        return {
            exprType: "functionCall",
            callee: {
                exprType: "functionReference",
                target: callee.target,
                method: callee.method,
            } as TstFunctionReferenceExpression,
            args: argsExpr,
            returnType: expr.returnType,
            genericBindings: expr.genericBindings,
        } as TstFunctionCallExpression;
    }

    visitStatementExpression(expr: TstStatementExpression): TstExpression {
        const stmts = this.visitStatementList(expr.statements);
        if (stmts.length === 1 && isReturnStatement(stmts[0])) {
            this.reduceCount++;

/*          // TODO: internal error
            const returnValue = stmts[0].returnValue;
            const returnValueType = this.runtime.getExpressionType(returnValue);

            if (!this.runtime.isTypeAssignable(returnValueType!, expr.returnType, new Map<string, TypeDefinition>())) {
                throw new Error(`Return type mismatch in statement expression: expected ${expr.returnType.name}, got ${returnValueType ? returnValueType.name : "unknown"}`);
            }
*/
            return stmts[0].returnValue;
        }

        return {
            exprType: "statement",
            statements: stmts,
            returnType: expr.returnType,
        } as TstStatementExpression;
    }

    visitStatementList(stmtList: TstStatement[]): TstStatement[] {
        const result: TstStatement[] = [];

        for (const stmt of stmtList) {
            const reducedList = this.visitStatement(stmt);

            result.push(...reducedList);

            if (reducedList.some(isReturnStatement)) {
                break;
            }
        }

        return result;
    }

    visitIfStatement(stmt: TstIfStatement): TstStatement[] {
        const condition = this.visit(stmt.condition);
        const thenStmts = this.visitStatementList(stmt.then);
        const elseStmts = this.visitStatementList(stmt.else);

        if (isInstanceExpression(condition)) {
            this.reduceCount++;
            const value = condition.instance[InstanceMeta];
            if (!!value) {
                return thenStmts;
            } else {
                return elseStmts;
            }
        } else {
            return [{ stmtType: "if", condition, then: thenStmts, else: elseStmts } as TstIfStatement];
        }
    }

    visitLocalVarDeclaration(stmt: TstLocalVarDeclaration): TstStatement[] {
        // Create local variable in scope and return no-op
        const initializer = this.visit(stmt.initializer);
        this.scope.variables.push({ name: stmt.name, value: initializer, type: stmt.varType });
        this.incrementReferenceCount(this.scope);
        this.reduceCount++;
        return []; //{ stmtType: "localVarDeclaration", name: stmt.name, varType: stmt.varType, initializer } as TstLocalVarDeclaration];
    }

    visitLocalVarAssignment(stmt: TstLocalVarAssignment): TstStatement[] {
        const expr = this.visit(stmt.expr);
        const variable = this.scope.variables.find(v => v.name === stmt.name);
        if (!variable) {
            throw new Error("Internal error: Variable not found: " + stmt.name);
        }

        variable.value = expr;
        this.incrementReferenceCount(this.scope);
        this.reduceCount++;
        return [];
    }
}
