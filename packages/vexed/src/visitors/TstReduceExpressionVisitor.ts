import { InstanceMeta, isFunctionCall, isFunctionReferenceExpression, isInstanceExpression, isMemberExpression, isReturnStatement, RuntimeMeta, ScopeMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstInstanceObject, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstMissingInstanceExpression, TstNativeMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstUnaryExpression, TstVariable, TstVariableExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
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
        if (!isInstanceExpression(variable.value) && !isFunctionReferenceExpression(variable.value)) {
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
            const instanceType = objectExpression.instance[TypeMeta];
            const propertyExpression = instanceType.resolvePropertyDeep(objectExpression.instance, expr.property);

            if (propertyExpression && (isInstanceExpression(propertyExpression) || isFunctionReferenceExpression(propertyExpression))) {
                this.reduceCount++;
                return propertyExpression;
            }
        }

        return {
            exprType: "member",
            object: objectExpression,
            property: expr.property,
        } as TstMemberExpression;
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

        throw new Error("Parameter not found: " + expr.name);
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

        throw new Error("Variable not found: " + expr.name);
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        this.reduceCount++;
        this.incrementReferenceCount(this.scope);
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

        return {
            exprType: "instance",
            instance: instance,
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
        this.scopeStack.push(expr.scope);
        const visited = this.visit(expr.expr);
        this.scopeStack.pop();

        // Reduce scope only when:
        //  - the scope expression cannot be reduced no more
        //  - all parameters in the scope - and its parent scopes - are reduced to instances
        //  - there are no references to this scope in the scoped expression

        const scopeReferenceCount = this.scopeReferenceCount.get(expr.scope) || 0;

        if (scopeReferenceCount === 0 || (isScopeReduced(expr.scope)) && beforeReduceCount === this.reduceCount) {
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
                throw new Error("Index expression must be of type int");
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
            const operandType = this.runtime.getExpressionType(expr.operand, this.scope.thisObject[TypeMeta]);
            if (!operandType) {
                throw new Error("Cannot resolve type of operand in typeof expression");
            }

            this.reduceCount++;

            const typeType = this.runtime.getType("Type");
            const typeInstance = this.runtime.createInstance(typeType, [], operandType);

            return {
                exprType: "instance",
                instance: typeInstance,
            } as TstInstanceExpression;
        }

        throw new Error("Unsupported unary operator: " + expr.operator);
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {

        let callee = this.visit(expr.callee);

        if (isFunctionReferenceExpression(callee)) {
            ;
        } else if (isMemberExpression(callee)) {
            // console.log("Callee is not a function reference : " + callee.exprType);

            if (isInstanceExpression(callee.object)) { 
                const objType = callee.object.instance[TypeMeta]; 
                const method = objType.getMethod(callee.property);

                callee = {
                    exprType: "functionReference",
                    target: callee.object,
                    method: method,
                } as TstFunctionReferenceExpression;
            } else {
                throw new Error("Callee member expression object is not an instance" + callee.object.exprType);
            }

        } else {

            return {
                exprType: "functionCall",
                callee: callee,
                args: expr.args, //expr.args.map(arg => this.visit(arg)),
                returnType: expr.returnType,
            } as TstFunctionCallExpression;
        }

        if (!isFunctionReferenceExpression(callee)) {
            throw new Error("Should be function reference at this point");
        }

        if (!isInstanceExpression(callee.target)) {
            // console.log("Callee target is not instance: " + printExpression(callee.target));
            return {
                exprType: "functionCall",
                callee: callee,
                args: expr.args, // expr.args.map(arg => this.visit(arg)),
                returnType: expr.returnType,
            } as TstFunctionCallExpression;
        }

        const argsExpr = expr.args.map(arg => this.visit(arg));

        const variables: TstVariable[] = [];
        for (let i = 0; i < argsExpr.length; i++) {
            const arg = argsExpr[i];
            const methodParameter = callee.method.parameters[i];
            this.incrementReferenceCount(this.scope);
            const argType = this.runtime.getExpressionType(arg, this.scope.thisObject[TypeMeta]);

            if (!this.runtime.isTypeAssignable(argType, methodParameter.type)) {
                throw new Error(`Function call argument type mismatch for parameter ${methodParameter.name}: expected ${methodParameter.type.name}, got ${argType ? argType.name : "unknown"}`);
            }

            variables.push({
                name: methodParameter.name,
                value: arg,
                type: methodParameter.type,
            });
        }

        const objectType = callee.method.declaringType;

        const methodScope = callee.target.instance[ScopeMeta].get(objectType);
        if (!methodScope) {
            throw new Error("Method scope not found for method " + callee.method.name + " on type " + objectType.name);
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
        } as TstFunctionCallExpression;
    }

    visitStatementExpression(expr: TstStatementExpression): TstExpression {
        const stmts = this.visitStatementList(expr.statements);
        if (stmts.length === 1 && isReturnStatement(stmts[0])) {
            this.reduceCount++;
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
            throw new Error("Variable not found: " + stmt.name);
        }

        variable.value = expr;
        this.incrementReferenceCount(this.scope);
        this.reduceCount++;
        return [];
    }
}
