import { InstanceMeta, isIfStatement, isInstanceExpression, isReturnStatement, TstBinaryExpression, TstExpression, TstFunctionCallExpression, TstIdentifierExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstInstanceObject, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstVariable, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

export class TstReduceExpressionVisitor extends TstReplaceVisitor {

    constructor(private runtime: TstRuntime, private thisObject: TstInstanceObject, private currentParameters: TstVariable[] = [], private visitedInstances: Set<TstInstanceObject> = new Set()) {
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
        const parameter = this.currentParameters.find(p => p.name === expr.name);
        if (parameter) {
            return this.visit(parameter.value);
        }

        throw new Error("Parameter not found: " + expr.name);
    }

    visitIdentifierExpression(expr: TstIdentifierExpression): TstExpression {
        throw new Error("Identifier not found: " + expr.value);
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        return {
            exprType: "instance",
            instance: this.thisObject,
        } as TstInstanceExpression;
    }

    visitNewExpression(expr: TstNewExpression): TstExpression {
        const instance = expr.type.createInstance(expr.args);

        return {
            exprType: "instance",
            instance: instance,
        } as TstInstanceExpression;
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        // TODO: can only reduce this if all parameters are reduced!
        const scopeVisitor = new TstReduceExpressionVisitor(this.runtime, expr.thisObject, expr.parameters, this.visitedInstances);
        // const scopeVisitor = new TstReduceExpressionVisitor(this.runtime, this.thisObject, expr.parameters, this.visitedInstances);
        const visited = scopeVisitor.visit(expr.expr);
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

            return leftType.resolveOperator(leftExpr.instance, rightExpr.instance, expr.operator);
        }

        return {
            exprType: "binary",
            left: leftExpr,
            right: rightExpr,
            operator: expr.operator
        } as TstBinaryExpression;
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {
        const objectExpr = this.visit(expr.object);
        const argsExpr = expr.args.map(arg => this.visit(arg));
        const chainNamedArguments: TstVariable[] = expr.method.parameters.map((p, index) => ({
            name: p.name,
            value: argsExpr[index],
        }));

        if (isInstanceExpression(objectExpr)) {
            return {
                exprType: "scoped",
                thisObject: objectExpr.instance,
                parameters: chainNamedArguments,
                expr: {
                    exprType: "statement",
                    statements: expr.method.body,
                    returnType: expr.method.returnType,
                } as TstStatementExpression
            } as TstScopedExpression;
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
            return stmts[0].returnValue;
        }

        return {
            exprType: "statement",
            statements: stmts,
            returnType: expr.returnType,
        } as TstStatementExpression;
    }

    visitIfStatement(stmt: TstIfStatement): TstStatement[] {
        const condition = this.visit(stmt.condition);
        const thenStmts = this.visitStatementList(stmt.then);
        const elseStmts = this.visitStatementList(stmt.else);

        if (isInstanceExpression(condition)) {
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

    scope: TstVariable[] = [];

    visitLocalVarDeclaration(stmt: TstLocalVarDeclaration): TstStatement[] {
        // TODO: should create local variable in scope and return no-op
        // scope = statementexpression? 
        const initializer = this.visit(stmt.initializer);
        this.scope.push({ name: stmt.name, value: initializer });
        return []; //{ stmtType: "localVarDeclaration", name: stmt.name, varType: stmt.varType, initializer } as TstLocalVarDeclaration];
    }

}
