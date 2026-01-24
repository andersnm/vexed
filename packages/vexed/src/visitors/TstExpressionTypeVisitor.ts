import { TstBinaryExpression, TstDecimalLiteralExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstInstanceExpression, TstMemberExpression, TstMissingInstanceExpression, TstNativeMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstStatementExpression, TstThisExpression, TstUnaryExpression, TstUnboundFunctionReferenceExpression, TstVariableExpression, TypeMeta } from "../TstExpression.js";
import { TstRuntime } from "../TstRuntime.js";
import { TypeDefinition } from "../TstType.js";
import { FunctionTypeDefinition, getFunctionTypeName } from "../types/FunctionTypeDefinition.js";
import { TstReplaceVisitor } from "./TstReplaceVisitor.js";

// Usage: Visit an expression, then check visitType for the resulting type. One-time use.

export class TstExpressionTypeVisitor extends TstReplaceVisitor {

    visitType: TypeDefinition;

    constructor(private runtime: TstRuntime, private thisType: TypeDefinition) {
        super();
        this.visitType = thisType;
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        this.visit(expr.object);

        const objectType = this.visitType;
        if (!objectType) {
            throw new Error("Cannot get type of member expression");
        }

        const typeProperty = objectType.getProperty(expr.property);
        if (!typeProperty) {
            throw new Error(expr.property + " is not a member of " + objectType.name);
        }

        this.visitType = typeProperty.type;
        if (!this.visitType) {
            throw new Error(expr.property + " is not a member of " + objectType.name);
        }

        return expr;
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        this.visitType = expr.type;
        return expr;
    }

    visitVariableExpression(expr: TstVariableExpression): TstExpression {
        this.visitType = expr.type;
        return expr;
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

    visitUnaryExpression(expr: TstUnaryExpression): TstExpression {
        if (expr.operator === "typeof") {
            this.visitType = this.runtime.getType("Type");
        } else {
            this.visit(expr.operand);
        }
        return expr;
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {
        this.visit(expr.callee);

        // callee must resolve a function signature type
        if (!(this.visitType instanceof FunctionTypeDefinition)) {
            console.log(expr);
            throw new Error("Callee is not a function type: " + (this.visitType?.name || "unknown"));
        }

        this.visitType = this.runtime.constructGenericType(this.visitType.returnType, expr.genericBindings);
        return expr;
    }

    visitFunctionReferenceExpression(expr: TstFunctionReferenceExpression): TstExpression {
        const functionTypeName = getFunctionTypeName(expr.method.returnType, expr.method.parameters.map(p => p.type));
        this.visitType = this.runtime.getType(functionTypeName);
        return expr;
    }

    visitUnboundFunctionReferenceExpression(expr: TstUnboundFunctionReferenceExpression): TstExpression {
        const functionTypeName = getFunctionTypeName(expr.method.returnType, expr.method.parameters.map(p => p.type));
        this.visitType = this.runtime.getType(functionTypeName);
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

    visitNativeMemberExpression(expr: TstNativeMemberExpression): TstExpression {
        this.visitType = expr.memberType;
        return expr;
    }

    visitMissingInstanceExpression(expr: TstMissingInstanceExpression): TstExpression {
        this.visitType = expr.propertyType;
        return expr;
    }
}