import { InstanceMeta, isInstanceExpression, isMethodExpression, isReturnStatement, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstInstanceObject, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstUnaryExpression, TstVariable, TstVariableExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export interface TstScope {
    parent: TstScope | null;
    thisObject: TstInstanceObject;
    variables: TstVariable[];
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

export class TstReduceExpressionVisitor extends TstReplaceVisitor {

    reduceCount: number = 0;
    promiseExpressions: TstPromiseExpression[] = [];

    constructor(private runtime: TstRuntime, private scope: TstScope, private visitedInstances: Set<TstInstanceObject> = new Set()) {
        super();
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        const objectExpression = this.visit(expr.object);

        if (isInstanceExpression(objectExpression)) {
            const instanceType = objectExpression.instance[TypeMeta];
            const propertyExpression = instanceType.resolveProperty(objectExpression.instance, expr.property);

            // If the property is legit, but the property doesnt exist, it's not resolved yet, so dont reduce
            // TODO: Beware, if the property is an overriden default, this could resolve to the original default
            if (propertyExpression) {
                const reduced = this.visit(propertyExpression);
                if (isInstanceExpression(reduced) || reduced.exprType === "decimalLiteral") {
                    this.reduceCount++;
                    return reduced;
                }

                return reduced;
            }
        }

        return {
            exprType: "member",
            object: objectExpression,
            property: expr.property,
        } as TstMemberExpression;
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        // console.log("Visiting parameter expression", expr.name);
        const parameter = getScopeParameter(this.scope, expr.name);
        if (parameter) {
            this.reduceCount++;
            return this.visit(parameter.value);
        }

        throw new Error("Parameter not found: " + expr.name);
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

        const instance = expr.type.createInstance(expr.args);
        return {
            exprType: "instance",
            instance: instance,
        } as TstInstanceExpression;
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        // TODO: can only reduce this if all parameters are reduced!
        this.reduceCount++;

        const scopeVisitor = new TstReduceExpressionVisitor(this.runtime, expr.scope, this.visitedInstances);
        const visited = scopeVisitor.visit(expr.expr);
        this.promiseExpressions.push(...scopeVisitor.promiseExpressions);
        return visited;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        // Should be no-op if instance was already resolved during this visitation
        if (this.visitedInstances.has(expr.instance)) {
            return expr;
        }

        this.visitedInstances.add(expr.instance);

        const instanceType = expr.instance[TypeMeta];

        for (let propertyName in expr.instance) {
            // TODO: does not have to write reduce native properties back to object, but presumed harmless at the moment
            const propertyExpr = instanceType.resolveProperty(expr.instance, propertyName);
            if (!propertyExpr) {
                throw new Error("Property " + propertyName + " not found on instance of type " + instanceType.name);
            }

            const reduced = this.visit(propertyExpr);
            expr.instance[propertyName] = reduced;
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
        }));

        if (isInstanceExpression(objectExpr)) {
            const methodExpression = objectExpr.instance[expr.method.name];
            if (!methodExpression) {
                throw new Error("Method " + expr.method.name + " not found on instance of type " + objectExpr.instance[TypeMeta].name);
            }

            if (!isMethodExpression(methodExpression)) {
                throw new Error("Property " + expr.method.name + " is not a method on instance of type " + objectExpr.instance[TypeMeta].name);
            }

            const scope: TstScope = {
                parent: methodExpression.scope, // the scope of the constructor
                thisObject: objectExpr.instance,
                variables: chainNamedArguments,
            };

            const objectType = objectExpr.instance[TypeMeta];

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
        this.scope.variables.push({ name: stmt.name, value: initializer });
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

    visitVariableExpression(expr: TstVariableExpression): TstExpression {
        const variable = getScopeParameter(this.scope, expr.name);
        if (variable) {
            this.reduceCount++;
            return variable.value;
        }
        throw new Error("Variable not found: " + expr.name);
    }
}
