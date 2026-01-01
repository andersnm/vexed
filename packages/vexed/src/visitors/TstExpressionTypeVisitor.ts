import { TstBinaryExpression, TstDecimalLiteralExpression, TstExpression, TstFunctionCallExpression, TstInstanceExpression, TstMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstStatementExpression, TstThisExpression, TstVariable, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

// Usage: Visit an expression, then check visitType for the resulting type. One-time use.

export class TstExpressionTypeVisitor extends TstReplaceVisitor {

    visitType: TypeDefinition | null = null;

    constructor(private runtime: TstRuntime, private thisType: TypeDefinition) {
        super();
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        this.visit(expr.object);

        const objectType = this.visitType;
        if (!objectType) {
            throw new Error("Cannot get type of member expression");
        }

        this.visitType = objectType.getProperty(expr.property)?.type || null;
        if (!this.visitType) {
            throw new Error(expr.property + " is not a member of " + objectType.name);
        }

        return expr;
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        const parameter = this.thisType.parameters.find(p => p.name === expr.name);
        if (parameter) {
            this.visitType = parameter.type;
            return expr;
        }

        throw new Error("Parameter not found: " + expr.name);
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        this.visitType = this.thisType;
        return expr;
    }

    visitNewExpression(expr: TstNewExpression): TstExpression {
        this.visitType = expr.type;
        return expr;
    }

    visitDecimalLiteral(expr: TstDecimalLiteralExpression): TstDecimalLiteralExpression {
        this.visitType = this.runtime.getType("decimal");
        return expr;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        this.visitType = expr.instance[TypeMeta];
        return expr;
    }

    visitBinaryExpression(expr: TstBinaryExpression): TstExpression {
        this.visit(expr.left);
        const lhsType = this.visitType;

        this.visit(expr.right);
        const rhsType = this.visitType;

        if (lhsType !== rhsType) {
            throw new Error("Binary expression must have same types on both sides");
        }

        return expr;
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {
        this.visitType = expr.method.returnType;
        return expr;
    }

    visitStatementExpression(expr: TstStatementExpression): TstExpression {
        this.visitType = expr.returnType;
        return expr;
    }

    visitPromiseExpression(expr: TstPromiseExpression): TstExpression {
        this.visitType = expr.promiseType;
        return expr;
    }
}