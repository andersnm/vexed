import { isBinaryExpression, isDecimalLiteral, isFunctionCall, isFunctionReferenceExpression, isIfStatement, isIndexExpression, isInstanceExpression, isLocalVarAssignment, isLocalVarDeclaration, isMemberExpression, isMissingInstanceExpression, isNativeMemberExpression, isNewExpression, isParameter, isPromiseExpression, isReturnStatement, isScopedExpression, isStatementExpression, isThisExpression, isUnaryExpression, isUnboundFunctionReferenceExpression, isVariableExpression, TstBinaryExpression, TstDecimalLiteralExpression, TstExpression, TstFunctionCallExpression, TstFunctionReferenceExpression, TstIfStatement, TstIndexExpression, TstInstanceExpression, TstLocalVarAssignment, TstLocalVarDeclaration, TstMemberExpression, TstMissingInstanceExpression, TstNativeMemberExpression, TstNewExpression, TstParameterExpression, TstPromiseExpression, TstReturnStatement, TstScopedExpression, TstStatement, TstStatementExpression, TstThisExpression, TstUnaryExpression, TstUnboundFunctionReferenceExpression, TstVariableExpression } from "../TstExpression.js";

export class TstReplaceVisitor {

    visit(expr: TstExpression): TstExpression {
        if (isNewExpression(expr)) {
            return this.visitNewExpression(expr);
        }
        if (isDecimalLiteral(expr)) {
            return this.visitDecimalLiteral(expr);
        }
        if (isFunctionCall(expr)) {
            return this.visitFunctionCallExpression(expr);
        }
        if (isFunctionReferenceExpression(expr)) {
            return this.visitFunctionReferenceExpression(expr);
        }
        if (isUnboundFunctionReferenceExpression(expr)) {
            return this.visitUnboundFunctionReferenceExpression(expr);
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
        if (isVariableExpression(expr)) {
            return this.visitVariableExpression(expr);
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
        if (isUnaryExpression(expr)) {
            return this.visitUnaryExpression(expr);
        }
        if (isStatementExpression(expr)) {
            return this.visitStatementExpression(expr);
        }
        if (isVariableExpression(expr)) {
            return this.visitVariableExpression(expr);
        }
        if (isPromiseExpression(expr)) {
            return this.visitPromiseExpression(expr);
        }
        if (isNativeMemberExpression(expr)) {
            return this.visitNativeMemberExpression(expr);
        }
        if (isMissingInstanceExpression(expr)) {
            return this.visitMissingInstanceExpression(expr);
        }

        if (expr.exprType === "null") {
            return this.visitNullExpression(expr);
        }

        // keep a clear error for unexpected node kinds
        throw new Error(`TstReplaceVisitor: Unhandled expression type: ${expr.exprType}`);
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
            type: expr.type,
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

    visitVariableExpression(expr: TstVariableExpression): TstExpression {
        return {
            exprType: expr.exprType,
            name: expr.name,
            type: expr.type,
        } as TstVariableExpression;
    }

    visitPromiseExpression(expr: TstPromiseExpression): TstExpression {
        return {
            exprType: expr.exprType,
            promiseType: expr.promiseType,
            promise: expr.promise,
            promiseError: expr.promiseError,
            promiseValue: expr.promiseValue,
        } as TstPromiseExpression;
    }

    visitNativeMemberExpression(expr: TstNativeMemberExpression): TstExpression {
        return {
            exprType: expr.exprType,
            object: this.visit(expr.object),
            callback: expr.callback,
            memberType: expr.memberType,
            memberName: expr.memberName,
        } as TstNativeMemberExpression;
    }

    visitMissingInstanceExpression(expr: TstMissingInstanceExpression): TstExpression {
        return {
            exprType: expr.exprType,
            error: expr.error,
            instance: expr.instance,
            meta: expr.meta,
            propertyName: expr.propertyName,
        } as TstMissingInstanceExpression;
    }

    visitFunctionCallExpression(expr: TstFunctionCallExpression): TstExpression {
        return {
            callee: this.visit(expr.callee),
            exprType: expr.exprType,
            args: expr.args.map(arg => this.visit(arg)),
            returnType: expr.returnType,
            genericBindings: expr.genericBindings,
        } as TstFunctionCallExpression;
    }

    visitFunctionReferenceExpression(expr: TstFunctionReferenceExpression): TstExpression {
        return {
            exprType: expr.exprType,
            method: expr.method,
            target: this.visit(expr.target),
        } as TstFunctionReferenceExpression;
    }

    visitUnboundFunctionReferenceExpression(expr: TstUnboundFunctionReferenceExpression): TstExpression {
        return {
            exprType: expr.exprType,
            method: expr.method,
        } as TstUnboundFunctionReferenceExpression;
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
            scope: expr.scope,
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

    visitUnaryExpression(expr: TstUnaryExpression): TstExpression {
        return {
            exprType: expr.exprType,
            operator: expr.operator,
            operand: this.visit(expr.operand),
        } as TstUnaryExpression;
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

        if (isLocalVarAssignment(stmt)) {
            return this.visitLocalVarAssignment(stmt);
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

    visitLocalVarAssignment(stmt: TstLocalVarAssignment): TstStatement[] {
        return [{
            stmtType: "localVarAssignment",
            name: stmt.name,
            expr: this.visit(stmt.expr),
        } as TstLocalVarAssignment];
    }

    visitNullExpression(expr: TstExpression): TstExpression {
        return {
            exprType: "null",
        } as TstExpression;
    }
}
