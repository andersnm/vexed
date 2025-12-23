import { isDecimalLiteral, isFunctionCall, isIdentifier, isIndexExpression, isInstanceExpression, isMemberExpression, isNewExpression, isParameter, isScopedExpression, isThisExpression, TstDecimalLiteralExpression, TstExpression, TstFunctionCallExpression, TstIdentifierExpression, TstIndexExpression, TstInstanceExpression, TstMemberExpression, TstNewExpression, TstParameterExpression, TstScopedExpression, TstThisExpression } from "../TstExpression.js";

export class TstReplaceVisitor {

    visit(expr: TstExpression): TstExpression {
        if (isNewExpression(expr)) {
            return this.visitNewExpression(expr);
        }
        if (isIdentifier(expr)) {
            return this.visitIdentifierExpression(expr);
        }
        if (isDecimalLiteral(expr)) {
            return this.visitDecimalLiteral(expr);
        }
        if (isFunctionCall(expr)) {
            return this.visitFunctionCallExpression(expr);
        }
        if (isMemberExpression(expr)) {
            return this.visitMemberExpression(expr);
        }
        if (isThisExpression(expr)) {
            return this.visitThisExpression(expr);
        }
        if (isInstanceExpression(expr)) {
            return this.visitInstanceExpression(expr);
        }
        if (isParameter(expr)) {
            return this.visitParameterExpression(expr);
        }
        if (isScopedExpression(expr)) {
            return this.visitScopedExpression(expr);
        }
        if (isIndexExpression(expr)) {
            return this.visitIndexExpression(expr);
        }

        // keep a clear error for unexpected node kinds
        throw new Error(`TstReplaceVisitor: Unhandled expression type: ${expr.exprType}`);
    }

    visitIdentifierExpression(expr: TstIdentifierExpression): TstExpression {
        return {
            exprType: expr.exprType,
            value: expr.value,
        } as TstIdentifierExpression;
    }

    visitDecimalLiteral(expr: TstDecimalLiteralExpression): TstExpression {
        return {
            exprType: expr.exprType,
            value: expr.value,
        } as TstDecimalLiteralExpression;
    }

    visitThisExpression(expr: TstThisExpression): TstExpression {
        return {
            exprType: expr.exprType,
        } as TstThisExpression;
    }

    visitInstanceExpression(expr: TstInstanceExpression): TstExpression {
        return {
            exprType: expr.exprType,
            instance: expr.instance,
        } as TstInstanceExpression;
    }

    visitParameterExpression(expr: TstParameterExpression): TstExpression {
        return {
            exprType: expr.exprType,
            name: expr.name,
            type: expr.type,
        } as TstParameterExpression;
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {
        return {
            functionName: expr.functionName,
            exprType: expr.exprType,
            args: expr.args.map(arg => this.visit(arg)),
        } as TstFunctionCallExpression;
    }

    visitNewExpression(expr: TstNewExpression): TstExpression {
        // Logic to create an instance of the type and replace the new expression
        // console.log("Visiting new expression for type:", expr.type.name);
        // Here you would create the instance and return an appropriate expression
        // For now, just returning the original expression
        return {
            exprType: expr.exprType,
            type: expr.type,
            args: expr.args.map(arg => this.visit(arg)),
        } as TstNewExpression;
    }

    visitMemberExpression(expr: TstMemberExpression): TstExpression {
        return {
            exprType: expr.exprType,
            object: this.visit(expr.object),
            property: expr.property,
        } as TstMemberExpression;
    }

    visitScopedExpression(expr: TstScopedExpression): TstExpression {
        return {
            exprType: expr.exprType,
            parameters: expr.parameters,
            expr: this.visit(expr.expr),
        } as TstScopedExpression;
    }

    visitIndexExpression(expr: TstIndexExpression): TstExpression {
        return {
            exprType: expr.exprType,
            object: this.visit(expr.object),
            index: this.visit(expr.index),
        } as TstIndexExpression;
    }
}
