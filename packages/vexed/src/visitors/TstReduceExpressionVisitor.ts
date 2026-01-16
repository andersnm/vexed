import { InstanceMeta, isInstanceExpression, isReturnStatement, RuntimeMeta, ScopeMeta, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstInstanceObject, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstMissingInstanceExpression, TstNativeMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstUnaryExpression, TstVariable, TstVariableExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { printExpression, printScope } from "./TstPrintVisitor.js";
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
        if (!isInstanceExpression(variable.value)) {
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
    promiseExpressions: TstPromiseExpression[] = [];

    constructor(private runtime: TstRuntime, private scope: TstScope) {
        super();
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        const objectExpression = this.visit(expr.object);

        if (isInstanceExpression(objectExpression)) {
            const instanceType = objectExpression.instance[TypeMeta];
            const propertyExpression = instanceType.resolvePropertyDeep(objectExpression.instance, expr.property);

            if (propertyExpression && isInstanceExpression(propertyExpression)) {
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

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        const parameter = getScopeParameter(this.scope, expr.name);
        if (parameter) {
            if (isInstanceExpression(parameter.value)) {
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
            if (isInstanceExpression(variable.value)) {
                this.reduceCount++;
                return variable.value;
            }

            return expr;
        }

        throw new Error("Variable not found: " + expr.name);
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        this.reduceCount++;
        return {
            exprType: "instance",
            instance: this.scope.thisObject,
        } as TstInstanceExpression;
    }

    visitNewExpression(expr: TstNewExpression): TstExpression {
        this.reduceCount++;

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

        const scopeVisitor = new TstReduceExpressionVisitor(this.runtime, expr.scope);
        const visited = scopeVisitor.visit(expr.expr);
        this.promiseExpressions.push(...scopeVisitor.promiseExpressions);
        this.reduceCount += scopeVisitor.reduceCount;

        const canReduce = isScopeReduced(expr.scope);

        // Reduce scope only when:
        //  - the scope expression cannot be reduced no more
        //  - all parameters in the scope - and its parent scopes - are reduced to instances
        if (canReduce && scopeVisitor.reduceCount === 0) {
            this.reduceCount++;
            return visited;
        }

        return {
            exprType: "scoped",
            expr: visited,
            scope: expr.scope,
        } as TstScopedExpression;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {

        if (expr.instance[RuntimeMeta].sealed) {
            return expr;
        }

        // Reduce array elements
        const instanceType = expr.instance[TypeMeta];
        if (!instanceType.name.endsWith("[]")) {
            return expr;
        }

        const array = expr.instance[InstanceMeta] as TstExpression[];

        for (let i = 0; i < array.length; i++) {
            const element = array[i];
            array[i] = this.visit(element);
        }

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

        this.promiseExpressions.push(expr);
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
        const objectExpr = this.visit(expr.object);
        const argsExpr = expr.args.map(arg => this.visit(arg));
        const chainNamedArguments: TstVariable[] = expr.method.parameters.map((p, index) => ({
            name: p.name,
            value: argsExpr[index],
            type: p.type,
        }));

        if (isInstanceExpression(objectExpr)) {
            const objectType = expr.method.declaringType;

            const methodScope = objectExpr.instance[ScopeMeta].get(objectType)
            if (!methodScope) {
                throw new Error("Method scope not found for method " + expr.method.name + " on type " + objectType.name);
            }

            const scope: TstScope = {
                parent: methodScope, // the scope of the constructor
                thisObject: objectExpr.instance,
                variables: chainNamedArguments,
                comment: expr.method.declaringType.name + "::" + expr.method.name + "(...)"
            };

            // Functions may "refuse" to invoke, f.ex if expecting a resolved parameter - which is implementation-specific.
            const returnExpr = objectType.callFunction(expr.method, scope);
            if (returnExpr) {
                this.reduceCount++;
                return returnExpr;
            }
        }

        return {
            exprType: "functionCall",
            object: objectExpr,
            method: expr.method,
            args: argsExpr
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
        this.reduceCount++;
        return [];
    }
}
