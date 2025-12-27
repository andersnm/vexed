import { isBinaryExpression, isDecimalLiteral, isFunctionCall, isIdentifier, isIfStatement, isIndexExpression, isInstanceExpression, isLocalVarDeclaration, isMemberExpression, isNewExpression, isParameter, isReturnStatement, isScopedExpression, isStatementExpression, isThisExpression, TstBinaryExpression, TstDecimalLiteralExpression, TstExpression, TstFunctionCallExpression, TstIdentifierExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstLocalVarDeclaration, TstMemberExpression, TstNewExpression, TstParameterExpression, TstReturnStatement, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression } from "../TstExpression.js";

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
        if (isBinaryExpression(expr)) {
            return this.visitBinaryExpression(expr);
        }
        if (isStatementExpression(expr)) {
            return this.visitStatementExpression(expr);
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
            method: expr.method,
            object: this.visit(expr.object),
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

    visitBinaryExpression(expr: TstBinaryExpression): TstExpression {
        return {
            exprType: expr.exprType,
            left: this.visit(expr.left),
            right: this.visit(expr.right),
            operator: expr.operator,
        } as TstBinaryExpression;
    }

    visitStatementExpression(expr: TstStatementExpression): TstExpression {
        return {
            exprType: expr.exprType,
            statements: this.visitStatementList(expr.statements),
            returnType: expr.returnType,
        } as TstStatementExpression;
    }

    visitStatementList(stmtList: TstStatement[]): TstStatement[] {
        // if a statement is an if, it reduces to a statementlist that takes its place

        const result: TstStatement[] = [];
        for (let stmt of stmtList) {
            const reducedStmtList = this.visitStatement(stmt);
            result.push(...reducedStmtList);
        }

        return result; // stmtList.map(stmt => this.visitStatement(stmt));
    }

    visitStatement(stmt: TstStatement): TstStatement[] {
        if (isIfStatement(stmt)) {
            return this.visitIfStatement(stmt);
        }

        if (isReturnStatement(stmt)) {
            return this.visitReturnStatement(stmt);
        }

        if (isLocalVarDeclaration(stmt)) {
            return this.visitLocalVarDeclaration(stmt);
        }

        throw new Error("Unhandled statement type: " + stmt.stmtType);
    }

    visitIfStatement(stmt: TstIfStatement): TstStatement[] {
        return [{
            stmtType: "if",
            condition: this.visit(stmt.condition),
            then: this.visitStatementList(stmt.then),
            else: this.visitStatementList(stmt.else),
        } as TstIfStatement];
    }

    visitReturnStatement(stmt: TstReturnStatement): TstStatement[] {
        return [{
            stmtType: "return",
            returnValue: this.visit(stmt.returnValue),
        } as TstReturnStatement];
    }

    visitLocalVarDeclaration(stmt: TstLocalVarDeclaration): TstStatement[] {
        return [{
            stmtType: "localVarDeclaration",
            varType: stmt.varType,
            name: stmt.name,
            initializer: this.visit(stmt.initializer),
        } as TstLocalVarDeclaration];
    }
}
